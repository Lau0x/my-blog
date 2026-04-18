export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    apiInternal: process.env.NUXT_API_INTERNAL || 'http://strapi:1337',
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || '/api',
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || '',
      adsenseClient: process.env.NUXT_PUBLIC_ADSENSE_CLIENT || '',
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'zh-CN' },
      title: '我的博客',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: '个人博客' },
      ],
      link: [
        // 字体：霞鹜文楷（中文标题）+ Inter（英文/UI）+ JetBrains Mono（代码）
        { rel: 'preconnect', href: 'https://cdn.jsdelivr.net', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/style.css' },
        { rel: 'stylesheet', href: 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.20/400.css' },
        { rel: 'stylesheet', href: 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.20/500.css' },
        { rel: 'stylesheet', href: 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.20/600.css' },
        { rel: 'stylesheet', href: 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.20/700.css' },
        { rel: 'stylesheet', href: 'https://cdn.jsdelivr.net/npm/@fontsource/jetbrains-mono@5.0.20/400.css' },
        { rel: 'stylesheet', href: 'https://cdn.jsdelivr.net/npm/@fontsource/jetbrains-mono@5.0.20/500.css' },
        // 代码高亮主题（GitHub 风格，明亮清爽）
        { rel: 'stylesheet', href: 'https://cdn.jsdelivr.net/npm/highlight.js@11.10.0/styles/github.min.css' },
      ],
      script: [
        {
          src: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js',
          async: true,
          crossorigin: 'anonymous',
          'data-ad-client': process.env.NUXT_PUBLIC_ADSENSE_CLIENT || '',
        },
      ],
    },
  },
})
