(() => {
  "use strict";
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
  const STATUS = { pending: "待审核", accepted: "已采用", rejected: "未采用" };
  const AUTH_ERROR = {
    disabled: "GitHub 登录尚未配置，请联系站点管理员。",
    denied: "你取消了 GitHub 授权。",
    state: "登录状态已过期，请重新发起登录。",
    code: "GitHub 没有返回授权码，请重试。",
    error: "GitHub 登录失败，请稍后重试。",
    blocked: "该账号已被暂停投稿权限。",
  };
  let me = null;

  function fmt(value) {
    if (!value) return "";
    const text = String(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
    const d = new Date(text);
    return Number.isNaN(d.getTime()) ? text : d.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" });
  }

  function authError() {
    const code = new URLSearchParams(location.search).get("auth");
    return code ? AUTH_ERROR[code] || "登录失败，请重试。" : "";
  }

  function renderAuth() {
    const box = $("authBox");
    const form = $("formSection");
    const mine = $("mineSection");
    if (!me) {
      box.innerHTML = '<div class="submit-loading">正在读取登录状态…</div>';
      return;
    }
    if (!me.auth_enabled) {
      box.innerHTML = `<div class="submit-auth-card"><div><h2>登录尚未启用</h2><p>GitHub OAuth 还没有配置完成。浏览和竞赛馆不受影响。</p></div><a class="submit-login" href="/hall">先去竞赛馆</a></div>`;
      form.hidden = true;
      mine.hidden = true;
      return;
    }
    if (!me.authenticated) {
      const error = authError();
      box.innerHTML = `<div class="submit-auth-card">
        <div><h2>使用 GitHub 登录后投稿</h2><p>只读取公开用户名、昵称和头像，不读取邮箱或仓库。${error ? `<br><strong style="color:var(--red)">${esc(error)}</strong>` : ""}</p></div>
        <a class="submit-login" href="/auth/github?return_to=/submit">使用 GitHub 登录</a>
      </div>`;
      form.hidden = true;
      mine.hidden = true;
      return;
    }
    const avatar = safeUrl(me.user.avatar_url);
    const profile = safeUrl(me.user.profile_url);
    box.innerHTML = `<div class="submit-auth-card">
      <div class="submit-user">
        ${avatar ? `<img src="${esc(avatar)}" alt="" referrerpolicy="no-referrer">` : ""}
        <div><strong>${esc(me.user.display_name || me.user.login)}</strong><small>@${esc(me.user.login)} · 已登录</small></div>
      </div>
      <div style="display:flex;gap:12px;align-items:center">
        ${profile ? `<a class="submit-logout" href="${esc(profile)}" target="_blank" rel="noreferrer">GitHub 主页</a>` : ""}
        <a class="submit-logout" href="/auth/logout">退出</a>
      </div>
    </div>`;
    form.hidden = false;
    mine.hidden = false;
  }

  function renderMine(items) {
    if (!items.length) {
      $("mineList").innerHTML = '<div class="submit-loading">还没有投稿。提交后会在这里看到审核状态。</div>';
      return;
    }
    $("mineList").innerHTML = items.map((item) => `<article class="submit-item">
      <div class="submit-item-top">
        <h3>${esc(item.title)}</h3>
        <time>${esc(fmt(item.created_at))}</time>
      </div>
      <span class="submit-status ${esc(item.status)}">${esc(STATUS[item.status] || item.status)}</span>
      ${item.admin_note ? `<p class="submit-note">审核备注：${esc(item.admin_note)}</p>` : ""}
      ${item.accepted_edition_id ? `<p>已进入草稿，管理员补充日期后会公开。</p>` : ""}
      <p>${esc(item.description.slice(0, 180))}${item.description.length > 180 ? "…" : ""}</p>
    </article>`).join("");
  }

  async function loadMine() {
    if (!me?.authenticated) return;
    try {
      const response = await fetch("/api/v1/submissions/mine", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      renderMine(data.items || []);
    } catch { /* ignore */ }
  }

  async function loadMe() {
    try {
      const response = await fetch("/api/v1/me", { cache: "no-store" });
      me = await response.json();
    } catch {
      me = { auth_enabled: false, authenticated: false, user: null };
    }
    renderAuth();
    if (me.authenticated) loadMine();
  }

  function bindForm() {
    $("submissionForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector("button[type=submit]");
      const message = $("formMessage");
      const body = Object.fromEntries(new FormData(form).entries());
      message.textContent = "";
      message.className = "submit-message";
      button.disabled = true;
      try {
        const response = await fetch("/api/v1/submissions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (response.status === 401) {
            await loadMe();
            return;
          }
          throw new Error(data.message || `HTTP ${response.status}`);
        }
        form.reset();
        message.textContent = "已提交，等待管理员审核。";
        message.className = "submit-message ok";
        loadMine();
      } catch (error) {
        message.textContent = error.message || "提交失败，请稍后重试。";
        message.className = "submit-message err";
      } finally {
        button.disabled = false;
      }
    });
  }

  bindForm();
  loadMe();
})();
