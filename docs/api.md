# 竞赛雷达公开 API v1

- Base URL：`https://contest.07212006.xyz/api/v1`
- 返回格式：`application/json; charset=utf-8`
- 公开接口只读，不需要登录。
- 公开数据只包含已发布、且 `content_type=competition` 的赛事。
- 时间默认按北京时间（Asia/Shanghai）展示。
- 数据可能不准确，使用前请阅读 [数据免责声明](disclaimer.md)。

## 1. 列表

```http
GET /api/v1/editions
```

查询参数：

| 参数 | 类型 | 说明 |
|---|---|---|
| `region` | `cn` / `intl` | 国内 / 国际 |
| `category` | `ctf` / `hackathon` / `datamodel` / `mathmodel` / `academic` / `other` | 类别 |
| `field` | `cyber` / `software` / `data` / `math` / `electronics` / `engineering` / `science` / `design` / `business` / `language` / `humanities` / `sports` / `other` | 方向，可逗号分隔多值 |
| `tech` | `1` | 只看技术向（cyber/software/data/math/electronics/engineering） |
| `direction` | 字符串 | 技能方向标签，如 `Web`、`Pwn` |
| `format` | 字符串 | 赛制标签，如 `AWD`、`Jeopardy` |
| `status` | `open` / `closing` / `upcoming` / `ongoing` / `closed` / `ended` / `unknown` / `cancelled` / `postponed` | 状态 |
| `q` | 字符串 | 搜索标题、系列、主办方 |
| `from` / `to` | `YYYY-MM-DD` | 日期范围 |
| `whitelist` | `1` | 只看白名单/高含金量 |
| `include_unknown` | `1` | 包含日期未知的赛事 |
| `all_dates` | `1` | 不限制默认时间窗口（默认约 90 天） |
| `sort` | 字符串 | 排序，如 `deadline`、`updated` |
| `page` | 整数 | 页码，默认 1 |
| `size` | 整数 | 每页数量，默认 20，最大 100 |

示例：

```bash
curl 'https://contest.07212006.xyz/api/v1/editions?region=cn&category=mathmodel&tech=1&all_dates=1&size=5'
```

响应：

```json
{
  "items": [
    {
      "id": 232,
      "title": "2026年第十二届数维杯全国大学生数学建模挑战赛（秋季赛）",
      "category": "mathmodel",
      "category_label": "数学建模",
      "field": "math",
      "field_label": "数学 / 建模",
      "content_type": "competition",
      "region": "cn",
      "region_label": "国内",
      "status": "ongoing",
      "status_label": "进行中",
      "next_deadline": "2026-11-24T10:00:00+08:00",
      "next_start": "2026-11-20T09:00:00+08:00",
      "stages": [],
      "tags": { "direction": ["数学建模"], "format": ["论文赛", "通讯赛"] }
    }
  ],
  "page": 1,
  "size": 5,
  "total": 1,
  "pages": 1,
  "stats": {
    "counts": { "total": 1, "ongoing": 1 },
    "categories": { "mathmodel": 1 },
    "regions": { "cn": 1 }
  }
}
```

分页时逐页请求，`pages` 为总页数。

## 2. 详情

```http
GET /api/v1/editions/:id
```

返回单个已发布竞赛，包含阶段、标签、来源、官网、核实时间等。已归档、非竞赛内容或未发布记录返回 404。

## 3. 分类字典

```http
GET /api/v1/taxonomy
```

返回：

- `categories`
- `fields`
- `content_types`
- `regions`
- `statuses`
- `stage_kinds`
- `modes`
- `signup_orgs`
- `signup_channels`

## 4. 统计

```http
GET /api/v1/stats
```

返回公开赛事的数量、状态、类别、地区分布。

## 5. 变更

```http
GET /api/v1/changes?since=2026-11-01&limit=50
```

返回最近公开变更。`since` 可选，`limit` 默认 50。

## 6. 健康检查

```http
GET /api/v1/health
```

返回：

```json
{
  "ok": true,
  "schema_version": 5,
  "editions": 230,
  "pending_ingest": 0,
  "last_refresh": "2026-11-23T11:18:00.228Z",
  "refreshing": false,
  "now": "2026-11-23T11:27:36.809Z"
}
```

`editions` 是公开可见数量，不包含归档、活动、志愿者等非公开内容。

## 7. 留言板

```http
GET /api/v1/comments
GET /api/v1/comments?edition_id=232
```

- 不带 `edition_id`：公开留言板。
- 带 `edition_id`：该赛事的评论（当前网页主要使用公开留言板）。
- 只返回 `status=visible` 的留言。
- 返回作者公开 GitHub 昵称/头像、正文和时间。

登录用户发言：

```http
POST /api/v1/comments
Content-Type: application/json

{"body":"留言内容", "edition_id": null}
```

- 需要 GitHub 登录 Cookie。
- 正文 1–1000 字。
- 每 10 分钟最多 3 条，每天最多 20 条。
- 管理员可以隐藏留言；隐藏后公开接口不再返回。

## 8. ICS

```text
GET /api/v1/ical/all.ics
GET /api/v1/ical/region/cn.ics
GET /api/v1/ical/region/intl.ics
GET /api/v1/ical/category/mathmodel.ics
```

- 阶段级 UID 稳定。
- 只有 `confirmed` 的截止时间才带精确 `VALARM`。
- 预计/待定日期不会生成精确提醒。
- 默认时区：Asia/Shanghai。

## 9. 缓存与 ETag

公开 JSON 默认 `cache-control: public, max-age=60`；分类字典为 1 小时；ICS 为 15 分钟。

支持 `If-None-Match`，可能返回 `304 Not Modified`。

## 10. 错误格式

```json
{ "code": "EDITION_NOT_FOUND", "message": "赛事不存在或未发布" }
```

常见状态码：

- `400` 参数错误
- `401` 需要登录（投稿等非公开写接口）
- `404` 资源不存在
- `405` 方法不允许
- `429` 频率限制

## 11. 使用限制

- 请勿高频轮询；优先使用 ETag 和 `cache-control`。
- 请勿把公开 API 当作官方报名数据源。
- 站点不保证接口永久兼容；变更会尽量记录在公开变更页。

## 12. 纠错

请通过项目仓库提交 Issue：

<https://github.com/Cristallin2006/contest-radar/issues>
