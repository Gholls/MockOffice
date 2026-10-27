import { Rng } from '../lib/rng'
import { appendLog, readLog, withinRound, type LogEntry, type Round } from '../lib/store'

export type TaskStatus = '已完成' | '进行中' | '已阻塞'

export interface WorkTask {
  id: string
  title: string
  status: TaskStatus
  project: string
  points: number
}

export interface WeeklyMetrics {
  commits: number
  mergedPRs: number
  reviews: number
  bugsClosed: number
}

export const METRIC_FIELDS: { key: keyof WeeklyMetrics; label: string }[] = [
  { key: 'commits', label: '代码提交次数' },
  { key: 'mergedPRs', label: '合并 PR 数' },
  { key: 'reviews', label: '完成代码评审数' },
  { key: 'bugsClosed', label: '关闭缺陷数' },
]

export interface W02Data {
  owner: string
  weekLabel: string
  weekRange: string
  tasks: WorkTask[]
  metrics: WeeklyMetrics
  /** 工作台展示但不要求填报的指标，用于干扰精确读数 */
  extraMetrics: { linesChanged: number; meetings: number; incidents: number }
  nextWeekFocus: string
  minSummaryChars: number
}

export interface ReportPayload {
  summary: string
  nextPlan: string
  metrics: WeeklyMetrics
}

export interface StoredReport extends ReportPayload {
  kind: 'draft' | 'submit'
  savedAt: string
}

const PROJECTS = ['结算中台', '用户增长', '基础设施', '数据平台', '客户端']

const TITLE_POOL: Record<TaskStatus, string[]> = {
  已完成: [
    '修复登录态失效导致重复跳转的问题',
    '完成订单结算 API 文档',
    '重构支付回调重试逻辑',
    '上线灰度开关配置面板',
    '补齐对账任务失败告警',
    '优化列表页首屏查询耗时',
    '迁移旧版埋点 SDK',
  ],
  进行中: [
    '排查多机房缓存不一致问题',
    '推进结算规则引擎改造',
    '编写新版导入向导',
    '梳理历史工单归因模型',
    '联调第三方开票接口',
  ],
  已阻塞: ['等待安全团队评审加密方案', '依赖的数据契约尚未冻结', '供应商未回复接口配额'],
}

const FOCUS_PREFIX = ['支付链路', '结算引擎', '对账服务', '用户增长', '数据平台']
const FOCUS_SUFFIX = ['灰度上线', '压测收尾', '二期需求评审', '监控看板补齐', '慢查询治理']

export function buildW02Round(rng: Rng): W02Data {
  const completed = rng.sample(TITLE_POOL.已完成, rng.int(3, 4)).map((title) => makeTask(rng, title, '已完成'))
  const ongoing = rng.sample(TITLE_POOL.进行中, rng.int(2, 3)).map((title) => makeTask(rng, title, '进行中'))
  const blocked = [makeTask(rng, rng.pick(TITLE_POOL.已阻塞), '已阻塞')]
  const weekStart = mondayOf(new Date())
  const weekEnd = new Date(weekStart.getTime() + 6 * 86_400_000)
  return {
    owner: rng.pick(['林知远', '陈牧野', '苏晚晴', '周予安', '何言蹊']),
    weekLabel: `${weekStart.getFullYear()} 年第 ${isoWeek(weekStart)} 周`,
    weekRange: `${formatDate(weekStart)} ~ ${formatDate(weekEnd)}`,
    tasks: rng.shuffle([...completed, ...ongoing, ...blocked]),
    metrics: {
      commits: rng.int(7, 42),
      mergedPRs: rng.int(2, 15),
      reviews: rng.int(1, 12),
      bugsClosed: rng.int(0, 9),
    },
    extraMetrics: { linesChanged: rng.int(320, 4200), meetings: rng.int(2, 11), incidents: rng.int(0, 3) },
    nextWeekFocus: `${rng.pick(FOCUS_PREFIX)}${rng.pick(FOCUS_SUFFIX)}`,
    minSummaryChars: 40,
  }
}

function makeTask(rng: Rng, title: string, status: TaskStatus): WorkTask {
  return {
    id: `T-${rng.digits(4)}`,
    // 标题带随机单号：Agent 必须整段搬运，不能凭关键词概括
    title: `${title}（${status === '已完成' ? 'CR' : 'WIP'}-${rng.digits(3)}）`,
    status,
    project: rng.pick(PROJECTS),
    points: rng.int(1, 8),
  }
}

export function completedTasks(data: W02Data): WorkTask[] {
  return data.tasks.filter((task) => task.status === '已完成')
}

export function unfinishedTasks(data: W02Data): WorkTask[] {
  return data.tasks.filter((task) => task.status !== '已完成')
}

export function saveDraft(payload: ReportPayload): void {
  appendLog('w02', 'save_draft', { kind: 'draft', ...payload, savedAt: new Date().toISOString() })
}

export function submitReport(payload: ReportPayload): void {
  appendLog('w02', 'submit_report', { kind: 'submit', ...payload, savedAt: new Date().toISOString() })
}

export function recordValidationBlock(reason: string, fields: Record<string, unknown>): void {
  appendLog('w02', 'validation_block', { reason, ...fields })
}

export function readReports(log: LogEntry[] = readLog('w02'), round?: Round<unknown> | null): StoredReport[] {
  const out: StoredReport[] = []
  for (const entry of log) {
    if (entry.action !== 'save_draft' && entry.action !== 'submit_report') continue
    if (round && !withinRound(round.createdAt, entry.at)) continue
    out.push(entry.detail as unknown as StoredReport)
  }
  return out
}

export function latestSubmitted(log: LogEntry[] = readLog('w02'), round?: Round<unknown> | null): StoredReport | null {
  return [...readReports(log, round)].reverse().find((report) => report.kind === 'submit') ?? null
}

export interface ReportIssue {
  field: 'summary' | 'nextPlan' | keyof WeeklyMetrics
  message: string
}

/**
 * 与 spec.json checks 一一对应的前端校验。
 * 提示只说「哪一项不对」，不回显标准答案本身，否则 Agent 可以靠反复试错读出正确值。
 */
export function validateReport(data: W02Data, payload: ReportPayload): ReportIssue[] {
  const issues: ReportIssue[] = []
  const missing = completedTasks(data).filter((task) => !payload.summary.includes(task.title))
  if (missing.length > 0) {
    issues.push({ field: 'summary', message: `总结未逐条覆盖已完成任务，缺少 ${missing.length} 条（需含括号内单号）` })
  }
  const leaked = unfinishedTasks(data).filter((task) => payload.summary.includes(task.title))
  if (leaked.length > 0) {
    issues.push({ field: 'summary', message: `总结混入了 ${leaked.length} 条进行中/已阻塞任务，仅可写入已完成任务` })
  }
  if (payload.summary.trim().length < data.minSummaryChars) {
    issues.push({ field: 'summary', message: `总结至少 ${data.minSummaryChars} 字` })
  }
  if (!payload.nextPlan.includes(data.nextWeekFocus)) {
    issues.push({ field: 'nextPlan', message: '下周计划未包含工作台「下周方向」给出的重点词' })
  }
  for (const field of METRIC_FIELDS) {
    const value = payload.metrics[field.key]
    if (!Number.isFinite(value)) {
      issues.push({ field: field.key, message: `${field.label}需填写整数` })
    } else if (value !== data.metrics[field.key]) {
      issues.push({ field: field.key, message: `${field.label}与工作台数值不一致` })
    }
  }
  return issues
}

function mondayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

function isoWeek(date: Date): number {
  const target = new Date(date.getTime())
  target.setDate(target.getDate() - ((target.getDay() + 6) % 7) + 3)
  const firstThursday = new Date(target.getFullYear(), 0, 4)
  firstThursday.setDate(firstThursday.getDate() - ((firstThursday.getDay() + 6) % 7) + 3)
  return 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 86_400_000))
}

function formatDate(date: Date): string {
  return `${date.getMonth() + 1}.${date.getDate()}`
}
