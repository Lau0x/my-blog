#!/usr/bin/env bash
# 本地开发 compose 封装：把三个 -f override 文件组合包好，
# 所有子命令和 `docker compose` 透传一致。
#
# 用法（和 docker compose 完全一样）：
#   ./scripts/dev.sh up -d --build        # 启动本地栈（Nuxt 前端代码是 build-time 打镜像的，
#                                         #   所以每次 up 都加 --build 最稳；
#                                         #   layer cache 会让没改的部分几秒 skip）
#   ./scripts/dev.sh down                 # 停
#   ./scripts/dev.sh ps                   # 查状态
#   ./scripts/dev.sh logs -f strapi       # 跟 strapi 日志
#   ./scripts/dev.sh logs -f nuxt         # 跟 nuxt 日志
#   ./scripts/dev.sh restart strapi       # 重启单服务
#   ./scripts/dev.sh exec postgres psql -U blog -d blog   # 进 psql
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

  ./scripts/dev.sh up -d --build     # ⭐ 启动本地栈（每次都这条，无脑加 --build）
  ./scripts/dev.sh down              # 停
  ./scripts/dev.sh logs -f strapi    # 看 strapi 日志
  ./scripts/dev.sh logs -f nuxt      # 看 nuxt 日志
  ./scripts/dev.sh ps                # 查状态
  ./scripts/dev.sh restart strapi    # 重启单服务（改过 strapi 配置时用）

为什么每次都要 --build：
  Nuxt 前端代码是 build-time 打进镜像的（没走 volume mount 热重载），
  不带 --build 改过前端的改动不会进容器。Docker layer cache 会让
  没改过的部分几秒跳过，代价极小——加了绝不亏，不加有可能坑。

访问：
  Strapi admin → http://localhost:1337/admin
  Nuxt 前台   → http://localhost:3001

所有 docker compose 子命令都透传（exec / pull / cp / top 等），本脚本 = docker compose 三合一简写。
HELP
  exit 0
fi

exec docker compose "${COMPOSE_FILES[@]}" "$@"
