import { StrictMode, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import '../../assets/styles.css'
import { Rng } from '../lib/rng'
import { clearAll, ensureRound, readRound, regenerateRound, type Round, type WorkflowId } from '../lib/store'

export interface RoundOptions<T> {
  /** true：每次页面加载都重开一轮（动态扰动，A 页专用） */
  fresh?: boolean
  build: (rng: Rng, seed: number) => T
}

export function startRound<T>(wf: WorkflowId, options: RoundOptions<T>): Round<T> {
  return options.fresh
    ? regenerateRound(wf, options.build)
    : ensureRound(wf, options.build)
}

export function mount(element: ReactElement): void {
  const container = document.getElementById('root')
  if (!container) throw new Error('缺少 #root 容器')
  installDebugBridge()
  createRoot(container).render(<StrictMode>{element}</StrictMode>)
}

/** 给自动化评测脚本的控制台入口：window.mockOffice.inspect() / .reset() */
function installDebugBridge(): void {
  const wfIds: WorkflowId[] = ['w01', 'w02', 'w03']
  const api = {
    inspect: () => Object.fromEntries(wfIds.map((wf) => [wf, readRound<unknown>(wf)])),
    clearAll,
    version: '0.1.0',
  }
  Object.assign(window as unknown as Record<string, unknown>, { mockOffice: api })
}
