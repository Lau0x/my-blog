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
  const imgUrl = (m?: AdSlotData['image']) =>
    m?.url ? (m.url.startsWith('http') ? m.url : `${strapiPublicBase}${m.url}`) : ''

  const { data } = useFetch<{ data: AdConfig | null }>(`${fetchBase}/ad-config`, {
    key: 'ad-config',
  })
  const cfg = computed<AdConfig>(() => data.value?.data ?? {})

  return { cfg, imgUrl }
}
