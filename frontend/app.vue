<template>
  <div class="site">
    <header class="site-header">
      <div class="container">
        <NuxtLink to="/" class="brand">我的博客</NuxtLink>
        <nav>
          <NuxtLink to="/" class="nav-link">首页</NuxtLink>
        </nav>
      </div>
    </header>

    <main class="container main-content">
      <NuxtPage />
    </main>

    <footer class="site-footer">
      <div class="container">
        <p>&copy; {{ new Date().getFullYear() }} Roy</p>
      </div>
    </footer>
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
</style>
