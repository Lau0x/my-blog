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

如果是镜像层面的问题（新版 bug），需要把镜像 tag 锁到上一个已知好版本：

1. **先把镜像 pin 成具体 tag**（不要用 `:latest`）
   - 去 GitHub Packages 找上一个版本的 tag（例如 commit SHA `d8c206a` 对应的镜像）
   - 改 `.env`：
     ```
     IMAGE_TAG=sha-d8c206a   # 或具体版本号
     ```

2. **回滚代码**
   ```bash
   git reset --hard <上一个已知好的 commit>
   ```

3. **重启**
   ```bash
   docker compose up -d
   ```

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

## 生产环境的 Pin 版本策略

默认 `IMAGE_TAG=latest` 适合快速尝鲜，不适合严肃生产环境——因为：
- `:latest` 会被 CI 持续覆盖，无法快速定位"哪个版本引入了 bug"
- 无法做精确回滚（`:latest` 的历史版本不可访问）
- 多机部署时可能拉到不同版本（时间差导致）

**严肃生产**建议：

1. CI workflow 改成**按 commit SHA 和语义化版本双重打 tag**（如 `sha-abc1234`、`v1.2.0`）
2. 服务器 `.env` 里 pin 具体 tag：
   ```
   IMAGE_TAG=v1.2.0
   ```
3. 升级时手动改 `.env` 的 `IMAGE_TAG` 到新版本，而不是 `:latest` 跑 pull
4. 保留近 3-5 个老版本 tag 以备回滚

这套做法让升级/回滚变成**确定性**操作——任何时刻你都知道跑的是哪个版本。

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
