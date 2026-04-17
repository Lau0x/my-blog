# 5 分钟快速上手（跨机 NPM）

最主流的部署路径：NPM 跑在 A 服务器，博客跑在 B 服务器。如果你的 NPM 和博客在同一台，请看 [same-host.md](./same-host.md)。

## 两条路径二选一

根据你要不要改代码，先选路径：

| 路径 | 适合谁 | 镜像来源 | 需要 fork | 需要 CI |
|------|-------|---------|----------|---------|
| **A · 零构建（默认推荐）** | 拿现成博客跑自己域名，不改代码 | 拉上游 `ghcr.io/lau0x/my-blog` 公开镜像 | ❌ | ❌ |
| **B · 定制化** | 要改代码、UI、schema 等 | 你 fork 仓库后自己的 GHCR 镜像 | ✅ | ✅ |

> ⚠️ 路径 A 长期依赖上游作者维护镜像——如果作者改名/删包/push 破坏性改动到 `:latest`，你会受影响。如果用于严肃生产，推荐切到路径 B 自主维护。

---

## 路径 A：零构建部署（4 步 · 推荐）

### 前置条件

- 两台服务器（A: NPM，B: 博客），都装好 Docker + Docker Compose v2.x
- 域名 A 记录已解析到 **NPM 服务器**（不是博客服务器）
- NPM 已运行，81 管理面板可访问

### Step 1. 博客服务器配防火墙

跨机模式下，3000/1337 端口会发布到 0.0.0.0——**必须限制只允许 NPM 服务器 IP 访问**，否则 Strapi admin 暴露在公网。

Hetzner Cloud Firewall 示例：

| 方向 | 协议 | 端口 | 源 |
|------|------|------|-----|
| Inbound | TCP | 22 | Any |
| Inbound | ICMP | — | Any |
| Inbound | TCP | 3000 | `<NPM服务器IP>/32` |
| Inbound | TCP | 1337 | `<NPM服务器IP>/32` |

配完**用外部扫描器验证**：`https://www.yougetsignal.com/tools/open-ports/` 输入博客 IP，确认 3000/1337 对外 closed、22 open。

> ⚠️ 如果博客服务器接了 Tailscale / WireGuard 等 overlay VPN，不要从同 tailnet 的机器测公网 IP 端口——会走 overlay 绕开防火墙导致假阳性。详见 [troubleshooting.md](./troubleshooting.md#tailscale-遮蔽防火墙测试)。

### Step 2. 博客服务器克隆 + 初始化

```bash
git clone https://github.com/Lau0x/my-blog.git
cd my-blog
./scripts/init.sh        # 自动生成 .env + 7 个密钥 + chmod 600
vim .env                 # 只改 1 个字段：DOMAIN
```

`.env` 里唯一**必填**的字段：

```bash
DOMAIN=blog.yourdomain.com          # 你的博客域名
```

`IMAGE_REGISTRY` 默认已经是 `ghcr.io/lau0x/my-blog`（上游公开镜像），不用改。

### Step 3. 启动

```bash
docker compose up -d
docker compose logs -f strapi
```

等到日志出现 `Strapi started successfully` 就是起来了。

### Step 4. NPM 配反代

详见 [npm-setup.md](./npm-setup.md)——**务必加全 8 条 Custom Location**，少配任何一条都会导致 admin 首页 widget 报 "Something went wrong"。

### Step 5. 注册 admin + 发文

浏览器打开 `https://blog.yourdomain.com/admin` 注册首个管理员（**立即注册**，首次启动会公开暴露注册表单）。

然后 **Content Manager → Article → Create new entry** 写第一篇文章，刷新前台 `https://blog.yourdomain.com` 应看到文章 = 全链路闭环。

---

## 路径 B：定制化部署（fork + 自构建）

适用于你要改前端 UI、后端逻辑、Strapi schema 等场景。

### Step 1. fork 仓库

GitHub 上 fork `Lau0x/my-blog` 到你自己账号下，clone 到本地做修改。

### Step 2. 推改动 + 触发 CI

```bash
git add . && git commit -m "feat: 你的改动"
git push origin main
```

`.github/workflows/docker-publish.yml` 会自动构建，约 3-5 分钟后 GHCR 上会出现：

```
ghcr.io/<your-username>/my-blog-strapi:latest
ghcr.io/<your-username>/my-blog-nuxt:latest
```

### Step 3. 改 GHCR 包可见性为 Public

GitHub → Your profile → Packages → 找到 `my-blog-strapi` 和 `my-blog-nuxt` → Package settings → Change visibility → **Public**。

（如果不改为 Public，服务器 `docker pull` 需要 `docker login ghcr.io` 带 PAT，多一步麻烦。）

### Step 4. 服务器按路径 A 的 Step 1-5 部署

唯一区别：`.env` 里把 `IMAGE_REGISTRY` 改成你自己的路径：

```bash
IMAGE_REGISTRY=ghcr.io/<your-username>/my-blog    # 全小写！
```

其他步骤与路径 A 完全一致。

---

## 后续升级

无论路径 A 还是 B，日常升级都是：

```bash
./scripts/upgrade.sh
```

详见 [upgrade.md](./upgrade.md)。

---

## 强烈建议（当天做完）

- **立刻注册 admin**（避免公开注册表单被他人抢注）
- **轮换密钥**如果部署过程中 secrets 在截图/聊天记录出现过（参考 [upgrade.md](./upgrade.md) 的 secret rotation 章节）
- **关闭 public registration**（Strapi Settings → Users & Permissions）
