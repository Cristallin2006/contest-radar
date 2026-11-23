import { fetchJson, clean, isoDate, parseDeadline } from "../util.js";
import { domesticCtfKey, isCtfText } from "./ctf.js";

export const id = "adworld";
export const name = "攻防世界 / XCTF";

const BASE = "https://adworld.xctf.org.cn";
const API = `${BASE}/api/ad/community/public/events/`;

export async function collect() {
  const rows = [];
  let total = Infinity;
  for (let page = 1; page <= 6 && rows.length < 40; page += 1) {
    const json = await fetchJson(`${API}?page=${page}`, {
      timeout: 20_000,
      headers: { referer: `${BASE}/competitions-hall/competitions` },
    });
    const data = json?.data;
    const list = data?.list || [];
    if (!list.length) break;
    total = Number(data?.total || total);
    const now = Date.now();
    for (const e of list) {
      const start = e.start_time ? new Date(e.start_time).getTime() : null;
      const end = e.end_time ? new Date(e.end_time).getTime() : null;
      if ((end && end < now - 3_600_000) || (!end && start && start < now - 3_600_000)) continue;
      const text = `${e.name || ""} ${e.brief || ""}`;
      if (!isCtfText(text)) continue;
      const brief = clean(e.brief, 800);
      const hasOnline = /线上|网络|云端/.test(brief);
      const hasOffline = /线下|现场/.test(brief);
      const mode = hasOnline && hasOffline ? "hybrid" : hasOnline ? "online" : hasOffline ? "offline" : "unknown";
      const startIso = isoDate(e.start_time);
      const endIso = isoDate(e.end_time);
      rows.push({
        key: domesticCtfKey(e.name, startIso),
        name: clean(e.name, 160),
        organizer: clean(e.organizer, 160) || "攻防世界 / XCTF",
        category: "ctf-cn",
        region: "cn",
        discipline: "网络安全 / 国内 CTF",
        mode,
        location: null,
        registration_start: null,
        registration_deadline: parseDeadline(brief) || null,
        event_start: startIso,
        event_end: endIso,
        eligibility: null,
        team_size: null,
        fee: null,
        prize: Number(e.reward) > 0 ? String(e.reward) : null,
        url: `${BASE}/competitions-hall/competitions/security-detail/${e.id}`,
        source: "adworld",
        source_url: `${API}${e.id}/`,
        description: brief,
        tags: ["国内CTF", "攻防赛", "官方赛事", mode === "online" ? "线上" : mode === "offline" ? "线下" : ""].filter(Boolean),
        date_confidence: "confirmed",
        last_checked: new Date().toISOString(),
      });
    }
    if (page * 10 >= total) break;
  }
  return rows;
}
