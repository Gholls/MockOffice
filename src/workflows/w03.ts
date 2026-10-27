import { Rng } from '../lib/rng'
import { appendLog, readLog, withinRound, type LogEntry, type Round } from '../lib/store'

export interface AssetModel {
  id: string
  name: string
  spec: string
  price: number
  /** 本轮初始库存；锁定量由订单流水推导 */
  stock: number
}

export interface AssetCategory {
  id: string
  name: string
  models: AssetModel[]
}

export interface W03Data {
  applicant: { name: string; department: string; seat: string }
  catalog: AssetCategory[]
  maxQuantityPerOrder: number
  budgetCap: number
  /** 期望交付日期需落在 [今天 + leadDays, 今天 + windowDays] 且为工作日 */
  leadDays: number
  windowDays: number
  minReasonChars: number
}

export interface AssetOrder {
  orderId: string
  createdAt: string
  categoryId: string
  categoryName: string
  modelId: string
  modelName: string
  quantity: number
  unitPrice: number
  total: number
  reason: string
  deliveryDate: string
}

export interface ApplicationForm {
  categoryId: string
  modelId: string
  quantity: number
  reason: string
  deliveryDate: string
}

interface ModelTemplate {
  name: string
  spec: string
  price: number
}

const CATALOG_TEMPLATE: { name: string; models: ModelTemplate[] }[] = [
  {
    name: '笔记本电脑',
    models: [
      { name: 'MacBook Pro 14', spec: 'M4 Pro / 24G / 1T', price: 18999 },
      { name: 'ThinkPad X1 Carbon', spec: 'Ultra 7 / 32G / 1T', price: 13499 },
      { name: 'Dell XPS 13', spec: 'Core 7 / 16G / 512G', price: 9899 },
      { name: '华为 MateBook X Pro', spec: 'Ultra 9 / 32G / 2T', price: 15499 },
    ],
  },
  {
    name: '显示器',
    models: [
      { name: 'Dell U2724D', spec: '27 寸 2K 120Hz', price: 2899 },
      { name: 'LG 27UP850', spec: '27 寸 4K Type-C', price: 3299 },
      { name: '明基 PD2730S', spec: '27 寸 4K 设计款', price: 4199 },
    ],
  },
  {
    name: '人体工学与外设',
    models: [
      { name: 'Herman Miller Sayl', spec: '人体工学椅 标准版', price: 4980 },
      { name: '西昊 Doro C300', spec: '人体工学椅 网布', price: 2299 },
      { name: '罗技 MX Master 3S', spec: '无线鼠标', price: 699 },
      { name: 'NiYi 机械键盘', spec: '87 键 热插拔', price: 899 },
    ],
  },
  {
    name: '移动与测试设备',
    models: [
      { name: 'iPad Pro 11', spec: 'M4 / 256G 测试机', price: 7499 },
      { name: 'Pixel 8 Pro', spec: 'Android 测试机', price: 6299 },
      { name: '小米 14 Ultra', spec: 'Android 测试机', price: 5999 },
    ],
  },
]

function isoDay(offsetDays: number): string {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function buildW03Round(rng: Rng): W03Data {
  const catalog: AssetCategory[] = rng
    .shuffle(CATALOG_TEMPLATE.slice())
    .slice(0, 3)
    .map((category, ci) => ({
      id: `CAT-${ci + 1}`,
      name: category.name,
      models: rng.sample(category.models, Math.min(category.models.length, rng.int(2, 4))).map((model, mi) => ({
        id: `CAT-${ci + 1}-M${mi + 1}`,
        name: model.name,
        spec: model.spec,
        price: model.price,
        stock: rng.int(0, 9),
      })),
    }))

  // 保证存在「缺货」干扰项，同时保证不至于全部缺货
  const zeroTarget = rng.pick(catalog.flatMap((category) => category.models))
  zeroTarget.stock = 0
  if (catalog.every((category) => category.models.every((model) => model.stock === 0))) {
    catalog[0].models[0].stock = rng.int(1, 5)
  }

  return {
    applicant: {
      name: rng.pick(['林知远', '陈牧野', '苏晚晴', '周予安', '何言蹊']),
      department: rng.pick(['研发中心', '增长市场部', '客户成功部', '平台架构组']),
      seat: `${rng.int(3, 18)}F-${rng.pick(['A', 'B', 'C'])}${rng.int(1, 40).toString().padStart(2, '0')}`,
    },
    catalog,
    maxQuantityPerOrder: 2,
    budgetCap: 20000,
    leadDays: 1,
    windowDays: 14,
    minReasonChars: 12,
  }
}

export function findModel(data: W03Data, modelId: string): { category: AssetCategory; model: AssetModel } | null {
  for (const category of data.catalog) {
    const model = category.models.find((item) => item.id === modelId)
    if (model) return { category, model }
  }
  return null
}

export function createOrder(form: ApplicationForm, data: W03Data): AssetOrder {
  const found = findModel(data, form.modelId)
  const order: AssetOrder = {
    orderId: `AD-${Date.now().toString(36).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    categoryId: form.categoryId,
    categoryName: found?.category.name ?? '',
    modelId: form.modelId,
    modelName: found?.model.name ?? '',
    quantity: form.quantity,
    unitPrice: found?.model.price ?? 0,
    total: (found?.model.price ?? 0) * form.quantity,
    reason: form.reason,
    deliveryDate: form.deliveryDate,
  }
  appendLog('w03', 'create_order', order as unknown as Record<string, unknown>)
  return order
}

export function recordValidationBlock(reason: string, fields: Record<string, unknown>): void {
  appendLog('w03', 'validation_block', { reason, ...fields })
}

export function readOrders(log: LogEntry[] = readLog('w03'), round?: Round<unknown> | null): AssetOrder[] {
  const out: AssetOrder[] = []
  for (const entry of log) {
    if (entry.action !== 'create_order') continue
    if (round && !withinRound(round.createdAt, entry.at)) continue
    out.push(entry.detail as unknown as AssetOrder)
  }
  return out
}

/** 已被订单锁定的数量（不含 pendingOrders 中当前这一单） */
export function lockedQuantity(orders: AssetOrder[], modelId: string, upToIndex = orders.length): number {
  return orders.slice(0, upToIndex).reduce((sum, order) => (order.modelId === modelId ? sum + order.quantity : sum), 0)
}

export function remainingStock(data: W03Data, orders: AssetOrder[], modelId: string): number {
  const found = findModel(data, modelId)
  if (!found) return 0
  return found.model.stock - lockedQuantity(orders, modelId)
}

export function deliveryBounds(data: W03Data): { min: string; max: string } {
  return { min: isoDay(data.leadDays), max: isoDay(data.windowDays) }
}

export function isWeekend(dateStr: string): boolean {
  const day = new Date(`${dateStr}T12:00:00`).getDay()
  return day === 0 || day === 6
}

export interface ApplicationIssue {
  field: 'categoryId' | 'modelId' | 'quantity' | 'reason' | 'deliveryDate'
  message: string
}

/** 提交前校验：只指出问题，不回显库存真值以外的信息 */
export function validateApplication(
  data: W03Data,
  orders: AssetOrder[],
  form: ApplicationForm,
): ApplicationIssue[] {
  const issues: ApplicationIssue[] = []
  const category = data.catalog.find((item) => item.id === form.categoryId)
  if (!category) {
    issues.push({ field: 'categoryId', message: '请选择设备大类' })
  }
  const found = form.modelId ? findModel(data, form.modelId) : null
  if (!form.modelId) {
    issues.push({ field: 'modelId', message: '请先选择大类，再选择具体型号' })
  } else if (!found) {
    issues.push({ field: 'modelId', message: '型号不存在' })
  } else if (category && found.category.id !== category.id) {
    issues.push({ field: 'modelId', message: '型号与所选大类不匹配' })
  }

  if (found) {
    const remaining = remainingStock(data, orders, found.model.id)
    if (remaining <= 0) {
      issues.push({ field: 'modelId', message: `${found.model.name} 当前无可领用库存` })
    } else if (!Number.isInteger(form.quantity) || form.quantity < 1) {
      issues.push({ field: 'quantity', message: '领用数量需为不小于 1 的整数' })
    } else {
      if (form.quantity > data.maxQuantityPerOrder) {
        issues.push({
          field: 'quantity',
          message: `单次领用上限 ${data.maxQuantityPerOrder} 台，超出请拆单或走采购流程`,
        })
      }
      if (form.quantity > remaining) {
        issues.push({ field: 'quantity', message: `库存不足，当前剩余 ${remaining} 台` })
      }
      const total = form.quantity * found.model.price
      if (total > data.budgetCap) {
        issues.push({
          field: 'quantity',
          message: `合计 ¥${total.toLocaleString('zh-CN')} 超过单次行政领用额度 ¥${data.budgetCap.toLocaleString('zh-CN')}`,
        })
      }
    }
  }

  if (form.reason.trim().length < data.minReasonChars) {
    issues.push({ field: 'reason', message: `领用理由至少 ${data.minReasonChars} 字，说明用途与必要性` })
  }

  const bounds = deliveryBounds(data)
  if (!form.deliveryDate) {
    issues.push({ field: 'deliveryDate', message: '请选择期望交付日期' })
  } else if (isWeekend(form.deliveryDate)) {
    issues.push({ field: 'deliveryDate', message: '行政不安排周末交付，请改为工作日' })
  } else if (form.deliveryDate < bounds.min || form.deliveryDate > bounds.max) {
    issues.push({
      field: 'deliveryDate',
      message: `交付日期需在 ${bounds.min} ~ ${bounds.max} 之间（含端点）`,
    })
  }
  return issues
}
