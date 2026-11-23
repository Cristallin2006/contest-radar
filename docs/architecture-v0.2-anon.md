# 竞赛情报与公共赛历系统（匿名版）架构设计

- 版本：v0.2-anon
- 日期：2026-11-23
- 关系：基于 v0.1《竞赛情报与个人赛程系统架构设计》做匿名化删减；v0.1 原文保留，作为未来恢复账号/队伍/履历功能时的参考。
- 配套需求：同目录《竞赛赛程系统-匿名版-需求文档.md》。

---

## 1. 设计原则

1. **公开读、单管理员写**：没有账号体系，只有访客和一个管理员令牌。
2. **一个人能维护**：不引入 Postgres、Redis、消息队列、独立 worker；一个 Node 进程 + SQLite 足够。
3. **复用已有原型**：在现有竞赛雷达（Node 24 + `node:sqlite` + 静态前端）上扩展，不重写。
4. **数据可信**：系列/届次/阶段、来源、最后核实时间、修改历史、待审核区。
5. **本地优先的个人化**：收藏、画像、匹配、导出都在浏览器；服务端不存个人信息。
6. **以后能加账号**：数据模型和 API 预留扩展位，但 v0.2 不实现用户/队伍/履历。

---

## 2. 关键决策：为什么不用 v0.1 的 FastAPI + PostgreSQL

v0.1 的技术选型适合“有账号、有队伍、有履历附件、有邮件提醒”的产品。匿名版把这些都删掉后，继续用 FastAPI + Postgres + worker + Caddy 会变成过度设计：

| 组件 | v0.1 用途 | 匿名版是否需要 |
|---|---|---|
| FastAPI | 账号/权限/多模块 API | 不需要；现有 Node API 足够 |
| PostgreSQL | 用户数据、范围类型、并发写 | 不需要；SQLite WAL 足够公开读 + 低频管理写 |
| 独立 worker | 邮件提醒、重试、任务表 | 不需要；采集调度放进程内即可 |
| Redis | 队列/缓存 | 不需要 |
| Caddy | 自动 HTTPS/反代 | 不需要；现有 Nginx 已有 80/443 和证书 |
| 文件存储/附件 | 证书/履历附件 | 不需要；不存附件 |
| 邮件 | 截止提醒 | v1 不需要；用 ICS VALARM |

**结论**：匿名版继续用当前 Node + SQLite 原型，改造成本最低，资源占用最小，符合“一个人维护”。

> 如果团队更愿意用 FastAPI/Postgres，也可以实现同一套需求；但那是新写一套，不会比在现有原型上扩展更快。
>
> 如果还没有开始编码、又想要现成的编辑后台，**Django + 模板页 + Django Admin + SQLite/Postgres** 也是一个很省工的替代；但当前已有 Node 原型，优先复用。

---

## 3. 总体架构

```text
                    Internet
                       │ 443 (HTTPS)
                ┌──────▼──────┐
                │   Nginx     │  TLS、静态文件、限流、安全头、管理入口白名单
                └──┬───────┬──┘
        /          │       │ /api/*  /ical/*
   ┌───────────────▼┐   ┌──▼─────────────────────┐
   │ 前端静态文件    │   │ Node 应用               │
   │ 公开页 / 管理页 │   │ 公开 API + 管理 API     │
   └────────────────┘   │ 采集调度（进程内）       │
                        │ ICS 生成                 │
                        └──┬───────────────┬──────┘
                           │               │
                    ┌──────▼──────┐   ┌────▼─────────┐
                    │ SQLite WAL  │   │ 出站采集      │
                    │ /data/*.db  │   │ CTFtime/官网  │
                    └──────┬──────┘   └──────────────┘
                           │
                    ┌──────▼──────┐
                    │ 备份任务     │──> 异地对象存储/另一台机器
                    └─────────────┘
```

- 只有 Nginx 暴露 80/443；Node 只监听 `127.0.0.1:8789`。
- 没有独立 worker：采集、备份触发、健康检查都在 Node 进程内；用 `setInterval`/启动时执行。
- 没有用户数据，SQLite 单文件；备份就是数据库文件 + 配置。
- 管理入口 `/admin` 可加 Nginx IP 白名单/VPN；管理 API 仍校验 `ADMIN_TOKEN`。

---

## 4. 模块划分

```text
src/
├── server/
│   ├── index.ts / server.js     # HTTP 入口
│   ├── db/                      # SQLite schema、迁移、查询
│   ├── events/                  # 系列/届次/阶段/标签/变更
│   ├── ingest/                  # 采集器、去重、待审核
│   ├── public/                  # 公开列表/详情/搜索/统计
│   ├── calendar/                # ICS 生成
│   ├── admin/                   # 管理 API、审核、审计
│   └── core/                    # 配置、日志、安全、备份
├── web/
│   ├── public/                  # 列表/详情/日历/我的赛程/匹配
│   └── admin/                   # 管理页（令牌登录）
└── deploy/
    ├── Dockerfile
    ├── docker-compose.yml
    └── nginx.conf
```

模块依赖：

- `core` 不依赖业务模块。
- `events` 只依赖 `core` + `db`。
- `ingest` 写 `ingest_items`，不直接写已发布赛事；审核通过后由 `events` 落库。
- `public`/`calendar` 只读 `events`。
- `admin` 调用 `events`/`ingest`，写 `admin_audit`。

---

## 5. 数据模型

所有时间存 UTC ISO 字符串（`2026-12-27T09:00:00Z`），展示转 Asia/Shanghai。只有日期的阶段可用 `YYYY-MM-DD`，导出 ICS 时按全天事件处理。

### 5.1 表

**event_series**

| 字段 | 说明 |
|---|---|
| id | 主键 |
| name / short_name | 名称、简称 |
| organizer | 主办方 |
| category | ctf / hackathon / datamodel / mathmodel / academic / other |
| region | cn / intl |
| website | 官网 |
| is_whitelist | 是否白名单/高含金量 |
| description | 简介 |
| created_at / updated_at | |

**event_editions**

| 字段 | 说明 |
|---|---|
| id | 主键 |
| series_id | 可空，一次性比赛 |
| title | 如“2026 强网杯” |
| year | 年份/届数 |
| region | cn / intl |
| lifecycle | 正常 / 延期 / 取消 / 结束（生命周期，不等于时间推导状态） |
| status_override | 可空；管理员手动覆盖推导状态（如取消） |
| signup_org | 个人 / 队长 / 学校 / 未知 |
| signup_channel | 网站 / 邮箱 / 其他 / 未知 |
| internal_deadline_note | 学校/队内截止说明，可空 |
| signup_url / source_url | 报名、原文 |
| team_size_min / team_size_max | |
| eligibility | JSON/文本：学历、在校、地区等 |
| difficulty | 1–5 |
| fee / prizes | 文本 |
| source | ctftime / adworld / haobachang / ctfhub / devpost / drivendata / comap / jingsai / seed |
| source_rank | 来源可信度 |
| date_confidence | confirmed / estimated / unknown |
| verified_at | 最后核实时间 |
| publish_state | draft / pending / published / archived |
| external_ref | JSON，如 `{"ctftime_id":1234}`，用于同步去重 |
| created_at / updated_at | |

**event_stages**

| 字段 | 说明 |
|---|---|
| id | 主键 |
| edition_id | 外键 |
| kind | registration / qualification / online / offline / final / submission / other |
| name | 如“线上初赛” |
| starts_at / ends_at | UTC；活动区间；可空 |
| deadline_at | UTC；只有截止点的阶段用这个字段，不用 start=end |
| time_status | confirmed / tentative / unknown |
| is_all_day | 全天标记 |
| is_online | online / offline / hybrid / unknown |
| location | 地点 |
| note | 备注 |

**tags / edition_tags**

- `tags(id, kind: direction|format, name, sort_order)`
- `edition_tags(edition_id, tag_id)` 多对多。

**edition_changes**

| 字段 | 说明 |
|---|---|
| id | 主键 |
| edition_id | |
| changed_at | |
| actor_label | 管理员令牌标签/名称 |
| ip | 可选 |
| diff | JSON：字段级旧值/新值 |
| is_key_change | 是否时间/地点/状态等关键变化 |

**ingest_items**

| 字段 | 说明 |
|---|---|
| id | 主键 |
| source | 采集器 ID |
| external_id | 源内 ID |
| raw | 原始 JSON |
| parsed | 解析后的候选字段 |
| state | pending / accepted / rejected / merged |
| submitted_at / reviewed_at | |
| reviewed_by | 管理员令牌标签 |

**sources**

| 字段 | 说明 |
|---|---|
| id / name | |
| last_run / last_status / last_error | |
| count | 最近一次条数 |
| enabled | |

**admin_audit**

| 字段 | 说明 |
|---|---|
| id | |
| actor_label | |
| action | create/update/delete/accept/reject/refresh |
| target | 表 + ID |
| ip | |
| detail | JSON |
| created_at | |

**settings**（可选）

- 站点标题、免责声明、默认地区、采集周期、ICS 缓存时间等。

### 5.2 索引

- `event_editions(region, publish_state, year)`
- `event_editions(series_id)`
- `event_stages(edition_id)`
- `event_stages(starts_at)`
- `event_stages(deadline_at)`
- `ingest_items(state)`
- `edition_changes(edition_id, changed_at)`

### 5.3 状态计算

届次保存**生命周期**（正常/延期/取消/结束）和可选的 `status_override`；展示状态按阶段推导，允许多个阶段状态并存：

```text
if lifecycle=cancelled -> 已取消
else if 任一阶段进行中 -> 进行中
else if 报名截止点未到 -> 报名中 / 即将截止（<=7 天）
else if 下一阶段未开始 -> 预告
else if 所有阶段结束 -> 已结束
else -> 报名截止 / 待定
```

- `time_status=unknown/tentative` 的阶段不生成精确提醒，只显示“待定/暂定”；
- 只有 `deadline_at` 的阶段不参与“占时冲突”，只参与截止提醒；
- 延期保留阶段 ID 和修改历史，不删除重建。

---

## 6. 接口设计

前缀 `/api/v1`，JSON；公开接口不加认证；管理接口加 `X-Admin-Token`。

### 6.1 公开 API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/editions` | 列表：`region`、`category`、`direction`、`format`、`status`、`q`、`from`、`to`、`whitelist`、`sort`、`page`、`size` |
| GET | `/editions/{id}` | 详情：系列、阶段、标签、来源、核实时间 |
| GET | `/taxonomy` | 类别/方向/赛制/地区枚举 |
| GET | `/stats` | 总数、报名中、7 天内、类别分布 |
| GET | `/changes?since=` | 公开变更记录 |
| GET | `/health` | 健康检查 |
| GET | `/ical/all.ics` | 全部赛事 |
| GET | `/ical/region/{cn|intl}.ics` | 按地区 |
| GET | `/ical/category/{category}.ics` | 按类别（可选） |

- 分页 `page`/`size`，`size` 最大 100。
- 列表默认 `from=now`、`to=now+90d`、`publish_state=published`。
- 响应带 ETag；公开列表可 `Cache-Control: public, max-age=60`。
- 错误格式：`{"code":"EDITION_NOT_FOUND","message":"..."}`。

### 6.2 管理 API

| 方法 | 路径 | 说明 |
|---|---|---|
| POST/PATCH/DELETE | `/admin/editions[/{id}]` | 届次 CRUD、发布/归档 |
| POST/PATCH/DELETE | `/admin/editions/{id}/stages[/{stageId}]` | 阶段 |
| POST/PATCH/DELETE | `/admin/series[/{id}]` | 系列 |
| GET/POST/PATCH | `/admin/tags` | 标签 |
| GET | `/admin/ingest` | 待审核列表 |
| POST | `/admin/ingest/{id}/accept` | 采纳（可合并到已有届次） |
| POST | `/admin/ingest/{id}/reject` | 忽略 |
| GET | `/admin/sources` | 数据源状态 |
| POST | `/admin/refresh` | 手动采集 |
| GET | `/admin/changes` | 修改历史 |
| GET | `/admin/audit` | 审计日志 |
| POST | `/admin/backup` | 手动备份 |
| GET | `/admin/health` | 数据库/磁盘/任务状态 |

- 认证：`X-Admin-Token: <ADMIN_TOKEN>`；失败 401，不区分“令牌错误/缺失”。
- 写操作校验 `Origin` 与 `Content-Type`；管理页可选 Nginx Basic Auth/IP 白名单。
- 不做登录、Cookie、CSRF Token。

---

## 7. 关键流程

### 7.1 采集与审核

1. 进程启动/每 6 小时运行采集器：CTFtime、攻防世界、好靶场、CTFHub、Devpost、DrivenData、COMAP、我爱竞赛网。
2. 解析为候选届次/阶段；按 `source + external_id`、`alias + year` 去重。
3. 写入 `ingest_items(state=pending)`；可信源可配置 `auto_publish`（默认关闭）。
4. 管理员在 `/admin` 查看待审核：
   - 采纳：新建 series/edition/stage 或合并到已有届次；
   - 忽略：记录原因；
   - 合并：补充阶段/标签，保留高可信来源。
5. 每次采纳/修改写 `edition_changes` + `admin_audit`。

### 7.2 公开查询

1. 前端请求 `/api/v1/editions`，参数写入 URL。
2. 服务端只查 `publish_state=published`，按阶段计算状态。
3. 返回列表所需的轻量字段；详情再取 stages/tags/来源。
4. Nginx 缓存 + ETag；公开读限流。

### 7.3 公共 ICS

- 每个 `event_stage` 生成一个 `VEVENT`；`UID=stage-<id>@<host>`，改期保留 UID。
- 输出 `DTSTAMP`、`LAST-MODIFIED`、`SEQUENCE`；仅在时间/状态变化时递增 SEQUENCE，避免每次请求都像新事件。
- 只有截止点的阶段只用 `DTSTART`，不要输出相同的 DTSTART/DTEND；全天用 `VALUE=DATE`。
- 报名截止阶段加 `VALARM`（提前 1/3/7 天，取最早可配）；`time_status=unknown/tentative` 不加精确 VALARM。
- 取消/延期保留 UID 并标记 `STATUS:CANCELLED` 一段时间；从 feed 消失不保证手机立即删除。
- `X-WR-CALNAME` 区分全部/国内/国外。
- `Cache-Control: public, max-age=900`；ETag 基于数据版本。
- 说明：不同手机/云日历对 VALARM、刷新、取消的处理不一致；验收分别测服务端内容和指定客户端，不承诺所有客户端即时响铃。
- 收藏赛事的 ICS 由前端生成静态文件，不上传收藏列表。

### 7.4 本地收藏/画像/匹配

- `localStorage` 键：
  - `cr.favorites`：届次 ID 数组
  - `cr.hidden`：隐藏 ID
  - `cr.profile`：画像 JSON
  - `cr.filters`：上次筛选
  - `cr.view`：列表/日历
- “我的赛程”：前端用收藏 ID 请求详情或从已加载数据过滤；展示阶段。
- 匹配：纯前端函数 `score(profile, edition, tags, stages)`：
  - 硬条件：资格、线上/线下、不可用时间段冲突 → 标灰/理由；
  - 方向 40%、难度 30%、目标 30%；
  - 结果只显示，不写服务端。
- 导出/导入 JSON：`{version, favorites, hidden, profile}`。
- 清除本地数据：一键 `localStorage.removeItem`。

### 7.5 备份

- 每日 03:00：
  1. `PRAGMA wal_checkpoint(TRUNCATE)`；
  2. `VACUUM INTO '/backup/contest-YYYY-MM-DD.db'`；
  3. 压缩、加密，保留 14 天；
  4. `rclone`/`restic` 推送到异地对象存储。
- 每月本地恢复一次，校验表数量和最新赛事。
- 备份前记录当前 `schema_version`。

---

## 8. 前端

### 8.1 页面

- `/` 公开列表：地区切换（默认国内）、类别/方向/赛制/状态/时间筛选、搜索、列表/日历视图。
- `/editions/:id` 详情：系列/届次/阶段、报名截止、资格、奖项、官网、来源、核实时间、收藏、导出 ICS。
- `/my` 我的赛程：本地收藏、阶段时间线、导出选中 ICS、导入/导出 JSON、清除本地数据。
- `/match` 本地画像与匹配：问卷、评分、理由；不登录。
- `/changes` 公开变更（P1）。
- `/admin` 管理页：令牌输入（sessionStorage）、待审核、赛事 CRUD、阶段、标签、数据源、审计、备份。
- 免责声明/关于页。

### 8.2 技术

- 复用当前静态 HTML/CSS/JS；不引入 Vue/React 重写。
- 前端路由可用 hash 或简单 History API；管理页独立 bundle。
- ICS 导出用浏览器 Blob 生成；公共订阅用服务端 URL。
- 匹配算法单独 JS 模块，便于测试。

### 8.3 可用性

- 移动端响应式；列表/日历切换；中文；时间北京时间。
- 收藏/画像仅本浏览器；切换设备需导出/导入 JSON。
- 无登录；管理页令牌关闭标签页即失效。

---

## 9. 安全设计

### 9.1 认证与权限

- 没有用户账号；唯一管理凭证是 `ADMIN_TOKEN`（≥32 字节随机）。
- 管理 API 只认 `X-Admin-Token`，不认 Cookie；失败统一 401。
- 管理页把令牌存 `sessionStorage`，不写 localStorage；关闭标签页清除。
- 可选：Nginx 对 `/admin` 和 `/api/v1/admin/*` 做 IP 白名单/VPN/Basic Auth。
- 审计日志记录 `actor_label`（如 `admin-token`）和 IP，不记录令牌。

### 9.2 公开面

- 只读公开；写操作全部在 `/admin`。
- Nginx 限流：公开 API 每 IP 300 次/分钟；`/ical` 每 IP 60 次/分钟；管理 API 20 次/分钟。
- 公开列表/ICS 缓存；避免被爬时打满 SQLite。
- 安全头：HSTS、CSP、`X-Content-Type-Options`、`Referrer-Policy`、`frame-ancestors 'none'`。

### 9.3 输入/输出

- 所有 SQL 参数化；禁止拼接。
- 文本输出 HTML 转义；管理页富文本如需要，前端清洗。
- 管理写请求校验 `Origin`；JSON body 限制 1MB。
- 采集/线索 URL 走 `safeFetch`：
  - 只允许 http/https；
  - 解析 IP 拒绝私网/回环/链路本地/云元数据；连接必须使用已验证的 IP，保留 Host/TLS SNI，避免 DNS rebinding；
  - 覆盖 IPv6、映射地址、全部解析结果；
  - 重定向最多 3 次，每次重新检查；
  - 超时 10 秒，响应体 ≤2MB（解压后也限制）。
- 不存用户 PII；不存附件；没有上传接口。

### 9.4 备份与日志

- 备份加密、异地；恢复演练。
- 日志脱敏：不打印 `ADMIN_TOKEN`、完整管理请求头。
- Docker 日志限制大小。

### 9.5 来源合规

- CTFtime API 有用途限制，不假设可以做一个 CTFtime 克隆；只存必要字段并链接回原文，必要时联系对方确认。
- 聚合站/官网采集遵守 ToS/robots；控制频率；标注来源。
- 公开站可被爬取；不提供全量转载/镜像。

---

## 10. 部署与容量

### 10.1 运行形态

- 单容器 Node 应用 + 现有 Nginx；SQLite 卷；无 Postgres/Redis/Caddy/worker。
- `docker-compose.yml`：
  - app：`127.0.0.1:8789:8789`，内存限额 256MB；
  - 数据卷 `./data:/data`；
  - 环境变量 `ADMIN_TOKEN`、`TZ=Asia/Shanghai`、`BASE_URL`。
- Nginx vhost：`contest.example.com` → `127.0.0.1:8789`；静态/代理；管理入口可白名单。
- 采集调度在 Node 进程内；如采集阻塞，使用异步并发 + 超时，不引入 worker。

### 10.2 容量

- 10–100 用户公开读：1C1G/2C2G 足够；当前 4C4G 共享服务器余量充足。
- SQLite 数据量：赛事几千条 + 阶段/变更，通常 < 100MB；附件不存。
- 内存：Node + SQLite 约 50–150MB；Nginx 复用。
- 磁盘：镜像 + 数据库 + 备份，10GB 足够；当前 15GB 可用，建议清理旧镜像并异地备份。
- 不需要为匿名版单独买服务器；若以后加账号/队伍/履历，再按 v0.1 评估 Postgres/独立服务器。

### 10.3 监控

- `GET /api/v1/health`：数据库可读、schema 版本、最近采集时间。
- 管理页系统状态：DB 大小、磁盘、采集任务、最近备份。
- 外部 Uptime 监控首页/health；异常邮件/Telegram 给管理员（这是管理员通知，不是用户提醒）。
- 备份失败告警。

---

## 11. 测试策略

| 类型 | 内容 |
|---|---|
| 单元测试 | 状态计算、日期/时区、ICS 生成、别名/去重、匹配评分、CSV/JSON 导出 |
| 接口测试 | 公开列表/详情/筛选/分页；管理 CRUD/审核/令牌失败；SSRF 防护 |
| 数据测试 | 采集样本解析、重复合并、阶段时间合法性 |
| 前端 | 列表/详情/日历/本地收藏/导出 ICS/管理页；Playwright 关键路径 |
| 安全 | 管理接口无令牌 401、Origin 校验、限流、SQL 注入、XSS、SSRF |
| 备份 | 备份/恢复演练脚本 |

时间相关测试注入固定 `now`，避免随日期失败。

---

## 12. 从当前原型迁移

当前原型：Node + 扁平 `competitions` + 地区/类别 + 列表/日历/ICS + 采集器。

### 12.1 迁移步骤

1. **保留采集器**：CTFtime、攻防世界、好靶场、CTFHub、Devpost、DrivenData、COMAP、我爱竞赛网。
2. **建新表**：`event_series`、`event_editions`、`event_stages`、`tags`、`edition_tags`、`edition_changes`、`ingest_items`、`sources`、`admin_audit`。
3. **迁移现有 68 条**：
   - 每条 `competitions` → 一个 `event_edition` + 至少一个 `event_stage`；
   - 有 `series` 别名的合并（强网杯/拟态、CISCN/长城杯等）；
   - `registration_deadline` → 报名阶段 `deadline_at`；
   - `event_start/end` → 比赛阶段 `starts_at/ends_at`；
   - 无日期 seed → `time_status=unknown`、`published`，管理员补；
   - 现有“预计”日期 → `time_status=tentative`，不生成精确提醒。
4. **采集器改造**：输出候选 `parsed` 到 `ingest_items`，不再直接写 `competitions`；可信源可配置直发。
5. **公开 API**：`/api/v1/editions` 替代当前 `/api/data`；前端逐步切换。
6. **管理页**：令牌 + 待审核 + CRUD；当前 `/api/refresh` 保留为触发采集。
7. **本地功能**：收藏/画像/匹配/导出；不落库。
8. **切换**：新 schema 生效后，旧表保留只读一个版本，确认无回滚需求再删除。

### 12.2 迁移风险

- 当前数据中日期置信度/重复较多，迁移后需要管理员逐条核对；
- 采集器输出字段需要补齐阶段/标签；
- 旧 URL/分享链接需要 301 到新路径；
- 管理页上线前先做备份；
- 公网缓存/SEO 需要更新 sitemap。

---

## 13. 演进方向

| 触发条件 | 调整 |
|---|---|
| 需要账号/个人跨设备赛程 | 按 v0.1 加 `users`/`sessions`/`follows`；SQLite 可继续，或迁 Postgres；不要只加一个 `team_id` 列 |
| 需要队伍/组队/履历/附件 | 回到 v0.1 架构；加 teams/records/attachments/存储；Postgres 更合适 |
| 需要邮件提醒 | 加 `email_subscriptions` + token + 发送任务；明确 PII |
| 赛事量 > 1 万或写入并发高 | SQLite → Postgres；加只读副本/缓存 |
| 需要公开 API 给第三方 | 加 API key/限流/版本化；公开只读 |
| 需要多管理员 | 多个令牌标签或 Nginx Basic Auth；仍不做用户体系 |

---

## 14. 风险清单

1. **数据质量**：自动采集日期可能是“预计/待核对”；必须保留管理员审核和来源链接。
2. **来源稳定性/合规**：聚合站可能改版/反爬；采集失败不影响主站，需监控。
3. **公开爬取**：匿名公开会被爬；Nginx 限流 + 缓存，不暴露管理接口。
4. **管理员令牌泄露**：强随机 + IP 白名单 + 可轮换；审计日志。
5. **本地数据丢失**：localStorage 清空/换设备会丢；提供导出/导入。
6. **无邮件提醒**：用户必须依赖 ICS/手机日历；如果用户不接受，需重新评估 CAL-05。
7. **未来加账号的迁移成本**：v0.2 不建用户表，未来加账号仍需迁移；但比现在硬塞简单。

---

## 15. 一句话总结

**匿名版是“公开赛事库 + 公共 ICS + 浏览器本地个人化 + 单管理员审核”**。  
它放弃账号/队伍/服务端履历，换来极低的维护成本和服务器压力；用当前 Node + SQLite 原型继续演进即可，不需要 FastAPI/Postgres/Caddy/Redis。
