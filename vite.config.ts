import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { PAGES } from './src/lib/site'
import { headTags } from './src/lib/siteTags'

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.vite', 'assets', 'public'])

/** 每个测试流程的 .html 都是真实入口，URL 与 PRD 目录结构一一对应。 */
function discoverEntries(root: string, prefix = ''): string[] {
  const found: string[] = []
  for (const name of readdirSync(root)) {
    if (name.startsWith('.') || SKIP_DIRS.has(name)) continue
    const abs = resolve(root, name)
    const rel = prefix ? `${prefix}/${name}` : name
    if (statSync(abs).isDirectory()) found.push(...discoverEntries(abs, rel))
    else if (name.endsWith('.html')) found.push(rel)
  }
  return found.sort()
}

const entries = discoverEntries(process.cwd())

function discoverSpecs(root: string, prefix = ''): string[] {
  const found: string[] = []
  for (const name of readdirSync(root)) {
    if (name.startsWith('.') || SKIP_DIRS.has(name)) continue
    const abs = resolve(root, name)
    const rel = prefix ? `${prefix}/${name}` : name
    if (statSync(abs).isDirectory()) found.push(...discoverSpecs(abs, rel))
    else if (name === 'spec.json') found.push(rel)
  }
  return found
}

/** spec.json 同时是外部评测 harness 的输入，需原样出现在 dist 的工作流目录下 */
function copySpecs(): Plugin {
  const root = process.cwd()
  return {
    name: 'mockoffice:copy-specs',
    apply: 'build',
    closeBundle() {
      for (const rel of discoverSpecs(root)) {
        const target = resolve(root, 'dist', rel)
        mkdirSync(dirname(target), { recursive: true })
        copyFileSync(resolve(root, rel), target)
      }
    },
  }
}

const ADSENSE_SRC =
  'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1400861145058456'

/**
 * 全局干扰项：把真实的第三方广告脚本注入每一个 HTML 入口。
 * 放在构建配置而非各页面源码里，保证现有 9 个页面与以后新增页面都不会漏。
 */
function adsenseDistractor(): Plugin {
  return {
    name: 'mockoffice:adsense-distractor',
    transformIndexHtml() {
      return [{ tag: 'script', attrs: { async: '', src: ADSENSE_SRC, crossorigin: 'anonymous' }, injectTo: 'head' }]
    },
  }
}

/** SEO/GEO：title、description、canonical、Open Graph 与 JSON-LD 全部来自注册表 */
function siteMeta(): Plugin {
  const root = process.cwd()
  return {
    name: 'mockoffice:site-meta',
    buildStart() {
      // 新增页面忘了在 src/lib/site.ts 登记会静默丢失全部元数据，因此直接让构建失败
      const missing = entries.filter((entry) => !PAGES.some((page) => page.file === entry))
      if (missing.length > 0) {
        this.error(`以下 HTML 入口未在 src/lib/site.ts 登记：\n  ${missing.join('\n  ')}`)
      }
    },
    transformIndexHtml(html, ctx) {
      // build 时 ctx.filename 是绝对路径，dev 时可能只有 ctx.path（URL 形式）
      const raw = ctx.filename || ctx.path || ''
      const abs = isAbsolute(raw) ? raw : resolve(root, raw.replace(/^\/+/, ''))
      const rel = relative(root, abs).replace(/\\/g, '/')
      const page = PAGES.find((item) => item.file === rel)
      if (!page) return html
      return { html, tags: headTags(page) }
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), copySpecs(), siteMeta(), adsenseDistractor()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: Object.fromEntries(entries.map((entry) => [entry, resolve(process.cwd(), entry)])),
    },
  },
})
