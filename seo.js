import { listEditions, STAGE_KIND_LABELS } from "./events.js";

const MODE_LABELS = { online: "线上", offline: "线下", hybrid: "线上 + 线下", unknown: "待定" };
const STATUS_LABELS = {
  open: "报名中", closing: "即将截止", upcoming: "预告", ongoing: "进行中",
  closed: "报名已截止", ended: "已结束", unknown: "待定",
  cancelled: "已取消", postponed: "已延期",
};

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function safeHttp(value) {
  if (!value) return "";
  try {
    const url = new URL(String(value));
    return /^https?:$/.test(url.protocol) ? url.href : "";
  } catch { return ""; }
}

function fmt(value) {
  if (!value) return "待定";
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).replace(/\//g, "-");
}

function shortDesc(value, max = 185) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function stageTime(stage) {
  if (stage.deadline_at) return `截止 ${fmt(stage.deadline_at)}`;
  if (stage.starts_at && stage.ends_at) return `${fmt(stage.starts_at)} — ${fmt(stage.ends_at)}`;
  if (stage.starts_at) return fmt(stage.starts_at);
  return "时间待定";
}

function stageStatusText(status) {
  return STATUS_LABELS[status] || status || "待定";
}

function eventStatusOf(status) {
  if (status === "cancelled") return "https://schema.org/EventCancelled";
  if (status === "postponed") return "https://schema.org/EventPostponed";
  return "https://schema.org/EventScheduled";
}

function attendanceOf(mode) {
  if (mode === "online") return "https://schema.org/OnlineEventAttendanceMode";
  if (mode === "hybrid") return "https://schema.org/MixedEventAttendanceMode";
  return "https://schema.org/OfflineEventAttendanceMode";
}

function jsonLd(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

export function renderCompetitionPage(item, base) {
  const canonical = `${base.replace(/\/$/, "")}/competition/${item.id}`;
  const title = `${item.title} 报名时间、截止时间、官网 | 竞赛雷达`;
  const description = shortDesc([
    item.description,
    item.registration_deadline ? `报名截止 ${fmt(item.registration_deadline)}。` : "",
    item.event_start ? `比赛时间 ${fmt(item.event_start)}${item.event_end ? ` 至 ${fmt(item.event_end)}` : ""}。` : "",
    item.organizer ? `主办方 ${item.organizer}。` : "",
    "请以主办方官网为准。",
  ].filter(Boolean).join(" "));
  const official = safeHttp(item.signup_url || item.url);
  const source = safeHttp(item.source_url);
  const stages = Array.isArray(item.stages) ? item.stages : [];
  const related = listEditions(
    { category: item.category, all_dates: true, include_unknown: true, size: 8 },
    { admin: false },
  ).items.filter((entry) => entry.id !== item.id).slice(0, 5);
  const start = item.event_start || stages.find((stage) => stage.starts_at)?.starts_at;
  const end = item.event_end || stages.find((stage) => stage.ends_at)?.ends_at;
  const firstMode = stages.find((stage) => stage.mode && stage.mode !== "unknown")?.mode || "unknown";
  const event = {
    "@context": "https://schema.org",
    "@type": start ? "Event" : "WebPage",
    name: item.title,
    url: canonical,
    description: shortDesc(item.description || `${item.title}赛事信息`, 500),
    eventStatus: eventStatusOf(item.status),
    eventAttendanceMode: attendanceOf(firstMode),
    organizer: {
      "@type": "Organization",
      name: item.organizer || item.series_name || "竞赛雷达收录",
    },
    location: {
      "@type": "Place",
      name: item.location || (firstMode === "online" ? "线上" : "以主办方通知为准"),
    },
  };
  if (start) event.startDate = start;
  if (end) event.endDate = end;
  if (item.registration_deadline) {
    event.offers = {
      "@type": "Offer",
      url: official || canonical,
      availability: item.status === "closed" || item.status === "ended" ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
      validThrough: item.registration_deadline,
    };
  }
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "竞赛雷达", item: `${base.replace(/\/$/, "")}/` },
      { "@type": "ListItem", position: 2, name: "竞赛馆", item: `${base.replace(/\/$/, "")}/hall` },
      { "@type": "ListItem", position: 3, name: item.title, item: canonical },
    ],
  };
  const recognition = item.recognition_label
    ? `<a class="seo-badge recognition" href="/miit">${esc(item.recognition_label)}</a>`
    : "";
  const stageHtml = stages.length
    ? `<ol class="seo-stages">${stages.map((stage) => `
        <li>
          <span class="seo-stage-kind">${esc(stage.kind_label || STAGE_KIND_LABELS[stage.kind] || "阶段")}</span>
          <div><strong>${esc(stage.name || "阶段")}</strong><small>${esc(stageTime(stage))}${stage.mode ? ` · ${esc(MODE_LABELS[stage.mode] || stage.mode)}` : ""}${stage.note ? ` · ${esc(stage.note)}` : ""}</small></div>
        </li>`).join("")}</ol>`
    : '<p class="seo-muted">暂无阶段信息，日期以主办方官网为准。</p>';
  const relatedHtml = related.length
    ? `<ul class="seo-related">${related.map((entry) => `<li><a href="/competition/${entry.id}">${esc(entry.title)}</a><small>${esc(entry.category_label)} · ${esc(entry.status_label)}</small></li>`).join("")}</ul>`
    : '<p class="seo-muted">暂无同类赛事。</p>';
  const factRows = [
    ["报名截止", fmt(item.registration_deadline || item.next_deadline)],
    ["开赛", fmt(item.event_start || item.next_start)],
    ["结束", fmt(item.event_end)],
    ["状态", item.status_label || stageStatusText(item.status)],
    ["形式", MODE_LABELS[item.mode] || item.mode || "待定"],
    ["队伍", item.team_size || "待定"],
    ["费用", item.fee || "以官网为准"],
    ["资格", item.eligibility || "以官网为准"],
  ].map(([label, value]) => `<div class="seo-fact"><b>${esc(label)}</b><span>${esc(value)}</span></div>`).join("");

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="竞赛雷达">
<meta property="og:title" content="${esc(item.title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(item.title)}">
<meta name="twitter:description" content="${esc(description)}">
<link rel="stylesheet" href="/competition.css?v=20261124a">
<script type="application/ld+json">${jsonLd(event)}</script>
<script type="application/ld+json">${jsonLd(breadcrumb)}</script>
</head>
<body>
<header class="seo-top">
  <a class="seo-brand" href="/"><span class="mark" aria-hidden="true"></span>竞赛雷达</a>
  <nav class="seo-nav" aria-label="站点导航">
    <a href="/hall">竞赛馆</a>
    <a href="/">赛事线路图</a>
    <a href="/list">卡片列表</a>
    <a href="/submit">投稿</a>
    <a href="/board">留言板</a>
    <a href="/docs.html">文档 / API</a>
  </nav>
</header>
<main class="seo-shell">
  <nav class="seo-breadcrumb" aria-label="面包屑"><a href="/">首页</a><span>/</span><a href="/hall">竞赛馆</a><span>/</span><span>${esc(item.title)}</span></nav>
  <header class="seo-hero">
    <div class="seo-badges">
      <span class="seo-badge">${esc(item.category_label)}</span>
      <span class="seo-badge field">${esc(item.field_label)}</span>
      <span class="seo-badge">${esc(item.region_label)}</span>
      <span class="seo-badge status">${esc(item.status_label)}</span>
      ${recognition}
    </div>
    <h1>${esc(item.title)}</h1>
    <p class="seo-sub">${esc(item.series_name || "一次性赛事")}${item.organizer ? ` · ${esc(item.organizer)}` : ""}</p>
    <div class="seo-actions">
      ${official ? `<a class="primary" href="${esc(official)}" target="_blank" rel="noreferrer">打开官网</a>` : ""}
      <a class="secondary" href="/hall?open=${encodeURIComponent(item.id)}">交互视图</a>
      ${source && source !== official ? `<a class="secondary" href="${esc(source)}" target="_blank" rel="noreferrer">查看来源</a>` : ""}
    </div>
  </header>
  <div class="seo-layout">
    <article class="seo-main">
      <section><h2>赛事简介</h2><p class="seo-description">${esc(item.description || "暂无简介。")}</p></section>
      <section><h2>赛程阶段</h2>${stageHtml}</section>
      <section><h2>报名与参赛信息</h2><div class="seo-facts">${factRows}</div></section>
      <p class="seo-disclaimer">时间、地区、赛制、费用等信息为公开来源聚合，可能存在误差；请以主办方官网和报名系统为准，并自行核实。</p>
    </article>
    <aside class="seo-side">
      <section class="seo-card"><h2>关键信息</h2><div class="seo-side-facts">${factRows}</div></section>
      <section class="seo-card"><h2>同类赛事</h2>${relatedHtml}</section>
      <section class="seo-card"><h2>数据说明</h2><p>来源：${esc(item.source_name || item.source || "未知")}${item.verified_at ? ` · 核实 ${esc(String(item.verified_at).slice(0, 10))}` : ""}</p><p><a href="/miit">工信部相关竞赛说明</a> · <a href="/docs.html">数据与 API 文档</a></p></section>
    </aside>
  </div>
  <footer class="seo-footer"><span>竞赛雷达 · 公开竞赛信息聚合</span><span class="site-days" data-site-days>本站已运行 — 天</span></footer>
</main>
<script src="/site-days.js?v=20261123a" defer></script>
</body>
</html>`;
}

export function renderNotFound(base) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>赛事不存在 · 竞赛雷达</title><meta name="robots" content="noindex"><link rel="stylesheet" href="/competition.css?v=20261124a"></head><body><main class="seo-shell"><h1>赛事不存在或未公开</h1><p><a href="/hall">返回竞赛馆</a></p></main></body></html>`;
}
