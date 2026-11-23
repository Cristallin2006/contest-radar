import assert from "node:assert/strict";
import fs from "node:fs";
import { after, before, test } from "node:test";

const DB_PATH = `/tmp/contest-core-${process.pid}.db`;
process.env.DB_PATH = DB_PATH;

let db;
let schema;
let events;
let ingest;
let calendar;

function legacyRow(input) {
  const now = new Date().toISOString();
  const row = {
    key: input.key,
    name: input.name,
    organizer: input.organizer ?? null,
    category: input.category,
    region: input.region,
    discipline: null,
    mode: input.mode ?? "unknown",
    location: null,
    registration_start: null,
    registration_deadline: input.registration_deadline ?? null,
    event_start: input.event_start ?? null,
    event_end: input.event_end ?? null,
    eligibility: null,
    team_size: null,
    fee: null,
    prize: null,
    url: input.url ?? "https://example.com",
    source: input.source,
    source_url: input.url ?? "https://example.com",
    description: "test",
    tags: JSON.stringify(input.tags ?? []),
    date_confidence: input.date_confidence ?? "confirmed",
    source_rank: 1,
    last_checked: now,
    created_at: now,
    updated_at: now,
  };
  db.prepare(`
    INSERT INTO competitions (
      key, name, organizer, category, region, discipline, mode, location,
      registration_start, registration_deadline, event_start, event_end,
      eligibility, team_size, fee, prize, url, source, source_url,
      description, tags, date_confidence, source_rank, last_checked,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `).run(
    row.key, row.name, row.organizer, row.category, row.region, row.discipline,
    row.mode, row.location, row.registration_start, row.registration_deadline,
    row.event_start, row.event_end, row.eligibility, row.team_size, row.fee,
    row.prize, row.url, row.source, row.source_url, row.description, row.tags,
    row.date_confidence, row.source_rank, row.last_checked, row.created_at, row.updated_at,
  );
}

before(async () => {
  for (const suffix of ["", "-shm", "-wal"]) {
    try { fs.unlinkSync(DB_PATH + suffix); } catch { /* ignore */ }
  }
  db = (await import("../db.js")).db;
  const now = new Date().toISOString();
  db.prepare("INSERT INTO sources (id, name, last_run, last_status, count) VALUES (?, ?, ?, ?, ?)")
    .run("seed", "人工种子", now, "ok", 0);
  legacyRow({
    key: "ctf-cn:qiangwang-cup:2026",
    name: "第十届“强网杯”全国网络安全挑战赛",
    organizer: "中国网络空间安全协会",
    category: "ctf-cn",
    region: "cn",
    source: "haobachang",
    tags: ["国内CTF", "Web", "AWD"],
    registration_deadline: "2026-12-01",
    event_start: "2026-12-10",
    event_end: "2026-12-11",
  });
  legacyRow({
    key: "devpost:https://taskforge.devpost.com/#event",
    name: "Taskforge",
    category: "hackathon",
    region: "intl",
    source: "devpost",
    tags: ["黑客松", "提交截止", "Machine Learning/AI"],
    event_start: "2026-10-18",
    event_end: "2026-11-25",
    registration_deadline: "2026-11-25",
  });
  schema = await import("../schema.js");
  events = await import("../events.js");
  ingest = await import("../ingest.js");
  calendar = await import("../calendar-v2.js");
  schema.ensureSchema();
});

after(() => {
  try { db.close(); } catch { /* ignore */ }
  for (const suffix of ["", "-shm", "-wal"]) {
    try { fs.unlinkSync(DB_PATH + suffix); } catch { /* ignore */ }
  }
});

test("legacy competitions migrate into series/edition/stage and are idempotent", () => {
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM event_editions").get().n, 2);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM event_stages").get().n, 4);
  assert.ok(db.prepare("SELECT COUNT(*) AS n FROM event_series").get().n >= 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM edition_tags").get().n, 3);
  assert.deepEqual(schema.ensureSchema(), { version: 2, migrated: 0 });
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM event_editions").get().n, 2);
});

test("public presentation derives status from stages", () => {
  const list = events.listEditions({ include_unknown: true, all_dates: true }, { admin: false });
  assert.equal(list.total, 2);
  const qwb = list.items.find((e) => e.title.includes("强网杯"));
  assert.ok(qwb);
  assert.equal(qwb.status, "open");
  assert.equal(qwb.registration_deadline, "2026-12-01");
  assert.deepEqual(qwb.tags, { direction: ["Web"], format: ["AWD"] });
  assert.equal(qwb.organizer, "中国网络空间安全协会");
  assert.equal(qwb.description, "test");
  const devpost = list.items.find((e) => e.title === "Taskforge");
  assert.ok(devpost);
  assert.ok(devpost.stages.some((s) => s.kind === "submission" && s.deadline_at === "2026-11-25"));
});

test("ingest candidate is staged, accepted, and creates a published edition", () => {
  const result = ingest.stageCandidates([{
    key: "test:demo:2027",
    name: "测试邀请赛 2027",
    organizer: "测试主办",
    category: "ctf-cn",
    region: "cn",
    mode: "online",
    url: "https://example.com/demo",
    source: "seed",
    source_url: "https://example.com/demo",
    description: "审核测试",
    tags: ["国内CTF", "Reverse", "Jeopardy"],
    date_confidence: "confirmed",
    registration_deadline: "2027-01-05",
    event_start: "2027-01-10",
    event_end: "2027-01-11",
    last_checked: new Date().toISOString(),
  }], "seed");
  assert.deepEqual(result, { seen: 1, inserted: 1, updated: 0, skipped: 0 });
  const pending = ingest.listIngest({ state: "pending" });
  assert.equal(pending.length, 1);
  const accepted = ingest.acceptIngest(pending[0].id, { actor: "test" });
  assert.equal(accepted.item.state, "accepted");
  assert.equal(accepted.edition.publish_state, "published");
  assert.equal(accepted.edition.status, "open");
  assert.deepEqual(accepted.edition.tags, { direction: ["Reverse"], format: ["Jeopardy"] });
  assert.equal(accepted.edition.stages.length, 2);

  const again = ingest.stageCandidates([{
    key: "test:demo:2027",
    name: "测试邀请赛 2027",
    category: "ctf-cn",
    region: "cn",
    tags: ["国内CTF", "Reverse", "Jeopardy"],
    source: "seed",
    date_confidence: "confirmed",
    registration_deadline: "2027-01-05",
    event_start: "2027-01-10",
    event_end: "2027-01-11",
  }], "seed");
  assert.equal(again.inserted, 0);
  assert.ok(again.updated >= 0);
});

test("stage update increments ICS SEQUENCE only on time changes", () => {
  const edition = events.listEditions({ include_unknown: true, all_dates: true }, { admin: false })
    .items.find((e) => e.title.includes("测试邀请赛"));
  const stage = edition.stages.find((s) => s.kind === "online");
  events.updateStage(stage.id, { name: "线上赛" }, { actor: "test" });
  let updated = db.prepare("SELECT * FROM event_stages WHERE id = ?").get(stage.id);
  assert.equal(updated.ics_sequence, 0);
  events.updateStage(stage.id, { starts_at: "2027-01-12" }, { actor: "test" });
  updated = db.prepare("SELECT * FROM event_stages WHERE id = ?").get(stage.id);
  assert.equal(updated.ics_sequence, 1);
  assert.equal(updated.starts_at, "2027-01-12");
});

test("public ICS uses stable stage UID, SEQUENCE, and deadline VALARM", () => {
  const body = calendar.buildCalendar({ region: "cn" });
  assert.match(body, /UID:stage-\d+@contest-radar/);
  assert.match(body, /SEQUENCE:1/);
  assert.match(body, /BEGIN:VALARM/);
  assert.match(body, /TRIGGER:-P7D/);
  assert.match(body, /DTSTART;VALUE=DATE:/);
  assert.match(body, /END:VCALENDAR/);
});

test("stage candidates that change after acceptance return to pending", () => {
  ingest.stageCandidates([{
    key: "test:demo:2027",
    name: "测试邀请赛 2027（改期）",
    category: "ctf-cn",
    region: "cn",
    tags: ["国内CTF"],
    source: "seed",
    date_confidence: "confirmed",
    event_start: "2027-01-20",
  }], "seed");
  const pending = ingest.listIngest({ state: "pending" });
  assert.equal(pending.length, 1);
  assert.match(pending[0].parsed.name, /改期/);
});


test("accepting as merge adds stages/tags without creating a duplicate edition", () => {
  const pending = ingest.listIngest({ state: "pending" });
  assert.equal(pending.length, 1);
  const target = events.listEditions({ include_unknown: true, all_dates: true }, { admin: false })
    .items.find((e) => e.title.includes("测试邀请赛"));
  const before = db.prepare("SELECT COUNT(*) AS n FROM event_editions").get().n;
  const merged = ingest.acceptIngest(pending[0].id, { edition_id: target.id, actor: "test" });
  const after = db.prepare("SELECT COUNT(*) AS n FROM event_editions").get().n;
  assert.equal(after, before);
  assert.equal(merged.edition.id, target.id);
  assert.ok(merged.edition.stages.length >= 3);
  assert.ok(Array.isArray(merged.edition.external_ref.ingest_refs));
});

test("pending duplicate is suggested and merged into the migrated edition", () => {
  const before = db.prepare("SELECT COUNT(*) AS n FROM event_editions").get().n;
  ingest.stageCandidates([{
    key: "ctf-cn:qiangwang-cup:2026",
    name: "第十届“强网杯”全国网络安全挑战赛（采集更新）",
    category: "ctf-cn",
    region: "cn",
    source: "haobachang",
    description: "采集器更新",
    tags: ["国内CTF", "Web"],
    date_confidence: "confirmed",
    event_start: "2026-12-12",
    event_end: "2026-12-13",
    last_checked: new Date().toISOString(),
  }], "haobachang");
  const pending = ingest.listIngest({ state: "pending" })
    .find((i) => i.external_id === "ctf-cn:qiangwang-cup:2026");
  assert.ok(pending);
  assert.equal(pending.suggested_edition.id, 1);
  const result = ingest.acceptIngest(pending.id, { actor: "test" });
  assert.equal(result.merged, true);
  assert.equal(result.edition.id, 1);
  assert.equal(result.edition.stages.filter((s) => s.name === "比赛").length, 1);
  assert.equal(result.edition.event_start, "2026-12-12");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM event_editions").get().n, before);
});

test("bulk accept merges all exact duplicates without creating editions", () => {
  const before = db.prepare("SELECT COUNT(*) AS n FROM event_editions").get().n;
  ingest.stageCandidates([
    {
      key: "ctf-cn:qiangwang-cup:2026", name: "强网杯采集", category: "ctf-cn", region: "cn",
      source: "haobachang", date_confidence: "confirmed", event_start: "2026-12-14",
    },
    {
      key: "devpost:https://taskforge.devpost.com/#event", name: "Taskforge 采集", category: "hackathon", region: "intl",
      source: "devpost", date_confidence: "confirmed", event_start: "2026-11-26",
    },
  ], "haobachang");
  const result = ingest.acceptAllExact({ actor: "test" });
  assert.equal(result.accepted, 2);
  assert.equal(result.failed, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM event_editions").get().n, before);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM ingest_items WHERE state = 'pending'").get().n, 0);
});

test("merging a dated candidate removes the TBD placeholder stage", () => {
  const edition = events.createEdition({
    title: "占位赛事 2027",
    category: "ctf",
    region: "cn",
    publish_state: "published",
    source: "seed",
    external_ref: { source: "test", external_id: "tbd:1" },
    tags: [],
    stages: [{ kind: "other", name: "时间待定", time_status: "unknown", is_all_day: true }],
  }, { actor: "test" });
  ingest.stageCandidates([{
    key: "tbd:1", name: "占位赛事 2027", category: "ctf-cn", region: "cn",
    source: "test", tags: ["Web"], date_confidence: "confirmed",
    event_start: "2027-03-01", event_end: "2027-03-02",
  }], "test");
  const pending = ingest.listIngest({ state: "pending" }).find((i) => i.external_id === "tbd:1");
  assert.ok(pending);
  assert.equal(pending.suggested_edition.id, edition.id);
  const merged = ingest.acceptIngest(pending.id, { actor: "test" });
  assert.equal(merged.merged, true);
  assert.equal(merged.edition.stages.some((s) => s.name === "时间待定"), false);
  assert.equal(merged.edition.stages.some((s) => s.name === "比赛"), true);
});

test("bulk source accept publishes new editions and merges exact matches", () => {
  const before = db.prepare("SELECT COUNT(*) AS n FROM event_editions").get().n;
  ingest.stageCandidates([
    {
      key: "bulk:new:1", name: "批量来源新赛事 2027", category: "academic", region: "cn",
      source: "bulk", organizer: "批量主办", description: "批量测试", tags: ["Web"],
      date_confidence: "confirmed", event_start: "2027-04-01", event_end: "2027-04-02",
    },
    {
      key: "ctf-cn:qiangwang-cup:2026", name: "强网杯精确重复", category: "ctf-cn", region: "cn",
      source: "bulk", date_confidence: "confirmed", event_start: "2026-12-15",
    },
  ], "bulk");
  const result = ingest.acceptSource("bulk", { actor: "test" });
  assert.equal(result.accepted, 2);
  assert.equal(result.failed, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM event_editions").get().n, before + 1);
  assert.ok(result.results.some((r) => r.merged === true));
});
