# NPM 反代完整配置

本文档是 Nginx Proxy Manager 配置 my-blog 的完整 SOP。照抄即可。

## 为什么要配 8 条 Custom Location

Strapi 5 的 admin UI 在运行时会从**多个独立 URL 前缀**调用后端 API，不是所有东西都走 `/api` 或 `/admin`。漏配任何一条都会导致相应功能报错——最常见的症状是 admin 首页 **widget 报 "Something went wrong"**（因为 `/content-manager/homepage/count-documents` 404）。

完整前缀清单：

| Location | 用途 | 缺它会怎样 |
|----------|------|----------|
| `/admin` | admin UI + 登录/权限 API | admin 后台完全打不开 |
| `/api` | 对外 REST API | 前台获取不到文章数据 |
| `/uploads` | 媒体文件**静态访问**（复数名词） | 文章配图全部 404 |
| `/upload` | 媒体**上传 API**（单数）| Media Library 后台上传挂 |
| `/content-manager` | 内容管理器 API（widget / count-documents / recent-documents） | admin 首页 widget 报错 |
| `/content-type-builder` | CTB meta 查询 | 某些后台页面报错 |
| `/i18n` | 国际化插件 | i18n 相关功能挂 |
| `/users-permissions` | 权限管理 API | 角色/权限页面挂 |

⚠️ `/upload`（单数）和 `/uploads`（复数）**是两个不同的东西**，都要配——前者是 API 动作，后者是文件资源。

## Step 1. 创建 Proxy Host

NPM 管理面板 → **Hosts** → **Proxy Hosts** → **Add Proxy Host**。

### Details 标签

| 字段 | 值（跨机） | 值（同机） |
|------|-----------|-----------|
| Domain Names | `blog.example.com` | 同左 |
| Scheme | `http` | 同左 |
| Forward Hostname / IP | `<博客服务器公网IP>` | `blog-nuxt`（容器名） |
| Forward Port | `3000` | 同左 |
| Cache Assets | ❌ | 同左 |
| Block Common Exploits | ✅ | 同左 |
| Websockets Support | ✅ | 同左 |

### Custom Locations 标签

点 **Add Location** 八次，按上表每条前缀各配一条。每条的字段值：

| 字段 | 值（跨机） | 值（同机） |
|------|-----------|-----------|
| Location | 如 `/content-manager`（按上表） | 同左 |
| Scheme | `http` | 同左 |
| Forward Hostname / IP | `<博客服务器公网IP>` | `blog-strapi` |
| Forward Port | `1337` | 同左 |

⚠️ **每条 Custom Location 都要点右边齿轮 ⚙️**，在 Custom Nginx Configuration 里粘贴：

```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
client_max_body_size 50M;
```

- `proxy_set_header` 4 行：让后端拿到真实 Host 和客户端 IP（Strapi 的 SSR、防爬虫、日志记录都需要）
- `client_max_body_size 50M`：Strapi 默认 Body 限制 1M，上传大图会 413，改成 50M 覆盖常见场景

### SSL 标签

| 字段 | 值 |
|------|-----|
| SSL Certificate | **Request a new SSL Certificate** |
| Force SSL | ✅ |
| HTTP/2 Support | ✅ |
| HSTS Enabled | ✅ |
| HSTS Subdomains | ❌（以后加子域名方便） |
| Use a DNS Challenge | ❌ |
| Email | 你的邮箱 |
| I Agree to Let's Encrypt TOS | ✅ |

点 **Save**。NPM 会向 Let's Encrypt 发起 HTTP-01 challenge（走 80 端口），约 15-30 秒后证书签发成功，Proxy Host 列表里这条记录会显示 `Let's Encrypt` 标签。

## Step 2. 验证

任何机器（最好不是博客/NPM 本机）：

```bash
curl -sI https://blog.example.com | head -5
# 预期：HTTP/2 200, x-powered-by: Nuxt

curl -sI https://blog.example.com/admin | head -5
# 预期：HTTP/2 200, content-security-policy 里有 market-assets.strapi.io
```

浏览器打开 admin 首页后按 **F12 → Network** → 过滤 `content-manager`，硬刷新。应该看到：

```
content-manager/homepage/count-documents               200
content-manager/homepage/recent-documents?action=update   200
content-manager/homepage/recent-documents?action=publish  200
```

任何一条 404 = 对应前缀漏配。

## 未来简化：正则 Location（可选）

NPM 的 Location 字段支持 nginx 原生语法，可以用一条正则把 5 条 Strapi API 前缀合并成一条：

| Location | Forward Hostname / IP | Forward Port |
|----------|----------------------|--------------|
| `~ ^/(api\|admin\|content-manager\|content-type-builder\|upload\|uploads\|i18n\|users-permissions)/` | `<博客IP>` 或 `blog-strapi` | `1337` |

一条顶 8 条，Advanced 配置只写一次。

⚠️ NPM 不同版本对正则 location 支持略有差异，配完要验证（用上面的 `F12 → Network` 方法）。如果验证失败，回退到 8 条独立 Location 的写法。

## SSL 签发失败排查

Let's Encrypt HTTP-01 challenge 需要：

1. **DNS A 记录正确**：`dig +short blog.example.com` 返回的 IP 必须是 NPM 服务器的公网 IP
2. **NPM 服务器 80 端口对公网开放**：Let's Encrypt 会从公网 80 访问 `http://blog.example.com/.well-known/acme-challenge/<token>`
3. **无中间代理干扰**：Cloudflare Proxy（橙色云朵）会截获 80 请求导致 challenge 失败——开启 DNS only（灰色云朵）或用 Cloudflare 的 DNS challenge 模式

失败时看 NPM 日志：

```bash
docker logs nginx-proxy-manager 2>&1 | tail -50 | grep -iE "error|challenge|certbot"
```

## 常见坑

### admin 能打开但 widget 报错

症状：`/admin` 首页打开后，LAST EDITED ENTRIES / LAST PUBLISHED ENTRIES 等卡片报 "Something went wrong"。
根因：漏配了 `/content-manager` Custom Location。
修复：参考 [troubleshooting.md](./troubleshooting.md#widget-报错-something-went-wrong)。

### 上传图片 413 Request Entity Too Large

症状：admin Media Library 上传稍大图片报 413。
根因：NPM 默认 Body 限制 1M。
修复：Custom Location 的 Advanced 里加 `client_max_body_size 50M;`（上面配置已包含）。

### 502 Bad Gateway

症状：访问前台/admin 报 502。
根因（按概率排序）：
1. 博客容器挂了 → `docker ps` 看状态
2. 跨机模式下博客 IP 变了 → 更新 Proxy Host 的 Forward Hostname
3. 跨机模式下防火墙把 NPM 服务器 IP 也 block 了 → 检查防火墙规则的 source IP
4. 同机模式下 NPM 没加入 npm-net → `docker network inspect <NPM_NETWORK>`
