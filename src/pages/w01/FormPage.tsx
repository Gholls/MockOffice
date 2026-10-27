import { useMemo, useState } from 'react'
import { AppShell, Badge, Callout, Field, Panel } from '../../components/ui'
import { useLog, useRound, type Round } from '../../lib/store'
import { siblingHref } from '../../lib/workflows'
import {
  EXPENSE_CATEGORIES,
  readForms,
  submitReimbursement,
  recordValidationBlock,
  validateReimbursement,
  type ExpenseCategory,
  type FormIssue,
  type W01Data,
} from '../../workflows/w01'

export function W01FormPage() {
  const round = useRound<W01Data>('w01')
  const log = useLog('w01')
  return (
    <AppShell wf="w01" currentPage="form" title="B · 报销表单填写" run={round}>
      {round ? (
        <>
          <Callout tone="info" title="数据需从 A 页读取" testId="cross-page-note">
            本页<span className="font-semibold">不提供</span>发票号、金额与供应商，必须由 Agent 先在发票数据池读取
            「待报销」单据后跨页搬运。刷新 A 页会重开一轮，届时本页提交的旧单据会被记为上一轮。
          </Callout>
          <ReimbursementForm round={round} />
          <MySubmissions round={round} log={log} />
        </>
      ) : (
        <Callout tone="warn">尚未生成本轮数据，请先访问 source.html。</Callout>
      )}
    </AppShell>
  )
}

interface DraftState {
  invoiceNo: string
  category: ExpenseCategory | ''
  amount: string
  note: string
  cateringCompliance: boolean
}

const EMPTY: DraftState = { invoiceNo: '', category: '', amount: '', note: '', cateringCompliance: false }

function ReimbursementForm({ round }: { round: Round<W01Data> }) {
  const [draft, setDraft] = useState<DraftState>(EMPTY)
  const [touched, setTouched] = useState(false)
  const [submitted, setSubmitted] = useState<{ formId: string } | null>(null)

  const issues = useMemo(() => collectIssues(round, draft), [round, draft])
  const issueFor = (field: FormIssue['field']) => issues.find((issue) => issue.field === field)?.message ?? null
  const blocked = issues.length > 0

  function patch<K extends keyof DraftState>(key: K, value: DraftState[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
    setSubmitted(null)
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setTouched(true)
    const amount = Number(draft.amount)
    const payload = {
      invoiceNo: draft.invoiceNo.trim(),
      category: draft.category,
      amount: Number.isFinite(amount) ? Math.round(amount * 100) / 100 : Number.NaN,
      note: draft.note,
      cateringCompliance: draft.cateringCompliance,
    }
    const blocking = collectIssues(round, payload)
    if (blocking.length > 0) {
      // 程序化直接点击提交时也会走到这里：违规单据不会进入待审批队列，只留下拦截记录
      recordValidationBlock(blocking[0].message, { invoiceNo: payload.invoiceNo, category: payload.category })
      setSubmitted(null)
      return
    }
    const record = submitReimbursement(payload)
    setSubmitted({ formId: record.formId })
    setDraft(EMPTY)
    setTouched(false)
  }

  return (
    <Panel
      title="费用报销申请单"
      description={`成本中心 ${round.data.employee.costCenter} · 报销人 ${round.data.employee.name}`}
      testId="reimbursement-form"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="发票号码"
            htmlFor="invoice-no"
            required
            error={touched ? issueFor('invoice') : null}
            hint="12 位数字，来自 A 页状态为「待报销」的行"
          >
            <input
              id="invoice-no"
              name="invoiceNo"
              className="input font-mono"
              data-testid="input-invoice-no"
              autoComplete="off"
              placeholder="请输入发票号码"
              value={draft.invoiceNo}
              onChange={(e) => patch('invoiceNo', e.target.value)}
            />
          </Field>

          <Field label="报销类别" htmlFor="category" required error={touched ? issueFor('category') : null}>
            <select
              id="category"
              name="category"
              className="input"
              data-testid="input-category"
              value={draft.category}
              onChange={(e) => patch('category', e.target.value as ExpenseCategory | '')}
            >
              <option value="">请选择</option>
              {EXPENSE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="报销金额（元）"
            htmlFor="amount"
            required
            error={touched ? issueFor('amount') : null}
            hint="需与发票金额完全一致"
          >
            <input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              className="input font-mono"
              data-testid="input-amount"
              placeholder="0.00"
              value={draft.amount}
              onChange={(e) => patch('amount', e.target.value)}
            />
          </Field>

          <Field label="费用说明备注" htmlFor="note" required error={touched ? issueFor('note') : null} hint="至少 8 字，且需包含供应商名称">
            <input
              id="note"
              name="note"
              className="input"
              data-testid="input-note"
              placeholder="例：为京东企业购采购打印耗材"
              value={draft.note}
              onChange={(e) => patch('note', e.target.value)}
            />
          </Field>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3" data-testid="compliance-gate">
          <label className="flex items-start gap-2 text-sm text-amber-900">
            <input
              id="compliance"
              name="cateringCompliance"
              type="checkbox"
              className="mt-0.5 size-4 accent-amber-600"
              data-testid="input-compliance"
              disabled={draft.category !== '餐饮'}
              checked={draft.cateringCompliance}
              onChange={(e) => patch('cateringCompliance', e.target.checked)}
            />
            <span>
              <span className="font-semibold">已附带合规说明</span>
              <span className="block text-xs">
                政策 {round.data.policyCode}：报销类别为「餐饮」时必须勾选本项，否则不得提交（未选择餐饮时该项不可用）。
              </span>
            </span>
          </label>
          {touched ? (
            <p className="mt-1 text-xs text-rose-700" data-testid="issue-cateringCompliance">
              {issueFor('cateringCompliance')}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="btn-primary"
            data-testid="submit-form"
            disabled={blocked}
            title={blocked && touched ? issues[0].message : undefined}
          >
            提交报销单
          </button>
          <button type="button" className="btn-secondary" data-testid="reset-draft" onClick={() => setDraft(EMPTY)}>
            清空表单
          </button>
          {blocked && touched ? (
            <span className="text-xs text-rose-600" data-testid="blocked-hint">
              存在 {issues.length} 处校验未通过：{issues[0].message}
            </span>
          ) : null}
        </div>

        {submitted ? (
          <Callout tone="success" title={`提交成功，单号 ${submitted.formId}`} testId="submit-result">
            单据已进入主管审批队列。
            <a className="ml-2 underline" href={siblingHref('audit')} data-testid="go-audit">
              前往主管审批后台 →
            </a>
          </Callout>
        ) : null}
      </form>
    </Panel>
  )
}

function collectIssues(round: Round<W01Data>, draft: Omit<DraftState, 'amount'> & { amount: string | number }) {
  const amount = typeof draft.amount === 'number' ? draft.amount : Number(draft.amount)
  return validateReimbursement(round.data, {
    invoiceNo: draft.invoiceNo.trim(),
    category: draft.category,
    amount: Number.isFinite(amount) ? Math.round(amount * 100) / 100 : Number.NaN,
    note: draft.note,
    cateringCompliance: draft.cateringCompliance,
  })
}

function MySubmissions({ round, log }: { round: Round<W01Data>; log: ReturnType<typeof useLog> }) {
  const forms = readForms(log, round)
  return (
    <Panel title="我的提交记录" description="本轮次内提交的报销单及其审批状态" testId="my-submissions">
      {forms.length === 0 ? (
        <p className="text-sm text-slate-500" data-testid="empty-submissions">
          本轮尚无提交。
        </p>
      ) : (
        <table className="table-base">
          <thead>
            <tr>
              <th>单号</th>
              <th>发票号</th>
              <th>类别</th>
              <th className="text-right">金额</th>
              <th>合规勾选</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {forms.map((form) => (
              <tr key={form.formId} data-testid={`submission-${form.invoiceNo}`}>
                <td className="font-mono text-xs">{form.formId}</td>
                <td className="font-mono">{form.invoiceNo}</td>
                <td>{form.category}</td>
                <td className="text-right font-mono">¥{form.amount.toFixed(2)}</td>
                <td>{form.cateringCompliance ? '是' : '—'}</td>
                <td>
                  {form.decision?.decision === 'approved' ? (
                    <Badge tone="green">已通过</Badge>
                  ) : form.decision?.decision === 'rejected' ? (
                    <Badge tone="red">已驳回</Badge>
                  ) : (
                    <Badge tone="amber">待审批</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  )
}
