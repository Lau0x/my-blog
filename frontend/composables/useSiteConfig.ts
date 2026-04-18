export interface NavItem {
  id?: number
  label: string
  path: string
  order?: number
}

interface SiteConfig {
  siteName?: string
  tagline?: string
  footerHTML?: string
  authorName?: string
  ogImage?: { url: string; alternativeText?: string } | null
  themeColor?: string
  navItems?: NavItem[] | null
}

const DEFAULTS: Required<Pick<SiteConfig, 'siteName' | 'footerHTML'>> = {
  siteName: '我的博客',
  footerHTML: '© {{year}} Roy',
}

export const useSiteConfig = () => {
  const config = useRuntimeConfig()
  const fetchBase = import.meta.server
    ? `${config.apiInternal}/api`
    : config.public.apiBase

  const { data } = useFetch<{ data: SiteConfig | null }>(
    `${fetchBase}/site-config?populate=*`,
    { key: 'site-config' },
  )

  const cfg = computed<SiteConfig>(() => data.value?.data ?? {})

  const siteName = computed(() => cfg.value.siteName || DEFAULTS.siteName)
  const tagline = computed(() => cfg.value.tagline || '')
  const authorName = computed(() => cfg.value.authorName || '')
  const themeColor = computed(() => cfg.value.themeColor || '')

  const footerHTML = computed(() => {
    const tpl = cfg.value.footerHTML || DEFAULTS.footerHTML
    const year = new Date().getFullYear().toString()
    return tpl.replace(/\{\{\s*year\s*\}\}/g, year)
  })

  const strapiPublicBase = (config.public.apiBase as string).replace(/\/api\/?$/, '')
  const ogImageUrl = computed(() => {
    const m = cfg.value.ogImage
    if (!m?.url) return ''
    return m.url.startsWith('http') ? m.url : `${strapiPublicBase}${m.url}`
  })

  const navItems = computed<NavItem[]>(() => {
    const items = cfg.value.navItems ?? []
    return [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  })

  return { cfg, siteName, tagline, authorName, themeColor, footerHTML, ogImageUrl, navItems }
}
