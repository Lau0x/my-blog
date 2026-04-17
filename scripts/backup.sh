#!/bin/bash
# 博客备份脚本：数据库 + 上传文件
# 用法：./scripts/backup.sh
# Cron：0 3 * * * cd /path/to/my-blog && ./scripts/backup.sh >> /var/log/blog-backup.log 2>&1

set -e

cd "$(dirname "$0")/.."

# 加载 .env
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

TS=$(date +%Y%m%d-%H%M%S)
OUT=./backups
mkdir -p "$OUT"

echo "[$(date)] ▶ Dumping database..."
docker compose exec -T postgres pg_dump \
  -U "$DB_USER" -d "$DB_NAME" --no-owner --clean \
  | gzip > "$OUT/db-$TS.sql.gz"

echo "[$(date)] ▶ Archiving uploads..."
tar czf "$OUT/uploads-$TS.tar.gz" -C ./data uploads

echo "[$(date)] ▶ Pruning backups older than 30 days..."
find "$OUT" -type f -mtime +30 -delete

echo "[$(date)] ✓ Done. Size:"
du -sh "$OUT"/*$TS* 2>/dev/null || true
