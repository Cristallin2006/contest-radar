import { buildCalendar } from "./calendar-v2.js";
import {
  getChanges,
  getEdition,
  getPublicStats,
  getTaxonomy,
  listEditions,
} from "./events.js";
import { ingestStats } from "./ingest.js";
import { getMeta } from "./schema.js";
import { clientIp, error, etagOf, ifNoneMatch, json, readJson, sendText } from "./http.js";
import { currentUser } from "./auth.js";
import { createSubmission, listMySubmissions } from "./submissions.js";
import { createComment, listComments } from "./comments.js";

function filtersFrom(url) {
  const q = url.searchParams;
  return {
    region: q.get("region") || undefined,
    category: q.get("category") || undefined,
    direction: q.get("direction") || undefined,
    format: q.get("format") || undefined,
    status: q.get("status") || undefined,
    q: q.get("q") || undefined,
    from: q.get("from") || undefined,
    to: q.get("to") || undefined,
    whitelist: q.get("whitelist") || undefined,
    field: q.get("field") || undefined,
    content_type: q.get("content_type") || undefined,
    tech: q.get("tech") === "1",
    sort: q.get("sort") || undefined,
    page: q.get("page") || undefined,
    size: q.get("size") || undefined,
    include_unknown: q.get("include_unknown") === "1",
    all_dates: q.get("all_dates") === "1",
  };
}

function cacheJson(req, res, data, maxAge = 60) {
  const body = JSON.stringify(data);
  const etag = etagOf(body);
  if (ifNoneMatch(req, etag)) {
    res.writeHead(304, { etag, "cache-control": `public, max-age=${maxAge}` });
    res.end();
    return;
  }
  res.writeHead(200, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": `public, max-age=${maxAge}`,
    etag,
    "x-content-type-options": "nosniff",
    "access-control-allow-origin": "*",
  });
  res.end(body);
}

function sendIcs(req, res, body) {
  const etag = etagOf(body);
  if (ifNoneMatch(req, etag)) {
    res.writeHead(304, { etag, "cache-control": "public, max-age=900" });
    res.end();
    return;
  }
  res.writeHead(200, {
    "content-type": "text/calendar; charset=utf-8",
    "content-disposition": 'inline; filename="contest-radar.ics"',
    "cache-control": "public, max-age=900",
    etag,
    "x-content-type-options": "nosniff",
  });
  res.end(body);
}

export async function handlePublicApi(req, res, url, ctx = {}) {
  const pathname = url.pathname;
  if (!pathname.startsWith("/api/v1/") || pathname.startsWith("/api/v1/admin")) return false;

  if (pathname === "/api/v1/submissions" && req.method === "POST") {
    const user = currentUser(req);
    if (!user) {
      error(res, "LOGIN_REQUIRED", 401, "请先使用 GitHub 登录");
      return true;
    }
    try {
      const item = createSubmission(user, await readJson(req), clientIp(req));
      json(res, 201, { ok: true, item });
    } catch (err) {
      error(res, "SUBMISSION_INVALID", err.status || 400, String(err.message || err));
    }
    return true;
  }

  if (pathname === "/api/v1/submissions/mine" && (req.method === "GET" || req.method === "HEAD")) {
    const user = currentUser(req);
    if (!user) {
      error(res, "LOGIN_REQUIRED", 401, "请先使用 GitHub 登录");
      return true;
    }
    json(res, 200, { items: listMySubmissions(user) });
    return true;
  }

  if (pathname === "/api/v1/comments" && (req.method === "GET" || req.method === "HEAD")) {
    const raw = url.searchParams.get("edition_id");
    if (raw !== null && raw !== "" && !Number.isInteger(Number(raw))) {
      error(res, "BAD_REQUEST", 400, "edition_id 无效");
      return true;
    }
    json(res, 200, {
      items: listComments({
        editionId: raw === null || raw === "" ? null : Number(raw),
        limit: url.searchParams.get("limit") || 100,
      }),
    });
    return true;
  }

  if (pathname === "/api/v1/comments" && req.method === "POST") {
    const user = currentUser(req);
    if (!user) {
      error(res, "LOGIN_REQUIRED", 401, "请先使用 GitHub 登录");
      return true;
    }
    try {
      const item = createComment(user, await readJson(req), clientIp(req));
      json(res, 201, { ok: true, item });
    } catch (err) {
      error(res, "COMMENT_INVALID", err.status || 400, String(err.message || err));
    }
    return true;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    error(res, "METHOD_NOT_ALLOWED", 405, "公开接口只读");
    return true;
  }

  if (pathname === "/api/v1/health") {
    const counts = ingestStats();
    json(res, 200, {
      ok: true,
      schema_version: Number(getMeta("schema_version", "0")),
      editions: listEditions({ size: 1, all_dates: true }, { admin: false }).total,
      pending_ingest: counts.pending,
      last_refresh: ctx.lastRefresh || null,
      refreshing: Boolean(ctx.refreshing),
      now: new Date().toISOString(),
    });
    return true;
  }

  if (pathname === "/api/v1/taxonomy") {
    cacheJson(req, res, getTaxonomy(), 3600);
    return true;
  }

  if (pathname === "/api/v1/stats") {
    cacheJson(req, res, getPublicStats(), 60);
    return true;
  }

  if (pathname === "/api/v1/changes") {
    const since = url.searchParams.get("since");
    cacheJson(req, res, { items: getChanges(since, Number(url.searchParams.get("limit") || 50)) }, 60);
    return true;
  }

  if (pathname === "/api/v1/editions") {
    cacheJson(req, res, listEditions(filtersFrom(url), { admin: false }), 60);
    return true;
  }

  const detail = pathname.match(/^\/api\/v1\/editions\/(\d+)$/);
  if (detail) {
    const item = getEdition(Number(detail[1]), { admin: false });
    if (!item) error(res, "EDITION_NOT_FOUND", 404, "赛事不存在或未发布");
    else cacheJson(req, res, item, 60);
    return true;
  }

  if (pathname === "/api/v1/ical/all.ics") {
    sendIcs(req, res, buildCalendar({}));
    return true;
  }
  const regionIcs = pathname.match(/^\/api\/v1\/ical\/region\/(cn|intl)\.ics$/);
  if (regionIcs) {
    sendIcs(req, res, buildCalendar({ region: regionIcs[1] }));
    return true;
  }
  const categoryIcs = pathname.match(/^\/api\/v1\/ical\/category\/([a-z]+)\.ics$/);
  if (categoryIcs) {
    sendIcs(req, res, buildCalendar({ category: categoryIcs[1] }));
    return true;
  }

  error(res, "NOT_FOUND", 404, "接口不存在");
  return true;
}
