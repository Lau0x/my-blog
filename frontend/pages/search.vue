<script setup lang="ts">
import { parseArticle } from '~/utils/markdown'

const route = useRoute()
const router = useRouter()
const config = useRuntimeConfig()
const base = import.meta.server ? `${config.apiInternal}/api` : config.public.apiBase

const { siteName } = useSiteConfig()

// 初始 q 取自 URL
const initialQ = (route.query.q as string) || ''
const q = ref(initialQ)

// debounce：用户在输入框里 300ms 没动静才真触发 fetch
const debouncedQ = ref(initialQ)
let debounceTimer: ReturnType<typeof setTimeout> | null = null
watch(q, (v) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debouncedQ.value = v.trim()
    // 更新 URL 以便分享
    router.replace({ query: v.trim() ? { q: v.trim() } : {} })
  }, 300)
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
  const q = encodeURIComponent(debouncedQ.value)
  return `${base}/articles?filters[$or][0][title][$containsi]=${q}&filters[$or][1][excerpt][$containsi]=${q}&filters[$or][2][content][$containsi]=${q}&sort=publishedDate:desc&pagination[pageSize]=20&fields[0]=title&fields[1]=slug&fields[2]=excerpt&fields[3]=publishedDate`
})
const { data: articleData } = await useFetch<{ data: Article[] }>(
  articlesUrl,
  { key: () => `search-articles-${debouncedQ.value}`, watch: [debouncedQ] },
)
const articles = computed<Article[]>(() => debouncedQ.value ? (articleData.value?.data ?? []) : [])

// 说说搜索：content
const notesUrl = computed(() => {
  if (!debouncedQ.value) return ''
  const q = encodeURIComponent(debouncedQ.value)
  return `${base}/notes?filters[content][$containsi]=${q}&sort=publishedDate:desc&pagination[pageSize]=20&fields[0]=content&fields[1]=publishedDate&fields[2]=publishedAt`
})
const { data: noteData } = await useFetch<{ data: Note[] }>(
  notesUrl,
  { key: () => `search-notes-${debouncedQ.value}`, watch: [debouncedQ] },
)
const notes = computed<Note[]>(() => debouncedQ.value ? (noteData.value?.data ?? []) : [])

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
    </header>

    <div v-if="!debouncedQ" class="hint">
      <p>输入关键词开始搜索。</p>
      <p class="small">会同时在**文章**正文和**说说**内容里找。</p>
    </div>

    <div v-else class="results">
      <!-- 文章结果 -->
      <section class="result-group">
        <h2>文章 <span class="count">{{ articles.length }}</span></h2>
        <ul v-if="articles.length" class="article-list">
          <li v-for="a in articles" :key="a.id">
            <NuxtLink :to="`/posts/${a.slug}`" class="article-link">
              <time v-if="a.publishedDate" class="article-date">{{ formatDate(a.publishedDate) }}</time>
              <h3 class="article-title" v-html="articleTitle(a)" />
              <p v-if="a.excerpt" class="article-excerpt" v-html="articlePreview(a)" />
            </NuxtLink>
          </li>
        </ul>
        <p v-else class="empty">没有匹配的文章</p>
      </section>

      <!-- 说说结果 -->
      <section class="result-group">
        <h2>说说 <span class="count">{{ notes.length }}</span></h2>
        <ul v-if="notes.length" class="note-list">
          <li v-for="n in notes" :key="n.id">
            <NuxtLink :to="`/notes#note-${n.id}`" class="note-link">
              <time class="note-date">{{ formatDate(n.publishedDate || n.publishedAt) }}</time>
              <p class="note-preview" v-html="notePreview(n.content)" />
            </NuxtLink>
          </li>
        </ul>
        <p v-else class="empty">没有匹配的说说</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.search-page {
  padding: 2rem 0 4rem;
}

.search-header {
  margin-bottom: 2.5rem;
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
  box-shadow: 0 0 0 3px rgba(59, 108, 181, 0.12);
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

.hint {
  padding: 3rem 1rem;
  text-align: center;
  color: var(--muted);
}
.hint .small { font-size: 0.85rem; opacity: 0.8; }

.results {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
}

.result-group h2 {
  font-family: var(--font-serif);
  font-size: 1.2rem;
  font-weight: 600;
  margin: 0 0 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-soft);
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.result-group .count {
  color: var(--muted);
  font-size: 0.85rem;
  font-weight: 400;
}

.article-list, .note-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.article-link, .note-link {
  display: block;
  padding: 1rem 1.25rem;
  background: var(--bg-card);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius);
  color: inherit;
  text-decoration: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.article-link:hover, .note-link:hover {
  border-color: var(--border);
  box-shadow: var(--shadow-sm);
}

.article-date, .note-date {
  display: block;
  color: var(--muted);
  font-size: 0.75rem;
  margin-bottom: 0.35rem;
}

.article-title {
  margin: 0 0 0.4rem;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--fg);
}

.article-excerpt, .note-preview {
  margin: 0;
  color: var(--fg-soft);
  font-size: 0.88rem;
  line-height: 1.55;
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
</style>
