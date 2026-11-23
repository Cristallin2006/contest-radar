# GitHub 登录与用户投稿

- 状态：**已部署并完成线上验证（schema v6）**
- 目标：让用户用 GitHub 登录后投稿未收录竞赛；管理员审核后进入草稿。
- 留言板：已实现 `/board`，阅读公开，发言需要 GitHub 登录，管理员可隐藏。

## 1. 产品边界

公开浏览仍然匿名，不要求登录。

登录只用于：

- 提交未收录竞赛
- 查看自己的投稿状态
- 未来的留言板发言（下一阶段）

不保存：

- GitHub 邮箱
- GitHub 仓库权限
- 其他第三方账号资料

保存的 GitHub 公开资料：

- `login`
- `display_name`
- `avatar_url`
- `profile_url`
- GitHub 数字 ID

## 2. OAuth 流程

```text
GET /auth/github
  -> github.com/login/oauth/authorize
  -> GET /auth/github/callback
  -> 换取 access_token
  -> GET api.github.com/user
  -> users / sessions 写入 SQLite
  -> HttpOnly session cookie
  -> 回到 /submit
```

- OAuth scope：`read:user`
- state：随机 nonce + 10 分钟过期 + HMAC 签名
- session：随机 32 字节 token，数据库只存 SHA-256
- Cookie：`HttpOnly`、`SameSite=Lax`、HTTPS 下 `Secure`、30 天
- 管理员仍使用独立的 `ADMIN_TOKEN`，不与用户账号混用

## 3. 数据库

新增：

```text
users
sessions
competition_submissions
```

投稿状态：

```text
pending -> accepted / rejected
```

采用后会创建一个 `publish_state=draft` 的赛事，管理员补充日期和阶段后再发布。

## 4. API

```text
GET  /api/v1/me
POST /api/v1/submissions
GET  /api/v1/submissions/mine

管理员审核接口仅内部使用，不公开接口细节。
```

`POST /api/v1/submissions` 要求登录，限制每用户每天 5 条。

## 5. 页面

- `/submit`：登录、投稿表单、我的投稿
- `/admin`：新增「用户投稿」标签，可采纳为草稿或拒绝
- 竞赛馆 / 卡片列表 / 线路图页脚增加「投稿」入口

## 6. 部署前需要配置

在 GitHub 创建 OAuth App：

1. 打开 <https://github.com/settings/applications/new>
2. Application name：`竞赛雷达`
3. Homepage URL：`https://contest.07212006.xyz`
4. Authorization callback URL：`https://contest.07212006.xyz/auth/github/callback`
5. 创建后生成 Client Secret

在服务器 `/opt/contest-radar/.env` 增加：

```env
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
SESSION_SECRET=...
```

`SESSION_SECRET` 可用：

```bash
openssl rand -hex 32
```

不要在聊天、仓库或截图中公开 Client Secret / SESSION_SECRET。

然后：

```bash
cd /opt/contest-radar
docker compose up -d --build
```

验证：

```bash
curl -sS https://contest.07212006.xyz/api/v1/me
```

应返回：

```json
{"auth_enabled":true,"authenticated":false,"user":null}
```

## 7. 本地验证

已使用假 OAuth 环境变量验证：

- `/api/v1/me` 返回 `auth_enabled=true`
- `/auth/github` 302 到 GitHub，并设置 state / return cookie
- 非法 state 回调会清 cookie 并回到 `/submit?auth=state`
- 手工插入 session 后可访问 `/api/v1/me`
- 登录用户可提交投稿
- 管理员可采纳为草稿赛事
- 未登录提交返回 401
- `/submit` 和 `/admin` 页面无 JS 错误

测试：

```text
npm test
29 tests passed
```

## 8. 安全与运营

- 公开 UGC 需要审核、频率限制、删除和举报机制。
- 当前投稿已有每用户每日 5 条限制。
- 建议上线后观察垃圾投稿，再考虑 Cloudflare Turnstile 或类似验证码。
- 留言板在实现前需要单独确定：
  - 是否只允许登录用户发言
  - 审核方式
  - 举报 / 删除 / 封禁流程
  - 隐私政策和数据保留期限
