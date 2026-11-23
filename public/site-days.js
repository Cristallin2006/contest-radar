(() => {
  "use strict";
  const START = "2026-11-23T00:00:00+08:00";
  const DAY = 86_400_000;
  const startMs = new Date(START).getTime();

  function todayShanghai() {
    const text = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    return new Date(`${text}T00:00:00+08:00`).getTime();
  }

  function render() {
    const days = Math.max(1, Math.floor((todayShanghai() - startMs) / DAY) + 1);
    for (const node of document.querySelectorAll("[data-site-days]")) {
      node.textContent = `本站已运行 ${days} 天`;
      node.setAttribute("datetime", new Date(startMs).toISOString());
    }
  }

  render();
  // 页面长期打开时也会跨过午夜；不依赖服务器重启或手动更新。
  setInterval(render, 60_000);
})();
