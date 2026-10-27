import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.vite', 'assets'])

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

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), copySpecs()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: Object.fromEntries(entries.map((entry) => [entry, resolve(process.cwd(), entry)])),
    },
  },
})
