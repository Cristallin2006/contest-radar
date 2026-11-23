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
  const AUTH_ERROR = {
    disabled: "GitHub 登录尚未配置，请联系站点管理员。",
    denied: "你取消了 GitHub 授权。",
    state: "登录状态已过期，请重新发起登录。",
    code: "GitHub 没有返回授权码，请重试。",
    error: "GitHub 登录失败，请稍后重试。",
    blocked: "该账号已被暂停发言权限。",
  };
  let me = null;
  let comments = [];

  function fmt(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString("zh-CN", {
      timeZone: "Asia/Shanghai",
      month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    });
  }

  function authError() {
    const code = new URLSearchParams(location.search).get("auth");
    return code ? AUTH_ERROR[code] || "登录失败，请重试。" : "";
  }

  function renderAuth() {
    if (!me) return;
    const box = $("authBox");
    const composer = $("composerSection");
    if (!me.auth_enabled) {
      box.innerHTML = '<div class="submit-auth-card"><div><h2>登录尚未启用</h2><p>留言板暂时不能发言，浏览和竞赛馆不受影响。</p></div><a class="submit-login" href="/hall">先去竞赛馆</a></div>';
      composer.hidden = true;
      return;
    }
    if (!me.authenticated) {
      const error = authError();
      box.innerHTML = `<div class="submit-auth-card"><div><h2>登录后发言</h2><p>只读取 GitHub 公开用户名、昵称和头像，不读取邮箱或仓库。${error ? `<br><strong style="color:var(--red)">${esc(error)}</strong>` : ""}</p></div><a class="submit-login" href="/auth/github?return_to=/board">使用 GitHub 登录</a></div>`;
      composer.hidden = true;
      return;
    }
    const avatar = safeUrl(me.user.avatar_url);
    const profile = safeUrl(me.user.profile_url);
    box.innerHTML = `<div class="submit-auth-card"><div class="submit-user">${avatar ? `<img src="${esc(avatar)}" alt="" referrerpolicy="no-referrer">` : ""}<div><strong>${esc(me.user.display_name || me.user.login)}</strong><small>@${esc(me.user.login)} · 已登录</small></div></div><div style="display:flex;gap:12px;align-items:center">${profile ? `<a class="submit-logout" href="${esc(profile)}" target="_blank" rel="noreferrer">GitHub 主页</a>` : ""}<a class="submit-logout" href="/auth/logout">退出</a></div></div>`;
    composer.hidden = false;
  }

  function renderComments() {
    $("commentCount").textContent = `${comments.length} 条`;
    if (!comments.length) {
      $("commentList").innerHTML = '<div class="board-empty"><strong>还没有留言</strong>登录后发第一条。</div>';
      return;
    }
    $("commentList").innerHTML = comments.map((item) => {
      const avatar = safeUrl(item.avatar_url);
      const profile = safeUrl(item.profile_url);
      const author = item.display_name || item.login;
      return `<article class="board-item" data-id="${item.id}">
        <div class="board-item-top">
          ${avatar ? `<img class="board-item-avatar" src="${esc(avatar)}" alt="" referrerpolicy="no-referrer">` : ""}
          ${profile ? `<a class="board-item-author" href="${esc(profile)}" target="_blank" rel="noreferrer">${esc(author)}</a>` : `<span class="board-item-author">${esc(author)}</span>`}
          <time class="board-item-time">${esc(fmt(item.created_at))}</time>
        </div>
        <div class="board-item-body">${esc(item.body)}</div>
      </article>`;
    }).join("");
  }

  async function loadComments() {
    try {
      const response = await fetch("/api/v1/comments", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      comments = data.items || [];
      renderComments();
    } catch (error) {
      $("commentList").innerHTML = `<div class="board-empty"><strong>留言加载失败</strong>${esc(error.message || error)}</div>`;
      $("commentCount").textContent = "加载失败";
    }
  }

  async function loadMe() {
    try {
      const response = await fetch("/api/v1/me", { cache: "no-store" });
      me = await response.json();
    } catch {
      me = { auth_enabled: false, authenticated: false, user: null };
    }
    renderAuth();
  }

  async function postComment() {
    const body = $("commentBody").value.trim();
    const message = $("commentMessage");
    const button = $("commentSubmit");
    message.textContent = "";
    message.className = "submit-message";
    if (!body) {
      message.textContent = "先写点内容。";
      message.className = "submit-message err";
      return;
    }
    button.disabled = true;
    try {
      const response = await fetch("/api/v1/comments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) {
          await loadMe();
          return;
        }
        throw new Error(data.message || `HTTP ${response.status}`);
      }
      $("commentBody").value = "";
      message.textContent = "已发布。";
      message.className = "submit-message ok";
      await loadComments();
    } catch (error) {
      message.textContent = error.message || "发布失败，请稍后重试。";
      message.className = "submit-message err";
    } finally {
      button.disabled = false;
    }
  }

  $("commentSubmit").addEventListener("click", postComment);
  loadMe();
  loadComments();
})();
