import { createHash } from "node:crypto";
import { db } from "./db.js";

const MAX_BODY = 1000;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 3;
const DAILY_LIMIT = 20;

function nowIso() {
  return new Date().toISOString();
}

function ipHashOf(ip) {
  return createHash("sha256").update(`comment:${ip || "unknown"}`).digest("hex");
}

function safeBody(value) {
  return String(value ?? "").replace(/\r\n/g, "\n").trim();
}

export function listComments({ editionId = null, limit = 100 } = {}) {
  const max = Math.min(Math.max(Number(limit) || 100, 1), 200);
  if (editionId === null || editionId === undefined || editionId === "") {
    return db.prepare(`
      SELECT c.id, c.edition_id, c.body, c.created_at,
             u.login, u.display_name, u.avatar_url, u.profile_url
      FROM comments c JOIN users u ON u.id = c.user_id
      WHERE c.status = 'visible' AND c.edition_id IS NULL
      ORDER BY c.created_at DESC LIMIT ?
    `).all(max);
  }
  const id = Number(editionId);
  if (!Number.isInteger(id) || id <= 0) return [];
  return db.prepare(`
    SELECT c.id, c.edition_id, c.body, c.created_at,
           u.login, u.display_name, u.avatar_url, u.profile_url
    FROM comments c JOIN users u ON u.id = c.user_id
    WHERE c.status = 'visible' AND c.edition_id = ?
    ORDER BY c.created_at ASC LIMIT ?
  `).all(id, max);
}

export function createComment(user, input, ip = null) {
  if (!user) {
    const err = new Error("请先登录");
    err.status = 401;
    throw err;
  }
  const body = safeBody(input.body);
  if (body.length < 1) {
    const err = new Error("留言不能为空");
    err.status = 400;
    throw err;
  }
  if (body.length > MAX_BODY) {
    const err = new Error(`留言不能超过 ${MAX_BODY} 个字`);
    err.status = 400;
    throw err;
  }
  const rawEdition = input.edition_id;
  let editionId = null;
  if (rawEdition !== undefined && rawEdition !== null && rawEdition !== "") {
    editionId = Number(rawEdition);
    if (!Number.isInteger(editionId) || editionId <= 0) {
      const err = new Error("赛事 ID 无效");
      err.status = 400;
      throw err;
    }
    const edition = db.prepare(`
      SELECT id FROM event_editions
      WHERE id = ? AND publish_state = 'published' AND content_type = 'competition'
    `).get(editionId);
    if (!edition) {
      const err = new Error("赛事不存在或未公开");
      err.status = 404;
      throw err;
    }
  }
  const recent = db.prepare(`
    SELECT COUNT(*) AS n FROM comments
    WHERE user_id = ? AND created_at >= ?
  `).get(user.id, new Date(Date.now() - RATE_WINDOW_MS).toISOString()).n;
  if (recent >= RATE_LIMIT) {
    const err = new Error("发言太频繁，请稍后再试");
    err.status = 429;
    throw err;
  }
  const daily = db.prepare(`
    SELECT COUNT(*) AS n FROM comments
    WHERE user_id = ? AND created_at >= ?
  `).get(user.id, new Date(Date.now() - 86_400_000).toISOString()).n;
  if (daily >= DAILY_LIMIT) {
    const err = new Error("今天留言次数已达上限");
    err.status = 429;
    throw err;
  }
  const now = nowIso();
  const result = db.prepare(`
    INSERT INTO comments (user_id, edition_id, body, status, created_at, updated_at, ip_hash)
    VALUES (?, ?, ?, 'visible', ?, ?, ?)
  `).run(user.id, editionId, body, now, now, ipHashOf(ip));
  return db.prepare(`
    SELECT c.id, c.edition_id, c.body, c.created_at,
           u.login, u.display_name, u.avatar_url, u.profile_url
    FROM comments c JOIN users u ON u.id = c.user_id
    WHERE c.id = ?
  `).get(Number(result.lastInsertRowid));
}

export function adminListComments(state = "visible", limit = 100) {
  const normalized = ["visible", "hidden"].includes(state) ? state : "visible";
  return db.prepare(`
    SELECT c.*, u.login, u.display_name, u.avatar_url
    FROM comments c JOIN users u ON u.id = c.user_id
    WHERE c.status = ? ORDER BY c.created_at DESC LIMIT ?
  `).all(normalized, Math.min(Math.max(Number(limit) || 100, 1), 200));
}

export function setCommentStatus(id, status, actor = "admin") {
  if (!["visible", "hidden"].includes(status)) throw new Error("状态无效");
  const row = db.prepare("SELECT * FROM comments WHERE id = ?").get(Number(id));
  if (!row) throw new Error("留言不存在");
  db.prepare("UPDATE comments SET status = ?, updated_at = ? WHERE id = ?")
    .run(status, nowIso(), Number(id));
  return db.prepare("SELECT * FROM comments WHERE id = ?").get(Number(id));
}
