(() => {
  "use strict";

  const CATEGORY_ORDER = ["ctf", "hackathon", "datamodel", "mathmodel", "academic", "other"];
  const CATEGORY_LABELS = {
    ctf: "CTF", hackathon: "黑客松", datamodel: "数据竞赛",
    mathmodel: "数模", academic: "学科竞赛", other: "其他",
  };
  const REGION_LABELS = { cn: "国内", intl: "国际" };
  const MODE_LABELS = { online: "线上", offline: "线下", hybrid: "线上 + 线下", unknown: "待定" };
  const FIELD_ORDER = ["cyber", "software", "data", "math", "electronics", "engineering", "science", "design", "business", "language", "humanities", "sports", "other"];
  const FIELD_LABELS = {
    cyber: "网络安全", software: "计算机 / 软件", data: "数据 / 统计", math: "数学 / 建模",
    electronics: "电子 / 自动化", engineering: "机械 / 工程", science: "理科 / 医学",
    design: "设计 / 艺术", business: "商科 / 管理", language: "外语 / 翻译",
    humanities: "人文 / 社科", sports: "体育 / 电竞", other: "其他 / 待细分",
  };
  const TECH_FIELDS = new Set(["cyber", "software", "data", "math", "electronics", "engineering"]);
  const STATUS_LABELS = {
    open: "报名中", closing: "即将截止", upcoming: "预告", ongoing: "进行中",
    closed: "报名已截止", ended: "已结束", unknown: "待定",
    cancelled: "已取消", postponed: "已延期",
  };
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
  const safeUrl = (value) => {
    if (!value) return "";
    try {
      const url = new URL(String(value), location.origin);
      return /^https?:$/.test(url.protocol) ? url.href : "";
    } catch { return ""; }
  };
  const state = { region: "all", category: "all", field: "all", tech: false, q: "", openId: null, expanded: new Set() };
  let items = [];
  let detailRequest = 0;

  function fmt(value) {
    if (!value) return "待定";
    const text = String(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return text;
    return date.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "-");
  }

  function daysLeft(value) {
    if (!value) return null;
    const text = String(value);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(text)
      ? new Date(`${text}T23:59:59+08:00`)
      : new Date(text);
    if (Number.isNaN(date.getTime())) return null;
    return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
  }

  function dayText(value) {
    const n = daysLeft(value);
    if (n == null) return "";
    if (n === 0) return "今天截止";
    if (n > 0) return `剩 ${n} 天`;
    return `已过 ${-n} 天`;
  }

  function categoryOf(item) {
    return CATEGORY_LABELS[item.category] || "其他";
  }

  function regionOf(item) {
    return item.region === "intl" ? "intl" : "cn";
  }

  function sourceOf(item) {
    return item.source_name || item.source || "未知来源";
  }

  function tagsOf(item) {
    return [...(item.tags?.direction || []), ...(item.tags?.format || [])].slice(0, 8);
  }

  function fieldOf(item) {
    return item.field || "other";
  }

  function fieldLabel(item) {
    return item.field_label || FIELD_LABELS[fieldOf(item)] || "其他";
  }

  function updateChips(base) {
    const regions = [["all", "全部"], ["cn", "国内"], ["intl", "国际"]];
    $("hallRegions").innerHTML = regions.map(([id, label]) => {
      const count = id === "all" ? items.length : items.filter((item) => regionOf(item) === id).length;
      return `<button type="button" data-region="${id}" aria-pressed="${state.region === id}">${label} ${count}</button>`;
    }).join("");
    const counts = {};
    for (const item of base) counts[item.category] = (counts[item.category] || 0) + 1;
    $("hallCats").innerHTML = [["all", "全部"]].concat(CATEGORY_ORDER.map((id) => [id, CATEGORY_LABELS[id]])).map(([id, label]) => {
      const count = id === "all" ? base.length : counts[id] || 0;
      return `<button type="button" class="hall-cat-btn" data-category="${id}" aria-pressed="${state.category === id}">${label} ${count}</button>`;
    }).join("");
    const fieldBase = state.category === "all" ? base : base.filter((item) => item.category === state.category);
    const fieldCounts = {};
    for (const item of fieldBase) fieldCounts[fieldOf(item)] = (fieldCounts[fieldOf(item)] || 0) + 1;
    $("hallFields").innerHTML = [["all", "全部方向"]].concat(FIELD_ORDER.map((id) => [id, FIELD_LABELS[id]])).map(([id, label]) => {
      const count = id === "all" ? fieldBase.length : fieldCounts[id] || 0;
      if (id !== "all" && count === 0) return "";
      return `<button type="button" class="hall-field-btn" data-field="${id}" aria-pressed="${state.field === id}">${label} ${count}</button>`;
    }).join("");
  }

  function renderStats() {
    const open = items.filter((item) => item.status === "open").length;
    const closing = items.filter((item) => item.status === "closing").length;
    const thisWeek = items.filter((item) => {
      const n = daysLeft(item.next_start || item.event_start);
      return n != null && n >= 0 && n <= 7;
    }).length;
    $("hallStats").innerHTML = [
      [items.length, "已收录届次"],
      [open, "正在报名"],
      [closing, "即将截止"],
      [thisWeek, "7 天内开赛"],
    ].map(([value, label]) => `<div class="hall-stat"><b>${esc(value)}</b><span>${esc(label)}</span></div>`).join("");
  }

  function eventCard(item) {
    const deadline = item.next_deadline || item.registration_deadline;
    const start = item.next_start || item.event_start;
    const status = item.status || "unknown";
    const tags = tagsOf(item);
    const official = safeUrl(item.signup_url || item.url);
    return `<article class="hall-card">
      <div class="hall-card-top">
        <span class="hall-badge cat">${esc(categoryOf(item))}</span>
        <span class="hall-badge field">${esc(fieldLabel(item))}</span>
        <span class="hall-badge">${esc(REGION_LABELS[regionOf(item)])}</span>
        <span class="hall-badge status ${esc(status)}">${esc(STATUS_LABELS[status] || status)}</span>
        ${item.recognition_label ? `<a class="hall-badge recognition" href="/miit" title="${esc(item.recognition_note || "工信部关系说明")}">${esc(item.recognition_label)}</a>` : ""}
        ${item.date_confidence === "estimated" ? '<span class="hall-badge">预计</span>' : ""}
      </div>
      <h3><a href="/competition/${encodeURIComponent(item.id)}" data-detail="${esc(item.id)}">${esc(item.title)}</a></h3>
      <p class="hall-series">${esc(item.series_name || "一次性赛事")}${item.organizer ? ` · ${esc(item.organizer)}` : ""}</p>
      <p class="hall-desc">${esc(item.description || "暂无简介，点击详情查看来源与官网。")}</p>
      <div class="hall-meta">
        <span>报名截止 <b class="${daysLeft(deadline) != null && daysLeft(deadline) <= 7 ? "" : "safe"}">${esc(fmt(deadline))}${dayText(deadline) ? ` · ${esc(dayText(deadline))}` : ""}</b></span>
        <span>开赛 ${esc(fmt(start))}</span>
      </div>
      ${tags.length ? `<div class="hall-tags">${tags.map((tag) => `<span class="hall-tag">${esc(tag)}</span>`).join("")}</div>` : ""}
      <div class="hall-foot">
        <span>${esc(sourceOf(item))}${item.verified_at ? ` · 核实 ${esc(String(item.verified_at).slice(0, 10))}` : ""}</span>
        <span><a href="/competition/${encodeURIComponent(item.id)}" data-detail="${esc(item.id)}">详情</a>${official ? ` · <a href="${esc(official)}" target="_blank" rel="noreferrer">官网</a>` : ""}</span>
      </div>
    </article>`;
  }

  function render() {
    const base = items.filter((item) => state.region === "all" || regionOf(item) === state.region);
    const q = state.q.trim().toLowerCase();
    const filtered = base.filter((item) => {
      if (state.category !== "all" && item.category !== state.category) return false;
      if (state.field !== "all" && fieldOf(item) !== state.field) return false;
      if (state.tech && !TECH_FIELDS.has(fieldOf(item))) return false;
      if (!q) return true;
      return [
        item.title, item.series_name, item.organizer, item.description,
        ...tagsOf(item), sourceOf(item),
      ].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
    updateChips(base);
    renderStats();
    $("hallSearch").value = state.q;
    $("hallTech").checked = state.tech;
    $("hallCount").textContent = `${filtered.length} 条`;
    if (!filtered.length) {
      $("hallList").innerHTML = '<div class="hall-empty"><strong>没有匹配的竞赛</strong>换个关键词，或重置地区/类别筛选。</div>';
      return;
    }
    const groups = new Map();
    for (const item of filtered) {
      const key = item.category || "other";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    const order = [...CATEGORY_ORDER, ...Object.keys(groups).filter((key) => !CATEGORY_ORDER.includes(key))];
    $("hallList").innerHTML = order.filter((key) => groups.has(key)).map((key) => {
      const rows = groups.get(key).sort((a, b) => {
        const ad = a.next_deadline || a.next_start || a.event_start || "9999";
        const bd = b.next_deadline || b.next_start || b.event_start || "9999";
        return String(ad).localeCompare(String(bd)) || String(a.title).localeCompare(String(b.title), "zh-CN");
      });
      const expandAll = Boolean(state.q.trim()) || state.field !== "all" || state.tech || state.category !== "all";
      const expanded = expandAll || state.expanded.has(key);
      const visibleRows = expanded ? rows : rows.slice(0, 6);
      const hidden = rows.length - visibleRows.length;
      return `<section class="hall-section">
        <div class="hall-section-head"><h2>${esc(CATEGORY_LABELS[key] || key)}</h2><span>${rows.length} 条</span></div>
        <div class="hall-grid">${visibleRows.map(eventCard).join("")}</div>
        ${hidden > 0 ? `<button type="button" class="hall-more" data-expand="${esc(key)}">展开该类别其余 ${hidden} 条</button>` : ""}
      </section>`;
    }).join("");
  }

  function stageKindLabel(stage) {
    return stage.kind_label || ({
      registration: "报名", submission: "提交", qualifier: "初赛",
      final: "决赛", other: "阶段",
    }[stage.kind] || "阶段");
  }

  function stageTimeText(stage) {
    if (stage.deadline_at) return `截止 ${fmt(stage.deadline_at)}`;
    if (stage.starts_at && stage.ends_at) return `${fmt(stage.starts_at)} — ${fmt(stage.ends_at)}`;
    if (stage.starts_at) return fmt(stage.starts_at);
    return "时间待定";
  }

  function fact(label, value, strong = false) {
    return `<div class="hall-detail-fact"><b>${esc(label)}</b>${strong ? `<strong>${esc(value)}</strong>` : esc(value)}</div>`;
  }

  function renderDetail(d) {
    const deadline = d.next_deadline || d.registration_deadline;
    const start = d.next_start || d.event_start;
    const status = d.status || "unknown";
    const official = safeUrl(d.signup_url || d.url);
    const source = safeUrl(d.source_url);
    const directions = d.tags?.direction || [];
    const formats = d.tags?.format || [];
    const team = d.team_size_min && d.team_size_max ? `${d.team_size_min}–${d.team_size_max} 人`
      : d.team_size_max ? `最多 ${d.team_size_max} 人` : "待定";
    const facts = [
      fact("报名截止", `${fmt(deadline)}${dayText(deadline) ? ` · ${dayText(deadline)}` : ""}`, true),
      fact("开赛", fmt(start)),
      fact("结束", fmt(d.event_end)),
      fact("状态", STATUS_LABELS[status] || status),
      fact("模式", MODE_LABELS[d.mode] || d.mode_label || d.mode || "待定"),
      fact("队伍", team),
      fact("费用", d.fee || "待定"),
      fact("资格", d.eligibility || "待定"),
    ].join("");
    const stages = (d.stages || []).length
      ? `<div class="hall-detail-stages">${d.stages.map((stage) => `
          <div class="hall-stage-row">
            <span class="hall-stage-kind">${esc(stageKindLabel(stage))}</span>
            <div><b>${esc(stage.name || stageKindLabel(stage))}</b><small>${esc(stageTimeText(stage))}${stage.location ? ` · ${esc(stage.location)}` : ""}${stage.note ? ` · ${esc(stage.note)}` : ""}</small></div>
          </div>`).join("")}</div>`
      : '<p class="hall-detail-sub">暂无阶段信息，日期以主办方官网为准。</p>';
    const tagHtml = [...directions, ...formats].length
      ? `<div class="hall-detail-tags">${[...directions, ...formats].map((tag) => `<span class="hall-tag">${esc(tag)}</span>`).join("")}</div>`
      : '<p class="hall-detail-sub">暂无技能标签。</p>';
    $("hallDetailBody").innerHTML = `
      <div class="hall-detail-kicker">
        <span class="hall-badge cat">${esc(d.category_label || CATEGORY_LABELS[d.category] || d.category || "其他")}</span>
        <span class="hall-badge field">${esc(d.field_label || FIELD_LABELS[d.field] || "其他")}</span>
        <span class="hall-badge">${esc(d.region_label || REGION_LABELS[regionOf(d)])}</span>
        <span class="hall-badge status ${esc(status)}">${esc(STATUS_LABELS[status] || status)}</span>
        ${d.recognition_label ? `<a class="hall-badge recognition" href="/miit" title="${esc(d.recognition_note || "工信部关系说明")}">${esc(d.recognition_label)}</a>` : ""}
        ${d.date_confidence === "estimated" ? '<span class="hall-badge">日期预计</span>' : ""}
      </div>
      <h2 id="hallDetailTitle" class="hall-detail-title">${esc(d.title)}</h2>
      <p class="hall-detail-sub">${esc(d.series_name || "一次性赛事")}${d.organizer ? ` · ${esc(d.organizer)}` : ""}</p>
      <p class="hall-detail-desc">${esc(d.description || "暂无简介。")}</p>
      <section class="hall-detail-section"><h3>关键信息</h3><div class="hall-detail-grid">${facts}</div></section>
      <section class="hall-detail-section"><h3>赛程阶段</h3>${stages}</section>
      <section class="hall-detail-section"><h3>方向与赛制</h3>${tagHtml}</section>
      <div class="hall-detail-actions">
        ${official ? `<a href="${esc(official)}" target="_blank" rel="noreferrer">前往官网</a>` : ""}
        ${source ? `<a class="secondary" href="${esc(source)}" target="_blank" rel="noreferrer">查看来源</a>` : ""}
        <a class="secondary" href="/competition/${encodeURIComponent(d.id)}">本页链接</a>
      </div>
      <p class="hall-detail-sub" style="margin-top:14px">来源：${esc(d.source_name || d.source || "未知")}${d.verified_at ? ` · 核实 ${esc(String(d.verified_at).slice(0, 10))}` : ""}</p>
    `;
  }

  async function openDetail(id) {
    const dialog = $("hallDetail");
    state.openId = String(id);
    syncUrl();
    if (!dialog.open) dialog.showModal();
    document.body.classList.add("detail-open");
    const request = ++detailRequest;
    $("hallDetailBody").innerHTML = '<div class="hall-detail-loading">正在读取赛事详情…</div>';
    try {
      const response = await fetch(`/api/v1/editions/${encodeURIComponent(id)}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (request !== detailRequest) return;
      renderDetail(data);
    } catch (error) {
      if (request !== detailRequest) return;
      $("hallDetailBody").innerHTML = `<div class="hall-detail-loading">详情加载失败：${esc(error.message || error)}</div>`;
    }
  }

  function closeDetail() {
    const dialog = $("hallDetail");
    if (dialog.open) dialog.close();
  }

  function syncUrl() {
    const params = new URLSearchParams();
    if (state.region !== "all") params.set("region", state.region);
    if (state.category !== "all") params.set("cat", state.category);
    if (state.field !== "all") params.set("field", state.field);
    if (state.tech) params.set("tech", "1");
    if (state.q) params.set("q", state.q);
    if (state.openId) params.set("open", state.openId);
    const query = params.toString();
    history.replaceState(null, "", location.pathname + (query ? `?${query}` : ""));
  }

  function bind() {
    $("hallRegions").addEventListener("click", (event) => {
      const button = event.target.closest("[data-region]");
      if (!button) return;
      state.region = button.dataset.region;
      state.category = "all";
      syncUrl();
      render();
    });
    $("hallCats").addEventListener("click", (event) => {
      const button = event.target.closest("[data-category]");
      if (!button) return;
      state.category = button.dataset.category;
      syncUrl();
      render();
    });
    $("hallFields").addEventListener("click", (event) => {
      const button = event.target.closest("[data-field]");
      if (!button) return;
      state.field = button.dataset.field;
      if (state.tech && state.field !== "all" && !TECH_FIELDS.has(state.field)) state.tech = false;
      syncUrl();
      render();
    });
    $("hallTech").addEventListener("change", (event) => {
      state.tech = event.target.checked;
      if (state.tech && state.field !== "all" && !TECH_FIELDS.has(state.field)) state.field = "all";
      syncUrl();
      render();
    });
    $("hallSearch").addEventListener("input", (event) => {
      state.q = event.target.value;
      syncUrl();
      render();
    });
    $("hallList").addEventListener("click", (event) => {
      const expand = event.target.closest("[data-expand]");
      if (expand) {
        state.expanded.add(expand.dataset.expand);
        render();
        return;
      }
      const link = event.target.closest("[data-detail]");
      if (!link) return;
      event.preventDefault();
      openDetail(link.dataset.detail);
    });
    $("hallDetailClose").addEventListener("click", closeDetail);
    $("hallDetail").addEventListener("click", (event) => {
      if (event.target === $("hallDetail")) closeDetail();
    });
    $("hallDetail").addEventListener("close", () => {
      detailRequest += 1;
      document.body.classList.remove("detail-open");
      state.openId = null;
      syncUrl();
    });
    $("hallReset").addEventListener("click", () => {
      state.region = "all";
      state.category = "all";
      state.field = "all";
      state.tech = false;
      state.q = "";
      state.expanded.clear();
      syncUrl();
      render();
    });
  }

  async function fetchAllEditions() {
    const result = [];
    let page = 1;
    let pages = 1;
    do {
      const response = await fetch(`/api/v1/editions?include_unknown=1&all_dates=1&size=100&page=${page}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      result.push(...(data.items || []));
      pages = Number(data.pages || 1);
      page += 1;
    } while (page <= pages);
    return result;
  }

  async function init() {
    const params = new URLSearchParams(location.search);
    if (["all", "cn", "intl"].includes(params.get("region"))) state.region = params.get("region");
    if (params.get("cat") && CATEGORY_LABELS[params.get("cat")]) state.category = params.get("cat");
    if (params.get("field") && FIELD_LABELS[params.get("field")]) state.field = params.get("field");
    state.tech = params.get("tech") === "1";
    state.q = params.get("q") || "";
    state.openId = params.get("open") || null;
    bind();
    try {
      items = await fetchAllEditions();
      render();
      if (state.openId) openDetail(state.openId);
    } catch (error) {
      $("hallList").innerHTML = `<div class="hall-empty"><strong>竞赛馆加载失败</strong>${esc(error.message || error)}</div>`;
      $("hallCount").textContent = "加载失败";
    }
  }

  init();
})();
