interface AdSlotData {
  enabled?: boolean
  type?: 'banner' | 'affiliate'
  image?: { url: string; alternativeText?: string } | null
  title?: string
  description?: string
  cta?: string
  link?: string
}

interface AdConfig {
  adsenseClient?: string
  adsenseHomeSlot?: string
  adsenseArticleSlot?: string
  homeTopBanner?: AdSlotData
  homeBottomCard?: AdSlotData
  articleTopBanner?: AdSlotData
  articleBottomCard?: AdSlotData
}

export const useAdConfig = () => {
  const config = useRuntimeConfig()
  const fetchBase = import.meta.server
    ? `${config.apiInternal}/api`
    : config.public.apiBase
  const strapiPublicBase = (config.public.apiBase as string).replace(/\/api\/?$/, '')
  // 接受 Strapi media 对象或直接 URL 字符串（如 cover.formats.large.url）
  const imgUrl = (m?: AdSlotData['image'] | string | null) => {
    if (!m) return ''
    const url = typeof m === 'string' ? m : m.url
    if (!url) return ''
    return url.startsWith('http') ? url : `${strapiPublicBase}${url}`
  }

  const { data } = useFetch<{ data: AdConfig | null }>(`${fetchBase}/ad-config`, {
    key: 'ad-config',
  })
  const cfg = computed<AdConfig>(() => data.value?.data ?? {})

  return { cfg, imgUrl }
}
