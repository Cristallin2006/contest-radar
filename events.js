import { db } from "./db.js";
import { classifyCompetition, CONTENT_TYPE_LABELS, FIELD_LABELS } from "./classify.js";
import {
  normalizeCategory,
  normalizeRegion,
  safeJson,
  transaction,
} from "./schema.js";

const DAY = 86_400_000;

export const CATEGORY_LABELS = {
  ctf: "CTF",
  hackathon: "黑客松",
  datamodel: "数据竞赛",
  mathmodel: "数学建模",
  academic: "学科竞赛",
  other: "其他",
};

export const REGION_LABELS = { cn: "国内", intl: "国外" };

export const STATUS_LABELS = {
  open: "报名中",
  closing: "即将截止",
  upcoming: "预告",
  ongoing: "进行中",
  closed: "报名已截止",
  ended: "已结束",
  cancelled: "已取消",
  postponed: "已延期",
  unknown: "待定",
};

export const RECOGNITION_LABELS = {
  miit_talent: "工信部人才中心主办",
  miit_joint: "工信部联合主办",
  miit_historical: "工信部历史主办",
  miit_related: "工信部系统相关",
};

export const LIFECYCLE_LABELS = {
  normal: "正常",
  postponed: "延期",
  cancelled: "取消",
  finished: "结束",
};

export const STAGE_KIND_LABELS = {
  registration: "报名",
  qualification: "资格审核",
  online: "线上赛",
  offline: "线下赛",
  final: "决赛",
  submission: "提交",
  other: "其他",
};

const SOURCE_NAMES = {
  ctftime: "CTFtime",
  devpost: "Devpost",
  jingsai: "我爱竞赛网",
  drivendata: "DrivenData",
  comap: "COMAP / MCM-ICM",
  adworld: "攻防世界 / XCTF",
  ctfhub: "CTFHub",
  haobachang: "好靶场 · 比赛日历",
  saikr: "赛氪",
  gxxsjs: "高校学生竞赛网",
  seed: "人工种子",
  submission: "用户投稿",
  unknown: "未知",
};

export const PUBLISH_STATES = ["draft", "pending", "published", "archived"];
export const LIFECYCLES = ["normal", "postponed", "cancelled", "finished"];
export const STAGE_KINDS = ["registration", "qualification", "online", "offline", "final", "submission", "other"];
export const TIME_STATUSES = ["confirmed", "tentative", "unknown"];
export const MODES = ["online", "offline", "hybrid", "unknown"];
export const SIGNUP_ORGS = ["individual", "captain", "school", "unknown"];
export const SIGNUP_CHANNELS = ["website", "email", "other", "unknown"];

function nowIso() {
  return new Date().toISOString();
}

function nowMs() {
  return Date.now();
}

function httpUrl(value) {
  if (value === null || value === undefined || value === "") return null;
  try {
    const url = new URL(String(value));
    return /^https?:$/.test(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function timestamp(value) {
  if (!value) return null;
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const t = Date.parse(`${s}T00:00:00+08:00`);
    return Number.isNaN(t) ? null : t;
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

function endOfDay(value) {
  if (!value) return null;
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return Date.parse(`${s}T23:59:59+08:00`);
  }
  return Date.parse(s);
}

function minValue(values) {
  const valid = values.filter(Boolean).sort();
  return valid[0] ?? null;
}

function maxValue(values) {
  const valid = values.filter(Boolean).sort();
  return valid[valid.length - 1] ?? null;
}

function daysBetween(target, now = nowMs()) {
  const t = timestamp(target);
  if (t == null) return null;
  return Math.ceil((t - now) / DAY);
}

function stageStatus(stage, now = nowMs()) {
  if (!stage.starts_at && !stage.deadline_at && !stage.ends_at) return "unknown";
  if (stage.starts_at) {
    const start = timestamp(stage.starts_at);
    const end = stage.ends_at ? endOfDay(stage.ends_at) : start;
    if (start != null && now >= start && now <= end) return "ongoing";
    if (start != null && now < start) return "upcoming";
    if (end != null && now > end) return "ended";
  }
  if (stage.deadline_at) {
    const deadline = endOfDay(stage.deadline_at);
    if (deadline != null && now <= deadline) {
      return daysBetween(stage.deadline_at, now) <= 7 ? "closing" : "open";
    }
    return "closed";
  }
  return "unknown";
}

function aggregateTimeStatus(stages) {
  if (stages.some((s) => s.time_status === "tentative")) return "tentative";
  if (stages.some((s) => s.time_status === "confirmed")) return "confirmed";
  return "unknown";
}

export function computeStatus(edition, stages, now = nowMs()) {
  if (edition.lifecycle === "cancelled") return "cancelled";
  if (edition.lifecycle === "postponed") return "postponed";
  if (edition.status_override) return edition.status_override;

  const statuses = stages.map((s) => stageStatus(s, now));
  if (statuses.includes("ongoing")) return "ongoing";
  if (statuses.includes("closing")) return "closing";
  if (statuses.includes("open")) return "open";
  if (statuses.includes("upcoming")) return "upcoming";
  if (statuses.includes("closed")) return "closed";
  if (statuses.length && statuses.every((s) => s === "ended")) return "ended";
  if (edition.lifecycle === "finished") return "ended";
  return "unknown";
}

function nextStartOf(stages, now = nowMs()) {
  return stages
    .filter((s) => s.starts_at && timestamp(s.starts_at) != null)
    .map((s) => ({ at: s.starts_at, ms: timestamp(s.starts_at) }))
    .filter((x) => x.ms >= now)
    .sort((a, b) => a.ms - b.ms)[0]?.at ?? null;
}

function nextDeadlineOf(stages, now = nowMs()) {
  return stages
    .filter((s) => s.deadline_at && timestamp(s.deadline_at) != null)
    .map((s) => ({ at: s.deadline_at, ms: timestamp(s.deadline_at) }))
    .filter((x) => x.ms >= now)
    .sort((a, b) => a.ms - b.ms)[0]?.at ?? null;
}

function stageView(stage, now = nowMs()) {
  const status = stageStatus(stage, now);
  return {
    ...stage,
    is_all_day: Boolean(stage.is_all_day),
    status,
    status_label: STATUS_LABELS[status] || status,
    days_left: ["open", "closing"].includes(status)
      ? daysBetween(stage.deadline_at, now)
      : status === "upcoming" ? daysBetween(stage.starts_at, now) : null,
  };
}

function tagsForEditions(ids) {
  if (!ids.length) return new Map();
  const placeholders = ids.map(() => "?").join(",");
  const rows = db.prepare(`
    SELECT et.edition_id, t.kind, t.name, t.sort_order
    FROM edition_tags et JOIN tags t ON t.id = et.tag_id
    WHERE et.edition_id IN (${placeholders})
    ORDER BY t.kind, t.sort_order, t.name
  `).all(...ids);
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.edition_id)) map.set(row.edition_id, []);
    map.get(row.edition_id).push(row);
  }
  return map;
}

function stagesForEditions(ids) {
  if (!ids.length) return new Map();
  const placeholders = ids.map(() => "?").join(",");
  const rows = db.prepare(`
    SELECT * FROM event_stages WHERE edition_id IN (${placeholders})
    ORDER BY sort_order, COALESCE(deadline_at, starts_at, ends_at), id
  `).all(...ids);
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.edition_id)) map.set(row.edition_id, []);
    map.get(row.edition_id).push(row);
  }
  return map;
}

function tagsOfRows(rows) {
  const direction = [];
  const format = [];
  for (const t of rows || []) {
    if (t.kind === "direction") direction.push(t.name);
    else if (t.kind === "format") format.push(t.name);
  }
  return { direction, format };
}

export function presentEdition(row, stageRows = [], tagRows = [], now = nowMs()) {
  const stages = stageRows.map((s) => stageView(s, now));
  const tags = tagsOfRows(tagRows);
  const status = computeStatus(row, stages, now);
  const nextStart = nextStartOf(stages, now);
  const nextDeadline = nextDeadlineOf(stages, now);
  const registrationDeadline = nextDeadline
    || maxValue(stages.filter((s) => s.deadline_at).map((s) => s.deadline_at));
  const futureStarts = stages
    .filter((s) => s.starts_at && timestamp(s.starts_at) != null)
    .map((s) => ({ at: s.starts_at, ms: timestamp(s.starts_at) }))
    .sort((a, b) => a.ms - b.ms);
  const eventStart = futureStarts[0]?.at ?? minValue(stages.map((s) => s.starts_at));
  const eventEnd = maxValue(stages.map((s) => s.ends_at));
  const current = stages.find((s) => s.status === "ongoing");
  let daysLeft = null;
  if (["open", "closing"].includes(status)) daysLeft = daysBetween(nextDeadline, now);
  else if (status === "upcoming") daysLeft = daysBetween(nextStart, now);
  else if (status === "ongoing" && current?.ends_at) daysLeft = daysBetween(current.ends_at, now);

  const knownMode = stages.find((s) => s.mode && s.mode !== "unknown")?.mode || "unknown";
  const knownLocation = stages.find((s) => s.location)?.location || null;
  const teamSize = row.team_size_min || row.team_size_max
    ? [row.team_size_min, row.team_size_max].filter((v) => v != null).join("–") + " 人"
    : null;
  return {
    ...row,
    organizer: row.organizer || row.series_organizer || null,
    description: row.description || row.series_description || null,
    url: row.signup_url || row.source_url || row.series_website || null,
    mode: knownMode,
    location: knownLocation,
    team_size: teamSize,
    prize: row.prizes || null,
    last_checked: row.verified_at || null,
    tags,
    tag_names: [...tags.direction, ...tags.format],
    stages,
    status,
    status_label: STATUS_LABELS[status] || status,
    lifecycle_label: LIFECYCLE_LABELS[row.lifecycle] || row.lifecycle,
    category_label: CATEGORY_LABELS[row.category] || row.category,
    field_label: FIELD_LABELS[row.field] || row.field,
    content_type_label: CONTENT_TYPE_LABELS[row.content_type] || row.content_type,
    recognition_label: RECOGNITION_LABELS[row.recognition] || null,
    region_label: REGION_LABELS[row.region] || row.region,
    source_name: SOURCE_NAMES[row.source] || row.source,
    next_start: nextStart,
    next_deadline: nextDeadline,
    registration_deadline: registrationDeadline,
    event_start: eventStart,
    event_end: eventEnd,
    days_left: daysLeft,
    time_status: aggregateTimeStatus(stages),
    stage_statuses: stages.map((s) => s.status),
    external_ref: safeJson(row.external_ref, {}),
    series_name: row.series_name || null,
    series_short_name: row.series_short_name || null,
  };
}

function baseEditionSql(where = "", order = "") {
  return `
    SELECT e.*, s.name AS series_name, s.short_name AS series_short_name, s.slug AS series_slug,
           s.website AS series_website, s.is_whitelist AS series_whitelist,
           s.organizer AS series_organizer, s.description AS series_description
    FROM event_editions e
    LEFT JOIN event_series s ON s.id = e.series_id
    ${where}
    ${order}
  `;
}

export function listEditions(filters = {}, { admin = false } = {}) {
  const where = [];
  const args = [];
  if (!admin) {
    where.push("e.publish_state = 'published'");
    where.push("e.content_type = 'competition'");
  } else if (filters.publish_state) {
    where.push("e.publish_state = ?");
    args.push(filters.publish_state);
  }
  if (filters.region && filters.region !== "all") {
    where.push("e.region = ?");
    args.push(filters.region);
  }
  if (filters.category && filters.category !== "all") {
    where.push("e.category = ?");
    args.push(filters.category);
  }
  if (filters.field && filters.field !== "all") {
    const fields = String(filters.field).split(",").map((x) => x.trim()).filter(Boolean);
    if (fields.length) {
      where.push(`e.field IN (${fields.map(() => "?").join(",")})`);
      args.push(...fields);
    }
  }
  if (filters.content_type && filters.content_type !== "all") {
    where.push("e.content_type = ?");
    args.push(filters.content_type);
  }
  if (filters.tech) {
    where.push("e.field IN ('cyber','software','data','math','electronics','engineering')");
  }
  if (filters.whitelist === "1" || filters.whitelist === 1 || filters.whitelist === true) {
    where.push("COALESCE(s.is_whitelist, 0) = 1");
  }
  if (filters.series_id) {
    where.push("e.series_id = ?");
    args.push(Number(filters.series_id));
  }
  const rows = db.prepare(baseEditionSql(where.length ? `WHERE ${where.join(" AND ")}` : "")).all(...args);
  const ids = rows.map((r) => r.id);
  const stageMap = stagesForEditions(ids);
  const tagMap = tagsForEditions(ids);
  const now = nowMs();
  let items = rows.map((r) => presentEdition(r, stageMap.get(r.id) || [], tagMap.get(r.id) || [], now));

  const q = String(filters.q || "").trim().toLowerCase();
  if (q) {
    items = items.filter((e) => [
      e.title, e.series_name, e.series_short_name, e.organizer, e.description,
      ...(e.tag_names || []),
    ].filter(Boolean).join(" ").toLowerCase().includes(q));
  }
  if (filters.direction && filters.direction !== "all") {
    items = items.filter((e) => e.tags.direction.includes(filters.direction));
  }
  if (filters.format && filters.format !== "all") {
    items = items.filter((e) => e.tags.format.includes(filters.format));
  }
  if (filters.status && filters.status !== "all") {
    items = items.filter((e) => e.status === filters.status);
  }
  if (filters.mode && filters.mode !== "all") {
    items = items.filter((e) => e.stages.some((s) => s.mode === filters.mode));
  }

  if (!admin && !filters.all_dates) {
    const from = filters.from ? timestamp(filters.from) : now - DAY;
    const to = filters.to ? timestamp(filters.to) : now + 90 * DAY;
    items = items.filter((e) => {
      const points = [];
      for (const stage of e.stages) {
        const start = timestamp(stage.starts_at);
        const end = endOfDay(stage.ends_at);
        const deadline = endOfDay(stage.deadline_at);
        if (start != null) points.push([start, end ?? start]);
        if (deadline != null) points.push([deadline, deadline]);
      }
      if (!points.length) return Boolean(filters.include_unknown);
      return points.some(([start, end]) => start <= to && end >= from);
    });
  }

  const sort = filters.sort || (admin ? "updated" : "urgency");
  const byUrgency = (a, b) => {
    const order = { closing: 0, open: 1, upcoming: 2, ongoing: 3, unknown: 4, closed: 5, ended: 6, cancelled: 7, postponed: 7 };
    return (order[a.status] ?? 9) - (order[b.status] ?? 9)
      || (a.days_left ?? 9999) - (b.days_left ?? 9999)
      || String(a.title).localeCompare(String(b.title), "zh-CN");
  };
  if (sort === "deadline") {
    items.sort((a, b) => (timestamp(a.next_deadline) ?? 9e15) - (timestamp(b.next_deadline) ?? 9e15));
  } else if (sort === "start") {
    items.sort((a, b) => (timestamp(a.next_start) ?? 9e15) - (timestamp(b.next_start) ?? 9e15));
  } else if (sort === "newest") {
    items.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  } else if (sort === "updated") {
    items.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  } else if (sort === "name") {
    items.sort((a, b) => String(a.title).localeCompare(String(b.title), "zh-CN"));
  } else {
    items.sort(byUrgency);
  }

  const size = Math.max(1, Math.min(100, Math.floor(Number(filters.size) || 20)));
  const page = Math.max(1, Math.floor(Number(filters.page) || 1));
  const total = items.length;
  const paged = items.slice((page - 1) * size, page * size);
  return {
    items: paged,
    page,
    size,
    total,
    pages: Math.ceil(total / size) || 1,
    stats: statsOf(items),
  };
}

function statsOf(items) {
  const counts = { total: items.length, open: 0, closing: 0, upcoming: 0, ongoing: 0, closed: 0, ended: 0, unknown: 0, cancelled: 0, postponed: 0 };
  const categories = {};
  const regions = {};
  for (const e of items) {
    counts[e.status] = (counts[e.status] || 0) + 1;
    categories[e.category] = (categories[e.category] || 0) + 1;
    regions[e.region] = (regions[e.region] || 0) + 1;
  }
  return { counts, categories, regions };
}

export function getEdition(id, { admin = false } = {}) {
  const row = db.prepare(baseEditionSql("WHERE e.id = ?")).get(Number(id));
  if (!row) return null;
  if (!admin && (row.publish_state !== "published" || row.content_type !== "competition")) return null;
  const stages = db.prepare(`
    SELECT * FROM event_stages WHERE edition_id = ?
    ORDER BY sort_order, COALESCE(deadline_at, starts_at, ends_at), id
  `).all(row.id);
  const tags = db.prepare(`
    SELECT t.kind, t.name, t.sort_order FROM edition_tags et
    JOIN tags t ON t.id = et.tag_id WHERE et.edition_id = ?
    ORDER BY t.kind, t.sort_order, t.name
  `).all(row.id);
  const changes = admin ? db.prepare(`
    SELECT * FROM edition_changes WHERE edition_id = ? ORDER BY changed_at DESC LIMIT 50
  `).all(row.id) : [];
  return {
    ...presentEdition(row, stages, tags),
    changes: changes.map((c) => ({ ...c, diff: safeJson(c.diff, {}) })),
  };
}

export function getTaxonomy() {
  return {
    regions: Object.entries(REGION_LABELS).map(([id, label]) => ({ id, label })),
    categories: Object.entries(CATEGORY_LABELS).map(([id, label]) => ({ id, label })),
    directions: db.prepare("SELECT name FROM tags WHERE kind = 'direction' ORDER BY sort_order, name").all().map((r) => r.name),
    formats: db.prepare("SELECT name FROM tags WHERE kind = 'format' ORDER BY sort_order, name").all().map((r) => r.name),
    statuses: Object.entries(STATUS_LABELS).map(([id, label]) => ({ id, label })),
    lifecycle: Object.entries(LIFECYCLE_LABELS).map(([id, label]) => ({ id, label })),
    stage_kinds: Object.entries(STAGE_KIND_LABELS).map(([id, label]) => ({ id, label })),
    time_statuses: [
      { id: "confirmed", label: "已确认" },
      { id: "tentative", label: "暂定" },
      { id: "unknown", label: "待定" },
    ],
    fields: Object.entries(FIELD_LABELS).map(([id, label]) => ({ id, label })),
    content_types: Object.entries(CONTENT_TYPE_LABELS).map(([id, label]) => ({ id, label })),
    modes: [
      { id: "online", label: "线上" },
      { id: "offline", label: "线下" },
      { id: "hybrid", label: "混合" },
      { id: "unknown", label: "未知" },
    ],
  };
}

export function allPublishedForCalendar(filters = {}) {
  const items = [];
  let page = 1;
  for (;;) {
    const result = listEditions({ ...filters, page, size: 100, include_unknown: true, all_dates: true }, { admin: false });
    items.push(...result.items);
    if (page >= result.pages) break;
    page += 1;
  }
  return items;
}

export function getPublicStats() {
  const items = allPublishedForCalendar();
  const stats = statsOf(items);
  const in7 = items.filter((e) => ["closing", "open"].includes(e.status) && e.days_left != null && e.days_left <= 7).length;
  return { ...stats, closing_within_7_days: in7 };
}

export function getChanges(since = null, limit = 50) {
  const args = [];
  let where = "WHERE e.publish_state = 'published'";
  if (since) {
    where += " AND c.changed_at >= ?";
    args.push(since);
  }
  args.push(Math.max(1, Math.min(100, Number(limit) || 50)));
  return db.prepare(`
    SELECT c.*, e.title AS edition_title FROM edition_changes c
    JOIN event_editions e ON e.id = c.edition_id
    ${where} ORDER BY c.changed_at DESC LIMIT ?
  `).all(...args).map((c) => ({ ...c, diff: safeJson(c.diff, {}) }));
}

export function listSeries() {
  return db.prepare(`
    SELECT s.*, COUNT(e.id) AS edition_count
    FROM event_series s LEFT JOIN event_editions e ON e.series_id = s.id
    GROUP BY s.id ORDER BY s.name
  `).all();
}

export function getSeries(id) {
  return db.prepare("SELECT * FROM event_series WHERE id = ?").get(Number(id)) || null;
}

export function createSeries(input, actor = "admin") {
  const now = nowIso();
  const name = String(input.name || "").trim();
  if (!name) throw new Error("系列名称不能为空");
  const slug = String(input.slug || name).trim().replace(/\s+/g, "-");
  const result = db.prepare(`
    INSERT INTO event_series (slug, name, short_name, organizer, category, region, website,
      is_whitelist, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    slug, name, input.short_name ?? null, input.organizer ?? null,
    normalizeCategory(input.category), normalizeRegion(input.region, input.category),
    input.website ?? null, input.is_whitelist ? 1 : 0, input.description ?? null, now, now,
  );
  recordAudit(actor, "create", `event_series:${result.lastInsertRowid}`, input, null);
  return getSeries(Number(result.lastInsertRowid));
}

export function updateSeries(id, input, actor = "admin") {
  const current = getSeries(id);
  if (!current) throw new Error("系列不存在");
  const next = {
    ...current,
    ...input,
    category: normalizeCategory(input.category ?? current.category),
    region: normalizeRegion(input.region ?? current.region, input.category ?? current.category),
    is_whitelist: input.is_whitelist === undefined ? current.is_whitelist : (input.is_whitelist ? 1 : 0),
    updated_at: nowIso(),
  };
  db.prepare(`
    UPDATE event_series SET slug = ?, name = ?, short_name = ?, organizer = ?, category = ?,
      region = ?, website = ?, is_whitelist = ?, description = ?, updated_at = ? WHERE id = ?
  `).run(
    next.slug ?? current.slug, next.name ?? current.name, next.short_name ?? null,
    next.organizer ?? null, next.category, next.region, next.website ?? null,
    next.is_whitelist ? 1 : 0, next.description ?? null, next.updated_at, Number(id),
  );
  recordAudit(actor, "update", `event_series:${id}`, input, null);
  return getSeries(id);
}

function normalizeTags(input) {
  const raw = Array.isArray(input) ? input : [];
  const out = new Map();
  for (const item of raw) {
    const kind = item?.kind ?? (typeof item === "string" ? null : null);
    const name = String(item?.name ?? item ?? "").trim();
    if (!name) continue;
    const finalKind = kind === "format" ? "format" : "direction";
    out.set(`${finalKind}:${name}`, { kind: finalKind, name });
  }
  return [...out.values()];
}

function syncTags(editionId, tagInput) {
  db.prepare("DELETE FROM edition_tags WHERE edition_id = ?").run(editionId);
  for (const tag of normalizeTags(tagInput)) {
    db.prepare(`
      INSERT INTO tags (kind, name, sort_order) VALUES (?, ?, 0)
      ON CONFLICT(kind, name) DO NOTHING
    `).run(tag.kind, tag.name);
    const row = db.prepare("SELECT id FROM tags WHERE kind = ? AND name = ?").get(tag.kind, tag.name);
    if (row) {
      db.prepare("INSERT OR IGNORE INTO edition_tags (edition_id, tag_id) VALUES (?, ?)").run(editionId, row.id);
    }
  }
}

function normalizeStageInput(input, index = 0) {
  const allDay = input.is_all_day === undefined
    ? Boolean(input.starts_at && String(input.starts_at).length === 10)
    : Boolean(input.is_all_day);
  return {
    kind: STAGE_KINDS.includes(input.kind) ? input.kind : "other",
    name: String(input.name || STAGE_KIND_LABELS[input.kind] || "阶段").trim(),
    starts_at: input.starts_at || null,
    ends_at: input.ends_at || null,
    deadline_at: input.deadline_at || null,
    time_status: TIME_STATUSES.includes(input.time_status) ? input.time_status : "unknown",
    is_all_day: allDay ? 1 : 0,
    mode: MODES.includes(input.mode) ? input.mode : "unknown",
    location: input.location ?? null,
    note: input.note ?? null,
    sort_order: Number.isFinite(Number(input.sort_order)) ? Number(input.sort_order) : index * 10,
  };
}

function insertStage(editionId, stage) {
  const now = nowIso();
  return Number(db.prepare(`
    INSERT INTO event_stages (edition_id, kind, name, starts_at, ends_at, deadline_at,
      time_status, is_all_day, mode, location, note, sort_order, ics_sequence, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).run(
    editionId, stage.kind, stage.name, stage.starts_at, stage.ends_at, stage.deadline_at,
    stage.time_status, stage.is_all_day, stage.mode, stage.location, stage.note,
    stage.sort_order, now, now,
  ).lastInsertRowid);
}

function editionFields(input, current = null) {
  const now = nowIso();
  const title = String(input.title ?? current?.title ?? "").trim();
  if (!title) throw new Error("赛事标题不能为空");
  const category = normalizeCategory(input.category ?? current?.category);
  const description = input.description !== undefined ? (input.description || null) : (current?.description ?? null);
  const sourceCategory = input.source_category !== undefined ? (input.source_category || null) : (current?.source_category ?? null);
  const classified = classifyCompetition({
    title,
    description,
    category,
    source: input.source ?? current?.source,
    source_category: sourceCategory,
  });
  const fieldExplicit = input.field !== undefined;
  const contentExplicit = input.content_type !== undefined;
  const fieldManual = fieldExplicit && !input.field_source;
  const contentManual = contentExplicit && !input.content_source;
  const field = fieldExplicit ? (input.field || "other") : (current?.field_source === "manual" ? current.field : classified.field);
  const fieldConfidence = fieldExplicit ? (input.field_confidence || (fieldManual ? "high" : classified.field_confidence)) : (current?.field_source === "manual" ? current.field_confidence : classified.field_confidence);
  const fieldSource = fieldExplicit ? (input.field_source || "manual") : (current?.field_source === "manual" ? "manual" : classified.field_source);
  const fieldReason = fieldExplicit ? (input.field_reason || (fieldManual ? "管理员手动分类" : classified.field_reason)) : (current?.field_source === "manual" ? current.field_reason : classified.field_reason);
  const contentType = contentExplicit ? (input.content_type || "competition") : (current?.content_source === "manual" ? current.content_type : classified.content_type);
  const contentConfidence = contentExplicit ? (input.content_confidence || (contentManual ? "high" : classified.content_confidence)) : (current?.content_source === "manual" ? current.content_confidence : classified.content_confidence);
  const contentSource = contentExplicit ? (input.content_source || "manual") : (current?.content_source === "manual" ? "manual" : classified.content_source);
  const contentReason = contentExplicit ? (input.content_reason || (contentManual ? "管理员手动分类" : classified.content_reason)) : (current?.content_source === "manual" ? current.content_reason : classified.content_reason);
  return {
    series_id: input.series_id !== undefined ? (input.series_id ? Number(input.series_id) : null) : (current?.series_id ?? null),
    title,
    organizer: input.organizer !== undefined ? (input.organizer || null) : (current?.organizer ?? null),
    description,
    field,
    field_confidence: fieldConfidence,
    field_source: fieldSource,
    field_reason: fieldReason,
    content_type: contentType,
    content_confidence: contentConfidence,
    content_source: contentSource,
    content_reason: contentReason,
    source_category: sourceCategory,
    recognition: input.recognition !== undefined
      ? (RECOGNITION_LABELS[input.recognition] ? input.recognition : null)
      : (current?.recognition ?? null),
    recognition_note: input.recognition_note !== undefined
      ? (input.recognition_note || null) : (current?.recognition_note ?? null),
    recognition_source: input.recognition_source !== undefined
      ? httpUrl(input.recognition_source) : (current?.recognition_source ?? null),
    year: input.year !== undefined ? Number(input.year) || null : (current?.year ?? null),
    region: normalizeRegion(input.region ?? current?.region, input.category ?? current?.category),
    category,
    lifecycle: LIFECYCLES.includes(input.lifecycle) ? input.lifecycle : (current?.lifecycle || "normal"),
    status_override: input.status_override !== undefined ? (input.status_override || null) : (current?.status_override ?? null),
    signup_org: SIGNUP_ORGS.includes(input.signup_org) ? input.signup_org : (current?.signup_org || "unknown"),
    signup_channel: SIGNUP_CHANNELS.includes(input.signup_channel) ? input.signup_channel : (current?.signup_channel || "unknown"),
    internal_deadline_note: input.internal_deadline_note !== undefined ? (input.internal_deadline_note || null) : (current?.internal_deadline_note ?? null),
    signup_url: input.signup_url !== undefined ? httpUrl(input.signup_url) : (current?.signup_url ?? null),
    source_url: input.source_url !== undefined ? httpUrl(input.source_url) : (current?.source_url ?? null),
    team_size_min: input.team_size_min !== undefined ? (Number(input.team_size_min) || null) : (current?.team_size_min ?? null),
    team_size_max: input.team_size_max !== undefined ? (Number(input.team_size_max) || null) : (current?.team_size_max ?? null),
    eligibility: input.eligibility !== undefined ? (input.eligibility || null) : (current?.eligibility ?? null),
    difficulty: input.difficulty !== undefined ? (Number(input.difficulty) || null) : (current?.difficulty ?? null),
    fee: input.fee !== undefined ? (input.fee || null) : (current?.fee ?? null),
    prizes: input.prizes !== undefined ? (input.prizes || null) : (current?.prizes ?? null),
    source: String(input.source ?? current?.source ?? "manual").slice(0, 40),
    source_rank: input.source_rank !== undefined ? Number(input.source_rank) || 0 : (current?.source_rank ?? 0),
    date_confidence: ["confirmed", "estimated", "unknown"].includes(input.date_confidence)
      ? input.date_confidence : (current?.date_confidence || "unknown"),
    verified_at: input.verified_at !== undefined ? (input.verified_at || null) : (current?.verified_at ?? now),
    publish_state: PUBLISH_STATES.includes(input.publish_state) ? input.publish_state : (current?.publish_state || "draft"),
    external_ref: input.external_ref !== undefined
      ? (typeof input.external_ref === "string" ? input.external_ref : JSON.stringify(input.external_ref || {}))
      : (current?.external_ref == null
        ? null
        : (typeof current.external_ref === "string" ? current.external_ref : JSON.stringify(current.external_ref))),
    created_at: current?.created_at ?? now,
    updated_at: now,
  };
}

function insertEdition(fields) {
  return Number(db.prepare(`
    INSERT INTO event_editions (series_id, title, organizer, description, field, field_confidence,
      field_source, field_reason, content_type, content_confidence, content_source, content_reason,
      source_category, recognition, recognition_note, recognition_source, year, region, category,
      lifecycle, status_override, signup_org, signup_channel, internal_deadline_note, signup_url,
      source_url, team_size_min, team_size_max, eligibility, difficulty, fee, prizes, source,
      source_rank, date_confidence, verified_at, publish_state, external_ref, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    fields.series_id, fields.title, fields.organizer, fields.description, fields.field,
    fields.field_confidence, fields.field_source, fields.field_reason, fields.content_type,
    fields.content_confidence, fields.content_source, fields.content_reason, fields.source_category,
    fields.recognition, fields.recognition_note, fields.recognition_source, fields.year,
    fields.region, fields.category, fields.lifecycle, fields.status_override, fields.signup_org,
    fields.signup_channel, fields.internal_deadline_note, fields.signup_url, fields.source_url,
    fields.team_size_min, fields.team_size_max, fields.eligibility, fields.difficulty, fields.fee,
    fields.prizes, fields.source, fields.source_rank, fields.date_confidence, fields.verified_at,
    fields.publish_state, fields.external_ref, fields.created_at, fields.updated_at,
  ).lastInsertRowid);
}

function updateEditionRow(id, fields) {
  db.prepare(`
    UPDATE event_editions SET series_id = ?, title = ?, organizer = ?, description = ?, field = ?,
      field_confidence = ?, field_source = ?, field_reason = ?, content_type = ?,
      content_confidence = ?, content_source = ?, content_reason = ?, source_category = ?,
      recognition = ?, recognition_note = ?, recognition_source = ?, year = ?, region = ?,
      category = ?, lifecycle = ?, status_override = ?, signup_org = ?, signup_channel = ?,
      internal_deadline_note = ?, signup_url = ?, source_url = ?, team_size_min = ?, team_size_max = ?,
      eligibility = ?, difficulty = ?, fee = ?, prizes = ?, source = ?, source_rank = ?,
      date_confidence = ?, verified_at = ?, publish_state = ?, external_ref = ?, updated_at = ?
      WHERE id = ?
  `).run(
    fields.series_id, fields.title, fields.organizer, fields.description, fields.field,
    fields.field_confidence, fields.field_source, fields.field_reason, fields.content_type,
    fields.content_confidence, fields.content_source, fields.content_reason, fields.source_category,
    fields.recognition, fields.recognition_note, fields.recognition_source, fields.year,
    fields.region, fields.category, fields.lifecycle, fields.status_override, fields.signup_org,
    fields.signup_channel, fields.internal_deadline_note, fields.signup_url, fields.source_url,
    fields.team_size_min, fields.team_size_max, fields.eligibility, fields.difficulty, fields.fee,
    fields.prizes, fields.source, fields.source_rank, fields.date_confidence, fields.verified_at,
    fields.publish_state, fields.external_ref, fields.updated_at, id,
  );
}

export function createEdition(input, { actor = "admin", ip = null } = {}) {
  return transaction(() => {
    const fields = editionFields(input);
    const id = insertEdition(fields);
    for (const [index, stage] of (input.stages || []).entries()) {
      insertStage(id, normalizeStageInput(stage, index));
    }
    syncTags(id, input.tags || []);
    recordEditionChange(id, actor, ip, { created: true, fields }, true);
    recordAudit(actor, "create", `event_editions:${id}`, input, ip);
    return getEdition(id, { admin: true });
  });
}

export function updateEdition(id, input, { actor = "admin", ip = null } = {}) {
  return transaction(() => {
    const current = getEdition(id, { admin: true });
    if (!current) throw new Error("赛事不存在");
    const fields = editionFields(input, current);
    const diff = {};
    const keys = ["title", "organizer", "description", "field", "content_type", "recognition", "recognition_note", "year", "region", "category", "lifecycle", "status_override", "publish_state", "signup_url", "source_url", "fee", "prizes", "eligibility", "difficulty", "date_confidence"];
    for (const key of keys) {
      if (String(current[key] ?? "") !== String(fields[key] ?? "")) diff[key] = { from: current[key] ?? null, to: fields[key] ?? null };
    }
    if (input.series_id !== undefined && Number(input.series_id || 0) !== Number(current.series_id || 0)) {
      diff.series_id = { from: current.series_id ?? null, to: fields.series_id ?? null };
    }
    updateEditionRow(id, fields);
    if (input.tags !== undefined) syncTags(id, input.tags);
    for (const [index, stage] of (input.stages || []).entries()) {
      insertStage(id, normalizeStageInput(stage, index));
    }
    const keyChange = Boolean(diff.lifecycle || diff.status_override);
    if (Object.keys(diff).length || input.tags !== undefined || (input.stages || []).length) {
      recordEditionChange(id, actor, ip, { changed: diff, stages_added: (input.stages || []).length, tags_changed: input.tags !== undefined }, keyChange);
    }
    recordAudit(actor, "update", `event_editions:${id}`, diff, ip);
    return getEdition(id, { admin: true });
  });
}

export function archiveEdition(id, { actor = "admin", ip = null } = {}) {
  return transaction(() => {
    const current = getEdition(id, { admin: true });
    if (!current) throw new Error("赛事不存在");
    db.prepare("UPDATE event_editions SET publish_state = 'archived', updated_at = ? WHERE id = ?").run(nowIso(), id);
    recordEditionChange(id, actor, ip, { publish_state: { from: current.publish_state, to: "archived" } }, false);
    recordAudit(actor, "archive", `event_editions:${id}`, null, ip);
    return getEdition(id, { admin: true });
  });
}

export function createStage(editionId, input, { actor = "admin", ip = null } = {}) {
  return transaction(() => {
    const edition = getEdition(editionId, { admin: true });
    if (!edition) throw new Error("赛事不存在");
    const id = insertStage(editionId, normalizeStageInput(input, edition.stages.length));
    touchEdition(editionId);
    recordEditionChange(editionId, actor, ip, { stage_created: id, stage: input }, true);
    recordAudit(actor, "create", `event_stages:${id}`, input, ip);
    return getEdition(editionId, { admin: true });
  });
}

export function updateStage(stageId, input, { actor = "admin", ip = null } = {}) {
  return transaction(() => {
    const current = db.prepare("SELECT * FROM event_stages WHERE id = ?").get(Number(stageId));
    if (!current) throw new Error("阶段不存在");
    const next = normalizeStageInput({ ...current, ...input }, current.sort_order);
    const changed = {};
    for (const key of ["kind", "name", "starts_at", "ends_at", "deadline_at", "time_status", "is_all_day", "mode", "location", "note", "sort_order"]) {
      if (String(current[key] ?? "") !== String(next[key] ?? "")) {
        changed[key] = { from: current[key] ?? null, to: next[key] ?? null };
      }
    }
    const timeChanged = ["starts_at", "ends_at", "deadline_at", "time_status", "is_all_day"].some((key) => key in changed);
    db.prepare(`
      UPDATE event_stages SET kind = ?, name = ?, starts_at = ?, ends_at = ?, deadline_at = ?,
        time_status = ?, is_all_day = ?, mode = ?, location = ?, note = ?, sort_order = ?,
        ics_sequence = ics_sequence + ?, updated_at = ? WHERE id = ?
    `).run(
      next.kind, next.name, next.starts_at, next.ends_at, next.deadline_at, next.time_status,
      next.is_all_day, next.mode, next.location, next.note, next.sort_order,
      timeChanged ? 1 : 0, nowIso(), Number(stageId),
    );
    touchEdition(current.edition_id);
    recordEditionChange(current.edition_id, actor, ip, { stage_updated: Number(stageId), time_changed: timeChanged, changes: changed }, timeChanged);
    recordAudit(actor, "update", `event_stages:${stageId}`, input, ip);
    return getEdition(current.edition_id, { admin: true });
  });
}

export function deleteStage(stageId, { actor = "admin", ip = null } = {}) {
  return transaction(() => {
    const current = db.prepare("SELECT * FROM event_stages WHERE id = ?").get(Number(stageId));
    if (!current) throw new Error("阶段不存在");
    db.prepare("DELETE FROM event_stages WHERE id = ?").run(Number(stageId));
    touchEdition(current.edition_id);
    recordEditionChange(current.edition_id, actor, ip, { stage_deleted: Number(stageId), stage: current }, true);
    recordAudit(actor, "delete", `event_stages:${stageId}`, current, ip);
    return getEdition(current.edition_id, { admin: true });
  });
}

function touchEdition(id) {
  db.prepare("UPDATE event_editions SET updated_at = ? WHERE id = ?").run(nowIso(), id);
}

export function recordEditionChange(editionId, actor, ip, diff, keyChange = false) {
  db.prepare(`
    INSERT INTO edition_changes (edition_id, changed_at, actor_label, ip, diff, is_key_change)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(editionId, nowIso(), actor, ip, JSON.stringify(diff), keyChange ? 1 : 0);
}

export function recordAudit(actor, action, target, detail, ip) {
  db.prepare(`
    INSERT INTO admin_audit (actor_label, action, target, ip, detail, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(actor, action, target, ip, JSON.stringify(detail ?? null), nowIso());
}

export function listChanges(limit = 100) {
  return db.prepare(`
    SELECT c.*, e.title AS edition_title FROM edition_changes c
    JOIN event_editions e ON e.id = c.edition_id
    ORDER BY c.changed_at DESC LIMIT ?
  `).all(Math.max(1, Math.min(500, Number(limit) || 100))).map((c) => ({ ...c, diff: safeJson(c.diff, {}) }));
}

export function listAudit(limit = 100) {
  return db.prepare("SELECT * FROM admin_audit ORDER BY created_at DESC LIMIT ?")
    .all(Math.max(1, Math.min(500, Number(limit) || 100)))
    .map((a) => ({ ...a, detail: safeJson(a.detail, null) }));
}

export function appendTags(editionId, tags) {
  for (const tag of normalizeTags(tags)) {
    db.prepare(`
      INSERT INTO tags (kind, name, sort_order) VALUES (?, ?, 0)
      ON CONFLICT(kind, name) DO NOTHING
    `).run(tag.kind, tag.name);
    const row = db.prepare("SELECT id FROM tags WHERE kind = ? AND name = ?").get(tag.kind, tag.name);
    if (row) {
      db.prepare("INSERT OR IGNORE INTO edition_tags (edition_id, tag_id) VALUES (?, ?)").run(editionId, row.id);
    }
  }
}

export function upsertManualTags(input) {
  const tags = normalizeTags(input);
  for (const tag of tags) {
    db.prepare(`
      INSERT INTO tags (kind, name, sort_order) VALUES (?, ?, 0)
      ON CONFLICT(kind, name) DO NOTHING
    `).run(tag.kind, tag.name);
  }
  return db.prepare("SELECT * FROM tags ORDER BY kind, sort_order, name").all();
}

export { SOURCE_NAMES };
