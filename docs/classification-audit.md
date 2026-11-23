# 竞赛方向分类与内容类型：实现与离线核实

- 日期：2026-11-23
- 状态：**已部署并完成线上验证（当前线上 schema v5）**
- 目标：把原来的 `academic` 大类拆成可精确过滤的方向，同时先排除志愿者、活动、课程等非竞赛内容。

## 1. 两层分类

### content_type

```text
competition  正式竞赛
volunteer    志愿者 / 招募
conference   论坛 / 会议
course       课程 / 培训 / 证书
activity     庆典 / 展播 / 活动
other        其他
```

公开列表只返回 `content_type = competition` 的记录。

### field

```text
cyber          网络安全 / CTF
software       计算机 / 软件 / AI
data           数据科学 / 统计
math           数学 / 建模
electronics    电子 / 电气 / 自动化 / 通信
engineering    机械 / 土木 / 结构 / 交通 / 能源
science        物理 / 化学 / 生物 / 医学 / 材料
design         设计 / 艺术 / 建筑 / 文创
business       商科 / 金融 / 管理 / 创业
language       外语 / 翻译 / 写作
humanities     文学 / 历史 / 法律 / 教育 / 社会
sports         体育 / 运动 / 电竞
other          公益 / 综合 / 待细分
```

## 2. 判定顺序

1. 管理员手动分类（`field_source=manual`）最高，采集器不能覆盖。
2. 来源原生分类，例如赛氪 `contest_class_second`。
3. 顶层类别强约束：
   - `ctf` → cyber
   - `mathmodel` → math
   - `hackathon` → software（标题含数据关键词时 → data）
   - `datamodel` → data（标题明确是物联网/C++/AI 算法时按标题修正）
4. 标题强规则，按优先级命中即停。
5. 未命中 → `other`，`field_confidence=low`，进入待细分。

**不使用描述做方向判断**。描述里经常出现“电子”“机械”“文化”等词，会把方向带偏；描述只用于识别志愿者招募等非竞赛内容。

## 3. 负规则与已知陷阱

| 标题 | 错误做法 | 当前结果 |
|---|---|---|
| 中国大学生计算机设计大赛 | 按“设计”归 design | software |
| 全国大学生光电设计竞赛 | 按“设计”归 design | electronics |
| 全国大学生结构设计竞赛 | 按“设计”归 design | engineering |
| 机械创新设计大赛 / 数字孪生 | 按“设计”归 design | engineering |
| 全国大学生电子商务竞赛 | 按“电子”归 electronics | business |
| AI 大学生国际营销知识大赛 | 按“AI”归 software | business |
| 开源数据马拉松 | 按“马拉松”归 sports | data |
| 全球校园人工智能算法大赛 | 按“全球”里的“球”归 sports | software |
| 冰雪杯外语写作大赛 | 按“冰雪”归 sports | language |
| KPL 年度总决赛志愿者招募 | 按“总决赛”归竞赛 | volunteer + sports，公开展示排除 |

## 4. 离线回填结果

在线上数据库快照的副本上执行迁移，未修改线上：

```text
总记录            231
公开竞赛          229
activity           1
volunteer          1（已归档的 KPL 志愿者招募）
field_confidence   high 84 / medium 147 / low 0
```

### 方向分布

| field | 数量 | 说明 |
|---|---:|---|
| cyber | 18 | CTF / 网安 |
| software | 53 | 计算机 / 软件 / AI |
| data | 8 | 数据 / 统计 |
| math | 12 | 数学 / 数模 |
| electronics | 9 | 电子 / 自动化 / 通信 |
| engineering | 4 | 机械 / 结构 / 船舶 / 土木 |
| science | 10 | 物理 / 医学 / 生命 / 地理 |
| design | 33 | 设计 / 艺术 / 文创（公开 32，另 1 条活动隐藏） |
| business | 25 | 商科 / 金融 / 管理 / 创业 |
| language | 44 | 英语 / 翻译 / 写作 / 语言文字 |
| humanities | 8 | 文学 / 法律 / 教育 / 文化 |
| sports | 1 | KPL 志愿者，非公开 |
| other | 6 | 综合/交叉或明确无法细分 |

### 正确性检查

- 3 条原本误放在 `datamodel` 的赛事已改为 `academic`：
  - 物联网技术素养
  - C++ 编程
  - 全球校园人工智能算法
- KPL 志愿者招募被标记为 `volunteer`，不会进入公开列表。
- “温暖中国”公益短视频征集展播被标记为 `activity`，不会进入公开列表。
- 2 条“医学创新大赛”归入 science；船舶能源归入 engineering。
- 跨境电商/市场营销/金融科技归入 business。
- 设计类专项（华灿奖、AIGC、AI 生成图像/视频）归入 design。

### 仍保留在 `other` 的 6 条

这些不是误判，而是确实属于综合/交叉赛事，暂不强行塞进单一方向：

- “挑战杯”全国大学生课外学术科技作品竞赛
- 全国大学生标准化奥林匹克竞赛
- 第六届全国大学生乡村振兴大赛主体赛
- 乡村振兴大赛茶文创设计专项
- 兰亭森呼吸杯乡村振兴专项
- 一带一路暨金砖国家技能发展与技术创新大赛

## 5. 数据字段

新增：

```text
field
field_confidence
field_source
field_reason
content_type
content_confidence
content_source
content_reason
source_category
```

- `source_category` 保存来源原始分类，例如赛氪的 `english`、`big_data`。
- 采集器写入 `source_category`，分类器优先使用来源分类。
- 管理员修改方向时写入 `field_source=manual`，回填不会覆盖。

## 6. API 与 UI

API：

```text
GET /api/v1/editions?field=software
GET /api/v1/editions?field=software,electronics
GET /api/v1/editions?tech=1
GET /api/v1/editions?content_type=competition
```

公开接口强制只返回 `competition`；`content_type=activity` 等不会暴露。

竞赛馆：

- 方向筛选
- “只看技术向”开关
- 卡片方向徽章
- 技术向 = cyber/software/data/math/electronics/engineering

后续可给卡片列表和线路图加同样的方向筛选。

## 7. 测试

```text
npm test
28 tests passed
```

包括：

- 设计/电子/工程/商科误判用例
- 数据马拉松、全球、冰雪杯负规则
- 赛氪来源分类优先
- KPL 志愿者 / 公益短视频内容类型
- 公开接口隐藏非竞赛内容
- 迁移回填幂等（第二次 classified=0）

## 8. 部署验证

已于 2026-11-23 部署：

1. 备份线上数据库：`data/backups/pre-classification-20261123-190559.db`
2. 部署 schema v3 / classifier / UI
3. 启动时自动回填 231 条
4. 公开 API：`229` 条，`KPL` / 公益短视频均为 0
5. 方向分布：software 53、language 44、design 32、business 25、cyber 18、math 12、science 10、electronics 9、humanities 8、data 8、other 6、engineering 4
6. 技术向：104 条
7. 待审核：0
8. 测试：28 passed

部署后修正了赛氪 `big_data` / `match` / `computer` / `ai` 来源分类过宽的问题，避免 C++/物联网被归到数据、数据分析被归到其他、CRH 数据赛道被归到软件。修正后回填 5 条，第二次回填为 0。
