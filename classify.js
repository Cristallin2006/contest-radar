/**
 * Contest classification: content type + academic field.
 *
 * Important: a keyword alone is not trusted. Rules are ordered, source-native
 * categories win, and explicit negative guards handle known traps such as:
 *   - 计算机设计 -> software, not design
 *   - 光电设计   -> electronics, not design
 *   - 结构设计   -> engineering, not design
 *   - 电子商务   -> business, not electronics
 *   - 数据马拉松 -> data, not sports
 *   - 全球       -> not a ball sport
 *   - 冰雪杯     -> language, not winter sports
 */

export const FIELD_LABELS = {
  cyber: "网络安全 / CTF",
  software: "计算机 / 软件 / AI",
  data: "数据科学 / 统计",
  math: "数学 / 建模",
  electronics: "电子 / 电气 / 自动化 / 通信",
  engineering: "机械 / 土木 / 结构 / 交通 / 能源",
  science: "物理 / 化学 / 生物 / 医学 / 材料",
  design: "设计 / 艺术 / 建筑 / 文创",
  business: "商科 / 金融 / 管理 / 创业",
  language: "外语 / 翻译 / 写作",
  humanities: "文学 / 历史 / 法律 / 教育 / 社会",
  sports: "体育 / 运动 / 电竞",
  other: "公益 / 综合 / 待细分",
};

export const CONTENT_TYPE_LABELS = {
  competition: "竞赛",
  volunteer: "志愿者 / 招募",
  conference: "论坛 / 会议",
  course: "课程 / 培训 / 证书",
  activity: "庆典 / 展播 / 活动",
  other: "其他",
};

export const FIELD_ORDER = [
  "cyber", "software", "data", "math", "electronics", "engineering",
  "science", "design", "business", "language", "humanities", "sports", "other",
];

export const CONTENT_TYPE_ORDER = [
  "competition", "volunteer", "conference", "course", "activity", "other",
];

const SAIKR_SOURCE_FIELDS = {
  english: "language",
  big_data: "data",
  mcm: "math",
  robot: "electronics",
  environment: "science",
  health: "science",
  art_assessment: "design",
  song_and_dance: "design",
  business: "business",
};

function textOf(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function rule(field, include, reason, exclude = null) {
  return { field, include, exclude, reason };
}

// Explicit contest families that otherwise collide with AI/design/engineering.
const FIELD_OVERRIDES = [
  rule("design", /华灿奖|AIGC|AI生成世界|AI图像|AI视频|视觉传达|服装服饰设计|环境设计|工业设计|产品设计|广告艺术|好创意|数字艺术|科技美术|新媒体创新创意/i, "设计/艺术专项"),
  rule("business", /中国国际大学生创新大赛|营销|金融科技|电子商务|商务谈判|贸易|创业|工商管理|人力资源|税收|财税|经济管理|创新创业/i, "商科/管理专项"),
  rule("other", /^“挑战杯”|^挑战杯全国|全国大学生课外学术科技作品|乡村振兴|标准化奥林匹克|一带一路暨金砖国家技能发展与技术创新/i, "综合/交叉赛事"),
];

// Order matters: earlier rules win. Keep broad, ambiguous words out.
const FIELD_RULES = [
  rule("language", /英语|英文|外语|翻译|写作|阅读|词汇|语法|口语|听力|日语|俄语|法语|德语|韩语|西班牙语|汉语|普通话|双语|外语能力|外研社|中译|译|规范字|语言文字|汉字|作文|语文|诵写讲|经典/i, "外语/翻译/写作/语言文字关键词"),
  rule("data", /数据挖掘|数据分析|数据科学|大数据|数据竞赛|数据挑战|商业分析|数据统计|数据马拉松/i, "数据/统计关键词"),
  rule("math", /数学建模|数学竞赛|数学能力|数学挑战|奥林匹克数学|高等数学|概率|运筹|数值计算|统计建模|统计科学|统计/i, "数学/建模关键词"),
  rule("software", /计算机|软件|程序|算法|编程|C语言|C\+\+|Python|Java|人工智能|AI|机器学习|深度学习|大模型|信息技术|信息系统|网络安全|信息安全|网络空间|区块链|物联网|云计算|操作系统|数据库|前端|后端|全栈|Office|办公应用|办公软件|工业互联网|数智链/i, "计算机/软件/AI关键词"),
  rule("business", /商科|商业|金融|经济|管理|营销|创业|创新创业|电子商务|电商|会计|审计|物流|供应链|市场调查|市场营销|工商管理|人力资源|国际贸易|贸易|商务谈判|谈判|会展|策划|财务|税收|财税|就业|职业规划|职业技能/i, "商科/金融/管理/就业关键词"),
  rule("electronics", /电子设计|电子信息|电子技术|电气|自动化|通信|集成电路|芯片|光电|嵌入式|机器人|无人机|无人车|域控|自动驾驶|智能车|传感器|EDA|脑机接口|脑控|高电压|等离子体/i, "电子/电气/自动化关键词"),
  rule("design", /广告艺术|视觉传达|艺术设计|平面设计|工业设计|产品设计|环境设计|服装设计|服饰设计|建筑设计|规划设计|室内设计|景观设计|展示设计|文创|美术|摄影|动画|数字媒体|UI设计|艺术大赛|设计大赛|设计竞赛|设计创新|创意设计|广告大赛|华灿奖|好创意|短视频|视频创作|新媒体/i, "设计/艺术/媒体关键词", /计算机设计|程序设计|算法设计|结构设计|光电设计|机械.*设计|数字孪生|工程设计/),
  rule("engineering", /机械|土木|结构设计|结构竞赛|交通|车辆|汽车|航空|航天|能源|动力|船舶|水利|测绘|工程实践|工程训练|材料成型|智能制造|工业工程|环境工程|安全工程|建筑环境|数字孪生/i, "机械/土木/工程关键词"),
  rule("science", /物理|化学|生物|生命科学|医学|药学|护理|健康科学|材料|环境科学|地理|地质|气象|海洋|天文|生态|食品科学|农业|环保/i, "理科/医学/环境关键词"),
  rule("humanities", /文学|历史|哲学|法律|法学|宪法|普法|维权|思政|政治|社会|文化|教育|新闻|传播|心理|伦理|语言文学|国学|通识/i, "人文/社科关键词"),
  rule("sports", /体育|运动会|健身|马拉松|田径|游泳|篮球|足球|排球|羽毛球|乒乓球|网球|电竞|电子竞技|KPL|武术|跆拳道|瑜伽|健美操|龙舟|赛艇|骑行|登山|滑雪|冰雪运动|围棋|象棋|桥牌/i, "体育/运动/电竞关键词", /黑客松|创客|编程|算法|数据|数学|人工智能|AI/i),
  rule("cyber", /CTF|夺旗|AWD|AWDP|攻防|渗透|红蓝对抗|网络安全|信息安全|网络空间安全/i, "网络安全/CTF关键词"),
];

const NON_COMPETITION_RULES = [
  ["volunteer", /志愿者|义工|观众招募|工作人员招募|招募志愿者|志愿者服务/i, "志愿者/招募"],
  ["conference", /论坛|峰会|研讨会|学术会议|年会|讲座|座谈会/i, "论坛/会议"],
  ["course", /课程|培训班|训练营|证书申领|资料包|题库|考试|测评/i, "课程/培训/考试"],
  ["activity", /庆典|展播|晚会|嘉年华|颁奖典礼|文化节/i, "庆典/活动"],
];

function sourceField(source, sourceCategory, title) {
  if (!sourceCategory) return null;
  const raw = textOf(sourceCategory).toLowerCase();
  if (source === "saikr") {
    // "big_data" is too broad on Saikr: C++/IoT and data-analysis contests
    // share it. Trust the title unless it clearly names data work.
    if (raw === "big_data" && !/数据|统计|分析/.test(title)) return null;
    const field = SAIKR_SOURCE_FIELDS[raw];
    if (field) return { field, reason: `赛氪分类 ${sourceCategory}` };
  }
  if (source === "jingsai") {
    // Jingsai's discipline strings are descriptive; use the field rules.
    return null;
  }
  return null;
}

function contentTypeOf(title, description) {
  const text = title;
  const contentText = `${title} ${description}`;
  const hasCompetitionWord = /大赛|竞赛|挑战赛|比赛|赛项|赛道|杯/i.test(text);
  for (const [type, regex, reason] of NON_COMPETITION_RULES) {
    const haystack = type === "volunteer" ? contentText : text;
    if (!regex.test(haystack)) continue;
    // "课程思政大赛" etc. are competitions despite containing 课程.
    if (type === "course" && hasCompetitionWord) continue;
    // "学术会议论文竞赛" is possible, but flag only when no competition word.
    if (type === "conference" && hasCompetitionWord) continue;
    return { type, confidence: type === "volunteer" ? "high" : "medium", reason };
  }
  return { type: "competition", confidence: "high", reason: "未命中非竞赛规则" };
}

export function classifyCompetition(input = {}) {
  const title = textOf(input.title ?? input.name);
  const description = textOf(input.description);
  const category = textOf(input.category);
  const source = textOf(input.source);
  const sourceCategory = textOf(input.source_category ?? input.sourceCategory);
  const text = `${title} ${description}`;

  const content = contentTypeOf(title, description);
  let field = "other";
  let confidence = "low";
  let fieldSource = "rule";
  let reason = "未命中方向规则";

  const sourceMatch = sourceField(source, sourceCategory, title);
  if (sourceMatch) {
    field = sourceMatch.field;
    confidence = "high";
    fieldSource = "source";
    reason = sourceMatch.reason;
  } else if (category === "ctf") {
    field = "cyber";
    confidence = "high";
    fieldSource = "category";
    reason = "顶层类别 CTF";
  } else if (category === "mathmodel") {
    field = "math";
    confidence = "high";
    fieldSource = "category";
    reason = "顶层类别 数模";
  } else if (category === "hackathon") {
    if (/数据|分析|统计/i.test(title)) {
      field = "data";
      confidence = "medium";
      fieldSource = "category";
      reason = "顶层类别 黑客松 · 标题含数据关键词";
    } else {
      field = "software";
      confidence = "medium";
      fieldSource = "category";
      reason = "顶层类别 黑客松";
    }
  } else if (category === "datamodel") {
    if (/物联网|C语言|C\+\+|编程|程序设计|电子|机器人|无人|人工智能|AI|算法/i.test(title)) {
      for (const item of FIELD_RULES) {
        if (!item.include.test(title)) continue;
        if (item.exclude && item.exclude.test(title)) continue;
        field = item.field;
        confidence = "medium";
        fieldSource = "rule";
        reason = item.reason;
        break;
      }
    } else {
      field = "data";
      confidence = /数据挖掘|数据分析|数据科学|大数据|数据竞赛|数据挑战|数据统计|统计/i.test(title) ? "high" : "medium";
      fieldSource = "category";
      reason = "顶层类别 数据竞赛";
    }
  } else {
    for (const item of FIELD_OVERRIDES.concat(FIELD_RULES)) {
      if (!item.include.test(title)) continue;
      if (item.exclude && item.exclude.test(title)) continue;
      field = item.field;
      confidence = FIELD_OVERRIDES.includes(item) ? "high" : "medium";
      fieldSource = "rule";
      reason = item.reason;
      break;
    }
  }

  // The KPL / volunteer item is not a competition even if its title contains "总决赛".
  if (content.type !== "competition") {
    confidence = content.confidence === "high" ? "high" : confidence;
    if (content.type === "volunteer") {
      field = "sports";
      fieldSource = "rule";
      confidence = "high";
      reason = "志愿者/电竞赛事，非竞赛";
    }
  }

  return {
    field,
    field_confidence: confidence,
    field_source: fieldSource,
    field_reason: reason,
    content_type: content.type,
    content_confidence: content.confidence,
    content_source: content.type === "competition" ? "rule" : "rule",
    content_reason: content.reason,
  };
}

export function classifyEdition(row) {
  return classifyCompetition({
    title: row.title,
    description: row.description,
    category: row.category,
    source: row.source,
    source_category: row.source_category,
  });
}
