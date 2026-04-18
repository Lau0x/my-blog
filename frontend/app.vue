<script setup lang="ts">
const { siteName, footerHTML, navItems: userNavItems } = useSiteConfig()

useHead(() => ({
  titleTemplate: (title?: string) =>
    title ? `${title} · ${siteName.value}` : siteName.value,
}))

// Fallback 源：showInNav=true 的 CustomPage
interface NavPage { id: number; title: string; slug: string }
const config = useRuntimeConfig()
const base = import.meta.server ? `${config.apiInternal}/api` : config.public.apiBase
const { data: navData } = await useFetch<{ data: NavPage[] }>(
  `${base}/custom-pages?filters[showInNav][$eq]=true&sort=navOrder:asc&fields[0]=title&fields[1]=slug`,
  { key: 'nav-pages' },
)
const navPages = computed<NavPage[]>(() => navData.value?.data ?? [])

// 最终生效的 nav：
//   ① 如果 SiteConfig.navItems 非空 → 100% 用它（完全自定义，支持外链）
//   ② 否则 → 默认行为：首页 + 标签 + showInNav CustomPages
interface FlatNav { label: string; path: string }
const effectiveNav = computed<FlatNav[]>(() => {
  if (userNavItems.value.length > 0) {
    return userNavItems.value.map(it => ({ label: it.label, path: it.path }))
  }
  return [
    { label: '首页', path: '/' },
    { label: '标签', path: '/tags' },
    ...navPages.value.map(p => ({ label: p.title, path: `/${p.slug}` })),
  ]
})

function isExternal(p: string): boolean {
  return /^https?:\/\//i.test(p)
}
</script>

<template>
  <div class="site">
    <header class="site-header">
      <div class="container">
        <NuxtLink to="/" class="brand">{{ siteName }}</NuxtLink>
        <nav>
          <template v-for="(it, i) in effectiveNav" :key="i">
            <a
              v-if="isExternal(it.path)"
              :href="it.path"
              target="_blank"
              rel="noopener noreferrer"
              class="nav-link"
            >{{ it.label }}</a>
            <NuxtLink
              v-else
              :to="it.path"
              class="nav-link"
            >{{ it.label }}</NuxtLink>
          </template>
        </nav>
      </div>
    </header>

    <main class="container main-content">
      <NuxtPage />
    </main>

    <footer class="site-footer">
      <div class="container">
        <p v-html="footerHTML" />
      </div>
    </footer>

    <BackToTop />
  </div>
</template>

<style>
.container {
  max-width: 720px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

.site-header {
  background: rgba(253, 252, 250, 0.85);
  backdrop-filter: saturate(180%) blur(12px);
  -webkit-backdrop-filter: saturate(180%) blur(12px);
  border-bottom: 1px solid var(--border-soft);
  padding: 1rem 0;
  position: sticky;
  top: 0;
  z-index: 50;
}

.site-header .container {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.brand {
  font-family: var(--font-serif);
  font-weight: 600;
  font-size: 1.375rem;
  color: var(--fg);
  letter-spacing: -0.01em;
}
.brand:hover { color: var(--accent); }

.site-header nav {
  display: flex;
  gap: 1.5rem;
}
.nav-link {
  color: var(--fg-soft);
  font-size: 0.95rem;
  font-weight: 500;
  transition: color 0.15s ease;
}
.nav-link:hover,
.nav-link.router-link-active {
  color: var(--fg);
}

.main-content {
  min-height: calc(100vh - 200px);
  padding-top: 1rem;
}

.site-footer {
  margin-top: 6rem;
  padding: 2.5rem 0;
  border-top: 1px solid var(--border-soft);
  color: var(--muted);
  font-size: 0.875rem;
  text-align: center;
}

.site-footer p { margin: 0; }
.site-footer a { color: var(--fg-soft); }
.site-footer a:hover { color: var(--accent); }
</style>
