const REGIONS = [
  { key: "cn", label: "国内" },
  { key: "intl", label: "国外" },
];
const CATS = [
  { key: "all", label: "全部", color: "#0f172a" },
  { key: "ctf", label: "CTF", color: "#dc2626" },
  { key: "hackathon", label: "黑客松", color: "#db2777" },
  { key: "datamodel", label: "数据竞赛", color: "#0891b2" },
  { key: "mathmodel", label: "数模", color: "#2563eb" },
  { key: "academic", label: "学科竞赛", color: "#059669" },
  { key: "other", label: "其他", color: "#64748b" },
];
const CAT = Object.fromEntries(CATS.map((c) => [c.key, c]));
const STATUS_LABEL = {
  open: "报名中",
  closing: "即将截止",
  upcoming: "即将开始",
  ongoing: "进行中",
  closed: "报名已截止",
  ended: "已结束",
  unknown: "待定",
  cancelled: "已取消",
  postponed: "已延期",
};
const STATUS_ORDER = {
  closing: 0, open: 1, upcoming: 2, ongoing: 3, unknown: 4,
  closed: 5, cancelled: 6, postponed: 6, ended: 7,
};
const MODE_LABEL = { online: "线上", offline: "线下", hybrid: "混合", unknown: "待定" };
const FAV_KEY = "cr.favorites";
const PROFILE_KEY = "cr.profile";
const DAY = 86_400_000;
const DIRECTIONS = ["Web", "Pwn", "Reverse", "Crypto", "Misc", "Forensics", "Mobile", "IoT", "AI 安全", "区块链", "算法", "开发"];
const GOALS = [
  ["practice", "练手"],
  ["award", "拿奖"],
  ["whitelist", "白名单"],
  ["prize", "奖金"],
  ["job", "求职/实习"],
];

const state = {
  data: null,
  region: "cn",
  filters: { q: "", cat: "all", status: "all", mode: "all", sort: "urgency", time: "future" },
  view: "list",
  calMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  loading: false,
  deepLinkOpened: false,
  modalKey: null,
  myTab: "favorites",
  profile: null,
  profileDraft: null,
};

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeUrl = (v) => {
  if (!v) return "#";
  try {
    const u = new URL(String(v), location.origin);
    return /^https?:$/.test(u.protocol) ? u.href : "#";
  } catch { return "#"; }
};
const ts = (v) => {
  if (!v) return null;
  const s = String(v);
  const t = /^\d{4}-\d{2}-\d{2}$/.test(s)
    ? new Date(`${s}T00:00:00+08:00`).getTime()
    : new Date(s).getTime();
  return Number.isNaN(t) ? null : t;
};
const fmtDate = (v) => {
  if (!v) return "待定";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "-");
};
const fmtShort = (v) => {
  if (!v) return "待定";
  const s = fmtDate(v);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return `${Number(s.slice(5, 7))}月${Number(s.slice(8, 10))}日`;
};
const fmtRange = (a, b) => {
  if (!a && !b) return "待定";
  if (!b || a === b) return fmtDate(a);
  if (a && b && String(a).slice(0, 7) === String(b).slice(0, 7)) return `${fmtDate(a)} – ${fmtShort(b)}`;
  return `${fmtDate(a)} – ${fmtDate(b)}`;
};
const daysText = (n) => {
  if (n === null || n === undefined) return "";
  if (n === 0) return "今天截止";
  if (n > 0) return `剩 ${n} 天`;
  return `已过 ${-n} 天`;
};
const confidenceText = (c) => ({ confirmed: "官方", estimated: "预计", unknown: "待核对" }[c] || "待核对");

function loadFavs() {
  try {
    const raw = JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
    return new Set(Array.isArray(raw) ? raw.map(String) : []);
  } catch { return new Set(); }
}
function saveFavs(set) {
  try { localStorage.setItem(FAV_KEY, JSON.stringify([...set])); } catch { /* ignore */ }
}
function isFav(id) { return loadFavs().has(String(id)); }

function loadProfile() {
  try {
    const p = JSON.parse(localStorage.getItem(PROFILE_KEY) || "null");
    return p && typeof p === "object" ? p : null;
  } catch { return null; }
}
function saveProfile(profile) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch { /* ignore */ }
}
function emptyProfile() {
  return { education: "undergrad", grade: "", directions: {}, goals: [], onlineOnly: false, unavailable: [] };
}
function profileReady(profile) {
  if (!profile) return false;
  return Boolean(
    Object.values(profile.directions || {}).some((v) => Number(v) > 0) ||
    (profile.goals || []).length ||
    profile.onlineOnly ||
    (profile.unavailable || []).length
  );
}

function adaptEdition(e) {
  const stages = Array.isArray(e.stages) ? e.stages : [];
  const knownMode = stages.find((s) => s.mode && s.mode !== "unknown")?.mode
    || stages.find((s) => s.mode)?.mode || "unknown";
  const knownLocation = stages.find((s) => s.location)?.location || null;
  const tags = [...(e.tags?.direction || []), ...(e.tags?.format || [])];
  return {
    ...e,
    key: String(e.id),
    name: e.title,
    organizer: e.organizer || e.series_name || null,
    discipline: e.series_name || tags.join(" / "),
    category: e.category,
    region: e.region,
    mode: knownMode,
    location: knownLocation,
    registration_deadline: e.registration_deadline || null,
    event_start: e.event_start || null,
    event_end: e.event_end || null,
    team_size: e.team_size || null,
    prize: e.prizes || e.prize || null,
    url: e.signup_url || e.source_url || e.series_website || null,
    description: e.description || e.series_description || "",
    tags,
    source_name: e.source_name || e.source,
    tag_direction: e.tags?.direction || [],
    tag_format: e.tags?.format || [],
    field: e.field || "other",
    field_label: e.field_label || null,
    content_type: e.content_type || "competition",
    series_whitelist: Boolean(e.series_whitelist),
    date_confidence: e.date_confidence || "unknown",
    last_checked: e.verified_at || e.last_checked || null,
    stages,
  };
}

const regionOf = (item) => item.region === "intl" ? "intl" : "cn";
const topCat = (item) => {
  const c = String(item.category || "");
  return c === "ctf-cn" || c === "ctf-intl" ? "ctf" : c || "other";
};
const catLabel = (item) => CAT[topCat(item)]?.label || "其他";
const catColor = (item) => CAT[topCat(item)]?.color || "#64748b";
const matchesCat = (item, key) => key === "all" || topCat(item) === key;

function deadlineOf(item) {
  const submission = (item.stages || []).find((s) => s.kind === "submission" && s.deadline_at);
  if (submission) return { label: "提交截止", date: submission.deadline_at, kind: "registration" };
  if (item.registration_deadline) return { label: "报名截止", date: item.registration_deadline, kind: "registration" };
  if (item.event_start) return { label: "开赛", date: item.event_start, kind: "start" };
  return { label: "时间", date: null, kind: "unknown" };
}


function periodOverlaps(period, item) {
  const from = ts(period.from);
  const to = ts(period.to);
  if (from == null && to == null) return false;
  const lo = from ?? to;
  const hi = (to ?? from) + (period.to ? DAY : 0);
  for (const stage of item.stages || []) {
    const start = ts(stage.starts_at) ?? ts(stage.deadline_at);
    const end = ts(stage.ends_at) ?? start;
    if (start != null && start <= hi && end >= lo) return true;
    const deadline = ts(stage.deadline_at);
    if (deadline != null && deadline >= lo && deadline <= hi) return true;
  }
  return false;
}

function scoreEdition(item, profile) {
  if (!profile) return { score: 0, blocked: true, reasons: ["尚未填写本地画像"] };
  const reasons = [];
  let blocked = false;
  if (profile.onlineOnly && item.mode === "offline") {
    blocked = true;
    reasons.push("仅参加线上，但赛事形式为线下");
  }
  for (const period of profile.unavailable || []) {
    if (periodOverlaps(period, item)) {
      blocked = true;
      reasons.push(`与不可用时间冲突：${period.from || "?"} 至 ${period.to || "?"}`);
      break;
    }
  }
  const eligibility = String(item.eligibility || "");
  if (profile.education && profile.education !== "graduate" && /研究生|硕士|博士/.test(eligibility)) {
    blocked = true;
    reasons.push("资格要求研究生/硕士/博士");
  }

  const eventDirections = item.tag_direction || [];
  const ratings = profile.directions || {};
  let best = 0;
  let bestName = null;
  for (const direction of eventDirections) {
    const rating = Number(ratings[direction] || 0);
    if (rating > best) { best = rating; bestName = direction; }
  }
  let directionScore;
  if (!eventDirections.length) {
    directionScore = 20;
    reasons.push("赛事没有方向标签，按中性计分");
  } else if (!Object.values(ratings).some((v) => Number(v) > 0)) {
    directionScore = 20;
    reasons.push("画像尚未设置方向，按中性计分");
  } else if (best > 0) {
    directionScore = Math.round((best / 5) * 40);
    reasons.push(`方向匹配：${bestName} ${best}/5`);
  } else {
    directionScore = 0;
    reasons.push(`方向不匹配：${eventDirections.join(" / ")}`);
  }

  let difficultyScore = 15;
  if (item.difficulty) {
    const rated = Object.values(ratings).map(Number).filter((v) => v > 0);
    const preferred = rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : 3;
    difficultyScore = Math.max(0, Math.min(30, Math.round(30 - Math.abs(Number(item.difficulty) - preferred) * 8)));
    reasons.push(`难度 ${item.difficulty}/5，画像偏好约 ${preferred.toFixed(1)}`);
  } else {
    reasons.push("赛事未标难度，按中性计分");
  }

  const goals = Array.isArray(profile.goals) ? profile.goals : [];
  let goalScore = 15;
  if (goals.length) {
    const scores = [];
    for (const goal of goals) {
      if (goal === "whitelist") {
        const ok = Boolean(item.series_whitelist);
        scores.push(ok ? 30 : 0);
        if (ok) reasons.push("目标：白名单赛事");
      } else if (goal === "prize") {
        const ok = Boolean(item.prizes) || /奖金|奖池|现金|prize/i.test(`${item.description || ""} ${item.prizes || ""}`);
        scores.push(ok ? 30 : 8);
        if (ok) reasons.push("目标：有奖金/奖池");
      } else if (goal === "award") {
        const ok = Boolean(item.prizes) || /奖项|证书|奖杯/.test(`${item.description || ""} ${item.prizes || ""}`);
        scores.push(ok ? 22 : 10);
        if (ok) reasons.push("目标：有奖项/证书");
      } else if (goal === "practice") {
        const ok = ["open", "closing", "upcoming"].includes(item.status);
        scores.push(ok ? 20 : 8);
        if (ok) reasons.push("目标：练手/可报名");
      } else if (goal === "job") {
        const ok = /求职|招聘|实习|就业|校招/.test(`${item.description || ""} ${(item.tags || []).join(" ")}`);
        scores.push(ok ? 30 : 8);
        if (ok) reasons.push("目标：求职/实习");
      }
    }
    goalScore = Math.max(...scores, 8);
  } else {
    reasons.push("未设置目标，按中性计分");
  }

  if (blocked) reasons.unshift("硬条件不满足");
  return {
    score: blocked ? 0 : Math.max(0, Math.min(100, directionScore + difficultyScore + goalScore)),
    blocked,
    reasons,
  };
}

function matchFor(item) {
  return profileReady(state.profile) ? scoreEdition(item, state.profile) : null;
}

function stageTime(stage) {
  if (!stage.starts_at && stage.deadline_at) return `截止 ${fmtDate(stage.deadline_at)}`;
  if (stage.starts_at) return fmtRange(stage.starts_at, stage.ends_at);
  if (stage.ends_at) return `至 ${fmtDate(stage.ends_at)}`;
  return "待定";
}

function stageTimelineHtml(item) {
  const stages = item.stages || [];
  if (!stages.length) return "";
  const rows = stages.map((s) => {
    const time = stageTime(s);
    const note = s.time_status === "tentative" ? "（暂定）" : s.time_status === "unknown" ? "（待定）" : "";
    return `<div class="stage-row">
      <span class="name">${esc(s.name || "阶段")}</span>
      <span class="when">${esc(time)}${note}</span>
      <span class="st ${esc(s.status || "unknown")}">${esc(s.status_label || STATUS_LABEL[s.status] || "待定")}</span>
    </div>`;
  }).join("");
  return `<div class="stage-timeline"><h3>赛程阶段</h3>${rows}</div>`;
}

function futureMatch(item) {
  const now = Date.now();
  const from = now - DAY;
  const to = now + 90 * DAY;
  let hasDate = false;
  for (const s of item.stages || []) {
    const start = ts(s.starts_at);
    const end = ts(s.ends_at);
    const deadline = ts(s.deadline_at);
    if (start != null) {
      hasDate = true;
      if (start <= to && (end ?? start) >= from) return true;
    }
    if (deadline != null) {
      hasDate = true;
      if (deadline <= to && deadline >= from) return true;
    }
  }
  return !hasDate; // 待定赛事保留，避免完全消失
}

function regionItems() {
  return (state.data?.items || []).filter((x) => regionOf(x) === state.region);
}

function filteredItems() {
  const f = state.filters;
  const q = f.q.trim().toLowerCase();
  let items = regionItems();
  if (q) {
    items = items.filter((x) => {
      const hay = [x.name, x.organizer, x.discipline, x.description, ...(x.tags || []), ...(x.stages || []).map((s) => s.name)]
        .join(" ").toLowerCase();
      return hay.includes(q);
    });
  }
  items = items.filter((x) => matchesCat(x, f.cat));
  if (f.status !== "all") {
    if (f.status === "open") items = items.filter((x) => x.status === "open" || x.status === "closing");
    else items = items.filter((x) => x.status === f.status);
  }
  if (f.mode !== "all") items = items.filter((x) => x.mode === f.mode);
  if (f.time === "future") items = items.filter(futureMatch);
  const sorters = {
    urgency: (a, b) =>
      (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) ||
      (a.days_left ?? 9999) - (b.days_left ?? 9999) ||
      String(a.name).localeCompare(String(b.name), "zh-CN"),
    deadline: (a, b) =>
      (ts(a.next_deadline) ?? 9e15) - (ts(b.next_deadline) ?? 9e15) ||
      String(a.name).localeCompare(String(b.name), "zh-CN"),
    start: (a, b) =>
      (ts(a.next_start || a.event_start) ?? 9e15) - (ts(b.next_start || b.event_start) ?? 9e15) ||
      String(a.name).localeCompare(String(b.name), "zh-CN"),
    newest: (a, b) => String(b.created_at).localeCompare(String(a.created_at)),
  };
  return items.sort(sorters[f.sort] || sorters.urgency);
}

function favButton(item, modal = false) {
  const active = isFav(item.id);
  return `<button class="fav-btn ${active ? "active" : ""}" type="button" data-${modal ? "modal-" : ""}fav="${esc(item.id)}" title="${active ? "取消收藏" : "收藏到我的赛程"}" aria-label="${active ? "取消收藏" : "收藏"}">★</button>`;
}

function cardHtml(item) {
  const color = catColor(item);
  const match = matchFor(item);
  const dl = deadlineOf(item);
  const days = item.days_left;
  const daysCls = days !== null && days !== undefined && days <= 7 ? "" : "safe";
  const statusCls = item.status || "unknown";
  const deadlineLine = dl.date
    ? `<span class="${dl.kind === "registration" && days !== null && days <= 7 ? "deadline" : "deadline safe"}"><span class="k">${dl.label}</span>${fmtDate(dl.date)}${days !== null && days !== undefined ? ` · ${daysText(days)}` : ""}</span>`
    : `<span><span class="k">${dl.label}</span>待官方公布</span>`;
  const eventLine = item.event_start
    ? `<span><span class="k">比赛</span>${fmtRange(item.event_start, item.event_end)}</span>`
    : "";
  const modeLine = item.mode && item.mode !== "unknown" ? `<span><span class="k">形式</span>${esc(MODE_LABEL[item.mode] || item.mode)}</span>` : "";
  const teamLine = item.team_size ? `<span><span class="k">队伍</span>${esc(item.team_size)}</span>` : "";
  const feeLine = item.fee ? `<span><span class="k">费用</span>${esc(item.fee)}</span>` : "";
  const daysBadge = days !== null && days !== undefined && ["closing", "open", "upcoming"].includes(item.status)
    ? `<span class="badge days ${daysCls}">${daysText(days)}</span>`
    : "";
  return `
  <article class="card" data-key="${esc(item.key)}" style="--cat:${color}">
    <div class="stripe"></div>
    ${favButton(item)}
    <div class="card-body">
      <div class="card-top">
        <span class="badge cat">${esc(catLabel(item))}</span>
        ${item.field_label ? `<span class="badge field">${esc(item.field_label)}</span>` : ""}
        ${item.recognition_label ? `<span class="badge recognition" title="${esc(item.recognition_note || "工信部关系说明")}">${esc(item.recognition_label)}</span>` : ""}
        <span class="badge status ${esc(statusCls)}">${STATUS_LABEL[item.status] || "待定"}</span>
        <span class="badge confidence ${esc(item.date_confidence)}">${confidenceText(item.date_confidence)}</span>
        ${match ? `<span class="badge match ${match.blocked ? "blocked" : ""}">匹配 ${match.score}</span>` : ""}
        ${daysBadge}
      </div>
      <h3><a href="${esc(safeUrl(item.url))}" target="_blank" rel="noreferrer">${esc(item.name)}</a></h3>
      <p class="org">${esc(item.organizer || "主办方待补充")}${item.discipline ? ` · ${esc(item.discipline)}` : ""}</p>
      <div class="meta">
        ${deadlineLine}
        ${eventLine}
        ${modeLine}
        ${teamLine}
        ${feeLine}
      </div>
      <p class="desc">${esc(item.description || "")}</p>
      <div class="card-foot">
        <span class="src">${esc(item.source_name || item.source)}</span>
        <span>${esc(String(item.last_checked || "").slice(0, 10))}</span>
        <a class="go" href="/competition/${encodeURIComponent(item.id)}">详情</a>
        <a class="go" href="${esc(safeUrl(item.url))}" target="_blank" rel="noreferrer">官网 →</a>
      </div>
    </div>
  </article>`;
}

function renderRegionSwitch() {
  const all = state.data?.items || [];
  const counts = { cn: 0, intl: 0 };
  for (const item of all) counts[regionOf(item)] += 1;
  $("#regionSwitch").innerHTML = REGIONS.map((r) => `
    <button type="button" data-region="${r.key}" class="${state.region === r.key ? "active" : ""}">
      ${r.label}<b>${counts[r.key]}</b>
    </button>`).join("");
}

function renderStats() {
  const items = regionItems();
  const cats = new Set(items.map(topCat));
  const open = items.filter((x) => ["open", "closing"].includes(x.status)).length;
  const soon = items.filter(
    (x) => x.status === "closing" || (x.status === "upcoming" && x.days_left !== null && x.days_left <= 7),
  ).length;
  const label = state.region === "cn" ? "国内收录" : "国外收录";
  $("#stats").innerHTML = `
    <div class="stat"><b>${items.length}</b><span>${label}</span></div>
    <div class="stat"><b>${open}</b><span>报名中</span></div>
    <div class="stat hot"><b>${soon}</b><span>7 天内</span></div>
    <div class="stat"><b>${cats.size}</b><span>覆盖类别</span></div>`;
}

function renderChips() {
  const items = regionItems();
  const counts = {};
  for (const item of items) counts[topCat(item)] = (counts[topCat(item)] || 0) + 1;
  $("#catChips").innerHTML = CATS
    .filter((c) => c.key === "all" || counts[c.key])
    .map((c) => {
      const n = c.key === "all" ? items.length : counts[c.key] || 0;
      return `<button class="chip ${state.filters.cat === c.key ? "active" : ""}" data-cat="${c.key}" type="button">${c.label}<span class="n">${n}</span></button>`;
    }).join("");
}

function renderList() {
  const items = filteredItems();
  const list = $("#list");
  if (!items.length) {
    list.innerHTML = `<div class="empty"><b>没有匹配的比赛</b>换个关键词，或把状态切回「全部状态」。</div>`;
    return;
  }
  const groups = new Map();
  for (const item of items) {
    const key = item.status || "unknown";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  const keys = Object.keys(STATUS_ORDER).filter((k) => groups.has(k));
  list.innerHTML = keys.map((key) => {
    const rows = groups.get(key);
    const label = STATUS_LABEL[key] || "待定";
    return `<div class="group-head"><span>${label}</span><span class="n">${rows.length}</span><span class="line"></span></div>` +
      rows.map(cardHtml).join("");
  }).join("");
}

function renderSidebar() {
  const items = regionItems();
  const closing = items
    .filter((x) => x.status === "closing" || (x.status === "upcoming" && x.days_left !== null && x.days_left <= 7))
    .sort((a, b) => (a.days_left ?? 99) - (b.days_left ?? 99))
    .slice(0, 8);
  $("#closingList").innerHTML = closing.length
    ? closing.map((x) => `<a class="side-item" data-key="${esc(x.key)}">
        <span class="t">${esc(x.name)}</span>
        <span class="d">${x.status === "upcoming" ? "开赛 " : ""}${daysText(x.days_left)} <span class="c">· ${esc(catLabel(x))}</span></span>
      </a>`).join("")
    : `<p class="muted" style="font-size:11.5px;margin:0">暂无 7 天内的比赛。</p>`;

  const sources = state.data?.sources || [];
  $("#sourceList").innerHTML = sources.map((s) => {
    const ok = s.last_status !== "failed";
    const when = s.last_run ? new Date(s.last_run).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "—";
    return `<div class="source-row">
      <span class="dot ${ok ? "" : "failed"}"></span>
      <span class="name">${esc(s.name || s.id)}</span>
      <span class="when">${s.count || 0} 条 · ${when}</span>
    </div>`;
  }).join("") || `<p class="muted" style="font-size:11.5px;margin:0">等待首次采集…</p>`;
}

function renderCalendar() {
  const y = state.calMonth.getFullYear();
  const m = state.calMonth.getMonth();
  $("#calTitle").textContent = `${y} 年 ${m + 1} 月`;
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const items = filteredItems();
  const byDay = new Map();
  for (const item of items) {
    const anchor = item.event_start || item.registration_deadline;
    if (!anchor) continue;
    const d = new Date(`${String(anchor).slice(0, 10)}T00:00:00`);
    if (d.getFullYear() !== y || d.getMonth() !== m) continue;
    const day = d.getDate();
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push({ item, deadlineOnly: !item.event_start });
  }
  const today = new Date();
  let html = "";
  for (let i = 0; i < first; i += 1) html += `<div class="cal-cell empty"></div>`;
  for (let day = 1; day <= days; day += 1) {
    const isToday = today.getFullYear() === y && today.getMonth() === m && today.getDate() === day;
    const events = byDay.get(day) || [];
    const chips = events.slice(0, 2).map(({ item, deadlineOnly }) => {
      const color = catColor(item);
      return `<span class="cal-chip ${deadlineOnly ? "deadline" : ""}" data-key="${esc(item.key)}" title="${esc(item.name)}" style="--cat:${color}">${esc(item.name)}</span>`;
    }).join("");
    const more = events.length > 2 ? `<div class="cal-more">+${events.length - 2}</div>` : "";
    html += `<div class="cal-cell ${isToday ? "today" : ""}"><div class="day">${day}</div>${chips}${more}</div>`;
  }
  $("#calendarGrid").innerHTML = html;
}

function renderFavorites() {
  const list = $("#favoritesList");
  if (!list) return;
  const ids = loadFavs();
  const items = (state.data?.items || []).filter((x) => ids.has(String(x.id)));
  $("#favTitleCount").textContent = `${items.length} 场`;
  updateFavCount();
  if (!items.length) {
    list.innerHTML = `<div class="empty"><b>还没有收藏</b>在赛事卡片右上角点 ★，就会出现在这里；收藏只保存在本浏览器。</div>`;
    return;
  }
  list.innerHTML = items.map((item) => `<div class="fav-block">${cardHtml(item)}${stageTimelineHtml(item)}</div>`).join("");
}


function syncMyTabs() {
  document.querySelectorAll(".my-tab").forEach((b) => b.classList.toggle("active", b.dataset.my === state.myTab));
  const titles = { favorites: "我的赛程", profile: "本地画像", match: "匹配结果" };
  if ($("#myTitle")) $("#myTitle").textContent = titles[state.myTab] || "我的赛程";
  if ($("#favTitleCount")) $("#favTitleCount").classList.toggle("hidden", state.myTab !== "favorites");
  $("#favoritesSection").classList.toggle("hidden", state.myTab !== "favorites");
  $("#profileSection").classList.toggle("hidden", state.myTab !== "profile");
  $("#matchSection").classList.toggle("hidden", state.myTab !== "match");
  $("#favoritesTools").classList.toggle("hidden", state.myTab !== "favorites");
}

function renderMyTab() {
  syncMyTabs();
  if (state.myTab === "favorites") renderFavorites();
  if (state.myTab === "profile") renderProfile();
  if (state.myTab === "match") renderMatch();
}

function switchMyTab(tab) {
  state.myTab = tab;
  updateUrl();
  renderMyTab();
}

function renderProfile() {
  const wrap = $("#profileFormWrap");
  if (!wrap) return;
  const p = state.profileDraft || state.profile || emptyProfile();
  const directions = p.directions || {};
  const goals = new Set(p.goals || []);
  const directionRows = DIRECTIONS.map((d) => `<div class="dir-row">
    <label>${esc(d)}</label>
    <select data-dir="${esc(d)}">${[0, 1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${Number(directions[d] || 0) === n ? "selected" : ""}>${n}</option>`).join("")}</select>
  </div>`).join("");
  const goalRows = GOALS.map(([key, label]) => `<label><input type="checkbox" data-goal="${key}" ${goals.has(key) ? "checked" : ""}/> ${esc(label)}</label>`).join("");
  const unavailable = p.unavailable || [];
  wrap.innerHTML = `<form id="profileForm" class="profile-form">
    <div class="profile-grid">
      <div class="profile-block">
        <h3>基本条件</h3>
        <p class="hint">只用于本地硬条件判断，不会上传。</p>
        <div class="profile-field"><label>学历阶段</label><select data-profile="education">
          <option value="highschool" ${p.education === "highschool" ? "selected" : ""}>高中</option>
          <option value="undergrad" ${!p.education || p.education === "undergrad" ? "selected" : ""}>本科</option>
          <option value="graduate" ${p.education === "graduate" ? "selected" : ""}>研究生</option>
          <option value="other" ${p.education === "other" ? "selected" : ""}>其他</option>
        </select></div>
        <div class="profile-field" style="margin-top:8px"><label>年级</label><select data-profile="grade">
          <option value="">不填</option>
          <option value="freshman" ${p.grade === "freshman" ? "selected" : ""}>大一</option>
          <option value="sophomore" ${p.grade === "sophomore" ? "selected" : ""}>大二</option>
          <option value="junior" ${p.grade === "junior" ? "selected" : ""}>大三</option>
          <option value="senior" ${p.grade === "senior" ? "selected" : ""}>大四</option>
          <option value="master" ${p.grade === "master" ? "selected" : ""}>硕士</option>
          <option value="phd" ${p.grade === "phd" ? "selected" : ""}>博士</option>
          <option value="other" ${p.grade === "other" ? "selected" : ""}>其他</option>
        </select></div>
      </div>
      <div class="profile-block">
        <h3>参赛限制</h3>
        <p class="hint">线上限制和不可用时间会作为硬条件。</p>
        <label class="check-line"><input type="checkbox" data-profile="onlineOnly" ${p.onlineOnly ? "checked" : ""}/> 只参加线上赛事</label>
        <div class="unavailable-list">
          ${unavailable.length ? unavailable.map((u, i) => `<div class="unavailable-row"><span>${esc(u.from || "?")} 至 ${esc(u.to || "?")}</span><button type="button" data-remove-unavailable="${i}" aria-label="删除">×</button></div>`).join("") : '<span class="hint">暂无不可用时间段</span>'}
        </div>
        <div class="unavailable-add">
          <input id="unavailFrom" type="date" aria-label="不可用开始" />
          <span class="hint">至</span>
          <input id="unavailTo" type="date" aria-label="不可用结束" />
          <button class="btn" type="button" data-add-unavailable>添加</button>
        </div>
      </div>
    </div>
    <div class="profile-block">
      <h3>擅长方向</h3>
      <p class="hint">0 = 不熟悉，5 = 很擅长。方向匹配占 40 分。</p>
      <div class="dir-grid">${directionRows}</div>
    </div>
    <div class="profile-block">
      <h3>参赛目标</h3>
      <p class="hint">目标占 30 分，可多选。</p>
      <div class="goal-row">${goalRows}</div>
    </div>
    <div class="profile-actions">
      <button class="btn" type="button" data-profile-reset>清空画像</button>
      <button class="btn primary" type="submit">保存画像</button>
    </div>
    <p id="profileStatus" class="hint">${p.updated_at ? `上次保存：${esc(String(p.updated_at).slice(0, 16).replace("T", " "))}` : "画像只保存在本浏览器。"}</p>
  </form>`;
}

function readProfileForm() {
  const p = {
    education: $("#profileForm [data-profile=education]")?.value || "undergrad",
    grade: $("#profileForm [data-profile=grade]")?.value || "",
    directions: {},
    goals: [...document.querySelectorAll("#profileForm [data-goal]:checked")].map((el) => el.dataset.goal),
    onlineOnly: Boolean($("#profileForm [data-profile=onlineOnly]")?.checked),
    unavailable: [...(state.profileDraft?.unavailable || state.profile?.unavailable || [])],
    updated_at: new Date().toISOString(),
  };
  document.querySelectorAll("#profileForm [data-dir]").forEach((select) => {
    p.directions[select.dataset.dir] = Number(select.value) || 0;
  });
  return p;
}

function saveProfileFromForm() {
  const profile = readProfileForm();
  state.profile = profile;
  state.profileDraft = null;
  saveProfile(profile);
  const status = $("#profileStatus");
  if (status) status.textContent = "已保存到本浏览器。";
  renderList();
  renderMatch();
}

function resetProfile() {
  if (!confirm("确认清空本地画像？")) return;
  state.profile = null;
  state.profileDraft = null;
  try { localStorage.removeItem(PROFILE_KEY); } catch { /* ignore */ }
  renderProfile();
  renderList();
  renderMatch();
}

function addUnavailable() {
  const from = $("#unavailFrom")?.value || "";
  const to = $("#unavailTo")?.value || "";
  if (!from && !to) { alert("请至少选择一天。"); return; }
  const profile = readProfileForm();
  profile.unavailable = [...(profile.unavailable || []), { from, to }];
  state.profileDraft = profile;
  renderProfile();
}

function removeUnavailable(index) {
  const profile = readProfileForm();
  profile.unavailable = (profile.unavailable || []).filter((_, i) => i !== index);
  state.profileDraft = profile;
  renderProfile();
}

function renderMatch() {
  const list = $("#matchList");
  if (!list) return;
  const profile = state.profile;
  if (!profileReady(profile)) {
    list.innerHTML = `<div class="empty"><b>还没有本地画像</b>切到「本地画像」填写方向、目标和限制，匹配分只在本浏览器计算。</div>`;
    return;
  }
  const items = state.data?.items || [];
  const scored = items
    .map((item) => ({ item, ...scoreEdition(item, profile) }))
    .sort((a, b) => b.score - a.score || String(a.item.name).localeCompare(String(b.item.name), "zh-CN"));
  list.innerHTML = scored.map(({ item, score, blocked, reasons }) => `<div class="match-block ${blocked ? "blocked" : ""}">
    ${cardHtml(item)}
    <div class="match-reasons">
      <b>匹配 ${score}/100</b>${blocked ? '<span class="block-reason">硬条件不满足</span>' : ""}
      <ul>${reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
    </div>
  </div>`).join("");
}

function updateFavCount() {
  const count = loadFavs().size;
  const badge = $("#favCount");
  if (!badge) return;
  badge.textContent = String(count);
  badge.classList.toggle("hidden", count === 0);
}

function toggleFav(id) {
  const ids = loadFavs();
  const key = String(id);
  const item = (state.data?.items || []).find((x) => String(x.id) === key);
  if (ids.has(key)) ids.delete(key);
  else ids.add(key);
  saveFavs(ids);
  updateFavCount();
  renderList();
  renderFavorites();
  if (state.modalKey && item && state.modalKey === item.key) openModal(item.key);
}

function openModal(key) {
  const item = (state.data?.items || []).find((x) => x.key === key);
  if (!item) return;
  state.modalKey = key;
  const color = catColor(item);
  const rows = [
    ["系列", item.series_name || "一次性赛事"],
    ["方向", item.field_label || "待细分"],
    ["报名截止", item.registration_deadline ? fmtDate(item.registration_deadline) : "待定"],
    ["比赛时间", item.event_start ? fmtRange(item.event_start, item.event_end) : "待定"],
    ["形式", MODE_LABEL[item.mode] || item.mode || "待定"],
    ["地点", item.location || "—"],
    ["资格", item.eligibility || "以官网为准"],
    ["队伍", item.team_size || "以官网为准"],
    ["费用", item.fee || "以官网为准"],
    ["奖项", item.prize || item.prizes || "以官网为准"],
    ["数据来源", item.source_name || item.source],
    ["最后核实", item.last_checked ? String(item.last_checked).slice(0, 16).replace("T", " ") : "—"],
  ];
  $("#modalBody").innerHTML = `
    <div class="card-top">
      <span class="badge cat" style="--cat:${color}">${esc(catLabel(item))}</span>
      <span class="badge status ${esc(item.status)}">${STATUS_LABEL[item.status] || "待定"}</span>
      <span class="badge confidence ${esc(item.date_confidence)}">${confidenceText(item.date_confidence)}</span>
      ${item.days_left !== null && item.days_left !== undefined ? `<span class="badge days">${daysText(item.days_left)}</span>` : ""}
    </div>
    <h2>${esc(item.name)}</h2>
    <p class="org">${esc(item.organizer || "主办方待补充")}${item.discipline ? ` · ${esc(item.discipline)}` : ""}</p>
    <div class="detail-grid">
      ${rows.map(([k, v]) => `<div class="item"><span class="k">${k}</span><span class="v">${esc(v)}</span></div>`).join("")}
    </div>
    <div class="body">${esc(item.description || "暂无描述。")}</div>
    <div class="stage-section">${stageTimelineHtml(item)}</div>
    ${item.tags?.length ? `<div class="tag-row">${item.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : ""}
    ${matchFor(item) ? `<div class="match-reasons"><b>匹配 ${matchFor(item).score}/100</b>${matchFor(item).blocked ? '<span class="block-reason">硬条件不满足</span>' : ""}<ul>${matchFor(item).reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul></div>` : ""}
    <div class="actions">
      ${favButton(item, true)}
      <a class="btn primary" href="${esc(safeUrl(item.url))}" target="_blank" rel="noreferrer">打开官网</a>
      ${item.source_url ? `<a class="btn" href="${esc(safeUrl(item.source_url))}" target="_blank" rel="noreferrer">查看来源</a>` : ""}
    </div>`;
  $("#modal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  $("#modal").classList.add("hidden");
  document.body.style.overflow = "";
  state.modalKey = null;
}

function render() {
  if (!state.data) return;
  renderRegionSwitch();
  renderStats();
  renderChips();
  renderList();
  renderSidebar();
  renderCalendar();
  updateFavCount();
  if (state.view === "favorites") {
    syncMyTabs();
    if (state.myTab === "favorites") renderFavorites();
    if (state.myTab === "match") renderMatch();
  }
  const last = state.data.last_refresh;
  $("#updatedAt").textContent = last
    ? `上次采集 ${new Date(last).toLocaleString("zh-CN", { hour12: false })}`
    : "正在首次采集…";
}

function updateIcsLink() {
  const link = $(".ics-btn");
  if (link) link.href = `/api/v1/ical/region/${state.region}.ics`;
}

function updateUrl() {
  const p = new URLSearchParams();
  if (state.region === "intl") p.set("region", "intl");
  if (state.filters.cat !== "all") p.set("cat", state.filters.cat);
  if (state.filters.status !== "all") p.set("status", state.filters.status);
  if (state.filters.mode !== "all") p.set("mode", state.filters.mode);
  if (state.filters.time !== "future") p.set("time", state.filters.time);
  if (state.filters.sort !== "urgency") p.set("sort", state.filters.sort);
  if (state.filters.q.trim()) p.set("q", state.filters.q.trim());
  if (state.view !== "list") p.set("view", state.view);
  if (state.view === "favorites" && state.myTab !== "favorites") p.set("my", state.myTab);
  const qs = p.toString();
  history.replaceState(null, "", location.pathname + (qs ? `?${qs}` : ""));
  updateIcsLink();
}

function setRegion(region) {
  if (state.region === region) return;
  state.region = region;
  state.filters.cat = "all";
  updateUrl();
  render();
}

function setCat(cat) {
  state.filters.cat = cat;
  updateUrl();
  renderChips();
  renderList();
  renderCalendar();
}

function setView(view) {
  state.view = view;
  document.querySelectorAll(".view-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  $("#listView").classList.toggle("hidden", view !== "list");
  $("#calendarView").classList.toggle("hidden", view !== "calendar");
  $("#favoritesView").classList.toggle("hidden", view !== "favorites");
  if (view === "calendar") renderCalendar();
  if (view === "favorites") renderMyTab();
  updateUrl();
}

async function fetchAllEditions() {
  const items = [];
  let page = 1;
  let pages = 1;
  do {
    const res = await fetch(`/api/v1/editions?include_unknown=1&all_dates=1&size=100&page=${page}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    items.push(...(data.items || []));
    pages = Number(data.pages || 1);
    page += 1;
  } while (page <= pages);
  return items;
}

async function load() {
  if (state.loading) return;
  state.loading = true;
  try {
    const [rawItems, sourcesData, health] = await Promise.all([
      fetchAllEditions(),
      fetch("/api/sources", { cache: "no-store" }).then((r) => r.ok ? r.json() : { sources: [] }).catch(() => ({ sources: [] })),
      fetch("/api/v1/health", { cache: "no-store" }).then((r) => r.ok ? r.json() : {}).catch(() => ({})),
    ]);
    state.data = {
      items: rawItems.map(adaptEdition),
      sources: sourcesData.sources || [],
      last_refresh: health.last_refresh || null,
      generated_at: health.now || null,
    };
    state.profile = loadProfile();
    render();
    if (!state.deepLinkOpened) {
      const openParam = new URLSearchParams(location.search).get("open");
      if (openParam) {
        const item = state.data.items.find((x) => x.key === openParam || String(x.id) === openParam) ||
          (openParam === "first" ? state.data.items[0] : null);
        if (item) {
          state.deepLinkOpened = true;
          openModal(item.key);
        }
      }
    }
  } catch (err) {
    console.error(err);
    if (!state.data) {
      $("#list").innerHTML = `<div class="empty"><b>数据加载失败</b>${esc(err.message || err)}。稍后会自动重试。</div>`;
    }
  } finally {
    state.loading = false;
  }
}

function icsEscape(input) {
  return String(input ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}
function icsCompactDate(value) {
  return String(value).slice(0, 10).replace(/-/g, "");
}
function icsPlusDay(value) {
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
function icsUtc(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
function icsIsDateOnly(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}
function icsText(name, value) {
  return `${name}:${icsEscape(String(value ?? ""))}`;
}

function buildFavoritesIcs(items) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Contest Radar//Favorites//CN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    icsText("X-WR-CALNAME", "竞赛雷达 · 我的赛程"),
    "X-WR-TIMEZONE:Asia/Shanghai",
  ];
  for (const item of items) {
    const cancelled = item.lifecycle === "cancelled" || item.status_override === "cancelled";
    for (const stage of item.stages || []) {
      if (!stage.starts_at && !stage.ends_at && !stage.deadline_at) continue;
      lines.push("BEGIN:VEVENT", `UID:stage-${stage.id}@contest-radar`, `DTSTAMP:${stamp}`);
      lines.push(`LAST-MODIFIED:${icsUtc(stage.updated_at || stamp) || stamp}`, `SEQUENCE:${Number(stage.ics_sequence || 0)}`);
      lines.push(icsText("SUMMARY", `${item.name} · ${stage.name || "阶段"}`));
      lines.push(icsText("DESCRIPTION", [item.organizer, item.url].filter(Boolean).join("\n")));
      if (item.url) lines.push(`URL:${item.url}`);
      lines.push(`CATEGORIES:${icsEscape(catLabel(item))}`);
      if (cancelled) lines.push("STATUS:CANCELLED");
      if (stage.deadline_at && !stage.starts_at && !stage.ends_at) {
        if (icsIsDateOnly(stage.deadline_at)) lines.push(`DTSTART;VALUE=DATE:${icsCompactDate(stage.deadline_at)}`);
        else {
          const dt = icsUtc(stage.deadline_at);
          if (dt) lines.push(`DTSTART:${dt}`);
        }
        if (stage.time_status === "confirmed" && !cancelled) {
          lines.push("BEGIN:VALARM", "TRIGGER:-P7D", "ACTION:DISPLAY", icsText("DESCRIPTION", `7 天后截止：${item.name} · ${stage.name}`), "END:VALARM");
          lines.push("BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", icsText("DESCRIPTION", `明天截止：${item.name} · ${stage.name}`), "END:VALARM");
        }
      } else if (stage.starts_at) {
        if (icsIsDateOnly(stage.starts_at) || stage.is_all_day) {
          lines.push(`DTSTART;VALUE=DATE:${icsCompactDate(stage.starts_at)}`);
          if (stage.ends_at) lines.push(`DTEND;VALUE=DATE:${icsCompactDate(icsPlusDay(stage.ends_at))}`);
        } else {
          const start = icsUtc(stage.starts_at);
          const end = stage.ends_at ? icsUtc(stage.ends_at) : null;
          if (start) lines.push(`DTSTART:${start}`);
          if (end) lines.push(`DTEND:${end}`);
        }
      } else {
        lines.push(`DTSTART;VALUE=DATE:${icsCompactDate(stage.ends_at)}`);
      }
      lines.push("END:VEVENT");
    }
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportFavoritesIcs() {
  const ids = loadFavs();
  const items = (state.data?.items || []).filter((x) => ids.has(String(x.id)));
  if (!items.length) { alert("先收藏几场比赛再导出。"); return; }
  download("contest-radar-favorites.ics", buildFavoritesIcs(items), "text/calendar;charset=utf-8");
}

function exportLocal() {
  download("contest-radar-local.json", JSON.stringify({
    version: 1,
    exported_at: new Date().toISOString(),
    favorites: [...loadFavs()],
    profile: state.profile || loadProfile(),
  }, null, 2), "application/json");
}

function importLocalFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      const incoming = Array.isArray(data?.favorites) ? data.favorites.map(String) : [];
      const ids = loadFavs();
      for (const id of incoming) ids.add(id);
      saveFavs(ids);
      if (data?.profile && typeof data.profile === "object") {
        state.profile = data.profile;
        state.profileDraft = null;
        saveProfile(data.profile);
      }
      updateFavCount();
      renderFavorites();
      renderList();
      if (state.view === "favorites") renderMyTab();
      alert(`已导入 ${incoming.length} 个收藏。`);
    } catch (err) {
      alert(`导入失败：${err.message}`);
    }
  };
  reader.readAsText(file);
}

function bind() {
  let timer = null;
  $("#searchInput").addEventListener("input", (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.filters.q = e.target.value;
      updateUrl();
      renderList();
      renderCalendar();
    }, 180);
  });
  $("#regionSwitch").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-region]");
    if (b) setRegion(b.dataset.region);
  });
  $("#catChips").addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (b) setCat(b.dataset.cat);
  });
  const renderFilters = () => { updateUrl(); renderList(); renderCalendar(); };
  $("#statusSelect").addEventListener("change", (e) => { state.filters.status = e.target.value; renderFilters(); });
  $("#modeSelect").addEventListener("change", (e) => { state.filters.mode = e.target.value; renderFilters(); });
  $("#timeSelect").addEventListener("change", (e) => { state.filters.time = e.target.value; renderFilters(); });
  $("#sortSelect").addEventListener("change", (e) => { state.filters.sort = e.target.value; renderFilters(); });
  document.querySelectorAll(".view-btn").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
  const handleCardClick = (e) => {
    const fav = e.target.closest("[data-fav]");
    if (fav) {
      e.preventDefault();
      e.stopPropagation();
      toggleFav(fav.dataset.fav);
      return;
    }
    if (e.target.closest("a") || e.target.closest("[data-modal-fav]")) return;
    const card = e.target.closest(".card");
    if (card) openModal(card.dataset.key);
  };
  document.querySelectorAll(".my-tab").forEach((b) => b.addEventListener("click", () => switchMyTab(b.dataset.my)));
  $("#profileFormWrap").addEventListener("submit", (e) => {
    if (e.target.id !== "profileForm") return;
    e.preventDefault();
    saveProfileFromForm();
  });
  $("#profileFormWrap").addEventListener("click", (e) => {
    if (e.target.closest("[data-add-unavailable]")) { addUnavailable(); return; }
    const remove = e.target.closest("[data-remove-unavailable]");
    if (remove) { removeUnavailable(Number(remove.dataset.removeUnavailable)); return; }
    if (e.target.closest("[data-profile-reset]")) resetProfile();
  });
  $("#list").addEventListener("click", handleCardClick);
  $("#favoritesList").addEventListener("click", handleCardClick);
  $("#matchList").addEventListener("click", handleCardClick);
  $("#closingList").addEventListener("click", (e) => {
    const item = e.target.closest(".side-item");
    if (item) openModal(item.dataset.key);
  });
  $("#calendarGrid").addEventListener("click", (e) => {
    const chip = e.target.closest(".cal-chip");
    if (chip) openModal(chip.dataset.key);
  });
  $("#modalBody").addEventListener("click", (e) => {
    const fav = e.target.closest("[data-modal-fav]");
    if (fav) {
      e.preventDefault();
      toggleFav(fav.dataset.modalFav);
    }
  });
  $("#modalClose").addEventListener("click", closeModal);
  $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  $("#calPrev").addEventListener("click", () => { state.calMonth.setMonth(state.calMonth.getMonth() - 1); renderCalendar(); });
  $("#calNext").addEventListener("click", () => { state.calMonth.setMonth(state.calMonth.getMonth() + 1); renderCalendar(); });
  $("#calToday").addEventListener("click", () => {
    const now = new Date();
    state.calMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    renderCalendar();
  });
  $("#exportFavIcs").addEventListener("click", exportFavoritesIcs);
  $("#exportLocal").addEventListener("click", exportLocal);
  $("#importLocal").addEventListener("click", () => $("#importFile").click());
  $("#importFile").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) importLocalFile(file);
    e.target.value = "";
  });
  $("#clearLocal").addEventListener("click", () => {
    if (!confirm("确认清除本浏览器保存的收藏？此操作不可撤销。")) return;
    try { localStorage.removeItem(FAV_KEY); localStorage.removeItem(PROFILE_KEY); } catch { /* ignore */ }
    state.profile = null;
    state.profileDraft = null;
    renderList();
    renderFavorites();
    if (state.view === "favorites") renderMyTab();
  });
}

const params = new URLSearchParams(location.search);
if (params.get("region") === "intl") state.region = "intl";
const catParam = params.get("cat");
if (catParam === "ctf-cn") {
  state.region = "cn";
  state.filters.cat = "ctf";
} else if (catParam === "ctf-intl") {
  state.region = "intl";
  state.filters.cat = "ctf";
} else if (catParam && CATS.some((c) => c.key === catParam)) {
  state.filters.cat = catParam;
}
const statusParam = params.get("status");
if (statusParam && STATUS_LABEL[statusParam]) state.filters.status = statusParam;
const modeParam = params.get("mode");
if (modeParam && MODE_LABEL[modeParam]) state.filters.mode = modeParam;
const timeParam = params.get("time");
if (timeParam === "all" || timeParam === "future") state.filters.time = timeParam;
const sortParam = params.get("sort");
if (["urgency", "deadline", "start", "newest"].includes(sortParam)) state.filters.sort = sortParam;
if (params.get("q")) state.filters.q = params.get("q");
const viewParam = params.get("view");
if (["list", "calendar", "favorites"].includes(viewParam)) state.view = viewParam;
const myParam = params.get("my");
if (["favorites", "profile", "match"].includes(myParam)) state.myTab = myParam;

state.profile = loadProfile();
bind();
$("#searchInput").value = state.filters.q;
$("#statusSelect").value = state.filters.status;
$("#modeSelect").value = state.filters.mode;
$("#timeSelect").value = state.filters.time;
$("#sortSelect").value = state.filters.sort;
setView(state.view);
load();
setInterval(load, 60_000);
