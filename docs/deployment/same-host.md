# 同机部署（NPM 和博客在同一台服务器）

## 架构

```
┌────────────────────────────────────────────┐
│              一台服务器                    │
│                                            │
│  ┌──────────────┐          ┌────────────┐  │
│  │ Nginx Proxy  │  docker  │ blog-nuxt  │  │
│  │ Manager      │─网络直连→│  :3000     │  │
│  │ :80/:443     │          │ blog-strapi│  │
│  │              │          │  :1337     │  │
│  │ npm-net 网络 │◄─ join ──┤ blog-postgres│  │
│  └──────────────┘          └────────────┘  │
│  (端口 3000/1337 不发布到主机)              │
└────────────────────────────────────────────┘
```

同机部署下，博客容器和 NPM 共享同一个 docker 网络（`npm-net`），NPM 通过**容器名**（`blog-nuxt` / `blog-strapi`）直接访问博客后端，不经公网。

## 部署命令

### 1. 查你本机的 NPM network 名

```bash
docker network ls | grep npm
# 常见输出：
# abc123   nginx-proxy-manager_default   bridge   local
# 或：
# abc456   npm_default                   bridge   local
```

记下这个名字。

### 2. 克隆 + 初始化

```bash
git clone https://github.com/<USER>/my-blog.git
cd my-blog
./scripts/init.sh
vim .env
```

`.env` 必填：

```bash
DOMAIN=blog.yourdomain.com
IMAGE_REGISTRY=ghcr.io/<your-username>/my-blog
NPM_NETWORK=nginx-proxy-manager_default   # ← 刚才查到的 NPM 网络名
```

### 3. 启动（**必须带 same-host override**）

```bash
docker compose -f docker-compose.yml -f docker-compose.same-host.yml up -d
docker compose logs -f strapi
```

> 💡 想简化命令？在 `.env` 里加一行：
> ```
> COMPOSE_FILE=docker-compose.yml:docker-compose.same-host.yml
> ```
> 之后就可以直接 `docker compose up -d` 了，`logs` / `ps` / `down` 都会自动带 override。

## NPM 配置要点（同机特有）

NPM 反代时，**Forward Hostname / IP** 填**容器名**，不填 IP：

| 字段 | 值 |
|------|-----|
| Domain Names | `blog.example.com` |
| Forward Hostname / IP | `blog-nuxt` ← 容器名 |
| Forward Port | `3000` |

所有 Custom Locations（8 条，完整清单见 [npm-setup.md](./npm-setup.md)）的 Forward Hostname / IP 填 `blog-strapi`，端口 `1337`。

## 不发布端口到主机（可选）

默认配置下，同机模式仍然会把 3000/1337 发布到 `0.0.0.0:3000`/`0.0.0.0:1337`。这在**本机防火墙管控公网访问**的情况下没有风险（NPM 吃的是 80/443，3000/1337 只是额外的本机访问入口）。

如果你洁癖，希望这两个端口完全不暴露到主机（纯走 docker 内网），需要 **Docker Compose v2.24+**，并在 `docker-compose.same-host.yml` 的 services 下加：

```yaml
services:
  strapi:
    ports: !reset []
    networks:
      - blog-net
      - npm-net

  nuxt:
    ports: !reset []
    networks:
      - blog-net
      - npm-net
```

检查你的 Compose 版本：`docker compose version`。

## 常见陷阱

### ⚠️ NPM_NETWORK 填错 → 容器启动失败

如果 `NPM_NETWORK` 填的网络在 docker 里不存在，启动会报：
```
network <name> declared as external, but could not be found
```

处理：
1. `docker network ls | grep -i npm` 再次确认
2. 有些 NPM 容器用的是 bridge 网络但名字不带 "npm"，看 NPM 容器的 network：
   ```bash
   docker inspect nginx-proxy-manager_app_1 | grep -A5 Networks
   ```

### ⚠️ NPM 不认 `blog-nuxt` 容器名

如果 NPM 反代报 "Host not found"，说明 NPM 容器没加入 `npm-net`。检查：
```bash
docker network inspect <NPM_NETWORK_NAME> | grep -A2 -E "Containers|Name"
```
确保 NPM 容器、blog-nuxt、blog-strapi 都在同一个网络里。

## 优缺点对比

见 [cross-host.md 末尾对比表](./cross-host.md#优缺点对比)。

**一句话：同机适合初期 / 小流量 / 单人运维；跨机适合多项目共用 NPM / 资源隔离 / 规模化。**
