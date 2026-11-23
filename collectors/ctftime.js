import { fetchJson, clean, isoDate, shortHash } from "../util.js";
import { isDomesticCtfText, domesticCtfKey } from "./ctf.js";

export const id = "ctftime";
export const name = "CTFtime";

export async function collect() {
  const now = Math.floor(Date.now() / 1000);
  const start = now - 86_400 * 7;
  const finish = now + 86_400 * 180;
  const url = `https://ctftime.org/api/v1/events/?limit=100&start=${start}&finish=${finish}`;
  const data = await fetchJson(url);
  if (!Array.isArray(data)) throw new Error("CTFtime 返回格式异常");
  const min = Date.now() - 3_600_000;
  const domestic = [];
  const international = [];
  for (const e of data) {
    if (!e || !e.title || !e.start) continue;
    if (new Date(e.finish || e.start).getTime() < min) continue;
    const organizers = (e.organizers || []).map((o) => o.name).filter(Boolean).join(", ");
    const haystack = [e.title, e.location, organizers, e.url, e.ctftime_url].filter(Boolean).join(" ");
    const isCn = isDomesticCtfText(haystack);
    const weight = Number(e.weight || 0);
    if (!isCn && weight < 10) continue; // 国际赛只保留高权重，降低冗余
    const startIso = isoDate(e.start);
    const endIso = isoDate(e.finish || e.start);
    const onsite = Boolean(e.onsite);
    const location = e.location || "";
    const online = /online|virtual|internet/i.test(location);
    const row = {
      key: isCn ? domesticCtfKey(e.title, e.start) : `ctf-intl:${shortHash(e.title + e.start)}`,
      name: clean(e.title, 160),
      organizer: clean(organizers || "CTFtime 社区", 120),
      category: isCn ? "ctf-cn" : "ctf-intl",
      region: isCn ? "cn" : "intl",
      discipline: isCn ? "网络安全 / 国内 CTF" : "网络安全 / 国际 CTF",
      mode: onsite ? "offline" : online ? "online" : "unknown",
      location: clean(location, 120),
      registration_start: null,
      registration_deadline: null,
      event_start: startIso,
      event_end: endIso,
      eligibility: clean(e.restrictions, 160),
      team_size: null,
      fee: null,
      prize: clean(e.prizes, 300),
      url: e.url || e.ctftime_url,
      source: "ctftime",
      source_url: e.ctftime_url,
      description: clean(e.description, 700),
      tags: [isCn ? "国内CTF" : "国际CTF", "CTFtime", weight ? `weight ${weight}` : ""].filter(Boolean),
      date_confidence: "confirmed",
      last_checked: new Date().toISOString(),
    };
    if (isCn) domestic.push(row);
    else international.push(row);
  }
  domestic.sort((a, b) => String(a.event_start).localeCompare(String(b.event_start)));
  international.sort((a, b) => String(a.event_start).localeCompare(String(b.event_start)));
  return [...domestic.slice(0, 20), ...international.slice(0, 25)];
}
