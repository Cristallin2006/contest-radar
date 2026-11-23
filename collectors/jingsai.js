import { fetchText, clean, stripHtml, parseDeadline, shortHash } from "../util.js";

export const id = "jingsai";
export const name = "我爱竞赛网";

const BASE = "https://www.52jingsai.com/";

function categoryOf(text) {
  if (/数学建模|数模/.test(text)) return ["mathmodel", "数学建模"];
  if (/数学/.test(text)) return ["academic", "数学"];
  if (/英语|翻译|写作|普通话|文学|外语/.test(text)) return ["academic", "英语 / 文学"];
  if (/设计|广告|创意|摄影|动漫|书画|艺术/.test(text)) return ["academic", "设计 / 艺术"];
  if (/计算机|软件|程序|IT|人工智能|AI|大数据|算法|开发|编程/.test(text)) return ["academic", "计算机 / IT"];
  if (/创业|创新|互联网|商业|营销|金融|经济/.test(text)) return ["academic", "商业 / 创新"];
  if (/物理|化学|生物|学科|学术/.test(text)) return ["academic", "学科学术"];
  return ["academic", "学科竞赛"];
}

function organizerOf(text) {
  const m = String(text).match(/主办(?:单位|方)?[：:]\s*([^|｜。；;\n]{2,80})/);
  return m ? clean(m[1], 100) : null;
}

export async function collect() {
  const html = await fetchText(BASE, { encoding: "gbk", timeout: 25_000 });
  const chunks = html.split('<div class="tab_c_item">').slice(1);
  const now = new Date();
  const seen = new Set();
  const out = [];
  for (const chunk of chunks) {
    const hrefM = chunk.match(/href="(article-\d+-\d+\.html)"/i);
    const titleM = chunk.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    if (!hrefM || !titleM) continue;
    if (seen.has(hrefM[1])) continue;
    seen.add(hrefM[1]);
    const title = clean(titleM[1], 160);
    if (!title || !/(大赛|竞赛|挑战赛|比赛|杯|赛|征集|选拔)/.test(title)) continue;
    if (/(结果|揭晓|获奖|公示|新闻|招募|实习|夏令营|志愿者|工作岗|入选|名单|证书领取)/.test(title)) continue;

    const postedM = chunk.match(/<span>(\d{4}-\d{2}-\d{2})<\/span>/);
    const posted = postedM?.[1] || null;
    if (posted) {
      const age = (Date.now() - new Date(`${posted}T00:00:00`).getTime()) / 86_400_000;
      if (age > 200) continue;
    }
    const introM = chunk.match(/<div class="t_c_intro">([\s\S]*?)<\/div>/i);
    const intro = clean(introM ? stripHtml(introM[1]) : "", 500);
    const text = `${title} ${intro}`;
    const [category, discipline] = categoryOf(text);
    const deadline = parseDeadline(text, now);
    if (deadline) {
      const left = (new Date(`${deadline}T23:59:59`).getTime() - Date.now()) / 86_400_000;
      if (left < -14) continue;
    } else if (posted) {
      const age = (Date.now() - new Date(`${posted}T00:00:00`).getTime()) / 86_400_000;
      if (age > 75) continue;
    }

    out.push({
      key: `jingsai:${shortHash(title.replace(/\s+/g, ""))}`,
      name: title,
      organizer: organizerOf(text) || "我爱竞赛网收录",
      category,
      region: "cn",
      discipline,
      mode: /线上|网络|云上/.test(text) ? "online" : /线下|现场/.test(text) ? "offline" : "unknown",
      location: null,
      registration_start: null,
      registration_deadline: deadline,
      event_start: null,
      event_end: null,
      eligibility: null,
      team_size: null,
      fee: null,
      prize: null,
      url: new URL(hrefM[1], BASE).href,
      source: "jingsai",
      source_url: new URL(hrefM[1], BASE).href,
      description: intro || title,
      tags: ["学科竞赛", posted ? `发布于 ${posted}` : ""].filter(Boolean),
      date_confidence: deadline ? "estimated" : "unknown",
      last_checked: new Date().toISOString(),
    });
    if (out.length >= 70) break;
  }
  return out;
}
