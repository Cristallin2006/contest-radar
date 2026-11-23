import { fetchText, clean, stripHtml, parseDeadline } from "../util.js";
import { domesticCtfKey } from "./ctf.js";

export const id = "haobachang";
export const name = "好靶场 · 比赛日历";

function parseDotDate(value, fallbackYear) {
  const s = String(value || "").trim();
  let m = s.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})/);
  if (m) return { iso: `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`, year: Number(m[1]) };
  m = s.match(/(\d{1,2})\.(\d{1,2})/);
  if (m && fallbackYear) {
    return { iso: `${fallbackYear}-${String(m[1]).padStart(2, "0")}-${String(m[2]).padStart(2, "0")}`, year: fallbackYear };
  }
  return null;
}

export async function collect() {
  const html = await fetchText("http://haobachang.com/calendar?type=cn", { timeout: 25_000 });
  const blocks = html.split('<article class="evt ').slice(1);
  const rows = [];
  for (const block of blocks) {
    if (rows.length >= 20) break;
    const cls = block.slice(0, block.indexOf('"'));
    if (!/evt--up|evt--live/.test(cls)) continue;
    const nameM = block.match(/<h4 class="evt__name">([\s\S]*?)<\/h4>/);
    const datesM = block.match(/<span class="evt__dates">([\s\S]*?)<\/span>/);
    if (!nameM || !datesM) continue;
    const name = clean(nameM[1], 180);
    const dateText = stripHtml(datesM[1]);
    const [left, right] = dateText.split(/\s*[-–—]\s*/);
    const first = parseDotDate(left);
    if (!first) continue;
    let second = right ? parseDotDate(right, first.year) : first;
    if (!second) second = first;
    if (!right && !/^\d{4}\./.test(left)) continue;
    // 跨年：只有月日且第二段小于第一段时，年份 +1
    if (right && !/\d{4}\./.test(right)) {
      const f = new Date(`${first.iso}T00:00:00`);
      const s = new Date(`${second.iso}T00:00:00`);
      if (s.getTime() < f.getTime()) {
        second = parseDotDate(right, first.year + 1) || second;
      }
    }
    const noteM = block.match(/<p class="evt__note">([\s\S]*?)<\/p>/);
    const note = noteM ? clean(stripHtml(noteM[1]), 700) : "";
    const tags = [...block.matchAll(/<span class="evt__tag[^"]*">([\s\S]*?)<\/span>/g)]
      .map((m) => clean(stripHtml(m[1]), 80))
      .filter(Boolean);
    const modeTag = block.match(/<span class="evt__tag evt__tag--mode">([\s\S]*?)<\/span>/);
    const modeText = modeTag ? clean(stripHtml(modeTag[1]), 80) : "";
    const mode = /混合|线上线下/.test(modeText) ? "hybrid" : /线下|现场/.test(modeText) ? "offline" : /线上|网络/.test(modeText) ? "online" : "unknown";
    const location = modeText.includes("·") ? clean(modeText.split("·").pop(), 60) : null;
    const hrefM = block.match(/<a[^>]+href="([^"]+)"[^>]*>\s*报名/);
    const url = hrefM ? new URL(hrefM[1], "http://haobachang.com/").href : "http://haobachang.com/calendar?type=cn";
    const organizer = tags.find((t) => /大学|学院|委|中心|协会|部|厅|局|公司/.test(t) && !/^线下|^线上/.test(t)) || "好靶场日历收录";
    rows.push({
      key: domesticCtfKey(name, first.iso),
      name,
      organizer,
      category: "ctf-cn",
      region: "cn",
      discipline: "网络安全 / 国内 CTF",
      mode,
      location,
      registration_start: null,
      registration_deadline: parseDeadline(note) || null,
      event_start: first.iso,
      event_end: second.iso,
      eligibility: null,
      team_size: null,
      fee: null,
      prize: null,
      url,
      source: "haobachang",
      source_url: "http://haobachang.com/calendar?type=cn",
      description: note,
      tags: ["国内CTF", "好靶场", ...tags].slice(0, 10),
      date_confidence: "estimated",
      last_checked: new Date().toISOString(),
    });
  }
  return rows;
}
