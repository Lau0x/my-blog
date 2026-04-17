<script setup lang="ts">
interface Props {
  type: 'adsense' | 'banner' | 'affiliate'
  slot?: string
  client?: string
  image?: string
  link?: string
  title?: string
  desc?: string
  cta?: string
}
const props = defineProps<Props>()
const config = useRuntimeConfig()
const adsenseClient = computed(() => props.client || config.public.adsenseClient)

onMounted(() => {
  if (props.type === 'adsense' && typeof window !== 'undefined') {
    try {
      // @ts-ignore
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch (e) {
      console.warn('[AdSense] push failed', e)
    }
  }
})
</script>

<template>
  <div class="ad-slot">
    <span class="ad-label">广告</span>

    <ins
      v-if="type === 'adsense'"
      class="adsbygoogle"
      style="display:block"
      :data-ad-client="adsenseClient"
      :data-ad-slot="slot"
      data-ad-format="auto"
      data-full-width-responsive="true"
    />

    <a
      v-else-if="type === 'banner'"
      :href="link"
      target="_blank"
      rel="noopener sponsored"
      class="ad-banner"
    >
      <img :src="image" :alt="title || 'ad'" />
    </a>

    <a
      v-else-if="type === 'affiliate'"
      :href="link"
      target="_blank"
      rel="noopener sponsored"
      class="ad-affiliate"
    >
      <img v-if="image" :src="image" class="ad-affiliate__thumb" />
      <div class="ad-affiliate__body">
        <h3>{{ title }}</h3>
        <p>{{ desc }}</p>
        <span class="ad-affiliate__cta">{{ cta || '了解更多' }} →</span>
      </div>
    </a>
  </div>
</template>

<style scoped>
.ad-slot {
  position: relative;
  margin: 2rem 0;
}
.ad-label {
  position: absolute;
  top: 0.25rem;
  right: 0.5rem;
  font-size: 0.6875rem;
  color: #999;
  background: rgba(255,255,255,0.9);
  padding: 0 0.25rem;
  border-radius: 2px;
  z-index: 1;
}
.ad-banner img {
  width: 100%;
  height: auto;
  display: block;
  border-radius: 8px;
  border: 1px solid var(--border);
}
.ad-affiliate {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
  transition: box-shadow 0.2s;
  text-decoration: none !important;
  color: inherit;
}
.ad-affiliate:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.06);
}
.ad-affiliate__thumb {
  width: 96px;
  height: 96px;
  object-fit: cover;
  border-radius: 6px;
  flex-shrink: 0;
}
.ad-affiliate__body h3 {
  margin: 0 0 0.25rem;
  font-size: 1rem;
  color: var(--fg);
}
.ad-affiliate__body p {
  margin: 0 0 0.5rem;
  color: var(--muted);
  font-size: 0.875rem;
}
.ad-affiliate__cta {
  font-size: 0.875rem;
  color: var(--accent);
}
</style>
