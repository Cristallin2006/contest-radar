import { fetchJson, clean, isoDate, isoNow, norm } from "../util.js";

export const id = "gxxsjs";
export const name = "高校学生竞赛网";

const API = "https://www.gxxsjs.com/prod-api/home/competition/page";
const REFERER = "https://www.gxxsjs.com/home/homepage";

function categoryOf(name) {
  if (/数学建模|统计建模/.test(name)) return "mathmodel";
  if (/大数据|数据科学|数据分析|数据挖掘|算法/.test(name)) return "datamodel";
  if (/黑客松|hackathon/i.test(name)) return "hackathon";
  return "academic";
}

function detailUrl(item) {
  const direct = String(item.domainUrl || "").trim();
  if (/^https?:\/\//i.test(direct)) return direct;
  return `https://www.gxxsjs.com/home/competition/details?competitionId=${item.competitionId}`;
}

export async function collect() {
  const now = Date.now();
  const out = [];
  const seen = new Set();
  const seenName = new Set();
  for (let page = 1; page <= 3 && out.length < 100; page += 1) {
    const json = await fetchJson(`${API}?competitionName=&competitionRange=4&executeStatus=&provinceCode=&pageNum=${page}&pageSize=50`, {
      timeout: 25_000,
      headers: { referer: REFERER },
    });
    if (Number(json?.code) !== 0) throw new Error(`高校学生竞赛网 API 返回异常：${json?.msg || json?.code || "unknown"}`);
    const records = json?.data?.records || [];
    if (!records.length) break;
    for (const item of records) {
      if (out.length >= 100) break;
      if (!item.competitionName || !item.competitionId) continue;
      if (Number(item.executeStatus) === 40) continue;
      const end = new Date(String(item.endTime || "").replace(" ", "T")).getTime();
      if (Number.isFinite(end) && end < now - 86_400_000) continue;
      const key = `gxxsjs:${item.competitionId}`;
      if (seen.has(key)) continue;
      const candidateName = clean(item.competitionName, 180);
      if (/教师组|教师赛|教职工/.test(candidateName)) continue;
      const nameKey = norm(candidateName).replace(/20\d{2}/g, "");
      if (nameKey.length >= 6 && seenName.has(nameKey)) continue;
      seen.add(key);
      if (nameKey.length >= 6) seenName.add(nameKey);
      const start = isoDate(new Date(String(item.startTime || "").replace(" ", "T")));
      const finish = isoDate(new Date(String(item.endTime || "").replace(" ", "T")));
      const regStart = isoDate(new Date(String(item.enrollStartTime || "").replace(" ", "T")));
      const regEnd = isoDate(new Date(String(item.enrollEndTime || "").replace(" ", "T")));
      const sponsor = clean(item.sponsor, 260) || "高校学生竞赛网收录";
      const round = item.competitionRound ? `第${item.competitionRound}届` : "";
      out.push({
        key,
        name: candidateName,
        organizer: sponsor,
        category: categoryOf(item.competitionName),
        region: "cn",
        discipline: clean(["高校学生竞赛网", "国赛", round].filter(Boolean).join(" / "), 100),
        mode: "unknown",
        location: null,
        registration_start: regStart,
        registration_deadline: regEnd,
        event_start: start,
        event_end: finish,
        eligibility: "国赛 · 以官网为准",
        team_size: null,
        fee: null,
        prize: null,
        url: detailUrl(item),
        source: "gxxsjs",
        source_url: `https://www.gxxsjs.com/home/competition/details?competitionId=${item.competitionId}`,
        description: clean([
          "高校学生竞赛网收录",
          item.competitionYear ? `${item.competitionYear} 年` : "",
          round,
          sponsor,
          item.organizer ? `承办：${item.organizer}` : "",
        ].filter(Boolean).join(" · "), 700),
        tags: ["高校学生竞赛网", "国赛", item.competitionYear ? String(item.competitionYear) : "", round].filter(Boolean).slice(0, 8),
        date_confidence: start || regEnd ? "confirmed" : "unknown",
        last_checked: isoNow(),
      });
    }
    const pages = Number(json?.data?.pages || 1);
    if (page >= pages) break;
  }
  out.sort((a, b) => String(a.event_start || "9999").localeCompare(String(b.event_start || "9999")));
  return out;
}
