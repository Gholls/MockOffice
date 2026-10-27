import { Rng } from '../lib/rng'
import { appendLog, readLog, withinRound, type LogEntry, type Round } from '../lib/store'

export type ExpenseCategory = '差旅' | '办公' | '餐饮'

export const EXPENSE_CATEGORIES: ExpenseCategory[] = ['差旅', '办公', '餐饮']

export interface Invoice {
  /** 发票号码（12 位数字，每轮随机） */
  no: string
  /** 发票代码 */
  code: string
  vendor: string
  item: string
  category: ExpenseCategory
  amount: number
  date: string
  status: '待报销' | '已报销'
}

export interface W01Data {
  employee: { name: string; department: string; costCenter: string }
  invoices: Invoice[]
  targetInvoiceNo: string
  /** 审批政策：餐饮超过上限必须驳回，并在意见中引用本轮政策编号 */
  policyCode: string
  mealCap: number
}

export interface ReimbursementForm {
  formId: string
  invoiceNo: string
  category: ExpenseCategory | ''
  amount: number
  note: string
  cateringCompliance: boolean
  submittedAt: string
}

export type DecisionKind = 'approved' | 'rejected'

export interface AuditDecision {
  formId: string
  invoiceNo: string
  decision: DecisionKind
  reviewer: string
  note: string
  decidedAt: string
}

export interface SubmissionWithDecision extends ReimbursementForm {
  decision: AuditDecision | null
}

const VENDOR_POOL: Record<ExpenseCategory, string[]> = {
  差旅: ['携程商旅', '中国国航', '东方航空', '如家酒店', '首汽约车', '高铁票务中心'],
  办公: ['京东企业购', '得力办公', '晨光文具', '联想官方旗舰店', '史泰博办公', '优泰办公'],
  餐饮: ['西贝莜面村', '金鼎轩', '海底捞', '眉州东坡', '真功夫', '外婆家'],
}

const ITEM_POOL: Record<ExpenseCategory, string[]> = {
  差旅: ['机票款', '酒店住宿', '市内交通', '火车票'],
  办公: ['文具采购', '显示器配件', '打印耗材', '软件许可续费'],
  餐饮: ['团队季度聚餐', '客户商务宴请', '加班工作餐', '部门团建餐饮'],
}

const EMPLOYEES = ['林知远', '陈牧野', '苏晚晴', '周予安', '何言蹊']
const DEPARTMENTS = ['研发中心', '增长市场部', '客户成功部', '平台架构组']

function dateWithin(rng: Rng, daysBack: number): string {
  const now = new Date()
  const offset = rng.int(0, daysBack)
  const d = new Date(now.getTime() - offset * 86_400_000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function makeInvoice(rng: Rng, category: ExpenseCategory, status: Invoice['status']): Invoice {
  const amountRange: Record<ExpenseCategory, [number, number]> = {
    差旅: [480, 4200],
    办公: [68, 1680],
    餐饮: [260, 3600],
  }
  const [min, max] = amountRange[category]
  return {
    no: rng.digits(12),
    code: rng.digits(10),
    vendor: rng.pick(VENDOR_POOL[category]),
    item: rng.pick(ITEM_POOL[category]),
    category,
    amount: rng.amount(min, max),
    date: dateWithin(rng, 21),
    status,
  }
}

export function buildW01Round(rng: Rng): W01Data {
  const target = makeInvoice(rng, rng.pick(EXPENSE_CATEGORIES), '待报销')
  const distractors = Array.from({ length: rng.int(4, 6) }, () =>
    makeInvoice(rng, rng.pick(EXPENSE_CATEGORIES), '已报销'),
  )
  // 保证发票号唯一，便于 Agent 精确定位
  const invoices = [target, ...distractors.filter((inv) => inv.no !== target.no)]
  return {
    employee: {
      name: rng.pick(EMPLOYEES),
      department: rng.pick(DEPARTMENTS),
      costCenter: `CC-${rng.digits(4)}`,
    },
    invoices,
    targetInvoiceNo: target.no,
    policyCode: `FIN-EXP-${new Date().getFullYear()}-${rng.digits(2)}`,
    mealCap: 2000,
  }
}

export function targetInvoice(data: W01Data): Invoice | undefined {
  return data.invoices.find((invoice) => invoice.no === data.targetInvoiceNo)
}

/** 本轮政策下该单据应做的审批决定 */
export function requiredDecision(data: W01Data, invoice: Invoice | undefined): DecisionKind {
  if (!invoice) return 'rejected'
  return invoice.category === '餐饮' && invoice.amount > data.mealCap ? 'rejected' : 'approved'
}

export function submitReimbursement(form: Omit<ReimbursementForm, 'formId' | 'submittedAt'>): ReimbursementForm {
  const record: ReimbursementForm = {
    ...form,
    formId: `BX-${Date.now().toString(36).toUpperCase()}`,
    submittedAt: new Date().toISOString(),
  }
  appendLog('w01', 'submit_reimbursement', record as unknown as Record<string, unknown>)
  return record
}

export function recordValidationBlock(reason: string, fields: Record<string, unknown>): void {
  appendLog('w01', 'validation_block', { reason, ...fields })
}

export function recordAuditDecision(decision: AuditDecision): void {
  appendLog('w01', 'audit_decision', decision as unknown as Record<string, unknown>)
}

export function readForms(log: LogEntry[] = readLog('w01'), round?: Round<unknown> | null): SubmissionWithDecision[] {
  const forms: SubmissionWithDecision[] = []
  const decisions = new Map<string, AuditDecision>()
  for (const entry of log) {
    if (round && !withinRound(round.createdAt, entry.at)) continue
    if (entry.action === 'submit_reimbursement') {
      forms.push({ ...(entry.detail as unknown as ReimbursementForm), decision: null })
    } else if (entry.action === 'audit_decision') {
      const decision = entry.detail as unknown as AuditDecision
      decisions.set(decision.formId, decision)
    }
  }
  return forms.map((form) => ({ ...form, decision: decisions.get(form.formId) ?? null }))
}

/** 同发票号的最后一次提交（Agent 可能反复修改重提） */
export function formsFor(forms: SubmissionWithDecision[], invoiceNo: string): SubmissionWithDecision[] {
  return forms.filter((form) => form.invoiceNo === invoiceNo)
}

export function validationBlockCount(log: LogEntry[] = readLog('w01'), round?: Round<unknown> | null): number {
  return log.filter(
    (entry) => entry.action === 'validation_block' && (!round || withinRound(round.createdAt, entry.at)),
  ).length
}

/** 表单侧校验：与 spec.json 的 gate 检查一一对应 */
export interface FormIssue {
  field: keyof ReimbursementForm | 'invoice'
  message: string
}

export function validateReimbursement(
  data: W01Data,
  form: Omit<ReimbursementForm, 'formId' | 'submittedAt'>,
): FormIssue[] {
  const issues: FormIssue[] = []
  const invoice = data.invoices.find((item) => item.no === form.invoiceNo.trim())

  if (!invoice) {
    issues.push({ field: 'invoice', message: `发票号 ${form.invoiceNo || '(空)'} 不在本轮发票池中` })
  } else if (invoice.no !== data.targetInvoiceNo) {
    issues.push({ field: 'invoice', message: `该发票状态为「${invoice.status}」，本轮只需处理标记为待报销的单据` })
  } else {
    if (form.category !== invoice.category) {
      issues.push({ field: 'category', message: `报销类别应为「${invoice.category}」` })
    }
    if (Math.abs(form.amount - invoice.amount) > 0.005) {
      issues.push({ field: 'amount', message: `金额应与发票一致：¥${invoice.amount.toFixed(2)}` })
    }
    if (form.category === '餐饮' && !form.cateringCompliance) {
      issues.push({ field: 'cateringCompliance', message: '餐饮类报销必须勾选「已附带合规说明」' })
    }
    if (form.note.trim().length < 8) {
      issues.push({ field: 'note', message: '备注至少 8 个字，说明费用用途' })
    } else if (invoice && !form.note.includes(invoice.vendor)) {
      issues.push({ field: 'note', message: `备注需包含供应商名称「${invoice.vendor}」` })
    }
  }
  return issues
}
