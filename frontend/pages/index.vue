<script setup lang="ts">
const config = useRuntimeConfig()
const base = import.meta.server ? `${config.apiInternal}/api` : config.public.apiBase

interface TagItem { id?: number; name: string }
interface Article {
  id: number
  documentId: string
  title: string
  slug: string
  excerpt?: string
  publishedDate?: string
  // 兼容两种存储格式：JSON 字符串数组 OR Repeatable Component 对象数组
  tags?: Array<string | TagItem> | null
  cover?: {
    url: string
    alternativeText?: string
    formats?: {
      small?: { url: string }
      medium?: { url: string }
      large?: { url: string }
    }
  } | null
}

const { data, error } = await useFetch<{ data: Article[] }>(
  `${base}/articles?populate[cover]=true&populate[tags]=true&sort=publishedDate:desc&pagination[pageSize]=20`,
)

const { cfg, imgUrl } = useAdConfig()

// 封面图 URL（选中尺寸的，加站点 URL 前缀）
function coverUrl(post: Article): string | null {
  if (!post.cover) return null
  const best = post.cover.formats?.large?.url ||
               post.cover.formats?.medium?.url ||
               post.cover.url
  return imgUrl(best)
}

// 英文日期格式：November 8, 2025
function formatDate(dateStr?: string): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// 标签：兼容 string 或 {id, name} 两种格式
function tagText(t: string | TagItem): string {
  return typeof t === 'string' ? t : (t?.name ?? '')
}
function tagKey(t: string | TagItem, i: number): string | number {
  return typeof t === 'string' ? `${t}-${i}` : (t?.id ?? `${t?.name}-${i}`)
}
</script>

<template>
  <div>
    <AdSlot
      v-if="cfg.homeTopBanner?.enabled && cfg.homeTopBanner?.image"
      :type="cfg.homeTopBanner.type || 'banner'"
      :image="imgUrl(cfg.homeTopBanner.image)"
      :title="cfg.homeTopBanner.title"
      :desc="cfg.homeTopBanner.description"
      :cta="cfg.homeTopBanner.cta"
      :link="cfg.homeTopBanner.link"
    />

    <div v-if="error" class="err">
      加载失败：{{ error.message }}
    </div>

    <div v-else-if="!data?.data?.length" class="empty">
      <p>还没有文章</p>
      <a :href="`${config.public.siteUrl}/admin`" class="empty-cta">去后台发一篇 →</a>
    </div>

    <ul v-else class="post-list">
      <template v-for="(post, i) in data.data" :key="post.id">
        <li class="post-item">
          <NuxtLink :to="`/posts/${post.slug}`" class="post-link" :class="{ 'has-cover': !!coverUrl(post) }">
            <div
              v-if="coverUrl(post)"
              class="post-cover-bg"
              :style="{ backgroundImage: `url('${coverUrl(post)}')` }"
              aria-hidden="true"
            />
            <div class="post-body">
              <time v-if="post.publishedDate" class="post-date">
                {{ formatDate(post.publishedDate) }}
              </time>
              <h2 class="post-title">{{ post.title }}</h2>
              <p v-if="post.excerpt" class="post-excerpt">{{ post.excerpt }}</p>
              <div v-if="post.tags?.length" class="post-tags">
                <span
                  v-for="(tag, i) in post.tags"
                  :key="tagKey(tag, i)"
                  class="tag"
                >{{ tagText(tag) }}</span>
              </div>
            </div>
          </NuxtLink>
        </li>
        <li v-if="(i + 1) % 3 === 0 && cfg.adsenseClient && cfg.adsenseHomeSlot" class="ad-row">
          <AdSlot
            type="adsense"
            :client="cfg.adsenseClient"
            :slot="cfg.adsenseHomeSlot"
          />
        </li>
      </template>
    </ul>

    <AdSlot
      v-if="cfg.homeBottomCard?.enabled && cfg.homeBottomCard?.image"
      :type="cfg.homeBottomCard.type || 'affiliate'"
      :image="imgUrl(cfg.homeBottomCard.image)"
      :title="cfg.homeBottomCard.title"
      :desc="cfg.homeBottomCard.description"
      :cta="cfg.homeBottomCard.cta"
      :link="cfg.homeBottomCard.link"
    />
  </div>
</template>

<style scoped>
.post-list {
  list-style: none;
  padding: 0;
  margin: 2.5rem 0 0;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.post-item {
  margin: 0;
}

.post-link {
  position: relative;
  display: block;
  min-height: 180px;
  padding: 2rem 2.25rem;
  border-radius: 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-soft);
  color: inherit;
  text-decoration: none;
  overflow: hidden;
  transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
}

.post-link:hover {
  transform: translateY(-2px);
  border-color: var(--border);
  box-shadow: var(--shadow-lg);
}

/* 背景封面：撑满整张卡片，上面再盖一层从左到右的白色渐变 */
.post-cover-bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  z-index: 0;
}
/* 白色渐变遮罩：左侧几乎全白（保护文字可读），右侧约 60% 白（让图若隐若现） */
.post-cover-bg::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to right,
    rgba(255, 255, 255, 0.97) 0%,
    rgba(255, 255, 255, 0.94) 25%,
    rgba(255, 255, 255, 0.78) 55%,
    rgba(255, 255, 255, 0.55) 85%,
    rgba(255, 255, 255, 0.5) 100%
  );
}

/* 内容层 */
.post-body {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  max-width: 100%;
}
/* 有封面时压缩文字区，避免贴到右侧图清晰部分 */
.post-link.has-cover .post-body {
  max-width: 62%;
}

.post-date {
  font-family: var(--font-sans);
  font-size: 0.85rem;
  color: var(--muted);
  letter-spacing: 0.02em;
  font-weight: 400;
}

.post-title {
  font-family: var(--font-sans);
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: -0.01em;
  color: var(--fg);
  margin: 0;
  transition: color 0.15s ease;
}

.post-link:hover .post-title {
  color: var(--accent);
}

.post-excerpt {
  color: var(--fg-soft);
  font-size: 0.95rem;
  line-height: 1.65;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 标签胶囊 */
.post-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.5rem;
}

.tag {
  display: inline-block;
  padding: 0.2rem 0.75rem;
  font-size: 0.78rem;
  color: var(--fg-soft);
  background: var(--bg-code);
  border: 1px solid var(--border);
  border-radius: 999px;
  font-weight: 500;
  letter-spacing: 0.02em;
  transition: all 0.15s ease;
}
.post-link:hover .tag {
  background: var(--accent-alpha-lo);
  border-color: var(--accent-alpha-mid);
  color: var(--accent);
}

/* 窄屏：封面图降成底部 banner 或隐藏 */
@media (max-width: 640px) {
  .post-link {
    padding: 1.5rem 1.5rem;
    min-height: auto;
  }
  .post-cover,
  .post-cover-mask {
    display: none;
  }
  .post-link.has-cover .post-body {
    max-width: 100%;
  }
}

/* 广告行 */
.ad-row {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0;
}

/* 空/错误态 */
.err,
.empty {
  padding: 4rem 2rem;
  text-align: center;
  color: var(--muted);
  background: var(--bg-card);
  border-radius: 16px;
  border: 1px solid var(--border-soft);
  margin: 2rem 0;
}

.empty p { margin: 0 0 1rem; font-size: 1.05rem; }

.empty-cta {
  display: inline-block;
  padding: 0.6rem 1.25rem;
  background: var(--accent);
  color: #fff;
  border-radius: 10px;
  font-weight: 500;
  transition: all 0.2s ease;
}
.empty-cta:hover {
  background: var(--accent-hover);
  color: #fff;
  transform: translateY(-1px);
  box-shadow: var(--shadow);
}
</style>
