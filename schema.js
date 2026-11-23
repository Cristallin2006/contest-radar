import { db } from "./db.js";
import { ctfDisplayName } from "./collectors/ctf.js";
import { classifyEdition } from "./classify.js";

export const SCHEMA_VERSION = 3;

const NOW = () => new Date().toISOString();

const CTF_SERIES_NAMES = {
  "qiangwang-cup": "强网杯全国网络安全挑战赛",
  "qiangwang-mimic": "强网拟态防御国际精英挑战赛",
  wangding: "网鼎杯网络安全大赛",
  ciscn: "全国大学生信息安全竞赛（CISCN）",
  xctf: "XCTF 国际网络安全技术对抗联赛",
  yangcheng: "羊城杯网络安全大赛",
  greatwall: "长城杯网数智安全大赛",
  xiangyun: "祥云杯网络安全大赛",
  lanmao: "蓝帽杯网络安全大赛",
  dfg: "巅峰极客网络安全挑战赛",
  chunqiu: "春秋杯网络安全联赛",
  fifthspace: "第五空间网络安全挑战赛",
  digitalchina: "数字中国创新大赛",
  hufu: "虎符网络安全挑战赛",
  longyuan: "陇原杯网络安全大赛",
  taishan: "泰山杯网络安全大赛",
  zhijiang: "之江杯网络安全大赛",
  mindun: "闽盾杯网络安全大赛",
  tianfu: "天府杯网络安全大赛",
  huanghe: "黄河杯网络安全大赛",
  changan: "长安杯网络安全大赛",
  linghang: "领航杯网络安全大赛",
  taihu: "太湖杯网络安全大赛",
  tpctf: "京华杯 TPCTF",
  nepctf: "NepCTF",
};

const DIRECTION_TAGS = [
  "Web", "Pwn", "Reverse", "Crypto", "Misc", "Forensics", "Mobile", "IoT",
  "AI 安全", "区块链", "算法", "开发",
];

const FORMAT_TAGS = [
  "Jeopardy", "AWD", "AWD Plus", "渗透实战", "KoH", "攻防混合",
  "ACM", "OI", "作品赛", "答辩赛",
];

export function ensureSchema() {
  db.exec(`
CREATE TABLE IF NOT EXISTS schema_meta (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS event_series (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT UNIQUE,
  name          TEXT NOT NULL,
  short_name    TEXT,
  organizer     TEXT,
  category      TEXT NOT NULL DEFAULT 'other',
  region        TEXT NOT NULL DEFAULT 'cn',
  website       TEXT,
  is_whitelist  INTEGER NOT NULL DEFAULT 0,
  description   TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_series_region_cat ON event_series(region, category);

CREATE TABLE IF NOT EXISTS event_editions (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  series_id             INTEGER REFERENCES event_series(id) ON DELETE SET NULL,
  legacy_key            TEXT UNIQUE,
  title                 TEXT NOT NULL,
  organizer             TEXT,
  description           TEXT,
  field                 TEXT NOT NULL DEFAULT 'other',
  field_confidence      TEXT NOT NULL DEFAULT 'low',
  field_source          TEXT NOT NULL DEFAULT 'legacy',
  field_reason          TEXT,
  content_type          TEXT NOT NULL DEFAULT 'competition',
  content_confidence    TEXT NOT NULL DEFAULT 'low',
  content_source        TEXT NOT NULL DEFAULT 'legacy',
  content_reason        TEXT,
  source_category       TEXT,
  year                  INTEGER,
  region                TEXT NOT NULL DEFAULT 'cn',
  category              TEXT NOT NULL DEFAULT 'other',
  lifecycle             TEXT NOT NULL DEFAULT 'normal',
  status_override       TEXT,
  signup_org            TEXT NOT NULL DEFAULT 'unknown',
  signup_channel        TEXT NOT NULL DEFAULT 'unknown',
  internal_deadline_note TEXT,
  signup_url            TEXT,
  source_url            TEXT,
  team_size_min         INTEGER,
  team_size_max         INTEGER,
  eligibility           TEXT,
  difficulty            INTEGER,
  fee                   TEXT,
  prizes                TEXT,
  source                TEXT NOT NULL DEFAULT 'unknown',
  source_rank           INTEGER NOT NULL DEFAULT 0,
  date_confidence       TEXT NOT NULL DEFAULT 'unknown',
  verified_at           TEXT,
  publish_state         TEXT NOT NULL DEFAULT 'pending',
  external_ref          TEXT,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_edition_public ON event_editions(region, publish_state, year);
CREATE INDEX IF NOT EXISTS idx_edition_series ON event_editions(series_id);
CREATE INDEX IF NOT EXISTS idx_edition_category ON event_editions(category);

CREATE TABLE IF NOT EXISTS event_stages (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  edition_id    INTEGER NOT NULL REFERENCES event_editions(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL DEFAULT 'other',
  name          TEXT NOT NULL,
  starts_at     TEXT,
  ends_at       TEXT,
  deadline_at   TEXT,
  time_status   TEXT NOT NULL DEFAULT 'unknown',
  is_all_day    INTEGER NOT NULL DEFAULT 1,
  mode          TEXT NOT NULL DEFAULT 'unknown',
  location      TEXT,
  note          TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  ics_sequence  INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stage_edition ON event_stages(edition_id);
CREATE INDEX IF NOT EXISTS idx_stage_start ON event_stages(starts_at);
CREATE INDEX IF NOT EXISTS idx_stage_deadline ON event_stages(deadline_at);

CREATE TABLE IF NOT EXISTS tags (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT NOT NULL CHECK (kind IN ('direction', 'format')),
  name       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (kind, name)
);

CREATE TABLE IF NOT EXISTS edition_tags (
  edition_id INTEGER NOT NULL REFERENCES event_editions(id) ON DELETE CASCADE,
  tag_id     INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (edition_id, tag_id)
);

CREATE TABLE IF NOT EXISTS edition_changes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  edition_id    INTEGER NOT NULL REFERENCES event_editions(id) ON DELETE CASCADE,
  changed_at    TEXT NOT NULL,
  actor_label   TEXT NOT NULL DEFAULT 'admin',
  ip            TEXT,
  diff          TEXT NOT NULL,
  is_key_change INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_change_edition ON edition_changes(edition_id, changed_at);

CREATE TABLE IF NOT EXISTS ingest_items (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  source              TEXT NOT NULL,
  external_id         TEXT NOT NULL,
  raw                 TEXT,
  parsed              TEXT NOT NULL,
  fingerprint         TEXT NOT NULL,
  state               TEXT NOT NULL DEFAULT 'pending',
  reject_reason       TEXT,
  accepted_edition_id INTEGER REFERENCES event_editions(id) ON DELETE SET NULL,
  submitted_at        TEXT NOT NULL,
  reviewed_at         TEXT,
  reviewed_by         TEXT,
  UNIQUE (source, external_id)
);
CREATE INDEX IF NOT EXISTS idx_ingest_state ON ingest_items(state, submitted_at);

CREATE TABLE IF NOT EXISTS admin_audit (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_label TEXT NOT NULL DEFAULT 'admin',
  action      TEXT NOT NULL,
  target      TEXT,
  ip          TEXT,
  detail      TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit(created_at);

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`);

  // 旧原型只有这两个列之外的 sources 字段；迁移补 enabled。
  const sourceCols = db.prepare("PRAGMA table_info(sources)").all().map((c) => c.name);
  if (!sourceCols.includes("enabled")) {
    db.exec("ALTER TABLE sources ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1");
  }

  // 一次性比赛没有系列，主办方/简介必须能落在届次上。
  const editionCols = db.prepare("PRAGMA table_info(event_editions)").all().map((c) => c.name);
  if (!editionCols.includes("organizer")) {
    db.exec("ALTER TABLE event_editions ADD COLUMN organizer TEXT");
  }
  if (!editionCols.includes("description")) {
    db.exec("ALTER TABLE event_editions ADD COLUMN description TEXT");
  }
  const classificationColumns = [
    ["field", "TEXT NOT NULL DEFAULT 'other'"],
    ["field_confidence", "TEXT NOT NULL DEFAULT 'low'"],
    ["field_source", "TEXT NOT NULL DEFAULT 'legacy'"],
    ["field_reason", "TEXT"],
    ["content_type", "TEXT NOT NULL DEFAULT 'competition'"],
    ["content_confidence", "TEXT NOT NULL DEFAULT 'low'"],
    ["content_source", "TEXT NOT NULL DEFAULT 'legacy'"],
    ["content_reason", "TEXT"],
    ["source_category", "TEXT"],
  ];
  for (const [name, type] of classificationColumns) {
    if (!editionCols.includes(name)) db.exec(`ALTER TABLE event_editions ADD COLUMN ${name} ${type}`);
  }
  db.exec("CREATE INDEX IF NOT EXISTS idx_edition_field ON event_editions(field)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_edition_content ON event_editions(content_type)");

  seedTags();
  setMeta("schema_version", String(SCHEMA_VERSION));
  // 旧表迁移只做一次，避免迁移期双写产生的新采集记录绕过审核直接发布。
  // 如需重新迁移旧表，显式设置 MIGRATE_LEGACY=1。
  const shouldMigrateLegacy = !getMeta("legacy_migrated_at") || process.env.MIGRATE_LEGACY === "1";
  const migrated = shouldMigrateLegacy ? migrateLegacyCompetitions() : 0;
  backfillLegacyFields();
  const classified = backfillClassification();
  return { version: SCHEMA_VERSION, migrated, classified };
}

export function setMeta(key, value) {
  db.prepare(`
    INSERT INTO schema_meta (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, String(value), NOW());
}

export function getMeta(key, fallback = null) {
  const row = db.prepare("SELECT value FROM schema_meta WHERE key = ?").get(key);
  return row?.value ?? fallback;
}

let transactionDepth = 0;

export function transaction(fn) {
  if (transactionDepth > 0) {
    const savepoint = `sp_${transactionDepth}`;
    transactionDepth += 1;
    db.exec(`SAVEPOINT ${savepoint}`);
    try {
      const result = fn();
      db.exec(`RELEASE ${savepoint}`);
      return result;
    } catch (err) {
      try { db.exec(`ROLLBACK TO ${savepoint}`); db.exec(`RELEASE ${savepoint}`); } catch { /* ignore */ }
      throw err;
    } finally {
      transactionDepth -= 1;
    }
  }
  db.exec("BEGIN IMMEDIATE");
  transactionDepth = 1;
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    try { db.exec("ROLLBACK"); } catch { /* ignore */ }
    throw err;
  } finally {
    transactionDepth = 0;
  }
}

export function safeJson(value, fallback = null) {
  if (value == null || value === "") return fallback;
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

export function normalizeCategory(category) {
  if (category === "ctf-cn" || category === "ctf-intl" || category === "ctf") return "ctf";
  return ["hackathon", "datamodel", "mathmodel", "academic", "other"].includes(category)
    ? category
    : "other";
}

export function normalizeRegion(region, category = "") {
  if (region === "cn" || region === "intl") return region;
  if (category === "ctf-intl") return "intl";
  return "cn";
}

function stripYear(name) {
  return String(name || "")
    .replace(/\s*20\d{2}\s*$/g, "")
    .replace(/^20\d{2}\s*/g, "")
    .replace(/第[一二三四五六七八九十百\d]+届/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function yearOf(c) {
  const fromName = String(c.name || "").match(/20\d{2}/);
  if (fromName) return Number(fromName[0]);
  if (c.event_start) {
    const y = Number(String(c.event_start).slice(0, 4));
    if (y >= 2000 && y <= 2100) return y;
  }
  const fromKey = String(c.key || "").match(/20\d{2}/);
  if (fromKey) return Number(fromKey[0]);
  return new Date().getFullYear();
}

function seriesDescriptor(c) {
  const key = String(c.key || "");
  const category = normalizeCategory(c.category);
  if (key.startsWith("ctf-cn:")) {
    const parts = key.split(":");
    const alias = parts[1] || "";
    if (alias && !/^[a-f0-9]{12,}$/i.test(alias)) {
      return {
        slug: `ctf-cn:${alias}`,
        name: CTF_SERIES_NAMES[alias] || stripYear(c.name) || ctfDisplayName(c.name),
        short_name: CTF_SERIES_NAMES[alias] || null,
        category,
      };
    }
  }
  if (key.startsWith("comap:mcm-icm")) {
    return {
      slug: "comap:mcm-icm",
      name: "美国大学生数学建模竞赛（MCM/ICM）",
      short_name: "MCM/ICM",
      category,
    };
  }
  if (key.startsWith("seed:")) {
    const body = key.slice(5).replace(/-20\d{2}.*$/, "");
    return { slug: `seed:${body}`, name: stripYear(c.name), short_name: null, category };
  }
  return null;
}

function findSeriesId(desc, c) {
  if (!desc) return null;
  const now = NOW();
  db.prepare(`
    INSERT INTO event_series (slug, name, short_name, organizer, category, region, website,
      is_whitelist, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET
      name = CASE WHEN event_series.name = '' THEN excluded.name ELSE event_series.name END,
      updated_at = excluded.updated_at
  `).run(
    desc.slug,
    desc.name || stripYear(c.name) || c.name,
    desc.short_name ?? null,
    c.organizer ?? null,
    desc.category || "other",
    normalizeRegion(c.region, c.category),
    c.url ?? null,
    c.description ?? null,
    now,
    now,
  );
  return db.prepare("SELECT id FROM event_series WHERE slug = ?").get(desc.slug)?.id ?? null;
}

function tagKind(name) {
  if (DIRECTION_TAGS.includes(name)) return "direction";
  if (FORMAT_TAGS.includes(name)) return "format";
  if (/^(web|pwn|reverse|crypto|misc|forensics|mobile|iot)$/i.test(name)) return "direction";
  if (/^(awd|jeopardy|koh)$/i.test(name)) return "format";
  return null;
}

function normalizeTagName(name) {
  const mapping = {
    web: "Web", pwn: "Pwn", reverse: "Reverse", crypto: "Crypto", misc: "Misc",
    forensics: "Forensics", mobile: "Mobile", iot: "IoT", jeopardy: "Jeopardy",
    awd: "AWD", koh: "KoH",
  };
  const low = String(name).trim().toLowerCase();
  if (mapping[low]) return mapping[low];
  if (/machine learning|\bai\b|人工智能/i.test(name)) return "AI 安全";
  return String(name).trim();
}

function tagsOf(c) {
  const raw = safeJson(c.tags, []);
  const out = new Map();
  for (const item of Array.isArray(raw) ? raw : []) {
    const name = normalizeTagName(item);
    const kind = tagKind(name);
    if (kind) out.set(`${kind}:${name}`, { kind, name });
  }
  return [...out.values()];
}

function stageRowsOf(c, tags, note = null) {
  const confidence = c.date_confidence || "unknown";
  const timeStatus = confidence === "confirmed" ? "confirmed"
    : confidence === "estimated" ? "tentative" : "unknown";
  const allDay = (v) => (v && String(v).length === 10 ? 1 : 0);
  const rows = [];
  const submission = tags.some((t) => /提交截止/.test(String(t?.name ?? t))) || ["devpost", "drivendata"].includes(c.source);
  if (c.registration_deadline) {
    rows.push({
      kind: submission ? "submission" : "registration",
      name: submission ? "提交截止" : "报名截止",
      starts_at: null,
      ends_at: null,
      deadline_at: c.registration_deadline,
      time_status: timeStatus,
      is_all_day: allDay(c.registration_deadline),
      mode: c.mode || "unknown",
      location: c.location || null,
      note,
      sort_order: 0,
    });
  }
  if (c.event_start) {
    const kind = c.mode === "online" ? "online" : c.mode === "offline" ? "offline" : "other";
    rows.push({
      kind,
      name: "比赛",
      starts_at: c.event_start,
      ends_at: c.event_end || c.event_start,
      deadline_at: null,
      time_status: timeStatus,
      is_all_day: allDay(c.event_start) && allDay(c.event_end || c.event_start),
      mode: c.mode || "unknown",
      location: c.location || null,
      note,
      sort_order: 10,
    });
  }
  if (!rows.length) {
    rows.push({
      kind: "other",
      name: "时间待定",
      starts_at: null,
      ends_at: null,
      deadline_at: null,
      time_status: "unknown",
      is_all_day: 1,
      mode: c.mode || "unknown",
      location: c.location || null,
      note: note || "时间待定，等待管理员补充",
      sort_order: 0,
    });
  }
  return rows;
}

function ensureTag(kind, name) {
  const now = NOW();
  db.prepare(`
    INSERT INTO tags (kind, name, sort_order) VALUES (?, ?, 0)
    ON CONFLICT(kind, name) DO NOTHING
  `).run(kind, name);
  return db.prepare("SELECT id FROM tags WHERE kind = ? AND name = ?").get(kind, name)?.id ?? null;
}

function insertTagLinks(editionId, tags) {
  for (const tag of tags) {
    const id = ensureTag(tag.kind, tag.name);
    if (id) {
      db.prepare("INSERT OR IGNORE INTO edition_tags (edition_id, tag_id) VALUES (?, ?)").run(editionId, id);
    }
  }
}

export function seriesForCandidate(candidate) {
  return findSeriesId(seriesDescriptor(candidate), candidate);
}

export function yearForCandidate(candidate) {
  return yearOf(candidate);
}

export function stageRowsForCandidate(candidate) {
  return stageRowsOf(candidate, Array.isArray(candidate.tags) ? candidate.tags : [], "采集器更新");
}

export function tagsForCandidate(candidate) {
  return tagsOf(candidate);
}

/**
 * 旧 competitions 表 → 系列/届次/阶段。
 * 通过 legacy_key 唯一键保证可重复执行；旧表保留只读，便于回滚。
 */
export function migrateLegacyCompetitions() {
  const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='competitions'").get();
  if (!table) return 0;

  const rows = db.prepare("SELECT * FROM competitions").all();
  let inserted = 0;
  for (const c of rows) {
    const exists = db.prepare("SELECT id FROM event_editions WHERE legacy_key = ?").get(c.key);
    if (exists) continue;
    try {
      transaction(() => {
        const desc = seriesDescriptor(c);
        const seriesId = findSeriesId(desc, c);
        const now = NOW();
        const title = c.category === "ctf-cn" ? ctfDisplayName(c.name) : c.name;
        const category = normalizeCategory(c.category);
        const region = normalizeRegion(c.region, c.category);
        const year = yearOf(c);
        const result = db.prepare(`
          INSERT INTO event_editions (
            series_id, legacy_key, title, organizer, description, year, region, category, lifecycle, status_override,
            signup_org, signup_channel, signup_url, source_url, team_size_min, team_size_max,
            eligibility, difficulty, fee, prizes, source, source_rank, date_confidence,
            verified_at, publish_state, external_ref, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'normal', NULL, 'unknown', 'unknown', ?, ?, NULL, NULL,
            ?, NULL, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?)
        `).run(
          seriesId,
          c.key,
          title,
          c.organizer ?? null,
          c.description ?? null,
          year,
          region,
          category,
          c.url ?? null,
          c.source_url ?? null,
          c.eligibility ?? null,
          c.fee ?? null,
          c.prize ?? null,
          c.source || "unknown",
          Number(c.source_rank || 0),
          c.date_confidence || "unknown",
          c.last_checked || c.updated_at || now,
          JSON.stringify({ legacy_key: c.key }),
          c.created_at || now,
          c.updated_at || now,
        );
        const editionId = Number(result.lastInsertRowid);
        const tags = tagsOf(c);
        const rawTags = safeJson(c.tags, []);
        for (const stage of stageRowsOf(c, Array.isArray(rawTags) ? rawTags : [], "由旧版数据迁移")) {
          db.prepare(`
            INSERT INTO event_stages (edition_id, kind, name, starts_at, ends_at, deadline_at,
              time_status, is_all_day, mode, location, note, sort_order, ics_sequence,
              created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
          `).run(
            editionId, stage.kind, stage.name, stage.starts_at, stage.ends_at, stage.deadline_at,
            stage.time_status, stage.is_all_day, stage.mode, stage.location, stage.note,
            stage.sort_order, now, now,
          );
        }
        insertTagLinks(editionId, tags);
        inserted += 1;
      });
    } catch (err) {
      console.error("[schema] legacy migration failed", c.key, err.message);
    }
  }
  if (inserted > 0) {
    setMeta("legacy_migrated_at", NOW());
    setMeta("legacy_migrated_count", String(inserted));
  }
  return inserted;
}

function backfillLegacyFields() {
  const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='competitions'").get();
  if (!table) return 0;
  const result = db.prepare(`
    UPDATE event_editions
    SET organizer = COALESCE(organizer, (SELECT organizer FROM competitions c WHERE c.key = event_editions.legacy_key)),
        description = COALESCE(description, (SELECT description FROM competitions c WHERE c.key = event_editions.legacy_key))
    WHERE legacy_key IS NOT NULL AND (organizer IS NULL OR description IS NULL)
  `).run();
  return Number(result.changes || 0);
}

function backfillClassification() {
  const rows = db.prepare(`
    SELECT id, title, description, category, source, source_category,
           field, field_confidence, field_source, field_reason,
           content_type, content_confidence, content_source, content_reason
    FROM event_editions
  `).all();
  let changed = 0;
  for (const row of rows) {
    if (row.field_source === "manual" && row.content_source === "manual") continue;
    const result = classifyEdition(row);
    const category = row.category === "datamodel" && result.field !== "data"
      ? "academic"
      : row.category;
    const nextField = row.field_source === "manual" ? row.field : result.field;
    const nextFieldConfidence = row.field_source === "manual" ? row.field_confidence : result.field_confidence;
    const nextFieldSource = row.field_source === "manual" ? "manual" : result.field_source;
    const nextFieldReason = row.field_source === "manual" ? row.field_reason : result.field_reason;
    const nextContent = row.content_source === "manual" ? row.content_type : result.content_type;
    const nextContentConfidence = row.content_source === "manual" ? row.content_confidence : result.content_confidence;
    const nextContentSource = row.content_source === "manual" ? "manual" : result.content_source;
    const nextContentReason = row.content_source === "manual" ? row.content_reason : result.content_reason;
    const differs = category !== row.category || nextField !== row.field ||
      nextFieldConfidence !== row.field_confidence || nextFieldSource !== row.field_source ||
      nextFieldReason !== row.field_reason || nextContent !== row.content_type ||
      nextContentConfidence !== row.content_confidence || nextContentSource !== row.content_source ||
      nextContentReason !== row.content_reason;
    if (!differs) continue;
    db.prepare(`
      UPDATE event_editions SET category = ?, field = ?, field_confidence = ?, field_source = ?,
        field_reason = ?, content_type = ?, content_confidence = ?, content_source = ?,
        content_reason = ? WHERE id = ?
    `).run(
      category, nextField, nextFieldConfidence, nextFieldSource, nextFieldReason,
      nextContent, nextContentConfidence, nextContentSource, nextContentReason, row.id,
    );
    changed += 1;
  }
  return changed;
}

function seedTags() {
  const directions = DIRECTION_TAGS;
  const formats = FORMAT_TAGS;
  const now = NOW();
  const stmt = db.prepare(`
    INSERT INTO tags (kind, name, sort_order) VALUES (?, ?, ?)
    ON CONFLICT(kind, name) DO NOTHING
  `);
  directions.forEach((name, i) => stmt.run("direction", name, i));
  formats.forEach((name, i) => stmt.run("format", name, i));
  db.prepare(`
    INSERT INTO schema_meta (key, value, updated_at) VALUES ('tags_seeded', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(String(directions.length + formats.length), now);
}
