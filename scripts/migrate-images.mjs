#!/usr/bin/env node
// 一键外链图片本地化：扫所有文章 content，下载外链图到 Strapi Media Library，
// 把 content 里的外链 URL 全部替换成本地 /uploads/xxx.jpg
//
// 用法：
//   export STRAPI_URL=http://localhost:1337
//   export STRAPI_TOKEN=<Strapi admin 生成的 Full access API token>
//   node scripts/migrate-images.mjs              # 执行
//   node scripts/migrate-images.mjs --dry-run    # 只看要改啥，不实际改
//
// 或把环境变量写到项目根的 .migrate-env 文件：
//   STRAPI_URL=http://localhost:1337
//   STRAPI_TOKEN=xxxxxx
//
// 幂等：重跑不会重复下载（本地 .migrate-cache.json 记录 URL 映射）。
// 失败隔离：某张图失败不影响其他图、其他文章。
//
// 如何拿 STRAPI_TOKEN：
//   Strapi admin → Settings → API Tokens → Create new API Token
//   - Name:     migrate-images
//   - Duration: Unlimited（或你想要的过期时间）
//   - Type:     Full access
//   - 复制出现的 token（只显示一次）

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// ======= 加载配置 =======
try {
  const txt = await fs.readFile(path.join(ROOT, '.migrate-env'), 'utf8')
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m) process.env[m[1]] ||= m[2].replace(/^["']|["']$/g, '')
  }
} catch { /* .migrate-env 不存在也 OK */ }

const STRAPI_URL = (process.env.STRAPI_URL || 'http://localhost:1337').replace(/\/$/, '')
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || ''
const DRY_RUN = process.argv.includes('--dry-run')

if (!STRAPI_TOKEN) {
  console.error('❌ 未设置 STRAPI_TOKEN')
  console.error('   - 在 Strapi admin 生成：Settings → API Tokens → Create → Type: Full access')
  console.error('   - 导出到环境变量，或写到项目根的 .migrate-env 文件')
  process.exit(1)
}

// ======= 工具 =======
const C = { green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', dim: '\x1b[2m', reset: '\x1b[0m' }
const log = (msg, color) => console.log(`${C[color] || ''}${msg}${C.reset}`)

const cacheFile = path.join(ROOT, '.migrate-cache.json')
let cache = {}
try { cache = JSON.parse(await fs.readFile(cacheFile, 'utf8')) } catch {}
const saveCache = () => fs.writeFile(cacheFile, JSON.stringify(cache, null, 2))

// 从 content 提取外链图 URL（markdown + html，跳过已是本地 /uploads 的）
function extractExternalImages(content) {
  const urls = new Set()
  const mdRe = /!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g
  const htmlRe = /<img[^>]+src=["'](https?:\/\/[^"']+)["']/g
  let m
  while ((m = mdRe.exec(content))) urls.add(m[1])
  while ((m = htmlRe.exec(content))) urls.add(m[1])
  // 过滤掉本站图
  return [...urls].filter(u => !u.startsWith(STRAPI_URL))
}

async function download(url) {
  const r = await fetch(url, {
    // 不发 Referer，绕过防盗链
    headers: { 'User-Agent': 'Mozilla/5.0 (migrate-images)' },
    redirect: 'follow',
  })
  if (!r.ok) throw new Error(`下载 HTTP ${r.status}`)
  const buf = Buffer.from(await r.arrayBuffer())
  const contentType = r.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg'
  const urlPath = new URL(url).pathname
  let name = path.basename(urlPath).split('?')[0]
  if (!name || !/\.[a-z0-9]+$/i.test(name)) {
    const ext = contentType.split('/')[1] || 'jpg'
    name = `img-${Date.now()}.${ext}`
  }
  return { buf, name, contentType }
}

async function uploadToStrapi(buf, name, contentType) {
  const form = new FormData()
  form.append('files', new Blob([buf], { type: contentType }), name)
  const r = await fetch(`${STRAPI_URL}/api/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${STRAPI_TOKEN}` },
    body: form,
  })
  if (!r.ok) throw new Error(`上传 HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`)
  const data = await r.json()
  const uploaded = data?.[0]
  if (!uploaded?.url) throw new Error('上传返回无 url 字段')
  return uploaded.url  // /uploads/xxx.jpg
}

async function processImage(url) {
  if (cache[url]) return cache[url]
  try {
    const { buf, name, contentType } = await download(url)
    if (DRY_RUN) {
      log(`  [dry-run] 会上传 ${name} (${(buf.length / 1024).toFixed(1)}KB)`, 'dim')
      return url
    }
    const uploadedPath = await uploadToStrapi(buf, name, contentType)
    cache[url] = uploadedPath
    await saveCache()
    return uploadedPath
  } catch (e) {
    log(`  ✗ ${url}\n      ${e.message}`, 'red')
    return url
  }
}

// ======= Strapi API =======
async function fetchAllArticles() {
  const all = []
  let page = 1
  while (true) {
    const r = await fetch(
      `${STRAPI_URL}/api/articles?pagination[page]=${page}&pagination[pageSize]=100&publicationState=preview`,
      { headers: { Authorization: `Bearer ${STRAPI_TOKEN}` } },
    )
    if (!r.ok) throw new Error(`fetch articles: HTTP ${r.status}: ${await r.text()}`)
    const data = await r.json()
    all.push(...(data.data || []))
    const p = data.meta?.pagination
    if (!p || p.page >= p.pageCount) break
    page++
  }
  return all
}

async function updateArticle(documentId, content) {
  if (DRY_RUN) return
  const r = await fetch(`${STRAPI_URL}/api/articles/${documentId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${STRAPI_TOKEN}`,
    },
    body: JSON.stringify({ data: { content } }),
  })
  if (!r.ok) throw new Error(`PUT /articles/${documentId}: HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`)
}

// ======= 主流程 =======
log(`\n=== migrate-images ${DRY_RUN ? '[DRY RUN]' : ''} ===`, 'green')
log(`Strapi:  ${STRAPI_URL}`, 'dim')
log(`Cache:   ${cacheFile} (${Object.keys(cache).length} 条)\n`, 'dim')

const articles = await fetchAllArticles()
log(`共 ${articles.length} 篇文章\n`, 'green')

let totalImgs = 0, migrated = 0, failed = 0, articlesUpdated = 0
for (const a of articles) {
  const urls = extractExternalImages(a.content || '')
  if (!urls.length) continue
  log(`📄 ${a.title}  ${C.dim}(slug=${a.slug}, ${urls.length} 张外链图)${C.reset}`)
  let content = a.content
  for (const url of urls) {
    totalImgs++
    const newUrl = await processImage(url)
    if (newUrl === url) {
      failed++
    } else {
      // 两种链接都替换：markdown ()(url) 和 html src="url"
      content = content.split(url).join(newUrl)
      migrated++
      log(`  ✓ ${url}\n      → ${newUrl}`, 'green')
    }
  }
  if (content !== a.content) {
    try {
      await updateArticle(a.documentId, content)
      articlesUpdated++
    } catch (e) {
      log(`  ✗ 更新文章失败: ${e.message}`, 'red')
    }
  }
}

log(`\n=== 完成 ===`, 'green')
log(`外链图片:   处理 ${totalImgs} 张 | ✓ ${migrated} 成功 | ✗ ${failed} 失败`)
log(`文章更新:   ${articlesUpdated} / ${articles.length} 篇`)
log(`缓存文件:   ${cacheFile}（下次运行自动跳过已迁移的 URL）`)
if (DRY_RUN) log(`\n💡 dry-run 模式没实际改内容。去掉 --dry-run 重跑即可执行。`, 'yellow')
