<script setup lang="ts">
const config = useRuntimeConfig()
const base = import.meta.server ? `${config.apiInternal}/api` : config.public.apiBase

interface Article {
  id: number
  documentId: string
  title: string
  slug: string
  excerpt?: string
  publishedDate?: string
  cover?: { url: string; alternativeText?: string } | null
}

const { data, error } = await useFetch<{ data: Article[] }>(
  `${base}/articles?populate=cover&sort=publishedDate:desc&pagination[pageSize]=20`,
)

const { cfg, imgUrl } = useAdConfig()
</script>

<template>
  <div>
    <h1 class="page-title">最新文章</h1>

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
      还没有文章，去后台发一篇吧 →
      <a :href="`${config.public.siteUrl}/admin`">进入后台</a>
    </div>

    <ul v-else class="post-list">
      <template v-for="(post, i) in data.data" :key="post.id">
        <li class="post-item">
          <NuxtLink :to="`/posts/${post.slug}`">
            <h2>{{ post.title }}</h2>
            <p v-if="post.excerpt" class="excerpt">{{ post.excerpt }}</p>
            <time v-if="post.publishedDate">{{ new Date(post.publishedDate).toLocaleDateString('zh-CN') }}</time>
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
.page-title {
  font-size: 1.5rem;
  margin: 2rem 0 1rem;
}
.post-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.post-item {
  padding: 1.5rem 0;
  border-bottom: 1px solid var(--border);
}
.post-item a {
  color: inherit;
  text-decoration: none;
}
.post-item h2 {
  margin: 0 0 0.5rem;
  font-size: 1.25rem;
}
.excerpt {
  color: var(--muted);
  margin: 0 0 0.5rem;
}
.post-item time {
  font-size: 0.875rem;
  color: var(--muted);
}
.ad-row {
  list-style: none;
  padding: 0;
}
.err, .empty {
  padding: 2rem;
  text-align: center;
  color: var(--muted);
}
</style>
