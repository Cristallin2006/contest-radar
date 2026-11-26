import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "./db.js";
import { json, clientIp } from "./http.js";

const CLIENT_ID = process.env.GITHUB_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "";
const BASE_URL = (process.env.PUBLIC_BASE_URL || process.env.BASE_URL || "").replace(/\/$/, "");
const SESSION_COOKIE = "cr_session";
const STATE_COOKIE = "cr_oauth_state";
const RETURN_COOKIE = "cr_oauth_return";
const SESSION_TTL_SECONDS = 30 * 24 * 3600;

export const authEnabled = Boolean(CLIENT_ID && CLIENT_SECRET && SESSION_SECRET);

function nowIso() {
  return new Date().toISOString();
}

function baseUrlOf(req) {
  if (BASE_URL) return BASE_URL;
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  return `${proto}://${req.headers.host || "localhost"}`;
}

function secureCookie(req) {
  return baseUrlOf(req).startsWith("https:");
}

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || "").split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!key) continue;
    try { out[key] = decodeURIComponent(value); } catch { out[key] = value; }
  }
  return out;
}

function appendCookie(res, cookie) {
  const existing = res.getHeader("set-cookie");
  const list = Array.isArray(existing) ? existing : existing ? [existing] : [];
  res.setHeader("set-cookie", [...list, cookie]);
}

function cookie(name, value, req, maxAge) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (secureCookie(req)) parts.push("Secure");
  return parts.join("; ");
}

function clearCookie(name, req) {
  return cookie(name, "", req, 0);
}

function hash(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function sign(value) {
  return createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

function sanitizeReturnTo(value) {
  const text = String(value || "");
  if (!text.startsWith("/") || text.startsWith("//") || text.includes("\\")) return "/submit";
  if (!["/submit", "/hall", "/board", "/", "/list", "/changes", "/preview/arch-os/index.html", "/os", "/os/"].some((path) => text === path || text.startsWith(`${path}?`))) {
    return "/submit";
  }
  return text;
}

function safeUser(row) {
  return {
    id: row.id,
    login: row.login,
    display_name: row.display_name || row.login,
    avatar_url: row.avatar_url || null,
    profile_url: row.profile_url || null,
  };
}

export function currentUser(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const row = db.prepare(`
    SELECT s.id AS session_id, s.expires_at, s.last_seen_at AS session_seen_at,
           u.id, u.login, u.display_name, u.avatar_url, u.profile_url, u.status
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?
  `).get(hash(token));
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now() || row.status !== "active") {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(row.session_id);
    return null;
  }
  if (Date.now() - new Date(row.session_seen_at).getTime() > 5 * 60 * 1000) {
    db.prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?").run(nowIso(), row.session_id);
    db.prepare("UPDATE users SET last_seen_at = ? WHERE id = ?").run(nowIso(), row.id);
  }
  return safeUser(row);
}

function createSession(req, res, userId) {
  const token = randomBytes(32).toString("base64url");
  const now = nowIso();
  const expires = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  db.prepare(`
    INSERT INTO sessions (user_id, token_hash, created_at, expires_at, last_seen_at, ip_hash, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(userId, hash(token), now, expires, now, hash(clientIp(req) || "unknown"), String(req.headers["user-agent"] || "").slice(0, 300));
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now);
  appendCookie(res, cookie(SESSION_COOKIE, token, req, SESSION_TTL_SECONDS));
}

function redirect(res, location, status = 302) {
  res.writeHead(status, { location, "cache-control": "no-store" });
  res.end();
}

function startGitHub(req, res, url) {
  if (!authEnabled) {
    return redirect(res, "/submit?auth=disabled");
  }
  const nonce = randomBytes(24).toString("base64url");
  const expires = Date.now() + 10 * 60 * 1000;
  const state = `${nonce}.${expires}.${sign(`${nonce}.${expires}`)}`;
  const returnTo = sanitizeReturnTo(url.searchParams.get("return_to"));
  appendCookie(res, cookie(STATE_COOKIE, state, req, 600));
  appendCookie(res, cookie(RETURN_COOKIE, returnTo, req, 600));
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: `${baseUrlOf(req)}/auth/github/callback`,
    scope: "read:user",
    state,
    allow_signup: "true",
  });
  return redirect(res, `https://github.com/login/oauth/authorize?${params.toString()}`);
}

async function exchangeCode(req, code) {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded", "user-agent": "contest-radar" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: `${baseUrlOf(req)}/auth/github/callback`,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error || !data.access_token) {
    throw new Error(data.error_description || data.error || "GitHub token exchange failed");
  }
  return data.access_token;
}

async function fetchGitHubUser(accessToken) {
  const response = await fetch("https://api.github.com/user", {
    headers: { accept: "application/vnd.github+json", "user-agent": "contest-radar", authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.id) throw new Error("GitHub user fetch failed");
  return data;
}

async function callbackGitHub(req, res, url) {
  const cookies = parseCookies(req);
  const state = url.searchParams.get("state") || "";
  const expected = cookies[STATE_COOKIE] || "";
  const returnTo = sanitizeReturnTo(cookies[RETURN_COOKIE]);
  appendCookie(res, clearCookie(STATE_COOKIE, req));
  appendCookie(res, clearCookie(RETURN_COOKIE, req));

  if (!authEnabled) return redirect(res, "/submit?auth=disabled");
  if (url.searchParams.get("error")) return redirect(res, "/submit?auth=denied");
  if (!state || !expected || !safeEqual(state, expected)) return redirect(res, "/submit?auth=state");
  const parts = state.split(".");
  if (parts.length !== 3 || Number(parts[1]) <= Date.now() || !safeEqual(parts[2], sign(`${parts[0]}.${parts[1]}`))) {
    return redirect(res, "/submit?auth=state");
  }
  const code = url.searchParams.get("code");
  if (!code) return redirect(res, "/submit?auth=code");

  try {
    const accessToken = await exchangeCode(req, code);
    const github = await fetchGitHubUser(accessToken);
    const now = nowIso();
    db.prepare(`
      INSERT INTO users (provider, provider_uid, login, display_name, avatar_url, profile_url, role, status, created_at, last_seen_at)
      VALUES ('github', ?, ?, ?, ?, ?, 'user', 'active', ?, ?)
      ON CONFLICT(provider, provider_uid) DO UPDATE SET
        login = excluded.login, display_name = excluded.display_name,
        avatar_url = excluded.avatar_url, profile_url = excluded.profile_url,
        last_seen_at = excluded.last_seen_at
    `).run(
      String(github.id), String(github.login), github.name || github.login,
      github.avatar_url || null, github.html_url || null, now, now,
    );
    const user = db.prepare("SELECT id, status FROM users WHERE provider = 'github' AND provider_uid = ?").get(String(github.id));
    if (!user || user.status !== "active") return redirect(res, "/submit?auth=blocked");
    createSession(req, res, user.id);
    return redirect(res, returnTo);
  } catch (err) {
    console.error("[auth] GitHub callback failed:", String(err?.message || err));
    return redirect(res, "/submit?auth=error");
  }
}

function logout(req, res) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hash(token));
  appendCookie(res, clearCookie(SESSION_COOKIE, req));
  return redirect(res, "/");
}

export async function handleAuth(req, res, url) {
  const pathname = url.pathname;
  if (pathname === "/auth/github" && req.method === "GET") {
    startGitHub(req, res, url);
    return true;
  }
  if (pathname === "/auth/github/callback" && req.method === "GET") {
    await callbackGitHub(req, res, url);
    return true;
  }
  if (pathname === "/auth/logout") {
    if (req.method !== "POST") {
      res.writeHead(405, { allow: "POST", "content-type": "text/plain; charset=utf-8" });
      res.end("use POST to log out");
      return true;
    }
    logout(req, res);
    return true;
  }
  if (pathname === "/api/v1/me" && req.method === "GET") {
    const user = currentUser(req);
    json(res, 200, { auth_enabled: authEnabled, authenticated: Boolean(user), user });
    return true;
  }
  return false;
}
