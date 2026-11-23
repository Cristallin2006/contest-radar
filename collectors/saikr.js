import { fetchJson, clean, isoDate, isoNow, norm } from "../util.js";

export const id = "saikr";
export const name = "赛氪";

const API = "https://apiv4buffer.saikr.com/api/pc/contest/lists";
const REFERER = "https://www.saikr.com/contests";

function unixDate(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return isoDate(new Date(n * 1000));
}

function categoryOf(item) {
  const name = String(item.contest_name || "");
  const cls = String(item.contest_class_second || "");
  if (cls === "mcm" || /数学建模|统计建模/.test(name)) return "mathmodel";
  if (cls === "big_data" || /大数据|数据科学|数据分析|数据挖掘/.test(name)) return "datamodel";
  if (/黑客松|hackathon/i.test(name)) return "hackathon";
  return "academic";
}

function contestUrl(item) {
  const raw = String(item.contest_url || "").trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!raw) return "https://www.saikr.com/contests";
  return `https://www.saikr.com/${raw.replace(/^\/+/, "")}`;
}

export async function collect() {
  const now = Date.now();
  const out = [];
  const seen = new Set();
  const seenName = new Set();
  for (let page = 1; page <= 3 && out.length < 120; page += 1) {
    const json = await fetchJson(`${API}?page=${page}&limit=100&univs_id=&class_id=&level=0&sort=0`, {
      timeout: 25_000,
      headers: { referer: REFERER, origin: "https://www.saikr.com" },
    });
    if (Number(json?.code) !== 200) throw new Error(`赛氪 API 返回异常：${json?.msg || json?.code || "unknown"}`);
    const list = json?.data?.list || [];
    if (!list.length) break;
    for (const item of list) {
      if (out.length >= 120) break;
      const end = Number(item.contest_end_time) * 1000;
      if (!item.contest_name || !item.contest_id) continue;
      if (Number(item.is_contest_status) === 0) continue;
      if (Number(item.time_status) === 23) continue;
      if (Number.isFinite(end) && end > 0 && end < now - 86_400_000) continue;
      const key = `saikr:${item.contest_id}`;
      if (seen.has(key)) continue;
      const candidateName = clean(item.contest_name, 180);
      if (/证书|资料包|薅|信息差|免费参与|免费参赛|免费报名|辅助报名|预报名|报名处|报名入口|报名点|考点|校内|校级|院级|教师|金课|招聘|实习|课程|题库|答案|考试|测评|夏令营|志愿者|认证|中小学|青少年|少儿|萌宠|茶艺|才艺|配音|吟唱|朗诵|体育文化|心理|思政微课/.test(candidateName)) continue;
      const nameKey = norm(candidateName).replace(/20\d{2}/g, "");
      if (nameKey.length >= 6 && seenName.has(nameKey)) continue;
      seen.add(key);
      if (nameKey.length >= 6) seenName.add(nameKey);
      const labels = Array.isArray(item.labels) ? item.labels.map((x) => clean(x, 40)).filter(Boolean) : [];
      const organizer = clean(item.organiser, 160) || "赛氪收录";
      const start = unixDate(item.contest_start_time);
      const finish = unixDate(item.contest_end_time);
      const regStart = unixDate(item.regist_start_time);
      const regEnd = unixDate(item.regist_end_time);
      out.push({
        key,
        name: candidateName,
        organizer,
        category: categoryOf(item),
        region: "cn",
        discipline: clean([item.level_name, item.enter_range].filter(Boolean).join(" / "), 100) || "学科竞赛",
        mode: "unknown",
        location: null,
        registration_start: regStart,
        registration_deadline: regEnd,
        event_start: start,
        event_end: finish,
        eligibility: clean([item.enter_range, item.level_name].filter(Boolean).join(" · "), 160) || null,
        team_size: null,
        fee: null,
        prize: null,
        url: contestUrl(item),
        source: "saikr",
        source_url: REFERER,
        description: clean([
          "赛氪收录",
          item.level_name,
          organizer,
          item.time_name,
          labels.join(" / "),
        ].filter(Boolean).join(" · "), 700),
        tags: ["赛氪", item.level_name, item.time_name, ...labels].filter(Boolean).slice(0, 10),
        date_confidence: start || regEnd ? "confirmed" : "unknown",
        last_checked: isoNow(),
      });
    }
    const total = Number(json?.data?.total || 0);
    if (page * 100 >= total) break;
  }
  out.sort((a, b) => String(a.event_start || "9999").localeCompare(String(b.event_start || "9999")));
  return out;
}
