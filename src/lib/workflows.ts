import type { WorkflowId } from './store'

export type { WorkflowId } from './store'

export type PageRole = 'source' | 'form' | 'audit' | 'task' | 'catalog'

export interface PageMeta {
  /** 不含扩展名的文件名，同时也是 URL 片段 */
  file: string
  label: string
  role: PageRole
  note: string
}

export interface WorkflowMeta {
  id: WorkflowId
  code: string
  dir: string
  name: string
  scenario: string
  pages: PageMeta[]
}

export const WORKFLOWS: WorkflowMeta[] = [
  {
    id: 'w01',
    code: 'Workflow 01',
    dir: 'workflow-01-reimbursement',
    name: '智能报销与审批闭环',
    scenario: '员工在发票池取到本轮待报销发票，填报销单，主管在审批后台通过或驳回。',
    pages: [
      { file: 'source', label: 'A · 发票数据池', role: 'source', note: '每页刷新自动重开一轮' },
      { file: 'form', label: 'B · 报销单填写', role: 'form', note: '餐饮必须附合规说明' },
      { file: 'audit', label: 'C · 主管审批后台', role: 'audit', note: '定位目标单据并审批' },
    ],
  },
  {
    id: 'w02',
    code: 'Workflow 02',
    dir: 'workflow-02-weekly-report',
    name: '日常周报自动汇总与提交',
    scenario: '从个人工作台提取本周已完成任务与核心指标，切到 OA 周报页按要求填写并正式提交。',
    pages: [
      { file: 'dashboard', label: 'A · 个人工作台', role: 'source', note: '每页刷新自动重开一轮' },
      { file: 'editor', label: 'B · 周报编辑提交', role: 'form', note: '指标需与工作台精确一致' },
    ],
  },
  {
    id: 'w03',
    code: 'Workflow 03',
    dir: 'workflow-03-asset-apply',
    name: '行政资产/设备领用申请',
    scenario: '查询资产目录与剩余库存，填写多级联动领用申请，提交后生成订单并锁定库存。',
    pages: [
      { file: 'catalog', label: 'A · 资产目录与库存', role: 'catalog', note: '含零库存干扰项' },
      { file: 'apply', label: 'B · 联动领用申请', role: 'form', note: '大类→型号联动 / 日期约束' },
    ],
  },
]

export function workflowById(id: WorkflowId): WorkflowMeta {
  const meta = WORKFLOWS.find((item) => item.id === id)
  if (!meta) throw new Error(`未知工作流: ${id}`)
  return meta
}

/** 主页 → 工作流页面 */
export function hrefFromRoot(meta: WorkflowMeta, page: PageMeta): string {
  return `${meta.dir}/${page.file}.html`
}

/** 工作流页面 → 主页 */
export const HOME_HREF = '../index.html'

/** 工作流页面 → 同流程其它页面 */
export function siblingHref(file: string): string {
  return `${file}.html`
}

/** 工作流页面 → 其它流程的页面 */
export function crossWorkflowHref(id: WorkflowId, file: string): string {
  const meta = workflowById(id)
  return `../${meta.dir}/${file}.html`
}

export function specHref(meta: WorkflowMeta): string {
  return `../${meta.dir}/spec.json`
}
