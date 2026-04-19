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
        // theme-color 初始为亮色（#fdfcfa），anti-FOUC script 会在暗色模式下改写
        { name: 'theme-color', content: '#fdfcfa' },
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
        // 代码高亮主题由 anti-FOUC inline script 动态注入（根据 data-theme 选 github or github-dark）
      ],
      script: [
        // ── Anti-FOUC theme bootstrap ───────────────────────────────
        // 同步执行，先于 body 渲染：读 localStorage / 系统偏好 →
        // 设 <html data-theme> → 写 theme-color meta → 创建对应的 hljs 主题 link。
        // tagPriority 'critical' 让 unhead 尽早渲染，tagPosition 'head' 确保落在 head 内。
        {
          tagPriority: 'critical',
          tagPosition: 'head',
          innerHTML: `(function(){try{var K='blog-theme',p=localStorage.getItem(K);if(p!=='light'&&p!=='dark'&&p!=='auto')p='auto';var r=p==='auto'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p;document.documentElement.setAttribute('data-theme',r);var m=document.querySelector('meta[name=theme-color]');if(m)m.setAttribute('content',r==='dark'?'#0f1115':'#fdfcfa');var l=document.createElement('link');l.rel='stylesheet';l.id='hljs-theme';l.href='https://cdn.jsdelivr.net/npm/highlight.js@11.10.0/styles/'+(r==='dark'?'github-dark':'github')+'.min.css';document.head.appendChild(l);}catch(e){}})();`,
          type: 'text/javascript',
        },
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
