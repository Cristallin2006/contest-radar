import { createHash } from "node:crypto";
import { db, rankOf } from "./db.js";
import {
  appendTags,
  createEdition,
  createStage,
  deleteStage,
  getEdition,
  recordAudit,
  updateEdition,
  updateStage,
} from "./events.js";
import {
  safeJson,
  seriesForCandidate,
  stageRowsForCandidate,
  tagsForCandidate,
  transaction,
  yearForCandidate,
} from "./schema.js";
import { ctfDisplayName } from "./collectors/ctf.js";
import { classifyCompetition } from "./classify.js";

const nowIso = () => new Date().toISOString();

function normalizeCandidate(row) {
  const tags = Array.isArray(row.tags) ? row.tags.filter(Boolean).map(String) : [];
  return {
    ...row,
    tags,
    key: String(row.key || ""),
    name: String(row.name || "").trim(),
    source: String(row.source || "unknown"),
  };
}

function fingerprintOf(candidate) {
  const stable = {
    key: candidate.key,
    name: candidate.name,
    category: candidate.category,
    region: candidate.region,
    event_start: candidate.event_start,
    event_end: candidate.event_end,
    registration_deadline: candidate.registration_deadline,
    url: candidate.url,
    source_url: candidate.source_url,
    description: candidate.description,
    tags: candidate.tags,
    date_confidence: candidate.date_confidence,
    mode: candidate.mode,
    organizer: candidate.organizer,
  };
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

function externalIdOf(candidate, source) {
  if (candidate.key) return candidate.key;
  const seed = `${candidate.source_url || candidate.url || candidate.name}|${candidate.event_start || ""}`;
  return `${source}:${createHash("sha1").update(seed).digest("hex").slice(0, 20)}`;
}

function parseTeamSize(value) {
  const m = String(value || "").match(/(\d+)\s*[-–~至]\s*(\d+)/);
  if (!m) return { min: null, max: null };
  return { min: Number(m[1]), max: Number(m[2]) };
}

/**
 * 采集结果进入待审核区，不直接写已发布赛事。
 * 同一个 source + external_id 只保留一条；内容变化时重新回到 pending。
 */
export function stageCandidates(rows, sourceId) {
  const list = Array.isArray(rows) ? rows.map(normalizeCandidate).filter((r) => r.name) : [];
  if (!list.length) return { seen: 0, inserted: 0, updated: 0, skipped: 0 };
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const stamp = nowIso();
  transaction(() => {
    for (const candidate of list) {
      const source = sourceId || candidate.source || "unknown";
      const externalId = externalIdOf(candidate, source);
      const fingerprint = fingerprintOf(candidate);
      const classified = classifyCompetition({
        title: candidate.name,
        description: candidate.description,
        category: candidate.category,
        source: source,
        source_category: candidate.source_category,
      });
      candidate.classification = classified;
      const existing = db.prepare(`
        SELECT id, state, fingerprint, accepted_edition_id FROM ingest_items
        WHERE source = ? AND external_id = ?
      `).get(source, externalId);
      if (existing) {
        if (existing.fingerprint === fingerprint) {
          skipped += 1;
          continue;
        }
        db.prepare(`
          UPDATE ingest_items SET raw = ?, parsed = ?, fingerprint = ?, state = 'pending',
            reject_reason = NULL, submitted_at = ?, reviewed_at = NULL, reviewed_by = NULL
          WHERE id = ?
        `).run(JSON.stringify(candidate), JSON.stringify(candidate), fingerprint, stamp, existing.id);
        updated += 1;
        continue;
      }
      db.prepare(`
        INSERT INTO ingest_items (source, external_id, raw, parsed, fingerprint, state, submitted_at)
        VALUES (?, ?, ?, ?, ?, 'pending', ?)
      `).run(source, externalId, JSON.stringify(candidate), JSON.stringify(candidate), fingerprint, stamp);
      inserted += 1;
    }
  });
  return { seen: list.length, inserted, updated, skipped };
}

function candidateToEditionInput(candidate) {
  const team = parseTeamSize(candidate.team_size);
  const title = candidate.category === "ctf-cn" ? ctfDisplayName(candidate.name) : candidate.name;
  const tags = tagsForCandidate(candidate);
  return {
    series_id: seriesForCandidate(candidate),
    title,
    organizer: candidate.organizer || null,
    description: candidate.description || null,
    field: candidate.classification?.field,
    field_confidence: candidate.classification?.field_confidence,
    field_source: candidate.classification?.field_source,
    field_reason: candidate.classification?.field_reason,
    content_type: candidate.classification?.content_type,
    content_confidence: candidate.classification?.content_confidence,
    content_source: candidate.classification?.content_source,
    content_reason: candidate.classification?.content_reason,
    source_category: candidate.source_category || null,
    year: yearForCandidate(candidate),
    region: candidate.region,
    category: candidate.category,
    lifecycle: "normal",
    status_override: null,
    signup_org: "unknown",
    signup_channel: "unknown",
    internal_deadline_note: null,
    signup_url: candidate.url || null,
    source_url: candidate.source_url || candidate.url || null,
    team_size_min: team.min,
    team_size_max: team.max,
    eligibility: candidate.eligibility || null,
    difficulty: null,
    fee: candidate.fee || null,
    prizes: candidate.prize || null,
    source: candidate.source || "unknown",
    source_rank: rankOf(candidate.source || "unknown"),
    date_confidence: candidate.date_confidence || "unknown",
    verified_at: candidate.last_checked || nowIso(),
    publish_state: "published",
    external_ref: {
      source: candidate.source || "unknown",
      external_id: candidate.key || null,
      key: candidate.key || null,
    },
    tags,
    stages: stageRowsForCandidate(candidate),
  };
}


function mergeCandidateIntoEdition(editionId, candidate, actor, ip) {
  const edition = getEdition(editionId, { admin: true });
  if (!edition) throw new Error("目标赛事不存在");
  const input = candidateToEditionInput(candidate);
  const patch = {};
  const fields = [
    "signup_url", "source_url", "team_size_min", "team_size_max",
    "eligibility", "fee", "prizes",
  ];
  for (const key of fields) {
    if ((edition[key] == null || edition[key] === "") && input[key] != null) patch[key] = input[key];
  }
  if (!edition.series_id && input.series_id) patch.series_id = input.series_id;
  if (input.source_rank > (edition.source_rank || 0)) {
    patch.source = input.source;
    patch.source_rank = input.source_rank;
  }
  if (edition.date_confidence !== "confirmed" && input.date_confidence === "confirmed") {
    patch.date_confidence = "confirmed";
  }
  const refs = safeJson(edition.external_ref, {}) || {};
  const ingestRefs = Array.isArray(refs.ingest_refs) ? refs.ingest_refs : [];
  const nextRef = {
    ...refs,
    ingest_refs: [
      ...ingestRefs,
      { source: candidate.source || "unknown", external_id: candidate.key || null },
    ].slice(-20),
  };
  patch.external_ref = JSON.stringify(nextRef);
  patch.verified_at = nowIso();
  if (edition.field_source !== "manual" && candidate.classification) {
    patch.field = candidate.classification.field;
    patch.field_confidence = candidate.classification.field_confidence;
    patch.field_source = candidate.classification.field_source;
    patch.field_reason = candidate.classification.field_reason;
  }
  if (edition.content_source !== "manual" && candidate.classification) {
    patch.content_type = candidate.classification.content_type;
    patch.content_confidence = candidate.classification.content_confidence;
    patch.content_source = candidate.classification.content_source;
    patch.content_reason = candidate.classification.content_reason;
  }
  if (!edition.source_category && candidate.source_category) patch.source_category = candidate.source_category;
  updateEdition(editionId, patch, { actor, ip });

  const existingStages = [...(edition.stages || [])];
  const used = new Set();
  const hasDatedCandidate = (input.stages || []).some((s) => s.starts_at || s.ends_at || s.deadline_at);
  if (hasDatedCandidate) {
    for (const stage of existingStages) {
      if (stage.starts_at || stage.ends_at || stage.deadline_at) continue;
      if (stage.name !== "时间待定" && !/时间待定/.test(stage.note || "")) continue;
      used.add(stage.id);
      deleteStage(stage.id, { actor, ip });
    }
  }
  for (const stage of input.stages || []) {
    let match = existingStages.find((s) => !used.has(s.id) && s.kind === stage.kind && s.name === stage.name);
    if (!match) match = existingStages.find((s) => !used.has(s.id) && s.name === stage.name);
    if (!match && (stage.kind === "registration" || stage.kind === "submission")) {
      match = existingStages.find((s) => !used.has(s.id) && (s.kind === "registration" || s.kind === "submission"));
    }
    if (match) {
      used.add(match.id);
      updateStage(match.id, stage, { actor, ip });
    } else {
      createStage(editionId, stage, { actor, ip });
    }
  }
  appendTags(editionId, input.tags || []);
  return getEdition(editionId, { admin: true });
}

export function findExistingEditionForCandidate(candidate) {
  if (!candidate?.key) return null;
  const legacy = db.prepare("SELECT id, title, legacy_key FROM event_editions WHERE legacy_key = ?").get(candidate.key);
  if (legacy) return { id: legacy.id, title: legacy.title, reason: "legacy_key" };
  const rows = db.prepare("SELECT id, title, external_ref FROM event_editions").all();
  for (const row of rows) {
    const refs = safeJson(row.external_ref, {}) || {};
    const candidates = [refs, ...(Array.isArray(refs.ingest_refs) ? refs.ingest_refs : [])];
    if (candidates.some((ref) => ref && (ref.external_id === candidate.key || ref.key === candidate.key))) {
      return { id: row.id, title: row.title, reason: "external_ref" };
    }
  }
  return null;
}

export function listIngest({ state = "pending", limit = 100, source = null } = {}) {
  const args = [];
  let where = "";
  if (state && state !== "all") {
    where += " WHERE state = ?";
    args.push(state);
  }
  if (source) {
    where += where ? " AND source = ?" : " WHERE source = ?";
    args.push(source);
  }
  args.push(Math.max(1, Math.min(500, Number(limit) || 100)));
  return db.prepare(`
    SELECT * FROM ingest_items ${where} ORDER BY submitted_at DESC LIMIT ?
  `).all(...args).map((row) => {
    const parsed = safeJson(row.parsed, {});
    return {
      ...row,
      raw: safeJson(row.raw, null),
      parsed,
      suggested_edition: row.state === "pending" ? findExistingEditionForCandidate(parsed) : null,
    };
  });
}

export function ingestStats() {
  const rows = db.prepare("SELECT state, COUNT(*) AS n FROM ingest_items GROUP BY state").all();
  const out = { pending: 0, accepted: 0, rejected: 0, merged: 0, total: 0 };
  for (const row of rows) {
    out[row.state] = row.n;
    out.total += row.n;
  }
  return out;
}

export function getIngest(id) {
  const row = db.prepare("SELECT * FROM ingest_items WHERE id = ?").get(Number(id));
  if (!row) return null;
  return { ...row, raw: safeJson(row.raw, null), parsed: safeJson(row.parsed, {}) };
}

export function acceptIngest(id, { edition_id = null, force_new = false, actor = "admin", ip = null } = {}) {
  return transaction(() => {
    const item = getIngest(id);
    if (!item) throw new Error("待审核记录不存在");
    if (item.state === "accepted") throw new Error("该记录已被采纳");
    if (item.state === "rejected") throw new Error("该记录已被忽略");
    const candidate = normalizeCandidate(item.parsed || {});
    let edition;
    let merged = false;
    if (edition_id) {
      edition = mergeCandidateIntoEdition(Number(edition_id), candidate, actor, ip);
      merged = true;
    } else {
      const existing = force_new ? null : findExistingEditionForCandidate(candidate);
      if (existing) {
        edition = mergeCandidateIntoEdition(existing.id, candidate, actor, ip);
        merged = true;
      } else {
        edition = createEdition(candidateToEditionInput(candidate), { actor, ip });
      }
    }
    db.prepare(`
      UPDATE ingest_items SET state = 'accepted', reviewed_at = ?, reviewed_by = ?,
        accepted_edition_id = ?, reject_reason = NULL WHERE id = ?
    `).run(nowIso(), actor, edition.id, item.id);
    recordAudit(actor, "accept", `ingest_items:${item.id}`, { edition_id: edition.id, merged }, ip);
    return { item: getIngest(item.id), edition: getEdition(edition.id, { admin: true }), merged };
  });
}

export function acceptSource(source, { actor = "admin", ip = null } = {}) {
  const items = listIngest({ state: "pending", source, limit: 500 });
  const results = [];
  for (const item of items) {
    try {
      const result = acceptIngest(item.id, { actor, ip });
      results.push({ id: item.id, edition_id: result.edition.id, merged: result.merged, ok: true });
    } catch (err) {
      results.push({ id: item.id, ok: false, error: String(err.message || err) });
    }
  }
  recordAudit(actor, "accept-source", `source:${source}`, {
    accepted: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
  }, ip);
  return {
    source,
    accepted: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}

export function acceptAllExact({ actor = "admin", ip = null } = {}) {
  const items = listIngest({ state: "pending", limit: 500 });
  const results = [];
  for (const item of items) {
    if (!item.suggested_edition) continue;
    try {
      const result = acceptIngest(item.id, { actor, ip });
      results.push({ id: item.id, edition_id: result.edition.id, ok: true });
    } catch (err) {
      results.push({ id: item.id, ok: false, error: String(err.message || err) });
    }
  }
  recordAudit(actor, "accept-all-exact", "ingest_items", { accepted: results.filter((r) => r.ok).length }, ip);
  return {
    accepted: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}

export function rejectIngest(id, { reason = null, actor = "admin", ip = null } = {}) {
  return transaction(() => {
    const item = getIngest(id);
    if (!item) throw new Error("待审核记录不存在");
    db.prepare(`
      UPDATE ingest_items SET state = 'rejected', reject_reason = ?, reviewed_at = ?,
        reviewed_by = ? WHERE id = ?
    `).run(reason, nowIso(), actor, item.id);
    recordAudit(actor, "reject", `ingest_items:${item.id}`, { reason }, ip);
    return getIngest(item.id);
  });
}

export function purgeOldIngest(days = 120) {
  const cutoff = new Date(Date.now() - Number(days) * 86_400_000).toISOString();
  return db.prepare("DELETE FROM ingest_items WHERE state IN ('accepted', 'rejected') AND submitted_at < ?")
    .run(cutoff).changes;
}
