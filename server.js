import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  allCompetitions,
  allSources,
  countCompetitions,
  closeDb,
  db,
  updateSource,
  upsertCompetition,
} from "./db.js";
import { seeds } from "./collectors/seeds.js";
import * as ctftime from "./collectors/ctftime.js";
import * as devpost from "./collectors/devpost.js";
import * as jingsai from "./collectors/jingsai.js";
import * as drivendata from "./collectors/drivendata.js";
import * as comap from "./collectors/comap.js";
import * as adworld from "./collectors/adworld.js";
import * as ctfhub from "./collectors/ctfhub.js";
import * as haobachang from "./collectors/haobachang.js";
import * as saikr from "./collectors/saikr.js";
import * as gxxsjs from "./collectors/gxxsjs.js";
import { statusOf, daysLeftOf, escIcs, isoNow } from "./util.js";
import { ctfDisplayName } from "./collectors/ctf.js";
import { ensureSchema, getMeta, setMeta } from "./schema.js";
import { allPublishedForCalendar } from "./events.js";
import { stageCandidates } from "./ingest.js";
import { handlePublicApi } from "./public-api.js";
import { handleAuth } from "./auth.js";
import { handleAdminApi } from "./admin-api.js";
import { json } from "./http.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
const PORT = Number(process.env.PORT || 8789);
const HOST = process.env.HOST || "0.0.0.0";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const REFRESH_MS = Number(process.env.REFRESH_MS || 6 * 3600 * 1000);
const AUTO_REFRESH = process.env.AUTO_REFRESH !== "0";
const LEGACY_SYNC = process.env.LEGACY_SYNC !== "0";
const DB_PATH = process.env.DB_PATH || "/data/contest.db";
const BACKUP_DIR = process.env.BACKUP_DIR || "/data/backups";
const BACKUP_RETENTION_DAYS = Number(process.env.BACKUP_RETENTION_DAYS || 14);
const AUTO_BACKUP = process.env.AUTO_BACKUP !== "0";
const BASE_URL = (process.env.BASE_URL || "").replace(/\/$/, "");

const COLLECTORS = [ctftime, devpost, jingsai, drivendata, comap, adworld, ctfhub, haobachang, saikr, gxxsjs];
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

let lastRefresh = null;
let refreshing = null;
const logs = [];
let schemaInfo = { version: 0, migrated: 0 };

function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.map(String).join(" ")}`;
  console.log(line);
  logs.push(line);
  if (logs.length > 200) logs.shift();
}

function enrich(row) {
  let tags = [];
  try { tags = JSON.parse(row.tags || "[]"); } catch { /* ignore */ }
  const item = { ...row, tags };
  if (item.category === "ctf-cn") item.name = ctfDisplayName(item.name);
  const status = statusOf(item);
  return {
    ...item,
    status,
    days_left: daysLeftOf(item, status),
    deadline_kind: item.registration_deadline ? "registration" : item.event_start ? "start" : "unknown",
    source_name: SOURCE_NAMES[item.source] || item.source,
  };
}

function statsOf(items) {
  const counts = { total: items.length, open: 0, closing: 0, upcoming: 0, ongoing: 0, closed: 0, ended: 0, unknown: 0 };
  const categories = {};
  for (const item of items) {
    counts[item.status] = (counts[item.status] || 0) + 1;
    categories[item.category] = (categories[item.category] || 0) + 1;
  }
  return { counts, categories };
}

async function refreshAll() {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const started = Date.now();
    log("refresh start");
    for (const s of seeds) {
      try { upsertCompetition(s); } catch (err) { log("seed upsert failed", s.key, err.message); }
    }
    const settled = await Promise.allSettled(
      COLLECTORS.map(async (c) => {
        const t0 = Date.now();
        try {
          const rows = await c.collect();
          const staged = stageCandidates(rows, c.id);
          if (LEGACY_SYNC) {
            for (const row of rows) upsertCompetition(row);
          }
          updateSource(c.id, c.name, "ok", rows.length, null);
          log(`${c.id}: ${rows.length} items in ${Date.now() - t0}ms, ingest +${staged.inserted} ~${staged.updated}`);
          return { id: c.id, ok: true, count: rows.length, ingest: staged };
        } catch (err) {
          updateSource(c.id, c.name, "failed", 0, String(err.message || err).slice(0, 300));
          log(`${c.id}: FAILED ${err.message || err}`);
          return { id: c.id, ok: false, error: String(err.message || err) };
        }
      }),
    );
    const results = settled.map((entry) => entry.status === "fulfilled"
      ? entry.value
      : { id: "unknown", ok: false, error: String(entry.reason || entry.reason?.message || "unknown") });
    lastRefresh = isoNow();
    setMeta("last_refresh", lastRefresh);
    log(`refresh done in ${Date.now() - started}ms, legacy=${countCompetitions()}`);
    return results;
  })().finally(() => { refreshing = null; });
  return refreshing;
}

function backupNow() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(BACKUP_DIR, `contest-${stamp}.db`);
  try { db.exec("PRAGMA wal_checkpoint(TRUNCATE)"); } catch { /* ignore */ }
  db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  const size = fs.statSync(file).size;
  recordBackup(file, size);
  cleanupBackups();
  return { file, size };
}

function cleanupBackups() {
  const cutoff = Date.now() - BACKUP_RETENTION_DAYS * 86_400_000;
  let removed = 0;
  try {
    for (const name of fs.readdirSync(BACKUP_DIR)) {
      if (!/^contest-.*\.db$/.test(name)) continue;
      const file = path.join(BACKUP_DIR, name);
      try {
        if (fs.statSync(file).mtimeMs < cutoff) {
          fs.unlinkSync(file);
          removed += 1;
        }
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
  if (removed) log(`backup cleanup removed ${removed} file(s)`);
  return removed;
}

function scheduleDailyBackup() {
  if (!AUTO_BACKUP) return;
  const next = new Date();
  next.setHours(3, 0, 0, 0);
  if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
  const delay = next.getTime() - Date.now();
  log(`daily backup scheduled at ${next.toISOString()}`);
  setTimeout(() => {
    try {
      const result = backupNow();
      log(`daily backup ok ${result.file} (${result.size} bytes)`);
    } catch (err) {
      log("daily backup failed", err.message || err);
    }
    setInterval(() => {
      try {
        const result = backupNow();
        log(`daily backup ok ${result.file} (${result.size} bytes)`);
      } catch (err) {
        log("daily backup failed", err.message || err);
      }
    }, 86_400_000).unref();
  }, delay).unref();
}

function baseUrlOf(req) {
  if (BASE_URL) return BASE_URL;
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  return `${proto}://${req.headers.host || "localhost"}`;
}

function xmlEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
}

function sitemap(req) {
  const base = baseUrlOf(req);
  const rows = [
    `<url><loc>${xmlEscape(base)}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    `<url><loc>${xmlEscape(base)}/changes</loc><changefreq>daily</changefreq><priority>0.6</priority></url>`,
    `<url><loc>${xmlEscape(base)}/timeline</loc><changefreq>daily</changefreq><priority>0.7</priority></url>`,
    `<url><loc>${xmlEscape(base)}/hall</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`,
    `<url><loc>${xmlEscape(base)}/list</loc><changefreq>daily</changefreq><priority>0.5</priority></url>`,
  ];
  for (const item of allPublishedForCalendar()) {
    rows.push(`<url><loc>${xmlEscape(base)}/?open=${item.id}</loc><lastmod>${xmlEscape(String(item.updated_at || "").slice(0, 10))}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join("\n")}\n</urlset>\n`;
}

function recordBackup(file, size) {
  try {
    db.prepare(`
      INSERT INTO settings (key, value, updated_at) VALUES ('last_backup', ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(JSON.stringify({ file, size, at: isoNow() }), isoNow());
  } catch { /* ignore */ }
}

function calendar(items, region = "") {
  const suffix = region === "cn" ? "（国内）" : region === "intl" ? "（国外）" : "";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Contest Radar//CN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:竞赛雷达${suffix}`,
    "X-WR-TIMEZONE:Asia/Shanghai",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
  ];
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const addDays = (dateStr, n) => {
    const d = new Date(`${dateStr}T00:00:00`);
    d.setDate(d.getDate() + n);
    const p = (x) => String(x).padStart(2, "0");
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
  };
  const compact = (dateStr) => dateStr.replace(/-/g, "");
  for (const item of items) {
    if (item.event_start) {
      const end = item.event_end && item.event_end >= item.event_start ? addDays(item.event_end, 1) : addDays(item.event_start, 1);
      lines.push(
        "BEGIN:VEVENT",
        `UID:${escIcs(item.key)}-event@contest-radar`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${compact(item.event_start)}`,
        `DTEND;VALUE=DATE:${end}`,
        `SUMMARY:${escIcs(item.name)}`,
        `DESCRIPTION:${escIcs([item.organizer, item.registration_deadline ? `报名截止 ${item.registration_deadline}` : "", item.url].filter(Boolean).join("\n"))}`,
        `URL:${escIcs(item.url || item.source_url || "")}`,
        `CATEGORIES:${escIcs(item.category)}`,
        "END:VEVENT",
      );
    }
    if (item.registration_deadline && item.registration_deadline !== item.event_end) {
      lines.push(
        "BEGIN:VEVENT",
        `UID:${escIcs(item.key)}-deadline@contest-radar`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${compact(item.registration_deadline)}`,
        `DTEND;VALUE=DATE:${addDays(item.registration_deadline, 1)}`,
        `SUMMARY:${escIcs(`报名截止：${item.name}`)}`,
        `DESCRIPTION:${escIcs([item.organizer, item.url].filter(Boolean).join("\n"))}`,
        `URL:${escIcs(item.url || item.source_url || "")}`,
        "BEGIN:VALARM",
        "TRIGGER:-P3D",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escIcs(`3 天后报名截止：${item.name}`)}`,
        "END:VALARM",
        "END:VEVENT",
      );
    }
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === "/" || rel === "/timeline") rel = "/timeline.html";
  if (rel === "/list") rel = "/index.html";
  if (rel === "/admin") rel = "/admin.html";
  if (rel === "/changes") rel = "/changes.html";
  if (rel === "/hall") rel = "/hall.html";
  if (rel === "/submit") rel = "/submit.html";
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end("forbidden"); return; }
  fs.readFile(file, (err, buf) => {
    if (err) {
      // SPA fallback
      fs.readFile(path.join(PUBLIC_DIR, "index.html"), (e2, html) => {
        if (e2) { res.writeHead(404); res.end("not found"); return; }
        res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" });
        res.end(html);
      });
      return;
    }
    const ext = path.extname(file).toLowerCase();
    const mime = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".ico": "image/x-icon",
    }[ext] || "application/octet-stream";
    res.writeHead(200, {
      "content-type": mime,
      "cache-control": ext === ".html" ? "no-cache" : "public, max-age=3600",
      "x-content-type-options": "nosniff",
    });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  try {
    if (await handleAuth(req, res, url)) return;
    if (await handlePublicApi(req, res, url, { lastRefresh, refreshing })) return;
    if (await handleAdminApi(req, res, url, {
      adminToken: ADMIN_TOKEN,
      allowedOrigins: BASE_URL ? [BASE_URL] : [],
      refresh: refreshAll,
      backup: backupNow,
      dbPath: DB_PATH,
      backupDir: BACKUP_DIR,
      lastRefresh,
      refreshing,
    })) return;

    if (pathname === "/api/health") {
      return json(res, 200, {
        ok: true,
        items: countCompetitions(),
        editions: db.prepare("SELECT COUNT(*) AS n FROM event_editions").get()?.n ?? 0,
        pending_ingest: db.prepare("SELECT COUNT(*) AS n FROM ingest_items WHERE state = 'pending'").get()?.n ?? 0,
        schema_version: schemaInfo.version,
        last_refresh: lastRefresh,
        refreshing: Boolean(refreshing),
        now: isoNow(),
      });
    }
    if (pathname === "/robots.txt") {
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" });
      res.end(`User-agent: *\nAllow: /\nDisallow: /admin
Disallow: /submit\nSitemap: ${baseUrlOf(req)}/sitemap.xml\n`);
      return;
    }
    if (pathname === "/sitemap.xml") {
      res.writeHead(200, { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" });
      res.end(sitemap(req));
      return;
    }
    if (pathname === "/api/data") {
      const items = allCompetitions().map(enrich);
      const order = { closing: 0, open: 1, upcoming: 2, ongoing: 3, unknown: 4, closed: 5, ended: 6 };
      items.sort((a, b) => {
        const d = (order[a.status] ?? 9) - (order[b.status] ?? 9);
        if (d) return d;
        const ad = a.days_left ?? 9999;
        const bd = b.days_left ?? 9999;
        if (ad !== bd) return ad - bd;
        return String(a.name).localeCompare(String(b.name), "zh-CN");
      });
      const stats = statsOf(items);
      return json(res, 200, {
        items,
        stats,
        sources: allSources().map((s) => ({ ...s, source_name: SOURCE_NAMES[s.id] || s.name })),
        last_refresh: lastRefresh,
        generated_at: isoNow(),
      });
    }
    if (pathname === "/api/sources") {
      return json(res, 200, { sources: allSources() });
    }
    if (pathname === "/api/logs") {
      return json(res, 200, { logs: logs.slice(-80) });
    }
    if (pathname === "/api/refresh" && req.method === "POST") {
      if (!ADMIN_TOKEN) return json(res, 403, { error: "ADMIN_TOKEN 未配置，拒绝刷新" });
      if (req.headers["x-admin-token"] !== ADMIN_TOKEN) return json(res, 401, { error: "unauthorized" });
      const result = await refreshAll();
      return json(res, 200, { ok: true, result });
    }
    if (pathname === "/calendar.ics") {
      const region = url.searchParams.get("region");
      let items = allCompetitions().map(enrich);
      if (region === "cn" || region === "intl") items = items.filter((x) => x.region === region);
      const body = calendar(items, region || "");
      res.writeHead(200, {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": 'inline; filename="contest-radar.ics"',
        "cache-control": "no-cache",
      });
      res.end(body);
      return;
    }
    if (pathname.startsWith("/api/")) return json(res, 404, { error: "not found" });
    return serveStatic(req, res, pathname);
  } catch (err) {
    log("server error", err);
    return json(res, 500, { error: String(err.message || err) });
  }
});

schemaInfo = ensureSchema();
lastRefresh = getMeta("last_refresh", null);
if (schemaInfo.migrated) log(`schema migrated legacy rows: ${schemaInfo.migrated}`);

server.listen(PORT, HOST, () => {
  log(`contest-radar listening on http://${HOST}:${PORT} (schema v${schemaInfo.version})`);
  if (AUTO_REFRESH) refreshAll().catch((err) => log("initial refresh failed", err));
  scheduleDailyBackup();
});

if (AUTO_REFRESH) {
  setInterval(() => {
    refreshAll().catch((err) => log("scheduled refresh failed", err));
  }, REFRESH_MS).unref();
}

process.on("SIGTERM", () => { closeDb(); server.close(() => process.exit(0)); });
process.on("SIGINT", () => { closeDb(); server.close(() => process.exit(0)); });
