<script setup lang="ts">
const config = useRuntimeConfig()
const base = import.meta.server ? `${config.apiInternal}/api` : config.public.apiBase

interface TagItem { id?: number; name: string }
interface Article {
  id: number
  title: string
  slug: string
  publishedDate?: string
  tags?: Array<string | TagItem> | null
}

const { data, error } = await useFetch<{ data: Article[] }>(
  `${base}/articles?populate[tags]=true&sort=publishedDate:desc&pagination[pageSize]=200`,
)

function tagText(t: string | TagItem): string {
  return typeof t === 'string' ? t : (t?.name ?? '')
}

// 按 tag 聚合：{ tagName: Article[] }
const grouped = computed(() => {
  const out = new Map<string, Article[]>()
  for (const post of data.value?.data ?? []) {
    for (const t of post.tags ?? []) {
      const name = tagText(t)
      if (!name) continue
      if (!out.has(name)) out.set(name, [])
      out.get(name)!.push(post)
    }
  }
  // 按文章数多 → 少排序
  return [...out.entries()].sort((a, b) => b[1].length - a[1].length)
})

useHead({ title: '标签' })

function formatDate(dateStr?: string): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="tags-page">
    <header class="tags-header">
      <h1>标签</h1>
      <p v-if="grouped.length" class="tags-summary">共 {{ grouped.length }} 个标签 · {{ data?.data?.length || 0 }} 篇文章</p>
    </header>

    <div v-if="error" class="err">加载失败：{{ error.message }}</div>
    <div v-else-if="!grouped.length" class="empty">还没有标签。在 Strapi 后台给文章加上 Tag 就能在这看到。</div>

    <section v-for="[name, posts] in grouped" :key="name" class="tag-group">
      <h2 class="tag-name">
        <span class="tag-chip">{{ name }}</span>
        <span class="tag-count">{{ posts.length }}</span>
      </h2>
      <ul class="post-list">
        <li v-for="post in posts" :key="post.id" class="post-item">
          <NuxtLink :to="`/posts/${post.slug}`" class="post-link">
            <span class="post-title">{{ post.title }}</span>
            <time v-if="post.publishedDate" class="post-date">{{ formatDate(post.publishedDate) }}</time>
          </NuxtLink>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.tags-page {
  padding: 2.5rem 0 3rem;
}

.tags-header {
  margin-bottom: 2.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-soft);
}
.tags-header h1 {
  font-family: var(--font-serif);
  font-size: 2.25rem;
  font-weight: 600;
  letter-spacing: -0.015em;
  margin: 0;
  color: var(--fg);
}
.tags-summary {
  margin: 0.5rem 0 0;
  color: var(--muted);
  font-size: 0.9rem;
}

.tag-group {
  margin: 0 0 2.5rem;
}

.tag-name {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 500;
  margin: 0 0 0.75rem;
}
.tag-chip {
  display: inline-block;
  padding: 0.25rem 0.8rem;
  background: var(--bg-code);
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--fg);
  font-size: 0.9rem;
  letter-spacing: 0.02em;
}
.tag-count {
  color: var(--muted);
  font-size: 0.8rem;
  font-weight: 400;
}

.post-list {
  list-style: none;
  padding: 0;
  margin: 0;
  border-left: 2px solid var(--border-soft);
  padding-left: 1rem;
}
.post-item {
  margin: 0 0 0.4rem;
}
.post-link {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
  color: var(--fg-soft);
  text-decoration: none;
  padding: 0.35rem 0;
  transition: color 0.15s ease;
}
.post-link:hover {
  color: var(--accent);
}
.post-title {
  flex: 1;
  font-size: 0.95rem;
  font-weight: 500;
}
.post-date {
  color: var(--muted);
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.err,
.empty {
  padding: 3rem 1rem;
  text-align: center;
  color: var(--muted);
  background: var(--bg-card);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius);
}
</style>
