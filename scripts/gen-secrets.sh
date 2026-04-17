#!/bin/bash
# 一键生成 Strapi 所需的全部密钥，直接粘贴到 .env
# 用法：./scripts/gen-secrets.sh

gen() { openssl rand -base64 32 | tr -d '\n'; }

echo "# ==== 复制下面这段到 .env ===="
echo "APP_KEYS=$(gen),$(gen),$(gen),$(gen)"
echo "ADMIN_JWT_SECRET=$(gen)"
echo "JWT_SECRET=$(gen)"
echo "API_TOKEN_SALT=$(gen)"
echo "TRANSFER_TOKEN_SALT=$(gen)"
echo "ENCRYPTION_KEY=$(gen)"
echo "DB_PASSWORD=$(openssl rand -base64 24 | tr -d '\n/+=')"
