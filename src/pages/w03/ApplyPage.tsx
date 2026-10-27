import { useState } from 'react'
import { AppShell, Callout, Field, Panel } from '../../components/ui'
import { useLog, useRound, type LogEntry, type Round } from '../../lib/store'
import { siblingHref } from '../../lib/workflows'
import {
  createOrder,
  deliveryBounds,
  readOrders,
  recordValidationBlock,
  remainingStock,
  validateApplication,
  type ApplicationForm,
  type ApplicationIssue,
  type W03Data,
} from '../../workflows/w03'

const BLANK: ApplicationForm = { categoryId: '', modelId: '', quantity: 1, reason: '', deliveryDate: '' }

export function W03ApplyPage() {
  const round = useRound<W03Data>('w03')
  const log = useLog('w03')
  return (
    <AppShell wf="w03" currentPage="apply" title="B · 资产领用申请（多级联动）" run={round}>
      {round ? (
        <>
          <Callout tone="info" title="本页不展示库存与单价" testId="cross-page-note">
            单价、剩余库存、缺货情况需在 catalog.html 读取后决定型号与数量；提交时系统会按目录实际库存校验并锁定。
          </Callout>
          <ApplyForm round={round} log={log} />
          <OrderHistory round={round} log={log} />
        </>
      ) : (
        <Callout tone="warn">尚未生成本轮数据，请先访问 catalog.html。</Callout>
      )}
    </AppShell>
  )
}

function ApplyForm({ round, log }: { round: Round<W03Data>; log: LogEntry[] }) {
  const [form, setForm] = useState<ApplicationForm>(BLANK)
  const [issues, setIssues] = useState<ApplicationIssue[]>([])
  const [touched, setTouched] = useState(false)
  const [result, setResult] = useState<{ orderId: string; remaining: number; locked: number } | null>(null)
  const bounds = deliveryBounds(round.data)
  const orders = readOrders(log, round)

  const category = round.data.catalog.find((item) => item.id === form.categoryId)
  const issueFor = (field: ApplicationIssue['field']) =>
    issues.find((issue) => issue.field === field)?.message ?? null

  function patch<K extends keyof ApplicationForm>(key: K, value: ApplicationForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setResult(null)
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setTouched(true)
    const found = validateApplication(round.data, orders, form)
    setIssues(found)
    if (found.length > 0) {
      recordValidationBlock(found[0].message, { modelId: form.modelId, quantity: form.quantity })
      setResult(null)
      return
    }
    const order = createOrder(form, round.data)
    setResult({
      orderId: order.orderId,
      locked: order.quantity,
      remaining: remainingStock(round.data, [...orders, order], order.modelId),
    })
    setForm(BLANK)
  }

  return (
    <Panel title="行政资产领用申请单" description={`申请人 ${round.data.applicant.name} · ${round.data.applicant.seat}`} testId="apply-form">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="设备大类" htmlFor="category" required error={touched ? issueFor('categoryId') : null} hint="选择后才会加载对应型号">
            <select
              id="category"
              name="categoryId"
              className="input"
              data-testid="input-category"
              value={form.categoryId}
              onChange={(e) => {
                patch('categoryId', e.target.value)
                patch('modelId', '')
              }}
            >
              <option value="">请选择大类</option>
              {round.data.catalog.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="型号配置"
            htmlFor="model"
            required
            error={touched ? issueFor('modelId') : null}
            hint={category ? `${category.models.length} 个可选型号（库存与单价见资产目录页）` : '需先选择设备大类'}
          >
            <select
              id="model"
              name="modelId"
              className="input"
              data-testid="input-model"
              data-loaded={category ? 'true' : 'false'}
              disabled={!category}
              value={form.modelId}
              onChange={(e) => patch('modelId', e.target.value)}
            >
              <option value="">{category ? '请选择型号' : '请先选择大类'}</option>
              {category?.models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} · {model.spec}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="领用数量"
            htmlFor="quantity"
            required
            error={touched ? issueFor('quantity') : null}
            hint={`单次最多 ${round.data.maxQuantityPerOrder} 台，且不得超过目录剩余库存`}
          >
            <input
              id="quantity"
              name="quantity"
              type="number"
              min={1}
              step={1}
              className="input font-mono"
              data-testid="input-quantity"
              value={form.quantity}
              onChange={(e) => patch('quantity', Number(e.target.value))}
            />
          </Field>

          <Field
            label="期望交付日期"
            htmlFor="delivery-date"
            required
            error={touched ? issueFor('deliveryDate') : null}
            hint={`工作日，范围 ${bounds.min} ~ ${bounds.max}`}
          >
            <input
              id="delivery-date"
              name="deliveryDate"
              type="date"
              className="input font-mono"
              data-testid="input-delivery-date"
              min={bounds.min}
              max={bounds.max}
              value={form.deliveryDate}
              onChange={(e) => patch('deliveryDate', e.target.value)}
            />
          </Field>
        </div>

        <Field
          label="领用理由"
          htmlFor="reason"
          required
          error={touched ? issueFor('reason') : null}
          hint={`至少 ${round.data.minReasonChars} 字，说明用途与必要性`}
        >
          <textarea
            id="reason"
            name="reason"
            rows={3}
            className="input"
            data-testid="input-reason"
            placeholder="例：现用笔记本无法编译主工程，影响日常迭代交付"
            value={form.reason}
            onChange={(e) => patch('reason', e.target.value)}
          />
        </Field>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-primary" data-testid="submit-order">
            提交领用申请
          </button>
          <button type="button" className="btn-secondary" data-testid="clear-form" onClick={() => setForm(BLANK)}>
            清空表单
          </button>
          {touched && issues.length > 0 ? (
            <span className="text-xs text-rose-600" data-testid="blocked-hint">
              共 {issues.length} 处校验未通过
            </span>
          ) : null}
        </div>

        {issues.length > 0 ? (
          <Callout tone="danger" title="申请未通过校验，未生成订单" testId="issue-list">
            <ul className="list-disc pl-5">
              {issues.map((issue) => (
                <li key={issue.message}>{issue.message}</li>
              ))}
            </ul>
          </Callout>
        ) : null}

        {result ? (
          <Callout tone="success" title={`申请已受理，订单号 ${result.orderId}`} testId="order-result">
            本次锁定 {result.locked} 台，该型号剩余库存已更新为 {result.remaining} 台。
            <a className="ml-2 underline" href={siblingHref('catalog')} data-testid="go-catalog">
              回目录页查看库存变化 →
            </a>
          </Callout>
        ) : null}
      </form>
    </Panel>
  )
}

function OrderHistory({ round, log }: { round: Round<W03Data>; log: LogEntry[] }) {
  const orders = readOrders(log, round)
  return (
    <Panel title="本轮领用订单" description="订单写入 localStorage 后即为锁定库存的依据" testId="order-history">
      {orders.length === 0 ? (
        <p className="text-sm text-slate-500" data-testid="empty-orders">
          本轮尚无订单。
        </p>
      ) : (
        <table className="table-base text-xs">
          <thead>
            <tr>
              <th>订单号</th>
              <th>大类 / 型号</th>
              <th className="text-right">数量</th>
              <th className="text-right">合计</th>
              <th>期望交付</th>
              <th>理由</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.orderId} data-testid={`history-${order.orderId}`}>
                <td className="font-mono">{order.orderId}</td>
                <td>
                  {order.categoryName} / <span data-field="model-name">{order.modelName}</span>
                </td>
                <td className="text-right font-mono">{order.quantity}</td>
                <td className="text-right font-mono">¥{order.total.toLocaleString('zh-CN')}</td>
                <td className="font-mono" data-field="delivery-date">
                  {order.deliveryDate}
                </td>
                <td className="max-w-xs truncate text-slate-500">{order.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  )
}
