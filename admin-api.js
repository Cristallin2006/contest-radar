import fs from "node:fs";
import { db } from "./db.js";
import {
  archiveEdition,
  createEdition,
  createSeries,
  createStage,
  deleteStage,
  getEdition,
  getSeries,
  listAudit,
  listChanges,
  listEditions,
  listSeries,
  recordAudit,
  updateEdition,
  updateSeries,
  updateStage,
  upsertManualTags,
} from "./events.js";
import {
  acceptAllExact,
  acceptIngest,
  acceptSource,
  getIngest,
  ingestStats,
  listIngest,
  rejectIngest,
} from "./ingest.js";
import { getMeta } from "./schema.js";
import { acceptSubmission, getSubmission, listSubmissionsForAdmin, rejectSubmission } from "./submissions.js";
import {
  checkOrigin,
  clientIp,
  error,
  json,
  readJson,
  tokenMatches,
} from "./http.js";

function overview() {
  const editionCounts = db.prepare(`
    SELECT publish_state, COUNT(*) AS n FROM event_editions GROUP BY publish_state
  `).all();
  const editions = { draft: 0, pending: 0, published: 0, archived: 0, total: 0 };
  for (const row of editionCounts) {
    editions[row.publish_state] = row.n;
    editions.total += row.n;
  }
  return {
    editions,
    series: db.prepare("SELECT COUNT(*) AS n FROM event_series").get()?.n ?? 0,
    stages: db.prepare("SELECT COUNT(*) AS n FROM event_stages").get()?.n ?? 0,
    ingest: ingestStats(),
    submissions: {
      pending: db.prepare("SELECT COUNT(*) AS n FROM competition_submissions WHERE status = 'pending'").get()?.n ?? 0,
      total: db.prepare("SELECT COUNT(*) AS n FROM competition_submissions").get()?.n ?? 0,
    },
    users: db.prepare("SELECT COUNT(*) AS n FROM users").get()?.n ?? 0,
    sources: db.prepare("SELECT * FROM sources ORDER BY id").all(),
    schema_version: Number(getMeta("schema_version", "0")),
  };
}

function sources() {
  return db.prepare("SELECT * FROM sources ORDER BY id").all();
}

function adminList(url) {
  const q = url.searchParams;
  return listEditions({
    region: q.get("region") || undefined,
    category: q.get("category") || undefined,
    q: q.get("q") || undefined,
    status: q.get("status") || undefined,
    publish_state: q.get("publish_state") || undefined,
    page: q.get("page") || undefined,
    size: q.get("size") || "50",
    sort: q.get("sort") || "updated",
  }, { admin: true });
}

export async function handleAdminApi(req, res, url, ctx = {}) {
  const pathname = url.pathname;
  if (!pathname.startsWith("/api/v1/admin")) return false;

  const expected = ctx.adminToken || "";
  if (!expected) {
    error(res, "ADMIN_DISABLED", 401, "管理员令牌未配置");
    return true;
  }
  if (!tokenMatches(req.headers["x-admin-token"], expected)) {
    error(res, "UNAUTHORIZED", 401, "未授权");
    return true;
  }
  if (!checkOrigin(req, ctx.allowedOrigins || [])) {
    error(res, "BAD_ORIGIN", 403, "Origin 不被允许");
    return true;
  }

  const actor = "admin-token";
  const ip = clientIp(req);
  const method = req.method || "GET";

  try {
    if (pathname === "/api/v1/admin/overview" && method === "GET") {
      json(res, 200, overview());
      return true;
    }
    if (pathname === "/api/v1/admin/health" && method === "GET") {
      let dbSize = null;
      try { dbSize = fs.statSync(ctx.dbPath).size; } catch { /* ignore */ }
      json(res, 200, {
        ok: true,
        schema_version: Number(getMeta("schema_version", "0")),
        db_size: dbSize,
        last_refresh: ctx.lastRefresh || null,
        refreshing: Boolean(ctx.refreshing),
        backup_dir: ctx.backupDir || null,
        now: new Date().toISOString(),
      });
      return true;
    }
    if (pathname === "/api/v1/admin/submissions" && method === "GET") {
      json(res, 200, {
        items: listSubmissionsForAdmin(url.searchParams.get("state") || "pending", url.searchParams.get("limit") || 100),
      });
      return true;
    }
    const submissionAction = pathname.match(/^\/api\/v1\/admin\/submissions\/(\d+)\/(accept|reject)$/);
    if (submissionAction && method === "POST") {
      const id = Number(submissionAction[1]);
      if (submissionAction[2] === "accept") {
        const result = acceptSubmission(id, actor);
        recordAudit(actor, "accept-submission", `competition_submissions:${id}`, { edition_id: result.edition.id }, ip);
        json(res, 200, result);
      } else {
        const body = await readJson(req);
        const item = rejectSubmission(id, body.reason || null, actor);
        recordAudit(actor, "reject-submission", `competition_submissions:${id}`, { reason: body.reason || null }, ip);
        json(res, 200, item);
      }
      return true;
    }

    if (pathname === "/api/v1/admin/ingest" && method === "GET") {
      const sourceCounts = db.prepare(`
        SELECT source, COUNT(*) AS n FROM ingest_items WHERE state = 'pending' GROUP BY source ORDER BY n DESC
      `).all();
      json(res, 200, {
        items: listIngest({
          state: url.searchParams.get("state") || "pending",
          source: url.searchParams.get("source") || null,
          limit: url.searchParams.get("limit") || 100,
        }),
        stats: ingestStats(),
        source_counts: sourceCounts,
      });
      return true;
    }
    if (pathname === "/api/v1/admin/ingest/accept-exact" && method === "POST") {
      json(res, 200, acceptAllExact({ actor, ip }));
      return true;
    }
    if (pathname === "/api/v1/admin/ingest/accept-source" && method === "POST") {
      const body = await readJson(req);
      const source = String(body.source || "").trim();
      if (!source || source === "all") {
        error(res, "SOURCE_REQUIRED", 400, "请先选择一个来源");
        return true;
      }
      json(res, 200, acceptSource(source, { actor, ip }));
      return true;
    }
    const ingestAccept = pathname.match(/^\/api\/v1\/admin\/ingest\/(\d+)\/accept$/);
    if (ingestAccept && method === "POST") {
      const body = await readJson(req);
      const result = acceptIngest(Number(ingestAccept[1]), {
        edition_id: body.edition_id || null,
        force_new: Boolean(body.force_new),
        actor,
        ip,
      });
      json(res, 200, result);
      return true;
    }
    const ingestReject = pathname.match(/^\/api\/v1\/admin\/ingest\/(\d+)\/reject$/);
    if (ingestReject && method === "POST") {
      const body = await readJson(req);
      json(res, 200, rejectIngest(Number(ingestReject[1]), { reason: body.reason || null, actor, ip }));
      return true;
    }
    const ingestDetail = pathname.match(/^\/api\/v1\/admin\/ingest\/(\d+)$/);
    if (ingestDetail && method === "GET") {
      const item = getIngest(Number(ingestDetail[1]));
      if (!item) error(res, "INGEST_NOT_FOUND", 404, "待审核记录不存在");
      else json(res, 200, item);
      return true;
    }

    if (pathname === "/api/v1/admin/editions" && method === "GET") {
      json(res, 200, adminList(url));
      return true;
    }
    if (pathname === "/api/v1/admin/editions" && method === "POST") {
      const body = await readJson(req);
      json(res, 201, createEdition(body, { actor, ip }));
      return true;
    }
    const editionDetail = pathname.match(/^\/api\/v1\/admin\/editions\/(\d+)$/);
    if (editionDetail) {
      const id = Number(editionDetail[1]);
      if (method === "GET") {
        const item = getEdition(id, { admin: true });
        if (!item) error(res, "EDITION_NOT_FOUND", 404, "赛事不存在");
        else json(res, 200, item);
        return true;
      }
      if (method === "PATCH") {
        json(res, 200, updateEdition(id, await readJson(req), { actor, ip }));
        return true;
      }
      if (method === "DELETE") {
        json(res, 200, archiveEdition(id, { actor, ip }));
        return true;
      }
    }
    const stageCreate = pathname.match(/^\/api\/v1\/admin\/editions\/(\d+)\/stages$/);
    if (stageCreate && method === "POST") {
      json(res, 201, createStage(Number(stageCreate[1]), await readJson(req), { actor, ip }));
      return true;
    }
    const stageDetail = pathname.match(/^\/api\/v1\/admin\/stages\/(\d+)$/);
    if (stageDetail) {
      const id = Number(stageDetail[1]);
      if (method === "PATCH") {
        json(res, 200, updateStage(id, await readJson(req), { actor, ip }));
        return true;
      }
      if (method === "DELETE") {
        json(res, 200, deleteStage(id, { actor, ip }));
        return true;
      }
    }

    if (pathname === "/api/v1/admin/series" && method === "GET") {
      json(res, 200, { items: listSeries() });
      return true;
    }
    if (pathname === "/api/v1/admin/series" && method === "POST") {
      json(res, 201, createSeries(await readJson(req), actor));
      return true;
    }
    const seriesDetail = pathname.match(/^\/api\/v1\/admin\/series\/(\d+)$/);
    if (seriesDetail) {
      const id = Number(seriesDetail[1]);
      if (method === "GET") {
        const item = getSeries(id);
        if (!item) error(res, "SERIES_NOT_FOUND", 404, "系列不存在");
        else json(res, 200, item);
        return true;
      }
      if (method === "PATCH") {
        json(res, 200, updateSeries(id, await readJson(req), actor));
        return true;
      }
      if (method === "DELETE") {
        const count = db.prepare("SELECT COUNT(*) AS n FROM event_editions WHERE series_id = ?").get(id)?.n ?? 0;
        if (count > 0) {
          error(res, "SERIES_IN_USE", 409, "系列下仍有赛事，不能删除");
          return true;
        }
        db.prepare("DELETE FROM event_series WHERE id = ?").run(id);
        recordAudit(actor, "delete", `event_series:${id}`, null, ip);
        json(res, 200, { ok: true });
        return true;
      }
    }

    if (pathname === "/api/v1/admin/tags" && method === "GET") {
      json(res, 200, { items: db.prepare(`
        SELECT t.*, COUNT(et.edition_id) AS usage_count
        FROM tags t LEFT JOIN edition_tags et ON et.tag_id = t.id
        GROUP BY t.id ORDER BY t.kind, t.sort_order, t.name
      `).all() });
      return true;
    }
    const tagDetail = pathname.match(/^\/api\/v1\/admin\/tags\/(\d+)$/);
    if (tagDetail && method === "DELETE") {
      const id = Number(tagDetail[1]);
      const used = db.prepare("SELECT COUNT(*) AS n FROM edition_tags WHERE tag_id = ?").get(id)?.n ?? 0;
      if (used > 0) {
        error(res, "TAG_IN_USE", 409, "标签仍被赛事使用，不能删除");
        return true;
      }
      db.prepare("DELETE FROM tags WHERE id = ?").run(id);
      recordAudit(actor, "delete", `tags:${id}`, null, ip);
      json(res, 200, { ok: true });
      return true;
    }
    if (pathname === "/api/v1/admin/tags" && method === "POST") {
      const body = await readJson(req);
      json(res, 200, { items: upsertManualTags(body.items || []) });
      return true;
    }

    if (pathname === "/api/v1/admin/sources" && method === "GET") {
      json(res, 200, { items: sources() });
      return true;
    }
    if (pathname === "/api/v1/admin/refresh" && method === "POST") {
      const result = await ctx.refresh();
      json(res, 200, { ok: true, result });
      return true;
    }
    if (pathname === "/api/v1/admin/backup" && method === "POST") {
      const result = await ctx.backup();
      json(res, 200, { ok: true, ...result });
      return true;
    }
    if (pathname === "/api/v1/admin/changes" && method === "GET") {
      json(res, 200, { items: listChanges(url.searchParams.get("limit") || 100) });
      return true;
    }
    if (pathname === "/api/v1/admin/audit" && method === "GET") {
      json(res, 200, { items: listAudit(url.searchParams.get("limit") || 100) });
      return true;
    }

    error(res, "NOT_FOUND", 404, "管理接口不存在");
    return true;
  } catch (err) {
    error(res, "ADMIN_ERROR", err.status || 400, String(err.message || err));
    return true;
  }
}
