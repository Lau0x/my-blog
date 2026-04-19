/**
 * 主题切换（light / dark / auto）
 *
 * 状态设计：
 * - 用户偏好 `preference`（localStorage 持久化）有三个值：light | dark | auto
 * - 实际应用的 `resolvedTheme` 只有两个值：light | dark
 *   —— auto 模式下由 prefers-color-scheme 决定
 *
 * 写入位置：
 * - <html data-theme="dark"> 是唯一的 CSS 切换抓手
 * - useTheme 在 mount 后把 resolvedTheme 写进去
 * - 初始渲染由 anti-FOUC inline script（nuxt.config.ts 注入）先行写入，
 *   避免"先闪亮色再跳暗色"
 *
 * SSR 安全：
 * - 服务端不读 window / localStorage
 * - useState 保存 preference，客户端 mount 时再从 localStorage 加载
 */

const STORAGE_KEY = 'blog-theme'

export type ThemePreference = 'light' | 'dark' | 'auto'
export type ResolvedTheme = 'light' | 'dark'

/** 读 localStorage，兜底 'auto' */
function readPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'auto'
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw === 'light' || raw === 'dark' || raw === 'auto') return raw
  return 'auto'
}

/** 系统偏好 */
function systemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** preference → resolvedTheme */
function resolve(pref: ThemePreference): ResolvedTheme {
  if (pref === 'auto') return systemPrefersDark() ? 'dark' : 'light'
  return pref
}

/** 把 resolvedTheme 写到 <html data-theme> 上 + 同步更新 theme-color / hljs link */
function applyToDom(theme: ResolvedTheme) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', theme)
  // 同步更新浏览器 theme-color meta（移动端地址栏颜色）
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', theme === 'dark' ? '#0f1115' : '#fdfcfa')
  }
  // 同步代码高亮 link（由 nuxt.config 的 anti-FOUC inline script 初次创建，id=hljs-theme）
  const hljsLink = document.getElementById('hljs-theme') as HTMLLinkElement | null
  if (hljsLink) {
    const base = 'https://cdn.jsdelivr.net/npm/highlight.js@11.10.0/styles/'
    hljsLink.href = base + (theme === 'dark' ? 'github-dark' : 'github') + '.min.css'
  }
}

export function useTheme() {
  // useState 保证 SSR 一致性 + 跨组件共享
  const preference = useState<ThemePreference>('theme-preference', () => 'auto')
  const resolvedTheme = useState<ResolvedTheme>('theme-resolved', () => 'light')

  /** 客户端挂载：读 localStorage + 监听系统变化 */
  onMounted(() => {
    preference.value = readPreference()
    resolvedTheme.value = resolve(preference.value)
    applyToDom(resolvedTheme.value)

    // 监听系统配色变化（auto 模式下需要跟随）
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (preference.value === 'auto') {
        resolvedTheme.value = mq.matches ? 'dark' : 'light'
        applyToDom(resolvedTheme.value)
      }
    }
    mq.addEventListener('change', onChange)

    onUnmounted(() => mq.removeEventListener('change', onChange))
  })

  /** 切换偏好（light / dark / auto） */
  function setPreference(pref: ThemePreference) {
    preference.value = pref
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, pref)
    }
    resolvedTheme.value = resolve(pref)
    applyToDom(resolvedTheme.value)
  }

  return {
    preference: readonly(preference),
    resolvedTheme: readonly(resolvedTheme),
    setPreference,
  }
}
