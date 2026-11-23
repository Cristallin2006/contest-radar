(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const FIELD_OPTIONS = [
    ["cyber", "网络安全 / CTF"], ["software", "计算机 / 软件 / AI"], ["data", "数据 / 统计"],
    ["math", "数学 / 建模"], ["electronics", "电子 / 自动化"], ["engineering", "机械 / 工程"],
    ["science", "理科 / 医学"], ["design", "设计 / 艺术"], ["business", "商科 / 管理"],
    ["language", "外语 / 翻译"], ["humanities", "人文 / 社科"], ["sports", "体育 / 电竞"],
    ["other", "其他 / 待细分"],
  ];
  const RECOGNITION_OPTIONS = [
    ["", "无 / 未标注"],
    ["miit_talent", "工信部人才中心主办"],
    ["miit_joint", "工信部联合主办"],
    ["miit_related", "工信部系统相关"],
    ["miit_historical", "工信部历史主办"],
  ];
  const CONTENT_OPTIONS = [
    ["competition", "竞赛"], ["volunteer", "志愿者 / 招募"], ["conference", "论坛 / 会议"],
    ["course", "课程 / 培训 / 证书"], ["activity", "庆典 / 活动"], ["other", "其他"],
  ];
  const state = {
    token: sessionStorage.getItem("cr.admin.token") || "",
    tab: "overview",
    pending: [],
    submissions: [],
    comments: [],
    editions: [],
    series: [],
    tags: [],
    selected: null,
    overview: null,
  };

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[ch]));
  }

  function attr(value) {
    return esc(value).replace(/`/g, "&#96;");
  }

  function safeUrl(value) {
    if (!value) return "";
    try {
      const url = new URL(String(value), location.origin);
      return /^https?:$/.test(url.protocol) ? url.href : "";
    } catch { return ""; }
  }

  function formatDate(value) {
    if (!value) return "待定";
    const s = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleString("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  }

  function pills(items, className = "") {
    return (items || []).filter(Boolean).map((x) => `<span class="pill ${className}">${esc(x)}</span>`).join("");
  }

  async function api(path, options = {}) {
    const headers = { "X-Admin-Token": state.token, ...(options.headers || {}) };
    if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
    const res = await fetch(`/api/v1/admin${path}`, { ...options, headers });
    if (res.status === 401) {
      logout();
      throw new Error("令牌无效或已失效");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `请求失败（${res.status}）`);
    return data;
  }

  function showLogin(message = "") {
    $("#loginView").classList.remove("hidden");
    $("#adminView").classList.add("hidden");
    $("#logoutBtn").classList.add("hidden");
    $("#loginError").textContent = message;
  }

  function enterAdmin() {
    $("#loginView").classList.add("hidden");
    $("#adminView").classList.remove("hidden");
    $("#logoutBtn").classList.remove("hidden");
    $("#loginError").textContent = "";
    loadOverview().catch((err) => showLogin(err.message));
  }

  function logout() {
    sessionStorage.removeItem("cr.admin.token");
    state.token = "";
    showLogin("");
  }

  function setMessage(text, isError = false) {
    const el = $("#overviewMessage");
    el.textContent = text || "";
    el.classList.toggle("error", Boolean(isError));
  }

  function switchTab(tab) {
    state.tab = tab;
    document.querySelectorAll(".admin-tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    document.querySelectorAll(".admin-panel").forEach((p) => p.classList.add("hidden"));
    const panel = $(`#panel-${tab}`);
    if (panel) panel.classList.remove("hidden");
    if (tab === "overview") loadOverview().catch((e) => setMessage(e.message, true));
    if (tab === "pending") loadPending().catch((e) => setMessage(e.message, true));
    if (tab === "submissions") loadSubmissions().catch((e) => setMessage(e.message, true));
    if (tab === "comments") loadComments().catch((e) => setMessage(e.message, true));
    if (tab === "editions") loadEditions().catch((e) => setMessage(e.message, true));
    if (tab === "taxonomy") loadTaxonomy().catch((e) => setMessage(e.message, true));
    if (tab === "sources") loadSources().catch((e) => setMessage(e.message, true));
    if (tab === "audit") loadAudit().catch((e) => setMessage(e.message, true));
  }

  function metric(label, value, note = "") {
    return `<div class="metric"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></div>`;
  }

  async function loadOverview() {
    const [data, changes] = await Promise.all([
      api("/overview"),
      api("/changes?limit=8"),
    ]);
    state.overview = data;
    const pending = data.ingest?.pending || 0;
    $("#pendingBadge").textContent = String(pending);
    $("#pendingBadge").classList.toggle("hidden", pending === 0);
    const submissionPending = data.submissions?.pending || 0;
    $("#submissionBadge").textContent = String(submissionPending);
    $("#submissionBadge").classList.toggle("hidden", submissionPending === 0);
    $("#overviewCards").innerHTML = [
      metric("已发布赛事", data.editions?.published ?? 0, `全部 ${data.editions?.total ?? 0} 条`),
      metric("待审核采集", pending, "采纳后才公开"),
      metric("赛事系列", data.series ?? 0, `${data.stages ?? 0} 个阶段`),
      metric("Schema", `v${data.schema_version ?? "?"}`, "系列 / 届次 / 阶段"),
    ].join("");
    $("#sourceMini").innerHTML = sourceTable(data.sources || []);
    $("#changeMini").innerHTML = changeList(changes.items || []);
  }


  async function loadTaxonomy() {
    const [series, tags] = await Promise.all([api("/series"), api("/tags")]);
    state.series = series.items || [];
    state.tags = tags.items || [];
    renderSeries();
    renderTags();
  }

  function renderSeries() {
    if (!state.series.length) {
      $("#seriesList").innerHTML = '<p class="muted">还没有系列</p>';
      return;
    }
    $("#seriesList").innerHTML = state.series.map((s) => `<div class="mini-item series-row" data-series-id="${s.id}">
      <div class="grow">
        <strong>${esc(s.name)}</strong>
        <small>${esc(s.region === "intl" ? "国外" : "国内")} · ${esc(s.category)} · ${s.edition_count || 0} 个届次${s.is_whitelist ? " · 白名单" : ""}</small>
      </div>
      <div class="actions">
        <button class="tiny-btn" data-series-action="edit" data-id="${s.id}" type="button">编辑</button>
        <button class="tiny-btn" data-series-action="delete" data-id="${s.id}" type="button">删除</button>
      </div>
    </div>`).join("");
  }

  function setSeriesField(name, value) {
    const el = document.querySelector(`[data-series-field="${name}"]`);
    if (!el) return;
    if (el.type === "checkbox") el.checked = Boolean(value);
    else el.value = value ?? "";
  }

  function getSeriesField(name) {
    const el = document.querySelector(`[data-series-field="${name}"]`);
    if (!el) return "";
    return el.type === "checkbox" ? el.checked : el.value;
  }

  function resetSeriesForm() {
    $("#seriesForm").dataset.id = "";
    $("#seriesFormTitle").textContent = "新建系列";
    for (const name of ["name", "short_name", "organizer", "website", "description"]) setSeriesField(name, "");
    setSeriesField("category", "ctf");
    setSeriesField("region", "cn");
    setSeriesField("is_whitelist", false);
  }

  function editSeries(id) {
    const series = state.series.find((s) => Number(s.id) === Number(id));
    if (!series) return;
    $("#seriesForm").dataset.id = String(series.id);
    $("#seriesFormTitle").textContent = `编辑系列 #${series.id}`;
    setSeriesField("name", series.name);
    setSeriesField("short_name", series.short_name || "");
    setSeriesField("organizer", series.organizer || "");
    setSeriesField("category", series.category || "other");
    setSeriesField("region", series.region || "cn");
    setSeriesField("website", series.website || "");
    setSeriesField("description", series.description || "");
    setSeriesField("is_whitelist", Boolean(series.is_whitelist));
    $("#seriesForm").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function saveSeries() {
    const id = $("#seriesForm").dataset.id;
    const body = {
      name: getSeriesField("name").trim(),
      short_name: getSeriesField("short_name").trim() || null,
      organizer: getSeriesField("organizer").trim() || null,
      category: getSeriesField("category"),
      region: getSeriesField("region"),
      website: getSeriesField("website").trim() || null,
      description: getSeriesField("description").trim() || null,
      is_whitelist: Boolean(getSeriesField("is_whitelist")),
    };
    if (!body.name) { alert("系列名称不能为空"); return; }
    if (id) await api(`/series/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    else await api("/series", { method: "POST", body: JSON.stringify(body) });
    resetSeriesForm();
    await loadTaxonomy();
  }

  async function deleteSeries(id) {
    if (!confirm("确认删除该系列？系列下仍有届次时会被拒绝。")) return;
    await api(`/series/${id}`, { method: "DELETE" });
    await loadTaxonomy();
  }

  function renderTags() {
    if (!state.tags.length) {
      $("#tagList").innerHTML = '<p class="muted">还没有标签</p>';
      return;
    }
    $("#tagList").innerHTML = state.tags.map((t) => `<span class="tag-admin-item">
      <span class="kind">${t.kind === "format" ? "赛制" : "方向"}</span>
      <span>${esc(t.name)}</span>
      <span class="count">${t.usage_count || 0}</span>
      <button type="button" data-tag-delete="${t.id}" title="${t.usage_count ? "仍被赛事使用，不能删除" : "删除标签"}">×</button>
    </span>`).join("");
  }

  async function addTag() {
    const kind = document.querySelector('[data-tag-field="kind"]').value;
    const name = document.querySelector('[data-tag-field="name"]').value.trim();
    if (!name) { alert("标签名称不能为空"); return; }
    await api("/tags", { method: "POST", body: JSON.stringify({ items: [{ kind, name }] }) });
    document.querySelector('[data-tag-field="name"]').value = "";
    await loadTaxonomy();
  }

  async function deleteTag(id) {
    if (!confirm("确认删除该标签？仍被赛事使用时会被拒绝。")) return;
    await api(`/tags/${id}`, { method: "DELETE" });
    await loadTaxonomy();
  }

  function sourceTable(items) {
    return `<table class="admin-table"><thead><tr><th>来源</th><th>状态</th><th>最近运行</th><th>条数</th></tr></thead><tbody>${
      items.map((s) => `<tr><td>${esc(s.name || s.id)}</td><td>${s.last_status === "ok" ? '<span class="pill good">正常</span>' : s.last_status ? `<span class="pill warn">${esc(s.last_status)}</span>` : '<span class="pill">未运行</span>'}</td><td>${esc(formatDate(s.last_run))}</td><td>${esc(s.count)}</td></tr>`).join("")
    }</tbody></table>`;
  }

  function changeList(items) {
    if (!items.length) return '<p class="muted">暂无变更</p>';
    return items.map((c) => `<div class="mini-item"><strong>${esc(c.edition_title || `#${c.edition_id}`)}</strong><p>${esc(formatDate(c.changed_at))} · ${esc(c.actor_label || "admin")}</p></div>`).join("");
  }

  async function loadPending() {
    const source = $("#pendingSource")?.value || "all";
    const data = await api(`/ingest?state=pending&limit=500${source !== "all" ? `&source=${encodeURIComponent(source)}` : ""}`);
    state.pending = data.items || [];
    if (data.source_counts) {
      const current = $("#pendingSource").value;
      const names = new Map((state.overview?.sources || []).map((s) => [s.id, s.name]));
      $("#pendingSource").innerHTML = '<option value="all">全部来源</option>' + data.source_counts
        .map((s) => `<option value="${esc(s.source)}">${esc(names.get(s.source) || s.source)}（${s.n}）</option>`).join("");
      $("#pendingSource").value = current;
    }
    const pending = state.pending.length;
    const sourceBtn = $("#acceptSourceBtn");
    if (sourceBtn) {
      sourceBtn.classList.toggle("hidden", source === "all" || pending === 0);
      sourceBtn.textContent = `采纳该来源全部（${pending}）`;
    }
    $("#pendingBadge").textContent = String(pending);
    $("#pendingBadge").classList.toggle("hidden", pending === 0);
    if (!pending) {
      $("#pendingList").innerHTML = '<div class="admin-card"><p class="muted">当前来源没有待审核记录。</p></div>';
      return;
    }
    $("#pendingList").innerHTML = state.pending.map(pendingCard).join("");
  }

  function pendingCard(item) {
    const c = item.parsed || {};
    const dates = [
      c.registration_deadline ? `报名截止 ${c.registration_deadline}` : "",
      c.event_start ? `比赛 ${c.event_start}${c.event_end && c.event_end !== c.event_start ? ` – ${c.event_end}` : ""}` : "",
      !c.event_start && !c.registration_deadline ? "日期待定" : "",
    ].filter(Boolean);
    const suggested = item.suggested_edition;
    return `<article class="pending-card" data-id="${item.id}">
      <header>
        <div>
          <h3>${esc(c.name || "(无标题)")}</h3>
          <div class="meta">
            ${pills([c.source_name || item.source, c.region === "intl" ? "国外" : "国内", c.category, ...(c.tags || [])])}
            <span class="pill ${c.date_confidence === "confirmed" ? "good" : "warn"}">${esc(c.date_confidence || "unknown")}</span>
            ${suggested ? `<span class="pill good">将合并 #${suggested.id} ${esc(suggested.title)}</span>` : ""}
          </div>
        </div>
        <span class="pill">#${item.id}</span>
      </header>
      <dl>
        <dt>主办方</dt><dd>${esc(c.organizer || "—")}</dd>
        <dt>时间</dt><dd>${esc(dates.join(" · ") || "待定")}</dd>
        <dt>链接</dt><dd>${c.url ? `<a href="${attr(safeUrl(c.url))}" target="_blank" rel="noreferrer">${esc(c.url)}</a>` : "—"}</dd>
        <dt>原始来源</dt><dd>${esc(item.source)} / ${esc(item.external_id)}</dd>
      </dl>
      <div class="pending-actions">
        <button class="primary-btn" data-action="accept" data-id="${item.id}" type="button">${suggested ? `采纳并合并 #${suggested.id}` : "采纳并新建"}</button>
        <button class="secondary-btn" data-action="merge" data-id="${item.id}" type="button">合并到已有赛事</button>
        <button class="danger-btn" data-action="reject" data-id="${item.id}" type="button">忽略</button>
      </div>
    </article>`;
  }

  async function loadSubmissions() {
    const status = $("#submissionState")?.value || "pending";
    const data = await api(`/submissions?state=${encodeURIComponent(status)}&limit=200`);
    state.submissions = data.items || [];
    const list = $("#submissionList");
    if (!state.submissions.length) {
      list.innerHTML = '<p class="muted">没有这个状态的投稿。</p>';
      return;
    }
    const labels = { pending: "待审核", accepted: "已采用", rejected: "未采用" };
    list.innerHTML = state.submissions.map((item) => `<article class="pending-card" data-id="${item.id}">
      <header>
        <div>
          <h3>${esc(item.title)}</h3>
          <div class="meta">
            ${pills([`@${item.login}`, item.category, item.field || "方向待定", labels[item.status] || item.status])}
          </div>
        </div>
        <span class="pill">#${item.id}</span>
      </header>
      <dl>
        <dt>提交者</dt><dd>${esc(item.display_name || item.login)}（@${esc(item.login)}）</dd>
        <dt>官网</dt><dd>${item.url ? `<a href="${attr(safeUrl(item.url))}" target="_blank" rel="noreferrer">${esc(item.url)}</a>` : "—"}</dd>
        <dt>报名截止</dt><dd>${esc(item.expected_deadline || "未提供")}</dd>
        <dt>简介</dt><dd>${esc(item.description)}</dd>
        <dt>提交时间</dt><dd>${esc(formatDate(item.created_at))}</dd>
        ${item.admin_note ? `<dt>审核备注</dt><dd>${esc(item.admin_note)}</dd>` : ""}
        ${item.accepted_edition_id ? `<dt>草稿赛事</dt><dd>#${item.accepted_edition_id}</dd>` : ""}
      </dl>
      <div class="pending-actions">
        ${item.status === "pending" ? `<button class="primary-btn" data-sub-action="accept" data-id="${item.id}" type="button">采用并建草稿</button><button class="danger-btn" data-sub-action="reject" data-id="${item.id}" type="button">拒绝</button>` : ""}
      </div>
    </article>`).join("");
  }

  async function loadComments() {
    const status = $("#commentState")?.value || "visible";
    const data = await api(`/comments?state=${encodeURIComponent(status)}&limit=200`);
    state.comments = data.items || [];
    const list = $("#commentAdminList");
    if (!state.comments.length) {
      list.innerHTML = '<p class="muted">没有这个状态的留言。</p>';
      return;
    }
    list.innerHTML = state.comments.map((item) => `<article class="pending-card" data-id="${item.id}">
      <header><div><h3>@${esc(item.login)}</h3><div class="meta">${pills([item.status, formatDate(item.created_at)])}</div></div><span class="pill">#${item.id}</span></header>
      <dl><dt>内容</dt><dd style="white-space:pre-wrap">${esc(item.body)}</dd>${item.edition_id ? `<dt>赛事</dt><dd>#${item.edition_id}</dd>` : ""}</dl>
      <div class="pending-actions">
        ${item.status === "visible" ? `<button class="danger-btn" data-comment-action="hide" data-id="${item.id}" type="button">隐藏</button>` : `<button class="secondary-btn" data-comment-action="show" data-id="${item.id}" type="button">恢复显示</button>`}
      </div>
    </article>`).join("");
  }

  async function loadEditions() {
    const q = $("#editionSearch")?.value.trim() || "";
    const data = await api(`/editions?size=100&sort=updated${q ? `&q=${encodeURIComponent(q)}` : ""}`);
    state.editions = data.items || [];
    if (!state.editions.length) {
      $("#editionRows").innerHTML = '<tr><td colspan="7" class="muted">没有匹配的赛事</td></tr>';
      return;
    }
    $("#editionRows").innerHTML = state.editions.map((e) => `<tr>
      <td>${e.id}</td>
      <td class="title-cell">${esc(e.title)}<small>${esc(e.series_name || "一次性赛事")}${e.field_label ? ` · ${esc(e.field_label)}` : ""}</small></td>
      <td>${esc(e.region_label)} / ${esc(e.category_label)}</td>
      <td><span class="pill ${["open", "closing"].includes(e.status) ? "good" : ""}">${esc(e.status_label)}</span></td>
      <td>${esc(e.publish_state)}</td>
      <td>${esc(e.source_name || e.source)}</td>
      <td><button class="tiny-btn" data-action="edit" data-id="${e.id}" type="button">编辑</button></td>
    </tr>`).join("");
  }

  async function loadSources() {
    const data = await api("/sources");
    $("#sourceRows").innerHTML = (data.items || []).map((s) => `<tr>
      <td>${esc(s.id)}</td><td>${esc(s.name)}</td><td>${esc(formatDate(s.last_run))}</td>
      <td>${s.last_status === "ok" ? '<span class="pill good">正常</span>' : `<span class="pill warn">${esc(s.last_status || "未运行")}</span>`}</td>
      <td>${esc(s.count)}</td><td>${esc(s.last_error || "—")}</td>
    </tr>`).join("");
  }

  async function loadAudit() {
    const [audit, changes] = await Promise.all([
      api("/audit?limit=100"),
      api("/changes?limit=100"),
    ]);
    $("#auditList").innerHTML = (audit.items || []).length
      ? audit.items.map((a) => `<div class="mini-item"><strong>${esc(a.action)} · ${esc(a.target || "")}</strong><p>${esc(formatDate(a.created_at))} · ${esc(a.actor_label)} · ${esc(a.ip || "no ip")}</p></div>`).join("")
      : '<p class="muted">暂无审计记录</p>';
    $("#changeList").innerHTML = changeList(changes.items || []);
  }

  async function accept(id, editionId = null) {
    const result = await api(`/ingest/${id}/accept`, {
      method: "POST",
      body: JSON.stringify(editionId ? { edition_id: Number(editionId) } : {}),
    });
    await loadPending();
    await loadOverview();
    return result;
  }

  async function promptMerge(id) {
    const raw = prompt("合并到已有赛事 ID（在“赛事”页可查看 ID）：");
    if (!raw) return;
    const editionId = Number(raw);
    if (!Number.isInteger(editionId) || editionId <= 0) {
      alert("请输入有效的赛事 ID");
      return;
    }
    await accept(id, editionId);
  }

  async function reject(id) {
    const reason = prompt("忽略原因（可留空）：", "重复 / 不相关 / 日期不可信");
    if (reason === null) return;
    await api(`/ingest/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) });
    await loadPending();
    await loadOverview();
  }

  function field(label, name, value = "", type = "text", extra = "") {
    return `<div class="field"><label>${esc(label)}</label><input type="${type}" data-field="${name}" value="${attr(value)}" ${extra} /></div>`;
  }

  function select(label, name, value, options) {
    return `<div class="field"><label>${esc(label)}</label><select data-field="${name}">${
      options.map(([id, text]) => `<option value="${attr(id)}" ${String(value) === String(id) ? "selected" : ""}>${esc(text)}</option>`).join("")
    }</select></div>`;
  }

  function textarea(label, name, value = "") {
    return `<div class="field full"><label>${esc(label)}</label><textarea data-field="${name}">${esc(value || "")}</textarea></div>`;
  }

  function stageEditor(stage = {}) {
    const s = stage || {};
    return `<div class="stage-editor" data-stage-id="${s.id || ""}">
      <div class="form-grid">
        ${select("类型", "kind", s.kind || "other", [
          ["registration", "报名"], ["qualification", "资格审核"], ["online", "线上赛"],
          ["offline", "线下赛"], ["final", "决赛"], ["submission", "提交"], ["other", "其他"],
        ])}
        ${field("名称", "name", s.name || "")}
        ${field("开始（YYYY-MM-DD / ISO UTC）", "starts_at", s.starts_at || "")}
        ${field("结束", "ends_at", s.ends_at || "")}
        ${field("截止", "deadline_at", s.deadline_at || "")}
        ${select("时间状态", "time_status", s.time_status || "unknown", [
          ["confirmed", "已确认"], ["tentative", "暂定"], ["unknown", "待定"],
        ])}
        ${select("形式", "mode", s.mode || "unknown", [
          ["online", "线上"], ["offline", "线下"], ["hybrid", "混合"], ["unknown", "未知"],
        ])}
        ${field("地点", "location", s.location || "")}
        ${textarea("备注", "note", s.note || "")}
      </div>
      <div class="stage-actions">
        ${s.id ? `<button class="danger-btn" data-action="delete-stage" data-id="${s.id}" type="button">删除阶段</button>` : ""}
        <button class="secondary-btn" data-action="save-stage" type="button">${s.id ? "保存阶段" : "创建阶段"}</button>
      </div>
    </div>`;
  }

  function renderEditor(edition) {
    const e = edition || {};
    const isNew = !e.id;
    $("#editorTitle").textContent = isNew ? "新建赛事" : `编辑 #${e.id}`;
    const directions = (e.tags?.direction || []).join(", ");
    const formats = (e.tags?.format || []).join(", ");
    $("#editorBody").innerHTML = `
      <form id="editionForm" data-id="${e.id || ""}">
        <div class="form-grid">
          <div class="field full"><label>标题</label><input type="text" data-field="title" value="${attr(e.title || "")}" required /></div>
          ${field("主办方", "organizer", e.organizer || "")}
          ${field("系列 ID（可空）", "series_id", e.series_id || "", "number")}
          ${field("年份", "year", e.year || new Date().getFullYear(), "number")}
          ${select("地区", "region", e.region || "cn", [["cn", "国内"], ["intl", "国外"]])}
          ${select("类别", "category", e.category || "other", [
            ["ctf", "CTF"], ["hackathon", "黑客松"], ["datamodel", "数据竞赛"],
            ["mathmodel", "数学建模"], ["academic", "学科竞赛"], ["other", "其他"],
          ])}
          ${select("方向", "field", e.field || "other", FIELD_OPTIONS)}
          ${select("内容类型", "content_type", e.content_type || "competition", CONTENT_OPTIONS)}
          ${select("工信部关系", "recognition", e.recognition || "", RECOGNITION_OPTIONS)}
          ${select("生命周期", "lifecycle", e.lifecycle || "normal", [
            ["normal", "正常"], ["postponed", "延期"], ["cancelled", "取消"], ["finished", "结束"],
          ])}
          ${select("公开状态", "publish_state", e.publish_state || "draft", [
            ["draft", "草稿"], ["pending", "待审核"], ["published", "已发布"], ["archived", "已归档"],
          ])}
          ${select("日期置信度", "date_confidence", e.date_confidence || "unknown", [
            ["confirmed", "官方 / 已确认"], ["estimated", "预计"], ["unknown", "待核对"],
          ])}
          ${field("来源", "source", e.source || "manual")}
          ${field("报名链接", "signup_url", e.signup_url || "")}
          ${field("原文链接", "source_url", e.source_url || "")}
          ${field("工信部说明", "recognition_note", e.recognition_note || "")}
          ${field("工信部依据链接", "recognition_source", e.recognition_source || "")}
          ${field("队伍人数下限", "team_size_min", e.team_size_min || "", "number")}
          ${field("队伍人数上限", "team_size_max", e.team_size_max || "", "number")}
          ${field("难度 1-5", "difficulty", e.difficulty || "", "number")}
          ${field("费用", "fee", e.fee || "")}
          ${field("奖项", "prizes", e.prizes || "")}
          ${field("方向标签（逗号分隔）", "directions", directions)}
          ${field("赛制标签（逗号分隔）", "formats", formats)}
          ${textarea("资格要求", "eligibility", e.eligibility || "")}
          ${textarea("简介", "description", e.description || "")}
        </div>
      </form>
      <div class="form-section">
        <div class="card-head"><h3>阶段</h3><button class="secondary-btn" data-action="add-stage" type="button">+ 添加阶段</button></div>
        <div id="stageList">${(e.stages || []).map(stageEditor).join("")}</div>
      </div>
      <div class="editor-footer">
        ${isNew ? "" : `<button class="danger-btn" data-action="archive" data-id="${e.id}" type="button">归档</button>`}
        <button class="secondary-btn" data-action="close-editor" type="button">关闭</button>
        <button class="primary-btn" data-action="save-edition" type="button">${isNew ? "创建赛事" : "保存赛事"}</button>
      </div>
    `;
    $("#editorOverlay").classList.remove("hidden");
  }

  async function openEditor(id) {
    try {
      const edition = id ? await api(`/editions/${id}`) : null;
      state.selected = edition;
      renderEditor(edition);
    } catch (err) {
      alert(err.message);
    }
  }

  function closeEditor() {
    $("#editorOverlay").classList.add("hidden");
    state.selected = null;
  }

  function readField(root, name) {
    return root.querySelector(`[data-field="${name}"]`)?.value ?? "";
  }

  function editionPayload() {
    const form = $("#editionForm");
    const dirs = readField(form, "directions").split(/[,，]/).map((x) => x.trim()).filter(Boolean);
    const formats = readField(form, "formats").split(/[,，]/).map((x) => x.trim()).filter(Boolean);
    const body = {
      title: readField(form, "title").trim(),
      organizer: readField(form, "organizer") || null,
      description: readField(form, "description") || null,
      series_id: readField(form, "series_id") ? Number(readField(form, "series_id")) : null,
      year: readField(form, "year") ? Number(readField(form, "year")) : null,
      region: readField(form, "region"),
      category: readField(form, "category"),
      field: readField(form, "field"),
      content_type: readField(form, "content_type"),
      recognition: readField(form, "recognition") || null,
      recognition_note: readField(form, "recognition_note") || null,
      recognition_source: readField(form, "recognition_source") || null,
      lifecycle: readField(form, "lifecycle"),
      publish_state: readField(form, "publish_state"),
      date_confidence: readField(form, "date_confidence"),
      source: readField(form, "source") || "manual",
      signup_url: readField(form, "signup_url") || null,
      source_url: readField(form, "source_url") || null,
      team_size_min: readField(form, "team_size_min") ? Number(readField(form, "team_size_min")) : null,
      team_size_max: readField(form, "team_size_max") ? Number(readField(form, "team_size_max")) : null,
      difficulty: readField(form, "difficulty") ? Number(readField(form, "difficulty")) : null,
      fee: readField(form, "fee") || null,
      prizes: readField(form, "prizes") || null,
      eligibility: readField(form, "eligibility") || null,
      tags: [
        ...dirs.map((name) => ({ kind: "direction", name })),
        ...formats.map((name) => ({ kind: "format", name })),
      ],
    };
    if (state.selected?.id) body.verified_at = new Date().toISOString();
    return body;
  }

  async function saveEdition() {
    const id = $("#editionForm").dataset.id;
    const body = editionPayload();
    if (!body.title) {
      alert("标题不能为空");
      return;
    }
    try {
      if (id) await api(`/editions/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      else await api("/editions", { method: "POST", body: JSON.stringify(body) });
      closeEditor();
      await loadEditions();
      await loadOverview();
    } catch (err) {
      alert(err.message);
    }
  }

  async function saveStage(button) {
    const holder = button.closest(".stage-editor");
    const stageId = holder.dataset.stageId;
    const editionId = $("#editionForm").dataset.id;
    const body = {
      kind: readField(holder, "kind"),
      name: readField(holder, "name") || "阶段",
      starts_at: readField(holder, "starts_at") || null,
      ends_at: readField(holder, "ends_at") || null,
      deadline_at: readField(holder, "deadline_at") || null,
      time_status: readField(holder, "time_status"),
      mode: readField(holder, "mode"),
      location: readField(holder, "location") || null,
      note: readField(holder, "note") || null,
      is_all_day: /^\d{4}-\d{2}-\d{2}$/.test(readField(holder, "starts_at") || readField(holder, "deadline_at") || ""),
    };
    try {
      if (stageId) await api(`/stages/${stageId}`, { method: "PATCH", body: JSON.stringify(body) });
      else if (editionId) await api(`/editions/${editionId}/stages`, { method: "POST", body: JSON.stringify(body) });
      else {
        alert("请先保存赛事，再添加阶段");
        return;
      }
      await openEditor(editionId);
      await loadEditions();
    } catch (err) {
      alert(err.message);
    }
  }

  async function deleteStage(button) {
    if (!confirm("确认删除这个阶段？")) return;
    try {
      await api(`/stages/${button.dataset.id}`, { method: "DELETE" });
      await openEditor($("#editionForm").dataset.id);
      await loadEditions();
    } catch (err) {
      alert(err.message);
    }
  }

  function bindEvents() {
    $("#loginForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const token = $("#tokenInput").value.trim();
      if (!token) return;
      state.token = token;
      sessionStorage.setItem("cr.admin.token", token);
      try {
        await api("/overview");
        enterAdmin();
      } catch (err) {
        sessionStorage.removeItem("cr.admin.token");
        state.token = "";
        showLogin(err.message);
      }
    });
    $("#logoutBtn").addEventListener("click", logout);
    $("#commentReload")?.addEventListener("click", () => loadComments().catch((e) => setMessage(e.message, true)));
    $("#commentState")?.addEventListener("change", () => loadComments().catch((e) => setMessage(e.message, true)));
    $("#commentAdminList")?.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-comment-action]");
      if (!button) return;
      try {
        await api(`/comments/${button.dataset.id}/${button.dataset.commentAction}`, { method: "POST" });
        await loadComments();
      } catch (err) { alert(err.message); }
    });
    $("#submissionReload")?.addEventListener("click", () => loadSubmissions().catch((e) => setMessage(e.message, true)));
    $("#submissionState")?.addEventListener("change", () => loadSubmissions().catch((e) => setMessage(e.message, true)));
    $("#submissionList")?.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-sub-action]");
      if (!button) return;
      const id = Number(button.dataset.id);
      const action = button.dataset.subAction;
      if (action === "accept") {
        if (!confirm("采用后会创建一个草稿赛事，确定继续？")) return;
        try {
          const result = await api(`/submissions/${id}/accept`, { method: "POST" });
          alert(`已创建草稿赛事 #${result.edition.id}，请到赛事库补充日期。`);
          await loadSubmissions();
          await loadOverview();
        } catch (err) { alert(err.message); }
      } else if (action === "reject") {
        const reason = prompt("拒绝原因（会显示给投稿者）：", "信息不足，暂不收录");
        if (reason === null) return;
        try {
          await api(`/submissions/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) });
          await loadSubmissions();
          await loadOverview();
        } catch (err) { alert(err.message); }
      }
    });
    document.querySelectorAll(".admin-tab").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });
    $("#pendingReload").addEventListener("click", () => loadPending().catch((e) => alert(e.message)));
    $("#pendingSource").addEventListener("change", () => loadPending().catch((e) => alert(e.message)));
    $("#acceptSourceBtn").addEventListener("click", async () => {
      const source = $("#pendingSource").value;
      const count = state.pending.length;
      if (!source || source === "all" || !count) return;
      if (!confirm(`确认采纳来源「${source}」的 ${count} 条待审核记录？没有匹配到已有届次的新赛事会立即公开。`)) return;
      const btn = $("#acceptSourceBtn");
      btn.disabled = true;
      try {
        const result = await api("/ingest/accept-source", { method: "POST", body: JSON.stringify({ source }) });
        await loadPending();
        await loadOverview();
        alert(`已采纳 ${result.accepted} 条${result.failed ? `，失败 ${result.failed} 条` : ""}。`);
      } catch (err) {
        alert(err.message);
      } finally {
        btn.disabled = false;
      }
    });
    $("#acceptExactBtn").addEventListener("click", async () => {
      if (!confirm("把所有能匹配到已有届次的待审核记录合并进去？不会新建重复赛事。")) return;
      const btn = $("#acceptExactBtn");
      btn.disabled = true;
      try {
        const result = await api("/ingest/accept-exact", { method: "POST" });
        await loadPending();
        await loadOverview();
        alert(`已合并 ${result.accepted} 条${result.failed ? `，失败 ${result.failed} 条` : ""}。`);
      } catch (err) {
        alert(err.message);
      } finally {
        btn.disabled = false;
      }
    });
    $("#sourceReload").addEventListener("click", () => loadSources().catch((e) => alert(e.message)));
    $("#auditReload").addEventListener("click", () => loadAudit().catch((e) => alert(e.message)));
    $("#taxonomyReload").addEventListener("click", () => loadTaxonomy().catch((e) => alert(e.message)));
    $("#seriesReset").addEventListener("click", resetSeriesForm);
    $("#seriesForm").addEventListener("submit", (event) => {
      event.preventDefault();
      saveSeries().catch((e) => alert(e.message));
    });
    $("#tagForm").addEventListener("submit", (event) => {
      event.preventDefault();
      addTag().catch((e) => alert(e.message));
    });
    $("#seriesList").addEventListener("click", (event) => {
      const btn = event.target.closest("[data-series-action]");
      if (!btn) return;
      if (btn.dataset.seriesAction === "edit") editSeries(btn.dataset.id);
      if (btn.dataset.seriesAction === "delete") deleteSeries(btn.dataset.id).catch((e) => alert(e.message));
    });
    $("#tagList").addEventListener("click", (event) => {
      const btn = event.target.closest("[data-tag-delete]");
      if (btn) deleteTag(btn.dataset.tagDelete).catch((e) => alert(e.message));
    });
    $("#newEditionBtn").addEventListener("click", () => openEditor(null));
    $("#editionSearch").addEventListener("input", () => {
      clearTimeout(window.__crSearchTimer);
      window.__crSearchTimer = setTimeout(() => loadEditions().catch((e) => setMessage(e.message, true)), 250);
    });
    $("#refreshBtn").addEventListener("click", async () => {
      const btn = $("#refreshBtn");
      btn.disabled = true;
      setMessage("正在采集，可能需要 1–2 分钟…");
      try {
        await api("/refresh", { method: "POST" });
        setMessage("采集完成，待审核区已更新。");
        await loadOverview();
      } catch (err) {
        setMessage(err.message, true);
      } finally {
        btn.disabled = false;
      }
    });
    $("#backupBtn").addEventListener("click", async () => {
      const btn = $("#backupBtn");
      btn.disabled = true;
      try {
        const result = await api("/backup", { method: "POST" });
        setMessage(`备份完成：${result.file}（${Math.round((result.size || 0) / 1024)} KB）`);
      } catch (err) {
        setMessage(err.message, true);
      } finally {
        btn.disabled = false;
      }
    });

    $("#pendingList").addEventListener("click", async (event) => {
      const btn = event.target.closest("[data-action]");
      if (!btn) return;
      const id = Number(btn.dataset.id);
      btn.disabled = true;
      try {
        if (btn.dataset.action === "accept") await accept(id);
        if (btn.dataset.action === "merge") await promptMerge(id);
        if (btn.dataset.action === "reject") await reject(id);
      } catch (err) {
        alert(err.message);
      } finally {
        btn.disabled = false;
      }
    });

    $("#editionRows").addEventListener("click", (event) => {
      const btn = event.target.closest('[data-action="edit"]');
      if (btn) openEditor(Number(btn.dataset.id));
    });

    $("#editorClose").addEventListener("click", closeEditor);
    $("#editorOverlay").addEventListener("click", (event) => {
      if (event.target === $("#editorOverlay")) closeEditor();
    });

    $("#editorBody").addEventListener("click", async (event) => {
      const btn = event.target.closest("[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;
      try {
        if (action === "close-editor") closeEditor();
        if (action === "save-edition") await saveEdition();
        if (action === "save-stage") await saveStage(btn);
        if (action === "delete-stage") await deleteStage(btn);
        if (action === "add-stage") {
          $("#stageList").insertAdjacentHTML("beforeend", stageEditor({}));
        }
        if (action === "archive") {
          if (!confirm("确认归档该赛事？归档后不会出现在公开列表。")) return;
          await api(`/editions/${btn.dataset.id}`, { method: "DELETE" });
          closeEditor();
          await loadEditions();
          await loadOverview();
        }
      } catch (err) {
        alert(err.message);
      }
    });

    $("#editorBody").addEventListener("submit", (event) => {
      if (event.target.id !== "editionForm") return;
      event.preventDefault();
      saveEdition();
    });
  }

  bindEvents();
  if (state.token) {
    enterAdmin();
  } else {
    showLogin("");
  }
})();
