# 安全审查记录

- 日期：2026-11-23
- 范围：公开页面、GitHub 登录、用户投稿、留言板、公开 API、管理接口
- 结论：已完成一轮代码级检查与修复；没有发现真实密钥进入仓库或公开页面。

## 1. XSS

### 已处理

- 留言正文、投稿标题/简介、赛事名称/主办方/描述等所有用户可控文本均通过 HTML 转义后渲染。
- 留言板使用 `textContent` 等价的转义输出，不把用户内容当 HTML。
- 赛事链接统一经过协议白名单：
  - 只允许 `http:` / `https:`
  - 禁止 `javascript:` / `data:` 等危险协议
- 修复了旧卡片页中 URL 属性未再次转义的问题。
- 修复了管理后台中 URL 仅做 HTML 转义、未校验协议的问题。
- 管理后台的所有用户内容（投稿、留言、标题、简介）均转义。
- 已用 payload 验证：
  ```text
  <img src=x onerror=alert(1)>
  <script>alert(2)</script>
  ```
  在留言板中只显示为文本，不生成 `img` / `script` 节点。

### CSP

线上已启用：

```text
Content-Security-Policy:
  default-src 'self';
  base-uri 'self';
  object-src 'none';
  frame-ancestors 'none';
  form-action 'self';
  script-src 'self' https://static.cloudflareinsights.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https://avatars.githubusercontent.com;
  connect-src 'self' https://cloudflareinsights.com;
  font-src 'self';
  manifest-src 'self'
```

同时启用：

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`
- 生产 HTTPS 下启用 HSTS

`style-src` 允许内联样式，是因为页面布局使用内联 CSS 变量；脚本没有放开 `unsafe-inline`。

## 2. CSRF

- OAuth state：随机 nonce + 10 分钟过期 + HMAC 签名，回调校验 state。
- Session Cookie：`HttpOnly`、`SameSite=Lax`、HTTPS 下 `Secure`。
- 用户写接口只接受 `application/json`，跨站表单无法直接提交；服务端未开放用户写接口 CORS。
- 管理接口使用 `X-Admin-Token` 自定义头，并校验 Origin；不依赖用户 Cookie。

### 已知低风险

`GET /auth/logout` 可以被跨站触发退出登录，但不会泄露数据或执行写操作；这是低风险问题。若需要可改为 POST + CSRF token。

## 3. SQL 注入

- SQL 值均使用参数绑定。
- `field` 多值查询使用占位符，不拼接用户值。
- 排序字段在应用层白名单映射，不拼接 SQL。
- 管理接口 ID 统一 `Number()`。
- 公开分页参数已强制取整并限制 `size` 最大 100。

## 4. URL / 开放重定向 / SSRF

- OAuth `return_to` 只允许站内路径：
  - `/submit`
  - `/hall`
  - `/board`
  - `/`
  - `/list`
  - `/changes`
- 外部链接统一协议白名单，`javascript:` 不会成为可点击链接。
- 用户投稿的 URL 只接受 `http:` / `https:`。
- 服务端不会请求用户提交的 URL；采集器只请求代码中固定的公开数据源，当前没有用户可控 SSRF 入口。
- 生产环境设置了规范 `BASE_URL`，OAuth redirect 不再依赖可伪造的 Host 头。

## 5. 认证与权限

- GitHub OAuth scope 仅 `read:user`，不读取邮箱或仓库。
- 不保存 GitHub access token。
- 不保存密码。
- Session token 只保存 SHA-256 哈希；Cookie 中是随机 token。
- 管理员仍使用独立的 `ADMIN_TOKEN`，与用户账号分离。
- 管理员令牌只存在服务器 `.env` 和浏览器 `sessionStorage`，没有进入仓库或公开页面。

## 6. 频率与滥用

- 留言：每 10 分钟最多 3 条，每天最多 20 条。
- 投稿：每用户每天最多 5 条。
- 管理接口需要令牌。
- 公开 API 依赖 Cloudflare 和缓存；当前没有内置每个 IP 的令牌桶。

### 仍建议

- 观察垃圾留言后再评估验证码（Turnstile 等）。
- 为留言增加举报按钮和管理员批量处理。
- 对公开 API 增加边缘限流。

## 7. 依赖与数据

- 运行时无 npm 依赖，减少供应链面。
- SQLite 数据库不在仓库中。
- `.env`、数据库、备份文件不提交。
- 部署前备份位于服务器 `data/backups/`。

## 8. 仍需注意

- 留言和投稿是公开 UGC，需要持续人工审核。
- 本站不是官方报名平台；时间、地区等信息仍可能不准确。
- GitHub 账号本身的安全性由 GitHub 负责；本站不强制 MFA。
- 建议定期轮换 `ADMIN_TOKEN` 和 `SESSION_SECRET`，并检查 `/admin` 访问日志。
