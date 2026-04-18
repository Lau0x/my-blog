#!/usr/bin/env bash
# 本地开发 compose 封装：把三个 -f override 文件组合包好，
# 所有子命令和 `docker compose` 透传一致。
#
# 用法（和 docker compose 完全一样）：
#   ./scripts/dev.sh up -d --build        # 启动本地栈（首次/改过 frontend 代码用 --build）
#   ./scripts/dev.sh up -d                # 启动（有镜像就不重建）
#   ./scripts/dev.sh down                 # 停
#   ./scripts/dev.sh ps                   # 查状态
#   ./scripts/dev.sh logs -f strapi       # 跟 strapi 日志
#   ./scripts/dev.sh logs -f nuxt         # 跟 nuxt 日志
#   ./scripts/dev.sh restart strapi       # 重启单服务
#   ./scripts/dev.sh exec postgres psql -U blog -d blog   # 进 psql
#   ./scripts/dev.sh build nuxt           # 只重建 nuxt 镜像
#
# 访问：
#   Strapi admin → http://localhost:1337/admin
#   Nuxt 前台   → http://localhost:3001
#
# 对应的生产命令就是去掉 -f build 和 local 的原生 docker compose。

set -euo pipefail

# cd 到项目根（脚本在 scripts/ 下，根在它的父目录）
cd "$(dirname "$0")/.."

# 三个 compose 文件固定顺序：base → build override → local-only override
COMPOSE_FILES=(
  -f docker-compose.yml
  -f docker-compose.build.yml
  -f docker-compose.local.yml
)

# 无参数打印 cheatsheet 帮助
if [[ $# -eq 0 ]]; then
  cat <<'HELP'
本地开发 compose 封装。常用命令：

  ./scripts/dev.sh up -d --build     # 启动（首次/前端代码改过）
  ./scripts/dev.sh up -d             # 启动（不重 build）
  ./scripts/dev.sh down              # 停
  ./scripts/dev.sh logs -f strapi    # 看 strapi 日志
  ./scripts/dev.sh logs -f nuxt      # 看 nuxt 日志
  ./scripts/dev.sh ps                # 查状态
  ./scripts/dev.sh restart strapi    # 重启单服务
  ./scripts/dev.sh build nuxt        # 只重建 nuxt 镜像（改过前端后）

访问：
  Strapi admin → http://localhost:1337/admin
  Nuxt 前台   → http://localhost:3001

所有 docker compose 子命令都透传，本脚本 = docker compose 三合一简写。
HELP
  exit 0
fi

exec docker compose "${COMPOSE_FILES[@]}" "$@"
