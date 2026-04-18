// 模块级 marked 实例：marked.use() 只在模块首次加载时执行一次，
// 避免在 <script setup> 里每次组件实例化都往 plugin 链里叠加。
import { marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js/lib/common'

marked.use(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext'
      try {
        return hljs.highlight(code, { language, ignoreIllegals: true }).value
      } catch {
        return code
      }
    },
  }),
)

export { marked }

export interface TocItem {
  level: number
  text: string
  id: string
}

/**
 * 解析 markdown，返回渲染后 HTML + 提取的目录 + 为 h2/h3 加锚 id。
 * 另外给代码块包一层 .code-block 容器（承载右上角语言标签 + 复制按钮）。
 */
export function parseArticle(content: string): { html: string; toc: TocItem[] } {
  if (!content) return { html: '', toc: [] }

  let raw = marked.parse(content) as string

  // 为 h2/h3 加 id 并收集 TOC
  const list: TocItem[] = []
  raw = raw.replace(/<(h[23])>([\s\S]*?)<\/\1>/g, (_m, tag: string, inner: string) => {
    const plain = inner.replace(/<[^>]+>/g, '').trim()
    const id = `h-${list.length}`
    list.push({ level: tag === 'h2' ? 2 : 3, text: plain, id })
    return `<${tag} id="${id}">${inner}</${tag}>`
  })

  // 把 <pre><code class="hljs language-xxx">...</code></pre>
  // 包成 <div class="code-block" data-lang="xxx"><pre>...</pre></div>
  // 便于前端挂语言标签和复制按钮
  raw = raw.replace(
    /<pre><code class="hljs language-([^"]+)">([\s\S]*?)<\/code><\/pre>/g,
    (_m, lang, body) =>
      `<div class="code-block" data-lang="${lang}"><pre><code class="hljs language-${lang}">${body}</code></pre></div>`,
  )
  // 也兼容没有 language 的纯代码块
  raw = raw.replace(
    /<pre><code>([\s\S]*?)<\/code><\/pre>/g,
    (_m, body) =>
      `<div class="code-block" data-lang="text"><pre><code>${body}</code></pre></div>`,
  )

  // 给所有 <img> 加 referrerpolicy="no-referrer" + loading="lazy" + decoding="async"
  // 解决第三方 CDN（如 files.mdnice.com）防盗链返回 403 的问题
  raw = raw.replace(/<img\b([^>]*)>/g, (match, attrs: string) => {
    let a = attrs
    if (!/referrerpolicy=/i.test(a)) a += ' referrerpolicy="no-referrer"'
    if (!/loading=/i.test(a)) a += ' loading="lazy"'
    if (!/decoding=/i.test(a)) a += ' decoding="async"'
    return `<img${a}>`
  })

  // 外链自动新窗口打开
  raw = autoExternalLink(raw)

  return { html: raw, toc: list }
}

/**
 * 把 HTML 字符串里所有指向 http(s) 外链的 <a> 自动加上
 *   target="_blank" rel="noopener noreferrer"
 *
 * 已经显式写了 target= 的不覆盖（用户故意要 _self 时保留）。
 * 锚点（#xxx）、内链（/xxx）、邮件（mailto:）不处理。
 */
export function autoExternalLink(html: string): string {
  if (!html) return html
  return html.replace(
    /<a\b([^>]*?)href\s*=\s*(["'])(https?:\/\/[^"']+)\2([^>]*)>/gi,
    (match, pre: string, quote: string, href: string, post: string) => {
      if (/\btarget\s*=/i.test(pre) || /\btarget\s*=/i.test(post)) return match
      const relAttr = /\brel\s*=/i.test(pre) || /\brel\s*=/i.test(post)
        ? ''
        : ' rel="noopener noreferrer"'
      return `<a${pre}href=${quote}${href}${quote}${post} target="_blank"${relAttr}>`
    },
  )
}
