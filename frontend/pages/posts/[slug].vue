<script setup lang="ts">
import { marked } from 'marked'

const route = useRoute()
const config = useRuntimeConfig()
const base = import.meta.server ? `${config.apiInternal}/api` : config.public.apiBase

interface Article {
  id: number
  title: string
  slug: string
  content: string
  excerpt?: string
  publishedDate?: string
  cover?: { url: string; alternativeText?: string } | null
}
interface TocItem { level: number; text: string; id: string }

const { data, error } = await useFetch<{ data: Article[] }>(
  `${base}/articles?filters[slug][$eq]=${route.params.slug}&populate=cover`,
)

const post = computed(() => data.value?.data?.[0])

const rendered = computed<{ html: string; toc: TocItem[] }>(() => {
  if (!post.value?.content) return { html: '', toc: [] }
  const raw = marked.parse(post.value.content) as string
  const list: TocItem[] = []
  const withIds = raw.replace(/<(h[23])>([\s\S]*?)<\/\1>/g, (_m, tag: string, inner: string) => {
    const plain = inner.replace(/<[^>]+>/g, '').trim()
    const id = `h-${list.length}`
    list.push({ level: tag === 'h2' ? 2 : 3, text: plain, id })
    return `<${tag} id="${id}">${inner}</${tag}>`
  })
  return { html: withIds, toc: list }
})
const html = computed(() => rendered.value.html)
const toc = computed(() => rendered.value.toc)

const { cfg, imgUrl } = useAdConfig()

useHead(() => ({
  title: post.value?.title ? `${post.value.title} · 我的博客` : '加载中',
  meta: [{ name: 'description', content: post.value?.excerpt || '' }],
}))
</script>

<template>
  <article v-if="post" class="post">
    <h1>{{ post.title }}</h1>
    <time v-if="post.publishedDate">
      {{ new Date(post.publishedDate).toLocaleDateString('zh-CN') }}
    </time>

    <AdSlot
      v-if="cfg.articleTopBanner?.enabled && cfg.articleTopBanner?.image"
      :type="cfg.articleTopBanner.type || 'banner'"
      :image="imgUrl(cfg.articleTopBanner.image)"
      :title="cfg.articleTopBanner.title"
      :desc="cfg.articleTopBanner.description"
      :cta="cfg.articleTopBanner.cta"
      :link="cfg.articleTopBanner.link"
    />

    <aside v-if="toc.length" class="toc-side">
      <div class="toc-inner">
        <h4>目录</h4>
        <ul>
          <li v-for="item in toc" :key="item.id" :class="`toc-l${item.level}`">
            <a :href="`#${item.id}`">{{ item.text }}</a>
          </li>
        </ul>
      </div>
    </aside>

    <div class="post-content" v-html="html" />

    <AdSlot
      v-if="cfg.articleBottomCard?.enabled && cfg.articleBottomCard?.image"
      :type="cfg.articleBottomCard.type || 'affiliate'"
      :image="imgUrl(cfg.articleBottomCard.image)"
      :title="cfg.articleBottomCard.title"
      :desc="cfg.articleBottomCard.description"
      :cta="cfg.articleBottomCard.cta"
      :link="cfg.articleBottomCard.link"
    />
  </article>
  <div v-else-if="error" class="err">加载失败：{{ error.message }}</div>
  <div v-else class="err">文章不存在</div>
</template>

<style scoped>
.post { padding: 2rem 0; }
.post h1 { font-size: 1.875rem; margin: 0 0 0.5rem; }
.post time { color: var(--muted); font-size: 0.875rem; }
.post-content { margin-top: 2rem; }
.post-content :deep(h2) { font-size: 1.375rem; margin-top: 2rem; scroll-margin-top: 5rem; }
.post-content :deep(h3) { font-size: 1.125rem; margin-top: 1.5rem; scroll-margin-top: 5rem; }
.post-content :deep(p) { margin: 1rem 0; }
.post-content :deep(img) { max-width: 100%; height: auto; border-radius: 6px; }
.post-content :deep(pre) { background: #1a1a1a; color: #f0f0f0; padding: 1rem;
  border-radius: 6px; overflow-x: auto; }
.post-content :deep(code) { font-family: 'SF Mono', Monaco, monospace; font-size: 0.875em; }
.post-content :deep(blockquote) { border-left: 3px solid var(--accent);
  margin: 1rem 0; padding: 0.5rem 1rem; color: var(--muted); background: #f5f5f5; }
.err { padding: 3rem; text-align: center; color: var(--muted); }

/* TOC：宽屏右侧 sticky，窄屏隐藏 */
.toc-side { display: none; }
@media (min-width: 1200px) {
  .toc-side {
    display: block;
    position: fixed;
    top: 6rem;
    left: calc(50% + 400px);
    width: 220px;
    max-height: calc(100vh - 8rem);
    overflow-y: auto;
    z-index: 10;
  }
  .toc-inner {
    padding: 1rem;
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 0.875rem;
  }
  .toc-inner h4 {
    margin: 0 0 0.75rem;
    font-size: 0.8125rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .toc-inner ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .toc-inner li { margin: 0.25rem 0; line-height: 1.4; }
  .toc-inner .toc-l3 { padding-left: 1rem; font-size: 0.8125rem; }
  .toc-inner a {
    color: var(--fg);
    text-decoration: none;
    display: block;
    padding: 0.25rem 0;
  }
  .toc-inner a:hover { color: var(--accent); }
}
</style>
