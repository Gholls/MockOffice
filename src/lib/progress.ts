import { readLog, readRound, type WorkflowId } from './store'
import { WORKFLOWS, workflowById, type WorkflowMeta } from './workflows'
import { SPECS } from './specs'
import { scoreWorkflow, type WorkflowScore } from './checks'
import { formsFor, readForms, type W01Data } from '../workflows/w01'
import { latestSubmitted, type W02Data } from '../workflows/w02'
import { readOrders, type W03Data } from '../workflows/w03'

export type FlowStatus = 'not-started' | 'in-progress' | 'complete'

export interface FlowView {
  meta: WorkflowMeta
  progress: FlowProgress
  score: WorkflowScore
}

/** 主页一次性算出三条流程的进度与得分 */
export function flowViews(): FlowView[] {
  return WORKFLOWS.map((meta) => ({
    meta,
    progress: flowProgress(meta.id),
    score: scoreWorkflow(meta.id, SPECS[meta.id]),
  }))
}

export interface FlowProgress {
  workflow: WorkflowId
  meta: WorkflowMeta
  status: FlowStatus
  /** 建议的下一个页面（流程内的 file 名，如 'form'） */
  nextFile: string
  nextLabel: string
  /** 一句话说明为什么建议去这一步，直接显示在卡片上 */
  reason: string
  runId: string | null
  doneSteps: number
  totalSteps: number
  /** 已走完的步骤，用于步骤条打勾 */
  completedFiles: string[]
}

/**
 * 依据 localStorage 推导每条流程走到了哪一步。
 * 三条流程的闭环判据各不相同，这里按各自的状态机显式实现，
 * 而不是抽象出一个「通用流程引擎」。
 */
export function flowProgress(workflow: WorkflowId): FlowProgress {
  const meta = workflowById(workflow)
  const base = { workflow, meta, totalSteps: meta.pages.length, runId: readRound(workflow)?.runId ?? null }
  const resolver = workflow === 'w01' ? progressW01 : workflow === 'w02' ? progressW02 : progressW03
  return { ...base, ...resolver(base.runId) }
}

type Resolver = (runId: string | null) => Omit<FlowProgress, 'workflow' | 'meta' | 'totalSteps' | 'runId'>

const progressW01: Resolver = () => {
  const round = readRound<W01Data>('w01')
  if (!round) {
    return {
      status: 'not-started',
      nextFile: 'source',
      nextLabel: '开始本轮：读取发票池',
      reason: '尚未生成本轮发票数据。',
      doneSteps: 0,
      completedFiles: [],
    }
  }
  const forms = formsFor(readForms(readLog('w01'), round), round.data.targetInvoiceNo)
  if (forms.length === 0) {
    return {
      status: 'in-progress',
      nextFile: 'form',
      nextLabel: '继续：填写报销单',
      reason: `本轮待报销发票 ${round.data.targetInvoiceNo} 还没有提交报销单。`,
      doneSteps: 1,
      completedFiles: ['source'],
    }
  }
  const pending = forms.filter((form) => form.decision === null)
  if (pending.length > 0) {
    return {
      status: 'in-progress',
      nextFile: 'audit',
      nextLabel: '继续：主管审批',
      reason: `已提交 ${forms.length} 张，其中 ${pending.length} 张待审批。`,
      doneSteps: 2,
      completedFiles: ['source', 'form'],
    }
  }
  return {
    status: 'complete',
    nextFile: 'audit',
    nextLabel: '查看审批结果',
    reason: '目标单据均已完成审批，闭环达成。',
    doneSteps: 3,
    completedFiles: ['source', 'form', 'audit'],
  }
}

const progressW02: Resolver = () => {
  const round = readRound<W02Data>('w02')
  if (!round) {
    return {
      status: 'not-started',
      nextFile: 'dashboard',
      nextLabel: '开始本轮：查看工作台',
      reason: '尚未生成本周任务与指标数据。',
      doneSteps: 0,
      completedFiles: [],
    }
  }
  const submitted = latestSubmitted(readLog('w02'), round)
  if (!submitted) {
    const drafts = round ? readLog('w02').filter((entry) => entry.action === 'save_draft').length : 0
    return {
      status: 'in-progress',
      nextFile: 'editor',
      nextLabel: drafts > 0 ? '继续：草稿需正式提交' : '继续：填写并提交周报',
      reason: drafts > 0 ? `已存 ${drafts} 次草稿，但草稿不计入闭环。` : '本周工作台数据已就绪，周报尚未正式提交。',
      doneSteps: 1,
      completedFiles: ['dashboard'],
    }
  }
  return {
    status: 'complete',
    nextFile: 'editor',
    nextLabel: '查看提交记录',
    reason: '周报已正式提交，闭环达成。',
    doneSteps: 2,
    completedFiles: ['dashboard', 'editor'],
  }
}

const progressW03: Resolver = () => {
  const round = readRound<W03Data>('w03')
  if (!round) {
    return {
      status: 'not-started',
      nextFile: 'catalog',
      nextLabel: '开始本轮：查询资产目录',
      reason: '尚未生成本轮资产目录与库存。',
      doneSteps: 0,
      completedFiles: [],
    }
  }
  const orders = readOrders(readLog('w03'), round)
  if (orders.length === 0) {
    return {
      status: 'in-progress',
      nextFile: 'apply',
      nextLabel: '继续：提交领用申请',
      reason: '目录与库存已就绪，本轮还没有领用订单。',
      doneSteps: 1,
      completedFiles: ['catalog'],
    }
  }
  return {
    status: 'complete',
    nextFile: 'catalog',
    nextLabel: '查看锁定库存',
    reason: `已生成 ${orders.length} 张订单并锁定库存，闭环达成。`,
    doneSteps: 2,
    completedFiles: ['catalog', 'apply'],
  }
}
