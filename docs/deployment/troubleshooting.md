# 故障排查手册

真实部署过程中踩过的所有坑 + 排查方法。按症状分类查阅。

---

## 部署阶段

### 镜像拉不到（pull 404）

**症状**：
```
Error response from daemon: pull access denied for ghcr.io/xxx/my-blog-strapi
manifest unknown / repository not found
```

**可能原因（按概率）**：

1. **`IMAGE_REGISTRY` 大小写错误** — GHCR 强制 username 全小写。如果你的 GitHub username 有大写（如 `MyUser`），`.env` 里必须写 `ghcr.io/myuser/my-blog`，不是 `MyUser`
2. **GHCR 包还没 Public** — 首次 CI 构建完成后需要手动改 package 可见性为 Public（仓库 README 的 Step 1.1）
3. **镜像路径格式错** — 仓库里用的是 `${IMAGE_REGISTRY}-strapi`（短横线拼接），不是 `${IMAGE_REGISTRY}/strapi`（斜杠）。`.env` 里应该写 `IMAGE_REGISTRY=ghcr.io/username/my-blog`，最终会拼成 `ghcr.io/username/my-blog-strapi:latest`
4. **CI 还没构建完** — push 后去 `https://github.com/<user>/my-blog/actions` 看 workflow 是否跑完

**排查命令**：
```bash
# 手动测试 pull
docker pull ghcr.io/<你的用户名>/my-blog-strapi:latest
docker pull ghcr.io/<你的用户名>/my-blog-nuxt:latest
```

---

### 启动后容器不断 restart

**症状**：`docker ps` 看到 `Restarting` 状态。

**排查**：
```bash
docker compose logs --tail=100 strapi   # 看崩溃原因
```

**常见原因**：
- `.env` 里密钥为空或格式错 → 跑 `./scripts/init.sh` 重新生成
- `DB_PASSWORD` 含特殊字符（`/` `+` `=` 等）没转义 → `init.sh` 默认会过滤掉，但手动改过的需要检查
- Postgres 初始化没完成 strapi 就连接失败 → 看 `healthcheck`，等 postgres healthy 再看 strapi

---

## NPM / 反代阶段

### SSL 签发失败

**症状**：NPM 的 Proxy Host 保存后证书状态一直是 "unknown" 或报 "Let's Encrypt challenge failed"。

**排查 checklist**：

1. **DNS 是否解析正确**
   ```bash
   dig +short blog.example.com
   # 必须返回 NPM 服务器的公网 IP
   ```

2. **NPM 服务器 80 端口是否对公网开放**
   ```bash
   # 从任何外部机器
   curl -I http://blog.example.com/.well-known/acme-challenge/test
   # 应该返回 404（not found 但端口通）而不是 connection refused
   ```

3. **是否有 Cloudflare / 中间代理**
   - Cloudflare Proxy（橙云朵）会截获 HTTP 请求，干扰 HTTP-01 challenge
   - 解决：DNS only 模式（灰云朵），或改用 Cloudflare 的 DNS challenge

4. **域名 rate limit**
   - 同一域名反复请求证书会触发 LE rate limit（5 次/小时）
   - 等 1 小时再试，或用 staging 模式调试

**看日志**：
```bash
docker logs nginx-proxy-manager 2>&1 | grep -iE "error|challenge|certbot" | tail -50
```

---

### widget 报错 "Something went wrong"

**症状**：admin 首页 `Hello XXX` 下面的卡片（LAST EDITED ENTRIES / LAST PUBLISHED ENTRIES / ENTRIES）全部显示红色 ⚠️ + "Couldn't load widget content"。

**根因**：NPM 漏配 `/content-manager` 等 Custom Location，widget API 请求 fallback 到 Nuxt，Nuxt 当然不认识这些路径，返回 404。

**确认根因**：
1. F12 → Network → 过滤 `content-manager` → 硬刷新
2. 看到 `content-manager/homepage/count-documents` 状态 `404` + Response body 是 `"Page not found: /content-manager/homepage/count-documents"`

**修复**：在 NPM 补齐 5 条 Custom Location（`/content-manager`、`/content-type-builder`、`/upload`、`/i18n`、`/users-permissions`），详见 [npm-setup.md](./npm-setup.md#step-1-创建-proxy-host)。

---

### 502 Bad Gateway

**排查顺序**：

1. 博客容器状态
   ```bash
   docker ps --format "table {{.Names}}\t{{.Status}}"
   # 全部应该 Up，postgres 还应该显示 (healthy)
   ```

2. 容器日志
   ```bash
   docker compose logs --tail=50 nuxt
   docker compose logs --tail=50 strapi
   ```

3. NPM 能否连到博客
   - **跨机**：在 NPM 服务器 `curl -I http://<博客IP>:3000` 应返回 200
     - 如果 connection refused：博客没启动或端口没发布
     - 如果 connection timeout：防火墙 block 了 NPM 服务器 IP
   - **同机**：在 NPM 容器内 `docker exec -it nginx-proxy-manager_app_1 curl -I http://blog-nuxt:3000`
     - 如果 "could not resolve host"：两个容器没在同一个 docker network

---

## 防火墙 / 网络阶段

### Tailscale 遮蔽防火墙测试

**症状**：
- 云厂商防火墙（Hetzner / AWS Security Group）配好规则：3000/1337 只允许 NPM 服务器 IP
- 从 Mac 跑 `nc -vz <博客公网IP> 3000` 居然返回 `succeeded`
- 但博客服务器 `ss -tlnp` 显示该端口**没有**listen（docker 还没起）

**根因**：Mac 和博客服务器在**同一个 Tailscale tailnet**。Tailscale 用 MagicDNS / 子网路由把流量劫持到 `tailscale0` overlay（100.x CGNAT 地址段），**绕开公网 eth0**，也绕开云防火墙——云防火墙只过滤公网入口流量。

**识别信号**：
- 博客服务器 `ip addr show | grep tailscale0` 有输出
- 路由表 `ip route` 里有 `100.64.0.0/10` 相关条目
- 或服务器 `ip addr show | grep -E "tun|wg|tailscale"` 任何命中

**处理**：防火墙测试**必须用与目标机无 overlay 关系的第三方视角**，任一：

1. `https://www.yougetsignal.com/tools/open-ports/` 在线扫描（最快）
2. `nmap -Pn <公网IP> -p 22,3000,1337 --reason` 从**第三方服务器**（不在同 tailnet 的任意 VPS）
3. `curl -v telnet://<公网IP>:3000` 从手机 4G 网络（100% 确保不在 tailnet）
4. 临时 `sudo tailscale down` 再测——但不如外部扫描器可信

---

### 防火墙配了但扫描仍显示 open

**可能原因**：

1. **规则没绑定到 VM** — Hetzner Cloud Firewall 创建后需要手动 Assign 到 server 的 network interface
2. **规则顺序问题** — UFW 一旦 allow 过某 IP 再 deny 不会覆盖，需要 `ufw delete` 原规则
3. **测试源 IP 也被 allow 了** — 检查 source IP 是不是泛化（比如 `0.0.0.0/0`）

---

## Git / CI 阶段

### `git remote set-url` 看起来没生效

**症状**：
```bash
git remote set-url origin git@github.com:User/repo.git
git remote -v
# origin https://github.com/User/repo.git  ← 变成 HTTPS 了？
```

**根因**：全局 `~/.gitconfig` 里有**反向 insteadOf 规则**：
```
[url "https://github.com/"]
    insteadOf = git@github.com:
```

**排查**：
```bash
git config --list | grep insteadof
```

**处理**：
```bash
# 备份
cp ~/.gitconfig ~/.gitconfig.bak-$(date +%Y%m%d-%H%M%S)
# 移除 GitHub 的反向重写
git config --global --remove-section url.https://github.com/
# 验证
git config --get-all url.https://github.com/.insteadof || echo "已清除"
```

同类问题可能存在于 gitlab / bitbucket 的 insteadof 规则——按需排查。

---

### GHCR 镜像构建成功但 pull 返回 401

**症状**：CI 构建显示绿色，`docker pull ghcr.io/user/my-blog-strapi` 报 `unauthorized`。

**根因**：GHCR 包默认是 **Private**，首次构建后需要手动改成 Public。

**修复**：
1. GitHub → 点自己头像 → **Your profile**
2. **Packages** 标签（不是 Repositories）
3. 找到 `my-blog-strapi` 和 `my-blog-nuxt`
4. 进入包 → **Package settings**（右侧）→ 滚到最底 **Danger Zone** → **Change visibility** → **Public**

两个包都要改。

---

## Strapi 内部

### admin 首次启动遇到的 "prod mode content-type-builder disabled"

**不是故障，是设计**。Strapi 5 在 production 模式下**故意禁用** Content-Type Builder 的编辑功能，防止生产环境热改 schema 引发灾难。

**正确工作流**：
- 本地 dev 环境 (`npm run develop`) 改 schema → git push → CI 构建新镜像 → 服务器 `docker compose pull && up -d`
- 不要为了方便把 production 切到 dev 模式

### 上传图片 413 Request Entity Too Large

见 [npm-setup.md 的说明](./npm-setup.md#上传图片-413-request-entity-too-large)。

### admin 刷新后显示 "session expired"

**常见触发**：
- 轮换了 `APP_KEYS` 或 `ADMIN_JWT_SECRET` 但没重启容器 / 重启了但前端还缓存旧 token
- 处理：`docker compose restart strapi`，前端清 cookie 或开无痕窗口

---

## 通用排查流程

遇到任何问题，按这个顺序查：

1. **看日志**：`docker compose logs --tail=100 <service>`
2. **看状态**：`docker ps`（容器状态）+ `docker network ls`（网络是否存在）
3. **看配置**：`docker compose config`（渲染后的最终配置，能看到变量替换）
4. **测连通**：`curl -I http://localhost:3000` 在博客服务器本机
5. **测反代**：在 NPM 服务器 `curl -I http://<博客IP>:3000` 或 `curl -I http://blog-nuxt:3000`
6. **测公网**：`curl -I https://blog.example.com` 从完全无关的机器（手机 4G / 朋友电脑 / 在线 curl 工具）

先本机 → 容器间 → 公网，逐层向外排查，能把问题定位到某一跳。
