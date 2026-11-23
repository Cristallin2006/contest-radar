import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(__dirname);
const DB_PATH = `/tmp/contest-api-${process.pid}.db`;
const BACKUP_DIR = `/tmp/contest-backup-${process.pid}`;
const PORT = 18000 + (process.pid % 1000);
const BASE = `http://127.0.0.1:${PORT}`;
const TOKEN = "test-admin-token";
let child;
let logs = "";

async function waitForServer() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`server did not start\n${logs}`);
}

async function json(pathname, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.admin) headers["X-Admin-Token"] = TOKEN;
  if (options.body) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${pathname}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

before(async () => {
  for (const suffix of ["", "-shm", "-wal"]) {
    try { fs.unlinkSync(DB_PATH + suffix); } catch { /* ignore */ }
  }
  child = spawn(process.execPath, ["server.js"], {
    cwd: ROOT,
    env: {
      ...process.env,
      DB_PATH,
      PORT: String(PORT),
      ADMIN_TOKEN: TOKEN,
      AUTO_REFRESH: "0",
      BACKUP_DIR,
      TZ: "Asia/Shanghai",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (buf) => { logs += buf.toString(); });
  child.stderr.on("data", (buf) => { logs += buf.toString(); });
  await waitForServer();
});

after(() => {
  if (child) child.kill("SIGTERM");
  for (const suffix of ["", "-shm", "-wal"]) {
    try { fs.unlinkSync(DB_PATH + suffix); } catch { /* ignore */ }
  }
  try { fs.rmSync(BACKUP_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
});

test("admin endpoints reject missing or wrong tokens", async () => {
  const missing = await json("/api/v1/admin/overview");
  assert.equal(missing.res.status, 401);
  const wrong = await json("/api/v1/admin/overview", { headers: { "X-Admin-Token": "wrong" } });
  assert.equal(wrong.res.status, 401);
});

test("public health exposes schema version", async () => {
  const { res, data } = await json("/api/v1/health");
  assert.equal(res.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.schema_version, 5);
});

let editionId;
let stageId;

test("admin can create a published edition with stages and tags", async () => {
  const { res, data } = await json("/api/v1/admin/editions", {
    method: "POST",
    admin: true,
    body: JSON.stringify({
      title: "2027 测试邀请赛",
      organizer: "测试主办方",
      description: "测试简介",
      year: 2027,
      region: "cn",
      category: "ctf",
      lifecycle: "normal",
      publish_state: "published",
      source: "manual",
      date_confidence: "confirmed",
      tags: [
        { kind: "direction", name: "Web" },
        { kind: "format", name: "Jeopardy" },
      ],
      stages: [
        { kind: "registration", name: "报名截止", deadline_at: "2027-01-05", time_status: "confirmed" },
        { kind: "online", name: "线上赛", starts_at: "2027-01-10", ends_at: "2027-01-11", time_status: "confirmed" },
      ],
    }),
  });
  assert.equal(res.status, 201);
  editionId = data.id;
  stageId = data.stages.find((s) => s.kind === "online").id;
  assert.equal(data.status, "open");
  assert.equal(data.field, "cyber");
  assert.equal(data.content_type, "competition");
  assert.deepEqual(data.tags, { direction: ["Web"], format: ["Jeopardy"] });
});

test("public list and detail expose the new edition", async () => {
  const list = await json("/api/v1/editions?include_unknown=1&from=2027-01-01&to=2027-02-01");
  assert.equal(list.res.status, 200);
  assert.ok(list.data.items.some((e) => e.id === editionId));
  const detail = await json(`/api/v1/editions/${editionId}`);
  assert.equal(detail.res.status, 200);
  assert.equal(detail.data.title, "2027 测试邀请赛");
  assert.equal(detail.data.stages.length, 2);
});

test("auth status and submission endpoints are safe by default", async () => {
  const me = await json("/api/v1/me");
  assert.equal(me.res.status, 200);
  assert.equal(me.data.auth_enabled, false);
  assert.equal(me.data.authenticated, false);
  const submit = await fetch(`${BASE}/api/v1/submissions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "测试投稿", url: "https://example.com", description: "这是一个测试投稿描述" }),
  });
  assert.equal(submit.status, 401);
  const page = await fetch(`${BASE}/submit`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /投稿/);
});

test("comment board is public but posting requires login", async () => {
  const list = await json("/api/v1/comments");
  assert.equal(list.res.status, 200);
  assert.deepEqual(list.data.items, []);
  const post = await fetch(`${BASE}/api/v1/comments`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ body: "测试留言" }),
  });
  assert.equal(post.status, 401);
  const board = await fetch(`${BASE}/board`);
  assert.equal(board.status, 200);
  assert.match(await board.text(), /留言板/);
});

test("non-competition content is hidden from public queries", async () => {
  const { data } = await json("/api/v1/admin/editions", {
    method: "POST",
    admin: true,
    body: JSON.stringify({
      title: "测试志愿者招募活动",
      category: "academic",
      content_type: "activity",
      publish_state: "draft",
      source: "manual",
    }),
  });
  const publicList = await json("/api/v1/editions?all_dates=1&q=测试志愿者招募");
  assert.equal(publicList.data.total, 0);
  const publicDetail = await json(`/api/v1/editions/${data.id}`);
  assert.equal(publicDetail.res.status, 404);
  const adminDetail = await json(`/api/v1/admin/editions/${data.id}`, { admin: true });
  assert.equal(adminDetail.res.status, 200);
  assert.equal(adminDetail.data.content_type, "activity");
});

test("stage time update increments ICS sequence and changes ETag", async () => {
  const before = await fetch(`${BASE}/api/v1/ical/region/cn.ics`);
  const beforeBody = await before.text();
  const patch = await json(`/api/v1/admin/stages/${stageId}`, {
    method: "PATCH",
    admin: true,
    body: JSON.stringify({ starts_at: "2027-01-12" }),
  });
  assert.equal(patch.res.status, 200);
  assert.equal(patch.data.stages.find((s) => s.id === stageId).ics_sequence, 1);
  const after = await fetch(`${BASE}/api/v1/ical/region/cn.ics`);
  const afterBody = await after.text();
  assert.notEqual(before.headers.get("etag"), after.headers.get("etag"));
  assert.match(beforeBody, /BEGIN:VCALENDAR/);
  assert.match(afterBody, /SEQUENCE:1/);
  assert.match(afterBody, /SUMMARY:2027 测试邀请赛 · 线上赛/);
});

test("backup endpoint writes a restorable SQLite file", async () => {
  const { res, data } = await json("/api/v1/admin/backup", { method: "POST", admin: true });
  assert.equal(res.status, 200);
  assert.ok(fs.existsSync(data.file));
  const copy = new (await import("node:sqlite")).DatabaseSync(data.file, { readOnly: true });
  assert.ok(copy.prepare("SELECT COUNT(*) AS n FROM event_editions").get().n >= 1);
  copy.close();
});

test("admin overview reports the created edition", async () => {
  const { res, data } = await json("/api/v1/admin/overview", { admin: true });
  assert.equal(res.status, 200);
  assert.equal(data.editions.published, 1);
  assert.equal(data.stages, 2);
  assert.equal(data.schema_version, 5);
});

test("admin can manage series and tags", async () => {
  const created = await json("/api/v1/admin/series", {
    method: "POST",
    admin: true,
    body: JSON.stringify({ name: "API 测试系列", category: "ctf", region: "cn", is_whitelist: true }),
  });
  assert.equal(created.res.status, 201);
  const seriesId = created.data.id;
  const list = await json("/api/v1/admin/series", { admin: true });
  assert.ok(list.data.items.some((s) => s.id === seriesId));

  const tag = await json("/api/v1/admin/tags", {
    method: "POST",
    admin: true,
    body: JSON.stringify({ items: [{ kind: "direction", name: "临时方向" }] }),
  });
  assert.equal(tag.res.status, 200);
  const tags = await json("/api/v1/admin/tags", { admin: true });
  const temp = tags.data.items.find((t) => t.name === "临时方向");
  assert.ok(temp);
  const deleted = await json(`/api/v1/admin/tags/${temp.id}`, { method: "DELETE", admin: true });
  assert.equal(deleted.res.status, 200);

  const web = tags.data.items.find((t) => t.kind === "direction" && t.name === "Web");
  const blocked = await json(`/api/v1/admin/tags/${web.id}`, { method: "DELETE", admin: true });
  assert.equal(blocked.res.status, 409);

  const removed = await json(`/api/v1/admin/series/${seriesId}`, { method: "DELETE", admin: true });
  assert.equal(removed.res.status, 200);
});

test("sitemap, robots, and changes page are publicly reachable", async () => {
  const sitemap = await fetch(`${BASE}/sitemap.xml`);
  assert.equal(sitemap.status, 200);
  const xml = await sitemap.text();
  assert.match(xml, /<urlset/);
  assert.match(xml, /\/\?open=/);
  const robots = await fetch(`${BASE}/robots.txt`);
  assert.equal(robots.status, 200);
  assert.match(await robots.text(), /Disallow: \/admin/);
  const changes = await fetch(`${BASE}/changes`);
  assert.equal(changes.status, 200);
  assert.match(await changes.text(), /公开变更记录/);
});

test("timeline preview route is publicly reachable", async () => {
  const response = await fetch(`${BASE}/timeline`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /赛事线路图/);
});

test("default route, card list, and competition hall are routed correctly", async () => {
  const root = await fetch(`${BASE}/`);
  assert.equal(root.status, 200);
  assert.equal(root.headers.get("x-frame-options"), "DENY");
  assert.match(root.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.match(await root.text(), /赛事线路图/);
  const list = await fetch(`${BASE}/list`);
  assert.equal(list.status, 200);
  assert.match(await list.text(), /竞赛雷达 · Contest Radar/);
  const hall = await fetch(`${BASE}/hall`);
  assert.equal(hall.status, 200);
  const hallBody = await hall.text();
  assert.match(hallBody, /竞赛馆/);
  assert.match(hallBody, /hallDetail/);
  assert.doesNotMatch(hallBody, /\/list\?open=/);
});
