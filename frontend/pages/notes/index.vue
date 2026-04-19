<script setup lang="ts">
import { parseArticle } from '~/utils/markdown'

const route = useRoute()
const config = useRuntimeConfig()
const base = import.meta.server ? `${config.apiInternal}/api` : config.public.apiBase

interface TagItem { id?: number; name: string }
interface MediaItem {
  id: number
  url: string
  mime: string
  alternativeText?: string
  formats?: {
    small?: { url: string }
    medium?: { url: string }
    large?: { url: string }
    thumbnail?: { url: string }
  }
}
interface Note {
  id: number
  documentId: string
  content: string
  publishedDate?: string
  publishedAt?: string
  createdAt?: string
  tags?: Array<string | TagItem> | null
  media?: MediaItem[] | null
}

// 拉 50 条（分页可以后续做，现在数据量小）
const { data, error } = await useFetch<{ data: Note[] }>(
  `${base}/notes?populate[media]=true&populate[tags]=true&sort=publishedDate:desc&pagination[pageSize]=50`,
  { key: 'notes-list' },
)
const notes = computed<Note[]>(() => data.value?.data ?? [])

const { siteName } = useSiteConfig()
useHead(() => ({
  title: `说说 · ${siteName.value}`,
}))

// 按年月聚合，给右侧 timeline 导航
interface Bucket { key: string; label: string; count: number; firstId: number }
const buckets = computed<Bucket[]>(() => {
  const map = new Map<string, Bucket>()
  for (const n of notes.value) {
    const ts = n.publishedDate || n.publishedAt || n.createdAt
    if (!ts) continue
    const d = new Date(ts)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = `${d.getFullYear()}年${d.getMonth() + 1}月`
    if (!map.has(key)) map.set(key, { key, label, count: 0, firstId: n.id })
    const b = map.get(key)!
    b.count += 1
    if (n.id < b.firstId) b.firstId = n.id
  }
  return [...map.values()].sort((a, b) => (a.key < b.key ? 1 : -1))
})

// markdown 渲染
function renderContent(md: string): string {
  return parseArticle(md).html
}

// 时间戳显示：1 天内 '12m ago'；否则 '2026-04-18 10:30'
function formatTime(ts?: string): string {
  if (!ts) return ''
  const d = new Date(ts)
  const now = Date.now()
  const diff = Math.floor((now - d.getTime()) / 1000) // s
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${hh}:${mm}`
}
function formatTimeFull(ts?: string): string {
  if (!ts) return ''
  return new Date(ts).toLocaleString('zh-CN')
}

// tag 兼容 string 或 {name}
function tagText(t: string | TagItem): string {
  return typeof t === 'string' ? t : (t?.name ?? '')
}

// media URL 处理：Strapi 相对路径 → 绝对 URL
const strapiPublicBase = (config.public.apiBase as string).replace(/\/api\/?$/, '')
function mediaUrl(m: MediaItem, size: 'thumb' | 'medium' | 'full' = 'medium'): string {
  let url = m.url
  if (size === 'thumb') url = m.formats?.thumbnail?.url || m.formats?.small?.url || m.url
  else if (size === 'medium') url = m.formats?.medium?.url || m.formats?.large?.url || m.url
  if (url.startsWith('http')) return url
  return `${strapiPublicBase}${url}`
}
function isVideo(m: MediaItem): boolean {
  return (m.mime || '').startsWith('video/')
}
</script>

<template>
  <div class="notes-page">
    <header class="notes-header">
      <h1>说说</h1>
      <p class="sub">轻量记录，不修辞</p>
    </header>

    <div v-if="error" class="err">加载失败：{{ error.message }}</div>
    <div v-else-if="!notes.length" class="empty">
      <p>还没有说说</p>
    </div>

    <div v-else class="notes-layout">
      <!-- 左：feed -->
      <section class="notes-feed">
        <article
          v-for="n in notes"
          :key="n.id"
          :id="`note-${n.id}`"
          class="note"
        >
          <div class="note-axis"><span class="dot" /></div>
          <div class="note-body">
            <header class="note-meta">
              <time :datetime="n.publishedDate || n.createdAt" :title="formatTimeFull(n.publishedDate || n.createdAt)">
                {{ formatTime(n.publishedDate || n.publishedAt || n.createdAt) }}
              </time>
            </header>

            <div class="prose note-content" v-html="renderContent(n.content)" />

            <!-- media grid -->
            <div v-if="n.media?.length" class="note-media" :class="`count-${Math.min(n.media.length, 4)}`">
              <template v-for="(m, idx) in n.media" :key="m.id">
                <video
                  v-if="isVideo(m)"
                  :src="mediaUrl(m, 'full')"
                  class="media-item media-video"
                  controls
                  preload="metadata"
                />
                <img
                  v-else
                  :src="mediaUrl(m, 'medium')"
                  :alt="m.alternativeText || ''"
                  class="media-item media-img"
                  loading="lazy"
                  referrerpolicy="no-referrer"
                />
              </template>
            </div>

            <!-- tags -->
            <div v-if="n.tags?.length" class="note-tags">
              <span v-for="(t, i) in n.tags" :key="i" class="tag">#{{ tagText(t) }}</span>
            </div>
          </div>
        </article>
      </section>

      <!-- 右：timeline nav -->
      <aside v-if="buckets.length" class="timeline-nav">
        <div class="timeline-inner">
          <h4>时间线</h4>
          <ul>
            <li v-for="b in buckets" :key="b.key">
              <a :href="`#note-${b.firstId}`">
                <span class="label">{{ b.label }}</span>
                <span class="count">{{ b.count }}</span>
              </a>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.notes-page {
  padding: 2rem 0 4rem;
}

.notes-header {
  margin-bottom: 2rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--border-soft);
}
.notes-header h1 {
  font-family: var(--font-serif);
  font-size: 2rem;
  font-weight: 600;
  margin: 0 0 0.35rem;
  color: var(--fg);
}
.notes-header .sub {
  color: var(--muted);
  margin: 0;
  font-size: 0.9rem;
}

.err, .empty {
  padding: 4rem 1rem;
  text-align: center;
  color: var(--muted);
  background: var(--bg-card);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius);
}

.notes-layout {
  position: relative;
}

/* 左侧 feed：主内容 */
.notes-feed {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  position: relative;
}

/* 单条 note 卡片：左边一条时间轴线 + 节点 */
.note {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 0;
  position: relative;
}
.note-axis {
  position: relative;
  width: 28px;
}
.note-axis::before {
  content: '';
  position: absolute;
  left: 13px;
  top: 0;
  bottom: -1.25rem;
  width: 2px;
  background: var(--border-soft);
}
.note:last-child .note-axis::before {
  bottom: 50%;
}
.note-axis .dot {
  position: absolute;
  left: 9px;
  top: 22px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 3px var(--bg);
}

/* 卡片本体 */
.note-body {
  background: var(--bg-card);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius);
  padding: 1.1rem 1.3rem;
  transition: box-shadow 0.15s ease, border-color 0.15s ease;
}
.note-body:hover {
  box-shadow: var(--shadow-sm);
  border-color: var(--border);
}

.note-meta {
  margin-bottom: 0.4rem;
}
.note-meta time {
  color: var(--muted);
  font-size: 0.8rem;
  cursor: help;
}

.note-content {
  font-size: 0.98rem;
  line-height: 1.7;
}
.note-content :deep(p:first-child) { margin-top: 0; }
.note-content :deep(p:last-child) { margin-bottom: 0; }

/* media 网格 */
.note-media {
  margin-top: 0.8rem;
  display: grid;
  gap: 4px;
  border-radius: 12px;
  overflow: hidden;
  max-width: 100%;
}
.note-media.count-1 { grid-template-columns: 1fr; }
.note-media.count-2 { grid-template-columns: 1fr 1fr; }
.note-media.count-3 { grid-template-columns: 2fr 1fr; grid-template-rows: 1fr 1fr; }
.note-media.count-3 .media-item:first-child { grid-row: 1 / 3; }
.note-media.count-4 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }

.media-item {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  max-height: 420px;
}
.media-video {
  background: #000;
}

/* tags */
.note-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.8rem;
}
.note-tags .tag {
  font-size: 0.75rem;
  color: var(--fg-soft);
  background: var(--bg-code);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.15rem 0.6rem;
}

/* 右侧 timeline 导航（宽屏显示） */
.timeline-nav {
  display: none;
}
@media (min-width: 1200px) {
  .timeline-nav {
    display: block;
    position: fixed;
    top: 6rem;
    left: calc(50% + 390px);
    width: 220px;
    max-height: calc(100vh - 8rem);
    overflow-y: auto;
    z-index: 10;
  }
  .timeline-inner {
    padding: 1.1rem 1rem;
    background: var(--bg-card);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius);
    box-shadow: var(--shadow-sm);
    font-size: 0.85rem;
  }
  .timeline-inner h4 {
    margin: 0 0 0.65rem;
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .timeline-inner ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .timeline-inner li { margin: 0; }
  .timeline-inner a {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.3rem 0.5rem;
    border-radius: 4px;
    color: var(--fg-soft);
    text-decoration: none;
    transition: all 0.15s ease;
  }
  .timeline-inner a:hover {
    color: var(--accent);
    background: var(--accent-alpha-lo);
  }
  .timeline-inner .count {
    color: var(--muted);
    font-size: 0.72rem;
  }
}

/* 窄屏 */
@media (max-width: 640px) {
  .note {
    grid-template-columns: 18px 1fr;
  }
  .note-axis { width: 18px; }
  .note-axis::before { left: 8px; }
  .note-axis .dot { left: 4px; top: 20px; }
  .note-body {
    padding: 0.9rem 1rem;
  }
}
</style>
