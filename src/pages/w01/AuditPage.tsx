import { useState } from 'react'
import { AppShell, Badge, Callout, KeyValue, Panel } from '../../components/ui'
import { evalMode, useLog, useRound, type Round } from '../../lib/store'
import {
  readForms,
  recordAuditDecision,
  requiredDecision,
  targetInvoice,
  type SubmissionWithDecision,
  type W01Data,
} from '../../workflows/w01'

export function W01AuditPage() {
  const round = useRound<W01Data>('w01')
  const log = useLog('w01')
  if (!round) {
    return (
      <AppShell wf="w01" currentPage="audit" title="C · 主管审批后台" run={null}>
        <Callout tone="warn">尚未生成本轮数据，请先访问 source.html。</Callout>
      </AppShell>
    )
  }
  const data = round.data
  const forms = readForms(log, round)
  const target = targetInvoice(data)
  const pending = forms.filter((form) => form.decision === null)
  const decided = forms.filter((form) => form.decision !== null)
  const expected = requiredDecision(data, target)

  return (
    <AppShell wf="w01" currentPage="audit" title="C · 主管审批后台" run={round}>
      <Callout tone="warn" title={`审批政策 ${data.policyCode}`} testId="policy-banner">
        餐饮类且金额超过 ¥{data.mealCap.toFixed(2)} 的报销单一律驳回，驳回意见必须原样引用政策编号{' '}
        <code className="font-mono">{data.policyCode}</code>；其余单据可通过。
      </Callout>

      <Panel title="本轮审批看板" testId="audit-board">
        <KeyValue
          items={[
            { label: '本轮目标发票号', value: data.targetInvoiceNo, testId: 'audit-target-invoice' },
            { label: '待审批单据', value: pending.length, testId: 'pending-count' },
            { label: '已审批单据', value: decided.length, testId: 'decided-count' },
            // 正确答案默认不渲染，避免 Agent 直接读屏泄题；评测脚本用 audit.html?eval=1 查看
            ...(evalMode()
              ? [
                  {
                    label: '本轮应做决定（评测模式）',
                    value: expected === 'rejected' ? '驳回' : '通过',
                    testId: 'expected-decision',
                  },
                ]
              : []),
          ]}
        />
        {!evalMode() ? (
          <p className="mt-2 text-xs text-slate-500">
            请依据上方政策自行判断；评测脚本可访问 <code className="font-mono">audit.html?eval=1</code> 读取标准答案。
          </p>
        ) : null}
      </Panel>

      <Panel title="待审批列表" description="按发票号定位本轮目标单据后作出决定" testId="pending-list">
        {pending.length === 0 ? (
          <p className="text-sm text-slate-500" data-testid="empty-pending">
            没有待审批单据。若列表为空，请先在 form.html 提交报销单（注意：刷新过 source.html 会重开一轮）。
          </p>
        ) : (
          <ul className="space-y-3">
            {pending.map((form) => (
              <PendingRow
                key={form.formId}
                form={form}
                round={round}
                isTarget={form.invoiceNo === data.targetInvoiceNo}
              />
            ))}
          </ul>
        )}
      </Panel>

      {decided.length > 0 ? (
        <Panel title="已审批记录" testId="decided-list">
          <table className="table-base">
            <thead>
              <tr>
                <th>单号</th>
                <th>发票号</th>
                <th>类别</th>
                <th className="text-right">金额</th>
                <th>决定</th>
                <th>审批意见</th>
              </tr>
            </thead>
            <tbody>
              {decided.map((form) => (
                <tr key={form.formId} data-testid={`decided-${form.formId}`}>
                  <td className="font-mono text-xs">{form.formId}</td>
                  <td className="font-mono">{form.invoiceNo}</td>
                  <td>{form.category}</td>
                  <td className="text-right font-mono">¥{form.amount.toFixed(2)}</td>
                  <td>
                    {form.decision?.decision === 'approved' ? (
                      <Badge tone="green" testId={`decision-${form.invoiceNo}`}>
                        通过
                      </Badge>
                    ) : (
                      <Badge tone="red" testId={`decision-${form.invoiceNo}`}>
                        驳回
                      </Badge>
                    )}
                  </td>
                  <td className="text-slate-600">{form.decision?.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      ) : null}
    </AppShell>
  )
}

function PendingRow({
  form,
  round,
  isTarget,
}: {
  form: SubmissionWithDecision
  round: Round<W01Data>
  isTarget: boolean
}) {
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const invoice = round.data.invoices.find((item) => item.no === form.invoiceNo)

  function decide(decision: 'approved' | 'rejected') {
    if (decision === 'rejected' && !note.includes(round.data.policyCode)) {
      setError(`驳回意见必须包含政策编号 ${round.data.policyCode}`)
      return
    }
    recordAuditDecision({
      formId: form.formId,
      invoiceNo: form.invoiceNo,
      decision,
      reviewer: round.data.employee.department,
      note: note.trim() || (decision === 'approved' ? '符合报销规范，同意' : ''),
      decidedAt: new Date().toISOString(),
    })
    setError(null)
  }

  return (
    <li
      className={`rounded-lg border p-4 ${isTarget ? 'border-indigo-300 bg-indigo-50/40' : 'border-slate-200 bg-white'}`}
      data-testid={`audit-row-${form.invoiceNo}`}
      data-target={isTarget ? 'true' : 'false'}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold text-slate-900">{form.invoiceNo}</span>
          {isTarget ? <Badge tone="indigo">本轮目标</Badge> : <Badge tone="slate">其它单据</Badge>}
        </div>
        <span className="font-mono text-lg" data-field="amount">
          ¥{form.amount.toFixed(2)}
        </span>
      </div>
      <dl className="mt-2 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
        <div>
          类别：<span data-field="category">{form.category}</span> · 合规勾选：
          <span data-field="compliance">{form.cateringCompliance ? '已勾选' : '未勾选'}</span>
        </div>
        <div>
          发票供应商：<span data-field="vendor">{invoice?.vendor ?? '发票池中不存在'}</span> · 发票金额：
          <span className="font-mono" data-field="invoice-amount">
            {invoice ? `¥${invoice.amount.toFixed(2)}` : '—'}
          </span>
        </div>
        <div className="sm:col-span-2">费用说明：{form.note}</div>
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          className="input max-w-sm"
          placeholder="审批意见（驳回时必填政策编号）"
          data-testid={`input-note-${form.invoiceNo}`}
          value={note}
          onChange={(e) => {
            setNote(e.target.value)
            setError(null)
          }}
        />
        <button
          type="button"
          className="btn-success"
          data-testid={`approve-${form.invoiceNo}`}
          onClick={() => decide('approved')}
        >
          通过
        </button>
        <button
          type="button"
          className="btn-danger"
          data-testid={`reject-${form.invoiceNo}`}
          onClick={() => decide('rejected')}
        >
          驳回
        </button>
      </div>
      {error ? (
        <p className="mt-2 text-xs text-rose-600" data-testid="reject-error">
          {error}
        </p>
      ) : null}
    </li>
  )
}
