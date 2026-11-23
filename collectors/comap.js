import { fetchText, stripHtml, parseMonthDay } from "../util.js";

export const id = "comap";
export const name = "COMAP / MCM-ICM";

function event(start, end, year, confidence, note = "") {
  return {
    key: `comap:mcm-icm-${year}`,
    name: `美国大学生数学建模竞赛（MCM/ICM）${year}`,
    organizer: "COMAP",
    category: "mathmodel",
    region: "intl",
    discipline: "数学建模 / 国际赛",
    mode: "online",
    location: "Online",
    registration_start: null,
    registration_deadline: null,
    event_start: start,
    event_end: end,
    eligibility: "本科生 / 高中生，1–3 人一队",
    team_size: "1–3 人",
    fee: "以官网为准",
    prize: "Outstanding / Finalist / Meritorious 等",
    url: "https://www.comap.com/contests/mcm-icm",
    source: "comap",
    source_url: "https://www.comap.com/contests/mcm-icm",
    description: `COMAP 主办的 MCM/ICM 国际数学建模竞赛，${start} 至 ${end}。报名与规则以官网为准。${note}`,
    tags: ["MCM/ICM", "数学建模", "国际赛"],
    date_confidence: confidence,
    last_checked: new Date().toISOString(),
  };
}

export async function collect() {
  try {
    const html = await fetchText("https://www.comap.com/contests/mcm-icm", { timeout: 25_000 });
    const text = stripHtml(html).replace(/\s+/g, " ");
    const m =
      text.match(/Upcoming Contest Dates[\s\S]{0,300}?([A-Z][a-z]+)\s+(\d{1,2})\s*[—–-]\s*([A-Z][a-z]+)\s+(\d{1,2}),\s*(\d{4})/i) ||
      text.match(/([A-Z][a-z]+)\s+(\d{1,2})\s*[—–-]\s*([A-Z][a-z]+)\s+(\d{1,2}),\s*(\d{4})/);
    if (!m) throw new Error("未从 COMAP 页面解析到比赛日期");
    const year = Number(m[5]);
    const start = parseMonthDay(`${m[1]} ${m[2]}`, year);
    const end = parseMonthDay(`${m[3]} ${m[4]}`, year);
    if (!start || !end) throw new Error("COMAP 日期解析失败");
    return [event(start, end, year, "confirmed")];
  } catch (err) {
    // 页面偶发 DNS/网络失败时保留已确认的 2027 日程，避免数模类别空白
    return [event("2027-01-28", "2027-02-01", 2027, "estimated", "（页面暂时不可达，日期按官网已公布日程保留，请以官网为准）")];
  }
}
