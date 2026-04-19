# 新手上手手册（给非程序员朋友看的）

> 如果你是第一次接触这个博客后台，这篇就够了。零前置知识，每步都讲清楚"点哪里、填什么、保存在哪"。

---

## 📍 几个关键概念（1 分钟看完）

- **前台** = 读者看到的博客，比如 `https://blog.yirenliu.com`
- **后台（admin）** = 你登录进去发内容的地方，比如 `https://blog.yirenliu.com/admin`
- **Content Manager（内容管理）** = 发文章、发说说、改站点配置全在这里
- **Collection Type**（多条，如"文章"）vs **Single Type**（一条，如"站点配置"）
- **字段** = 一篇文章/一条说说里的每个输入框（标题、正文、封面图 等）

**重要**：改完**一定要点右上角蓝色 `Save`（保存），再点绿色 `Publish`（发布）**——只保存不发布前台看不到。

---

## 🔑 第一次登录

1. 浏览器打开 `https://<你的博客域名>/admin`
2. 首次进入 → 注册管理员账号（邮箱 + 密码，自己记住）
3. 之后每次用这个邮箱 + 密码登录

> 🛡️ **安全提示**：注册完后去 **Settings → Users & Permissions → Advanced Settings**，关闭 "Enable sign-ups"，防止陌生人注册。

---

## 📰 发第一篇文章

1. 左侧边栏 → **Content Manager** → **Article**（文章）
2. 右上角 **Create new entry**（新建）
3. 填字段：
   - **title**（标题）：文章标题
   - **slug**（URL 段）：留空会自动从标题生成；也可以改成 `2026-new-year` 之类的英文
   - **excerpt**（摘要）：首页卡片会显示这段
   - **content**（正文）：支持 Markdown 语法（`**加粗**` / `- 列表` / `![图片](url)` 等）
   - **cover**（封面图）：点 `+` 上传一张图，首页卡片背景就是它
   - **publishedDate**（发布日期）：不填默认今天
   - **tags**（标签）：点 `+ Add an entry` 每条填一个 tag 名字
4. 右上角 **Save** → **Publish**
5. 打开前台 `https://<你的域名>/` → 应该能看到新文章

### 📸 正文里怎么插图片

两种办法：

- **🅰 直接粘贴外链**：写 `![描述](https://图床URL)`。零配置，但依赖外部图床。
- **🅱 上传到后台**：在 content 字段的编辑器工具条里点"插入图片"→ 从 Media Library 选或上传。最稳定，图存在自己服务器。

---

## 💬 发一条说说

说说适合"随手记一句"——比文章轻量，不用标题、不用封面、可以带图/视频。

1. 左侧 **Content Manager** → **说说**（Note）
2. **Create new entry**
3. 填：
   - **content**（正文）：支持 Markdown，可以直接写一段话、一个段落
   - **media**（图/视频）：拖图或视频进来，视频限制 800MB
   - **tags**（标签）：同文章
   - **publishedDate**：不填默认现在
4. **Save** → **Publish**
5. 打开前台 `https://<你的域名>/notes` → 时间线里能看到

---

## 🎨 改站点名 / Footer / 导航

所有站点级配置在 **Content Manager → 站点配置（Site-config）**。

### 改名

- **siteName**（站点名）：前台左上角"我的博客"的那几个字
- **tagline**（副标题，可选）
- **footerHTML**（页脚）：支持 HTML 和 `{{year}}` 模板（会自动变成当前年份）
- **authorName**（作者）/ **ogImage**（分享预览图）/ **themeColor**（主题色）

改完 **Save**，前台刷新立即生效。

### 改导航栏（header 上那排菜单）

找到 **navItems** 字段 → 点 `+ Add an entry` 加导航项：

| 字段 | 填什么 | 示例 |
|------|-------|------|
| label | 菜单上显示的文字 | `首页` / `说说` / `GitHub` |
| path | 点击跳转的地址 | `/` / `/notes` / `https://github.com/xxx` |
| order | 排序（数字小的在前） | `0`, `10`, `20` |

**规则**：
- path 以 `/` 开头 = 站内链接
- path 以 `https://` 开头 = 外链（会自动新窗口打开）
- navItems 一条都不填 = Header 显示默认的"首页 / 标签"

---

## 📄 建自定义页面（`/about` / `/vps` 这种独立页）

**Content Manager → 自定义页面（Custom-page）** → **Create new entry**

两种模式任选：

### 模式 A · 写 Markdown（推荐新手）

- **title**（标题）
- **slug**：决定 URL 是 `/<这里>`（如 `about`）
- **body**：写 Markdown 正文
- **htmlBody**：留空
- **showInNav**：勾上 = 自动进 Header 导航（前提是 navItems 没配）
- **Save** → **Publish**
- 访问 `https://<你的域名>/<slug>`

### 模式 B · 写纯 HTML（高级自由）

- 想做一个定制化的 landing 页（VPS 推荐、简历页等）？
- 把 **body** 留空，**htmlBody** 里贴完整 HTML（可以用 `<style>`、`<script>`、flex 布局）
- 页面不会自动加标题、不加 `.prose` 样式——完全你说了算

---

## 🏷️ Tag（标签）怎么管理

文章和说说里的 tags 都是**新建 entry 时填**——没有独立的"标签列表"页。填同样的名字会自动归为同一个 tag。

前台 `https://<你的域名>/tags` 会自动聚合所有 tag 及其下的文章。

---

## 🔍 搜索功能

前台 header 右上角 🔍 图标 → 进 `/search` 页 → 输入关键词 → 同时搜 **文章 + 说说**，300ms 自动联想。

---

## 🌐 后台界面中文化

登录后：
1. 右上角 → **头像 / Profile**
2. **Interface language** → 选 **Chinese (Simplified) 中文**
3. Save → 刷新

大部分界面会变中文。但字段名（如 `siteName`、`footerHTML`）是代码里定死的英文。如果想连字段名也变中文：

- 进 **Content Manager → 某个 Collection Type**（比如 Article）
- 右上角 **Configure the view**（齿轮图标）
- 每个字段可以改 **Label**（只改显示名，不改代码）
- 保存即生效

---

## 🚨 4 个常见坑

### 1. "我改了 Save 了前台还是老样子"

- 检查是不是只 **Save** 没 **Publish**——两个按钮都要按
- 浏览器可能有缓存，Mac 硬刷新：`Cmd + Shift + R`

### 2. "navItems 字段我看不到，说 No permissions"

后台刚加了新字段时 admin 权限要刷新一下：
- 退出登录（右上角头像 → Log out）
- 重新登录
- navItems 字段就出现了

### 3. "前台看不到我新建的东西（文章/说说/自定义页）"

- 确认已经 **Publish**（不是 Draft）
- 可能是新 content-type，Public API 权限没开——找博客管理员去后台开一下权限（Settings → Users & Permissions → Roles → Public → 勾上对应的 find / findOne）

### 4. "上传图片/视频报错"

- 视频最大 800MB（Strapi 限制，v1.3.0 起）
- 图片格式支持 JPG / PNG / WebP / GIF
- 如果走 Nginx Proxy Manager 反代，NPM 主表 Advanced 的 `client_max_body_size` 也要配成 `800m`（详见 [docs/deployment/npm-setup.md](./deployment/npm-setup.md#proxy-host-主表-advanced-⭐-推荐一处管全局)）
- 中途断开多半是 NPM `proxy_read_timeout` 默认 60s 太短——同一处改成 `600s`

---

## 💡 进阶技巧

- **Markdown 预览**：内容编辑器有 **Preview** 按钮，先看渲染效果再发
- **草稿**：右上角 **Save** 但不 **Publish**——只自己能看，读者看不到
- **批量删除**：Collection Type 列表页 → 勾选多条 → 批量操作
- **导出**：暂不支持 UI 导出，需要让博客管理员从后台数据库导

---

> 有任何"点不出来、找不到按钮"的情况，截图发给博客管理员，通常都是 1 分钟解决的问题。
