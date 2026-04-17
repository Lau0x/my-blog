#!/usr/bin/env bash
# 一键初始化 .env：拷贝模板 + 自动生成所有密钥 + 收紧权限
#
# 用法：./scripts/init.sh
#
# 行为：
#   - 如果 .env 已存在：不覆盖，退出并提示
#   - 如果不存在：拷贝 .env.example → .env，把所有 __AUTO_GENERATED__ 替换成随机值，chmod 600
#
# 之后你只需要编辑 .env 里的 <YOUR_DOMAIN> 和 <YOUR_GHCR_PATH> 两个占位符，
# 然后 docker compose up -d 就能起来。

set -euo pipefail

SCRIPT_DIR="$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
ROOT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
cd "$ROOT_DIR"

if [ -f .env ]; then
  echo "❌ .env 已存在，不覆盖。如需重新生成，请先备份并删除当前 .env。"
  echo "   提示：备份命令 cp .env .env.bak-\$(date +%Y%m%d-%H%M%S)"
  exit 1
fi

if [ ! -f .env.example ]; then
  echo "❌ 找不到 .env.example，请确认你在项目根目录。"
  exit 1
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "❌ 未安装 openssl，请先安装：apt install openssl / brew install openssl"
  exit 1
fi

gen_b64_32() { openssl rand -base64 32 | tr -d '\n'; }
gen_b64_24_clean() { openssl rand -base64 24 | tr -d '\n/+='; }

APP_KEYS_VAL="$(gen_b64_32),$(gen_b64_32),$(gen_b64_32),$(gen_b64_32)"
ADMIN_JWT_SECRET_VAL="$(gen_b64_32)"
JWT_SECRET_VAL="$(gen_b64_32)"
API_TOKEN_SALT_VAL="$(gen_b64_32)"
TRANSFER_TOKEN_SALT_VAL="$(gen_b64_32)"
ENCRYPTION_KEY_VAL="$(gen_b64_32)"
DB_PASSWORD_VAL="$(gen_b64_24_clean)"

cp .env.example .env

# 用 Python 做原地替换，规避 sed 在不同平台对 base64 特殊字符（/ + =）的转义差异
python3 - "$APP_KEYS_VAL" "$ADMIN_JWT_SECRET_VAL" "$JWT_SECRET_VAL" \
             "$API_TOKEN_SALT_VAL" "$TRANSFER_TOKEN_SALT_VAL" \
             "$ENCRYPTION_KEY_VAL" "$DB_PASSWORD_VAL" <<'PY'
import sys, pathlib
app_keys, admin_jwt, jwt_s, api_salt, transfer_salt, enc_key, db_pw = sys.argv[1:8]
p = pathlib.Path('.env')
text = p.read_text()
mapping = {
    'APP_KEYS=__AUTO_GENERATED__':           f'APP_KEYS={app_keys}',
    'ADMIN_JWT_SECRET=__AUTO_GENERATED__':   f'ADMIN_JWT_SECRET={admin_jwt}',
    'JWT_SECRET=__AUTO_GENERATED__':         f'JWT_SECRET={jwt_s}',
    'API_TOKEN_SALT=__AUTO_GENERATED__':     f'API_TOKEN_SALT={api_salt}',
    'TRANSFER_TOKEN_SALT=__AUTO_GENERATED__':f'TRANSFER_TOKEN_SALT={transfer_salt}',
    'ENCRYPTION_KEY=__AUTO_GENERATED__':     f'ENCRYPTION_KEY={enc_key}',
    'DB_PASSWORD=__AUTO_GENERATED__':        f'DB_PASSWORD={db_pw}',
}
for k, v in mapping.items():
    text = text.replace(k, v)
p.write_text(text)
PY

chmod 600 .env

echo ""
echo "✅ .env 已生成（权限 600），7 个密钥已自动填入。"
echo ""
echo "⚠️  还需手动编辑 .env 里的 DOMAIN 字段："
echo "    DOMAIN=<YOUR_DOMAIN>          → 你的域名，例如 blog.example.com"
echo ""
echo "镜像源（IMAGE_REGISTRY）默认已指向上游公开镜像 ghcr.io/lau0x/my-blog，"
echo "零改代码的用户不用改。如需定制化构建，见 docs/deployment/quick-start.md 路径 B。"
echo ""
echo "下一步："
echo "    vim .env                  # 改 DOMAIN"
echo "    docker compose up -d      # 启动（跨机 NPM 部署）"
echo ""
