# 日常升级 / 回滚 / 数据迁移

上游作者（fork 源）发布新版本后，如何把服务器的博客同步到最新版。

## 一条命令升级（日常情况）

```bash
cd /path/to/my-blog
./scripts/upgrade.sh
```

`upgrade.sh` 会依次做：

1. 检查你在项目根、.env 存在、docker 可用
2. **备份 .env** 到 `.env.bak-<时间戳>`
3. 调用 `./scripts/backup.sh` 备份 Postgres + uploads
4. `git fetch` → 显示待应用的 commits → 检测 BREAKING CHANGE 要求确认 → `git pull`
5. 对齐 .env ↔ .env.example，**发现缺字段会停住让你手动补**
6. `docker compose pull` 拉新镜像
7. `docker compose up -d` 滚动重启
8. 显示容器状态 + 回滚指令

任意一步失败都不会留下坏状态——.env 已备份、git 未 pull 就不动、新镜像 pull 失败不会重启旧容器。

## 理解"升级"的 5 种场景

| 上游改了什么 | `upgrade.sh` 够用吗？ | 备注 |
|--------------|----------------------|------|
| 前端/后端业务代码（Vue、controller、service） | ✅ 自动处理 | CI 构建新镜像，pull 后重启生效 |
| Strapi schema 小改（加可空字段、加 Single Type、加 Component） | ✅ 自动处理 | Strapi 启动时兼容 |
| Strapi schema 破坏性改动（改字段类型、删字段、重命名） | ⚠️ 需要手动迁移 | 看 commit message 是否有 `BREAKING CHANGE`，按指引迁移数据 |
| `docker-compose*.yml` 结构调整（改 network、加 service） | ✅ 自动处理 | upgrade.sh 会提示你查看涉及文件 |
| `.env.example` 新增必填字段 | ⚠️ 会停住让你手动补 | 按 `.env.example` 注释补到 `.env` |

## 同机 NPM 部署者的额外配置

如果你是同机部署（用 `-f docker-compose.same-host.yml`），在 `.env` 里加一行：

```bash
COMPOSE_FILE=docker-compose.yml:docker-compose.same-host.yml
```

之后 `docker compose` 所有子命令（包括 upgrade.sh 里的 `pull` / `up -d`）都会自动带上 override，无需改脚本。

## 破坏性升级（Breaking Changes）识别

上游 commit message 遵循 Conventional Commits 惯例：

- `feat:` / `fix:` / `docs:` → 兼容变更，可放心升级
- `refactor:` → 需要**看 commit 正文**，可能涉及配置迁移
- `BREAKING CHANGE:` 或 `feat!:` / `refactor!:` → **破坏性**，必须读完 commit 消息再升级

`upgrade.sh` 检测到 `BREAKING CHANGE` 字样会自动停下要求确认。

升级前**手动预览**上游变更：

```bash
cd /path/to/my-blog
git fetch origin
git log --oneline HEAD..origin/main              # 看所有待应用 commits
git log -p HEAD..origin/main -- docker-compose.yml .env.example  # 看配置文件改动
```

## 数据备份策略

`./scripts/backup.sh` 会导出：
- Postgres 全量 SQL dump
- `data/uploads/` 媒体文件
- 打包压缩，时间戳命名

**建议**：
- 日常升级自动跑（upgrade.sh 内置调用）
- 定时任务每天凌晨跑一次（crontab）：
  ```
  0 3 * * * cd /path/to/my-blog && ./scripts/backup.sh >> /var/log/blog-backup.log 2>&1
  ```
- 备份文件**异地复制**（rsync 到另一台机器 / rclone 推到对象存储），单机备份等于没备份

## 回滚预案（最关键的那一条）

当升级后出问题（admin 打不开 / 数据丢失 / 容器反复崩溃），按顺序回滚：

### Level 1：只回滚 .env

```bash
cd /path/to/my-blog
ls .env.bak-*       # 找最近的备份
mv .env.bak-YYYYMMDD-HHMMSS .env
docker compose restart
```

### Level 2：回滚代码 + 镜像 tag

如果是镜像层面的问题（新版 bug），把镜像 tag 锁到上一个已知好版本：

1. **先把镜像 pin 成具体 tag**（不要留在 `:latest`）

   CI 每次构建自动打三套 tag（`.github/workflows/docker-publish.yml`），任选一套回滚：

   | Tag 形式 | 示例 | 适用场景 |
   |---------|------|---------|
   | **语义化版本**（推荐） | `1.1.0` / `1.1` | 已经发过 Release 的快照版本，最清晰 |
   | Git commit SHA | `sha-d8c206a` | 还没发 Release 的中间版本 |
   | 分支 tag | `main` | 基本等同 `latest`，不建议 pin |

   改 `.env`（**注意 semver tag 不带 `v` 前缀**，`docker/metadata-action` 自动剥掉了）：
   ```
   IMAGE_TAG=1.1.0        # ✅ 推荐——锁到 v1.1.0 Release 快照
   # IMAGE_TAG=sha-05a1802 # ✅ 备选——锁到具体 commit
   # IMAGE_TAG=latest       # ❌ 默认值，不适合回滚
   ```

2. **回滚代码**
   ```bash
   git reset --hard <上一个已知好的 commit>
   ```

3. **重启**
   ```bash
   docker compose up -d
   ```

4. **验证**——容器起来后看日志正常 + 前台可访问，再把 `:latest` 标签从心里抹掉。

### Level 3：数据库回滚

如果是数据损坏（schema 改坏了、migration 出错），从 backup 恢复：

```bash
cd /path/to/my-blog
docker compose stop strapi nuxt           # 停应用，保留 postgres
# 恢复 SQL 备份
cat backups/blog-YYYYMMDD.sql | docker compose exec -T postgres psql -U blog -d blog
# 恢复 uploads
rm -rf data/uploads/* && tar -xzf backups/uploads-YYYYMMDD.tar.gz -C data/uploads/
# 重启应用
docker compose up -d
```

⚠️ **恢复前务必停 strapi**，否则新旧数据会串。

## 生产环境的 Pin 版本策略（推荐用法）

默认 `IMAGE_TAG=latest` 适合快速尝鲜，**不适合严肃生产环境**——因为：

- `:latest` 会被每次 main 构建持续覆盖，无法快速定位"哪个版本引入了 bug"
- 没有精确回滚锚点——你不知道"昨天的 latest" digest 是啥
- 多机部署可能拉到不同版本（两台机器各自 pull 的时刻不同）

### 好消息：CI 已经在打多套 tag，直接用就行

`.github/workflows/docker-publish.yml` 用 `docker/metadata-action` 的 semver 规则，**每次 push git tag（如 `v1.1.0`）都会自动在 GHCR 上产出三个不变的镜像 tag**：

| GHCR 镜像 tag | 由什么触发 | 含义 |
|--------------|----------|------|
| `1.1.0` | `git push v1.1.0` | 该 Release 的不可变快照（`v` 前缀被自动剥掉，行业惯例） |
| `1.1` | `git push v1.1.0` | 追最新的 1.1.x 小版本 |
| `sha-05a1802` | 每次 main push | 按 commit SHA 定位 |
| `latest` | 每次 main push | 跟随 main，会漂移 |

**验证镜像 tag 真实存在**（不依赖 GitHub UI）：
```bash
docker manifest inspect ghcr.io/<owner>/my-blog-nuxt:1.1.0
# 返回 JSON = 存在；"manifest unknown" = 不存在
```

### 严肃生产四步走

1. **服务器 `.env` 把 `IMAGE_TAG` 从 `latest` 改成具体 semver**：
   ```bash
   IMAGE_TAG=1.1.0          # 锁到 v1.1.0 Release 快照
   ```

2. **发版流程变成显式动作**——上游发新 Release（如 `v1.2.0`）后：
   ```bash
   # 服务器上
   vim .env                  # 把 IMAGE_TAG=1.1.0 改成 IMAGE_TAG=1.2.0
   ./scripts/upgrade.sh      # 此时 pull 的就是 v1.2.0 快照
   ```
   这样升级变成**一次有意识的决定**，而不是 `:latest` 被动漂移。

3. **出 bug 秒回滚**——把 `IMAGE_TAG` 改回上一版 semver：
   ```bash
   vim .env                  # IMAGE_TAG=1.1.0
   docker compose up -d      # 10 秒内回到旧版
   ```

4. **保留近 3-5 个版本 tag**——GHCR 默认永久保留，不用特别操作。真的要清理看 GitHub → Packages → Manage versions。

### 为什么 `1.1.0` 没带 `v` 前缀

`docker/metadata-action` 的 `type=semver,pattern={{version}}` 会从 git tag 里提取**纯数字版本号**——所以 git tag `v1.1.0` → 镜像 tag `1.1.0`。这是 Docker 生态惯例（Docker Hub / GHCR / ECR 通用）。别写 `IMAGE_TAG=v1.1.0`，那个 tag 不存在。

## 常见问题

### Q: upgrade.sh 中途 Ctrl+C 会留下坏状态吗？

A: 不会。脚本按"只改一点 → 确认 → 再改一点"顺序执行：
- 前 3 步（检查/备份）：本地操作，无副作用
- 第 4 步（git pull）：有 `--ff-only`，冲突时自动失败回退
- 第 5 步（字段检查）：发现问题直接 exit 不继续
- 第 6-7 步（pull + up）：docker compose 本身是幂等的

任何时候中断，后续重跑 `upgrade.sh` 都能继续。

### Q: 只想升级不想 git pull（比如我有本地定制）怎么办？

A: 手动跑：
```bash
./scripts/backup.sh
docker compose pull
docker compose up -d
```

但注意：如果上游改了 `docker-compose.yml` / `.env.example`，你不 git pull 可能会拿到和本地 compose 不兼容的新镜像。

### Q: 升级时怎么跳过备份（已经单独备份过了）？

A: 暂时没有 flag。如果需要经常这样跑，可以自己改脚本把 Step 3 注释掉；或者在跑 upgrade.sh 之前，先确保 `scripts/backup.sh` 能快速完成（比如只增量备份）。
