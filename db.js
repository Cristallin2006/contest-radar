import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const DB_PATH = process.env.DB_PATH || "/data/contest.db";
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA busy_timeout = 5000;");
db.exec("PRAGMA foreign_keys = ON;");
db.exec(`
CREATE TABLE IF NOT EXISTS competitions (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  key                    TEXT NOT NULL UNIQUE,
  name                   TEXT NOT NULL,
  organizer              TEXT,
  category               TEXT NOT NULL DEFAULT 'other',
  region                 TEXT NOT NULL DEFAULT 'unknown',
  discipline             TEXT,
  mode                   TEXT NOT NULL DEFAULT 'unknown',
  location               TEXT,
  registration_start     TEXT,
  registration_deadline  TEXT,
  event_start            TEXT,
  event_end              TEXT,
  eligibility            TEXT,
  team_size              TEXT,
  fee                    TEXT,
  prize                  TEXT,
  url                    TEXT,
  source                 TEXT NOT NULL DEFAULT 'unknown',
  source_url             TEXT,
  description            TEXT,
  tags                   TEXT NOT NULL DEFAULT '[]',
  date_confidence        TEXT NOT NULL DEFAULT 'unknown',
  source_rank            INTEGER NOT NULL DEFAULT 0,
  last_checked           TEXT,
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comp_deadline ON competitions(registration_deadline);
CREATE INDEX IF NOT EXISTS idx_comp_start ON competitions(event_start);
CREATE INDEX IF NOT EXISTS idx_comp_category ON competitions(category);


CREATE TABLE IF NOT EXISTS sources (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  last_run    TEXT,
  last_status TEXT,
  last_error  TEXT,
  count       INTEGER NOT NULL DEFAULT 0
);
`);

const compCols = db.prepare("PRAGMA table_info(competitions)").all();
if (!compCols.some((c) => c.name === "region")) {
  db.exec("ALTER TABLE competitions ADD COLUMN region TEXT NOT NULL DEFAULT 'unknown'");
}
db.exec("CREATE INDEX IF NOT EXISTS idx_comp_region ON competitions(region)");

export const SOURCE_RANK = {
  seed: 1,
  jingsai: 2,
  drivendata: 2,
  ctftime: 3,
  devpost: 3,
  comap: 4,
  ctfhub: 3,
  haobachang: 4,
  saikr: 2,
  gxxsjs: 2,
  adworld: 5,
};

export function rankOf(source) {
  return SOURCE_RANK[source] ?? 1;
}

const UPSERT = db.prepare(`
INSERT INTO competitions (
  key, name, organizer, category, region, discipline, mode, location,
  registration_start, registration_deadline, event_start, event_end,
  eligibility, team_size, fee, prize, url, source, source_url,
  description, tags, date_confidence, source_rank, last_checked,
  created_at, updated_at
) VALUES (
  ?, ?, ?, ?, ?, ?, ?, ?,
  ?, ?, ?, ?,
  ?, ?, ?, ?, ?, ?, ?,
  ?, ?, ?, ?, ?,
  ?, ?
)
ON CONFLICT(key) DO UPDATE SET
  name = excluded.name,
  organizer = COALESCE(excluded.organizer, competitions.organizer),
  category = excluded.category,
  region = CASE WHEN excluded.region != 'unknown' THEN excluded.region ELSE competitions.region END,
  discipline = COALESCE(excluded.discipline, competitions.discipline),
  mode = CASE WHEN excluded.mode != 'unknown' THEN excluded.mode ELSE competitions.mode END,
  location = COALESCE(excluded.location, competitions.location),
  registration_start = COALESCE(excluded.registration_start, competitions.registration_start),
  registration_deadline = COALESCE(excluded.registration_deadline, competitions.registration_deadline),
  event_start = COALESCE(excluded.event_start, competitions.event_start),
  event_end = COALESCE(excluded.event_end, competitions.event_end),
  eligibility = COALESCE(excluded.eligibility, competitions.eligibility),
  team_size = COALESCE(excluded.team_size, competitions.team_size),
  fee = COALESCE(excluded.fee, competitions.fee),
  prize = COALESCE(excluded.prize, competitions.prize),
  url = COALESCE(excluded.url, competitions.url),
  source = CASE WHEN excluded.source_rank >= competitions.source_rank THEN excluded.source ELSE competitions.source END,
  source_url = COALESCE(excluded.source_url, competitions.source_url),
  description = CASE
    WHEN excluded.description IS NOT NULL AND excluded.source_rank >= competitions.source_rank THEN excluded.description
    ELSE COALESCE(competitions.description, excluded.description)
  END,
  tags = CASE WHEN excluded.tags != '[]' THEN excluded.tags ELSE competitions.tags END,
  date_confidence = CASE
    WHEN competitions.date_confidence = 'confirmed' THEN 'confirmed'
    WHEN excluded.date_confidence = 'confirmed' THEN 'confirmed'
    ELSE COALESCE(excluded.date_confidence, competitions.date_confidence)
  END,
  source_rank = MAX(excluded.source_rank, competitions.source_rank),
  last_checked = excluded.last_checked,
  updated_at = excluded.updated_at
`);

export function upsertCompetition(c) {
  const now = new Date().toISOString();
  const tags = JSON.stringify(Array.isArray(c.tags) ? c.tags.filter(Boolean).slice(0, 12) : []);
  UPSERT.run(
    c.key,
    c.name,
    c.organizer ?? null,
    c.category || "other",
    c.region || "unknown",
    c.discipline ?? null,
    c.mode || "unknown",
    c.location ?? null,
    c.registration_start ?? null,
    c.registration_deadline ?? null,
    c.event_start ?? null,
    c.event_end ?? null,
    c.eligibility ?? null,
    c.team_size ?? null,
    c.fee ?? null,
    c.prize ?? null,
    c.url ?? null,
    c.source || "unknown",
    c.source_url ?? null,
    c.description ?? null,
    tags,
    c.date_confidence || "unknown",
    rankOf(c.source || "unknown"),
    c.last_checked || now,
    now,
    now,
  );
}

export function allCompetitions() {
  return db.prepare("SELECT * FROM competitions").all();
}

export function countCompetitions() {
  return db.prepare("SELECT COUNT(*) AS n FROM competitions").get()?.n ?? 0;
}

const SOURCE_UPSERT = db.prepare(`
INSERT INTO sources (id, name, last_run, last_status, last_error, count)
VALUES (?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  last_run = excluded.last_run,
  last_status = excluded.last_status,
  last_error = excluded.last_error,
  count = excluded.count
`);

export function updateSource(id, name, status, count, error = null) {
  SOURCE_UPSERT.run(id, name, new Date().toISOString(), status, error, count);
}

export function allSources() {
  return db.prepare("SELECT * FROM sources ORDER BY id").all();
}

export function closeDb() {
  try { db.close(); } catch { /* ignore */ }
}
