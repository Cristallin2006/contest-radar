# 赛线 OS · Arch Rice

模拟 Arch 电脑的竞赛 OS 静态 Demo。首屏为真实虚拟桌面，业务功能以独立应用窗口存在；不是三栏工作站。

## 运行

直接打开 `index.html`，或使用任意静态 HTTP 服务。

## 系统交互

- 默认只显示桌面，不自动打开赛事。
- 三个虚拟工作区分别保存窗口、位置与最小化状态。
- 窗口支持浮动拖拽、部分越界、八向缩放、边缘吸附、最大化、最小化与关闭；越界后保留标题区域用于拖回。
- 顶栏平铺按钮在浮动与自动平铺之间切换，使用 Anime.js 完成可中断的 FLIP 重排。
- 桌面、窗口和系统控件使用本地 Papirus 图标，不依赖运行时 CDN。
- 默认主题为 Wallhaven / Omarchy：三段分岛顶栏、雾玫瑰焦点边框、透明模糊窗口、紧凑 Linux 标题栏与本地 JetBrains Mono。赛事采用位置栏、目录侧栏与列表/表格切换；表格为默认视图，标题换行保留完整文字，其他应用共用原生分隔线和控件。
- 三套主题均使用 Software / Contestline 框线式 fastfetch，信息来自真实赛事与工作区状态，不包含虚构硬件数据。Afterglow 和 Atelier Sulphurpool 可从外观、Rofi 或终端 `theme <wallhaven|afterglow|atelier>` 切换；`theme omarchy` 是 Wallhaven 的别名。
- 三套主题共享分岛栏、透明窗口、紧凑标题栏、原生应用控件与框线 fastfetch；窗口和终端颜色仍由各自 token 决定。Wallhaven 应用表面已中性化，玫瑰色仅用于少量焦点，终端保持原有 Kitty 配色。
- Rofi 搜索应用、运行窗口、工作区命令和赛事。
- 「日程」合并时间线和月历：同一窗口切换「时间线 / 日历」，收藏筛选与 ICS 导出共用。桌面不再分别保留时间线和赛程两个图标。
- 留言板、推送、文档均为独立 OS 应用，可从 Rofi 或终端 `open <app>` 启动；终端 `man api|data|comments|ics` 直接打开对应文档。
- 终端与图形应用共享筛选、收藏、工作区与导出状态；启动显示 `fastfetch` 信息，支持历史、Tab 补全和 Linux 编辑快捷键。
- 通知中心显示真实的 3 天内节点，临近状态使用 `D-DAY / D-1 / D-3` 文本。
- 下一节点桌面组件可关闭、持久化，并能从 Rofi 恢复。
- 日程：`office-calendar`（Papirus）；`~/agenda`。

## 快捷键

- `Ctrl / Cmd + K`：Rofi
- `Ctrl / Cmd + \``：终端
- `Alt + 1 / 2 / 3`：虚拟工作区
- `Alt + Tab`：当前工作区窗口切换
- `/`：Rofi
- `Esc`：关闭浮层

## 桌面快捷方式

- 留言板：`internet-chat`（Papirus）
- 投稿：`internet-mail`（Papirus），打开 OS 内投稿窗口
- CyberChef：`applications-engineering`（Papirus），在新标签页打开自托管的 `/cyberchef/`，不进入主 bundle

## 壁纸

外观库包含 12 张本地壁纸。新增用户提供的 `Ethereal / 圣辉`、`Twilight / 城市暮色`，以及 Kali 2026 官方 `Glitch`、`Hack`、`Net` 三张壁纸。默认使用 Kali Net；可通过外观窗口或 `desktop <id>` 切换，新增 ID 为 `ethereal`、`twilight`、`kali-glitch`、`kali-hack`、`kali-net`。来源与许可证见 `THIRD_PARTY_NOTICES.md`。

## 在线人数

顶栏右侧有一个轻量的 `● N online` 模块。客户端每 30 秒向 `/api/v1/presence` 发送匿名心跳；服务端只保存 visitor 的 SHA-256 摘要，90 秒未见即过期。接口返回真实在线人数与 `display = online + 1`，界面显示后者。

## 投稿

桌面的「投稿」打开独立窗口，表单字段与生产 `/api/v1/submissions` 对齐。
GitHub 登录后可提交；页面会读取 `/api/v1/me` 和 `/api/v1/submissions/mine`。
登录回跳地址已允许 `/preview/arch-os/index.html`。

## 数据

`data.js` 是离线 fallback 快照。`/os/` 与生产同源部署时会从 `/api/v1/editions` 分页读取实时赛事，顶栏标记为 `LIVE`；接口失败时才保留 `SNAP` 快照。留言板继续调用 `/api/v1/me` 与 `/api/v1/comments`。

收藏、通知已读、壁纸、主题和推送偏好仅保存于 localStorage；启动完成状态仅保存于 sessionStorage。浏览器通知只在页面打开时有效，不包含 Service Worker 或服务端 Web Push；日历订阅使用生产 ICS 接口。

Papirus、Anime.js 与 Rofi 参考资源的来源和许可证见 `THIRD_PARTY_NOTICES.md`。
