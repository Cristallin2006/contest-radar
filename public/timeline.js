(() => {
  "use strict";

  const DAY = 86_400_000;
  const RANGE_DAYS = 21;
  const DEFAULT_LIMIT = 24;
  const CATEGORY_LABELS = {
    ctf: "CTF",
    hackathon: "黑客松",
    datamodel: "数据竞赛",
    mathmodel: "数模",
    academic: "学科竞赛",
    other: "其他",
  };
  const REGION_LABELS = { cn: "国内", intl: "国际" };
  const CATEGORIES = ["全部", "CTF", "黑客松", "数据竞赛", "数模", "学科竞赛", "其他"];
  const BUCKETS = ["deadline", "qualifying", "final"];
  const BUCKET_LABELS = ["报名截止", "初赛/比赛", "决赛"];
  const SYMBOLS = ["deadline", "qualifying", "final"];
  const STORAGE_KEY = "cr.favorites";

  const $ = (id) => document.getElementById(id);
  const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#icon-${name}"/></svg>`;
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

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
  const rangeStart = new Date(`${today}T00:00:00+08:00`).getTime() - 3 * DAY;

  const state = {
    region: "cn",
    category: "全部",
    query: "",
    savedOnly: false,
    day: 3,
    stageKey: null,
    limit: DEFAULT_LIMIT,
    visible: [],
    total: 0,
  };

  let allEvents = [];
  const eventById = new Map();
  let favorites = loadFavorites();

  function loadFavorites() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return new Set(Array.isArray(raw) ? raw.map(String) : []);
    } catch { return new Set(); }
  }

  function saveFavorites() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...favorites])); } catch { /* ignore */ }
  }

  function shanghaiDate(value) {
    return new Date(value).toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
  }

  function parseDate(value) {
    if (!value) return null;
    const text = String(value);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(text)
      ? new Date(`${text}T00:00:00+08:00`)
      : new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function dayOffset(value) {
    const date = parseDate(value);
    if (!date) return null;
    const start = new Date(`${shanghaiDate(date)}T00:00:00+08:00`).getTime();
    return Math.round((start - rangeStart) / DAY);
  }

  function formatDate(day) {
    const text = shanghaiDate(rangeStart + day * DAY);
    return text.slice(5).replace("-", ".");
  }

  function weekday(day) {
    return new Date(rangeStart + day * DAY).toLocaleDateString("zh-CN", {
      weekday: "short",
      timeZone: "Asia/Shanghai",
    });
  }

  function timeInfo(value, deadline) {
    if (!value) return { text: "待定", sort: 9999, dateOnly: true };
    const text = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      return deadline
        ? { text: "23:59", sort: 1439, dateOnly: true }
        : { text: "全天", sort: 0, dateOnly: true };
    }
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return { text: "待定", sort: 9999, dateOnly: true };
    const time = date.toLocaleTimeString("zh-CN", {
      hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Shanghai",
    });
    const [h, m] = time.split(":").map(Number);
    return { text: time, sort: h * 60 + m, dateOnly: false };
  }

  function displayDate(value) {
    const date = parseDate(value);
    if (!date) return "待定";
    return shanghaiDate(date).slice(5).replace("-", ".");
  }

  function displayRange(stage) {
    if (stage.starts_at && stage.ends_at && String(stage.starts_at).slice(0, 10) !== String(stage.ends_at).slice(0, 10)) {
      return `${displayDate(stage.starts_at)} – ${displayDate(stage.ends_at)}`;
    }
    return displayDate(stage.deadline_at || stage.starts_at || stage.ends_at);
  }

  function bucketOf(stage) {
    if (["registration", "submission"].includes(stage.kind)) return 0;
    if (stage.kind === "final") return 2;
    return 1;
  }

  function buildStage(event, stage, index) {
    const raw = stage.deadline_at || stage.starts_at || stage.ends_at;
    if (!raw) return null;
    const day = dayOffset(raw);
    if (day == null) return null;
    const deadline = Boolean(stage.deadline_at);
    const time = timeInfo(deadline ? stage.deadline_at : (stage.starts_at || stage.ends_at), deadline);
    return {
      key: `${event.id}-s${index}`,
      day,
      bucket: bucketOf(stage),
      label: stage.name || BUCKET_LABELS[bucketOf(stage)],
      time: time.text,
      sort: time.sort,
      estimated: stage.time_status !== "confirmed",
      dateText: displayRange(stage),
      stage,
    };
  }

  function buildEvent(raw) {
    const stages = Array.isArray(raw.stages) ? raw.stages : [];
    const detailStages = stages
      .map((stage, index) => buildStage(raw, stage, index))
      .filter(Boolean)
      .sort((a, b) => a.day - b.day || a.sort - b.sort);
    if (!detailStages.some((stage) => stage.day >= 0 && stage.day < RANGE_DAYS)) return null;

    const buckets = [null, null, null];
    for (const stage of detailStages) {
      if (stage.day < 0 || stage.day >= RANGE_DAYS) continue;
      const current = buckets[stage.bucket];
      if (!current || stage.day < current.day || (stage.day === current.day && stage.sort < current.sort)) {
        buckets[stage.bucket] = stage;
      }
    }
    if (!buckets.some(Boolean)) return null;

    return {
      id: String(raw.id),
      region: raw.region === "intl" ? "intl" : "cn",
      title: raw.title,
      category: CATEGORY_LABELS[raw.category] || "其他",
      organizer: raw.organizer || raw.series_name || "",
      series: raw.series_name || "",
      url: raw.signup_url || raw.source_url || "",
      sourceUrl: raw.source_url || "",
      source: raw.source_name || raw.source || "",
      verified: raw.verified_at || raw.last_checked || "",
      eligibility: raw.eligibility || "",
      stages: buckets,
      detailStages,
      firstDay: Math.min(...buckets.filter(Boolean).map((stage) => stage.day)),
      firstSort: Math.min(...buckets.filter(Boolean).map((stage) => stage.day * 1440 + stage.sort)),
    };
  }

  function filteredEvents() {
    return allEvents.filter((event) =>
      event.region === state.region &&
      (state.category === "全部" || event.category === state.category) &&
      (!state.savedOnly || favorites.has(event.id)) &&
      `${event.title} ${event.category} ${event.organizer} ${event.series}`.toLowerCase().includes(state.query)
    );
  }

  function stagesFor(events, day) {
    return events
      .flatMap((event) => event.stages
        .filter((stage) => stage && stage.day === day)
        .map((stage) => ({ event, stage })))
      .sort((a, b) => a.stage.sort - b.stage.sort);
  }

  function position(day) {
    return `${((day + 0.5) / RANGE_DAYS) * 100}%`;
  }

  function updateBookmarkButtons() {
    for (const [toggleId, countId] of [["saved-toggle", "saved-count"], ["saved-toggle-top", "saved-count-top"]]) {
      const toggle = $(toggleId);
      const count = $(countId);
      if (!toggle) continue;
      toggle.setAttribute("aria-pressed", String(state.savedOnly));
      if (count) {
        count.textContent = String(favorites.size);
        count.hidden = favorites.size === 0;
      }
    }
  }

  function updateTrackSelection(active) {
    $("map").style.setProperty("--selected-day", state.day);
    document.querySelectorAll("#date-axis [data-day]").forEach((button) => {
      button.setAttribute("aria-pressed", String(Number(button.dataset.day) === state.day));
    });
    document.querySelectorAll("#map [data-track]").forEach((row) => {
      row.classList.toggle("is-selected", row.dataset.track === active?.event.id);
    });
    document.querySelectorAll("#map [data-event]").forEach((button) => {
      const isStop = button.dataset.stopDay !== undefined;
      button.classList.toggle("is-day", isStop && Number(button.dataset.stopDay) === state.day);
      const selected = isStop
        ? `${button.dataset.event}-${button.dataset.stage}` === state.stageKey
        : button.dataset.event === active?.event.id;
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  function renderAxis(events) {
    const daily = Array.from({ length: RANGE_DAYS }, (_, day) => stagesFor(events, day).length);
    const ticks = daily.map((count, day) => {
      const major = day % 3 === 0;
      const mobile = day % 6 === 0;
      return `<button type="button" class="date-tick${major ? " major" : ""}${mobile ? " mobile-tick" : ""}${day === RANGE_DAYS - 1 ? " last-tick" : ""}" style="--day-x:${position(day)}" data-day="${day}" aria-label="${formatDate(day)}，${count} 个赛程节点" aria-pressed="false">${major ? `<span>${formatDate(day)}</span>` : ""}</button>`;
    }).join("");

    let prior = -3;
    let lower = false;
    const crowded = daily.map((count, day) => {
      if (count < 2) return "";
      lower = day - prior <= 2 && !lower;
      prior = day;
      const label = `${formatDate(day)} · ${count} 个赛程节点`;
      return `<button type="button" class="crowd${lower ? " lower" : ""}" style="--day-x:${position(day)}" data-day="${day}" aria-pressed="false" aria-label="${label}" title="${label}"><span aria-hidden="true">${count}</span></button>`;
    }).join("");
    $("date-axis").innerHTML = ticks + crowded;
  }

  function renderTracks(events) {
    $("tracks").innerHTML = events.map((event) => {
      const stages = event.stages.filter(Boolean);
      const rails = stages.slice(0, -1).map((from, index) => {
        const to = stages[index + 1];
        return `<span class="rail${from.estimated || to.estimated ? " estimated" : ""}" aria-hidden="true" style="--start:${position(from.day)};--span:${((to.day - from.day) / RANGE_DAYS) * 100}%"></span>`;
      }).join("");
      const last = stages[stages.length - 1];
      const pending = stages.length < 3;
      const stub = pending
        ? `<span class="rail pending" aria-hidden="true" style="--start:${position(last.day)};--span:${(Math.min(2.5, RANGE_DAYS - last.day - 0.5) / RANGE_DAYS) * 100}%"></span>`
        : "";
      const stops = stages.map((stage) => {
        const label = `${event.title} · ${stage.label} · ${formatDate(stage.day)} ${stage.time} · ${stage.estimated ? "预计" : "官方"}`;
        return `<button type="button" class="stop" style="--day-x:${position(stage.day)}" data-event="${esc(event.id)}" data-stage="${stage.bucket}" data-stop-day="${stage.day}" aria-pressed="false" aria-label="${esc(label)}" title="${esc(label)}">${icon(SYMBOLS[stage.bucket])}</button>`;
      }).join("");
      return `<div class="track-label" data-track="${esc(event.id)}"><button type="button" data-event="${esc(event.id)}" data-stage="0" aria-pressed="false">${esc(event.title)}<small>${esc(event.category)}${pending ? " · 后续待公布" : ""}</small></button></div><div class="track" data-track="${esc(event.id)}">${rails}${stub}${stops}</div>`;
    }).join("") || `<div class="empty-map"><strong>${state.savedOnly ? "当前筛选下没有收藏赛事" : "没有匹配的赛事"}</strong><p>${state.savedOnly ? "可切换地区或回到全部赛事。" : "试试其他关键词、地区或类别。"}</p></div>`;
  }

  function renderMobileList(events) {
    const list = $("mobile-list");
    if (!list) return;
    list.innerHTML = events.map((event) => {
      const stage = event.stages.find(Boolean);
      if (!stage) return "";
      return `<button type="button" class="mobile-row" data-event="${esc(event.id)}" data-stage="${stage.bucket}">
        <span><span class="m-name">${esc(event.title)}</span><span class="m-meta">${esc(event.category)} · ${esc(stage.label)}</span></span>
        <span class="m-deadline">${formatDate(stage.day)} ${esc(stage.time)}<small>${stage.estimated ? "预计" : "官方"}</small></span>
      </button>`;
    }).join("") || `<div class="empty-map"><strong>没有匹配的赛事</strong><p>试试其他关键词、地区或类别。</p></div>`;
  }

  function renderDetails(active) {
    const detail = $("detail");
    detail.hidden = !active;
    if (!active) return;
    const { event, stage } = active;
    $("detail-title").textContent = event.title;
    const bookmark = $("bookmark");
    bookmark.dataset.bookmark = event.id;
    const saved = favorites.has(event.id);
    bookmark.setAttribute("aria-pressed", String(saved));
    bookmark.setAttribute("aria-label", saved ? "取消收藏赛事" : "收藏赛事");
    bookmark.innerHTML = icon(saved ? "saved" : "bookmark");
    $("steps").innerHTML = event.detailStages.map((item) => `<li class="${item.key === stage.key ? "is-active" : ""}">${icon(SYMBOLS[item.bucket])}<span>${esc(item.label)}</span><time>${esc(item.dateText)}${item.time !== "全天" ? ` ${esc(item.time)}` : ""}${item.estimated ? " · 预计" : ""}</time></li>`).join("");
    $("detail-note").innerHTML = [event.organizer, event.source, event.verified ? `核实于 ${esc(String(event.verified).slice(0, 10))}` : ""].filter(Boolean).map(esc).join(" · ");
    const links = [];
    const official = safeUrl(event.url);
    if (official) links.push(`<a href="${esc(official)}" target="_blank" rel="noreferrer">打开官网</a>`);
    const source = safeUrl(event.sourceUrl);
    if (source && source !== official) links.push(`<a href="${esc(source)}" target="_blank" rel="noreferrer">查看来源</a>`);
    $("detail-links").innerHTML = links.join("");
  }

  function setDay(day, stageKey = null, allowMotion = true) {
    if (day < 0 || day >= RANGE_DAYS) return;
    state.day = day;
    const list = stagesFor(state.visible, day);
    const active = list.find((item) => item.stage.key === stageKey) || list[0] || null;
    state.stageKey = active?.stage.key || null;
    updateTrackSelection(active);
    $("previous").disabled = day === 0;
    $("next").disabled = day === RANGE_DAYS - 1;
    const dayHeading = $("day-heading");
    const dayItems = $("day-items");
    dayHeading.innerHTML = `<time datetime="${shanghaiDate(rangeStart + day * DAY)}">${formatDate(day)}</time><p><strong>${weekday(day)}</strong>${list.length} 个赛程节点</p>`;
    dayItems.innerHTML = list.map(({ event, stage }) => `<li><button type="button" data-event="${esc(event.id)}" data-stage="${stage.bucket}" aria-pressed="false">${icon(SYMBOLS[stage.bucket])}<span class="day-item-name">${esc(event.title)}</span><time class="day-item-time">${esc(stage.time)}</time><span class="day-item-meta">${esc(stage.label)} · ${stage.estimated ? "预计" : "官方"}</span></button></li>`).join("");
    dayItems.hidden = list.length === 0;
    $("day-empty").hidden = list.length !== 0;
    dayItems.querySelectorAll("[data-event]").forEach((button) => {
      button.setAttribute("aria-pressed", String(`${button.dataset.event}-${button.dataset.stage}` === state.stageKey));
    });
    renderDetails(active);
    if (!allowMotion) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    $("day-content").animate(
      [{ opacity: 0.66, transform: "translateY(4px)" }, { opacity: 1, transform: "translateY(0)" }],
      { duration: 140, easing: "cubic-bezier(.2,.75,.22,1)" },
    );
  }

  function ensureActiveDay() {
    const activeDays = [];
    for (let day = 0; day < RANGE_DAYS; day += 1) {
      if (stagesFor(state.visible, day).length) activeDays.push(day);
    }
    if (!activeDays.length) return;
    if (!activeDays.includes(state.day)) {
      activeDays.sort((a, b) => Math.abs(a - state.day) - Math.abs(b - state.day));
      state.day = activeDays[0];
    }
  }

  function renderView() {
    const filtered = filteredEvents();
    state.total = filtered.length;
    state.visible = filtered.slice(0, state.limit);
    ensureActiveDay();
    document.querySelectorAll("[data-region]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.region === state.region));
    });
    document.querySelectorAll("[data-category]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.category === state.category));
    });
    $("range-label").textContent = `${formatDate(0)} — ${formatDate(RANGE_DAYS - 1)}`;
    $("result-count").textContent = `${REGION_LABELS[state.region]} · ${state.visible.length}${state.visible.length < state.total ? ` / ${state.total}` : ""} 场${state.savedOnly ? "收藏赛事" : "赛事"}`;
    updateBookmarkButtons();
    renderAxis(state.visible);
    renderTracks(state.visible);
    renderMobileList(state.visible);
    $("map-caption-text").textContent = state.visible.length < state.total
      ? `显示前 ${state.visible.length} 场（共 ${state.total} 场），可用筛选或「显示更多」。`
      : "日历轴上的数字表示同一天有多个赛程节点。";
    $("load-more").hidden = state.visible.length >= state.total;
    setDay(state.day, state.stageKey, false);
  }

  function resetView(resetLimit = true) {
    if (resetLimit) state.limit = DEFAULT_LIMIT;
    state.stageKey = null;
    state.day = 3;
    renderView();
  }

  function bind() {
    $("categories").innerHTML = CATEGORIES.map((category) => `<button type="button" data-category="${esc(category)}" aria-pressed="false">${esc(category)}</button>`).join("");
    document.querySelector(".filters").addEventListener("click", (event) => {
      const button = event.target.closest("[data-region],[data-category]");
      if (!button) return;
      if (button.dataset.region) {
        state.region = button.dataset.region;
        state.category = "全部";
      } else {
        state.category = button.dataset.category;
      }
      resetView();
    });
    $("search").addEventListener("input", (event) => {
      state.query = event.target.value.trim().toLowerCase();
      resetView();
    });
    for (const id of ["saved-toggle", "saved-toggle-top"]) {
      $(id)?.addEventListener("click", () => {
        state.savedOnly = !state.savedOnly;
        resetView(false);
      });
    }
    $("previous").addEventListener("click", () => setDay(state.day - 1, state.stageKey));
    $("next").addEventListener("click", () => setDay(state.day + 1, state.stageKey));
    $("load-more").addEventListener("click", () => {
      state.limit += DEFAULT_LIMIT;
      renderView();
    });
    $("map").addEventListener("click", (event) => {
      const dayButton = event.target.closest("[data-day]");
      if (dayButton) {
        setDay(Number(dayButton.dataset.day));
        return;
      }
      const button = event.target.closest("[data-event][data-stage]");
      if (!button) return;
      const item = eventById.get(button.dataset.event);
      const stage = item?.stages[Number(button.dataset.stage)];
      if (stage) setDay(stage.day, stage.key);
    });
    $("mobile-list").addEventListener("click", (event) => {
      const button = event.target.closest("[data-event][data-stage]");
      if (!button) return;
      const item = eventById.get(button.dataset.event);
      const stage = item?.stages[Number(button.dataset.stage)];
      if (!stage) return;
      setDay(stage.day, stage.key);
      document.querySelector(".day-sheet")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    $("day-items").addEventListener("click", (event) => {
      const button = event.target.closest("[data-event][data-stage]");
      if (!button) return;
      const item = eventById.get(button.dataset.event);
      const stage = item?.stages[Number(button.dataset.stage)];
      if (stage) setDay(stage.day, stage.key);
    });
    $("map").addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      setDay(state.day + (event.key === "ArrowRight" ? 1 : -1), state.stageKey);
    });
    $("bookmark").addEventListener("click", (event) => {
      const id = event.currentTarget.dataset.bookmark;
      if (!id) return;
      if (favorites.has(id)) favorites.delete(id);
      else favorites.add(id);
      saveFavorites();
      if (state.savedOnly) resetView(false);
      else {
        updateBookmarkButtons();
        setDay(state.day, state.stageKey, false);
      }
    });
  }

  async function fetchAllEditions() {
    const items = [];
    let page = 1;
    let pages = 1;
    do {
      const response = await fetch(`/api/v1/editions?include_unknown=1&all_dates=1&size=100&page=${page}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      items.push(...(data.items || []));
      pages = Number(data.pages || 1);
      page += 1;
    } while (page <= pages);
    return items;
  }

  async function init() {
    bind();
    try {
      const raw = await fetchAllEditions();
      allEvents = raw.map(buildEvent).filter(Boolean).sort((a, b) => a.firstSort - b.firstSort);
      for (const event of allEvents) eventById.set(event.id, event);
      renderView();
    } catch (error) {
      $("tracks").innerHTML = `<div class="timeline-loading">赛事加载失败：${esc(error.message || error)}</div>`;
      $("result-count").textContent = "加载失败";
    }
  }

  init();
})();
