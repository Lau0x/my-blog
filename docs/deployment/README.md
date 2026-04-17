# 部署文档

本目录是 my-blog 部署 + 运维的完整指南。按场景选择对应文档即可。

## 四种部署模式

| 场景 | 适用 | 入口文档 |
|------|------|---------|
| **生产 · 跨机 NPM**（推荐） | NPM 在独立服务器，博客这台只跑应用 | [cross-host.md](./cross-host.md) |
| 生产 · 同机 NPM | NPM 和博客在同一台服务器 | [same-host.md](./same-host.md) |
| 本地开发 | 不用 NPM，端口直接暴露 localhost | 见仓库 README 的"本地开发"章节 |
| 源码构建 | fork 仓库做定制化 | 见仓库 README 的"部署模式"章节 |

## 按主题查阅

- 🚀 [**5 分钟快速上手**](./quick-start.md) — 最常见的跨机部署路径
- 🛠️ [**本地开发 → 生产发布工作流**](./development-workflow.md) — 迭代博客的标准 SOP（改代码/改 schema 的完整闭环）
- 🔄 [日常升级 / 回滚 / 数据迁移](./upgrade.md) — `./scripts/upgrade.sh` + 破坏性升级应对 + 回滚预案
- 🌐 [NPM 反代配置](./npm-setup.md) — Proxy Host + Custom Locations 完整清单 + SSL 签发
- 🔥 [故障排查手册](./troubleshooting.md) — widget 404 / SSL 签发失败 / Tailscale 陷阱 / GHCR 镜像 404

## 先决知识

博客由三个容器组成：
- `blog-postgres`（5432，内网）
- `blog-strapi`（1337，CMS 后端 + admin）
- `blog-nuxt`（3000，前台 SSR）

NPM 作为反向代理和 SSL 终端，把单个域名（如 `blog.example.com`）按路径分流到 Strapi 和 Nuxt。核心路由结构：

```
https://blog.example.com/           → Nuxt 3000（前台）
https://blog.example.com/admin      → Strapi 1337（后台管理）
https://blog.example.com/api/*      → Strapi 1337（对外 REST API）
https://blog.example.com/content-manager/* → Strapi 1337（widget API）
... 等 8 条 Strapi 前缀（完整清单见 npm-setup.md）
```
