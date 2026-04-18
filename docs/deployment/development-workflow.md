# 本地开发 → 生产发布工作流

博客上线后，你大概率还要不断迭代——改 UI、加字段、调逻辑。这份 SOP 描述"一次改动从本地到生产"的完整闭环。

适用场景：你已经按 [quick-start.md](./quick-start.md) 把博客跑起来了，现在要改点东西。

## 底层逻辑：一个循环，六个节点

```
    ┌─────────────────────────────────────────────────────┐
    │                                                     │
    ▼                                                     │
┌─────────┐  改代码    ┌─────────┐  push   ┌─────────┐   │
│ 本地 dev │──────────▶│ git     │────────▶│ GHCR     │   │
│ 环境    │           │ commit  │         │ 新镜像   │   │
└─────────┘           └─────────┘         └─────────┘   │
 localhost            (版本记录)          (3-5 分钟)     │
                                              │         │
                                              │ pull    │
                                              ▼         │
                                         ┌─────────┐   │
                                         │ 生产    │───┘
                                         │ 博客    │  下次迭代
                                         └─────────┘
```

**铁律**：所有改动**都在本地 dev 改**，都**走 git**，都**经 CI 构建**，最后**在服务器跑 upgrade**。
不跳过任何一步，不 SSH 进生产容器直接改。

---

## 五类改动 · 对应哪里改

| 改动类型 | 文件位置 | 怎么操作 | 要不要 migration |
|---------|---------|---------|-----------------|
| 前端 UI / 样式 / 组件 | `frontend/components/` `pages/` | 直接改代码 | ❌ |
| 前端路由 / composable | `frontend/composables/` | 直接改代码 | ❌ |
| 后端业务逻辑 | `backend/src/api/*/controllers/` `services/` | 直接改代码 | ❌ |
| **Strapi Schema**（加字段、新 collection） | `backend/src/api/*/content-types/*/schema.json` | 本地 admin CTB 点击操作（自动写回 json） | ⚠️ 可空字段无需；破坏性需手动 SQL |
| Strapi 配置 / plugin | `backend/config/*.ts` | 直接改代码 | ❌ |

---

## 标准迭代六步（每次改都走这条）

### Step 1 · 起本地 dev 栈

```bash
cd /path/to/my-blog
./scripts/dev.sh up -d --build        # ⭐ 每次都加 --build（Nuxt 代码是 build-time 打镜像的）
```

> **为什么永远带 `--build`**：Nuxt 没有 volume mount 热重载，前端改动必须重新 build 才会生效。Docker layer cache 会让没改的部分几秒跳过，加了绝不亏。
>
> `dev.sh` 是 `docker compose -f base -f build -f local` 三合一封装，其他子命令（down / logs / exec 等）都透传。直接敲 `./scripts/dev.sh`（无参数）会打印 cheatsheet。

访问：

- **Strapi admin**: http://localhost:1337/admin  （Content-Type Builder **解锁**，可编辑 schema）
- **Nuxt 前台**: http://localhost:3001  （注意是 3001，避开常见 3000 冲突）

> ⚠️ 本地用的是**独立的** Postgres 容器（`./data/postgres/`），和生产不是同一个库——第一次进本地 admin 要重新注册账号。

### Step 2 · 本地改

| 改动对象 | 怎么做 | 热重载 |
|---------|--------|--------|
| 前端 Vue 文件 | 直接编辑 `frontend/` 下文件 | ✅ Nuxt 自动重载 |
| 后端逻辑 | 直接编辑 `backend/src/api/*` | ✅ Strapi dev 模式自动重启 |
| **Schema** | 浏览器进 admin CTB → 加/改字段 → Save | ✅ Strapi 自动写回本地 `schema.json` |
| Strapi 配置 | 改 `backend/config/*.ts` | ✅ 自动重启 |

Schema 改动的关键点：**你在浏览器里点的操作，Strapi 会自动把结果写回本地 `backend/src/api/<name>/content-types/<name>/schema.json` 文件**（通过 docker volume 挂载）。所以改完 git status 能看到改动。

### Step 2.5 · 图片策略（新文章正文里带图的场景）

文章 content 里的图片（markdown `![]()` 或 HTML `<img>`）有**两条路径**，你发文后选一条：

- **🅰 保持外链（默认，零配置）**：粘贴来的 `![](https://files.mdnice.com/xxx.png)` 直接用，前端已加 `referrerpolicy="no-referrer"` 绕过防盗链
- **🅱 本地化**：发完文章后跑 `node scripts/migrate-images.mjs`，外链图自动下载到 Strapi Media Library，content 的 URL 被替换成 `/uploads/xxx.jpg`

详见 [image-migration.md](./image-migration.md)。

### Step 3 · 本地 smoke test

- admin 能登录
- 新字段/新功能在 admin 和前台都能用
- 核心流程（发文 → 前台可见）跑通

### Step 4 · git commit + push

```bash
git status                           # 看改了啥
git diff backend/src/ frontend/      # 详细看
git add backend/ frontend/
git commit -m "feat: <改了啥>"
git push origin main
```

### Step 5 · 等 CI 构建

去 `https://github.com/<your-user>/my-blog/actions` 看 workflow，约 3-5 分钟后 GHCR 上 `:latest` 更新。

### Step 6 · 生产同步

```bash
ssh <博客服务器>
cd /path/to/blog
./scripts/upgrade.sh
```

`upgrade.sh` 会自动完成：备份 .env / 备份数据 / git pull / 字段对齐检查 / 拉新镜像 / 重启 / 输出回滚指引。详见 [upgrade.md](./upgrade.md)。

---

## 破坏性 Schema 改动（需要警惕）

**破坏性** = 删字段 / 改字段类型 / 重命名字段 / 改关系（有数据的）。

Strapi 启动**不会自动迁移老数据**。标准流程：

1. **本地**：改完 schema 后，手写对应的 SQL migration（例如 `ALTER TABLE articles DROP COLUMN ...`）
2. **本地 smoke test**：数据迁移后功能正常
3. **生产**：`./scripts/backup.sh`（务必备份，破坏性操作不可逆）
4. **生产**：进 Postgres 容器跑 SQL migration
   ```bash
   docker compose exec postgres psql -U blog -d blog -f /path/to/migration.sql
   ```
5. **生产**：`./scripts/upgrade.sh`（拉新镜像 + 重启）

**非破坏性**（加可空字段、加新 collection、加 component）走普通六步即可，Strapi 启动时会自动 ALTER TABLE 加列。

## 决策表：这次改动是破坏性吗？

| 改动 | 破坏性 | 需要 migration |
|------|--------|--------------|
| 加一个 nullable 字段 | ❌ | 无 |
| 加一个 required 字段（没默认值） | ⚠️ | 要先给老数据填默认值再加 NOT NULL |
| 加一个 required 字段（有默认值） | ❌ | Strapi 自动处理 |
| 加一个新的 Collection Type | ❌ | 无 |
| 加一个新的 Component | ❌ | 无 |
| 删一个字段 | ✅ | 要 DROP COLUMN |
| 改字段类型 | ✅ | 要 ALTER + 可能要数据转换 |
| 重命名字段 | ✅ | 要 RENAME + 更新前端引用 |
| 字段类型从 `json` → `component` | ✅ | 要 DROP COLUMN + 重启 Strapi（见下文案例） |

---

## 实战案例：tags 字段从 JSON 升级为 Repeatable Component

**背景**：一开始 `tags` 字段用 `"type": "json"` 存，admin 是黑色 Monaco 编辑器，要手打 `["医路", "思考"]` 这种 JSON 数组——对非程序员不友好。升级成 Repeatable Component 后，admin 变成点 **+ Add an entry** 加一个 `name` 输入框的交互，小白也能用。

**踩坑过程**（真实的 3.25 → 3.75）：

1. 以为改完 `schema.json` 里 `"type": "json"` → `"type": "component"` 就完事了——Strapi 重启了，日志说 `started successfully`
2. admin 里还是 JSON 编辑器！以为是浏览器缓存，硬刷新无效
3. 直接查 DB：`articles.tags` **还是 jsonb 列**，但 `components_shared_tags` 和 `articles_cmps` 关联表已经建好
4. 根因：**Strapi 5 对破坏性 schema 变更自我保护——新 component 的空表建了，但老 jsonb 列不敢 DROP**，admin 渲染时以 DB 为准就回退到 JSON UI

**解法（3 步闭环）**：

```bash
# ① 先备份（这步做完才敢往下）
./scripts/backup.sh    # 或本地 dev: docker compose exec postgres pg_dump -U blog blog > /tmp/before.sql

# ② 手动 DROP 老列
docker compose exec postgres psql -U blog -d blog -c "ALTER TABLE articles DROP COLUMN tags;"

# ③ 重启 Strapi（它检测到没有老列，按新 schema 建关联）
docker compose restart strapi
```

**验证闭环**（三层证据都要查）：

```bash
# ✓ 新 component 表存在
docker compose exec postgres psql -U blog -d blog -c "\dt components_shared_*"

# ✓ articles_cmps 关联表存在（Strapi 5 component 的核心桥梁）
docker compose exec postgres psql -U blog -d blog -c "\dt articles_cmps"

# ✓ articles 表里老 tags 列已消失
docker compose exec postgres psql -U blog -d blog -c "\d articles" | grep -i tag || echo "OK: no tag column"
```

三个都过 = 端到端闭环。admin 硬刷新后 tags 字段会变成 **+ Add an entry** 按钮。

**前端兼容**：index.vue 和 [slug].vue 已用 `tagText(t) = typeof t === 'string' ? t : t.name` 同时兼容新旧格式，无需改代码。但接口返回会从 `tags: ["医路"]` 变成 `tags: [{id: 1, name: "医路"}]`，之前在 JSON 字段里填过的 tag 会全部丢失需要手动重填。

**生产升级特别注意**：上生产前先 `backup.sh`，然后先跑 SQL `ALTER TABLE articles DROP COLUMN tags`，**再跑** `upgrade.sh`。顺序颠倒会出现短暂的 schema/DB 不一致窗口。

---

## 四个常见陷阱（别踩）

| ❌ 错误操作 | 为什么不行 | ✅ 正确做法 |
|-----------|-----------|-----------|
| SSH 进生产容器直接改代码 | 容器重启就丢 + 和 git 脱节 | 所有改动都在本地 dev 改，走 git |
| 在生产 admin 里改 Content-Type Builder | Strapi prod 模式禁用（按设计） | 本地 dev 模式改，commit 到 `backend/src/` |
| 本地改完不 commit 就手动 scp 到服务器 | 下次 `upgrade.sh` 会被 git pull 覆盖 | 所有改动 commit 到仓库，CI 出镜像 |
| 破坏性 schema 改动直接 push | 生产老数据可能丢 / 启动崩溃 | 先本地写 migration，生产先备份，再升级 |

---

## 调试 Cheatsheet

```bash
# === 日志 ===
docker compose logs -f strapi              # 后端日志
docker compose logs -f nuxt                # 前端日志
# 浏览器 F12 → Console / Network（前端运行时）

# === 进容器内 ===
docker compose exec strapi sh              # Strapi shell
docker compose exec postgres psql -U blog -d blog  # SQL 直接访问

# === 单服务重启（改配置后）===
docker compose restart strapi
docker compose restart nuxt

# === 查看容器状态 + 端口 ===
docker compose ps

# === 本地完全清干净重来（小心，会丢本地数据）===
docker compose down -v
rm -rf data/postgres data/uploads
./scripts/init.sh
# 然后 Step 1 重新起
```

---

## 回滚预案（出事了怎么救）

| 问题严重度 | 恢复动作 |
|-----------|---------|
| 仅配置改错 | `mv .env.bak-<最近> .env && docker compose restart` |
| 新镜像有 bug | `.env` 里把 `IMAGE_TAG` 锁到上一个版本 SHA（GHCR 上有）+ `docker compose up -d` |
| schema 改坏数据 | `docker compose stop strapi nuxt` → 从 backup 恢复 SQL → 重启 |
| 彻底回滚到上一个 commit | `git reset --hard <上一个 commit>` + `docker compose pull` + `up -d` |

详见 [upgrade.md · 回滚预案](./upgrade.md#回滚预案最关键的那一条)。

---

## 一张图总结"改动 → 上线"的时间成本

| 阶段 | 你做的事 | 耗时 |
|------|---------|------|
| 本地 dev 起 | 跑 docker compose up | ~2 分钟首次，之后秒起 |
| 改代码 + 本地验证 | 取决于改动大小 | ~10 分钟 - 几小时 |
| commit + push | 几条 git 命令 | ~30 秒 |
| CI 构建 | 等 GitHub Actions | ~3-5 分钟 |
| 生产同步 | `./scripts/upgrade.sh` | ~1-2 分钟 |
| **总计（小改动）** | | **~15 分钟从想法到上线** |

---

## 未来优化方向（可选 TODO）

- `scripts/dev.sh` 封装本地启动命令（现在三行 `-f` 可以压成 `./scripts/dev.sh up -d --build`）
- `scripts/migrate.sh` 封装"运行 SQL migration + upgrade.sh"两步
- 生产环境 `IMAGE_TAG` 从 `:latest` 切到具体 SHA，防止被动同步风险（详见 [upgrade.md · Pin 版本策略](./upgrade.md#生产环境的-pin-版本策略)）
- CI workflow 多打一个 `:sha-<commit_sha>` tag，方便精确回滚

这些不是必须，随时按需加。
