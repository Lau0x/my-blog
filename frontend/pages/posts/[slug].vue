<script setup lang="ts">
import mediumZoom, { type Zoom } from 'medium-zoom'
import { parseArticle } from '~/utils/markdown'

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

const { data, error } = await useFetch<{ data: Article[] }>(
  `${base}/articles?filters[slug][$eq]=${route.params.slug}&populate[cover]=true&populate[tags]=true`,
)

const post = computed(() => data.value?.data?.[0])

const rendered = computed(() => parseArticle(post.value?.content || ''))
const html = computed(() => rendered.value.html)
const toc = computed(() => rendered.value.toc)

// 预估阅读时间（中文 300 字/分，英文按单词粗算）
const readingTime = computed(() => {
  const text = (post.value?.content || '').replace(/<[^>]+>/g, '')
  const cjk = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  const words = (text.match(/[a-zA-Z]+/g) || []).length
  return Math.max(1, Math.ceil(cjk / 300 + words / 200))
})

const { cfg, imgUrl } = useAdConfig()

useHead(() => ({
  title: post.value?.title ? `${post.value.title} · 我的博客` : '加载中',
  meta: [{ name: 'description', content: post.value?.excerpt || '' }],
}))

// 代码块：给每个 .code-block 挂复制按钮
const contentRef = ref<HTMLElement | null>(null)

function decorateCodeBlocks() {
  if (!contentRef.value) return
  const blocks = contentRef.value.querySelectorAll<HTMLElement>('.code-block')
  blocks.forEach((block) => {
    if (block.dataset.decorated === '1') return
    block.dataset.decorated = '1'
    const lang = block.dataset.lang || 'text'

    // 语言标签
    const label = document.createElement('span')
    label.className = 'code-lang'
    label.textContent = lang
    block.appendChild(label)

    // 复制按钮
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'code-copy'
    btn.setAttribute('aria-label', '复制代码')
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span>复制</span>'
    btn.addEventListener('click', async () => {
      const code = block.querySelector('code')?.textContent || ''
      try {
        await navigator.clipboard.writeText(code)
        btn.classList.add('copied')
        btn.querySelector('span')!.textContent = '已复制'
        setTimeout(() => {
          btn.classList.remove('copied')
          btn.querySelector('span')!.textContent = '复制'
        }, 1600)
      } catch {
        btn.querySelector('span')!.textContent = '复制失败'
      }
    })
    block.appendChild(btn)
  })
}

// 图片点击放大（lightbox）
let zoomInstance: Zoom | null = null
function setupImageZoom() {
  if (!contentRef.value) return
  zoomInstance?.detach()
  const imgs = contentRef.value.querySelectorAll<HTMLImageElement>('img')
  zoomInstance = mediumZoom(imgs, {
    background: 'rgba(15, 17, 20, 0.92)',
    margin: 40,
    scrollOffset: 24,
  })
}

onMounted(() => {
  nextTick(() => {
    decorateCodeBlocks()
    setupImageZoom()
  })
})

watch(html, () => {
  nextTick(() => {
    decorateCodeBlocks()
    setupImageZoom()
  })
})

onBeforeUnmount(() => {
  zoomInstance?.detach()
  zoomInstance = null
})

// ====== Giscus 评论（GitHub Discussions 驱动）======
// 配置说明见 docs/deployment/comments.md（下一步补文档）
// 需要把下面几个常量改成你自己仓库的值，这里先用占位符
const giscusRepo = 'Lau0x/my-blog'
const giscusRepoId = ''               // TODO: https://giscus.app 生成
const giscusCategory = 'Announcements'
const giscusCategoryId = ''           // TODO: 同上
const giscusEnabled = computed(() => !!giscusRepoId && !!giscusCategoryId)

const giscusEl = ref<HTMLElement | null>(null)
onMounted(() => {
  if (!giscusEnabled.value || !giscusEl.value) return
  const s = document.createElement('script')
  s.src = 'https://giscus.app/client.js'
  s.async = true
  s.crossOrigin = 'anonymous'
  s.setAttribute('data-repo', giscusRepo)
  s.setAttribute('data-repo-id', giscusRepoId)
  s.setAttribute('data-category', giscusCategory)
  s.setAttribute('data-category-id', giscusCategoryId)
  s.setAttribute('data-mapping', 'pathname')
  s.setAttribute('data-strict', '0')
  s.setAttribute('data-reactions-enabled', '1')
  s.setAttribute('data-emit-metadata', '0')
  s.setAttribute('data-input-position', 'top')
  s.setAttribute('data-theme', 'light')
  s.setAttribute('data-lang', 'zh-CN')
  s.setAttribute('data-loading', 'lazy')
  giscusEl.value.appendChild(s)
})
</script>

<template>
  <article v-if="post" class="post">
    <header class="post-header">
      <h1 class="post-title">{{ post.title }}</h1>
      <div class="post-meta">
        <time v-if="post.publishedDate">
          {{ new Date(post.publishedDate).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }) }}
        </time>
        <span class="meta-sep">·</span>
        <span>约 {{ readingTime }} 分钟阅读</span>
      </div>
    </header>

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

    <div ref="contentRef" class="prose post-content" v-html="html" />

    <AdSlot
      v-if="cfg.articleBottomCard?.enabled && cfg.articleBottomCard?.image"
      :type="cfg.articleBottomCard.type || 'affiliate'"
      :image="imgUrl(cfg.articleBottomCard.image)"
      :title="cfg.articleBottomCard.title"
      :desc="cfg.articleBottomCard.description"
      :cta="cfg.articleBottomCard.cta"
      :link="cfg.articleBottomCard.link"
    />

    <!-- 评论区（Giscus） -->
    <section v-if="giscusEnabled" class="comments">
      <h3 class="comments-title">评论</h3>
      <div ref="giscusEl" class="giscus-container" />
    </section>
    <section v-else class="comments comments-disabled">
      <p>评论区未开启。配置 Giscus 后在本页启用。</p>
    </section>
  </article>
  <div v-else-if="error" class="err">加载失败：{{ error.message }}</div>
  <div v-else class="err">文章不存在</div>
</template>

<style scoped>
.post {
  padding: 2.5rem 0 3rem;
}

.post-header {
  margin-bottom: 2.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-soft);
}

.post-title {
  font-family: var(--font-serif);
  font-size: 2.25rem;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.015em;
  margin: 0 0 1rem;
  color: var(--fg);
}

.post-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--muted);
  font-size: 0.9rem;
}
.meta-sep { opacity: 0.5; }

.post-content {
  margin-top: 1rem;
}

.err {
  padding: 4rem 1rem;
  text-align: center;
  color: var(--muted);
}

/* 评论区 */
.comments {
  margin-top: 4rem;
  padding-top: 2rem;
  border-top: 1px solid var(--border-soft);
}
.comments-title {
  font-family: var(--font-serif);
  font-size: 1.35rem;
  font-weight: 600;
  margin: 0 0 1.25rem;
  color: var(--fg);
}
.comments-disabled p {
  color: var(--muted);
  font-size: 0.9rem;
  text-align: center;
  padding: 1.5rem;
  background: var(--bg-card);
  border: 1px dashed var(--border);
  border-radius: var(--radius);
}

/* TOC：宽屏右侧 sticky */
.toc-side { display: none; }
@media (min-width: 1200px) {
  .toc-side {
    display: block;
    position: fixed;
    top: 6rem;
    left: calc(50% + 390px);
    width: 230px;
    max-height: calc(100vh - 8rem);
    overflow-y: auto;
    z-index: 10;
  }
  .toc-inner {
    padding: 1.25rem;
    background: var(--bg-card);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius);
    box-shadow: var(--shadow-sm);
    font-size: 0.875rem;
  }
  .toc-inner h4 {
    margin: 0 0 0.875rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .toc-inner ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .toc-inner li {
    margin: 0.15rem 0;
    line-height: 1.5;
  }
  .toc-inner .toc-l3 {
    padding-left: 1rem;
    font-size: 0.8125rem;
  }
  .toc-inner a {
    color: var(--fg-soft);
    text-decoration: none;
    display: block;
    padding: 0.35rem 0.5rem;
    border-radius: 4px;
    transition: all 0.15s ease;
  }
  .toc-inner a:hover {
    color: var(--accent);
    background: var(--accent-alpha-lo);
  }
}
</style>
