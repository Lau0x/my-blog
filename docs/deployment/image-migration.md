# 图片策略：外链 vs 本地化

> 你在 Strapi 里写文章的时候，正文里的图片有**两种来源**。本博客 **两种都支持**，你根据场景选。

## 先做决策（三种模式）

| 模式 | 适合谁 | 需要做啥 | 长期稳定性 |
|------|-------|---------|----------|
| **🅰 保持外链（默认）** | 图少、图床稳定、懒得折腾 | 什么都不用做。前端已加 `referrerpolicy="no-referrer"` 兜底，绕过大部分防盗链 | ⚠️ 依赖外部 CDN |
| **🅱 一次性本地化** | 刚迁移博客过来，想把外链图一次清干净 | 跑 `node scripts/migrate-images.mjs`（见下方步骤） | ✅ 自主可控 |
| **🅲 定时自动本地化** | 长期严肃运营，发文频繁，外链多 | crontab 定时跑 migrate 脚本（如每天凌晨 3 点） | ✅ 自主可控 + 自动化 |

**默认就是 🅰**。只有你**决定**要本地化才需要往下看 🅱 🅲。

## 为什么会有这两种路径

- **🅰 外链 + referrerpolicy**（零配置）：文章里写 `![](https://files.mdnice.com/xxx.png)`，浏览器不发 Referer，绕过 99% 的防盗链。但万一图床挂了/改政策，你的博客跟着挂。
- **🅱🅲 本地化**：跑一次 `migrate-images.mjs`，外链图全部下载到 Strapi Media Library，content 里的 URL 替换成 `/uploads/xxx.jpg`。图片存在你自己的服务器，完全自主。

## 🅱 一次性本地化（用法）

> 避免博客长期依赖第三方图床（mdnice/微信/简书/CSDN 等）——图床挂了你博客的图全挂。一键把文章里的外链图下载到 Strapi Media Library，content 里的 URL 自动替换成本地的 `/uploads/xxx.jpg`。

## 用法（3 步）

### Step 1 · 生成 Strapi API Token

1. 打开 Strapi admin（本地 dev `http://localhost:1337/admin` 或生产）
2. **Settings → API Tokens → Create new API Token**
3. 填：
   - **Name**: `migrate-images`
   - **Token duration**: Unlimited（或你想要的）
   - **Token type**: **Full access**
4. 点 Save，**复制显示的 token**（只显示一次）

### Step 2 · 配置环境变量

项目根目录创建 `.migrate-env`（`.gitignore` 已自动忽略，不会进仓库）：

```bash
STRAPI_URL=http://localhost:1337
STRAPI_TOKEN=<上一步复制的 token>
```

### Step 3 · 跑脚本

```bash
cd /path/to/my-blog

# 先 dry-run 看要改什么（不实际修改数据）
node scripts/migrate-images.mjs --dry-run

# 确认没问题，正式执行
node scripts/migrate-images.mjs
```

输出示例：

```
=== migrate-images ===
Strapi:  http://localhost:1337
Cache:   .migrate-cache.json (0 条)

共 5 篇文章

📄 周刊168 (slug=168, 11 张外链图)
  ✓ https://files.mdnice.com/user/2606/4ad153ef-...png
      → /uploads/4ad153ef_d228_4ffb_8dce_3976f19a9695.png
  ✓ https://files.mdnice.com/user/2606/0143f89f-...png
      → /uploads/0143f89f_6b84_4e06_abb9_be03a9edfaf3.png
  ...

=== 完成 ===
外链图片:   处理 47 张 | ✓ 47 成功 | ✗ 0 失败
文章更新:   3 / 5 篇
缓存文件:   .migrate-cache.json（下次运行自动跳过已迁移的 URL）
```

## 跑完之后

Strapi admin → **Media Library** 里能看到新上传的图片。文章前台刷新，图片已经走本站 `/uploads/`，不再依赖外部 CDN。

⚠️ **原始外链图片并没被删**——仍然存在原 CDN，只是你博客的 content 不再引用它们了。如果你想验证：随便打开一篇文章 → F12 Network → 过滤 img → 所有图 URL 应该都是 `blog.yourdomain.com/uploads/...`，不再出现 `files.mdnice.com` 之类。

## 幂等 + 断点续跑

- **URL 缓存**：脚本维护 `.migrate-cache.json`，记录 "外链 URL → 本地路径"
- 同一张图在多篇文章里出现 → 只下载+上传**一次**，其他地方复用
- 中途 Ctrl+C 中断 → 重跑 **续从上次断点**，已处理的不重复
- 某张图挂了（如 CDN 404）→ 记日志跳过，**不阻塞**其他图；下次再跑自动重试

## 🅲 定时自动本地化（crontab）

如果长期运营，想让"发文后自动本地化"完全自动化，最简单的办法是 **crontab 定时跑**：

```bash
crontab -e
# 加一行（每天 3:00 跑）
0 3 * * * cd /path/to/my-blog && node scripts/migrate-images.mjs >> /var/log/blog-migrate.log 2>&1
```

优点：
- 发文速度不受影响（脚本离线跑，不阻塞 Strapi）
- 失败可查日志（`/var/log/blog-migrate.log`）
- 幂等：已迁移的不重复下载（有缓存）

不推荐的替代方案：**Strapi lifecycle hook**。理由——发文同步调用会被 CDN 抽风阻塞、debug 难、改 backend 要走 CI。crontab 方案已经覆盖 99% 场景。

## 常见问题

### 外链图失败怎么办

脚本会在日志里标红，**不影响其他图和其他文章**。失败可能原因：

- 源 CDN 返回 404 / 403 / 超时
- 图片太大（Strapi 有 body 上限，默认 50MB）
- 认证问题（脚本没发 Referer，但有些 CDN 检查 UA / 其他 header）

手动检查：

```bash
# 原图能不能打开
curl -I <外链 URL>

# 脚本重跑（失败的会重试）
node scripts/migrate-images.mjs
```

### 能否单独迁移一篇文章

当前脚本迁所有。要单篇，改 `fetchAllArticles` 加 filter，或者直接跑 dry-run 看范围。

### 迁移后怎么回滚

不建议回滚——外链可能已挂。如果**必须**：
- 保留 `.migrate-cache.json`（URL 映射）
- 手动写个反向脚本：把 `/uploads/xxx.jpg` 换回 `原 URL`
- 或者从 git 历史恢复 content（但 content 在 DB 不在 git，需要从 backup.sh 的 SQL dump 恢复）

**最佳实践**：跑脚本前先 `./scripts/backup.sh` 备份一次 postgres，出问题可以整体回滚。

### 迁移后 Strapi Media Library 里能找到这些图吗

可以。所有图都走标准 Strapi Upload Plugin，在 Media Library 能搜到、能删、能替换。Strapi 会自动生成缩略图（thumbnail / small / medium / large 各尺寸），前端 cover 字段就是从这里拿格式。

## 安全

- `.migrate-env`（含 API token）**不入库**，`.gitignore` 已配
- `.migrate-cache.json`（URL 映射缓存）**不入库**
- 跑完生产环境后建议 **revoke 这个 API token**（Strapi admin → Settings → API Tokens → 点删除），下次需要再新建。
