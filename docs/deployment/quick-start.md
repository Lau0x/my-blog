# 5 分钟快速上手（跨机 NPM）

这是最主流的部署路径：NPM 跑在 A 服务器，博客跑在 B 服务器。如果你的 NPM 和博客在同一台，请看 [same-host.md](./same-host.md)。

## 前置条件

- 两台服务器（A: NPM，B: 博客），都装好 Docker + Docker Compose v2.x
- 域名 A 记录已解析到 **NPM 服务器**（不是博客服务器）
- NPM 已运行，81 端口管理面板可访问
- fork 本仓库到你的 GitHub 并开启 GitHub Actions

## Step 1. 触发 CI 构建镜像

任意 push 到 `main` 分支触发 `.github/workflows/docker-publish.yml`，约 3-5 分钟后，GHCR 上会出现两个包：

```
ghcr.io/<your-username>/my-blog-strapi:latest
ghcr.io/<your-username>/my-blog-nuxt:latest
```

首次构建完成后，去 GitHub → Your profile → Packages，把两个包可见性改为 **Public**（否则服务器 pull 要 docker login）。

## Step 2. 博客服务器配防火墙

跨机模式下，3000/1337 端口会发布到 0.0.0.0——**必须限制只允许 NPM 服务器 IP 访问**，否则 Strapi admin 暴露在公网会被扫。

以 Hetzner Cloud Firewall 为例（其他云类似）：

| 方向 | 协议 | 端口 | 源 | 备注 |
|------|------|------|-----|------|
| Inbound | TCP | 22 | Any IPv4/v6 | SSH |
| Inbound | ICMP | — | Any | ping |
| Inbound | TCP | 3000 | `<NPM服务器IP>/32` | Nuxt |
| Inbound | TCP | 1337 | `<NPM服务器IP>/32` | Strapi |

配完后**用外部扫描器验证**（例如 `https://www.yougetsignal.com/tools/open-ports/`），确认 3000/1337 对你自己的 Mac 是 closed，只对 NPM 服务器 open。

> ⚠️ 如果博客服务器接了 Tailscale / WireGuard 等 overlay VPN，**不要**从同一 tailnet 的机器测公网 IP 端口——会走 overlay 绕开云防火墙导致假阳性。详见 [troubleshooting.md](./troubleshooting.md#tailscale-遮蔽防火墙测试)。

## Step 3. 博客服务器克隆 + 初始化

```bash
git clone https://github.com/<YOUR_USER>/my-blog.git
cd my-blog
./scripts/init.sh        # 生成 .env + 7 个密钥 + chmod 600
vim .env                 # 只改两个字段
```

`.env` 必填两项：

```bash
DOMAIN=blog.yourdomain.com
IMAGE_REGISTRY=ghcr.io/<your-username>/my-blog   # 全小写！
```

## Step 4. 启动

```bash
docker compose up -d
docker compose logs -f strapi
```

等到日志出现 `Strapi started successfully` 就是起来了。

## Step 5. NPM 服务器配反代

详见 [npm-setup.md](./npm-setup.md)——**务必加全 8 条 Custom Location**，少配任何一条都会导致 admin 首页 widget 报 "Something went wrong"。

## Step 6. 验证闭环

浏览器打开：

- `https://blog.yourdomain.com` → 博客前台应返回 200
- `https://blog.yourdomain.com/admin` → Strapi 后台注册首个管理员

**立刻注册**——首次启动 Strapi 会对外暴露公开注册表单，不注册就有被抢注风险。

## Step 7. 发布第一篇文章

1. admin 后台 → **Content Manager → Article** → **Create new entry**
2. 填 title / slug / content → **Save** → **Publish**
3. 刷新前台 `https://blog.yourdomain.com`，看到文章 = 全链路闭环

## Step 8.（强烈推荐）当天内轮换密钥

如果部署过程中 secrets 在任何非加密通道（聊天记录、截图、邮件）出现过，轮换一遍：

```bash
cd /path/to/my-blog
cp .env .env.bak-$(date +%Y%m%d-%H%M%S)
# 手动替换 6 个 Strapi 密钥（APP_KEYS / ADMIN_JWT_SECRET / JWT_SECRET /
# API_TOKEN_SALT / TRANSFER_TOKEN_SALT / ENCRYPTION_KEY）为新的 openssl rand -base64 32
docker compose restart strapi nuxt
```

⚠️ 轮换 `APP_KEYS` 会使所有已登录的 admin session 失效，需要重新登录——**先注册 admin → 再轮换 → 再登录**，顺序别乱。

`DB_PASSWORD` 如果要轮换，需要同步改 postgres 内的用户密码（`ALTER USER blog WITH PASSWORD '...';`）——风险高，建议保留原值（DB_PASSWORD 只在 docker 内网使用）。
