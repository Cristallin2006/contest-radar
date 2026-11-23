import { createHash } from "node:crypto";
import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first");

export const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 ContestRadar/0.1";

const DAY = 86_400_000;

export async function fetchBuffer(url, opts = {}) {
  const attempts = opts.attempts ?? 2;
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url, {
        headers: {
          "user-agent": UA,
          "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
          ...(opts.headers || {}),
        },
        redirect: "follow",
        signal: AbortSignal.timeout(opts.timeout || 20_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      return { res, buffer: Buffer.from(await res.arrayBuffer()) };
    } catch (err) {
      lastError = err;
      if (i + 1 < attempts) await sleep(700 * (i + 1));
    }
  }
  throw lastError;
}

export async function fetchText(url, opts = {}) {
  const { res, buffer } = await fetchBuffer(url, opts);
  const ct = res.headers.get("content-type") || "";
  let enc = opts.encoding;
  if (!enc) enc = /charset\s*=\s*(gbk|gb2312|gb18030)/i.test(ct) ? "gbk" : "utf-8";
  let text = new TextDecoder(enc).decode(buffer);
  if (!opts.encoding && enc === "utf-8" && text.includes("\uFFFD")) {
    try {
      const alt = new TextDecoder("gbk").decode(buffer);
      if ((alt.match(/\uFFFD/g) || []).length < (text.match(/\uFFFD/g) || []).length) text = alt;
    } catch { /* ignore */ }
  }
  return text;
}

export async function fetchJson(url, opts = {}) {
  const text = await fetchText(url, { ...opts, headers: { accept: "application/json", ...(opts.headers || {}) } });
  return JSON.parse(text);
}

export function stripHtml(input) {
  return String(input ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

export function clean(input, max = 400) {
  const s = stripHtml(input);
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

export function sha1(input) {
  return createHash("sha1").update(String(input)).digest("hex");
}

export function shortHash(input) {
  return sha1(input).slice(0, 16);
}

export function norm(input) {
  return String(input ?? "")
    .toLowerCase()
    .replace(/[\s\-_·:：,，.。!！?？"'“”‘’()（）\[\]【】<>《》/\\|]+/g, "")
    .trim();
}

export function isoDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function isoNow() {
  return new Date().toISOString();
}

export function endOfDay(value) {
  if (!value) return null;
  const d = new Date(String(value).length === 10 ? `${value}T23:59:59` : value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function inferYear(month, day, now = new Date()) {
  let year = now.getFullYear();
  if (month < now.getMonth() + 1) year += 1;
  else if (month === now.getMonth() + 1 && day < now.getDate()) year += 1;
  return year;
}

function mkDate(year, month, day) {
  if (!year || !month || !day) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

/**
 * 从中文通知里提取“报名截止”类日期。
 * 只认“报名/截止/截至”附近 50 字内的日期，避免把比赛日期误当报名截止。
 */
export function parseDeadline(text, now = new Date()) {
  if (!text) return null;
  const t = String(text).replace(/\s+/g, " ");
  const re =
    /(?:报名|截止|截至)[^。；;|]{0,60}?(\d{4})\s*[年\-/.]\s*(\d{1,2})\s*[月\-/.]\s*(\d{1,2})|(?:报名|截止|截至)[^。；;|]{0,60}?(\d{1,2})\s*[月\-/.]\s*(\d{1,2})/g;
  const found = [];
  for (const m of t.matchAll(re)) {
    if (m[1]) {
      const d = mkDate(Number(m[1]), Number(m[2]), Number(m[3]));
      if (d) found.push(d);
    } else if (m[4]) {
      const month = Number(m[4]);
      const day = Number(m[5]);
      const d = mkDate(inferYear(month, day, now), month, day);
      if (d) found.push(d);
    }
  }
  if (!found.length) return null;
  // 截止时间通常在一段话的最后一个日期
  const pick = found[found.length - 1];
  // 太旧的日期视为历史通知
  if (pick.getTime() < now.getTime() - 45 * DAY) return null;
  return isoDate(pick);
}

export function parseEnDate(text, now = new Date()) {
  if (!text) return null;
  const t = String(text).replace(/\s+/g, " ");
  const m = t.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})/i);
  if (!m) return null;
  const months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  const month = months[m[1].slice(0, 3).toLowerCase()];
  const d = mkDate(Number(m[3]), month, Number(m[2]));
  return d ? isoDate(d) : null;
}

export function parseMonthDay(text, year) {
  const m = String(text).match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})/i);
  if (!m) return null;
  const months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  const d = mkDate(Number(year), months[m[1].slice(0, 3).toLowerCase()], Number(m[2]));
  return d ? isoDate(d) : null;
}

export function statusOf(c, now = new Date()) {
  const nowMs = now.getTime();
  const start = c.event_start ? new Date(`${c.event_start}T00:00:00`) : null;
  const end = c.event_end ? endOfDay(c.event_end) : null;
  const deadline = endOfDay(c.registration_deadline);

  if (end && nowMs > end.getTime()) return "ended";
  if (start && nowMs >= start.getTime() && (!end || nowMs <= end.getTime())) return "ongoing";

  if (deadline && nowMs <= deadline.getTime()) {
    const days = Math.ceil((deadline.getTime() - nowMs) / DAY);
    return days <= 7 ? "closing" : "open";
  }
  if (deadline && nowMs > deadline.getTime()) {
    if (start && nowMs < start.getTime()) return "closed";
    return "closed";
  }
  if (start && nowMs < start.getTime()) return "upcoming";
  return "unknown";
}

export function daysLeftOf(c, status, now = new Date()) {
  const nowMs = now.getTime();
  if (status === "open" || status === "closing") {
    const d = endOfDay(c.registration_deadline);
    return d ? Math.ceil((d.getTime() - nowMs) / DAY) : null;
  }
  if (status === "upcoming") {
    const d = c.event_start ? new Date(`${c.event_start}T00:00:00`) : null;
    return d ? Math.ceil((d.getTime() - nowMs) / DAY) : null;
  }
  return null;
}

export function escIcs(input) {
  return String(input ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
