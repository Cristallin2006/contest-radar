# 搜索引擎收录与公网检索

- 日期：2026-11-24
- 目标：让搜索引擎能够抓取、理解并收录每个竞赛详情页

## 已完成

### 1. 服务端渲染详情页

```text
/competition/:id
```

每个详情页由服务端直接返回完整 HTML，包含：

- 独立 `<title>`
- `meta description`
- canonical
- Open Graph / Twitter Card
- 报名截止、比赛时间、主办方、阶段、方向、地区
- 相关赛事
- `Event` / `WebPage` JSON-LD
- `BreadcrumbList` JSON-LD
- 数据来源和免责声明

不再依赖 `/?open=ID` 查询参数作为唯一详情入口。

### 2. 内部链接

- 竞赛馆卡片链接到 `/competition/:id`
- 卡片列表增加「详情」链接
- 公开变更页链接到 `/competition/:id`
- 详情页链接回竞赛馆、同类赛事、文档和工信部相关说明

用户点击链接时，前端仍可拦截并打开弹窗；不执行 JS 的爬虫会得到完整 HTML。

### 3. sitemap

详情 URL 改为：

```text
https://contest.07212006.xyz/competition/19
```

不再使用：

```text
https://contest.07212006.xyz/?open=19
```

每个赛事带 `lastmod`。另外提供 `/sitemap-competitions.xml` 作为无缓存旧版本干扰的兼容入口，robots 同时声明两个 sitemap。

注意：Cloudflare/边缘缓存可能让旧的 sitemap 延迟最多约 1 小时；源站已经更新。

### 4. canonical

以下页面已设置 canonical：

- `/`
- `/hall`
- `/list`
- `/docs.html`
- `/miit`
- `/board`
- `/changes`
- `/competition/:id`

### 5. 结构化数据

- 详情页：`Event` 或 `WebPage`
- 面包屑：`BreadcrumbList`
- 日期、主办方、线上/线下模式、报名截止

不伪造评分、评论数量或不存在的信息。

## 待做

1. 分类落地页：
   - `/hall/ctf`
   - `/hall/hackathon`
   - `/hall/datamodel`
   - `/hall/mathmodel`
   - `/hall/academic`
2. 系列页：`/series/:id`
3. 提交 Search Console / Bing Webmaster / 百度搜索资源平台
4. 百度主动推送 / IndexNow
5. 外链和内容运营

## 注意

- 百度对纯 JS 渲染页面支持有限，服务端 HTML 很重要。
- 域名备案、服务器位置和访问速度会影响百度收录。
- 不要堆砌关键词、隐藏文字或购买链接。
