# 跨机部署（NPM 和博客在不同服务器）

## 架构

```
┌─────────────────────┐         ┌──────────────────────────┐
│  NPM 服务器          │  HTTPS  │  博客服务器               │
│  (A: 43.x.x.x)      │ ──────▶ │  (B: 178.x.x.x)          │
│                     │  80/443 │                          │
│  ┌───────────────┐  │   ↓     │   ┌──────────────────┐   │
│  │ Nginx Proxy   │  │  HTTP   │   │ blog-nuxt :3000  │   │
│  │ Manager       │──┼─────────┼──▶│ blog-strapi:1337 │   │
│  │ + Let's       │  │  (only  │   │ blog-postgres    │   │
│  │   Encrypt     │  │   NPM-A │   └──────────────────┘   │
│  │               │  │    IP)  │   防火墙只放行 A 的 IP    │
│  └───────────────┘  │         │                          │
└─────────────────────┘         └──────────────────────────┘
         ▲
         │ DNS A 记录
         │ blog.example.com → 43.x.x.x
```

域名解析到 NPM 服务器的 IP；NPM 反代到博客服务器的公网 IP 的 3000/1337 端口；博客服务器防火墙只放行 NPM 服务器 IP。

## 部署命令

```bash
# 博客服务器 B
git clone https://github.com/Lau0x/my-blog.git
cd my-blog
./scripts/init.sh
vim .env                     # 默认用上游镜像，只需填 DOMAIN
docker compose up -d         # 默认就是跨机模式，无需 -f
```

`.env` 必填字段：

- `DOMAIN=blog.yourdomain.com`（必改）
- `IMAGE_REGISTRY=ghcr.io/lau0x/my-blog`（默认值，零改代码用户不用动；定制化场景见 [quick-start.md 路径 B](./quick-start.md#路径-b定制化部署fork--自构建)）

## 防火墙样例

### Hetzner Cloud Firewall（推荐 — 在 VM 之前过滤，最安全）

在 Hetzner 控制台 → Cloud Firewalls → Add rule：

| Direction | Protocol | Port | Source IPs | 说明 |
|-----------|----------|------|------------|------|
| Inbound | TCP | 22 | `0.0.0.0/0, ::/0` | SSH，全开 |
| Inbound | ICMP | — | `0.0.0.0/0, ::/0` | ping |
| Inbound | TCP | 3000 | `<NPM_IP>/32` | Nuxt，仅 NPM |
| Inbound | TCP | 1337 | `<NPM_IP>/32` | Strapi，仅 NPM |

绑定到博客 VM 的网络接口后，**立刻用外部扫描器验证**：访问 `https://www.yougetsignal.com/tools/open-ports/`，输入博客 VM 的公网 IP，逐个扫 22/3000/1337：

- 22 → open ✅
- 3000 → closed ✅（外部看就是 filtered）
- 1337 → closed ✅

### UFW（如果在自己装 Linux 没有云防火墙）

```bash
# 博客服务器 B
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow from <NPM_IP> to any port 3000 proto tcp
sudo ufw allow from <NPM_IP> to any port 1337 proto tcp
sudo ufw enable
sudo ufw status numbered
```

### iptables（裸奔场景）

```bash
sudo iptables -I INPUT -p tcp --dport 3000 -s <NPM_IP> -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 1337 -s <NPM_IP> -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 3000 -j DROP
sudo iptables -A INPUT -p tcp --dport 1337 -j DROP
# 保存规则（Debian/Ubuntu）：
sudo apt install iptables-persistent
sudo netfilter-persistent save
```

## NPM 配置要点（跨机特有）

详细见 [npm-setup.md](./npm-setup.md)，跨机场景的**关键差异**：

- Proxy Host 的 **Forward Hostname / IP** 填**博客服务器的公网 IP**（不是容器名，因为跨机）
- Forward Port 主条目填 `3000`（Nuxt）
- 所有 Custom Locations 的 Forward Hostname / IP 也都填**博客服务器的公网 IP**，端口 `1337`

## 常见陷阱

### ⚠️ Tailscale / VPN overlay 遮蔽防火墙测试

如果你的 Mac（或任何测试机）和博客服务器在**同一个 Tailscale tailnet**，用 `nc -vz <博客IP> 3000` 测试会出现**假阳性**——`succeeded` 但其实防火墙是通的，因为流量走了 tailscale overlay（`tailscale0` 接口），**绕开了云厂商防火墙**（防火墙只过滤公网 eth0）。

**识别信号**：
- `ss -tlnp` 显示该端口没 listen，但本机 nc 却 succeeded
- 博客服务器 `ip addr show` 有 `tailscale0` / `tun0` / `wg0` 接口
- 路由表 `ip route` 里有 `100.64.0.0/10` 的特殊路由

**处理方法**：
1. 用**完全无关的第三方扫描器**测试（yougetsignal.com、nmap from 另一台 VPS）
2. 或临时 `sudo tailscale down` 后再测
3. 详见 [troubleshooting.md](./troubleshooting.md#tailscale-遮蔽防火墙测试)

### ⚠️ 博客服务器的公网 IP 不能变

跨机模式写死在 NPM 的 Forward Hostname 里——如果博客服务器是弹性 IP / DHCP，重启后 IP 变了，NPM 会拿到 502。解决方案：
- 用固定公网 IP（Hetzner 默认给固定 IP）
- 或在博客服务器加个域名（如 `blog-backend.internal.example.com`），NPM 里填这个域名
- 或博客/NPM 同接入 Tailscale，NPM Forward 到 `100.x.x.x` 内网 IP（需要 NPM 服务器也装 Tailscale）

## 优缺点对比

| 对比项 | 跨机部署 | 同机部署 |
|--------|---------|---------|
| 资源隔离 | ✅ NPM 故障不影响博客 | ❌ 共用 VM |
| 安全面 | ⚠️ 需要防火墙，否则 admin 暴露公网 | ✅ 走 docker 内网，天然隔离 |
| 性能 | 多一跳公网 | ✅ 内网直连 |
| 运维复杂度 | 高（两台机器 + 防火墙 + IP 变动风险） | ✅ 低 |
| 扩展性 | ✅ 一个 NPM 服务多个后端 | ❌ 绑死在一起 |

**如果你只有一台服务器，跑同机部署省心；如果 NPM 已经是独立基础设施给多个项目共享，跨机部署更合理。**
