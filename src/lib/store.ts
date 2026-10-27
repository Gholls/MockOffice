import { useSyncExternalStore } from 'react'
import { Rng, randomSeed } from './rng'

/**
 * 基于 localStorage 的全局状态机。
 * 每个工作流两类 key：
 *   mockoffice.<wf>.round —— 当前轮次的动态数据（含 seed，可复现 Ground Truth）
 *   mockoffice.<wf>.log   —— Agent 产生的动作流水（提交/审批/领用单），重开轮次不清空
 */
export const NAMESPACE = 'mockoffice'

export type WorkflowId = 'w01' | 'w02' | 'w03'

export interface Round<T> {
  runId: string
  seed: number
  createdAt: string
  data: T
}

export interface LogEntry {
  at: string
  action: string
  detail: Record<string, unknown>
}

const listeners = new Set<() => void>()

function emit() {
  for (const listener of Array.from(listeners)) listener()
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', emit)
  // 同一文档内的写入由 writeJson 主动广播；此处兜底处理 dev 热更新后的重订阅。
}

/** 评测模式：`?eval=1` 时页面才渲染标准答案，避免 Agent 直接读屏泄题。 */
export function evalMode(): boolean {
  try {
    return new URLSearchParams(window.location.search).has('eval')
  } catch {
    return false
  }
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function roundKey(wf: WorkflowId): string {
  return `${NAMESPACE}.${wf}.round`
}

export function logKey(wf: WorkflowId): string {
  return `${NAMESPACE}.${wf}.log`
}

export function readJson<T>(key: string, fallback: T): T {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(key)
  } catch {
    return fallback
  }
  const cached = cache.get(key)
  if (cached && cached.raw === raw) return cached.value as T
  let value: unknown = fallback
  if (raw !== null) {
    try {
      value = JSON.parse(raw) as unknown
    } catch {
      value = fallback
    }
  }
  cache.set(key, { raw, value })
  return value as T
}

export function writeJson(key: string, value: unknown): void {
  const raw = JSON.stringify(value)
  cache.set(key, { raw, value })
  try {
    window.localStorage.setItem(key, raw)
  } catch {
    /* 隐私模式下写入失败不应中断页面，状态仅在当前会话内存中可见 */
  }
  emit()
}

const cache = new Map<string, { raw: string | null; value: unknown }>()

export function newRunId(prefix = 'RUN'): string {
  const now = new Date()
  const stamp = `${String(now.getFullYear()).slice(2)}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${prefix}-${stamp}-${rand}`
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** 读取当前轮次；不存在时按 factory 新建并落盘。 */
export function ensureRound<T>(wf: WorkflowId, factory: (rng: Rng, seed: number) => T): Round<T> {
  const existing = readJson<Round<T> | null>(roundKey(wf), null)
  if (existing && existing.data) return existing
  return regenerateRound(wf, factory)
}

/** 重开一轮：随机 seed + 全新数据，用于「防硬编码/动态扰动」。 */
export function regenerateRound<T>(
  wf: WorkflowId,
  factory: (rng: Rng, seed: number) => T,
): Round<T> {
  const seed = randomSeed()
  const round: Round<T> = {
    runId: newRunId(wf.toUpperCase()),
    seed,
    createdAt: new Date().toISOString(),
    data: factory(new Rng(seed), seed),
  }
  writeJson(roundKey(wf), round)
  return round
}

export function readRound<T>(wf: WorkflowId): Round<T> | null {
  return readJson<Round<T> | null>(roundKey(wf), null)
}

export function readLog(wf: WorkflowId): LogEntry[] {
  return readJson<LogEntry[]>(logKey(wf), [])
}

/** 动作是否发生在指定轮次创建之后（重开轮次会作废上一轮进度） */
export function withinRound(roundCreatedAt: string, actionAt: string): boolean {
  return Date.parse(actionAt) >= Date.parse(roundCreatedAt)
}

export function logEntriesInRound<T>(round: Round<unknown> | null, log: LogEntry[], action: string): T[] {
  if (!round) return []
  return log
    .filter((entry) => entry.action === action && withinRound(round.createdAt, entry.at))
    .map((entry) => entry.detail as unknown as T)
}

export function appendLog(wf: WorkflowId, action: string, detail: Record<string, unknown>): LogEntry[] {
  const next = [...readLog(wf), { at: new Date().toISOString(), action, detail }]
  writeJson(logKey(wf), next)
  return next
}

/** 清空动作流水（保留当前轮次数据）。 */
export function clearLog(wf: WorkflowId): void {
  writeJson(logKey(wf), [])
}

/** 全局重置：Scorecard 与所有工作流回到初始态。 */
export function clearAll(): void {
  const workflowIds: WorkflowId[] = ['w01', 'w02', 'w03']
  for (const wf of workflowIds) {
    try {
      window.localStorage.removeItem(roundKey(wf))
      window.localStorage.removeItem(logKey(wf))
    } catch {
      /* ignore */
    }
  }
  emit()
}

/** 读取当前轮次（由页面入口在挂载前完成初始化，见 src/entries/boot.tsx）。 */
export function useRound<T>(wf: WorkflowId): Round<T> | null {
  return useSyncExternalStore<Round<T> | null>(
    subscribe,
    () => readRound<T>(wf),
    () => readRound<T>(wf),
  )
}

export function useLog(wf: WorkflowId): LogEntry[] {
  return useSyncExternalStore(
    subscribe,
    () => readJson<LogEntry[]>(logKey(wf), []),
    () => readJson<LogEntry[]>(logKey(wf), []),
  )
}

export function useSnapshot<T>(key: string, fallback: T): T {
  return useSyncExternalStore(
    subscribe,
    () => readJson<T>(key, fallback),
    () => readJson<T>(key, fallback),
  )
}
