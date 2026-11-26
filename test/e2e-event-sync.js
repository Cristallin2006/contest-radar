import test, { after, afterEach, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const publicRoot = path.join(root, "public");
const chromePath = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const liveEvent = { id: 999, title: "同步验收赛事", category: "ctf", category_label: "CTF", region: "cn", status: "open", stages: [], url: "https://example.com", source_url: "https://example.com/source", source_name: "测试来源", next_deadline: "2026-12-13", registration_deadline: "2026-12-13", mode: "online" };
const livePage = { items: [liveEvent], total: 1, pages: 1 };
const health = { last_refresh: "2026-11-26T07:30:00Z" };

let browser;
let cdp;
let profile;
let server;
let origin;
let targetId;
let sessionId;
let scenario;
let attempts;
let deferred;
let boardAttempts;

function json(res, body, status = 200) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function serveStatic(res, pathname) {
  const relative = pathname === "/" || pathname === "/home.html" ? "home.html" : pathname.replace(/^\//, "");
  const filename = path.resolve(publicRoot, relative);
  if (!filename.startsWith(`${path.resolve(publicRoot)}${path.sep}`)) return json(res, {}, 403);
  try {
    const info = await stat(filename);
    if (!info.isFile()) return json(res, {}, 404);
    const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".woff2": "font/woff2" };
    res.writeHead(200, { "content-type": `${types[path.extname(filename)] || "application/octet-stream"}; charset=utf-8` });
    res.end(await readFile(filename));
  } catch {
    json(res, {}, 404);
  }
}

class DevTools {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.consoleErrors = [];
    this.ready = new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
        this.consoleErrors.push(message.params.args.map((arg) => arg.value || arg.description || arg.type).join(" "));
      }
      if (message.method === "Runtime.exceptionThrown") this.consoleErrors.push(message.params.exceptionDetails.text);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
  }

  async send(method, params = {}, sessionId) {
    await this.ready;
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(expression) {
  const result = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}

async function waitFor(expression, timeout = 6000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    if (await evaluate(expression)) return;
    if (Date.now() > deadline) throw new Error(`Timed out: ${expression}; DOM: ${await evaluate('document.querySelector(".waybar")?.textContent')}; errors: ${cdp.consoleErrors.join(" | ")}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

async function navigate({ mobile = false, view = "list", width, height, query, onboarding = "seen", motion = "reduce" } = {}) {
  await cdp.send("Page.enable", {}, sessionId);
  await cdp.send("Runtime.enable", {}, sessionId);
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: width || (mobile ? 390 : 1280),
    height: height || (mobile ? 844 : 900),
    deviceScaleFactor: 1,
    mobile,
  }, sessionId);
  await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: motion }] }, sessionId);
  if (onboarding === "seen") {
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
      source: 'localStorage.setItem("contestline.archos.onboarding.v1", "seen")',
    }, sessionId);
  } else {
    await cdp.send("Storage.clearDataForOrigin", { origin, storageTypes: "local_storage" }, sessionId);
  }
  const targetQuery = query ?? (view ? `?view=${view}` : "");
  await cdp.send("Page.navigate", { url: `${origin}/${targetQuery}` }, sessionId);
  await waitFor('document.readyState === "complete" && document.querySelector("#os") && !document.querySelector("#os").inert');
}

async function screenshot(name) {
  if (!process.env.CONTEST_SCREENSHOT_DIR) return;
  const result = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }, sessionId);
  await writeFile(path.join(process.env.CONTEST_SCREENSHOT_DIR, `${name}.png`), Buffer.from(result.data, "base64"));
}

async function showLiveEventMonth() {
  const offset = await evaluate("(() => { const now = new Date(); return (2026 - now.getFullYear()) * 12 + 11 - now.getMonth(); })()");
  const selector = offset >= 0 ? "[data-agenda-next]" : "[data-agenda-prev]";
  for (let index = 0; index < Math.abs(offset); index += 1) await evaluate(`document.querySelector("${selector}").click()`);
  await waitFor('document.querySelector(".agenda-cal-head h2")?.textContent.includes("2026 年 12 月")');
}

before(async () => {
  server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    if (url.pathname === "/api/v1/presence") return json(res, { online: 1, display: 2 });
    if (url.pathname === "/api/v1/health") return json(res, health);
    if (url.pathname === "/api/v1/me") {
      const authenticated = ["authenticated", "board-retry", "submit-failure"].includes(scenario);
      return json(res, { auth_enabled: true, authenticated, user: authenticated ? { login: "contest-tester", display_name: "验收用户", avatar_url: null, profile_url: null } : null });
    }
    if (url.pathname === "/api/v1/comments" && req.method === "GET") {
      boardAttempts += 1;
      if (scenario === "board-retry" && boardAttempts === 1) return json(res, { message: "暂时不可用" }, 503);
      return json(res, { items: scenario === "board-retry" ? [{ id: 1, body: "重试后可见的留言", login: "contest-tester", display_name: "验收用户", created_at: "2026-11-26T08:00:00Z" }] : [] });
    }
    if (url.pathname === "/api/v1/submissions/mine") return json(res, { items: [] });
    if (url.pathname === "/api/v1/submissions" && req.method === "POST") return json(res, { message: "投稿服务暂时不可用" }, 503);
    if (url.pathname === "/api/v1/editions") {
      attempts += 1;
      if (scenario === "deferred") {
        deferred = () => json(res, livePage);
        return;
      }
      if (scenario === "retry" && attempts === 1) return json(res, {}, 503);
      if (scenario === "partial") {
        if (url.searchParams.get("page") === "2") return json(res, {}, 503);
        return json(res, { items: Array.from({ length: 100 }, (_, id) => ({ ...liveEvent, id })), total: 101, pages: 2 });
      }
      if (scenario === "empty") return json(res, { items: [], total: 0, pages: 1 });
      return json(res, livePage);
    }
    return serveStatic(res, decodeURIComponent(url.pathname));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://contest.test:${server.address().port}`;

  profile = await mkdtemp(path.join(tmpdir(), "contest-sync-chrome-"));
  browser = spawn(chromePath, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--no-proxy-server",
    "--host-resolver-rules=MAP contest.test 127.0.0.1",
    "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  const wsUrl = await new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error(`Chrome startup timed out: ${output}`)), 10000);
    browser.stderr.on("data", (chunk) => {
      output += chunk.toString();
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
    browser.once("error", reject);
    browser.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Chrome exited ${code}: ${output}`)); });
  });
  cdp = new DevTools(wsUrl);
  await cdp.ready;
});

beforeEach(async () => {
  scenario = "success";
  attempts = 0;
  deferred = null;
  boardAttempts = 0;
  ({ targetId } = await cdp.send("Target.createTarget", { url: "about:blank" }));
  ({ sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true }));
});

afterEach(async () => {
  if (deferred) deferred();
  if (targetId) await cdp.send("Target.closeTarget", { targetId });
  targetId = null;
  sessionId = null;
});

after(async () => {
  cdp?.close();
  if (browser && browser.exitCode === null) {
    const exited = once(browser, "exit");
    browser.kill();
    await exited;
  }
  if (server) await new Promise((resolve) => server.close(resolve));
  if (profile) await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

test("OS exposes syncing before publishing a complete live list", async () => {
  scenario = "deferred";
  await navigate();
  await waitFor('document.querySelector(".snapshot-label")?.textContent === "SYNC"');
  assert.equal(await evaluate('document.querySelector("#dataCount").textContent'), "16 场");
  assert.match(await evaluate('document.querySelector("#dataFreshness").textContent'), /同步中/);
  deferred();
  deferred = null;
  await waitFor('document.querySelector(".snapshot-label")?.textContent === "LIVE"');
  assert.equal(await evaluate('document.querySelector("#dataCount").textContent'), "1 场");
  const freshness = await evaluate('document.querySelector("#dataFreshness").textContent');
  assert.match(freshness, /本次读取/);
  assert.match(freshness, /最近采集/);
  await evaluate('document.querySelector("[data-open=contests]").click()');
  await waitFor('document.querySelector(".event-name strong")?.textContent.includes("同步验收赛事")');
});

test("OS keeps the snapshot after failure and retries on demand", async () => {
  scenario = "retry";
  await navigate();
  await waitFor('document.querySelector("#syncRetry") && !document.querySelector("#syncRetry").hidden');
  assert.equal(await evaluate('document.querySelector(".snapshot-label").textContent'), "SNAP");
  assert.equal(await evaluate('document.querySelector("#dataCount").textContent'), "16 场");
  assert.match(await evaluate('document.querySelector("#dataFreshness").textContent'), /同步失败/);
  await evaluate('document.querySelector("#syncRetry").click()');
  await waitFor('document.querySelector(".snapshot-label")?.textContent === "LIVE"');
  assert.equal(await evaluate('document.querySelector("#dataCount").textContent'), "1 场");
  assert.equal(attempts, 2);
});

test("OS does not mark a partial page set as live", async () => {
  scenario = "partial";
  await navigate();
  await waitFor('document.querySelector("#syncRetry") && !document.querySelector("#syncRetry").hidden');
  assert.equal(await evaluate('document.querySelector(".snapshot-label").textContent'), "SNAP");
  assert.equal(await evaluate('document.querySelector("#dataCount").textContent'), "16 场");
  assert.equal(attempts, 2);
});

test("OS accepts an empty live list without keeping stale rows", async () => {
  scenario = "empty";
  await navigate();
  await waitFor('document.querySelector(".snapshot-label")?.textContent === "LIVE"');
  assert.equal(await evaluate('document.querySelector("#dataCount").textContent'), "0 场");
  assert.equal(await evaluate('document.querySelector("#syncRetry").hidden'), true);
  await evaluate('document.querySelector("[data-open=contests]").click()');
  await waitFor('document.querySelector(".empty-state")');
  assert.match(await evaluate('document.querySelector(".list-pane").textContent'), /没有匹配的赛事/);
});


test("mobile shell uses a phone home screen and bottom navigation", async () => {
  await navigate({ mobile: true, view: "" });
  await waitFor('document.querySelector(".phone-nav") && getComputedStyle(document.querySelector(".phone-nav")).display !== "none"');
  assert.equal(await evaluate("document.documentElement.clientWidth"), 390);
  assert.ok(await evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth"));
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".virtual-workspaces")).display'), "none");
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".waybar-left")).display'), "contents");
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".desktop-upcoming")).display'), "none");
  const geometry = await evaluate(`(() => {
    const nav = document.querySelector(".phone-nav").getBoundingClientRect();
    return { bottom: nav.bottom, viewport: innerHeight, targets: [...document.querySelectorAll(".phone-nav button")].map((node) => ({ label: node.textContent.trim(), height: node.getBoundingClientRect().height })) };
  })()`);
  assert.ok(geometry.bottom <= geometry.viewport);
  assert.deepEqual(geometry.targets.map((target) => target.label), ["首页", "赛事", "日程", "留言", "投稿"]);
  assert.ok(geometry.targets.every((target) => target.height >= 44));
  await screenshot("mobile-home");
});

test("mobile apps open as lists above the phone navigation and home exits them", async () => {
  await navigate({ mobile: true, view: "" });
  await evaluate('document.querySelector("[data-mobile-open=contests]").click()');
  await waitFor('document.querySelector(".window[data-app=contests] .event-row")');
  assert.equal(await evaluate('document.querySelector(".window[data-app=contests] .contest-table")'), null);
  const geometry = await evaluate(`(() => {
    const app = document.querySelector(".window[data-app=contests]").getBoundingClientRect();
    const nav = document.querySelector(".phone-nav").getBoundingClientRect();
    const layer = document.querySelector(".windows-layer");
    const layerStyle = getComputedStyle(layer);
    return { left: app.left, width: app.width, bottom: app.bottom, navTop: nav.top, layer: [layer.getBoundingClientRect().top, layer.getBoundingClientRect().bottom], layerCss: [layerStyle.top, layerStyle.bottom], current: document.querySelector("[data-mobile-open=contests]").getAttribute("aria-current") };
  })()`);
  assert.equal(geometry.left, 0);
  assert.equal(geometry.width, 390);
  assert.ok(geometry.bottom <= geometry.navTop, JSON.stringify(geometry));
  assert.equal(geometry.current, "page");
  await screenshot("mobile-contests");
  await evaluate('document.querySelector("[data-mobile-home]").click()');
  await waitFor('document.querySelectorAll(".window").length === 0');
  assert.equal(await evaluate('document.querySelector("[data-mobile-home]").getAttribute("aria-current")'), "page");
});

test("mobile detail keeps primary actions reachable and copies its deep link", async () => {
  await navigate({ mobile: true, view: "" });
  await evaluate('document.querySelector("[data-mobile-open=contests]").click()');
  await waitFor('document.querySelector("[data-open-event]")');
  await evaluate('document.querySelector("[data-open-event]").click()');
  await waitFor('document.querySelector(".window[data-app=detail] .detail-actions")');
  const actions = await evaluate(`(() => {
    const bar = document.querySelector(".detail-actions").getBoundingClientRect();
    const app = document.querySelector(".window[data-app=detail]").getBoundingClientRect();
    return { top: bar.top, bottom: bar.bottom, appBottom: app.bottom, labels: [...document.querySelectorAll(".detail-actions > *")].filter((node) => node.getClientRects().length).map((node) => node.textContent.trim()) };
  })()`);
  assert.ok(actions.top >= 0 && actions.bottom <= actions.appBottom + 1);
  assert.deepEqual(actions.labels, ["打开官网", "加入赛程", "复制链接"]);
  await evaluate(`Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (text) => { window.__copiedEventLink = text; } } })`);
  await evaluate('document.querySelector("[data-copy-event]").click()');
  await waitFor('window.__copiedEventLink && window.__copiedEventLink.includes("event=999")');
  const toastGeometry = await evaluate(`(() => {
    const toast = document.querySelector("#toast").getBoundingClientRect();
    const actions = document.querySelector(".detail-actions").getBoundingClientRect();
    return { toastBottom: toast.bottom, actionsTop: actions.top };
  })()`);
  assert.ok(toastGeometry.toastBottom <= toastGeometry.actionsTop, JSON.stringify(toastGeometry));
  await screenshot("mobile-detail");
  await evaluate('document.querySelector("[data-mobile-open=board]").click()');
  await waitFor('document.querySelector(".window[data-app=board]")');
  assert.equal(await evaluate('new URL(location.href).searchParams.get("event")'), null);
  assert.equal(await evaluate('new URL(location.href).searchParams.get("app")'), "board");
});


test("360px phone layout keeps navigation and detail actions inside the viewport", async () => {
  await navigate({ mobile: true, view: "", width: 360, height: 740 });
  await evaluate('document.querySelector("[data-mobile-open=contests]").click()');
  await waitFor('document.querySelector("[data-open-event]")');
  await evaluate('document.querySelector("[data-open-event]").click()');
  await waitFor('document.querySelector(".detail-actions")');
  assert.equal(await evaluate("document.documentElement.clientWidth"), 360);
  assert.ok(await evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth"));
  const overflow = await evaluate(`(() => {
    const app = document.querySelector(".window[data-app=detail]").getBoundingClientRect();
    const nav = document.querySelector(".phone-nav").getBoundingClientRect();
    return {
      appBottom: app.bottom,
      navTop: nav.top,
      buttons: [...document.querySelectorAll(".detail-actions .btn")].filter((node) => node.getClientRects().length).map((node) => ({ text: node.textContent.trim(), overflow: node.scrollWidth > node.clientWidth })),
    };
  })()`);
  assert.ok(overflow.appBottom <= overflow.navTop);
  assert.ok(overflow.buttons.every((button) => !button.overflow), JSON.stringify(overflow.buttons));
});

test("desktop shell keeps Arch windows, workspaces and table view", async () => {
  await navigate({ view: "" });
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".phone-nav")).display'), "none");
  assert.notEqual(await evaluate('getComputedStyle(document.querySelector(".virtual-workspaces")).display'), "none");
  await evaluate('document.querySelector("[data-open=contests]").click()');
  await waitFor('document.querySelector(".window[data-app=contests] .contest-table")');
  const geometry = await evaluate(`(() => {
    const app = document.querySelector(".window[data-app=contests]").getBoundingClientRect();
    return { left: app.left, width: app.width, viewport: innerWidth };
  })()`);
  assert.ok(geometry.left > 0);
  assert.ok(geometry.width < geometry.viewport);
});

test("desktop first visit shows a non-modal Rofi guide without stealing focus", async () => {
  await navigate({ view: "", onboarding: "first" });
  await waitFor('document.querySelector("#onboarding") && !document.querySelector("#onboarding").hidden');
  assert.equal(await evaluate('document.querySelector("#onboarding").getAttribute("aria-modal")'), "false");
  assert.equal(await evaluate('document.querySelector("#onboarding").contains(document.activeElement)'), false);
  assert.equal(await evaluate('document.querySelectorAll(".window").length'), 0);
  assert.match(await evaluate('document.querySelector("#onboardingTitle").textContent'), /saigun --help/);
  assert.equal(await evaluate('document.querySelectorAll(".onboarding-desktop .onboarding-row").length'), 3);
  await screenshot("onboarding-desktop");
  await evaluate('document.querySelector("[data-onboarding-dismiss]").click()');
  assert.equal(await evaluate('localStorage.getItem("contestline.archos.onboarding.v1")'), "seen");
  await cdp.send("Page.reload", {}, sessionId);
  await waitFor('document.readyState === "complete" && !document.querySelector("#os").inert');
  assert.equal(await evaluate('document.querySelector("#onboarding").hidden'), true);
});

test("desktop guide reopens from Rofi and Escape returns focus", async () => {
  await navigate({ view: "", onboarding: "first" });
  await evaluate('document.querySelector("#rofiTrigger").click()');
  await waitFor('!document.querySelector("#rofi").hidden');
  assert.equal(await evaluate('document.querySelector("#onboarding").hidden'), true);
  await evaluate(`(() => {
    const input = document.querySelector("#rofiInput");
    input.value = "使用指引";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  await waitFor('[...document.querySelectorAll(".rofi-item strong")].some((node) => node.textContent === "使用指引")');
  await evaluate('[...document.querySelectorAll(".rofi-item")].find((node) => node.querySelector("strong")?.textContent === "使用指引").click()');
  await waitFor('!document.querySelector("#onboarding").hidden');
  assert.equal(await evaluate('document.querySelector("#onboarding").contains(document.activeElement)'), true);
  await evaluate('document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))');
  assert.equal(await evaluate('document.querySelector("#onboarding").hidden'), true);
  assert.equal(await evaluate('document.activeElement.id'), "rofiTrigger");
});

test("guide exit finishes once with normal motion", async () => {
  await navigate({ view: "", onboarding: "first", motion: "no-preference" });
  await waitFor('document.querySelector("#onboarding") && !document.querySelector("#onboarding").hidden');
  await evaluate('document.querySelector("[data-onboarding-dismiss]").click()');
  await waitFor('document.querySelector("#onboarding").hidden');
  await new Promise((resolve) => setTimeout(resolve, 1400));
  assert.equal(await evaluate('document.querySelector("#onboarding").hidden'), true);
  assert.equal(await evaluate('document.querySelector("#bootScreen")'), null);
  assert.equal(await evaluate('localStorage.getItem("contestline.archos.onboarding.v1")'), "seen");
});

test("mobile first visit uses a reachable bottom sheet and a home help shortcut", async () => {
  await navigate({ mobile: true, view: "", onboarding: "first" });
  await waitFor('document.querySelector("#onboarding") && !document.querySelector("#onboarding").hidden');
  assert.equal(await evaluate('document.querySelector("#onboarding").contains(document.activeElement)'), false);
  assert.equal(await evaluate('document.querySelectorAll(".window").length'), 0);
  const geometry = await evaluate(`(() => {
    const sheet = document.querySelector("#onboarding").getBoundingClientRect();
    const nav = document.querySelector(".phone-nav").getBoundingClientRect();
    return { left: sheet.left, right: sheet.right, bottom: sheet.bottom, navTop: nav.top, width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth };
  })()`);
  assert.equal(geometry.left, 0);
  assert.equal(geometry.right, geometry.width);
  assert.ok(geometry.bottom <= geometry.navTop, JSON.stringify(geometry));
  assert.ok(geometry.scrollWidth <= geometry.width);
  assert.equal(await evaluate('document.querySelectorAll(".onboarding-mobile .onboarding-row").length'), 3);
  await screenshot("onboarding-mobile");
  await evaluate('document.querySelector("[data-onboarding-dismiss]").click()');
  await cdp.send("Page.reload", {}, sessionId);
  await waitFor('document.readyState === "complete" && !document.querySelector("#os").inert');
  assert.equal(await evaluate('document.querySelector("#onboarding").hidden'), true);
  assert.notEqual(await evaluate('getComputedStyle(document.querySelector("#mobileGuide")).display'), "none");
  await evaluate('document.querySelector("#mobileGuide").click()');
  await waitFor('!document.querySelector("#onboarding").hidden');
  assert.equal(await evaluate('document.querySelector("#onboarding").contains(document.activeElement)'), true);
  await evaluate('document.querySelector("[data-onboarding-dismiss]").click()');
  await waitFor('document.querySelector("#onboarding").hidden');
  assert.equal(await evaluate('document.activeElement.id'), "mobileGuide");
});

test("360px first-visit sheet keeps copy and actions inside the viewport", async () => {
  await navigate({ mobile: true, view: "", width: 360, height: 740, onboarding: "first" });
  await waitFor('document.querySelector("#onboarding") && !document.querySelector("#onboarding").hidden');
  const geometry = await evaluate(`(() => {
    const sheet = document.querySelector("#onboarding");
    const rect = sheet.getBoundingClientRect();
    const button = document.querySelector(".onboarding-done").getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, viewport: innerHeight, scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, buttonHeight: button.height, buttonRight: button.right };
  })()`);
  assert.ok(geometry.top >= 0 && geometry.bottom <= geometry.viewport, JSON.stringify(geometry));
  assert.ok(geometry.buttonHeight >= 44 && geometry.buttonRight <= geometry.clientWidth);
  assert.ok(geometry.scrollWidth <= geometry.clientWidth);
  await screenshot("onboarding-mobile-360");
});

test("event deep links are not interrupted by first-visit guidance", async () => {
  await navigate({ view: "", query: "?event=999", onboarding: "first" });
  await waitFor('document.querySelector(".window[data-app=detail] .detail-window h2")');
  assert.equal(await evaluate('document.querySelector("#onboarding").hidden'), true);
  assert.match(await evaluate('document.querySelector(".window[data-app=detail] .detail-window h2").textContent'), /同步验收赛事/);
});


test("mobile calendar selects a date and lists its events below the grid", async () => {
  await navigate({ mobile: true, view: "", width: 360, height: 740 });
  await evaluate('document.querySelector("[data-mobile-open=agenda]").click()');
  await evaluate('document.querySelector("[data-agenda-tab=calendar]").click()');
  await waitFor('document.querySelector(".agenda-day-list")');
  assert.equal(await evaluate('document.querySelectorAll(".agenda-grid .agenda-event").length'), 0);
  assert.equal(await evaluate('document.querySelectorAll(".agenda-grid button.agenda-day").length > 27'), true);
  const calendarGeometry = await evaluate(`(() => { const grid = document.querySelector(".agenda-grid").getBoundingClientRect(); const calendar = document.querySelector(".agenda-calendar").getBoundingClientRect(); const view = document.querySelector(".agenda-view").getBoundingClientRect(); return { gridWidth: grid.width, calendarWidth: calendar.width, viewWidth: view.width, gridRight: grid.right, calendarRight: calendar.right }; })()`);
  assert.ok(calendarGeometry.gridWidth >= calendarGeometry.calendarWidth - 20, JSON.stringify(calendarGeometry));
  assert.ok(calendarGeometry.calendarWidth >= calendarGeometry.viewWidth - 2, JSON.stringify(calendarGeometry));
  assert.equal(await evaluate('[...document.querySelectorAll(".agenda-grid button.agenda-day")].every((node) => node.getBoundingClientRect().height >= 44)'), true);
  await showLiveEventMonth();
  await evaluate('document.querySelector("[data-agenda-date=\'2026-12-13\']").click()');
  await waitFor('document.querySelector(".agenda-day-list [data-open-detail=\'999\']")');
  assert.match(await evaluate('document.querySelector(".agenda-day-list").textContent'), /同步验收赛事/);
  assert.equal(await evaluate('document.querySelector("[data-agenda-date=\'2026-12-13\']").getAttribute("aria-pressed")'), "true");
  const selectedCalendarGeometry = await evaluate(`(() => { const grid = document.querySelector(".agenda-grid").getBoundingClientRect(); const calendar = document.querySelector(".agenda-calendar").getBoundingClientRect(); const view = document.querySelector(".agenda-view").getBoundingClientRect(); return { gridWidth: grid.width, calendarWidth: calendar.width, viewWidth: view.width, gridLeft: grid.left, gridRight: grid.right, calendarLeft: calendar.left, calendarRight: calendar.right, scrollLeft: document.querySelector(".agenda-calendar").scrollLeft }; })()`);
  assert.ok(selectedCalendarGeometry.gridWidth >= selectedCalendarGeometry.viewWidth - 20, JSON.stringify(selectedCalendarGeometry));
  assert.equal(selectedCalendarGeometry.viewWidth, 360, JSON.stringify(selectedCalendarGeometry));
  assert.equal(selectedCalendarGeometry.scrollLeft, 0, JSON.stringify(selectedCalendarGeometry));
  assert.equal(await evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth"), true);
  await screenshot("mobile-agenda-selected");
  await evaluate('document.querySelector(".agenda-day-list [data-open-detail=\'999\']").click()');
  await waitFor('document.querySelector(".window[data-app=detail] .detail-window h2")');
});

test("desktop calendar keeps event titles inside its date cells", async () => {
  await navigate({ view: "" });
  await evaluate('document.querySelector("[data-open=agenda]").click()');
  await evaluate('document.querySelector("[data-agenda-tab=calendar]").click()');
  await waitFor('document.querySelector(".agenda-grid")');
  await showLiveEventMonth();
  assert.equal(await evaluate('document.querySelectorAll(".agenda-grid button.agenda-day").length'), 0);
  assert.equal(await evaluate('document.querySelector(".agenda-day-list")'), null);
  assert.match(await evaluate('document.querySelector(".agenda-grid").textContent'), /同步验收赛事/);
  await screenshot("desktop-agenda");
});

test("login links return to the original OS app and app deep links suppress guidance", async () => {
  await navigate({ mobile: true, view: "", query: "?app=board", onboarding: "first" });
  await waitFor('document.querySelector(".window[data-app=board] .board-auth a[href^=\'/auth/github\']")');
  assert.equal(await evaluate('document.querySelector("#onboarding").hidden'), true);
  assert.equal(await evaluate('new URL(document.querySelector(".board-auth a").href).searchParams.get("return_to")'), "/?app=board");
  await evaluate('document.querySelector("[data-mobile-open=submit]").click()');
  await waitFor('document.querySelector(".window[data-app=submit] .submit-auth a[href^=\'/auth/github\']")');
  assert.equal(await evaluate('new URL(document.querySelector(".submit-auth a").href).searchParams.get("return_to")'), "/?app=submit");
  assert.equal(await evaluate('new URL(location.href).searchParams.get("app")'), "submit");
});

test("mobile submission uses native-sized fields and preserves input after failure", async () => {
  scenario = "submit-failure";
  await navigate({ mobile: true, view: "", query: "?app=submit", width: 360, height: 740 });
  await waitFor('document.querySelector("#submitForm button[type=submit]") && !document.querySelector("#submitForm button[type=submit]").disabled');
  assert.equal(await evaluate('document.querySelector("#submitForm").reportValidity()'), false);
  const metrics = await evaluate(`[...document.querySelectorAll(".submit-field input, .submit-field select, .submit-field textarea")].map((node) => ({ name: node.name, font: parseFloat(getComputedStyle(node).fontSize), height: node.getBoundingClientRect().height }))`);
  assert.ok(metrics.every((field) => field.font >= 16 && field.height >= 44), JSON.stringify(metrics));
  assert.equal(await evaluate('document.querySelector("#submitForm button[type=submit]").getBoundingClientRect().height >= 44'), true);
  await evaluate(`(() => {
    const values = { title: "移动端投稿验收赛事", url: "https://example.com/contest", description: "由主办方公开页面提供的移动端投稿验收内容。" };
    for (const [name, value] of Object.entries(values)) {
      const field = document.querySelector("#submitForm").elements[name];
      field.value = value;
      field.dispatchEvent(new Event("input", { bubbles: true }));
    }
  })()`);
  assert.equal(await evaluate('document.querySelector("#submitForm").reportValidity()'), true);
  await evaluate('document.querySelector("#submitForm").requestSubmit()');
  await waitFor('document.querySelector("#submitMessage").textContent.includes("暂时不可用")');
  assert.equal(await evaluate('document.querySelector("#submitForm").elements.title.value'), "移动端投稿验收赛事");
  assert.equal(await evaluate('document.querySelector("#submitForm").elements.url.value'), "https://example.com/contest");
  assert.equal(await evaluate('document.querySelector("#submitForm").elements.description.value.length > 10'), true);
  assert.equal(await evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth"), true);
  const actionGeometry = await evaluate(`(() => {
    const button = document.querySelector("#submitForm button[type=submit]");
    button.scrollIntoView({ block: "end" });
    const action = button.getBoundingClientRect();
    const message = document.querySelector("#submitMessage").getBoundingClientRect();
    const nav = document.querySelector(".phone-nav").getBoundingClientRect();
    return { top: action.top, bottom: action.bottom, messageBottom: message.bottom, navTop: nav.top };
  })()`);
  assert.ok(actionGeometry.top >= 0 && actionGeometry.bottom <= actionGeometry.navTop, JSON.stringify(actionGeometry));
  assert.ok(actionGeometry.messageBottom <= actionGeometry.top, JSON.stringify(actionGeometry));
  await screenshot("mobile-submit-error");
});

test("mobile board retries in one scroll container without losing its draft", async () => {
  scenario = "board-retry";
  await navigate({ mobile: true, view: "", query: "?app=board" });
  await waitFor('document.querySelector(".board-empty [data-refresh-board]")');
  await evaluate(`(() => {
    const draft = document.querySelector("#boardDraft");
    draft.value = "重试时保留这条草稿";
    draft.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector(".board-empty [data-refresh-board]").click();
  })()`);
  await waitFor('document.querySelector(".board-item")');
  assert.match(await evaluate('document.querySelector(".board-list").textContent'), /重试后可见的留言/);
  assert.equal(await evaluate('document.querySelector("#boardDraft").value'), "重试时保留这条草稿");
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".board-list")).overflowY'), "visible");
  assert.equal(await evaluate('parseFloat(getComputedStyle(document.querySelector("#boardDraft")).fontSize) >= 16'), true);
  assert.equal(await evaluate('[...document.querySelectorAll(".board-composer .btn")].every((node) => node.getBoundingClientRect().height >= 44)'), true);
  await screenshot("mobile-board-retry");
});

test("mobile wallpaper apply action appears only for a pending selection", async () => {
  await navigate({ mobile: true, view: "" });
  await evaluate('document.querySelector("[data-open=wallpaper]").click()');
  await waitFor('document.querySelector(".wallpaper-grid")');
  assert.equal(await evaluate('document.querySelector(".wallpaper-mobile-actions")'), null);
  await evaluate('document.querySelector("[data-wallpaper=ethereal]").click()');
  await waitFor('document.querySelector(".wallpaper-mobile-actions")');
  const geometry = await evaluate(`(() => {
    const action = document.querySelector(".wallpaper-mobile-actions button").getBoundingClientRect();
    const nav = document.querySelector(".phone-nav").getBoundingClientRect();
    return { height: action.height, bottom: action.bottom, navTop: nav.top };
  })()`);
  assert.ok(geometry.height >= 44 && geometry.bottom <= geometry.navTop, JSON.stringify(geometry));
  await screenshot("mobile-wallpaper-pending");
  await evaluate('document.querySelector(".wallpaper-mobile-actions [data-apply-wallpaper]").click()');
  await waitFor('!document.querySelector(".wallpaper-mobile-actions")');
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("contestline.archos.wallpaper.v1")).id'), "ethereal");
});

test("760px push and docs controls keep 44px targets and readable selects", async () => {
  await navigate({ mobile: true, view: "", query: "?app=push", width: 760, height: 900 });
  await waitFor('document.querySelector(".push-app")');
  assert.equal(await evaluate('[...document.querySelectorAll(".push-app button, .push-app select, .push-app .btn")].filter((node) => node.getClientRects().length).every((node) => node.getBoundingClientRect().height >= 44)'), true);
  assert.equal(await evaluate('parseFloat(getComputedStyle(document.querySelector("#pushLead")).fontSize) >= 16'), true);
  await screenshot("mobile-push-760");
  await navigate({ mobile: true, view: "", query: "?app=docs", width: 760, height: 900 });
  await waitFor('document.querySelector(".docs-app")');
  assert.equal(await evaluate('[...document.querySelectorAll(".doc-nav button, .doc-article .btn")].filter((node) => node.getClientRects().length).every((node) => node.getBoundingClientRect().height >= 44)'), true);
  assert.equal(await evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth"), true);
  await screenshot("mobile-docs-760");
});
