(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (v) => {
    if (!v) return "—";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  };
  const labels = {
    title: "标题", organizer: "主办方", description: "简介", year: "年份", region: "地区",
    category: "类别", lifecycle: "生命周期", status_override: "状态覆盖", publish_state: "发布状态",
    signup_url: "报名链接", source_url: "原文链接", fee: "费用", prizes: "奖项",
    eligibility: "资格", difficulty: "难度", date_confidence: "日期置信度",
    field: "方向", content_type: "内容类型", source_category: "来源分类",
    kind: "类型", name: "名称", starts_at: "开始", ends_at: "结束", deadline_at: "截止",
    time_status: "时间状态", is_all_day: "全天", mode: "形式", location: "地点", note: "备注", sort_order: "排序",
  };
  function describe(diff) {
    if (!diff || typeof diff !== "object") return { kind: "", text: "更新赛事" };
    if (diff.created) return { kind: "create", text: "新建赛事" };
    if (diff.stage_created) return { kind: "time", text: `新增阶段：${diff.stage?.name || diff.stage?.kind || ""}` };
    if (diff.stage_deleted) return { kind: "time", text: `删除阶段：${diff.stage?.name || diff.stage?.kind || ""}` };
    if (diff.stage_updated) {
      const fields = Object.keys(diff.changes || {});
      if (fields.length > 6) return { kind: "time", text: "更新阶段时间 / 状态 / 地点" };
      return { kind: "time", text: `更新阶段${fields.length ? `：${fields.map((f) => labels[f] || f).join("、")}` : ""}` };
    }
    if (diff.changed) {
      const fields = Object.keys(diff.changed);
      const key = fields.some((f) => ["lifecycle", "status_override"].includes(f));
      return { kind: key ? "cancel" : "", text: fields.length ? `更新：${fields.map((f) => labels[f] || f).join("、")}` : "更新赛事" };
    }
    if (diff.publish_state) return { kind: "cancel", text: `发布状态：${diff.publish_state.from || "?"} → ${diff.publish_state.to || "?"}` };
    return { kind: "", text: "更新赛事" };
  }
  async function load() {
    const list = $("#changesList");
    try {
      const res = await fetch("/api/v1/changes?limit=100", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items = data.items || [];
      $("#changesMeta").textContent = `${items.length} 条记录`;
      if (!items.length) {
        list.innerHTML = '<div class="changes-empty">还没有公开变更记录。</div>';
        return;
      }
      list.innerHTML = items.map((c) => {
        const info = describe(c.diff);
        return `<a class="change-card" href="/competition/${encodeURIComponent(c.edition_id)}">
          <div class="top">
            <div><span class="change-kind ${esc(info.kind)}">${esc(info.text)}</span></div>
            <time class="when">${esc(fmt(c.changed_at))}</time>
          </div>
          <h3>${esc(c.edition_title || `赛事 #${c.edition_id}`)}</h3>
          <p>操作者：${esc(c.actor_label || "admin")}${c.is_key_change ? " · 关键时间/状态变更" : ""}</p>
        </a>`;
      }).join("");
    } catch (err) {
      list.innerHTML = `<div class="changes-empty">加载失败：${esc(err.message || err)}</div>`;
    }
  }
  load();
})();
