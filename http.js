import { createHash, timingSafeEqual } from "node:crypto";

export function json(res, code, data, headers = {}) {
  const body = JSON.stringify(data);
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...headers,
  });
  res.end(body);
}

export function error(res, code, status, message) {
  return json(res, status, { code, message });
}

export function sendText(res, code, body, type, headers = {}) {
  res.writeHead(code, {
    "content-type": type,
    "x-content-type-options": "nosniff",
    ...headers,
  });
  res.end(body);
}

export function sendCalendar(res, body, { cache = "public, max-age=900" } = {}) {
  const etag = `W/"${createHash("sha1").update(body).digest("hex")}"`;
  return { etag, body, cache };
}

export function etagOf(value) {
  return `W/"${createHash("sha1").update(String(value)).digest("hex")}"`;
}

export function ifNoneMatch(req, etag) {
  const header = req.headers["if-none-match"];
  if (!header) return false;
  return header.split(",").map((s) => s.trim()).includes(etag);
}

export async function readJson(req, limit = 1_048_576) {
  const type = String(req.headers["content-type"] || "");
  if (req.method !== "GET" && req.method !== "HEAD" && !type.includes("application/json")) {
    const err = new Error("Content-Type 必须是 application/json");
    err.status = 415;
    throw err;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) {
      const err = new Error("请求体超过 1MB");
      err.status = 413;
      throw err;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const err = new Error("JSON 格式错误");
    err.status = 400;
    throw err;
  }
}

export function clientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket?.remoteAddress || null;
}

export function tokenMatches(provided, expected) {
  const a = Buffer.from(String(provided || ""));
  const b = Buffer.from(String(expected || ""));
  if (!a.length || !b.length || a.length !== b.length) return false;
  try { return timingSafeEqual(a, b); } catch { return false; }
}

export function checkOrigin(req, allowed = []) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers.host;
  const sameHost = host ? [`http://${host}`, `https://${host}`] : [];
  return [...sameHost, ...allowed].filter(Boolean).includes(origin);
}
