<script setup lang="ts">
import { parseArticle } from '~/utils/markdown'

const route = useRoute()
const config = useRuntimeConfig()
const base = import.meta.server ? `${config.apiInternal}/api` : config.public.apiBase

interface CustomPage {
  id: number
  title: string
  slug: string
  body?: string
  htmlBody?: string
  seoDescription?: string
}

const { data, error } = await useFetch<{ data: CustomPage[] }>(
  `${base}/custom-pages?filters[slug][$eq]=${route.params.slug}`,
)

const page = computed(() => data.value?.data?.[0])

// 渲染模式：优先 htmlBody（raw HTML，高级用户手写），其次 body（markdown 默认路径）
const useRawHtml = computed(() => !!page.value?.htmlBody?.trim())

const markdownRendered = computed(() =>
  useRawHtml.value ? { html: '', toc: [] } : parseArticle(page.value?.body || ''),
)
const renderedHtml = computed(() =>
  useRawHtml.value ? (page.value?.htmlBody || '') : markdownRendered.value.html,
)

useHead(() => ({
  title: page.value?.title || '未找到',
  meta: [
    { name: 'description', content: page.value?.seoDescription || '' },
  ],
}))

// 404 语义：没有匹配的页面时返回 404 状态码（SSR 友好）
if (import.meta.server && !page.value) {
  throw createError({ statusCode: 404, message: '页面不存在', fatal: false })
}
</script>

<template>
  <article v-if="page" class="custom-page" :class="{ 'raw-html-mode': useRawHtml }">
    <!-- 自定义 HTML 模式：不自动渲染 title / .prose 样式框，把布局全权交给用户 -->
    <template v-if="useRawHtml">
      <div class="page-body-raw" v-html="renderedHtml" />
    </template>

    <!-- Markdown 模式：带自动标题 + .prose 样式 -->
    <template v-else>
      <header class="page-header">
        <h1 class="page-title">{{ page.title }}</h1>
      </header>
      <div class="prose page-body" v-html="renderedHtml" />
    </template>
  </article>
  <div v-else-if="error" class="err">加载失败：{{ error.message }}</div>
  <div v-else class="err">页面不存在</div>
</template>

<style scoped>
.custom-page {
  padding: 2.5rem 0 3rem;
}

/* raw HTML 模式下移除默认内边距，让用户 HTML 完全掌控布局 */
.custom-page.raw-html-mode {
  padding: 0;
}

.page-header {
  margin-bottom: 2.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-soft);
}

.page-title {
  font-family: var(--font-serif);
  font-size: 2.25rem;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.015em;
  margin: 0;
  color: var(--fg);
}

.page-body {
  margin-top: 1rem;
}

/* raw 容器没有任何默认样式——用户自己用 <style> 或内联样式定义一切 */
.page-body-raw {
  /* intentionally empty */
}

.err {
  padding: 4rem 1rem;
  text-align: center;
  color: var(--muted);
}
</style>
