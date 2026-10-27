import type { LogEntry, Round, WorkflowId } from './store'
import { readLog, readRound } from './store'
import type { SpecCheck, WorkflowSpec } from './spec'
import {
  formsFor,
  readForms,
  requiredDecision,
  targetInvoice,
  type SubmissionWithDecision,
  type W01Data,
} from '../workflows/w01'
import { completedTasks, latestSubmitted, unfinishedTasks, type StoredReport, type W02Data } from '../workflows/w02'
import {
  deliveryBounds,
  findModel,
  isWeekend,
  lockedQuantity,
  readOrders,
  type AssetOrder,
  type W03Data,
} from '../workflows/w03'

export interface CheckOutcome {
  id: string
  kind: string
  title: string
  weight: number
  pass: boolean
  detail: string
  hint?: string
}

export interface WorkflowScore {
  workflow: WorkflowId
  spec: WorkflowSpec | null
  error: string | null
  runId: string | null
  seed: number | null
  outcomes: CheckOutcome[]
  score: number
  max: number
  actionCount: number
}

interface Ctx {
  round: Round<unknown> | null
  log: LogEntry[]
}

type Verdict = { pass: boolean; detail: string }
type Evaluator = (check: SpecCheck, ctx: Ctx) => Verdict

const ok = (detail: string): Verdict => ({ pass: true, detail })
const no = (detail: string): Verdict => ({ pass: false, detail })

function w01View(ctx: Ctx) {
  if (!ctx.round) return null
  const data = ctx.round.data as W01Data
  const invoice = targetInvoice(data)
  const forms = formsFor(readForms(ctx.log, ctx.round), data.targetInvoiceNo)
  return { data, invoice, forms, latest: forms[forms.length - 1] as SubmissionWithDecision | undefined }
}

function w02View(ctx: Ctx) {
  if (!ctx.round) return null
  return { data: ctx.round.data as W02Data, report: latestSubmitted(ctx.log, ctx.round) as StoredReport | null }
}

function w03View(ctx: Ctx) {
  if (!ctx.round) return null
  const data = ctx.round.data as W03Data
  const orders = readOrders(ctx.log, ctx.round)
  const order = orders[orders.length - 1] as AssetOrder | undefined
  const earlier = orders.slice(0, Math.max(0, orders.length - 1))
  return { data, orders, order, earlier }
}

const EVALUATORS: Record<string, Evaluator> = {
  roundStarted: (_check, ctx) =>
    ctx.round ? ok(`轮次 ${ctx.round.runId}（seed=${ctx.round.seed}）`) : no('尚未访问任一流程的 A 页'),

  // ---------- Workflow 01 ----------
  targetSubmitted: (_c, ctx) => {
    const view = w01View(ctx)
    if (!view) return no('本轮数据未生成')
    if (!view.latest) return no(`未针对发票号 ${view.data.targetInvoiceNo} 提交报销单`)
    return ok(`已提交 ${view.forms.length} 张目标单据，最新单号 ${view.latest.formId}`)
  },

  fieldMatchesInvoice: (check, ctx) => {
    const view = w01View(ctx)
    if (!view?.latest || !view.invoice) return no('缺少可比对的目标单据')
    const field = String(check.params?.field ?? '')
    const submitted = (view.latest as unknown as Record<string, unknown>)[field]
    const expected = (view.invoice as unknown as Record<string, unknown>)[field]
    const same = field === 'amount' ? Math.abs(Number(submitted) - Number(expected)) <= 0.005 : submitted === expected
    return same
      ? ok(`${field} 与发票一致`)
      : no(`${field} 不一致：提交 ${JSON.stringify(submitted)}，发票为 ${JSON.stringify(expected)}`)
  },

  noteContainsVendor: (_c, ctx) => {
    const view = w01View(ctx)
    if (!view?.latest || !view.invoice) return no('缺少可比对的目标单据')
    return view.latest.note.includes(view.invoice.vendor)
      ? ok('备注包含发票供应商')
      : no(`备注未包含供应商「${view.invoice.vendor}」`)
  },

  mealComplianceGate: (_c, ctx) => {
    const view = w01View(ctx)
    if (!view?.latest) return no('缺少目标单据')
    if (view.latest.category !== '餐饮') return ok(`类别为${view.latest.category || '空'}，闸门不适用`)
    return view.latest.cateringCompliance
      ? ok('餐饮单据已勾选合规说明')
      : no('餐饮单据未勾选「已附带合规说明」')
  },

  targetAudited: (_c, ctx) => {
    const view = w01View(ctx)
    if (!view?.forms.length) return no('尚无目标单据可审批')
    const undecided = view.forms.filter((form) => form.decision === null)
    return undecided.length === 0
      ? ok(`${view.forms.length} 张目标单据均已审批`)
      : no(`仍有 ${undecided.length} 张目标单据待审批`)
  },

  decisionMatchesPolicy: (_c, ctx) => {
    const view = w01View(ctx)
    if (!view?.latest) return no('缺少目标单据')
    if (!view.latest.decision) return no('目标单据尚未审批')
    const expected = requiredDecision(view.data, view.invoice)
    const actual = view.latest.decision.decision
    return actual === expected
      ? ok(`决定 ${actual} 与政策一致`)
      : no(`决定 ${actual}，政策要求 ${expected}（餐饮且 > ¥${view.data.mealCap} 需驳回）`)
  },

  rejectCitesPolicyCode: (_c, ctx) => {
    const view = w01View(ctx)
    if (!view?.latest?.decision) return no('目标单据尚未审批')
    if (view.latest.decision.decision !== 'rejected') return ok('本轮为通过，无需引用政策编号')
    const note = view.latest.decision.note ?? ''
    return note.includes(view.data.policyCode)
      ? ok('驳回意见已引用政策编号')
      : no(`驳回意见缺少政策编号 ${view.data.policyCode}`)
  },

  // ---------- Workflow 02 ----------
  reportSubmitted: (_c, ctx) => {
    const view = w02View(ctx)
    if (!view) return no('本轮数据未生成')
    return view.report ? ok(`正式提交于 ${view.report.savedAt}`) : no('仅保存过草稿或尚未提交')
  },

  summaryCoversCompleted: (_c, ctx) => {
    const view = w02View(ctx)
    if (!view?.report) return no('缺少正式提交的周报')
    const missing = completedTasks(view.data).filter((task) => !view.report!.summary.includes(task.title))
    return missing.length === 0
      ? ok('已逐条覆盖全部已完成任务')
      : no(`缺少 ${missing.length} 条：${missing.map((t) => t.title).join(' / ')}`)
  },

  summaryExcludesUnfinished: (_c, ctx) => {
    const view = w02View(ctx)
    if (!view?.report) return no('缺少正式提交的周报')
    const leaked = unfinishedTasks(view.data).filter((task) => view.report!.summary.includes(task.title))
    return leaked.length === 0 ? ok('未混入未完成任务') : no(`混入 ${leaked.length} 条未完成任务`)
  },

  summaryMinLength: (_c, ctx) => {
    const view = w02View(ctx)
    if (!view?.report) return no('缺少正式提交的周报')
    const length = view.report.summary.trim().length
    return length >= view.data.minSummaryChars
      ? ok(`${length} 字，满足 ≥${view.data.minSummaryChars}`)
      : no(`仅 ${length} 字，要求 ≥${view.data.minSummaryChars}`)
  },

  metricsExact: (_c, ctx) => {
    const view = w02View(ctx)
    if (!view?.report) return no('缺少正式提交的周报')
    const keys = ['commits', 'mergedPRs', 'reviews', 'bugsClosed'] as const
    const wrong = keys.filter((key) => view.report!.metrics[key] !== view.data.metrics[key])
    return wrong.length === 0
      ? ok('四项核心指标全部精确')
      : no(`${wrong.map((key) => `${key}: 提交${view.report!.metrics[key]} ≠ 实际${view.data.metrics[key]}`).join('；')}`)
  },

  nextPlanMentionsFocus: (_c, ctx) => {
    const view = w02View(ctx)
    if (!view?.report) return no('缺少正式提交的周报')
    return view.report.nextPlan.includes(view.data.nextWeekFocus)
      ? ok(`已包含重点「${view.data.nextWeekFocus}」`)
      : no(`未包含重点「${view.data.nextWeekFocus}」`)
  },

  // ---------- Workflow 03 ----------
  orderCreated: (_c, ctx) => {
    const view = w03View(ctx)
    if (!view) return no('本轮数据未生成')
    return view.order ? ok(`本轮 ${view.orders.length} 张订单，最新 ${view.order.orderId}`) : no('未生成领用订单')
  },

  modelWasInStock: (_c, ctx) => {
    const view = w03View(ctx)
    if (!view?.order) return no('缺少领用订单')
    const found = findModel(view.data, view.order.modelId)
    if (!found) return no(`型号 ${view.order.modelId} 不在本轮目录中`)
    const before = found.model.stock - lockedQuantity(view.earlier, found.model.id)
    return before > 0 ? ok(`提交时剩余 ${before} 台`) : no('提交了缺货型号')
  },

  quantityWithinStock: (_c, ctx) => {
    const view = w03View(ctx)
    if (!view?.order) return no('缺少领用订单')
    const found = findModel(view.data, view.order.modelId)
    if (!found) return no('型号不存在')
    const before = found.model.stock - lockedQuantity(view.earlier, found.model.id)
    if (view.order.quantity > view.data.maxQuantityPerOrder) {
      return no(`数量 ${view.order.quantity} 超单次上限 ${view.data.maxQuantityPerOrder}`)
    }
    return view.order.quantity <= before
      ? ok(`数量 ${view.order.quantity} ≤ 当时剩余 ${before}`)
      : no(`数量 ${view.order.quantity} 超过当时剩余库存 ${before}`)
  },

  withinBudgetCap: (_c, ctx) => {
    const view = w03View(ctx)
    if (!view?.order) return no('缺少领用订单')
    return view.order.total <= view.data.budgetCap
      ? ok(`合计 ¥${view.order.total.toLocaleString('zh-CN')} ≤ 额度`)
      : no(`合计 ¥${view.order.total.toLocaleString('zh-CN')} 超额度 ¥${view.data.budgetCap.toLocaleString('zh-CN')}`)
  },

  deliveryDateValid: (_c, ctx) => {
    const view = w03View(ctx)
    if (!view?.order) return no('缺少领用订单')
    const bounds = deliveryBounds(view.data)
    const date = view.order.deliveryDate
    if (isWeekend(date)) return no(`${date} 是周末，行政不安排交付`)
    if (date < bounds.min || date > bounds.max) return no(`${date} 不在 ${bounds.min} ~ ${bounds.max} 窗口内`)
    return ok(`${date} 为窗口内工作日`)
  },

  reasonSufficient: (_c, ctx) => {
    const view = w03View(ctx)
    if (!view?.order) return no('缺少领用订单')
    const length = view.order.reason.trim().length
    return length >= view.data.minReasonChars
      ? ok(`理由 ${length} 字`)
      : no(`理由仅 ${length} 字，要求 ≥${view.data.minReasonChars}`)
  },

  stockLockedConsistently: (_c, ctx) => {
    const view = w03View(ctx)
    if (!view) return no('本轮数据未生成')
    for (const order of view.orders) {
      if (!findModel(view.data, order.modelId)) return no(`订单 ${order.orderId} 引用了不存在的型号 ${order.modelId}`)
    }
    const negative = view.data.catalog
      .flatMap((category) => category.models)
      .filter((model) => model.stock - lockedQuantity(view.orders, model.id) < 0)
    return negative.length === 0
      ? ok(`${view.orders.length} 张订单共锁定 ${view.orders.reduce((sum, order) => sum + order.quantity, 0)} 台，无负库存`)
      : no(`以下型号被超卖：${negative.map((model) => model.name).join('、')}`)
  },
}

function evaluateCheck(check: SpecCheck, ctx: Ctx): CheckOutcome {
  const evaluator = EVALUATORS[check.kind]
  let verdict: Verdict
  try {
    verdict = evaluator
      ? evaluator(check, ctx)
      : no(`未实现的检查类型「${check.kind}」，请检查 spec.json 与 src/lib/checks.ts 是否同步`)
  } catch (error) {
    // 单条检查异常不能拖垮整个 Scorecard（例如 localStorage 里残留了旧结构）
    verdict = no(`评测异常：${error instanceof Error ? error.message : String(error)}`)
  }
  return {
    id: check.id,
    kind: check.kind,
    title: check.title,
    weight: check.weight,
    pass: verdict.pass,
    detail: verdict.detail,
    hint: check.hint,
  }
}

export function scoreWorkflow(workflow: WorkflowId, spec: WorkflowSpec): WorkflowScore {
  const round = readRound<unknown>(workflow)
  const log = readLog(workflow)
  const ctx: Ctx = { round, log }
  const outcomes = spec.checks.map((check) => evaluateCheck(check, ctx))
  return {
    workflow,
    spec,
    error: null,
    runId: round?.runId ?? null,
    seed: round?.seed ?? null,
    outcomes,
    score: outcomes.filter((outcome) => outcome.pass).reduce((sum, outcome) => sum + outcome.weight, 0),
    max: spec.checks.reduce((sum, check) => sum + check.weight, 0),
    actionCount: log.length,
  }
}

/** 供评测脚本导出：window.mockOffice.inspect() 之外，可在 Scorecard 一键复制 */
export function toReportJson(scores: WorkflowScore[]) {
  return JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      total: scores.reduce((sum, item) => sum + item.score, 0),
      totalMax: scores.reduce((sum, item) => sum + item.max, 0),
      workflows: scores.map((item) => ({
        workflow: item.workflow,
        runId: item.runId,
        seed: item.seed,
        score: item.score,
        max: item.max,
        checks: Object.fromEntries(item.outcomes.map((outcome) => [outcome.id, outcome.pass ? 1 : 0])),
        failed: item.outcomes.filter((outcome) => !outcome.pass).map((outcome) => `${outcome.id} ${outcome.detail}`),
      })),
    },
    null,
    2,
  )
}
