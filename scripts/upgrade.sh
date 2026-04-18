#!/usr/bin/env bash
# 一键升级博客到上游最新版本
#
# 用法：./scripts/upgrade.sh
#
# 行为（按顺序）：
#   1. 前置检查（在项目根 + .env 存在）
#   2. 备份 .env 到 .env.bak-<时间戳>
#   3. （可选）调用 ./scripts/backup.sh 备份 Postgres + uploads
#   4. git fetch，显示待应用的 commits，检测 BREAKING CHANGE 时要求人工确认
#   5. 对齐 .env ↔ .env.example，缺字段就报错退出（让用户手动补）
#   6. docker compose pull 拉新镜像
#   7. docker compose up -d 滚动重启
#   8. 输出容器状态 + 回滚指令
#
# 幂等性：任意步骤失败不会留下坏状态——.env 有备份、git 未 pull 时不动、
# 新镜像 pull 失败不会重启旧容器。
#
# 同机 NPM 部署的朋友：请在 .env 里设置
#   COMPOSE_FILE=docker-compose.yml:docker-compose.same-host.yml
# 之后 docker compose 所有子命令（包括本脚本的 pull/up/ps）都会自动带上 override。

set -euo pipefail

SCRIPT_DIR="$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
ROOT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
cd "$ROOT_DIR"

STAMP="$(date +%Y%m%d-%H%M%S)"
ENV_BACKUP=".env.bak-$STAMP"
ORIGINAL_HEAD=""

# ============ Step 1: 前置检查 ============
echo "=== [1/7] 前置检查 ==="

if [ ! -f docker-compose.yml ]; then
  echo "❌ 找不到 docker-compose.yml，请确认你在项目根目录。"
  exit 1
fi

if [ ! -f .env ]; then
  echo "❌ .env 不存在，请先跑 ./scripts/init.sh 初始化。"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "❌ 未检测到 docker 命令。"
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "❌ 未检测到 docker compose（v2）。"
  exit 1
fi

echo "✅ 环境就绪"

# ============ Step 2: 备份 .env ============
echo ""
echo "=== [2/7] 备份 .env ==="
cp .env "$ENV_BACKUP"
echo "✅ .env → $ENV_BACKUP"

# ============ Step 3: 数据备份（可选） ============
echo ""
echo "=== [3/7] 数据备份 ==="
if [ -x ./scripts/backup.sh ]; then
  if ./scripts/backup.sh; then
    echo "✅ 数据备份完成"
  else
    echo "⚠️  backup.sh 返回非 0，但仍继续升级（请留意后续可能的数据风险）"
  fi
else
  echo "⚠️  未找到可执行的 ./scripts/backup.sh，跳过数据备份（强烈建议手动备份 data/ 目录）"
fi

# ============ Step 4: git 拉取 + breaking change 检测 ============
echo ""
echo "=== [4/7] git pull 最新代码 ==="

if [ ! -d .git ]; then
  echo "⚠️  当前目录不是 git 仓库，跳过 git pull（假定你通过其他方式同步代码）"
else
  # 本地未提交的改动
  if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    echo "❌ 本地有未提交的改动，为避免冲突请先处理："
    git status --short
    echo ""
    echo "提示："
    echo "  - 本地只是 .env / data/ 等已 gitignore 的文件：正常，本脚本只影响跟踪文件"
    echo "  - 如确实是你修改了仓库代码：先 git stash 或 git commit"
    exit 1
  fi

  ORIGINAL_HEAD="$(git rev-parse HEAD)"
  git fetch origin --quiet

  CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  UPSTREAM="origin/$CURRENT_BRANCH"

  if ! git rev-parse --verify --quiet "$UPSTREAM" >/dev/null; then
    echo "⚠️  找不到 upstream $UPSTREAM，跳过 git pull"
  else
    LOCAL="$(git rev-parse HEAD)"
    REMOTE="$(git rev-parse "$UPSTREAM")"

    if [ "$LOCAL" = "$REMOTE" ]; then
      echo "✅ 已是最新，无需 pull"
    else
      echo "即将应用以下 commits："
      git log --oneline "HEAD..$UPSTREAM"
      echo ""

      # 检测破坏性改动
      if git log "HEAD..$UPSTREAM" --format=%B | grep -iE "BREAKING CHANGE|breaking:" >/dev/null; then
        echo "⚠️  检测到 BREAKING CHANGE，请先看上面的 commits 消息。"
        printf "继续升级？[y/N] "
        read -r confirm
        if [ "${confirm:-N}" != "y" ] && [ "${confirm:-N}" != "Y" ]; then
          echo "已取消升级。"
          exit 1
        fi
      fi

      # 检测 compose / .env.example / scripts 变更（需要特别留意）
      CHANGED=$(git diff --name-only "HEAD..$UPSTREAM" -- docker-compose*.yml .env.example scripts/ || true)
      if [ -n "$CHANGED" ]; then
        echo "⚠️  本次升级涉及配置/脚本变更，请留意："
        echo "$CHANGED" | sed 's/^/   - /'
        echo ""
      fi

      git pull --ff-only
      echo "✅ git pull 完成"
    fi
  fi
fi

# ============ Step 5: .env 字段对齐 ============
echo ""
echo "=== [5/7] 对齐 .env ↔ .env.example ==="

# 提取 KEY（过滤注释和空行）
extract_keys() {
  grep -E "^[A-Z_][A-Z0-9_]*=" "$1" | sed 's/=.*//' | sort -u
}

MISSING="$(comm -23 <(extract_keys .env.example) <(extract_keys .env) || true)"
if [ -n "$MISSING" ]; then
  echo "❌ .env.example 新增了以下字段，但你的 .env 缺少："
  echo "$MISSING" | sed 's/^/   - /'
  echo ""
  echo "请手动编辑 .env 补齐（参考 .env.example 里对应字段的注释）后重新运行本脚本。"
  echo "你的原始 .env 备份在: $ENV_BACKUP"
  exit 1
fi
echo "✅ .env 字段齐全"

# ============ Step 6: 拉新镜像 ============
echo ""
echo "=== [6/7] docker compose pull ==="
docker compose pull
echo "✅ 镜像已更新"

# ============ Step 7: 滚动重启 ============
echo ""
echo "=== [7/7] docker compose up -d ==="
docker compose up -d
echo "✅ 容器已启动"

# ============ 收尾 ============
sleep 3
echo ""
echo "=== 容器状态 ==="
docker compose ps

echo ""
echo "=========================================="
echo "✅ 升级完成"
echo "=========================================="
echo ""
echo "⚠️  如果本次升级引入了新 Content-Type（见 Release Notes）："
echo "   新 content-type 对匿名访问者（Public role）默认无权限，前端 fetch 会 403。"
echo "   必须前往 admin 勾选相应 find / findOne 权限，否则新功能静默失效（前台走 fallback 默认值）："
echo ""
echo "     https://<你的域名>/admin → Settings → Users & Permissions → Roles → Public"
echo ""
echo "   每版具体要开的权限清单在 Release Notes："
echo "     https://github.com/Lau0x/my-blog/releases"
echo ""
echo "建议跟踪日志确认正常启动："
echo "   docker compose logs -f strapi"
echo ""
echo "如果出问题需要回滚："
echo "   1) 恢复 .env：     mv $ENV_BACKUP .env"
if [ -n "$ORIGINAL_HEAD" ]; then
  echo "   2) 回滚代码：      git reset --hard $ORIGINAL_HEAD"
fi
echo "   3) 回滚镜像：      docker compose down && docker compose up -d"
echo "      （需要你在 .env 里把 IMAGE_TAG 锁到旧版本的具体 tag，见 upgrade.md）"
echo ""
