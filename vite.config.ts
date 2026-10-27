import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

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

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: Object.fromEntries(entries.map((entry) => [entry, resolve(process.cwd(), entry)])),
    },
  },
})
