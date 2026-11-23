import { fetchText, clean, stripHtml, parseEnDate, isoDate, shortHash } from "../util.js";

export const id = "drivendata";
export const name = "DrivenData";

function isoFromCompact(s) {
  if (!/^\d{8}$/.test(String(s || ""))) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function plusDaysIso(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

export async function collect() {
  const html = await fetchText("https://www.drivendata.org/competitions/", { timeout: 25_000 });
  const cards = html.split('<div class=" d-flex col-md-6 col-xl-4 panel-container').slice(1);
  const out = [];
  for (const card of cards) {
    if (out.length >= 12) break;
    if (!/data-status_active="1"/.test(card)) continue;
    const full = '<div class="' + card;
    const titleM = full.match(
      /<h3[^>]*panel-competition-title[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i,
    );
    if (!titleM) continue;
    const url = titleM[1];
    const title = clean(titleM[2], 160);
    if (!title) continue;
    const text = stripHtml(full);
    if (/practice|benchmarks?|tutorial/i.test(title)) continue;

    const startM = card.match(/data-start_date="(\d{8})"/);
    const startIso = isoFromCompact(startM?.[1]);
    let endIso = parseEnDate(text);
    let confidence = endIso ? "confirmed" : "unknown";
    if (!endIso) {
      const weeks = text.match(/(\d+)\s+weeks?\s+left/i);
      const days = text.match(/(\d+)\s+days?\s+left/i);
      if (weeks) { endIso = plusDaysIso(Number(weeks[1]) * 7); confidence = "estimated"; }
      else if (days) { endIso = plusDaysIso(Number(days[1])); confidence = "estimated"; }
    }
    if (!endIso) continue;
    if (new Date(`${endIso}T23:59:59`).getTime() < Date.now() - 86_400_000) continue;

    const prizeM = card.match(/data-total_prize_purse="([\d.]+)"/);
    const prize = prizeM && Number(prizeM[1]) > 0 ? `$${Number(prizeM[1]).toLocaleString("en-US")}` : null;
    const tags = [...card.matchAll(/data-category_([a-z0-9_]+)="1"/gi)].map((m) => m[1]);
    out.push({
      key: `drivendata:${shortHash(url)}`,
      name: title,
      organizer: "DrivenData",
      category: "datamodel",
      region: "intl",
      discipline: "数据科学 / 机器学习",
      mode: "online",
      location: "Online",
      registration_start: null,
      registration_deadline: endIso,
      event_start: startIso,
      event_end: endIso,
      eligibility: null,
      team_size: null,
      fee: null,
      prize,
      url,
      source: "drivendata",
      source_url: "https://www.drivendata.org/competitions/",
      description: clean(text, 600),
      tags: ["数据竞赛", ...tags].filter(Boolean),
      date_confidence: confidence,
      last_checked: new Date().toISOString(),
    });
  }
  return out;
}
