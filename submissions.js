import { createHash } from "node:crypto";
import { db } from "./db.js";
import { createEdition, CATEGORY_LABELS } from "./events.js";
import { FIELD_LABELS } from "./classify.js";

const STATUSES = ["pending", "accepted", "rejected"];
const LIMIT_PER_DAY = 5;

function nowIso() {
  return new Date().toISOString();
}

function text(value, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

function safeUrl(value) {
  const raw = text(value, 500);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return /^https?:$/.test(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function normalizeDeadline(value) {
  const raw = text(value, 40);
  if (!raw) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

function ipHashOf(ip) {
  return createHash("sha256").update(`submission:${ip || "unknown"}`).digest("hex");
}

export function createSubmission(user, input, ip = null) {
  if (!user) {
    const err = new Error("请先登录");
    err.status = 401;
    throw err;
  }
  const title = text(input.title, 180);
  const description = text(input.description, 4000);
  const url = safeUrl(input.url);
  const category = String(input.category || "academic");
  const field = String(input.field || "");
  const expectedDeadline = normalizeDeadline(input.expected_deadline);
  if (title.length < 3) {
    const err = new Error("赛事名称至少 3 个字");
    err.status = 400;
    throw err;
  }
  if (!url) {
    const err = new Error("请填写有效的官网 / 报名链接");
    err.status = 400;
    throw err;
  }
  if (description.length < 10) {
    const err = new Error("请补充至少 10 个字的赛事简介");
    err.status = 400;
    throw err;
  }
  if (!CATEGORY_LABELS[category]) {
    const err = new Error("类别无效");
    err.status = 400;
    throw err;
  }
  if (field && !FIELD_LABELS[field]) {
    const err = new Error("方向无效");
    err.status = 400;
    throw err;
  }
  const recent = db.prepare(`
    SELECT COUNT(*) AS n FROM competition_submissions
    WHERE user_id = ? AND created_at >= ?
  `).get(user.id, new Date(Date.now() - 86_400_000).toISOString()).n;
  if (recent >= LIMIT_PER_DAY) {
    const err = new Error("今天投稿次数已达上限，请明天再试");
    err.status = 429;
    throw err;
  }
  const now = nowIso();
  const result = db.prepare(`
    INSERT INTO competition_submissions
      (user_id, title, url, category, field, description, expected_deadline, status, created_at, ip_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).run(user.id, title, url, category, field || null, description, expectedDeadline, now, ipHashOf(ip));
  return db.prepare("SELECT * FROM competition_submissions WHERE id = ?").get(Number(result.lastInsertRowid));
}

export function listMySubmissions(user) {
  if (!user) return [];
  return db.prepare(`
    SELECT id, title, url, category, field, description, expected_deadline, status,
           admin_note, created_at, reviewed_at, accepted_edition_id
    FROM competition_submissions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50
  `).all(user.id);
}

export function listSubmissionsForAdmin(state = "pending", limit = 100) {
  const normalized = STATUSES.includes(state) ? state : "pending";
  return db.prepare(`
    SELECT s.*, u.login, u.display_name, u.avatar_url, u.profile_url
    FROM competition_submissions s JOIN users u ON u.id = s.user_id
    WHERE s.status = ? ORDER BY s.created_at DESC LIMIT ?
  `).all(normalized, Math.min(Math.max(Number(limit) || 100, 1), 200));
}

export function getSubmission(id) {
  return db.prepare(`
    SELECT s.*, u.login, u.display_name, u.avatar_url, u.profile_url
    FROM competition_submissions s JOIN users u ON u.id = s.user_id
    WHERE s.id = ?
  `).get(Number(id)) || null;
}

export function acceptSubmission(id, actor = "admin") {
  const row = getSubmission(id);
  if (!row) throw new Error("投稿不存在");
  if (row.status !== "pending") throw new Error("该投稿已经处理");
  const edition = createEdition({
    title: row.title,
    description: row.description,
    category: row.category,
    field: row.field || undefined,
    content_type: "competition",
    region: "cn",
    source: "submission",
    source_url: row.url,
    signup_url: row.url,
    publish_state: "draft",
    date_confidence: "unknown",
    verified_at: nowIso(),
    external_ref: { kind: "submission", submission_id: row.id, user_id: row.user_id },
  }, { actor });
  db.prepare(`
    UPDATE competition_submissions
    SET status = 'accepted', reviewed_at = ?, reviewed_by = ?, accepted_edition_id = ?
    WHERE id = ?
  `).run(nowIso(), actor, edition.id, row.id);
  return { submission: getSubmission(row.id), edition };
}

export function rejectSubmission(id, note, actor = "admin") {
  const row = getSubmission(id);
  if (!row) throw new Error("投稿不存在");
  if (row.status !== "pending") throw new Error("该投稿已经处理");
  db.prepare(`
    UPDATE competition_submissions
    SET status = 'rejected', admin_note = ?, reviewed_at = ?, reviewed_by = ?
    WHERE id = ?
  `).run(text(note, 1000) || null, nowIso(), actor, row.id);
  return getSubmission(row.id);
}
