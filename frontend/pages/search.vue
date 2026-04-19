<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const config = useRuntimeConfig()
const base = import.meta.server ? `${config.apiInternal}/api` : config.public.apiBase

const { siteName } = useSiteConfig()

// 初始 q / type 取自 URL
const initialQ = (route.query.q as string) || ''
const initialType = (['all', 'articles', 'notes'].includes(route.query.type as string)
  ? route.query.type
  : 'all') as 'all' | 'articles' | 'notes'

const q = ref(initialQ)
const type = ref<'all' | 'articles' | 'notes'>(initialType)

// debounce：用户在输入框里 300ms 没动静才真触发 fetch
const debouncedQ = ref(initialQ)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function syncUrl() {
  const query: Record<string, string> = {}
  if (debouncedQ.value) query.q = debouncedQ.value
  if (type.value !== 'all') query.type = type.value
  router.replace({ query })
}

watch(q, (v) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debouncedQ.value = v.trim()
    syncUrl()
  }, 300)
})

watch(type, () => {
  syncUrl()
})

interface Article {
  id: number
  title: string
  slug: string
  excerpt?: string
  publishedDate?: string
}
interface Note {
  id: number
  content: string
  publishedDate?: string
  publishedAt?: string
  createdAt?: string
}

// 文章搜索：title OR excerpt OR content
const articlesUrl = computed(() => {
  if (!debouncedQ.value) return ''
  const qs = encodeURIComponent(debouncedQ.value)
  return `${base}/articles?filters[$or][0][title][$containsi]=${qs}&filters[$or][1][excerpt][$containsi]=${qs}&filters[$or][2][content][$containsi]=${qs}&sort=publishedDate:desc&pagination[pageSize]=20&fields[0]=title&fields[1]=slug&fields[2]=excerpt&fields[3]=publishedDate`
})
const { data: articleData } = await useFetch<{ data: Article[] }>(
  articlesUrl,
  { key: () => `search-articles-${debouncedQ.value}`, watch: [debouncedQ] },
)
const articles = computed<Article[]>(() => debouncedQ.value ? (articleData.value?.data ?? []) : [])

// 说说搜索：content
const notesUrl = computed(() => {
  if (!debouncedQ.value) return ''
  const qs = encodeURIComponent(debouncedQ.value)
  return `${base}/notes?filters[content][$containsi]=${qs}&sort=publishedDate:desc&pagination[pageSize]=20&fields[0]=content&fields[1]=publishedDate&fields[2]=publishedAt`
})
const { data: noteData } = await useFetch<{ data: Note[] }>(
  notesUrl,
  { key: () => `search-notes-${debouncedQ.value}`, watch: [debouncedQ] },
)
const notes = computed<Note[]>(() => debouncedQ.value ? (noteData.value?.data ?? []) : [])

const totalCount = computed(() => articles.value.length + notes.value.length)

// 当前 tab 下是否有结果
const hasResults = computed(() => {
  if (type.value === 'articles') return articles.value.length > 0
  if (type.value === 'notes') return notes.value.length > 0
  return totalCount.value > 0
})

const showArticles = computed(() => type.value === 'all' || type.value === 'articles')
const showNotes = computed(() => type.value === 'all' || type.value === 'notes')

useHead(() => ({
  title: debouncedQ.value ? `搜索「${debouncedQ.value}」 · ${siteName.value}` : `搜索 · ${siteName.value}`,
}))

// 简单 highlight：把匹配词包成 <mark>
function highlight(text: string, keyword: string): string {
  if (!text || !keyword) return text
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>')
}

// 说说 content 预览：去 markdown 标记 + 截前 200 字符 + 高亮
function notePreview(content: string): string {
  const plain = content.replace(/[#*>`_~\[\]()]/g, '').replace(/\n+/g, ' ').trim()
  const snippet = plain.slice(0, 200) + (plain.length > 200 ? '…' : '')
  return highlight(snippet, debouncedQ.value)
}

function articlePreview(a: Article): string {
  const text = a.excerpt || ''
  return highlight(text.slice(0, 200) + (text.length > 200 ? '…' : ''), debouncedQ.value)
}

function articleTitle(a: Article): string {
  return highlight(a.title, debouncedQ.value)
}

function formatDate(ts?: string): string {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('zh-CN')
}
</script>

<template>
  <div class="search-page">
    <header class="search-header">
      <h1>搜索</h1>
      <div class="search-input-wrap">
        <input
          v-model="q"
          type="search"
          placeholder="搜索文章和说说..."
          autofocus
          class="search-input"
        />
        <span v-if="q" class="search-clear" @click="q = ''">✕</span>
      </div>

      <!-- Tab 切换：全部 / 文章 / 说说 -->
      <nav v-if="debouncedQ" class="search-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          :aria-selected="type === 'all'"
          :class="['tab', { active: type === 'all' }]"
          @click="type = 'all'"
        >
          全部 <span class="tab-count">{{ totalCount }}</span>
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="type === 'articles'"
          :class="['tab', 'tab-articles', { active: type === 'articles' }]"
          @click="type = 'articles'"
        >
          <span class="tab-icon">📝</span>文章 <span class="tab-count">{{ articles.length }}</span>
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="type === 'notes'"
          :class="['tab', 'tab-notes', { active: type === 'notes' }]"
          @click="type = 'notes'"
        >
          <span class="tab-icon">💬</span>说说 <span class="tab-count">{{ notes.length }}</span>
        </button>
      </nav>
    </header>

    <div v-if="!debouncedQ" class="hint">
      <p>输入关键词开始搜索。</p>
      <p class="small">会同时在<strong>文章</strong>正文和<strong>说说</strong>内容里找。</p>
    </div>

    <div v-else-if="!hasResults" class="empty-all">
      <p>没找到「{{ debouncedQ }}」相关的内容</p>
      <p class="small">换个关键词试试？或切换到其他分类看看。</p>
    </div>

    <div v-else class="results">
      <!-- 文章结果 -->
      <section v-if="showArticles && articles.length" class="result-group group-articles">
        <h2>
          <span class="group-icon">📝</span>文章
          <span class="count">{{ articles.length }}</span>
        </h2>
        <ul class="article-list">
          <li v-for="a in articles" :key="a.id">
            <NuxtLink :to="`/posts/${a.slug}`" class="result-card card-article">
              <span class="card-badge">文章</span>
              <time v-if="a.publishedDate" class="card-date">{{ formatDate(a.publishedDate) }}</time>
              <h3 class="card-title" v-html="articleTitle(a)" />
              <p v-if="a.excerpt" class="card-excerpt" v-html="articlePreview(a)" />
            </NuxtLink>
          </li>
        </ul>
      </section>

      <!-- 说说结果 -->
      <section v-if="showNotes && notes.length" class="result-group group-notes">
        <h2>
          <span class="group-icon">💬</span>说说
          <span class="count">{{ notes.length }}</span>
        </h2>
        <ul class="note-list">
          <li v-for="n in notes" :key="n.id">
            <NuxtLink :to="`/notes#note-${n.id}`" class="result-card card-note">
              <span class="card-badge">说说</span>
              <time class="card-date">{{ formatDate(n.publishedDate || n.publishedAt) }}</time>
              <p class="card-preview" v-html="notePreview(n.content)" />
            </NuxtLink>
          </li>
        </ul>
      </section>

      <!-- 单 tab 下对应分类为空的提示 -->
      <p v-if="type === 'articles' && articles.length === 0" class="empty">没有匹配的文章</p>
      <p v-if="type === 'notes' && notes.length === 0" class="empty">没有匹配的说说</p>
    </div>
  </div>
</template>

<style scoped>
.search-page {
  padding: 2rem 0 4rem;
}

.search-header {
  margin-bottom: 2rem;
}
.search-header h1 {
  font-family: var(--font-serif);
  font-size: 2rem;
  font-weight: 600;
  margin: 0 0 1.25rem;
}

.search-input-wrap {
  position: relative;
}
.search-input {
  width: 100%;
  padding: 0.85rem 2.5rem 0.85rem 1.1rem;
  font-size: 1rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-card);
  color: var(--fg);
  font-family: inherit;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.search-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-alpha-mid);
}
.search-clear {
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--muted);
  cursor: pointer;
  user-select: none;
  font-size: 0.9rem;
}
.search-clear:hover { color: var(--fg); }

/* Tab 栏 */
.search-tabs {
  display: flex;
  gap: 0.4rem;
  margin-top: 1.25rem;
  border-bottom: 1px solid var(--border-soft);
  flex-wrap: wrap;
}
.tab {
  border: 0;
  background: transparent;
  padding: 0.55rem 0.95rem;
  font-size: 0.9rem;
  color: var(--muted);
  cursor: pointer;
  border-radius: 8px 8px 0 0;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-family: inherit;
  position: relative;
  top: 1px;
  border-bottom: 2px solid transparent;
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}
.tab:hover { color: var(--fg); background: var(--bg-card); }
.tab.active {
  color: var(--fg);
  border-bottom-color: var(--accent);
  font-weight: 600;
}
.tab-articles.active { border-bottom-color: #3b82f6; }
.tab-notes.active { border-bottom-color: #10b981; }
.tab-icon { font-size: 0.95rem; }
.tab-count {
  font-size: 0.75rem;
  padding: 0.1rem 0.45rem;
  background: var(--border-soft);
  border-radius: 10px;
  color: var(--muted);
  min-width: 1.4rem;
  text-align: center;
}
.tab.active .tab-count {
  background: var(--accent);
  color: #fff;
}
.tab-articles.active .tab-count { background: #3b82f6; }
.tab-notes.active .tab-count { background: #10b981; }

.hint, .empty-all {
  padding: 3rem 1rem;
  text-align: center;
  color: var(--muted);
}
.hint .small, .empty-all .small { font-size: 0.85rem; opacity: 0.8; }

.results {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.result-group h2 {
  font-family: var(--font-serif);
  font-size: 1.15rem;
  font-weight: 600;
  margin: 0 0 0.9rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-soft);
  display: flex;
  align-items: center;
  gap: 0.55rem;
}
.result-group .group-icon {
  font-size: 1rem;
}
.result-group .count {
  color: var(--muted);
  font-size: 0.8rem;
  font-weight: 400;
  margin-left: 0.1rem;
}

.article-list, .note-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

/* 通用卡片 */
.result-card {
  position: relative;
  display: block;
  padding: 1rem 1.25rem 1rem 1.5rem;
  background: var(--bg-card);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius);
  color: inherit;
  text-decoration: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}
.result-card:hover {
  border-color: var(--border);
  box-shadow: var(--shadow-sm);
}

/* 左侧色条区分类型 */
.result-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  border-radius: var(--radius) 0 0 var(--radius);
}
.card-article::before { background: #3b82f6; }
.card-note::before { background: #10b981; }

/* 类型小角标 */
.card-badge {
  position: absolute;
  top: 0.75rem;
  right: 0.85rem;
  font-size: 0.68rem;
  padding: 0.1rem 0.5rem;
  border-radius: 10px;
  font-weight: 500;
  letter-spacing: 0.02em;
}
.card-article .card-badge {
  background: rgba(59, 130, 246, 0.12);
  color: #3b82f6;
}
.card-note .card-badge {
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
}

.card-date {
  display: block;
  color: var(--muted);
  font-size: 0.72rem;
  margin-bottom: 0.35rem;
}

.card-title {
  margin: 0 0 0.4rem;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--fg);
  padding-right: 3rem; /* 给右上角 badge 留位置 */
}

.card-excerpt, .card-preview {
  margin: 0;
  color: var(--fg-soft);
  font-size: 0.88rem;
  line-height: 1.55;
}

/* 说说卡片：没有标题，第一行也给 badge 留空间 */
.card-note .card-preview {
  padding-right: 3rem;
}

:deep(mark) {
  background: rgba(255, 222, 0, 0.45);
  color: inherit;
  padding: 0 2px;
  border-radius: 2px;
}

.empty {
  padding: 1.5rem;
  text-align: center;
  color: var(--muted);
  font-size: 0.9rem;
  background: var(--bg-card);
  border: 1px dashed var(--border);
  border-radius: var(--radius);
}

/* 深色模式下色条和 badge 色值保持可读 */
[data-theme="dark"] .card-article .card-badge {
  background: rgba(59, 130, 246, 0.2);
}
[data-theme="dark"] .card-note .card-badge {
  background: rgba(16, 185, 129, 0.2);
}
</style>
