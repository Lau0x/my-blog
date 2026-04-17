# my-blog

Nuxt 3 + Strapi 5 + PostgreSQL 前后端分离博客，Docker 编排，Nginx Proxy Manager 反代。

**开箱即用**：GHCR 自动发布多架构镜像（amd64 + arm64），clone 仓库 + 填 `.env` + `docker compose up -d` 即可部署，无需编译。

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

## 三套部署模式

| 模式 | Compose 命令 | 场景 |
|---|---|---|
| 生产（pull 镜像） | `docker compose up -d` | 服务器部署，最快 |
| 源码构建 | `docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build` | 改代码、fork 定制 |
| 本地开发 | `docker compose -f docker-compose.yml -f docker-compose.build.yml -f docker-compose.local.yml up -d --build` | 无 NPM 本地调试，暴露 3000/1337 |

---

## 快速部署（生产，5 分钟闭环）

### 0. 前置条件

- 服务器装好 Docker + Docker Compose
- Nginx Proxy Manager 已运行
- 域名 A 记录解析到服务器
- fork 本仓库到你的 GitHub（开启 GitHub Actions）

### 1. 触发 CI 构建镜像

push 任何 commit 到 `main` 分支，`.github/workflows/docker-publish.yml` 会自动构建 + 推送到 `ghcr.io/你的用户名/仓库名-nuxt` 和 `ghcr.io/你的用户名/仓库名-strapi`。

首次构建完成后，去 GitHub → Your profile → Packages，把两个包的可见性改为 **Public**（否则服务器 pull 需要登录 token）。

### 2. 服务器上克隆 + 配置

```bash
git clone https://github.com/YOUR_USER/my-blog.git
cd my-blog
cp .env.example .env
./scripts/gen-secrets.sh >> .env    # 追加密钥到文件末尾
vim .env
```

`.env` 关键字段：

```bash
DOMAIN=blog.yourdomain.com
IMAGE_REGISTRY=ghcr.io/your_user/my-blog   # 小写！
IMAGE_TAG=latest
NPM_NETWORK=<查 docker network ls | grep npm>
ADSENSE_CLIENT=ca-pub-xxx                  # 可留空
# 密钥字段由 gen-secrets.sh 生成
```

### 3. 一键启动

```bash
docker compose up -d
docker compose logs -f strapi
```

等到 Strapi 输出 `Welcome back!` 就是起来了。

### 4. 初始化内容

1. 打开 `https://yourdomain.com/admin` → 注册第一个管理员
2. **Content-Type Builder** → 建 **Article**：
   | 字段 | 类型 |
   |---|---|
   | title | Text (Short) |
   | slug | UID (关联 title) |
   | excerpt | Text (Long) |
   | content | Rich text (Markdown) |
   | cover | Media (Single) |
   | publishedDate | Date |
3. **Settings → Users & Permissions → Roles → Public** → 勾选 Article 的 `find` + `findOne`
4. **重要**：schema 改了后需要重新 push 镜像 → CI 构建 → 服务器 `docker compose pull && docker compose up -d`

### 5. NPM 反代（单域名 Custom Locations）

**Proxy Host 主条目**：
- Domain: `yourdomain.com`
- Forward to: `blog-nuxt:3000`
- 勾选 Block Common Exploits、Websockets Support

**Custom locations**：

| Location | Forward to |
|---|---|
| `/admin` | `blog-strapi:1337` |
| `/api` | `blog-strapi:1337` |
| `/uploads` | `blog-strapi:1337` |

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

## 本地开发

```bash
cp .env.example .env
./scripts/gen-secrets.sh >> .env
# .env 里 DOMAIN=localhost, NPM_NETWORK=placeholder 随便填

docker compose \
  -f docker-compose.yml \
  -f docker-compose.build.yml \
  -f docker-compose.local.yml \
  up -d --build

# 访问 http://localhost:3000 (前台) / http://localhost:1337/admin (后台)
```

---

## 日常维护

### 发布新版本
```bash
git add . && git commit -m "feat: 新增特性"
git push origin main
# CI 自动构建 + 推镜像（约 3-5 分钟）
# 然后服务器：
ssh server "cd /opt/my-blog && docker compose pull && docker compose up -d"
```

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
├── docker-compose.yml                     生产（pull 镜像）
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
│   ├── backup.sh
│   └── gen-secrets.sh
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
