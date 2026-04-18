# 评论区配置（Giscus）

博客用 [Giscus](https://giscus.app) 做评论——把 GitHub Discussions 当作评论数据库。零后端维护、支持 Markdown、免费、无广告。

## 为什么选 Giscus

| 方案 | 优点 | 缺点 |
|------|------|------|
| **Giscus**（已集成） | 免费 / 无广告 / 支持 Markdown / GitHub 登录 | 评论者需要 GitHub 账号 |
| Disqus | 社交功能多 | 广告多、加载慢、隐私争议 |
| Waline | 自部署，登录方式灵活 | 需要另外跑后端+数据库 |
| Strapi 自建 | 完全可控 | 要写权限、反垃圾、审核逻辑 |

## 一次性配置（3 步）

### Step 1. GitHub 仓库开启 Discussions

1. GitHub → `Lau0x/my-blog` → **Settings** → **General**
2. 滚到 **Features** 区块
3. 勾选 **☑ Discussions**

### Step 2. 安装 Giscus app

1. 打开 https://github.com/apps/giscus
2. 点 **Install**
3. 选 **Only select repositories**
4. 勾选 `my-blog`，点 **Install**

### Step 3. 到 giscus.app 获取 repoId/categoryId

1. 打开 https://giscus.app
2. **Repository** 框里填 `Lau0x/my-blog`，会自动校验
3. **Page ↔ Discussions Mapping** 选 **pathname**
4. **Discussion Category** 选 **Announcements**（推荐——只有 maintainer 能开新 discussion，防止误建）
5. **Features** 建议：
   - ✅ Enable reactions for the main post
   - ❌ Emit discussion metadata（不需要）
   - **Place the comment box above the comments**（推荐）
   - Load the comments **lazily**
6. **Theme** 选 **Light**
7. 滚到页面下方 "Enable giscus" 区块，会看到一段生成的 `<script>` 代码，从里面复制两个值：
   ```
   data-repo-id="R_kgDO..."        ← 复制这个
   data-category-id="DIC_kwDO..."  ← 和这个
   ```

### Step 4. 填到前端代码

编辑 [frontend/pages/posts/[slug].vue](../../frontend/pages/posts/[slug].vue)，找到这段：

```ts
const giscusRepo = 'Lau0x/my-blog'
const giscusRepoId = ''               // TODO: https://giscus.app 生成
const giscusCategory = 'Announcements'
const giscusCategoryId = ''           // TODO: 同上
```

把 `giscusRepoId` 和 `giscusCategoryId` 改成 Step 3 拿到的值。

## 验证

1. 本地 `npm run dev` 跑起来
2. 打开任何一篇文章页
3. 文章末尾应出现"评论"区块，加载 Giscus iframe
4. 用 GitHub 账号登录后发一条测试评论

## 常见坑

### "未开启 Discussions" 报错

→ 回 Step 1 确认仓库的 Discussions 开着。

### Giscus iframe 报 "Repository not configured"

→ Step 2 的 Giscus app 没安装到这个仓库，回 Step 2 重新授权。

### 评论和文章路径不对齐

Giscus 默认用 `pathname` 做映射——意味着 `/posts/168` 和 `/posts/168/` 会被认为是**不同的**讨论。如果你的 URL 有尾斜线策略变动，以前的评论可能"消失"（其实还在 GitHub Discussions 里，只是映射断开）。修复：

- 在 giscus 配置里选 **specific term** 或 **og:url**
- 或在文章页设置 `useHead({ link: [{ rel: 'canonical', href: ... }] })`，保持 URL 一致

## 安全

- Giscus 的 script 来自 `https://giscus.app`，Strapi 的 CSP（如果你自定义过）要允许 `script-src giscus.app; frame-src giscus.app;`
- 评论数据**存在 GitHub Discussions 里**，不走你服务器——服务端 0 风险面

## 关闭评论区

把 [slug].vue 里：

```ts
const giscusEnabled = computed(() => !!giscusRepoId && !!giscusCategoryId)
```

改成：

```ts
const giscusEnabled = computed(() => false)
```

就完全隐藏评论 UI。
