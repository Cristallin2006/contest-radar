import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyCompetition } from "../classify.js";

function field(title, category = "academic", extra = {}) {
  return classifyCompetition({ title, category, source: "test", ...extra });
}

test("tricky design/engineering/electronics titles are disambiguated", () => {
  assert.equal(field("中国大学生计算机设计大赛 2027").field, "software");
  assert.equal(field("第十五届全国大学生光电设计竞赛").field, "electronics");
  assert.equal(field("第十九届全国大学生结构设计竞赛").field, "engineering");
  assert.equal(field("全国大学生机械创新设计大赛 数字孪生设计挑战赛").field, "engineering");
  assert.equal(field("全国大学生广告艺术大赛 2027").field, "design");
  assert.equal(field("2026年第八届全国大学生工业设计大赛").field, "design");
});

test("business/electronics and data/sports traps are handled", () => {
  assert.equal(field("全国大学生电子商务“创新、创意及创业”挑战赛").field, "business");
  assert.equal(field("2026年GLOBAL ECHO AI大学生国际营销知识大赛").field, "business");
  assert.equal(field("开源数据马拉松", "hackathon").field, "data");
  assert.equal(field("2026第二届“冰雪杯”全国大学生外语写作大赛").field, "language");
  assert.equal(field("2026第八届全球校园人工智能算法精英大赛", "datamodel").field, "software");
});

test("source-native Saikr category wins over ambiguous title words", () => {
  assert.equal(field("2026年第八届大学生英语写作大赛", "academic", { source: "saikr", source_category: "english" }).field, "language");
  assert.equal(field("大学生人工智能应用挑战赛", "academic", { source: "saikr", source_category: "ai" }).field, "software");
  assert.equal(field("大学生艺术设计作品征集", "academic", { source: "saikr", source_category: "art_assessment" }).field, "design");
  assert.equal(field("C++ 编程巅峰赛", "academic", { source: "saikr", source_category: "big_data" }).field, "software");
  assert.equal(field("第三届“中西挑战杯”大学生数据分析大赛", "academic", { source: "saikr", source_category: "match" }).field, "data");
});

test("non-competition content is flagged", () => {
  const kpl = classifyCompetition({
    title: "【餐饮+证明】2026KPL年度总决赛暨十周年特别庆典志愿者招募",
    description: "志愿者招募",
    category: "academic",
    source: "jingsai",
  });
  assert.equal(kpl.content_type, "volunteer");
  assert.equal(kpl.field, "sports");
  const activity = classifyCompetition({
    title: "2026“温暖中国”公益短视频征集展播活动",
    category: "academic",
    source: "jingsai",
  });
  assert.equal(activity.content_type, "activity");
});

test("humanities/language edge cases", () => {
  assert.equal(field("2026年“GLOBAL ECHO”大学生法律知识大赛").field, "humanities");
  assert.equal(field("第二届“国研中西杯”大学生语文能力大赛").field, "language");
  assert.equal(field("“国文杯”全国高校文学知识竞答").field, "humanities");
});
