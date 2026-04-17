<template>
  <div class="site">
    <header class="site-header">
      <div class="container">
        <NuxtLink to="/" class="brand">我的博客</NuxtLink>
        <nav>
          <NuxtLink to="/">首页</NuxtLink>
        </nav>
      </div>
    </header>

    <main class="container">
      <NuxtPage />
    </main>

    <footer class="site-footer">
      <div class="container">
        <p>&copy; {{ new Date().getFullYear() }} Roy Leo · Powered by Nuxt + Strapi</p>
      </div>
    </footer>
  </div>
</template>

<style>
:root {
  --fg: #1a1a1a;
  --muted: #666;
  --border: #e5e5e5;
  --accent: #2563eb;
  --bg: #fafafa;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: var(--bg); color: var(--fg);
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', sans-serif;
  font-size: 16px; line-height: 1.7; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
.container { max-width: 760px; margin: 0 auto; padding: 0 1.25rem; }
.site-header { background: #fff; border-bottom: 1px solid var(--border); padding: 1rem 0; }
.site-header .container { display: flex; justify-content: space-between; align-items: center; }
.brand { font-weight: 700; font-size: 1.125rem; color: var(--fg); }
.site-header nav a { margin-left: 1rem; color: var(--muted); }
.site-footer { margin-top: 4rem; padding: 2rem 0; border-top: 1px solid var(--border);
  color: var(--muted); font-size: 0.875rem; text-align: center; }
</style>
