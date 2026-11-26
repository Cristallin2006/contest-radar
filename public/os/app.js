(() => {
  const SAVED_KEY = "contestline.archos.saved.v1";
  const WALL_KEY = "contestline.archos.wallpaper.v1";
  const READ_KEY = "contestline.archos.read.v1";
  const WIDGET_KEY = "contestline.archos.upcoming.v1";
  const THEME_KEY = "contestline.archos.theme.v2";
  const PUSH_KEY = "contestline.archos.push.v1";
  const DEFAULT_WALL = "kali-net";
  const CONTEST_VIEW_KEY = "contestline.archos.contestview.v1";
  const ONBOARDING_KEY = "contestline.archos.onboarding.v1";
  const ONLINE_ORIGIN = "https://contest.07212006.xyz";
  const API_ENABLED = typeof location !== "undefined" && /^https?:$/.test(location.protocol) && (location.port === "8789" || !["localhost", "127.0.0.1"].includes(location.hostname));

  const THEMES = {
    wallhaven: {
      name: "Wallhaven / Omarchy",
      desktop: "#0b0924",
      note: "分岛栏 · 雾玫瑰焦点",
      palette: ["#1a1b26", "#f7768e", "#9ece6a", "#e0af68", "#7aa2f7", "#ad8ee6", "#449dab", "#a9b1d6"],
    },
    afterglow: {
      name: "Afterglow",
      desktop: "#202020",
      note: "中性灰 · 柔和 ANSI",
      palette: ["#151515", "#ac4142", "#7e8d50", "#e5b566", "#6c99ba", "#9e4e85", "#7dd5cf", "#d0d0d0"],
    },
    atelier: {
      name: "Atelier Sulphurpool",
      desktop: "#202745",
      note: "蓝紫灰 · 冷色 ANSI",
      palette: ["#202745", "#c84821", "#ab9639", "#c08a2f", "#3d8ed0", "#6678cc", "#21a1c8", "#969cb3"],
    },
  };

  const WALLPAPERS = [
    { id: "ridge", name: "山脊", cn: "山脊", category: "风景", file: "./wallpapers/ridge.svg", note: "深蓝山脊与细等高线。" },
    { id: "paper-grid", name: "网格纸", cn: "网格纸", category: "纸张", file: "./wallpapers/paper-grid.jpg?v=20261125b", note: "米白纸张上的细网格与纤维。适合白天把窗口摊开工作。" },
    { id: "kraft", name: "牛皮纸", cn: "牛皮纸", category: "纸张", file: "./wallpapers/kraft.jpg?v=20261125b", note: "档案袋的棕色纸面，带折痕和轻微污渍。" },
    { id: "newsprint", name: "旧报纸", cn: "旧报纸", category: "纸张", file: "./wallpapers/newsprint.jpg?v=20261125b", note: "旧报纸的灰纸和印刷网点。让桌面像一张摊开的版面。" },
    { id: "blueprint", name: "蓝图", cn: "蓝图", category: "工程", file: "./wallpapers/blueprint.jpg?v=20261125b", note: "工程蓝图的网格和框线，适合放赛事表和窗口。" },
    { id: "topographic", name: "地形图", cn: "地形图", category: "地图", file: "./wallpapers/topographic.jpg?v=20261125b", note: "纸上的等高线，像一张没有标注的地图。" },
    { id: "terminal-screen", name: "终端屏幕", cn: "终端屏幕", category: "屏幕", file: "./wallpapers/terminal-screen.jpg?v=20261125b", note: "低亮度磷光屏，带扫描线和一块光标。" },
    { id: "ethereal", name: "Ethereal", cn: "圣辉", category: "插画", file: "./wallpapers/ethereal.jpg?v=20261125c", note: "黑白人物与顶光。" },
    { id: "twilight", name: "Twilight", cn: "城市暮色", category: "插画", file: "./wallpapers/twilight.jpg?v=20261125c", note: "暮色城市与人物。" },
    { id: "kali-glitch", name: "Kali Glitch", cn: "Kali 故障", category: "Kali", file: "./wallpapers/kali-glitch.jpg?v=20261125c", note: "Kali 2026 官方壁纸。" },
    { id: "kali-hack", name: "Kali Hack", cn: "Kali 黑客", category: "Kali", file: "./wallpapers/kali-hack.jpg?v=20261125c", note: "Kali 2026 官方壁纸。" },
    { id: "kali-net", name: "Kali Net", cn: "Kali 网络", category: "Kali", file: "./wallpapers/kali-net.jpg?v=20261125c", note: "Kali 2026 官方壁纸；赛线 OS 的默认桌面。" },
  ];

  const FIT_CSS = {
    cover: { size: "cover", repeat: "no-repeat", position: "center" },
    contain: { size: "contain", repeat: "no-repeat", position: "center" },
    repeat: { size: "auto", repeat: "repeat", position: "left top" },
    center: { size: "auto", repeat: "no-repeat", position: "center" },
  };

  const APP_DEFS = {
    contests: { title: "赛事", path: "~/contests", glyph: "grid", width: 900, height: 610, x: 150, y: 58 },
    submit: {
      "文件": [["关闭", "close"]],
      "查看": [["赛事档案", "open:contests"], ["留言板", "open:board"], ["日程", "open:agenda"]],
      "帮助": [["关于", "about"]],
    },
    detail: { title: "赛事详情", path: "~/events", glyph: "window", width: 450, height: 570, x: 850, y: 86 },
    agenda: { title: "日程", path: "~/agenda", glyph: "agenda", width: 900, height: 640, x: 240, y: 70 },
    board: { title: "留言板", path: "~/board", glyph: "board", width: 700, height: 560, x: 190, y: 74 },
    submit: { title: "投稿", path: "~/submit", glyph: "submit", width: 780, height: 700, x: 220, y: 42 },
    push: { title: "推送", path: "~/notifications", glyph: "bell", width: 560, height: 520, x: 360, y: 100 },
    docs: { title: "文档", path: "~/docs", glyph: "docs", width: 840, height: 600, x: 210, y: 60 },
    terminal: { title: "终端", path: "guest@contestline", glyph: "terminal", width: 780, height: 500, x: 110, y: 70 },
    wallpaper: { title: "外观", path: "~/appearance", glyph: "wallpaper", width: 800, height: 600, x: 250, y: 70 },
  };

  const CATEGORIES = [
    { key: "all", label: "全部" },
    { key: "ctf", label: "CTF" },
    { key: "hackathon", label: "黑客松" },
    { key: "datamodel", label: "数据" },
    { key: "mathmodel", label: "数模" },
    { key: "academic", label: "学科" },
  ];
  const STATUS_OPTIONS = [
    ["all", "全部状态"], ["closing", "即将截止"], ["open", "报名中"], ["upcoming", "预告"],
    ["ongoing", "进行中"], ["unknown", "待定"], ["closed", "报名已截止"],
    ["ended", "已结束"], ["cancelled", "已取消"], ["postponed", "已延期"],
  ];
  const MODE_OPTIONS = [["all", "全部形式"], ["online", "线上"], ["offline", "线下"], ["hybrid", "混合"], ["unknown", "待定"]];
  const SORT_OPTIONS = [["smart", "智能排序"], ["date-asc", "日期升序"], ["date-desc", "日期降序"], ["title", "名称排序"]];
  const MODE_LABELS = { online: "线上", offline: "线下", hybrid: "混合", unknown: "待定" };
  const STAGE_KIND_LABELS = { registration: "报名", qualification: "资格", online: "线上", offline: "线下", final: "决赛", submission: "提交", other: "阶段" };

  const SUBMIT_CATEGORIES = [
    ["ctf", "CTF"],
    ["hackathon", "黑客松"],
    ["datamodel", "数据竞赛"],
    ["mathmodel", "数学建模"],
    ["academic", "学科竞赛"],
    ["other", "其他"],
  ];
  const SUBMIT_FIELDS = [
    ["", "不指定"],
    ["cyber", "网络安全 / CTF"],
    ["software", "计算机 / 软件 / AI"],
    ["data", "数据科学 / 统计"],
    ["math", "数学 / 建模"],
    ["electronics", "电子 / 电气 / 自动化 / 通信"],
    ["engineering", "机械 / 土木 / 结构 / 交通 / 能源"],
    ["science", "物理 / 化学 / 生物 / 医学 / 材料"],
    ["design", "设计 / 艺术 / 建筑 / 文创"],
    ["business", "商科 / 金融 / 管理 / 创业"],
    ["language", "外语 / 翻译 / 写作"],
    ["humanities", "文学 / 历史 / 法律 / 教育 / 社会"],
    ["sports", "体育 / 运动 / 电竞"],
    ["other", "公益 / 综合 / 待细分"],
  ];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const isMobileShell = () => window.innerWidth <= 760;
  const shellHomeButton = () => isMobileShell() ? $("[data-mobile-home]") : $("#rofiTrigger");
  const localDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  function authReturnTo(app) {
    const url = new URL(location.href);
    url.hash = "";
    url.searchParams.delete("event");
    url.searchParams.set("app", app);
    return `${url.pathname}${url.search}`;
  }

  function loadSaved() {
    try {
      const raw = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
      return new Set(Array.isArray(raw) ? raw.map(Number) : []);
    } catch { return new Set(); }
  }
  function loadWallpaper() {
    try {
      const raw = JSON.parse(localStorage.getItem(WALL_KEY) || "null");
      if (raw && WALLPAPERS.some((item) => item.id === raw.id)) return { id: raw.id, fit: FIT_CSS[raw.fit] ? raw.fit : "cover" };
    } catch { /* ignore */ }
    return { id: DEFAULT_WALL, fit: "cover" };
  }
  function loadTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved && THEMES[saved]) return saved;
    } catch { /* ignore */ }
    return "wallhaven";
  }
  function loadPush() {
    const defaults = { enabled: false, lead: 1, savedOnly: true };
    try {
      const saved = JSON.parse(localStorage.getItem(PUSH_KEY) || "null");
      if (!saved || typeof saved !== "object") return defaults;
      return {
        enabled: Boolean(saved.enabled),
        lead: [0, 1, 3].includes(Number(saved.lead)) ? Number(saved.lead) : 1,
        savedOnly: saved.savedOnly !== false,
      };
    } catch { return defaults; }
  }
  function saveSaved() {
    try { localStorage.setItem(SAVED_KEY, JSON.stringify([...state.saved])); } catch { /* ignore */ }
    schedulePushNotifications();
  }
  function saveWallpaper() {
    try { localStorage.setItem(WALL_KEY, JSON.stringify(state.wallpaper)); } catch { /* ignore */ }
  }

  function loadRead() {
    try {
      const raw = JSON.parse(localStorage.getItem(READ_KEY) || "[]");
      return new Set(Array.isArray(raw) ? raw.map(Number).filter(Number.isFinite) : []);
    } catch { return new Set(); }
  }

  function saveRead() {
    try { localStorage.setItem(READ_KEY, JSON.stringify([...state.read])); } catch { }
  }

  const state = {
    windows: {},
    active: null,
    z: 20,
    workspace: 1,
    tiled: false,
    region: "all",
    category: "all",
    status: "all",
    mode: "all",
    sort: "smart",
    savedOnly: false,
    q: "",
    selected: null,
    pendingEvent: null,
    pendingApp: null,
    contestView: (() => { try { return localStorage.getItem(CONTEST_VIEW_KEY) === "list" ? "list" : "table"; } catch { return "table"; } })(),
    saved: loadSaved(),
    read: loadRead(),
    wallpaper: loadWallpaper(),
    wallpaperSelected: null,
    theme: loadTheme(),
    comments: [],
    boardMe: null,
    boardLoading: false,
    boardPosting: false,
    boardError: "",
    boardMessage: "",
    boardDraft: "",
    submitMe: null,
    submitLoading: false,
    submitPosting: false,
    submitError: "",
    submitMessage: "",
    submitMine: [],
    agendaTab: "timeline",
    agendaMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    agendaSelectedDate: localDateKey(new Date()),
    online: null,
    docTab: "api",
    push: loadPush(),
    upcomingVisible: (() => { try { return localStorage.getItem(WIDGET_KEY) !== "0"; } catch { return true; } })(),
    terminalLines: [],
    terminalHistory: [],
    terminalHistoryIndex: 0,
    rofiOpen: false,
    rofiIndex: 0,
    rofiItems: [],
    onboardingOpen: false,
    onboardingAutomatic: false,
    onboardingSeen: (() => { try { return localStorage.getItem(ONBOARDING_KEY) === "seen"; } catch { return false; } })(),
  };

  state.wallpaperSelected = state.wallpaper.id;

  const PAPIRUS_ICONS = {
    close: "window-close",
    minus: "window-minimize",
    maximize: "window-maximize",
    restore: "window-restore",
    tile: "view-grid",
    grid: "system-file-manager",
    terminal: "utilities-terminal",
    board: "internet-chat",
    submit: "internet-mail",
    docs: "accessories-text-editor",
    calendar: "office-calendar",
    agenda: "office-calendar",
    wallpaper: "preferences-desktop-wallpaper",
    window: "system-file-manager",
    search: "system-search",
    command: "system-search",
    bell: "preferences-system-notifications",
    star: "non-starred",
    starred: "starred",
    "non-starred": "non-starred",
  };

  function icon(name) {
    if (PAPIRUS_ICONS[name]) return `<img class="icon papirus-icon" src="./assets/icons/${PAPIRUS_ICONS[name]}.svg" alt="" width="24" height="24">`;
    return `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  }

  function visibleWindowIds() {
    return Object.keys(state.windows).filter(id => state.windows[id].workspace === state.workspace && !state.windows[id].minimized).sort((a, b) => state.windows[a].z - state.windows[b].z);
  }

  function cleanTitle(value) {
    let text = String(value || "").trim();
    text = text.replace(/^【([^】]{1,36})】\s*/, (whole, inner) => /榜单|推荐|赛事|竞赛|大赛|挑战赛|开赛|开考|截止|报名/.test(inner) ? "" : whole);
    return text.trim() || "未命名赛事";
  }

  function cleanSummary(value) {
    let text = String(value || "").replace(/\s+/g, " ").trim();
    if (!text) return "";
    text = text.replace(/^【[^】]{1,40}】\s*/, "");
    const parts = text.split(/\s*[|｜]\s*/).map((part) => part.trim()).filter(Boolean);
    const useful = parts.find((part) => part.length >= 12 && !/^(主办单位|承办单位|协办单位|报名时间|比赛时间|赛事时间|官网|来源|高校学生竞赛网收录|收录)/.test(part));
    if (!useful) return "";
    const out = useful.replace(/^[：:，,、\s]+/, "").replace(/[。；;]\s*$/, "");
    if (!out || /主办单位|报名时间|高校学生竞赛网收录|收录|正在报名/.test(out)) return "";
    return out.length > 120 ? `${out.slice(0, 119)}…` : out;
  }

  function dateOf(item) {
    return item.next_deadline || item.registration_deadline || item.event_start || item.event_end || null;
  }

  function dateParts(value) {
    if (!value) return null;
    const iso = String(value).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    const stamp = new Date(`${iso}T00:00:00+08:00`);
    if (Number.isNaN(stamp.getTime())) return null;
    return {
      iso,
      short: `${iso.slice(5, 7)}.${iso.slice(8, 10)}`,
      weekday: stamp.toLocaleDateString("zh-CN", { weekday: "short", timeZone: "Asia/Shanghai" }),
      label: `${Number(iso.slice(5, 7))} 月 ${Number(iso.slice(8, 10))} 日`,
    };
  }

  function daysUntil(value) {
    if (!value) return null;
    const iso = String(value).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    const target = new Date(`${iso}T00:00:00+08:00`).getTime();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (Number.isNaN(target)) return null;
    return Math.round((target - today) / 86400000);
  }

  function dayText(days) {
    if (days === null) return "待定";
    if (days === 0) return "今天";
    if (days === 1) return "明天";
    if (days > 1) return `${days} 天后`;
    return `已过 ${-days} 天`;
  }

  function nodeLabel(item) {
    if (item.registration_deadline || item.next_deadline) return "报名截止";
    if (item.event_start) return "开赛";
    return "时间待定";
  }

  function eventFor(id) {
    return DEMO_EVENTS.find(item => item.id === Number(id)) || null;
  }

  function regionOf(item) {
    if (item.region) return item.region;
    return ["CTFtime", "Devpost", "COMAP / MCM-ICM"].includes(item.source_name) ? "intl" : "cn";
  }

  function eventTimestamp(item) {
    const date = dateOf(item);
    return date ? new Date(`${date.slice(0, 10)}T00:00:00+08:00`).getTime() : 9e15;
  }

  function filteredEvents() {
    const q = state.q.trim().toLowerCase();
    const statusRank = { closing: 0, open: 1, upcoming: 2, ongoing: 3, unknown: 4, closed: 5, ended: 6, cancelled: 7, postponed: 8 };
    return DEMO_EVENTS
      .filter(item => state.region === "all" || regionOf(item) === state.region)
      .filter((item) => state.category === "all" || item.category === state.category)
      .filter((item) => state.status === "all" || item.status === state.status)
      .filter((item) => state.mode === "all" || (item.mode || "unknown") === state.mode)
      .filter((item) => !state.savedOnly || state.saved.has(item.id))
      .filter((item) => {
        if (!q) return true;
        return [item.title, item.organizer, item.category_label, item.field_label, item.source_name].join(" ").toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (state.sort === "title") return String(a.title).localeCompare(String(b.title), "zh-CN");
        if (state.sort === "date-desc") return eventTimestamp(b) - eventTimestamp(a);
        if (state.sort === "date-asc") return eventTimestamp(a) - eventTimestamp(b);
        const rank = (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9);
        return rank || (eventTimestamp(a) - eventTimestamp(b));
      });
  }

  let historySuppressed = false;
  const VALID = {
    view: ["list", "table"], region: ["all", "cn", "intl"],
    status: STATUS_OPTIONS.map(([value]) => value),
    mode: MODE_OPTIONS.map(([value]) => value),
    sort: SORT_OPTIONS.map(([value]) => value),
  };

  function applyUrlState() {
    const params = new URLSearchParams(location.search);
    const pick = (key) => params.get(key);
    if (VALID.view.includes(pick("view"))) state.contestView = pick("view");
    if (VALID.region.includes(pick("region"))) state.region = pick("region");
    if (VALID.status.includes(pick("status"))) state.status = pick("status");
    if (VALID.mode.includes(pick("mode"))) state.mode = pick("mode");
    if (VALID.sort.includes(pick("sort"))) state.sort = pick("sort");
    if (pick("category") && CATEGORIES.some((item) => item.key === pick("category"))) state.category = pick("category");
    state.savedOnly = pick("saved") === "1";
    state.pendingApp = APP_DEFS[pick("app")] && pick("app") !== "detail" ? pick("app") : null;
    const eventId = Number(pick("event"));
    state.pendingEvent = Number.isFinite(eventId) && eventId > 0 ? eventId : null;
  }

  function syncUrl(push = false) {
    if (historySuppressed) return;
    const params = new URLSearchParams(location.search);
    for (const key of ["event", "app", "view", "region", "status", "mode", "sort", "category", "saved"]) params.delete(key);
    if (state.contestView !== "table") params.set("view", state.contestView);
    if (state.region !== "all") params.set("region", state.region);
    if (state.status !== "all") params.set("status", state.status);
    if (state.mode !== "all") params.set("mode", state.mode);
    if (state.sort !== "smart") params.set("sort", state.sort);
    if (state.category !== "all") params.set("category", state.category);
    if (state.savedOnly) params.set("saved", "1");
    if (state.active && state.active !== "detail" && (isMobileShell() || ["board", "submit"].includes(state.active))) params.set("app", state.active);
    if (state.windows.detail && state.selected && (!isMobileShell() || state.active === "detail")) params.set("event", String(state.selected));
    const query = params.toString();
    const next = `${location.pathname}${query ? `?${query}` : ""}`;
    const method = push ? "pushState" : "replaceState";
    history[method]({}, "", next);
  }

  function openPendingEvent(push = false) {
    if (!state.pendingEvent) return;
    const item = eventFor(state.pendingEvent);
    if (!item) return;
    state.pendingEvent = null;
    openDetail(item.id, { push });
  }

  function openPendingApp() {
    if (!state.pendingApp) return;
    const id = state.pendingApp;
    state.pendingApp = null;
    openApp(id);
  }

  function handlePopState() {
    historySuppressed = true;
    applyUrlState();
    refreshContests();
    refreshAgenda();
    if (state.pendingApp) openPendingApp();
    if (state.pendingEvent) openPendingEvent(false);
    else if (state.windows.detail) closeApp("detail");
    historySuppressed = false;
  }

  function setTheme(id, { notify = true } = {}) {
    const themeId = THEMES[id] ? id : "wallhaven";
    state.theme = themeId;
    document.documentElement.dataset.theme = themeId;
    $('meta[name="theme-color"]')?.setAttribute("content", THEMES[themeId].desktop);
    try { localStorage.setItem(THEME_KEY, themeId); } catch { /* ignore */ }
    $$('[data-fetch-theme]').forEach(node => { node.textContent = THEMES[themeId].name; });
    const terminalOutput = $("#terminalOutput");
    if (terminalOutput) {
      terminalOutput.innerHTML = state.terminalLines.map(terminalLineHtml).join("");
      scrollTerminal();
    }
    refreshWallpaper();
    if (notify) toast(`已切换主题：${THEMES[themeId].name}`);
  }

  function paintWallpaper() {
    const sheet = WALLPAPERS.find((item) => item.id === state.wallpaper.id) || WALLPAPERS[0];
    const fit = FIT_CSS[state.wallpaper.fit] || FIT_CSS.cover;
    const node = $("#wallpaper");
    node.style.backgroundImage = `url("${sheet.file}")`;
    node.style.backgroundSize = fit.size;
    node.style.backgroundRepeat = fit.repeat;
    node.style.backgroundPosition = fit.position;
  }

  function scheduleToastHide() {
    clearTimeout(toast.timer);
    if (document.hidden) return;
    toast.timer = setTimeout(() => { $("#toast").hidden = true; }, 3200);
  }

  function toast(message) {
    $("#toastText").textContent = message;
    $("#toast").hidden = false;
    scheduleToastHide();
  }

  function updateClock() {
    const now = new Date();
    const time = now.toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hour12: false });
    $("#clock").textContent = time;
    $("#desktopTime").textContent = time;
    $("#desktopDate").textContent = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "short", timeZone: "Asia/Shanghai" }).format(now).replace("星期", "周");
  }

  function urgentEvents() {
    return DEMO_EVENTS.filter(item => {
      const days = daysUntil(dateOf(item));
      return days !== null && days >= 0 && days <= 3;
    }).sort((a, b) => daysUntil(dateOf(a)) - daysUntil(dateOf(b)));
  }

  const VISITOR_KEY = "contestline.archos.visitor.v1";
  function visitorId() {
    try {
      const existing = localStorage.getItem(VISITOR_KEY);
      if (/^[A-Za-z0-9_-]{8,128}$/.test(existing || "")) return existing;
      const next = (globalThis.crypto?.randomUUID?.() || `v-${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, "");
      localStorage.setItem(VISITOR_KEY, next);
      return next;
    } catch {
      return `v-${Date.now()}-${Math.random().toString(36).slice(2)}`.replace(/[^A-Za-z0-9_-]/g, "");
    }
  }

  function renderPresence(display) {
    const label = $("#onlineCount");
    if (!label) return;
    label.textContent = String(Math.max(2, Number(display) || 2));
    const node = $("#presence");
    if (node) node.title = `当前在线人数：${label.textContent}`;
  }

  async function updatePresence() {
    if (!API_ENABLED) { renderPresence(2); return; }
    try {
      const response = await fetch("/api/v1/presence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ visitor: visitorId() }),
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = await response.json();
      state.online = Number(data.online) || 0;
      renderPresence(Number(data.display) || state.online + 1);
    } catch { /* keep last count */ }
  }

  let syncStatus = "snapshot";
  let DEMO_LAST_REFRESH = null;

  function syncTime(value) {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) return "未知";
    return date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Shanghai" }).replaceAll("/", "-");
  }

  function liveFreshnessText() {
    return `本次读取 ${syncTime(DEMO_UPDATED)} · 最近采集 ${syncTime(DEMO_LAST_REFRESH)}`;
  }

  function updateShellCounts() {
    $("#dataCount").textContent = `${DEMO_EVENTS.length} 场`;
    const modeLabel = $(".snapshot-label");
    if (modeLabel) modeLabel.textContent = syncStatus === "syncing" ? "SYNC" : DEMO_LIVE ? "LIVE" : "SNAP";
    const status = $("#dataStatus");
    if (status) status.dataset.state = syncStatus;
    const retry = $("#syncRetry");
    if (retry) retry.hidden = syncStatus !== "error";
    const freshness = $("#dataFreshness");
    if (freshness) {
      if (syncStatus === "syncing") freshness.textContent = `同步中 · 保留${DEMO_LIVE ? "当前数据" : "公开快照"}`;
      else if (syncStatus === "error") freshness.textContent = `同步失败 · ${DEMO_LIVE ? "显示上次数据" : "显示公开快照"}`;
      else if (DEMO_LIVE) freshness.textContent = liveFreshnessText();
      else freshness.textContent = `公开快照 · ${String(DEMO_UPDATED).slice(0, 10)}`;
      if (status) status.title = `${$("#dataCount").textContent} · ${freshness.textContent}`;
    }
    $("#savedTray").textContent = `★ ${state.saved.size}`;
    const unread = urgentEvents().filter(item => !state.read.has(item.id)).length;
    $("#notificationBadge").textContent = unread ? String(unread) : "";
    $("#notificationBadge").hidden = unread === 0;
  }

  function toggleUpcoming(force) {
    state.upcomingVisible = force === undefined ? !state.upcomingVisible : force;
    const node = $("#upcomingWidget");
    if (state.upcomingVisible) {
      node.hidden = false;
      if (window.anime) window.anime.set(node, { opacity: 1, translateY: 0 });
    } else if (window.anime && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.anime.remove(node);
      window.anime({ targets: node, opacity: [1, 0], translateY: [0, 8], duration: 140, easing: "cubicBezier(.23,1,.32,1)", complete: () => { if (!state.upcomingVisible) node.hidden = true; } });
    } else node.hidden = true;
    try { localStorage.setItem(WIDGET_KEY, state.upcomingVisible ? "1" : "0"); } catch { }
  }

  function renderUpcoming() {
    $("#upcomingWidget").hidden = !state.upcomingVisible;
    $("#upcomingList").innerHTML = urgentEvents().slice(0, 3).map(item => {
      const date = dateParts(dateOf(item));
      return `<button class="upcoming-item" type="button" data-widget-event="${item.id}"><span class="upcoming-date">${esc(date?.short || "待定")}</span><span class="upcoming-copy"><strong>${esc(cleanTitle(item.title))}</strong><small>${esc(nodeLabel(item))} · ${esc(item.category_label || item.category)}</small></span><span class="upcoming-days">${esc(dayText(daysUntil(dateOf(item))))}</span></button>`;
    }).join("");
  }

  function notificationListHtml(items) {
    if (!items.length) return `<div class="notification-empty">暂无临近节点</div>`;
    return items.map(item => {
      const unreadItem = !state.read.has(item.id);
      return `<button class="notification-item ${unreadItem ? "unread" : "read"}" type="button" data-notification-event="${item.id}"><span class="notification-code">${esc(statusCode(item))}</span><span class="notification-copy"><strong>${esc(cleanTitle(item.title))}</strong><span>${esc(nodeLabel(item))} · ${esc(dayText(daysUntil(dateOf(item))))}</span></span></button>`;
    }).join("");
  }

  function renderNotifications() {
    const items = urgentEvents();
    const unread = items.filter(item => !state.read.has(item.id)).length;
    $("#notificationSummary").textContent = `${items.length} 条临近节点 · ${unread} 条未读`;
    $("#notificationList").innerHTML = notificationListHtml(items);
    updateShellCounts();
  }

  function toggleNotifications(force) {
    const node = $("#notificationCenter");
    const open = force === undefined ? node.hidden : force;
    node.hidden = !open;
    $("#notificationTrigger").setAttribute("aria-expanded", String(open));
    if (open) renderNotifications();
  }

  function setActive(id) {
    if (!state.windows[id] || state.windows[id].workspace !== state.workspace) return;
    state.active = id;
    state.z += 1;
    state.windows[id].z = state.z;
    $$(".window").forEach(win => {
      const current = win.dataset.app === id;
      win.classList.toggle("active", current);
      if (current) win.style.zIndex = String(state.z);
    });
    renderTaskbar();
  }

  function appContent(id) {
    if (id === "contests") return contestsHtml();
    if (id === "detail") return detailHtml();
    if (id === "agenda") return agendaHtml();
    if (id === "board") return boardHtml();
    if (id === "submit") return submitHtml();
    if (id === "push") return pushHtml();
    if (id === "docs") return docsHtml();
    if (id === "terminal") return terminalHtml();
    if (id === "wallpaper") return wallpaperHtml();
    return "";
  }

  const MENUS = {
    contests: {
      "文件": [["刷新列表", "refresh"], ["关闭", "close"]],
      "查看": [["赛事档案", "open:contests"], ["日程", "open:agenda"], ["留言板", "open:board"], ["桌面设置", "open:wallpaper"]],
      "帮助": [["关于", "about"]],
    },
    submit: {
      "文件": [["关闭", "close"]],
      "查看": [["赛事档案", "open:contests"], ["留言板", "open:board"], ["日程", "open:agenda"]],
      "帮助": [["关于", "about"]],
    },
    detail: {
      "文件": [["打开官网", "official"], ["关闭", "close"]],
      "查看": [["赛事档案", "open:contests"], ["日程", "open:agenda"]],
      "帮助": [["关于", "about"]],
    },
    agenda: {
      "文件": [["导出 ICS", "ics"], ["关闭", "close"]],
      "查看": [["赛事档案", "open:contests"], ["留言板", "open:board"], ["桌面设置", "open:wallpaper"]],
      "帮助": [["关于", "about"]],
    },
    terminal: {
      "终端": [["清屏", "clear"], ["关闭", "close"]],
      "查看": [["赛事档案", "open:contests"], ["桌面设置", "open:wallpaper"]],
      "帮助": [["命令帮助", "shell-help"], ["关于", "about"]],
    },
    wallpaper: {
      "文件": [["应用壁纸", "apply-wallpaper"], ["随机一张", "random-wallpaper"], ["关闭", "close"]],
      "查看": [["赛事档案", "open:contests"], ["日程", "open:agenda"]],
      "帮助": [["关于", "about"]],
    },
  };

  function menuHtml(id) {
    const def = APP_DEFS[id];
    return def.menus.map((menu) => {
      const items = (MENUS[id] || {})[menu] || [];
      return `<div class="menu-wrap"><button type="button" class="menu-trigger" data-menu="${id}|${menu}" aria-expanded="false">${menu}</button><div class="menu-pop" data-menu-pop="${id}|${menu}" hidden>${items.map(([label, action]) => `<button type="button" data-command="${action}" data-app="${id}">${label}</button>`).join("")}</div></div>`;
    }).join("");
  }

  function windowTitle(id) {
    if (id === "detail") {
      const item = eventFor(state.selected);
      return item ? `赛事详情 - ${cleanTitle(item.title).slice(0, 18)}` : "赛事详情";
    }
    return APP_DEFS[id].title;
  }

  function windowHtml(id) {
    const def = APP_DEFS[id];
    const win = state.windows[id];
    return `<section class="window ${win.maximized ? "maximized" : ""} ${win.minimized ? "minimized" : ""}" data-app="${id}" aria-label="${esc(def.title)}窗口" tabindex="-1" style="left:${win.x}px;top:${win.y}px;width:${win.width}px;height:${win.height}px;z-index:${win.z}">
      <header class="titlebar" data-drag="${id}">
        <div class="titlebar-title"><span class="titlebar-icon">${icon(def.glyph)}</span>${esc(windowTitle(id))}<span class="titlebar-path">${esc(def.path)}</span></div>
        <div class="window-controls">
          <button type="button" data-action="minimize" data-app="${id}" aria-label="最小化${esc(def.title)}">${icon("minus")}</button>
          <button type="button" data-action="maximize" data-app="${id}" aria-label="最大化${esc(def.title)}">${icon("maximize")}</button>
          <button type="button" data-action="close" data-app="${id}" aria-label="关闭${esc(def.title)}">${icon("close")}</button>
        </div>
      </header>
      <div class="window-body">${appContent(id)}</div>
      ${["n", "e", "s", "w", "ne", "nw", "se", "sw"].map(dir => `<span class="resize-handle ${dir}" data-resize="${dir}" data-app="${id}"></span>`).join("")}
    </section>`;
  }

  function openApp(id, { focus = true, animate = false } = {}) {
    if (!APP_DEFS[id]) return;
    if (state.onboardingOpen) closeOnboarding({ restore: false });
    const layer = $("#windows").getBoundingClientRect();
    const isNew = !state.windows[id];
    if (isNew) {
      const def = APP_DEFS[id];
      const width = Math.min(def.width, Math.max(340, layer.width - 32));
      const height = Math.min(def.height, Math.max(240, layer.height - 32));
      const x = Math.max(12, Math.min(def.x, layer.width - width - 12));
      const y = Math.max(12, Math.min(def.y, layer.height - height - 12));
      state.windows[id] = { x, y, width, height, minimized: false, maximized: false, workspace: state.workspace, z: ++state.z };
    }
    const win = state.windows[id];
    win.workspace = state.workspace;
    win.minimized = false;
    let node = $(`.window[data-app="${id}"]`);
    if (!node) {
      $("#windows").insertAdjacentHTML("beforeend", windowHtml(id));
      node = $(`.window[data-app="${id}"]`);
    }
    node.classList.remove("minimized");
    node.style.display = "";
    if (isNew && id === "terminal") initTerminal();
    if (id === "contests") refreshContests();
    if (id === "agenda") refreshAgenda();
    if (id === "board") { refreshBoard(); loadBoard(); }
    if (id === "submit") { refreshSubmitAuth(); loadSubmit(); }
    if (id === "push") refreshPush();
    if (id === "docs") refreshDocs();
    if (id === "wallpaper") refreshWallpaper();
    if (id === "detail") refreshDetail();
    if (focus) setActive(id);
    if (id === "terminal" && focus) $("#terminalInput")?.focus({ preventScroll: true });
    else if (focus) node.focus({ preventScroll: true });
    renderTaskbar();
    if (state.tiled) layoutTiled();
    else if (animate && window.anime && window.innerWidth > 760 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.anime.remove(node);
      window.anime({ targets: node, opacity: [0, 1], translateY: [10, 0], duration: 180, easing: "cubicBezier(.23,1,.32,1)" });
    }
  }

  function closeApp(id) {
    $(`.window[data-app="${id}"]`)?.remove();
    delete state.windows[id];
    if (state.active === id) state.active = null;
    const remaining = visibleWindowIds();
    state.active = remaining.at(-1) || null;
    if (state.active) setActive(state.active);
    syncUrl(false);
    renderTaskbar();
    if (state.tiled) layoutTiled();
    const next = state.active ? $(`.window[data-app="${state.active}"]`) : null;
    (next || shellHomeButton())?.focus({ preventScroll: true });
  }

  function showMobileHome() {
    historySuppressed = true;
    for (const id of Object.keys(state.windows)) {
      $(`.window[data-app="${id}"]`)?.remove();
      delete state.windows[id];
    }
    state.active = null;
    historySuppressed = false;
    syncUrl(false);
    renderTaskbar();
    shellHomeButton()?.focus({ preventScroll: true });
  }

  function minimizeApp(id) {
    const win = state.windows[id];
    if (!win) return;
    win.minimized = true;
    $(`.window[data-app="${id}"]`)?.classList.add("minimized");
    const remaining = visibleWindowIds();
    state.active = remaining.at(-1) || null;
    if (state.active) setActive(state.active);
    renderTaskbar();
    if (state.tiled) layoutTiled();
    const next = state.active ? $(`.window[data-app="${state.active}"]`) : null;
    (next || shellHomeButton())?.focus({ preventScroll: true });
  }

  function maximizeApp(id) {
    const win = state.windows[id];
    if (!win) return;
    win.maximized = !win.maximized;
    const node = $(`.window[data-app="${id}"]`);
    node?.classList.toggle("maximized", win.maximized);
    setActive(id);
    node?.focus({ preventScroll: true });
  }

  function renderTaskbar() {
    const ids = visibleWindowIds();
    $("#runningCount").textContent = String(ids.length);
    $("#activeWindowTitle").textContent = state.active && state.windows[state.active] ? windowTitle(state.active) : `desktop · workspace ${state.workspace}`;
    $$("[data-workspace]").forEach(button => {
      if (button.dataset.workspace === String(state.workspace)) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    const mobileHome = $("[data-mobile-home]");
    if (mobileHome) {
      if (ids.length) mobileHome.removeAttribute("aria-current");
      else mobileHome.setAttribute("aria-current", "page");
    }
    $("#mobileGuide").hidden = !isMobileShell();
    if (state.onboardingOpen) renderOnboarding();
    $$('[data-mobile-open]').forEach(button => {
      if (state.active === button.dataset.mobileOpen && ids.includes(state.active)) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    $$('[data-action="close"]').forEach(button => {
      const title = APP_DEFS[button.dataset.app]?.title || "应用";
      button.setAttribute("aria-label", `${isMobileShell() ? "返回，关闭" : "关闭"}${title}`);
    });
  }

  function switchWorkspace(workspace) {
    const next = Math.max(1, Math.min(3, Number(workspace) || 1));
    state.workspace = next;
    state.active = null;
    $("#windows").innerHTML = "";
    visibleWindowIds().forEach(id => $("#windows").insertAdjacentHTML("beforeend", windowHtml(id)));
    visibleWindowIds().forEach(id => {
      if (id === "contests") refreshContests();
      if (id === "agenda") refreshAgenda();
      if (id === "board") refreshBoard();
      if (id === "submit") { refreshSubmitAuth(); refreshSubmitMine(); }
      if (id === "push") refreshPush();
      if (id === "docs") refreshDocs();
      if (id === "wallpaper") refreshWallpaper();
      if (id === "detail") refreshDetail();
    });
    const ids = visibleWindowIds();
    if (ids.length) setActive(ids.at(-1));
    renderTaskbar();
    if (state.tiled) layoutTiled();
  }

  function animateWindowLayout(node, before) {
    if (!before || !window.anime || window.innerWidth <= 760 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const after = node.getBoundingClientRect();
    if (!after.width || !after.height) return;
    window.anime.remove(node);
    window.anime({
      targets: node,
      translateX: [before.left - after.left, 0],
      translateY: [before.top - after.top, 0],
      opacity: [.88, 1],
      duration: 280,
      easing: "cubicBezier(.23,1,.32,1)",
      complete: () => window.anime.set(node, { translateX: 0, translateY: 0, opacity: 1 }),
    });
  }

  function layoutTiled() {
    const layer = $("#windows");
    const rect = layer.getBoundingClientRect();
    const ids = visibleWindowIds();
    const previous = new Map(ids.map(id => {
      const node = $(`.window[data-app="${id}"]`);
      return [id, node ? node.getBoundingClientRect() : null];
    }));
    const gap = 10;
    ids.forEach((id, index) => {
      const win = state.windows[id];
      const node = $(`.window[data-app="${id}"]`);
      if (!node) return;
      if (!state.tiled) {
        if (win.float) Object.assign(node.style, win.float);
        return;
      }
      if (!win.float) win.float = { left: node.style.left, top: node.style.top, width: node.style.width, height: node.style.height };
      win.maximized = false;
      node.classList.remove("maximized");
      let x = gap, y = gap, width = rect.width - gap * 2, height = rect.height - gap * 2;
      if (ids.length === 2) {
        width = (rect.width - gap * 3) / 2;
        x = gap + index * (width + gap);
      } else if (ids.length === 3) {
        if (index === 0) width = (rect.width - gap * 3) * .58;
        else {
          x = gap + (rect.width - gap * 3) * .58 + gap;
          width = (rect.width - gap * 3) * .42;
          height = (rect.height - gap * 3) / 2;
          y = gap + (index - 1) * (height + gap);
        }
      } else if (ids.length >= 4) {
        const rows = Math.ceil(ids.length / 2);
        width = (rect.width - gap * 3) / 2;
        height = (rect.height - gap * (rows + 1)) / rows;
        x = gap + (index % 2) * (width + gap);
        y = gap + Math.floor(index / 2) * (height + gap);
      }
      Object.assign(node.style, { left: `${Math.round(x)}px`, top: `${Math.round(y)}px`, width: `${Math.round(width)}px`, height: `${Math.round(height)}px` });
    });
    ids.forEach(id => {
      const node = $(`.window[data-app="${id}"]`);
      if (node) animateWindowLayout(node, previous.get(id));
    });
  }

  function toggleTiled(force) {
    state.tiled = force === undefined ? !state.tiled : force;
    $("#windows").classList.toggle("tiled", state.tiled);
    $("#tileToggle").setAttribute("aria-pressed", String(state.tiled));
    if (!state.tiled) Object.values(state.windows).forEach(win => { if (win.float) { Object.assign(win, { x: parseFloat(win.float.left), y: parseFloat(win.float.top), width: parseFloat(win.float.width), height: parseFloat(win.float.height) }); win.float = null; } });
    layoutTiled();
    toast(state.tiled ? "平铺模式已开启" : "已恢复浮动窗口");
  }

  function openFromEvent(id) {
    openApp(id, { animate: true });
    toggleNotifications(false);
    syncUrl();
  }

  function showAbout() {
    toast(`竞赛雷达 · 赛事档案 · ${DEMO_LIVE ? `API 数据 · ${liveFreshnessText()}` : `公开数据快照 ${String(DEMO_UPDATED).slice(0, 10)}`}`);
  }

  let onboardingReturnFocus = null;
  let onboardingExit = null;

  function renderOnboarding() {
    $("#onboardingTitle").textContent = isMobileShell() ? "赛线使用指南" : "contestline --help";
  }

  function openOnboarding({ automatic = false, trigger = null } = {}) {
    const node = $("#onboarding");
    if (!node || state.onboardingOpen) return;
    const active = document.activeElement;
    onboardingReturnFocus = trigger || (active?.closest("#rofi") ? $("#rofiTrigger") : active);
    if (state.rofiOpen) closeRofi(false);
    toggleNotifications(false);
    closeMenus();
    if (onboardingExit) {
      onboardingExit.cancel();
      onboardingExit = null;
    }
    state.onboardingOpen = true;
    state.onboardingAutomatic = automatic;
    renderOnboarding();
    node.hidden = false;
    if (!automatic) $(".onboarding-done", node)?.focus({ preventScroll: true });
  }

  function closeOnboarding({ restore = true } = {}) {
    const node = $("#onboarding");
    if (!node || !state.onboardingOpen) return;
    const automatic = state.onboardingAutomatic;
    state.onboardingOpen = false;
    state.onboardingAutomatic = false;
    state.onboardingSeen = true;
    try { localStorage.setItem(ONBOARDING_KEY, "seen"); } catch { }
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && typeof node.animate === "function") {
      onboardingExit = node.animate([
        { opacity: 1, translate: "0 0" },
        { opacity: 0, translate: `0 ${isMobileShell() ? 12 : -6}px` },
      ], { duration: 120, easing: "cubic-bezier(.23,1,.32,1)" });
      const animation = onboardingExit;
      animation.addEventListener("finish", () => {
        if (!state.onboardingOpen) node.hidden = true;
        animation.cancel();
        if (onboardingExit === animation) onboardingExit = null;
      }, { once: true });
    } else {
      node.hidden = true;
    }
    if (restore && !automatic && onboardingReturnFocus?.isConnected) onboardingReturnFocus.focus({ preventScroll: true });
  }

  function fmtDate(value) {
    const p = dateParts(value);
    return p ? `${p.short} ${p.weekday}` : "待定";
  }

  function statusText(item) {
    const days = daysUntil(dateOf(item));
    if (days !== null && days < 0 && !["closed", "ended", "cancelled"].includes(item.status)) return `已过 ${-days} 天`;
    if (item.status === "closing" || (days !== null && days >= 0 && days <= 3)) return dayText(days);
    return item.status_label || "待定";
  }

  function statusCode(item) {
    const days = daysUntil(dateOf(item));
    if (days === 0) return "D-DAY";
    if (days !== null && days > 0 && days <= 3) return `D-${days}`;
    return "";
  }

  /* Contests */
  function effectiveContestView() {
    return isMobileShell() ? "list" : state.contestView;
  }

  function contestsHtml() {
    const categories = CATEGORIES.filter((cat) => cat.key !== "all");
    return `<div class="app-toolbar">
      <span class="app-location">${icon("grid")}<span>~/contests</span></span>
      <input id="contestSearch" class="search-field" type="search" placeholder="搜索赛事、主办方" value="${esc(state.q)}" aria-label="搜索赛事">
      <div class="seg contest-view-seg" role="group" aria-label="赛事视图">
        <button type="button" data-contest-view="list" class="${state.contestView === "list" ? "active" : ""}">列表</button>
        <button type="button" data-contest-view="table" class="${state.contestView === "table" ? "active" : ""}">表格</button>
      </div>
      <select id="contestStatus" class="contest-filter" aria-label="状态">${STATUS_OPTIONS.map(([value, label]) => `<option value="${value}" ${state.status === value ? "selected" : ""}>${label}</option>`).join("")}</select>
      <select id="contestMode" class="contest-filter" aria-label="形式">${MODE_OPTIONS.map(([value, label]) => `<option value="${value}" ${state.mode === value ? "selected" : ""}>${label}</option>`).join("")}</select>
      <select id="contestSort" class="contest-filter" aria-label="排序">${SORT_OPTIONS.map(([value, label]) => `<option value="${value}" ${state.sort === value ? "selected" : ""}>${label}</option>`).join("")}</select>
      <button type="button" class="btn contest-saved ${state.savedOnly ? "active" : ""}" data-contest-saved aria-pressed="${state.savedOnly}">★ 收藏 ${state.saved.size}</button>
      <span class="count-label" id="contestCount">${filteredEvents().length} / ${DEMO_EVENTS.length} 场</span>
    </div>
    <div class="explorer">
      <aside class="tree" aria-label="赛事目录">
        <div class="tree-root">赛事档案</div>
        <button type="button" class="tree-item ${state.category === "all" ? "active" : ""}" data-tree-category="all"><span>▾ 全部赛事</span><b>${DEMO_EVENTS.length}</b></button>
        <div class="tree-sep">范围</div>
        <button type="button" class="tree-item ${state.region === "all" ? "active" : ""}" data-tree-region="all"><span>全部地区</span><b>${DEMO_EVENTS.length}</b></button>
        <button type="button" class="tree-item ${state.region === "cn" ? "active" : ""}" data-tree-region="cn"><span>国内</span><b>${DEMO_EVENTS.filter(x => regionOf(x) === "cn").length}</b></button>
        <button type="button" class="tree-item ${state.region === "intl" ? "active" : ""}" data-tree-region="intl"><span>国外</span><b>${DEMO_EVENTS.filter(x => regionOf(x) === "intl").length}</b></button>
        <div class="tree-sep">类型</div>
        ${categories.map((cat) => `<button type="button" class="tree-item ${state.category === cat.key ? "active" : ""}" data-tree-category="${cat.key}"><span>${cat.label}</span><b>${DEMO_EVENTS.filter((x) => x.category === cat.key).length}</b></button>`).join("")}
      </aside>
      <div class="list-pane">
        ${effectiveContestView() === "table" ? contestTableHtml() : `<div class="event-head"><span>赛事</span><span>下一节点</span><span>状态</span><span></span></div><div class="event-list" id="contestRows">${contestRowsHtml()}</div>`}
      </div>
    </div>`;
  }

  function contestRowsHtml() {
    const items = filteredEvents();
    if (!items.length) return `<div class="empty-state">没有匹配的赛事<br>清除搜索或切换目录</div>`;
    return items.map((item) => {
      const date = dateOf(item);
      const days = daysUntil(date);
      const urgent = days !== null && days >= 0 && days <= 3;
      return `<div class="event-row ${state.selected === item.id ? "selected" : ""}" data-select="${item.id}"><button class="event-main" type="button" data-open-event="${item.id}" aria-label="查看${esc(cleanTitle(item.title))}详情"><span class="event-name"><strong>${esc(cleanTitle(item.title))}</strong><small>${esc(item.category_label || item.category)} · ${esc(item.organizer || item.source_name)}</small></span><span class="event-when">${esc(nodeLabel(item))} · ${esc(fmtDate(date))}</span><span class="event-status ${urgent ? "urgent" : ""}">${esc(urgent ? statusCode(item) : statusText(item))}</span></button><button type="button" class="star ${state.saved.has(item.id) ? "saved" : ""}" data-save="${item.id}" aria-label="${state.saved.has(item.id) ? "取消收藏" : "收藏"}${esc(cleanTitle(item.title))}">${icon(state.saved.has(item.id) ? "starred" : "non-starred")}</button></div>`;
    }).join("");
  }

  function contestTableHtml() {
    const items = filteredEvents();
    if (!items.length) return `<div class="empty-state">没有匹配的赛事<br>清除搜索或切换目录</div>`;
    return `<div class="contest-table-wrap">
      <table class="contest-table">
        <colgroup><col class="col-event"><col class="col-category"><col class="col-node"><col class="col-date"><col class="col-status"><col class="col-star"></colgroup>
        <thead><tr><th>赛事</th><th>类别</th><th>下一节点</th><th>日期</th><th>状态</th><th><span class="sr-only">收藏</span></th></tr></thead>
        <tbody>${items.map((item) => {
          const date = dateOf(item);
          const days = daysUntil(date);
          const urgent = days !== null && days >= 0 && days <= 3;
          const saved = state.saved.has(item.id);
          return `<tr class="${state.selected === item.id ? "selected" : ""}" data-select="${item.id}">
            <td class="contest-title-cell"><button type="button" class="contest-title" data-open-event="${item.id}"><strong>${esc(cleanTitle(item.title))}</strong><small>${esc(item.organizer || item.source_name || "公开来源")}</small></button></td>
            <td class="contest-meta-cell">${esc(item.category_label || item.category)}</td>
            <td class="contest-meta-cell">${esc(nodeLabel(item))}</td>
            <td class="contest-date-cell">${esc(fmtDate(date))}</td>
            <td class="contest-status-cell ${urgent ? "urgent" : ""}">${esc(urgent ? statusCode(item) : statusText(item))}</td>
            <td class="contest-star-cell"><button type="button" class="star ${saved ? "saved" : ""}" data-save="${item.id}" aria-label="${saved ? "取消收藏" : "收藏"}${esc(cleanTitle(item.title))}">${icon(saved ? "starred" : "non-starred")}</button></td>
          </tr>`;
        }).join("")}</tbody>
      </table>
    </div>`;
  }

  function detailDate(value) {
    return dateParts(value)?.label || String(value || "").slice(0, 10) || "待定";
  }

  function stageTimeText(stage) {
    if (!stage) return "时间待定";
    if (stage.deadline_at) return `截止 ${detailDate(stage.deadline_at)}`;
    if (stage.starts_at && stage.ends_at) return `${detailDate(stage.starts_at)} – ${detailDate(stage.ends_at)}`;
    if (stage.starts_at) return `开始 ${detailDate(stage.starts_at)}`;
    if (stage.ends_at) return `结束 ${detailDate(stage.ends_at)}`;
    return "时间待定";
  }

  function detailHtml() {
    const item = eventFor(state.selected);
    if (!item) return `<div class="detail-empty">从赛事档案中选择一场赛事</div>`;
    const date = dateOf(item);
    const saved = state.saved.has(item.id);
    const stages = Array.isArray(item.stages) ? item.stages : [];
    const official = safeLink(item.url || item.signup_url);
    const source = safeLink(item.source_url);
    const recognition = item.recognition_label ? `<a class="detail-recognition" href="/miit" target="_blank" rel="noreferrer">${esc(item.recognition_label)}</a>` : "";
    const team = item.team_size || [item.team_size_min, item.team_size_max].filter(Boolean).join("–") || "待定";
    const confidence = { confirmed: "已确认", estimated: "预估", unknown: "待确认" }[item.date_confidence] || "待确认";
    const mode = MODE_LABELS[item.mode] || item.mode || "待定";
    return `<div class="detail-window">
      <div class="detail-kicker">${esc(item.category_label || item.category)} · ${esc(item.source_name || "公开来源")}</div>
      <h2>${esc(cleanTitle(item.title))}</h2>
      <p class="org">${esc(item.organizer || "主办方待补充")}</p>
      <p class="detail-summary">${esc(cleanSummary(item.description) || "暂无简介。")}</p>
      ${recognition ? `<p class="detail-recognition-row">认定：${recognition}</p>` : ""}
      <dl class="detail-grid">
        <div><dt>方向</dt><dd>${esc(item.field_label || "待细分")}</dd></div>
        <div><dt>下一节点</dt><dd>${esc(nodeLabel(item))} · ${esc(detailDate(date))} · ${esc(dayText(daysUntil(date)))}</dd></div>
        <div><dt>报名截止</dt><dd>${esc(detailDate(item.registration_deadline || item.next_deadline))}</dd></div>
        <div><dt>比赛时间</dt><dd>${esc(detailDate(item.event_start))}${item.event_end && item.event_end !== item.event_start ? ` – ${esc(detailDate(item.event_end))}` : ""}</dd></div>
        <div><dt>队伍</dt><dd>${esc(team)}</dd></div>
        <div><dt>报名费</dt><dd>${esc(item.fee || "未标注")}</dd></div>
        <div><dt>地区</dt><dd>${esc(item.region_label || (regionOf(item) === "cn" ? "国内" : "国外"))}</dd></div>
        <div><dt>形式</dt><dd>${esc(mode)}${item.location ? ` · ${esc(item.location)}` : ""}</dd></div>
        <div><dt>日期置信度</dt><dd>${esc(confidence)}</dd></div>
        <div><dt>来源</dt><dd>${esc(item.source_name || "未知")}</dd></div>
        <div><dt>核实</dt><dd>${esc(String(item.verified_at || "").slice(0, 10) || "—")}</dd></div>
      </dl>
      <section class="detail-section">
        <h3>赛程阶段</h3>
        ${stages.length ? `<ol class="detail-stages">${stages.map((stage) => `<li><span class="stage-kind">${esc(STAGE_KIND_LABELS[stage.kind] || stage.kind || "阶段")}</span><div><strong>${esc(stage.name || "阶段")}</strong><small>${esc(stageTimeText(stage))}${stage.mode && stage.mode !== "unknown" ? ` · ${esc(MODE_LABELS[stage.mode] || stage.mode)}` : ""}${stage.status_label ? ` · ${esc(stage.status_label)}` : ""}${stage.note ? ` · ${esc(stage.note)}` : ""}</small></div></li>`).join("")}</ol>` : `<p class="detail-muted">暂无阶段信息，日期以主办方官网为准。</p>`}
      </section>
      <div class="detail-actions">
        ${official ? `<a class="btn primary" href="${esc(official)}" target="_blank" rel="noreferrer">打开官网</a>` : ""}
        <button type="button" class="btn" data-save="${item.id}">${saved ? "取消收藏" : "加入赛程"}</button>
        <button type="button" class="btn" data-copy-event="${item.id}">复制链接</button>
        ${source ? `<a class="btn detail-secondary-action" href="${esc(source)}" target="_blank" rel="noreferrer">查看来源</a>` : ""}
        <a class="btn detail-secondary-action" href="/competition/${Number(item.id)}" target="_blank" rel="noreferrer">完整页面</a>
      </div>
      <p class="detail-source">${DEMO_LIVE ? esc(liveFreshnessText()) : `公开快照 · ${esc(String(DEMO_UPDATED).slice(0, 10))}`} · 以官网为准</p>
      <p class="detail-mobile-links">${source ? `<a href="${esc(source)}" target="_blank" rel="noreferrer">查看来源</a>` : ""}<a href="/competition/${Number(item.id)}" target="_blank" rel="noreferrer">完整页面</a></p>
    </div>`;
  }

  function refreshContests() {
    if (!state.windows.contests) return;
    const pane = $('.window[data-app="contests"] .list-pane');
    if (!pane) return;
    const items = filteredEvents();
    pane.innerHTML = effectiveContestView() === "table"
      ? contestTableHtml()
      : `<div class="event-head"><span>赛事</span><span>下一节点</span><span>状态</span><span></span></div><div class="event-list" id="contestRows">${contestRowsHtml()}</div>`;
    const count = $('#contestCount');
    if (count) count.textContent = `${items.length} / ${DEMO_EVENTS.length} 场`;
    const search = $('#contestSearch');
    if (search && search.value !== state.q) search.value = state.q;
    $$('[data-contest-view]').forEach((button) => button.classList.toggle("active", button.dataset.contestView === state.contestView));
    $$('[data-tree-category]').forEach((button) => button.classList.toggle("active", button.dataset.treeCategory === state.category));
    $$('[data-tree-region]').forEach((button) => button.classList.toggle("active", button.dataset.treeRegion === state.region));
    for (const [id, key] of [["#contestStatus", "status"], ["#contestMode", "mode"], ["#contestSort", "sort"]]) {
      const select = $(id);
      if (select && select.value !== state[key]) select.value = state[key];
    }
    $$('[data-contest-saved], [data-agenda-saved]').forEach((button) => { button.classList.toggle("active", state.savedOnly); button.setAttribute("aria-pressed", String(state.savedOnly)); });
  }

  function refreshDetail() {
    if (!state.windows.detail) return;
    const body = $('.window[data-app="detail"] .window-body');
    if (body) body.innerHTML = detailHtml();
    const title = $('.window[data-app="detail"] .titlebar-title');
    if (title) title.innerHTML = `<span class="titlebar-icon">${icon("window")}</span>${esc(windowTitle("detail"))}<span class="titlebar-path">~/events/${esc(state.selected)}</span>`;
  }

  function openDetail(id, { push = true } = {}) {
    state.selected = Number(id);
    openApp("detail");
    refreshDetail();
    if (push) syncUrl(true);
  }

  /* Agenda: timeline + calendar + saved filter in one app */
  function agendaItems() {
    return filteredEvents().slice().sort((a, b) => eventTimestamp(a) - eventTimestamp(b));
  }

  function agendaTimelineHtml(items) {
    const dates = items.map((item) => dateOf(item)).filter(Boolean).map((date) => new Date(`${date.slice(0, 10)}T00:00:00+08:00`).getTime());
    const lo = dates.length ? Math.min(...dates) : Date.now();
    const hi = dates.length ? Math.max(...dates) : lo + 86400000;
    const span = Math.max(1, hi - lo);
    return `<div class="timeline-head"><div>赛事</div><div>下一节点</div><div>日期</div></div>
      <div class="timeline-list" id="timelineRows">${items.map((item) => {
        const date = dateOf(item);
        const t = date ? new Date(`${date.slice(0, 10)}T00:00:00+08:00`).getTime() : lo;
        const left = Math.max(2, Math.min(98, ((t - lo) / span) * 100));
        const days = daysUntil(date);
        return `<button type="button" class="timeline-row" data-select="${item.id}" data-open-detail="${item.id}">
          <span class="timeline-name"><strong>${esc(cleanTitle(item.title))}</strong><small>${esc(item.category_label)} · ${esc(item.source_name)}</small></span>
          <span class="timeline-track"><i class="${days !== null && days >= 0 && days <= 3 ? "urgent" : ""}" style="left:${left}%"></i></span>
          <time>${esc(fmtDate(date))}</time>
        </button>`;
      }).join("") || '<div class="empty-state">当前筛选下没有赛事</div>'}</div>`;
  }

  function agendaCalendarHtml(items) {
    const year = state.agendaMonth.getFullYear();
    const month = state.agendaMonth.getMonth();
    const first = new Date(year, month, 1);
    const start = first.getDay();
    const days = new Date(year, month + 1, 0).getDate();
    const byDate = new Map();
    for (const item of items) {
      const date = dateOf(item);
      if (!date) continue;
      const key = date.slice(0, 10);
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key).push(item);
    }
    const today = new Date();
    const todayKey = localDateKey(today);
    if (isMobileShell()) {
      const selectedKey = state.agendaSelectedDate || todayKey;
      const selectedEvents = byDate.get(selectedKey) || [];
      const selectedDate = dateParts(selectedKey);
      const cells = [];
      for (let i = 0; i < start; i += 1) cells.push('<div class="agenda-day empty"></div>');
      for (let day = 1; day <= days; day += 1) {
        const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const events = byDate.get(key) || [];
        cells.push(`<button type="button" class="agenda-day ${key === todayKey ? "today" : ""} ${key === selectedKey ? "selected" : ""}" data-agenda-date="${key}" aria-pressed="${key === selectedKey}" aria-label="${month + 1} 月 ${day} 日，${events.length ? `${events.length} 场赛事` : "无赛事"}"><span class="agenda-day-number">${day}</span>${events.length ? `<span class="agenda-day-count">${events.length} 场</span>` : ""}</button>`);
      }
      return `<div class="agenda-calendar">
        <header class="agenda-cal-head"><div><span class="agenda-cal-kicker">CALENDAR / MONTH</span><h2>${year} 年 ${month + 1} 月</h2></div><div class="agenda-cal-nav"><button type="button" class="btn" data-agenda-prev aria-label="上个月">‹</button><button type="button" class="btn" data-agenda-today>今天</button><button type="button" class="btn" data-agenda-next aria-label="下个月">›</button></div></header>
        <div class="agenda-week">${["日", "一", "二", "三", "四", "五", "六"].map((day) => `<span>${day}</span>`).join("")}</div>
        <div class="agenda-grid">${cells.join("")}</div>
        <section class="agenda-day-list" aria-label="当日赛事"><header><h3>${esc(selectedDate?.label || selectedKey)} · ${esc(selectedDate?.weekday || "")}</h3><span>${selectedEvents.length} 场</span></header>${selectedEvents.length ? selectedEvents.map((item) => `<button type="button" class="agenda-day-event" data-open-detail="${item.id}"><span><strong>${esc(cleanTitle(item.title))}</strong><small>${esc(item.category_label || item.category)} · ${esc(nodeLabel(item))}</small></span><time>${esc(statusCode(item) || dateParts(dateOf(item))?.short || "待定")}</time></button>`).join("") : '<p class="agenda-day-empty">当日没有赛事</p>'}</section>
        <footer class="agenda-cal-foot">${items.filter((item) => !dateOf(item)).length ? `${items.filter((item) => !dateOf(item)).length} 场赛事日期待定，未显示在月历中` : `${DEMO_LIVE ? "日期来自当前 API 数据" : "日期以公开快照为准"}`}</footer>
      </div>`;
    }
    const cells = [];
    for (let i = 0; i < start; i += 1) cells.push('<div class="agenda-day empty"></div>');
    for (let day = 1; day <= days; day += 1) {
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const events = byDate.get(key) || [];
      cells.push(`<div class="agenda-day ${key === todayKey ? "today" : ""}">
        <span class="agenda-day-number">${day}</span>
        <div class="agenda-day-events">${events.slice(0, 3).map((item) => `<button type="button" class="agenda-event" data-open-detail="${item.id}" title="${esc(cleanTitle(item.title))}"><i class="${daysUntil(dateOf(item)) !== null && daysUntil(dateOf(item)) >= 0 && daysUntil(dateOf(item)) <= 3 ? "urgent" : ""}"></i>${esc(cleanTitle(item.title))}</button>`).join("")}</div>
        ${events.length > 3 ? `<span class="agenda-more">+${events.length - 3}</span>` : ""}
      </div>`);
    }
    return `<div class="agenda-calendar">
      <header class="agenda-cal-head"><div><span class="agenda-cal-kicker">CALENDAR / MONTH</span><h2>${year} 年 ${month + 1} 月</h2></div><div class="agenda-cal-nav"><button type="button" class="btn" data-agenda-prev aria-label="上个月">‹</button><button type="button" class="btn" data-agenda-today>今天</button><button type="button" class="btn" data-agenda-next aria-label="下个月">›</button></div></header>
      <div class="agenda-week">${["日", "一", "二", "三", "四", "五", "六"].map((day) => `<span>${day}</span>`).join("")}</div>
      <div class="agenda-grid">${cells.join("")}</div>
      <footer class="agenda-cal-foot">${items.filter((item) => !dateOf(item)).length ? `${items.filter((item) => !dateOf(item)).length} 场赛事日期待定，未显示在月历中` : `${DEMO_LIVE ? "日期来自当前 API 数据" : "日期以公开快照为准"}`}</footer>
    </div>`;
  }

  function moveAgendaMonth(offset) {
    state.agendaMonth = new Date(state.agendaMonth.getFullYear(), state.agendaMonth.getMonth() + offset, 1);
    const prefix = `${state.agendaMonth.getFullYear()}-${String(state.agendaMonth.getMonth() + 1).padStart(2, "0")}`;
    const firstEvent = agendaItems().map((item) => dateOf(item)?.slice(0, 10)).find((date) => date?.startsWith(prefix));
    state.agendaSelectedDate = firstEvent || `${prefix}-01`;
    refreshAgenda();
  }

  function selectAgendaToday() {
    const now = new Date();
    state.agendaMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    state.agendaSelectedDate = localDateKey(now);
    refreshAgenda();
  }

  function agendaHtml() {
    const items = agendaItems();
    const savedCount = DEMO_EVENTS.filter((item) => state.saved.has(item.id)).length;
    return `<div class="app-toolbar agenda-toolbar">
      <div class="seg" role="tablist" aria-label="日程视图">
        <button type="button" data-agenda-tab="timeline" class="${state.agendaTab === "timeline" ? "active" : ""}" aria-selected="${state.agendaTab === "timeline"}">时间线</button>
        <button type="button" data-agenda-tab="calendar" class="${state.agendaTab === "calendar" ? "active" : ""}" aria-selected="${state.agendaTab === "calendar"}">日历</button>
      </div>
      <div class="seg" data-region-switch><button type="button" data-region="all" class="${state.region === "all" ? "active" : ""}">全部</button><button type="button" data-region="cn" class="${state.region === "cn" ? "active" : ""}">国内</button><button type="button" data-region="intl" class="${state.region === "intl" ? "active" : ""}">国外</button></div>
      <button type="button" class="btn agenda-saved ${state.savedOnly ? "active" : ""}" data-agenda-saved aria-pressed="${state.savedOnly}">★ 仅收藏 ${savedCount}</button>
      <span class="count-label">${items.length} 场</span>
      <button type="button" class="btn" data-export-ics ${savedCount ? "" : "disabled"}>导出 ICS</button>
    </div>
    <div class="agenda-view">${state.agendaTab === "calendar" ? agendaCalendarHtml(items) : agendaTimelineHtml(items)}</div>`;
  }

  function refreshAgenda() {
    if (!state.windows.agenda) return;
    const body = $('.window[data-app="agenda"] .window-body');
    if (body) body.innerHTML = agendaHtml();
  }

  // Compatibility aliases for older menu/notification paths.
  function refreshTimeline() { refreshAgenda(); }
  function refreshSchedule() { refreshAgenda(); }

  function icsText() {
    const items = DEMO_EVENTS.filter(item => state.saved.has(item.id));
    const day = date => String(date).slice(0, 10).replace(/-/g, "");
    const escapeIcs = value => String(value || "").replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Contestline//Arch OS Demo//CN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
    for (const item of items) {
      const date = dateOf(item);
      if (!date) continue;
      lines.push("BEGIN:VEVENT", `UID:contestline-${item.id}-${day(date)}@demo`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${day(date)}`, `SUMMARY:${escapeIcs(`${nodeLabel(item)} · ${cleanTitle(item.title)}`)}`, `DESCRIPTION:${escapeIcs(cleanSummary(item.description) || "赛事节点")}`, `URL:${escapeIcs(item.url || "")}`, "BEGIN:VALARM", "ACTION:DISPLAY", "TRIGGER:-P1D", `DESCRIPTION:${escapeIcs(cleanTitle(item.title))}`, "END:VALARM", "END:VEVENT");
    }
    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
  }

  function exportIcs() {
    if (!DEMO_EVENTS.some(item => state.saved.has(item.id))) {
      toast("先收藏赛事，再导出 ICS");
      return false;
    }
    const blob = new Blob([icsText()], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "contestline-schedule.ics";
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast("已导出当前收藏的 ICS");
    return true;
  }

  /* Submit */
  function submitAuthHtml() {
    if (!API_ENABLED) return `<div class="submit-auth"><span>静态预览不写生产数据</span><a class="btn" href="${ONLINE_ORIGIN}/submit" target="_blank" rel="noreferrer">打开线上投稿</a></div>`;
    if (state.submitLoading && !state.submitMe) return `<div class="submit-auth"><span>正在检查 GitHub 登录…</span></div>`;
    if (!state.submitMe?.auth_enabled) return `<div class="submit-auth"><span>当前站点未启用登录</span></div>`;
    if (!state.submitMe.authenticated) {
      return `<div class="submit-auth"><span>GitHub 登录后提交，审核通过才会公开。</span><a class="btn primary" href="/auth/github?return_to=${encodeURIComponent(authReturnTo("submit"))}">GitHub 登录</a></div>`;
    }
    const user = state.submitMe.user;
    const avatar = safeExternalUrl(user.avatar_url);
    return `<div class="submit-auth"><span class="submit-user">${avatar ? `<img src="${esc(avatar)}" alt="" width="26" height="26" referrerpolicy="no-referrer">` : ""}<strong>${esc(user.display_name || user.login)}</strong><small>已登录</small></span><a class="btn" href="/auth/logout">退出</a></div>`;
  }

  function submitMineHtml() {
    if (!API_ENABLED) return `<p class="submit-muted">静态预览不读取生产投稿。</p>`;
    if (!state.submitMe?.authenticated) return `<p class="submit-muted">登录后可以在这里查看审核状态。</p>`;
    if (!state.submitMine.length) return `<p class="submit-muted">还没有投稿。提交后会进入人工审核。</p>`;
    return `<div class="submit-mine-list">${state.submitMine.map(item => {
      const status = { pending: "待审核", accepted: "已通过", rejected: "未通过" }[item.status] || item.status;
      const date = String(item.created_at || "").slice(0, 10);
      return `<article class="submit-mine-item"><div><strong>${esc(item.title)}</strong><small>${esc(date)}</small></div><span class="submit-state ${esc(item.status)}">${esc(status)}</span>${item.admin_note ? `<p>${esc(item.admin_note)}</p>` : ""}</article>`;
    }).join("")}</div>`;
  }

  function submitHtml() {
    const canSubmit = API_ENABLED && state.submitMe?.authenticated && !state.submitPosting;
    return `<div class="submit-app">
      <div class="submit-heading">
        <div><span class="submit-kicker">NEW ENTRY / REVIEWED</span><h2>提交一场赛事</h2><p>补充赛事名称、官网和简介。管理员审核后，会以草稿进入赛事档案。</p></div>
        <div id="submitAuth">${submitAuthHtml()}</div>
      </div>
      <div class="submit-grid">
        <form id="submitForm" class="submit-form">
          <label class="submit-field"><span>赛事名称 <b>*</b></span><input name="title" maxlength="180" required minlength="3" placeholder="例如：2027 年第十届 XX 大学生竞赛"></label>
          <label class="submit-field"><span>官网 / 报名链接 <b>*</b></span><input name="url" type="url" maxlength="500" required placeholder="https://..."><small>优先填写主办方官网或报名页，不要填转载页。</small></label>
          <div class="submit-row">
            <label class="submit-field"><span>类别 <b>*</b></span><select name="category" required>${SUBMIT_CATEGORIES.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></label>
            <label class="submit-field"><span>方向</span><select name="field">${SUBMIT_FIELDS.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></label>
            <label class="submit-field"><span>预计报名截止</span><input name="expected_deadline" type="date"></label>
          </div>
          <label class="submit-field"><span>赛事简介 <b>*</b></span><textarea name="description" id="submitDescription" maxlength="4000" minlength="10" rows="6" required placeholder="主办方、赛制、适合谁参加、为什么值得收录…"></textarea><small><span id="submitCount">0</span> / 4000 字 · 至少 10 字</small></label>
          <div class="submit-actions"><span id="submitMessage" role="status" class="${state.submitMessage ? "ok" : ""}">${esc(state.submitMessage || state.submitError)}</span><button type="submit" class="btn primary" ${canSubmit ? "" : "disabled"}>提交审核</button></div>
        </form>
        <aside class="submit-aside">
          <h3>审核流程</h3>
          <ol><li>检查官网与赛事名称</li><li>补全日期、赛制与来源</li><li>通过后进入草稿并公开</li></ol>
          <p>投稿不会自动上线。请尽量提供主办方页面，避免二手转载。</p>
          <h3>本地保存</h3>
          <p>表单本身不写入 localStorage；提交后只保存到服务端。</p>
        </aside>
      </div>
      <section class="submit-mine"><header><h3>我的投稿</h3><button type="button" class="btn" data-refresh-submit>刷新</button></header>${submitMineHtml()}</section>
    </div>`;
  }

  function refreshSubmitAuth() {
    if (!state.windows.submit) return;
    const old = $('#submitAuth');
    if (old) old.innerHTML = submitAuthHtml();
    const form = $('#submitForm');
    if (form) {
      const button = form.querySelector('button[type=submit]');
      if (button) button.disabled = !(API_ENABLED && state.submitMe?.authenticated && !state.submitPosting);
    }
  }

  function refreshSubmitMine() {
    if (!state.windows.submit) return;
    const target = $('.submit-mine');
    if (target) target.innerHTML = `<header><h3>我的投稿</h3><button type="button" class="btn" data-refresh-submit>刷新</button></header>${submitMineHtml()}`;
  }

  async function loadSubmitMine() {
    if (!API_ENABLED || !state.submitMe?.authenticated) { state.submitMine = []; refreshSubmitMine(); return; }
    try {
      const response = await fetch("/api/v1/submissions/mine", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      state.submitMine = Array.isArray(data.items) ? data.items : [];
      refreshSubmitMine();
    } catch { /* ignore */ }
  }

  async function loadSubmit() {
    if (!API_ENABLED) { refreshSubmitAuth(); refreshSubmitMine(); return; }
    state.submitLoading = true;
    refreshSubmitAuth();
    try {
      const response = await fetch("/api/v1/me", { cache: "no-store" });
      state.submitMe = await response.json();
    } catch {
      state.submitMe = { auth_enabled: false, authenticated: false, user: null };
    } finally {
      state.submitLoading = false;
      refreshSubmitAuth();
      await loadSubmitMine();
    }
  }

  async function postSubmission(form) {
    if (!state.submitMe?.authenticated) { loadSubmit(); return; }
    const body = Object.fromEntries(new FormData(form).entries());
    const message = $('#submitMessage');
    state.submitPosting = true;
    state.submitMessage = "";
    state.submitError = "";
    refreshSubmitAuth();
    if (message) { message.textContent = "正在提交…"; message.className = ""; }
    try {
      const response = await fetch("/api/v1/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) { await loadSubmit(); return; }
        throw new Error(data.message || `HTTP ${response.status}`);
      }
      form.reset();
      state.submitMessage = "已提交，等待管理员审核。";
      state.submitError = "";
      if (message) { message.textContent = state.submitMessage; message.className = "ok"; }
      const count = $('#submitCount'); if (count) count.textContent = "0";
      await loadSubmitMine();
    } catch (error) {
      state.submitError = error.message || "提交失败，请稍后重试。";
      state.submitMessage = "";
      if (message) { message.textContent = state.submitError; message.className = "err"; }
    } finally {
      state.submitPosting = false;
      refreshSubmitAuth();
    }
  }

  /* Board */
  function safeExternalUrl(value) {
    if (!value) return "";
    try {
      const url = new URL(String(value), ONLINE_ORIGIN);
      return url.protocol === "https:" ? url.href : "";
    } catch { return ""; }
  }

  function safeLink(value) {
    if (!value) return "";
    try {
      const url = new URL(String(value), ONLINE_ORIGIN);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch { return ""; }
  }

  function boardAuthHtml() {
    if (!API_ENABLED) return `<div class="board-auth"><span>GitHub 登录后发言</span><a class="btn" href="${ONLINE_ORIGIN}/board" target="_blank" rel="noreferrer">打开线上留言板</a></div>`;
    if (state.boardLoading && !state.boardMe) return `<div class="board-auth"><span>正在读取登录状态…</span></div>`;
    if (!state.boardMe?.auth_enabled) return `<div class="board-auth"><span>当前站点未启用登录</span></div>`;
    if (!state.boardMe.authenticated) return `<div class="board-auth"><span>GitHub 登录后发言</span><a class="btn" href="/auth/github?return_to=${encodeURIComponent(authReturnTo("board"))}">登录</a></div>`;
    const user = state.boardMe.user;
    const avatar = safeExternalUrl(user.avatar_url);
    return `<div class="board-auth"><span class="board-user">${avatar ? `<img src="${esc(avatar)}" alt="" width="28" height="28" referrerpolicy="no-referrer">` : ""}<strong>${esc(user.display_name || user.login)}</strong></span><a class="btn" href="/auth/logout">退出</a></div>`;
  }

  function boardListHtml() {
    if (state.boardLoading && !state.comments.length) return `<div class="board-empty">正在加载留言…</div>`;
    if (state.boardError) return `<div class="board-empty"><strong>留言加载失败</strong><button type="button" class="btn" data-refresh-board>重试</button></div>`;
    if (!state.comments.length) return `<div class="board-empty"><strong>暂无公开留言</strong><span>登录后发起第一条讨论</span></div>`;
    return state.comments.map(item => {
      const avatar = safeExternalUrl(item.avatar_url);
      const profile = safeExternalUrl(item.profile_url);
      const author = item.display_name || item.login;
      const stamp = new Date(item.created_at);
      const time = Number.isNaN(stamp.getTime()) ? String(item.created_at || "") : stamp.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
      return `<article class="board-item" data-comment="${item.id}"><header>${avatar ? `<img class="board-avatar" src="${esc(avatar)}" alt="" width="30" height="30" referrerpolicy="no-referrer">` : ""}${profile ? `<a class="board-author" href="${esc(profile)}" target="_blank" rel="noreferrer">${esc(author)}</a>` : `<strong class="board-author">${esc(author)}</strong>`}<time>${esc(time)}</time></header><p class="board-body">${esc(item.body)}</p></article>`;
    }).join("");
  }

  function boardHtml() {
    const canPost = API_ENABLED && state.boardMe?.authenticated && !state.boardPosting;
    return `<div class="board-app">
      <div class="app-toolbar"><span class="count-label">公开留言 · ${state.comments.length} 条</span><button type="button" class="btn" data-refresh-board>刷新</button></div>
      <section class="board-composer" aria-label="发布留言">
        ${boardAuthHtml()}
        <label class="sr-only" for="boardDraft">留言内容</label>
        <textarea id="boardDraft" maxlength="1000" rows="3" placeholder="${canPost ? "分享赛制、报名或备赛经验…" : "登录后参与讨论"}" ${canPost ? "" : "disabled"}>${esc(state.boardDraft)}</textarea>
        <div class="board-composer-foot"><span id="boardMessage" role="status">${esc(state.boardMessage)}</span><span class="board-count">${state.boardDraft.length} / 1000</span><button type="button" class="btn primary" data-post-comment ${canPost ? "" : "disabled"}>发布留言</button></div>
      </section>
      <div class="board-list">${boardListHtml()}</div>
    </div>`;
  }

  function refreshBoard() {
    if (!state.windows.board) return;
    const body = $('.window[data-app="board"] .window-body');
    if (body) body.innerHTML = boardHtml();
  }

  async function loadBoard() {
    if (!API_ENABLED) {
      state.comments = [];
      state.boardError = "";
      refreshBoard();
      return;
    }
    if (state.boardLoading) return;
    state.boardLoading = true;
    state.boardError = "";
    refreshBoard();
    try {
      const [meResponse, commentsResponse] = await Promise.all([
        fetch("/api/v1/me", { cache: "no-store" }),
        fetch("/api/v1/comments", { cache: "no-store" }),
      ]);
      if (!meResponse.ok || !commentsResponse.ok) throw new Error("请求失败");
      state.boardMe = await meResponse.json();
      const data = await commentsResponse.json();
      state.comments = Array.isArray(data.items) ? data.items : [];
    } catch (error) {
      state.boardError = String(error.message || error);
    } finally {
      state.boardLoading = false;
      refreshBoard();
    }
  }

  async function postBoardComment() {
    const body = state.boardDraft.trim();
    if (!body) {
      state.boardMessage = "先写点内容";
      refreshBoard();
      return;
    }
    if (!API_ENABLED || !state.boardMe?.authenticated || state.boardPosting) return;
    state.boardPosting = true;
    state.boardMessage = "";
    refreshBoard();
    try {
      const response = await fetch("/api/v1/comments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        state.boardMe = { ...state.boardMe, authenticated: false };
        throw new Error("登录已过期，请重新登录");
      }
      if (!response.ok) throw new Error(data.message || "发布失败");
      state.boardDraft = "";
      state.boardMessage = "已发布";
      await loadBoard();
    } catch (error) {
      state.boardMessage = String(error.message || error);
    } finally {
      state.boardPosting = false;
      refreshBoard();
    }
  }

  /* Push */
  const pushTimers = [];
  function savePush() {
    try { localStorage.setItem(PUSH_KEY, JSON.stringify(state.push)); } catch { /* ignore */ }
  }
  function pushPermission() {
    return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
  }
  function pushHtml() {
    const permission = pushPermission();
    const enabled = state.push.enabled && permission === "granted";
    return `<div class="push-app">
      <section class="push-block">
        <div class="push-row"><div><h2>临近节点</h2><p>${urgentEvents().length} 个节点在 3 天内</p></div><button type="button" class="switch" role="switch" aria-checked="${state.push.enabled}" aria-label="浏览器通知" data-push-toggle ${permission === "unsupported" ? "disabled" : ""}><span></span></button></div>
        <p class="push-note">浏览器通知 · 页面打开时有效</p>
        ${permission === "denied" ? `<p class="push-warning">通知权限已被拒绝，请在浏览器站点设置中开启。</p>` : ""}
        ${permission === "unsupported" ? `<p class="push-warning">当前浏览器不支持通知，可使用下方日历订阅。</p>` : ""}
        <div class="push-options"><label>提醒时间<select id="pushLead"><option value="0" ${state.push.lead === 0 ? "selected" : ""}>当天 09:00</option><option value="1" ${state.push.lead === 1 ? "selected" : ""}>提前 1 天</option><option value="3" ${state.push.lead === 3 ? "selected" : ""}>提前 3 天</option></select></label><div><span>通知范围</span><button type="button" class="range-toggle" data-push-saved>${state.push.savedOnly ? "仅收藏赛事" : "全部赛事"}</button></div></div>
      </section>
      <section class="push-block"><h2>日历订阅</h2><div class="subscription-links"><a class="btn primary" href="webcal://contest.07212006.xyz/api/v1/ical/all.ics">全部赛事</a><a class="btn" href="webcal://contest.07212006.xyz/api/v1/ical/region/cn.ics">国内</a><a class="btn" href="webcal://contest.07212006.xyz/api/v1/ical/region/intl.ics">国外</a></div><button type="button" class="btn" data-copy-ics>复制 ICS 地址</button></section>
      <section class="push-block"><div class="push-row"><h2>通知测试</h2><button type="button" class="btn" data-test-push ${enabled ? "" : "disabled"}>发送测试通知</button></div></section>
    </div>`;
  }
  function refreshPush() {
    if (!state.windows.push) return;
    const body = $('.window[data-app="push"] .window-body');
    if (body) body.innerHTML = pushHtml();
  }
  function sendBrowserNotification(title, body, tag = "contestline") {
    if (pushPermission() !== "granted" || !state.push.enabled) return;
    const notification = new Notification(title, { body, tag, icon: "./favicon.svg" });
    notification.onclick = () => { window.focus(); openApp("push"); };
  }
  function schedulePushNotifications() {
    while (pushTimers.length) clearTimeout(pushTimers.pop());
    if (!state.push.enabled || pushPermission() !== "granted") return;
    const items = DEMO_EVENTS.filter(item => !state.push.savedOnly || state.saved.has(item.id));
    for (const item of items) {
      const date = dateOf(item);
      if (!date) continue;
      const target = new Date(`${date.slice(0, 10)}T09:00:00+08:00`).getTime() - state.push.lead * 86400000;
      const delay = target - Date.now();
      if (delay <= 0 || delay > 2147483647) continue;
      pushTimers.push(setTimeout(() => sendBrowserNotification(cleanTitle(item.title), `${nodeLabel(item)} · ${dateParts(date)?.label || "待定"}`, `contest-${item.id}`), delay));
    }
  }
  async function togglePush() {
    if (state.push.enabled) {
      state.push.enabled = false;
      savePush();
      schedulePushNotifications();
      refreshPush();
      $('[data-push-toggle]')?.focus();
      toast("已关闭浏览器通知");
      return;
    }
    let permission = pushPermission();
    if (permission === "unsupported" || permission === "denied") {
      toast(permission === "denied" ? "请在浏览器站点设置中允许通知" : "当前浏览器不支持通知");
      return;
    }
    if (permission !== "granted") permission = await Notification.requestPermission();
    if (permission !== "granted") {
      toast("未获得通知权限，可使用 ICS 日历订阅");
      refreshPush();
      return;
    }
    state.push.enabled = true;
    savePush();
    schedulePushNotifications();
    refreshPush();
    $('[data-push-toggle]')?.focus();
    toast("已开启页面内浏览器通知");
  }
  async function copyText(text, label = "链接") {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(text); toast(`已复制${label}`); return true; } catch { /* fall through */ }
    }
    toast("无法自动复制，请从文档中获取地址");
    return false;
  }

  /* Docs */
  const DOC_TABS = [["api", "API v1"], ["data", "数据口径"], ["comments", "留言板"], ["ics", "ICS 日历"]];
  function docArticleHtml() {
    if (state.docTab === "data") return `<h2>数据口径</h2><ul><li>赛事信息来自公开来源或人工整理，可能包含预计、暂定和待定日期。</li><li>国内 / 国外是聚合标签，不代表官方参赛资格。</li><li>时间默认使用 Asia/Shanghai，跨时区赛事可能存在日期差异。</li><li>新采集内容经过审核后公开，分类与方向可能需要人工修正。</li></ul><div class="doc-actions"><a class="btn" href="${ONLINE_ORIGIN}/docs.html#data" target="_blank" rel="noreferrer">完整免责声明</a></div>`;
    if (state.docTab === "comments") return `<h2>留言板</h2><p>阅读公开，发言需要 GitHub 登录。正文 1–1000 字，每 10 分钟最多 3 条、每天最多 20 条。</p><pre><code>GET /api/v1/comments
GET /api/v1/comments?edition_id=232
POST /api/v1/comments</code></pre><div class="doc-actions"><button type="button" class="btn primary" data-open="board">打开留言板</button></div>`;
    if (state.docTab === "ics") return `<h2>ICS 日历</h2><p>阶段级 UID 稳定；只有确认的截止时间包含精确 VALARM，默认时区为 Asia/Shanghai。</p><pre><code>GET /api/v1/ical/all.ics
GET /api/v1/ical/region/cn.ics
GET /api/v1/ical/region/intl.ics
GET /api/v1/ical/category/mathmodel.ics</code></pre><div class="doc-actions"><button type="button" class="btn primary" data-open="push">打开推送与订阅</button></div>`;
    return `<h2>公开 API v1</h2><div class="doc-base"><code>${ONLINE_ORIGIN}/api/v1</code><button type="button" class="btn" data-copy-api>复制地址</button></div><div class="doc-table-wrap"><table><thead><tr><th>方法</th><th>路径</th><th>用途</th></tr></thead><tbody><tr><td>GET</td><td><code>/editions</code></td><td>赛事列表、筛选与分页</td></tr><tr><td>GET</td><td><code>/editions/:id</code></td><td>赛事详情与阶段</td></tr><tr><td>GET</td><td><code>/taxonomy</code></td><td>分类字典</td></tr><tr><td>GET</td><td><code>/stats</code></td><td>公开统计</td></tr><tr><td>GET</td><td><code>/changes</code></td><td>公开变更</td></tr><tr><td>GET</td><td><code>/comments</code></td><td>公开留言</td></tr><tr><td>GET</td><td><code>/health</code></td><td>健康检查</td></tr><tr><td>GET</td><td><code>/ical/all.ics</code></td><td>公共日历</td></tr></tbody></table></div><h3>请求示例</h3><pre><code>curl '${ONLINE_ORIGIN}/api/v1/editions?region=cn&amp;category=mathmodel&amp;size=5'</code></pre><div class="doc-actions"><a class="btn" href="${ONLINE_ORIGIN}/docs.html" target="_blank" rel="noreferrer">线上完整文档</a><a class="btn" href="https://github.com/Cristallin2006/contest-radar/issues" target="_blank" rel="noreferrer">提交纠错</a></div>`;
  }
  function docsHtml() {
    return `<div class="docs-app"><div class="doc-notice">信息以主办方官网为准 · 时间按 Asia/Shanghai 展示</div><div class="docs-layout"><nav class="doc-nav" aria-label="文档目录">${DOC_TABS.map(([id, label]) => `<button type="button" data-doc-tab="${id}" class="${state.docTab === id ? "active" : ""}" aria-pressed="${state.docTab === id}">${label}</button>`).join("")}</nav><article class="doc-article">${docArticleHtml()}<footer class="doc-site-links"><span>站点入口</span><a href="${ONLINE_ORIGIN}/hall" target="_blank" rel="noreferrer">竞赛馆</a><a href="${ONLINE_ORIGIN}/changes" target="_blank" rel="noreferrer">公开变更</a><a href="${ONLINE_ORIGIN}/miit" target="_blank" rel="noreferrer">工信部相关</a><a href="${ONLINE_ORIGIN}/list" target="_blank" rel="noreferrer">卡片列表</a></footer></article></div></div>`;
  }
  function refreshDocs() {
    if (!state.windows.docs) return;
    const body = $('.window[data-app="docs"] .window-body');
    if (body) body.innerHTML = docsHtml();
  }

  /* Terminal */
  function promptHtml() {
    return `<span class="terminal-prompt"><span class="prompt-user">guest</span><span class="prompt-at">@</span><span class="prompt-host">contestline</span><span class="prompt-path">:~$</span></span>`;
  }

  function fetchHtml() {
    const logo = String.raw`       /\
      /  \
     / /\ \
    / /  \ \
   / /    \ \
  / /      \ \
 / /   /\   \ \
/ /___/  \___\ \ `;
    const cn = DEMO_EVENTS.filter(item => regionOf(item) === "cn").length;
    const intl = DEMO_EVENTS.length - cn;
    const colors = THEMES[state.theme].palette.map((color, index) => `<span class="term-color-${index}"></span>`).join("");
    return `<section class="terminal-fetch native-fetch" aria-label="系统信息">
      <pre class="fetch-logo" aria-hidden="true">${esc(logo)}</pre>
      <div class="fetch-info">
        <div class="fetch-identity"><span class="fetch-user">guest</span>@<span class="fetch-host">contestline</span></div>
        <section class="fetch-panel">
          <h2 class="fetch-panel-title">Software</h2>
          <dl>
            <div><dt>OS</dt><dd>Contestline Linux x86_64</dd></div>
            <div><dt>Kernel</dt><dd>contest-shell 0.3</dd></div>
            <div><dt>WM</dt><dd>Hyprland · Wayland</dd></div>
            <div><dt>Terminal</dt><dd>kitty · ${state.theme === "wallhaven" ? "JetBrains Mono" : "Cascadia Code"}</dd></div>
            <div><dt>Theme</dt><dd data-fetch-theme>${esc(THEMES[state.theme].name)}</dd></div>
          </dl>
        </section>
        <section class="fetch-panel">
          <h2 class="fetch-panel-title">Contestline</h2>
          <dl>
            <div><dt>Events</dt><dd>${DEMO_EVENTS.length} public</dd></div>
            <div><dt>Regions</dt><dd>${cn} CN / ${intl} INTL</dd></div>
            <div><dt>Workspace</dt><dd>${state.workspace} / 3</dd></div>
            <div><dt>Saved</dt><dd>${state.saved.size} local</dd></div>
          </dl>
        </section>
        <div class="fetch-bottom"><span><b>${DEMO_LIVE ? "Read" : "Snapshot"}</b> ${esc(syncTime(DEMO_UPDATED))}</span><span><b>Timezone</b> Asia/Shanghai</span></div>
        <div class="fetch-colors" aria-hidden="true">${colors}</div>
      </div>
    </section>`;
  }

  function terminalLineHtml(line) {
    if (line.kind === "welcome" || line.kind === "fetch") return fetchHtml();
    if (line.kind === "command") return `<div class="term-line command">${promptHtml()}<span class="term-command-text">${esc(line.text)}</span></div>`;
    return `<div class="term-line ${line.kind}">${esc(line.text)}</div>`;
  }

  function terminalHtml() {
    return `<div class="terminal-app"><div class="terminal-scroll" id="terminalScroll"><div class="terminal-output" id="terminalOutput" role="log" aria-live="polite">${state.terminalLines.map(terminalLineHtml).join("")}</div><form class="terminal-form" id="terminalForm"><label class="terminal-prompt" for="terminalInput"><span class="prompt-user">guest</span><span class="prompt-at">@</span><span class="prompt-host">contestline</span><span class="prompt-path">:~$</span></label><input id="terminalInput" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="终端命令"></form></div></div>`;
  }

  function scrollTerminal() {
    const scroll = $("#terminalScroll");
    if (scroll) scroll.scrollTop = scroll.scrollHeight;
  }

  function initTerminal() {
    if (!state.terminalLines.length) state.terminalLines = [{ text: "", kind: "fetch" }];
    const output = $("#terminalOutput");
    if (output) output.innerHTML = state.terminalLines.map(terminalLineHtml).join("");
    scrollTerminal();
  }

  function appendTerm(text, kind = "") {
    const line = { text, kind };
    state.terminalLines.push(line);
    if (state.terminalLines.length > 120) state.terminalLines.splice(0, state.terminalLines.length - 120);
    const output = $("#terminalOutput");
    if (output) output.insertAdjacentHTML("beforeend", terminalLineHtml(line));
    scrollTerminal();
  }

  const SHELL_COMMANDS = ["help", "fetch", "fastfetch", "neofetch", "theme", "history", "man", "ls", "open", "workspace", "tile", "rofi", "filter", "search", "save", "unsave", "ics", "desktop", "status", "date", "whoami", "pwd", "uname", "clear", "exit"];

  function clearTerminal() {
    state.terminalLines = [];
    const output = $("#terminalOutput");
    if (output) output.innerHTML = "";
  }

  function completeTerminal(input) {
    const raw = input.value;
    const parts = raw.trimStart().split(/\s+/);
    const fragment = parts.at(-1) || "";
    let candidates = [];
    if (parts.length === 1) candidates = SHELL_COMMANDS.filter(command => command.startsWith(fragment));
    else {
      const command = parts[0].toLowerCase();
      let options = [];
      if (command === "open") options = [...Object.keys(APP_DEFS), ...DEMO_EVENTS.map(item => String(item.id))];
      if (command === "theme") options = ["wallhaven", "afterglow", "atelier"];
      if (command === "workspace") options = ["1", "2", "3"];
      if (command === "filter") options = CATEGORIES.map(category => category.key);
      if (command === "desktop") options = WALLPAPERS.map(sheet => sheet.id);
      if (command === "man") options = DOC_TABS.map(([id]) => id);
      candidates = options.filter(option => option.startsWith(fragment));
    }
    if (candidates.length === 1) {
      input.value = `${raw.slice(0, raw.length - fragment.length)}${candidates[0]} `;
      input.setSelectionRange(input.value.length, input.value.length);
    } else if (candidates.length > 1) {
      appendTerm(raw, "command");
      appendTerm(candidates.join("  "), "muted");
    }
  }

  function runCommand(raw) {
    const input = String(raw || "").trim();
    if (!input) return;
    state.terminalHistory.push(input);
    if (state.terminalHistory.length > 100) state.terminalHistory.shift();
    state.terminalHistoryIndex = state.terminalHistory.length;
    appendTerm(input, "command");
    const [command, ...args] = input.split(/\s+/);
    const arg = args.join(" ");
    switch (command.toLowerCase()) {
      case "help":
        appendTerm("fetch · theme [wallhaven|afterglow|atelier] · man [api|data|comments|ics] · ls");
        appendTerm("open <app|id> · filter <type> · search <text> · save <id> · unsave <id>");
        appendTerm("ics · desktop <id> · workspace <1-3> · tile · rofi · status");
        appendTerm("history · pwd · uname · date · whoami · clear · exit");
        break;
      case "fetch":
      case "fastfetch":
      case "neofetch":
        appendTerm("", "fetch");
        break;
      case "theme": {
        const aliases = { wallhaven: "wallhaven", omarchy: "wallhaven", afterglow: "afterglow", atelier: "atelier", ateliersulphurpool: "atelier", sulphurpool: "atelier" };
        const next = aliases[arg.toLowerCase()];
        if (!arg) {
          appendTerm(`theme = ${state.theme}`, "success");
          appendTerm("usage: theme <wallhaven|afterglow|atelier>");
        } else if (next) {
          setTheme(next, { notify: false });
          appendTerm(`theme = ${next}`, "success");
        } else appendTerm(`unknown theme: ${arg}. use wallhaven, afterglow or atelier`, "error");
        break;
      }
      case "history":
        state.terminalHistory.forEach((entry, index) => appendTerm(`${String(index + 1).padStart(4)}  ${entry}`));
        break;
      case "man":
        if (DOC_TABS.some(([id]) => id === arg)) {
          state.docTab = arg;
          openApp("docs");
          appendTerm(`opened docs/${arg}`, "success");
        } else appendTerm("usage: man <api|data|comments|ics>", "error");
        break;
      case "ls":
        if (arg === "/contests") filteredEvents().forEach(item => appendTerm(`${String(item.id).padEnd(4)} ${cleanTitle(item.title)}`));
        else appendTerm("contests  agenda  board  submit  push  docs  terminal  wallpaper", "info");
        break;
      case "open":
        if (APP_DEFS[arg]) { openApp(arg); appendTerm(`opened ${arg}`, "success"); }
        else if (eventFor(arg)) { openDetail(Number(arg)); appendTerm(`opened events/${arg}`, "success"); }
        else appendTerm(`app or event not found: ${arg || "(empty)"}`, "error");
        break;
      case "workspace":
        if (["1", "2", "3"].includes(arg)) { switchWorkspace(Number(arg)); appendTerm(`workspace ${arg}`, "success"); }
        else appendTerm("usage: workspace <1-3>", "error");
        break;
      case "tile": toggleTiled(); appendTerm(`tiling ${state.tiled ? "enabled" : "disabled"}`, "success"); break;
      case "rofi": openRofi(); break;
      case "filter":
        if (CATEGORIES.some((cat) => cat.key === arg)) { state.category = arg; openApp("contests"); refreshContests(); appendTerm(`filter = ${arg}`, "success"); }
        else appendTerm(`unknown filter: ${arg}`, "error");
        break;
      case "search":
        state.q = arg; openApp("contests"); refreshContests(); appendTerm(`search = ${arg || "(empty)"}`);
        break;
      case "save":
      case "unsave": {
        const item = eventFor(Number(arg));
        if (!item) { appendTerm(`event not found: ${arg}`, "error"); break; }
        if (command.toLowerCase() === "save") state.saved.add(item.id); else state.saved.delete(item.id);
        saveSaved(); updateShellCounts(); refreshContests(); refreshSchedule(); appendTerm(`${command} ${item.id}`, "success");
        break;
      }
      case "ics":
        if (exportIcs()) appendTerm("exported contestline-schedule.ics", "success");
        else appendTerm("no saved contests; use save <id> first", "error");
        break;
      case "desktop": {
        const sheet = WALLPAPERS.find((item) => item.id === arg) || WALLPAPERS.find((item) => item.name.toLowerCase() === arg.toLowerCase());
        if (!sheet) { appendTerm(`wallpaper not found: ${arg}`, "error"); break; }
        state.wallpaper.id = sheet.id; state.wallpaperSelected = sheet.id; paintWallpaper(); saveWallpaper(); refreshWallpaper(); appendTerm(`wallpaper = ${sheet.id}`, "success");
        break;
      }
      case "status": {
        const openCount = Object.keys(state.windows).length;
        appendTerm(`赛事 ${DEMO_EVENTS.length} · 收藏 ${state.saved.size} · 窗口 ${openCount}`, "success");
        appendTerm(`${DEMO_LIVE ? `LIVE · ${liveFreshnessText()}` : `公开快照 · ${String(DEMO_UPDATED).slice(0, 10)}`} · 国内 ${DEMO_EVENTS.filter(item => regionOf(item) === "cn").length} / 国外 ${DEMO_EVENTS.filter(item => regionOf(item) === "intl").length}`);
        break;
      }
      case "pwd": appendTerm("/home/guest"); break;
      case "uname": appendTerm(arg === "-a" ? "Contestline contest-shell 0.2 x86_64" : "Contestline"); break;
      case "date": appendTerm(new Date().toString()); break;
      case "whoami": appendTerm("guest"); break;
      case "clear": clearTerminal(); break;
      case "exit": closeApp("terminal"); break;
      default: appendTerm(`zsh: command not found: ${command}; type help`, "error");
    }
  }

  /* Wallpaper */
  function themeChoicesHtml() {
    return Object.entries(THEMES).map(([id, theme]) => `<button type="button" class="theme-choice" data-theme-choice="${id}" aria-pressed="${state.theme === id}">
      <span class="theme-choice-head"><strong>${esc(theme.name)}</strong></span>
      <span class="theme-palette" aria-hidden="true">${theme.palette.map(color => `<span style="--swatch:${color}"></span>`).join("")}</span>
    </button>`).join("");
  }

  function wallpaperHtml() {
    const selected = WALLPAPERS.find((item) => item.id === state.wallpaperSelected) || WALLPAPERS[0];
    const current = WALLPAPERS.find((item) => item.id === state.wallpaper.id) || WALLPAPERS[0];
    const pending = selected.id !== current.id;
    return `<div class="wallpaper-app ${pending ? "has-pending" : ""}">
        <div class="wallpaper-library"><div class="wallpaper-grid" id="wallpaperGrid">${WALLPAPERS.map((item) => `<button type="button" class="wallpaper-card ${item.id === selected.id ? "selected" : ""} ${item.id === current.id ? "current" : ""}" data-wallpaper="${item.id}"><img class="wallpaper-thumb" src="${item.file}" alt="${esc(item.cn)} ${esc(item.name)}" width="320" height="180" loading="lazy"><span class="wallpaper-meta"><span class="wallpaper-name">${esc(item.cn)}</span></span></button>`).join("")}</div></div>
        <aside class="wallpaper-side">
          <section class="theme-settings" aria-label="窗口与终端主题">
            <span class="setting-title">窗口与终端主题</span>
            <div class="theme-options">${themeChoicesHtml()}</div>
          </section>
          <div class="wallpaper-preview" id="wallpaperPreview" style="background-image:url('${selected.file}')"></div>
          <h2>${esc(selected.name)}</h2>
          <select class="fit-select" id="wallFit" aria-label="显示方式"><option value="cover" ${state.wallpaper.fit === "cover" ? "selected" : ""}>填充屏幕</option><option value="contain" ${state.wallpaper.fit === "contain" ? "selected" : ""}>适应屏幕</option><option value="repeat" ${state.wallpaper.fit === "repeat" ? "selected" : ""}>平铺</option><option value="center" ${state.wallpaper.fit === "center" ? "selected" : ""}>居中</option></select>
          <div class="actions"><button type="button" class="btn primary" data-apply-wallpaper>应用壁纸</button><button type="button" class="btn" data-random-wallpaper>随机一张</button></div>
        </aside>
        ${pending ? '<div class="wallpaper-mobile-actions"><button type="button" class="btn primary" data-apply-wallpaper>应用壁纸</button></div>' : ""}
      </div>`;
  }

  function refreshWallpaper() {
    if (!state.windows.wallpaper) return;
    const body = $('.window[data-app="wallpaper"] .window-body');
    if (body) body.innerHTML = wallpaperHtml();
  }

  function applyWallpaper() {
    state.wallpaper.id = state.wallpaperSelected;
    paintWallpaper();
    saveWallpaper();
    refreshWallpaper();
    toast(`已应用壁纸：${WALLPAPERS.find((item) => item.id === state.wallpaper.id).cn}`);
  }

  function closeMenus() {
    $$(".menu-pop").forEach((pop) => { pop.hidden = true; });
    $$(".menu-trigger").forEach((trigger) => trigger.setAttribute("aria-expanded", "false"));
  }

  function toggleWindowMenu(button) {
    const key = button.dataset.menu;
    const pop = $(`[data-menu-pop="${key}"]`);
    if (!pop) return;
    const willOpen = pop.hidden;
    closeMenus();
    pop.hidden = !willOpen;
    button.setAttribute("aria-expanded", String(willOpen));
  }

  function runMenuCommand(action, id) {
    closeMenus();
    if (action === "close") closeApp(id);
    else if (action === "refresh") refreshContests();
    else if (action === "ics") exportIcs();
    else if (action === "clear") clearTerminal();
    else if (action === "shell-help") { appendTerm("help → 命令列表"); appendTerm("fastfetch / theme atelier / pwd / uname / filter ctf / save 14 / ics"); }
    else if (action === "about") showAbout();
    else if (action === "apply-wallpaper") applyWallpaper();
    else if (action === "random-wallpaper") { state.wallpaperSelected = WALLPAPERS[Math.floor(Math.random() * WALLPAPERS.length)].id; refreshWallpaper(); }
    else if (action === "official") { const item = eventFor(state.selected); if (item && item.url) window.open(item.url, "_blank", "noopener"); }
    else if (action.startsWith("open:")) openApp(action.slice(5));
  }

  function rofiCommands() {
    return [
      ...Object.entries(APP_DEFS).filter(([id]) => id !== "detail").map(([id, def]) => ({ group: "应用", label: def.title, hint: def.path, icon: def.glyph, action: () => openApp(id) })),
      ...Object.entries(state.windows).map(([id, win]) => ({ group: "运行窗口", label: windowTitle(id), hint: `工作区 ${win.workspace}${win.minimized ? " · 已最小化" : " · 运行中"}`, icon: APP_DEFS[id].glyph, action: () => { switchWorkspace(win.workspace); openApp(id); } })),
      { group: "系统", label: state.tiled ? "关闭平铺模式" : "开启平铺模式", hint: "窗口布局", icon: "tile", action: () => toggleTiled() },
      ...[1, 2, 3].map(id => ({ group: "系统", label: `切换到工作区 ${id}`, hint: id === state.workspace ? "当前工作区" : "保留该工作区的窗口布局", icon: "grid", action: () => switchWorkspace(id) })),
      { group: "系统", label: "打开截止通知", hint: `${urgentEvents().length} 条临近节点`, icon: "bell", action: () => toggleNotifications(true) },
      { group: "帮助", label: "使用指引", hint: "快捷键与手机导航", icon: "docs", action: () => openOnboarding() },
      ...Object.entries(THEMES).map(([id, theme]) => ({ group: "外观", label: `使用 ${theme.name}`, hint: `${theme.note}${id === state.theme ? " · 当前主题" : ""}`, icon: "wallpaper", action: () => setTheme(id) })),
      { group: "桌面", label: state.upcomingVisible ? "隐藏下一节点组件" : "显示下一节点组件", hint: "桌面组件", icon: "calendar", action: () => toggleUpcoming() },
    ];
  }

  function renderRofi() {
    const query = $("#rofiInput").value.trim();
    const commandMode = query.startsWith(">");
    const normalized = query.replace(/^>\s*/, "").toLocaleLowerCase("zh-CN");
    const commands = rofiCommands().filter(item => !normalized || `${item.label} ${item.hint}`.toLocaleLowerCase("zh-CN").includes(normalized));
    const events = commandMode ? [] : DEMO_EVENTS.filter(item => !normalized || [item.title, item.organizer, item.category_label, item.source_name].join(" ").toLocaleLowerCase("zh-CN").includes(normalized)).slice(0, 6).map(item => ({ group: "赛事", label: cleanTitle(item.title), hint: `${nodeLabel(item)} · ${dateParts(dateOf(item))?.label || "待定"}`, icon: "arrow", action: () => openDetail(item.id) }));
    state.rofiItems = [...commands, ...events];
    state.rofiIndex = Math.max(0, Math.min(state.rofiIndex, state.rofiItems.length - 1));
    let group = "";
    $("#rofiResults").innerHTML = state.rofiItems.length ? state.rofiItems.map((item, index) => {
      const heading = item.group !== group ? `<div class="rofi-group">${esc(item.group)}</div>` : "";
      group = item.group;
      return `${heading}<button class="rofi-item ${index === state.rofiIndex ? "active" : ""}" id="rofi-option-${index}" type="button" role="option" aria-selected="${index === state.rofiIndex}" data-rofi-index="${index}">${icon(item.icon)}<span class="rofi-item-text"><strong>${esc(item.label)}</strong><small>${esc(item.hint)}</small></span></button>`;
    }).join("") : `<div class="rofi-empty">没有匹配结果。试试应用名称、赛事名称或工作区。</div>`;
    if (state.rofiItems.length) $("#rofiInput").setAttribute("aria-activedescendant", `rofi-option-${state.rofiIndex}`);
    else $("#rofiInput").removeAttribute("aria-activedescendant");
    $(".rofi-item.active")?.scrollIntoView({ block: "nearest" });
  }

  let rofiReturnFocus = null;
  function openRofi() {
    if (state.rofiOpen) return;
    if (state.onboardingOpen) closeOnboarding({ restore: false });
    rofiReturnFocus = document.activeElement;
    state.rofiOpen = true;
    state.rofiIndex = 0;
    toggleNotifications(false);
    $("#rofi").hidden = false;
    $("#rofiScrim").hidden = false;
    $("#rofiInput").value = "";
    renderRofi();
    $("#rofiInput").focus();
  }

  function closeRofi(restore = true) {
    if (!state.rofiOpen) return;
    state.rofiOpen = false;
    $("#rofi").hidden = true;
    $("#rofiScrim").hidden = true;
    if (restore && rofiReturnFocus?.isConnected) rofiReturnFocus.focus({ preventScroll: true });
  }

  function executeRofi(index) {
    const item = state.rofiItems[index];
    if (!item) return;
    closeRofi(false);
    item.action();
  }

  /* Events */
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !$("#toast").hidden) scheduleToastHide();
  });
  window.addEventListener("popstate", handlePopState);
  document.addEventListener("click", event => {
    const onboardingTrigger = event.target.closest("[data-open-onboarding]");
    if (onboardingTrigger) { openOnboarding({ trigger: onboardingTrigger }); return; }
    if (event.target.closest("[data-onboarding-dismiss]")) { closeOnboarding(); return; }
    const external = event.target.closest("[data-external]");
    if (external) {
      window.open(external.dataset.external, "_blank", "noopener");
      return;
    }
    const termCommand = event.target.closest("[data-term-command]");
    if (termCommand) {
      runCommand(termCommand.dataset.termCommand);
      const input = $("#terminalInput");
      if (input) { input.value = ""; input.focus(); }
      return;
    }
    const rofiItem = event.target.closest("[data-rofi-index]");
    if (rofiItem) { executeRofi(Number(rofiItem.dataset.rofiIndex)); return; }
    if (event.target.closest("#rofiTrigger") || event.target.closest("#runningApps")) { openRofi(); return; }
    if (event.target.closest("#rofiScrim")) { closeRofi(); return; }
    const openEvent = event.target.closest("[data-open-event]");
    if (openEvent) { openDetail(Number(openEvent.dataset.openEvent)); return; }
    const widgetEvent = event.target.closest("[data-widget-event]");
    if (widgetEvent) { openDetail(Number(widgetEvent.dataset.widgetEvent)); return; }
    if (event.target.closest("[data-close-upcoming]")) { toggleUpcoming(false); toast("下一节点组件已关闭，可从 Rofi 恢复"); return; }
    const notificationEvent = event.target.closest("[data-notification-event]");
    if (notificationEvent) {
      const id = Number(notificationEvent.dataset.notificationEvent);
      state.read.add(id);
      saveRead();
      toggleNotifications(false);
      openDetail(id);
      return;
    }
    const contestView = event.target.closest("[data-contest-view]");
    if (contestView) { state.contestView = contestView.dataset.contestView; try { localStorage.setItem(CONTEST_VIEW_KEY, state.contestView); } catch { } refreshContests(); syncUrl(); return; }
    if (event.target.closest("[data-contest-saved]")) { state.savedOnly = !state.savedOnly; refreshContests(); refreshAgenda(); syncUrl(); return; }
    const agendaTab = event.target.closest("[data-agenda-tab]");
    if (agendaTab) { state.agendaTab = agendaTab.dataset.agendaTab; refreshAgenda(); return; }
    if (event.target.closest("[data-agenda-saved]")) { state.savedOnly = !state.savedOnly; refreshAgenda(); refreshContests(); syncUrl(); return; }
    if (event.target.closest("[data-agenda-prev]")) { moveAgendaMonth(-1); return; }
    if (event.target.closest("[data-agenda-next]")) { moveAgendaMonth(1); return; }
    if (event.target.closest("[data-agenda-today]")) { selectAgendaToday(); return; }
    const agendaDate = event.target.closest("[data-agenda-date]");
    if (agendaDate) { state.agendaSelectedDate = agendaDate.dataset.agendaDate; refreshAgenda(); $(`[data-agenda-date="${state.agendaSelectedDate}"]`)?.focus({ preventScroll: true }); return; }
    const detailOpen = event.target.closest("[data-open-detail]");
    if (detailOpen) { openDetail(detailOpen.dataset.openDetail); return; }
    if (event.target.closest("[data-refresh-board]")) { loadBoard(); return; }
    if (event.target.closest("[data-refresh-submit]")) { loadSubmit(); return; }
    if (event.target.closest("[data-post-comment]")) { postBoardComment(); return; }
    if (event.target.closest("[data-push-toggle]")) { togglePush(); return; }
    if (event.target.closest("[data-push-saved]")) {
      state.push.savedOnly = !state.push.savedOnly;
      savePush();
      schedulePushNotifications();
      refreshPush();
      $('[data-push-saved]')?.focus();
      return;
    }
    if (event.target.closest("[data-test-push]")) { sendBrowserNotification("赛线通知测试", `${urgentEvents().length} 个临近节点`, "contestline-test"); return; }
    if (event.target.closest("[data-copy-ics]")) { copyText(`${ONLINE_ORIGIN}/api/v1/ical/all.ics`, "ICS 地址"); return; }
    if (event.target.closest("[data-copy-api]")) { copyText(`${ONLINE_ORIGIN}/api/v1`, "API 地址"); return; }
    const copyEvent = event.target.closest("[data-copy-event]");
    if (copyEvent) {
      const url = new URL(location.href);
      url.searchParams.set("event", copyEvent.dataset.copyEvent);
      copyText(url.toString(), "赛事链接");
      return;
    }
    const docTab = event.target.closest("[data-doc-tab]");
    if (docTab) {
      state.docTab = docTab.dataset.docTab;
      refreshDocs();
      $(`[data-doc-tab="${state.docTab}"]`)?.focus();
      return;
    }
    const mobileOpen = event.target.closest("[data-mobile-open]");
    if (mobileOpen) { openFromEvent(mobileOpen.dataset.mobileOpen); return; }
    if (event.target.closest("[data-mobile-home]")) { showMobileHome(); return; }
    const open = event.target.closest("[data-open]");
    if (open) { openFromEvent(open.dataset.open); return; }
    const workspace = event.target.closest("[data-workspace]");
    if (workspace) { switchWorkspace(Number(workspace.dataset.workspace)); return; }
    if (event.target.closest("#terminalTrigger")) { openApp("terminal"); return; }
    if (event.target.closest(".terminal-scroll")) {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) $("#terminalInput")?.focus({ preventScroll: true });
    }
    if (event.target.closest("#tileToggle")) { toggleTiled(); return; }
    if (event.target.closest("#syncRetry")) { loadLiveEvents({ manual: true }); return; }
    if (event.target.closest("#notificationTrigger")) { toggleNotifications(); return; }
    if (event.target.closest("[data-close-notifications]")) { toggleNotifications(false); $("#notificationTrigger").focus(); return; }
    if (event.target.closest("[data-read-all]")) {
      urgentEvents().forEach(item => state.read.add(item.id));
      saveRead();
      renderNotifications();
      toast("已将临近节点标为已读");
      return;
    }
    const close = event.target.closest("[data-action='close']");
    if (close) { closeApp(close.dataset.app); return; }
    const minimize = event.target.closest("[data-action='minimize']");
    if (minimize) { minimizeApp(minimize.dataset.app); return; }
    const maximize = event.target.closest("[data-action='maximize']");
    if (maximize) { maximizeApp(maximize.dataset.app); return; }
    const appWindow = event.target.closest(".window");
    if (appWindow) setActive(appWindow.dataset.app);
    const treeCategory = event.target.closest("[data-tree-category]");
    if (treeCategory) { state.category = treeCategory.dataset.treeCategory; refreshContests(); syncUrl(); return; }
    const treeRegion = event.target.closest("[data-tree-region]");
    if (treeRegion) { state.region = treeRegion.dataset.treeRegion; refreshContests(); refreshAgenda(); syncUrl(); return; }
    const region = event.target.closest("[data-region]");
    if (region) { state.region = region.dataset.region; refreshContests(); refreshAgenda(); syncUrl(); return; }
    const save = event.target.closest("[data-save]");
    if (save) {
      const id = Number(save.dataset.save);
      if (state.saved.has(id)) state.saved.delete(id); else state.saved.add(id);
      saveSaved(); updateShellCounts(); refreshContests(); refreshSchedule(); refreshDetail();
      toast(state.saved.has(id) ? "已加入我的赛程" : "已移出我的赛程");
      return;
    }
    const select = event.target.closest("[data-select]");
    if (select) { openDetail(Number(select.dataset.select)); return; }
    const themeChoice = event.target.closest("[data-theme-choice]");
    if (themeChoice) { setTheme(themeChoice.dataset.themeChoice); return; }
    const wallpaper = event.target.closest("[data-wallpaper]");
    if (wallpaper) { state.wallpaperSelected = wallpaper.dataset.wallpaper; refreshWallpaper(); return; }
    if (event.target.closest("[data-apply-wallpaper]")) { applyWallpaper(); return; }
    if (event.target.closest("[data-random-wallpaper]")) { state.wallpaperSelected = WALLPAPERS[Math.floor(Math.random() * WALLPAPERS.length)].id; refreshWallpaper(); return; }
    if (event.target.closest("[data-export-ics]")) { exportIcs(); return; }
    if (event.target.closest("[data-close-toast]")) { $("#toast").hidden = true; return; }
    if (!event.target.closest("#notificationCenter")) toggleNotifications(false);
    const toastTrigger = event.target.closest("[data-toast]");
    if (toastTrigger) toast(toastTrigger.dataset.toast);
  });

  document.addEventListener("input", event => {
    if (event.target.id === "contestSearch") { state.q = event.target.value; refreshContests(); syncUrl(); }
    if (event.target.id === "boardDraft") {
      state.boardDraft = event.target.value;
      state.boardMessage = "";
      const count = $(".board-count");
      if (count) count.textContent = `${state.boardDraft.length} / 1000`;
    }
    if (event.target.id === "submitDescription") {
      const count = $("#submitCount");
      if (count) count.textContent = String(event.target.value.length);
    }
    if (event.target.id === "pushLead") {
      state.push.lead = Number(event.target.value);
      savePush();
      schedulePushNotifications();
    }
    if (event.target.id === "wallFit") { state.wallpaper.fit = event.target.value; paintWallpaper(); saveWallpaper(); refreshWallpaper(); }
    if (event.target.id === "rofiInput") { state.rofiIndex = 0; renderRofi(); }
  });
  document.addEventListener("change", (event) => {
    const map = { contestStatus: "status", contestMode: "mode", contestSort: "sort" };
    if (map[event.target.id]) {
      state[map[event.target.id]] = event.target.value;
      refreshContests();
      refreshAgenda();
      syncUrl();
    }
  });

  document.addEventListener("submit", (event) => {
    if (event.target.id === "submitForm") {
      event.preventDefault();
      postSubmission(event.target);
      return;
    }
    if (event.target.id === "terminalForm") {
      event.preventDefault();
      const input = $("#terminalInput");
      runCommand(input.value);
      input.value = "";
    }
  });
  document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (state.rofiOpen) closeRofi(); else openRofi();
      return;
    }
    if (state.rofiOpen) {
      if (event.key === "Escape") { event.preventDefault(); closeRofi(); }
      else if (["ArrowDown", "ArrowUp"].includes(event.key) && state.rofiItems.length) {
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        state.rofiIndex = (state.rofiIndex + direction + state.rofiItems.length) % state.rofiItems.length;
        renderRofi();
      } else if (event.key === "Enter" && event.target.id === "rofiInput") {
        event.preventDefault();
        executeRofi(state.rofiIndex);
      } else if (event.key === "Tab") {
        const focusable = $$("input, button", $("#rofi")).filter(node => !node.disabled);
        const first = focusable[0], last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
      return;
    }
    if (state.onboardingOpen && event.key === "Escape") {
      event.preventDefault();
      closeOnboarding();
      return;
    }
    if (event.target.id === "terminalInput" && event.key === "Tab") {
      event.preventDefault();
      completeTerminal(event.target);
      return;
    }
    if (event.target.id === "terminalInput" && event.ctrlKey && event.key.toLowerCase() === "l") {
      event.preventDefault();
      clearTerminal();
      return;
    }
    if (event.target.id === "terminalInput" && event.ctrlKey && event.key.toLowerCase() === "c") {
      event.preventDefault();
      appendTerm(`${event.target.value}^C`, "command");
      event.target.value = "";
      return;
    }
    if (event.target.id === "terminalInput" && event.ctrlKey && event.key.toLowerCase() === "u") {
      event.preventDefault();
      const cursor = event.target.selectionStart ?? event.target.value.length;
      event.target.value = event.target.value.slice(cursor);
      event.target.setSelectionRange(0, 0);
      return;
    }
    if (event.target.id === "terminalInput" && ["ArrowUp", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      if (!state.terminalHistory.length) return;
      const delta = event.key === "ArrowUp" ? -1 : 1;
      state.terminalHistoryIndex = Math.max(0, Math.min(state.terminalHistory.length, state.terminalHistoryIndex + delta));
      event.target.value = state.terminalHistory[state.terminalHistoryIndex] || "";
      event.target.setSelectionRange(event.target.value.length, event.target.value.length);
      return;
    }
    if (event.target.id === "terminalInput" && event.key === "Enter") return;
    if (event.key === "Escape") {
      toggleNotifications(false);
      closeMenus();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.code === "Backquote") {
      event.preventDefault();
      openApp("terminal");
      $("#terminalInput")?.focus();
      return;
    }
    if (event.altKey && ["Digit1", "Digit2", "Digit3"].includes(event.code)) {
      event.preventDefault();
      switchWorkspace(Number(event.code.at(-1)));
      return;
    }
    if (event.altKey && event.key === "Tab") {
      event.preventDefault();
      const ids = visibleWindowIds();
      if (ids.length < 2) return;
      const current = ids.indexOf(state.active);
      const next = ids[(current + 1) % ids.length];
      openApp(next);
      toast(`切换到：${APP_DEFS[next].title}`);
      return;
    }
    const typing = event.target.matches("input, textarea, select, [contenteditable='true']");
    if (event.key === "/" && !typing) { event.preventDefault(); openRofi(); }
  });

  /* Window drag, resize and snap */
  let drag = null;
  let resize = null;
  document.addEventListener("pointerdown", (event) => {
    const resizeHandle = event.target.closest("[data-resize]");
    if (resizeHandle) {
      const id = resizeHandle.dataset.app;
      const win = state.windows[id];
      const node = resizeHandle.closest(".window");
      if (!win || !node || win.maximized || state.tiled || window.innerWidth <= 760) return;
      const rect = node.getBoundingClientRect();
      resize = { id, node, dir: resizeHandle.dataset.resize, startX: event.clientX, startY: event.clientY, rect };
      resizeHandle.setPointerCapture(event.pointerId);
      return;
    }
    const handle = event.target.closest("[data-drag]");
    if (!handle || event.target.closest("button")) return;
    const id = handle.dataset.drag;
    const win = state.windows[id];
    if (!win || win.maximized || state.tiled || window.innerWidth <= 760) return;
    const node = handle.closest(".window");
    const rect = node.getBoundingClientRect();
    drag = { id, node, x: event.clientX - rect.left, y: event.clientY - rect.top, moved: false };
    handle.setPointerCapture(event.pointerId);
  });
  document.addEventListener("pointermove", (event) => {
    if (resize) {
      const layer = $("#windows").getBoundingClientRect();
      const node = resize.node;
      const dx = event.clientX - resize.startX;
      const dy = event.clientY - resize.startY;
      const minW = 340, minH = 220;
      let left = resize.rect.left - layer.left;
      let top = resize.rect.top - layer.top;
      let width = resize.rect.width;
      let height = resize.rect.height;
      if (resize.dir.includes("e")) width = Math.max(minW, resize.rect.width + dx);
      if (resize.dir.includes("s")) height = Math.max(minH, resize.rect.height + dy);
      if (resize.dir.includes("w")) { width = Math.max(minW, resize.rect.width - dx); left = resize.rect.left - layer.left + (resize.rect.width - width); }
      if (resize.dir.includes("n")) { height = Math.max(minH, resize.rect.height - dy); top = resize.rect.top - layer.top + (resize.rect.height - height); }
      node.style.left = `${Math.max(0, left)}px`;
      node.style.top = `${Math.max(0, top)}px`;
      node.style.width = `${width}px`;
      node.style.height = `${height}px`;
      return;
    }
    if (!drag) return;
    drag.moved = true;
    const layer = $("#windows").getBoundingClientRect();
    const node = drag.node;
    const visibleTitle = 96;
    const visibleTitlebar = 40;
    const x = Math.max(visibleTitle - node.offsetWidth, Math.min(layer.width - visibleTitle, event.clientX - layer.left - drag.x));
    const y = Math.max(0, Math.min(layer.height - visibleTitlebar, event.clientY - layer.top - drag.y));
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
  });
  document.addEventListener("pointerup", (event) => {
    if (drag && drag.moved) {
      const layer = $("#windows").getBoundingClientRect();
      const node = drag.node;
      const id = drag.id;
      const win = state.windows[id];
      if (event.clientY < layer.top + 18) {
        if (!win.maximized) maximizeApp(id);
      } else if (event.clientX < layer.left + 18) {
        win.maximized = false;
        node.classList.remove("maximized");
        node.style.left = "0px"; node.style.top = "0px";
        node.style.width = `${Math.floor(layer.width / 2)}px`; node.style.height = `${layer.height}px`;
      } else if (event.clientX > layer.right - 18) {
        win.maximized = false;
        node.classList.remove("maximized");
        node.style.left = `${Math.floor(layer.width / 2)}px`; node.style.top = "0px";
        node.style.width = `${Math.floor(layer.width / 2)}px`; node.style.height = `${layer.height}px`;
      }
    }
    if (drag) {
      const win = state.windows[drag.id];
      if (win) Object.assign(win, { x: parseFloat(drag.node.style.left), y: parseFloat(drag.node.style.top), width: parseFloat(drag.node.style.width), height: parseFloat(drag.node.style.height) });
    }
    if (resize) {
      const win = state.windows[resize.id];
      if (win) Object.assign(win, { x: parseFloat(resize.node.style.left), y: parseFloat(resize.node.style.top), width: parseFloat(resize.node.style.width), height: parseFloat(resize.node.style.height) });
    }
    drag = null;
    resize = null;
  });
  document.addEventListener("dblclick", (event) => {
    const title = event.target.closest("[data-drag]");
    if (title && !event.target.closest("button")) maximizeApp(title.dataset.drag);
  });

  function normalizeLiveEvent(item) {
    return {
      ...item,
      id: Number(item.id),
      title: item.title || "未命名赛事",
      organizer: item.organizer || "",
      description: item.description || "",
      category: item.category || "other",
      category_label: item.category_label || "其他",
      field_label: item.field_label || "待细分",
      status: item.status || "unknown",
      status_label: item.status_label || "待定",
      days_left: item.days_left ?? null,
      next_deadline: item.next_deadline || null,
      registration_deadline: item.registration_deadline || null,
      event_start: item.event_start || null,
      event_end: item.event_end || null,
      mode: item.mode || "unknown",
      region: item.region || "cn",
      source_name: item.source_name || "公开来源",
      verified_at: item.verified_at || null,
      url: item.url || item.signup_url || item.source_url || "",
      recognition_label: item.recognition_label || null,
      date_confidence: item.date_confidence || "unknown",
      tags: item.tags || { direction: [], format: [] },
    };
  }

  function refreshAfterLive() {
    updateShellCounts();
    renderUpcoming();
    renderNotifications();
    refreshContests();
    refreshAgenda();
    refreshDetail();
    refreshPush();
    openPendingEvent(false);
  }

  const loadEvents = globalThis.ContestEventSync.createEventLoader({ normalize: normalizeLiveEvent });

  async function loadLiveEvents({ manual = false } = {}) {
    if (!API_ENABLED || syncStatus === "syncing") return;
    syncStatus = "syncing";
    updateShellCounts();
    try {
      const result = await loadEvents();
      DEMO_EVENTS = result.items;
      DEMO_LIVE = true;
      DEMO_UPDATED = result.fetchedAt;
      DEMO_LAST_REFRESH = result.lastRefresh;
      syncStatus = "live";
      refreshAfterLive();
    } catch (error) {
      console.error("Event sync failed", error);
      syncStatus = "error";
      updateShellCounts();
      if (manual) toast("同步失败，仍显示上次数据");
    }
  }

  let bootFinished = false;
  function finishBoot() {
    if (bootFinished) return;
    bootFinished = true;
    $("#bootScreen")?.remove();
    $("#os").inert = false;
    try { sessionStorage.setItem("contestline.archos.booted", "1"); } catch { }
    if (!state.onboardingSeen && !state.pendingEvent && !Object.keys(state.windows).length && !state.rofiOpen) openOnboarding({ automatic: true });
  }

  applyUrlState();
  setTheme(state.theme, { notify: false });
  paintWallpaper();
  schedulePushNotifications();
  renderUpcoming();
  updateClock();
  updateShellCounts();
  renderTaskbar();
  openPendingApp();
  openPendingEvent(false);
  loadLiveEvents();
  updatePresence();
  window.setInterval(updatePresence, 30000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) updatePresence(); });
  window.setInterval(updateClock, 30000);
  window.addEventListener("resize", () => { renderTaskbar(); refreshContests(); });
  let booted = false;
  try { booted = sessionStorage.getItem("contestline.archos.booted") === "1"; } catch { }
  if (booted || window.matchMedia("(prefers-reduced-motion: reduce)").matches) finishBoot();
  else {
    $("#skipBoot").addEventListener("click", finishBoot);
    setTimeout(finishBoot, 1500);
  }
})();
