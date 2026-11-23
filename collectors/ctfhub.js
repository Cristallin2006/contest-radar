import { clean, isoDate } from "../util.js";
import { domesticCtfKey, isDomesticCtfText } from "./ctf.js";

export const id = "ctfhub";
export const name = "CTFHub";

async function postJson(url, body) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36 ContestRadar/0.1",
          "content-type": "application/json",
          referer: "https://www.ctfhub.com/",
          origin: "https://www.ctfhub.com",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ctfhub`);
      return res.json();
    } catch (err) {
      lastError = err;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 800));
    }
  }
  throw lastError;
}

export async function collect() {
  const json = await postJson("https://api.ctfhub.com/User_API/Event/getAll", { offset: 0, limit: 100 });
  const items = json?.data?.items || [];
  const rows = [];
  for (const e of items) {
    const startIso = e.start_time ? isoDate(new Date(e.start_time * 1000)) : null;
    const endIso = e.end_time ? isoDate(new Date(e.end_time * 1000)) : null;
    if (endIso && new Date(`${endIso}T23:59:59`).getTime() < Date.now() - 86_400_000) continue;
    const official = /^https?:\/\//i.test(e.official_url || "") ? e.official_url : null;
    const hay = [e.title, official].filter(Boolean).join(" ");
    if (!isDomesticCtfText(hay)) continue;
    const form = e.form || "";
    rows.push({
      key: domesticCtfKey(e.title, startIso),
      name: clean(e.title, 160),
      organizer: "CTFHub",
      category: "ctf-cn",
      region: "cn",
      discipline: "网络安全 / 国内 CTF",
      mode: form.includes("线下") ? "offline" : form.includes("线上") ? "online" : "unknown",
      location: null,
      registration_start: null,
      registration_deadline: null,
      event_start: startIso,
      event_end: endIso,
      eligibility: null,
      team_size: null,
      fee: null,
      prize: null,
      url: official || "https://www.ctfhub.com/",
      source: "ctfhub",
      source_url: "https://www.ctfhub.com/",
      description: clean([e.class, form ? `形式：${form}` : ""].filter(Boolean).join(" · "), 300),
      tags: ["国内CTF", "CTFHub", e.class].filter(Boolean),
      date_confidence: "confirmed",
      last_checked: new Date().toISOString(),
    });
    if (rows.length >= 20) break;
  }
  return rows;
}
