import { shortHash, norm } from "../util.js";

/**
 * 国内 CTF 的“实体归一”规则。
 * 目的：把 CTFtime / Adworld / CTFHub / 种子里的同一场比赛合并成一个 key，
 * 避免“强网杯”在三个源里出现三次。
 */
const ALIASES = [
  [/拟态|mimic/i, "qiangwang-mimic"],
  [/强网杯|qiangwang|qwb/i, "qiangwang-cup"],
  [/网鼎|wangding|wdc/i, "wangding"],
  [/ciscn|全国大学生信息安全竞赛|信安赛/i, "ciscn"],
  [/xctf|国际网络安全技术对抗联赛/i, "xctf"],
  [/羊城|yangcheng/i, "yangcheng"],
  [/长城|great\s*wall/i, "greatwall"],
  [/祥云|xiangyun/i, "xiangyun"],
  [/蓝帽|lanmao/i, "lanmao"],
  [/巅峰极客|dianfeng|dfg/i, "dfg"],
  [/春秋|chunqiu/i, "chunqiu"],
  [/第五空间|fifth\s*space/i, "fifthspace"],
  [/数字中国|digital\s*china/i, "digitalchina"],
  [/虎符|hufu/i, "hufu"],
  [/陇原|longyuan/i, "longyuan"],
  [/泰山|taishan/i, "taishan"],
  [/之江|zhijiang/i, "zhijiang"],
  [/闽盾|mindun/i, "mindun"],
  [/天府|tianfu/i, "tianfu"],
  [/黄河|huanghe/i, "huanghe"],
  [/长安|changan/i, "changan"],
  [/领航|linghang/i, "linghang"],
  [/太湖|taihu/i, "taihu"],
  [/tpctf|京华/i, "tpctf"],
  [/nepctf/i, "nepctf"],
];

const CN_REGIONS = [
  "中国", "china", "beijing", "北京", "shanghai", "上海", "shenzhen", "深圳",
  "guangzhou", "广州", "hangzhou", "杭州", "chengdu", "成都", "wuhan", "武汉",
  "nanjing", "南京", "xian", "西安", "suzhou", "苏州", "chongqing", "重庆",
  "tianjin", "天津", "harbin", "哈尔滨", "changsha", "长沙", "hefei", "合肥",
  "jinan", "济南", "qingdao", "青岛", "xiamen", "厦门", "fuzhou", "福州",
  "kunming", "昆明", "guiyang", "贵阳", "nanning", "南宁", "haikou", "海口",
  "zhengzhou", "郑州", "shenyang", "沈阳", "dalian", "大连", "changchun", "长春",
];

const CTF_WORDS = /CTF|夺旗|AWD|AWDP|攻防|解题|Jeopardy|渗透|红蓝|靶场/i;

export function ctfAlias(name) {
  const s = String(name ?? "");
  for (const [re, alias] of ALIASES) {
    if (re.test(s)) return alias;
  }
  return null;
}

export function ctfYear(name, start) {
  const m = String(name ?? "").match(/20\d{2}/);
  if (m) return m[0];
  if (start) {
    const d = new Date(start);
    if (!Number.isNaN(d.getTime())) return String(d.getFullYear());
  }
  return String(new Date().getFullYear());
}

export function domesticCtfKey(name, start) {
  const year = ctfYear(name, start);
  const alias = ctfAlias(name);
  return `ctf-cn:${alias || shortHash(norm(name))}:${year}`;
}

export function isDomesticCtfText(text) {
  const s = String(text ?? "");
  if (ctfAlias(s)) return true;
  if (/[\u4e00-\u9fff]/.test(s)) return true;
  const low = s.toLowerCase();
  if (CN_REGIONS.some((x) => low.includes(x))) return true;
  if (/\.cn(\/|$|\s)/i.test(s)) return true;
  return false;
}


const ALIAS_DISPLAY = {
  "qiangwang-cup": "强网杯全国网络安全挑战赛",
  "qiangwang-mimic": "强网拟态防御国际精英挑战赛",
  "wangding": "网鼎杯网络安全大赛",
  "ciscn": "全国大学生信息安全竞赛（CISCN）",
  "xctf": "XCTF 国际网络安全技术对抗联赛",
  "yangcheng": "羊城杯网络安全大赛",
  "greatwall": "长城杯网数智安全大赛",
  "xiangyun": "祥云杯网络安全大赛",
  "lanmao": "蓝帽杯网络安全大赛",
  "dfg": "巅峰极客网络安全挑战赛",
  "chunqiu": "春秋杯网络安全联赛",
  "fifthspace": "第五空间网络安全挑战赛",
  "digitalchina": "数字中国创新大赛",
  "hufu": "虎符网络安全挑战赛",
  "tpctf": "京华杯 TPCTF",
  "nepctf": "NepCTF",
};

export function ctfDisplayName(name) {
  const s = String(name ?? "");
  if (/[\u4e00-\u9fff]/.test(s)) return s;
  const alias = ctfAlias(s);
  const label = alias && ALIAS_DISPLAY[alias];
  if (!label) return s;
  const year = ctfYear(s);
  const phase = /final/i.test(s) ? " · 决赛" : /qual/i.test(s) ? " · 初赛" : "";
  return `${label} ${year}${phase}`;
}

export function isCtfText(text) {
  const s = String(text ?? "");
  return CTF_WORDS.test(s) || Boolean(ctfAlias(s));
}
