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
  seoDescription?: string
}

const { data, error } = await useFetch<{ data: CustomPage[] }>(
  `${base}/custom-pages?filters[slug][$eq]=${route.params.slug}`,
)

const page = computed(() => data.value?.data?.[0])

const rendered = computed(() => parseArticle(page.value?.body || ''))
const html = computed(() => rendered.value.html)

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
  <article v-if="page" class="custom-page">
    <header class="page-header">
      <h1 class="page-title">{{ page.title }}</h1>
    </header>
    <div class="prose page-body" v-html="html" />
  </article>
  <div v-else-if="error" class="err">加载失败：{{ error.message }}</div>
  <div v-else class="err">页面不存在</div>
</template>

<style scoped>
.custom-page {
  padding: 2.5rem 0 3rem;
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

.err {
  padding: 4rem 1rem;
  text-align: center;
  color: var(--muted);
}
</style>
