# my-blog

Nuxt 3 + Strapi 5 + PostgreSQL 前后端分离博客，Docker 编排，Nginx Proxy Manager 反代。

**开箱即用**：GHCR 自动发布多架构镜像（amd64 + arm64），clone 仓库 + 填 `.env` + `docker compose up -d` 即可部署，无需编译。

## 📚 详细文档

本 README 是**总览索引**，具体部署/运维场景请查 [`docs/deployment/`](./docs/deployment/)：

- 🚀 [**5 分钟快速上手**](./docs/deployment/quick-start.md) — 跨机 NPM 部署（主流场景）
- 👋 [**新手上手手册**](./docs/newbie-guide.md) — 给非程序员朋友的 admin 发文/建页/改站点名零前置手册
- 🛠️ [**本地开发 → 生产发布工作流**](./docs/deployment/development-workflow.md) — 迭代博客的标准 SOP
- 🔄 [日常升级 / 回滚](./docs/deployment/upgrade.md) — `./scripts/upgrade.sh` 一条命令
- 🌐 [跨机部署指南](./docs/deployment/cross-host.md) — NPM 和博客在不同服务器（含防火墙配置）
- 🏠 [同机部署指南](./docs/deployment/same-host.md) — NPM 和博客在同一台
- 🔧 [NPM 反代完整配置](./docs/deployment/npm-setup.md) — 8 条 Custom Location + SSL 签发
- 🖼️ [图片策略](./docs/deployment/image-migration.md) — 外链（默认 · 零配置）vs 本地化（`migrate-images.mjs` 一键转 `/uploads`）
- 🔥 [故障排查手册](./docs/deployment/troubleshooting.md) — 常见坑大全（widget 404 / SSL / Tailscale 等）

## 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 前端 | Nuxt 3 (SSR) | 展示、广告位、SEO |
| 后端 | Strapi 5 | Headless CMS，Markdown 编辑器 + 可视化后台 |
| 数据库 | PostgreSQL 16 | 文章数据 |
| 反代 | Nginx Proxy Manager | HTTPS + 路径路由 |
| 镜像仓库 | GitHub Container Registry | 自动构建 + 多架构 |

## 单域名路由

- `https://yourdomain.com/` → Nuxt 前台
- `https://yourdomain.com/admin` → Strapi 管理后台
- `https://yourdomain.com/api/*` → Strapi REST API
- `https://yourdomain.com/uploads/*` → 媒体文件

## 部署模式

| 模式 | Compose 命令 | 场景 |
|---|---|---|
| **生产 / 跨机 NPM**（默认） | `docker compose up -d` | NPM 在独立服务器，博客这台只跑应用，端口 3000/1337 发布到公网（配合防火墙只放行 NPM IP） |
| 生产 / 同机 NPM | `docker compose -f docker-compose.yml -f docker-compose.same-host.yml up -d` | NPM 和博客跑在同一台，走 docker 内网直连，不发布端口 |
| 源码构建 | `docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build` | 改代码、fork 定制 |
| 本地开发 | `./scripts/dev.sh up -d --build` | 无 NPM 本地调试，暴露 3000/1337 · `dev.sh` 是三合一封装 |

---

## 快速部署（生产，5 分钟闭环）

### 0. 前置条件

- 服务器装好 Docker + Docker Compose
- Nginx Proxy Manager 已运行
- 域名 A 记录解析到服务器

### 1. 服务器克隆 + 一键初始化（路径 A · 零构建）

```bash
git clone https://github.com/Lau0x/my-blog.git
cd my-blog
./scripts/init.sh             # 自动生成 .env + 7 个密钥 + chmod 600
vim .env                      # 只需改 1 个字段
```

`.env` 里**必填**：

```bash
DOMAIN=blog.yourdomain.com    # 你的域名
```

`IMAGE_REGISTRY` 默认是 `ghcr.io/lau0x/my-blog`（上游公开镜像），**零改代码的用户不用改**。

想改代码/定制化？见下方的 **路径 B · 自构建镜像** 章节，或 [docs/deployment/quick-start.md](./docs/deployment/quick-start.md#路径-b定制化部署fork--自构建)。

> 💡 **同机 NPM 部署**（NPM 和博客在同一台）还需要改一个字段：把 `NPM_NETWORK` 填成 `docker network ls | grep npm` 输出的值。

### 2. 启动

```bash
# 默认：跨机 NPM 部署
docker compose up -d
docker compose logs -f strapi

# 或：同机 NPM 部署
docker compose -f docker-compose.yml -f docker-compose.same-host.yml up -d
```

等到 Strapi 输出 `Strapi started successfully` 就是起来了。

> ⚠️ **跨机部署必须配防火墙**：3000/1337 端口已发布到 0.0.0.0，如果不限制，Strapi admin 会暴露在公网。用云厂商 firewall 或 ufw 只放行 NPM 服务器 IP。

### 3. 注册 admin + 录内容

1. 打开 `https://yourdomain.com/admin` → **立即**注册第一个管理员（首次启动会暴露公开注册表单）
2. 左栏 **Content Manager → Article** → **Create new entry** → 写第一篇 → **Publish**
3. **Settings → Users & Permissions → Roles → Public** → 勾选 Article 的 `find` + `findOne`（让前台能读取）
4. 刷新前台 `https://yourdomain.com` 看到文章 = 全链路闭环

> 💡 Content-Type 结构已经在镜像里烘焙好（Article、User、广告配置 三个 schema），不用手动建。如需新增字段，见下方 **路径 B** 章节。

### 4. NPM 反代（单域名 Custom Locations）

**Proxy Host 主条目**：
- Domain: `yourdomain.com`
- Forward to: `blog-nuxt:3000`
- 勾选 Block Common Exploits、Websockets Support

**Custom locations**（Strapi 5 admin UI 会从多个前缀调后端，少一个都会报 widget 404）：

| Location | Forward to |
|---|---|
| `/admin` | `blog-strapi:1337`（同机）/ `<blog服务器IP>:1337`（跨机） |
| `/api` | 同上 |
| `/uploads` | 同上 |
| `/content-manager` | 同上 |
| `/content-type-builder` | 同上 |
| `/upload` | 同上（注意不是 `/uploads`——这是上传 API，单数）|
| `/i18n` | 同上 |
| `/users-permissions` | 同上 |

每条 Advanced 加：
```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
client_max_body_size 50M;
```

**SSL**：Let's Encrypt → Force SSL + HTTP/2。

---

## 路径 B · 自构建镜像（可选，给定制化用户）

路径 A 默认使用上游作者 `@Lau0x` 维护的公开镜像 `ghcr.io/lau0x/my-blog`，90% 用户不需要改代码，**零构建直接跑**。

以下场景需要切到路径 B：

- 要改前端 UI、样式、组件
- 要改后端 Strapi 业务逻辑
- 要加/改 Strapi Content-Type（schema 改动必须走这条路径）
- 长期严肃生产，不想被上游镜像变动影响

### 切换到路径 B

1. **fork** 本仓库 `Lau0x/my-blog` 到自己 GitHub 账号下
2. 改代码 → `git commit` → `git push origin main`
3. GitHub Actions 自动构建，约 3-5 分钟后 GHCR 出现：
   ```
   ghcr.io/<你的用户名>/my-blog-strapi:latest
   ghcr.io/<你的用户名>/my-blog-nuxt:latest
   ```
4. 首次构建后，去 **GitHub → Your profile → Packages** 把两个包可见性改为 **Public**（否则服务器 pull 要 docker login）
5. 服务器 `.env` 里把 `IMAGE_REGISTRY` 改成你自己的路径：
   ```bash
   IMAGE_REGISTRY=ghcr.io/<你的用户名>/my-blog
   ```
6. `./scripts/upgrade.sh` 同步到新镜像

> Schema 改动提醒：Strapi 5 production 模式下 Content-Type Builder 是禁用的。改 schema 必须在**本地 dev 模式**（`cd backend && npm run develop`）里改，commit 到仓库，触发 CI 构建新镜像，服务器拉新镜像生效。

---

## 本地开发

```bash
./scripts/init.sh
# .env 里 DOMAIN 随便填（localhost 也行），IMAGE_REGISTRY 填占位也行（本地不 pull）

./scripts/dev.sh up -d --build   # ⭐ 每次都这条，无脑加 --build
# 其他命令（down / logs / ps 等）直接敲 `./scripts/dev.sh` 看 cheatsheet

# 访问 http://localhost:3001 (前台) / http://localhost:1337/admin (后台)
```

---

## 日常维护

### 发布新版本
```bash
git add . && git commit -m "feat: 新增特性"
git push origin main
# CI 自动构建 + 推镜像（约 3-5 分钟）
# 然后服务器：
ssh server "cd /opt/my-blog && ./scripts/upgrade.sh"
```

> 💡 `upgrade.sh` 比手动 `pull && up -d` 多做了：.env 备份 / 数据备份 / git pull / 字段对齐检查 / BREAKING CHANGE 检测 / 回滚指引。详见 [docs/deployment/upgrade.md](./docs/deployment/upgrade.md)。

### 备份
```bash
./scripts/backup.sh              # 手动
crontab -e                       # 自动：
# 0 3 * * * cd /opt/my-blog && ./scripts/backup.sh >> /var/log/blog-backup.log 2>&1
```

### 查日志
```bash
docker compose logs -f nuxt
docker compose logs -f strapi
```

---

## 广告位使用

`frontend/components/AdSlot.vue` 三合一组件：

```vue
<!-- 1. Google AdSense 自动广告 -->
<AdSlot type="adsense" slot="你的广告位ID" />

<!-- 2. 固定图文位 -->
<AdSlot type="banner"
        image="/ads/vps-banner.jpg"
        link="https://aff.example.com/vps" />

<!-- 3. 联盟链接卡片 -->
<AdSlot type="affiliate"
        image="/ads/product.jpg"
        title="商品名"
        desc="简短卖点"
        cta="立即查看"
        link="https://aff.example.com/product" />
```

广告图片放在 `frontend/public/ads/` 下。

---

## 目录结构

```
my-blog/
├── .github/workflows/docker-publish.yml   自动构建 + 推 GHCR
├── docker-compose.yml                     生产·跨机 NPM（默认）
├── docker-compose.same-host.yml           同机 NPM override
├── docker-compose.build.yml               源码构建 override
├── docker-compose.local.yml               本地测试 override
├── .env.example
├── frontend/                              Nuxt 3 前端
│   ├── Dockerfile
│   ├── nuxt.config.ts
│   ├── app.vue
│   ├── pages/
│   └── components/AdSlot.vue
├── backend/                               Strapi 5 后端
│   ├── Dockerfile
│   ├── config/                            反代配置已改好
│   └── src/                               content-types 在这
├── data/                                  持久化（不入库）
├── scripts/
│   ├── init.sh                            ⭐ 一键初始化 .env + 密钥
│   ├── gen-secrets.sh                     单独生成密钥（向下兼容）
│   └── backup.sh
└── README.md
```

---

## 安全清单

- [x] `.env` 在 `.gitignore`，永不提交
- [x] `data/` 在 `.gitignore`，数据库和上传文件本地
- [x] `rel="sponsored"` 已内置到广告链接
- [ ] 管理员注册后立即在 Settings 关闭 public registration
- [ ] AdSense 上线前加 Cookie 同意弹窗（GDPR）
- [ ] GHCR 包改 Public（或服务器配 `docker login ghcr.io`）
- [ ] 可选：NPM 给 `/admin` 加 IP 白名单或 Basic Auth

## 许可证

MIT
