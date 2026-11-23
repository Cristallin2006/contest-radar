import { fetchText, clean, isoDate, shortHash } from "../util.js";
import { isDomesticCtfText } from "./ctf.js";

export const id = "devpost";
export const name = "Devpost";

function parseJsonLd(html) {
  const m = html.match(
    /<script[^>]+type="application\/ld\+json"[^>]*id="challenges-json-ld"[^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!m) throw new Error("未找到 Devpost challenges JSON-LD");
  return JSON.parse(m[1]);
}

function modeOf(item) {
  const m = String(item.eventAttendanceMode || "");
  if (/Online/i.test(m)) return "online";
  if (/Offline/i.test(m)) return "offline";
  if (/Mixed/i.test(m)) return "hybrid";
  return "unknown";
}

export async function collect() {
  const html = await fetchText("https://devpost.com/hackathons", { timeout: 25_000 });
  const json = parseJsonLd(html);
  const list = json.itemListElement || [];
  const now = Date.now();
  const items = [];
  for (const entry of list) {
    const item = entry?.item;
    if (!item || !item.name) continue;
    if (/^test\b|^sample\b|^demo\b|^template\b/i.test(item.name)) continue;
    if (/course|certification|bootcamp|training program|webinar/i.test(item.name)) continue;
    if (item.eventStatus && !/EventScheduled/i.test(String(item.eventStatus))) continue;
    const end = item.endDate ? new Date(item.endDate) : null;
    if (end && end.getTime() < now - 86_400_000) continue;
    const startIso = isoDate(item.startDate);
    const endIso = isoDate(item.endDate);
    if (!startIso && !endIso) continue;
    const url = item.url || item["@id"] || "";
    const address = item.location?.address?.name || item.location?.name || "";
    const mode = modeOf(item);
    const region = isDomesticCtfText(`${item.name} ${address}`) ? "cn" : "intl";
    items.push({
      key: `devpost:${item["@id"] || shortHash(item.name + startIso)}`,
      name: clean(item.name, 160),
      organizer: clean(item.organizer?.name || "Devpost", 120),
      category: "hackathon",
      region,
      discipline: "黑客松 / 开发竞赛",
      mode,
      location: clean(address, 100),
      registration_start: null,
      // Devpost 的 endDate 是项目提交截止；用“提交截止”标签提示
      registration_deadline: endIso,
      event_start: startIso,
      event_end: endIso,
      eligibility: null,
      team_size: null,
      fee: null,
      prize: null,
      url,
      source: "devpost",
      source_url: item["@id"] || url,
      description: clean(item.description, 700),
      tags: ["黑客松", "提交截止", ...(Array.isArray(item.keywords) ? item.keywords : [])].filter(Boolean),
      date_confidence: "confirmed",
      last_checked: new Date().toISOString(),
    });
    if (items.length >= 80) break;
  }
  return items;
}
