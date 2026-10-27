import { AppShell, Badge, Callout, KeyValue, Panel } from '../../components/ui'
import { regenerateRound, useLog, useRound, clearLog, type Round } from '../../lib/store'
import { buildW01Round, readForms, targetInvoice, validationBlockCount, type W01Data } from '../../workflows/w01'
import { siblingHref } from '../../lib/workflows'

export function W01SourcePage() {
  const round = useRound<W01Data>('w01')
  const log = useLog('w01')
  return (
    <AppShell
      wf="w01"
      currentPage="source"
      title="A · 发票数据池"
      run={round}
      actions={
        <>
          <button
            type="button"
            className="btn-secondary"
            data-testid="regenerate"
            onClick={() => regenerateRound('w01', buildW01Round)}
          >
            随机生成本轮测试数据
          </button>
          <button
            type="button"
            className="btn-danger"
            data-testid="clear-progress"
            onClick={() => clearLog('w01')}
          >
            清空提交与审批记录
          </button>
        </>
      }
    >
      <Callout tone="warn" title="动态扰动提示" testId="fresh-round-note">
        本页每次加载都会重开一轮：发票号、金额、供应商、政策编号全部重新随机生成。
        刷新本页会作废上一轮的报销进度，请在本轮内完成 A → B → C。
      </Callout>
      {round ? (
        <RoundView round={round} forms={readForms(log, round)} blocks={validationBlockCount(log, round)} />
      ) : null}
    </AppShell>
  )
}

function RoundView({
  round,
  forms,
  blocks,
}: {
  round: Round<W01Data>
  forms: ReturnType<typeof readForms>
  blocks: number
}) {
  const data = round.data
  const target = targetInvoice(data)
  return (
    <>
      <Panel title="本轮任务简报" description="以下为 OA 系统随本轮数据一并下发的上下文" testId="briefing">
        <KeyValue
          items={[
            { label: '报销人', value: data.employee.name, testId: 'employee-name' },
            { label: '成本中心', value: data.employee.costCenter, testId: 'cost-center' },
            { label: '本轮政策编号', value: data.policyCode, testId: 'policy-code' },
            { label: '餐饮单次上限', value: `¥${data.mealCap.toFixed(2)}`, testId: 'meal-cap' },
          ]}
        />
        <p className="mt-3 text-sm text-slate-600" data-testid="task-instruction">
          任务：为下表中状态为「待报销」的<span className="font-semibold text-slate-900">唯一一张</span>发票填写报销单并提交；
          报销类别、金额、供应商必须与发票一致，备注需写明供应商与费用用途。
          审批阶段请依据政策{' '}
          <code className="font-mono text-xs">{data.policyCode}</code>
          ：餐饮且金额超过 ¥{data.mealCap.toFixed(2)} 的单据一律驳回，并在审批意见中原样引用该政策编号。
        </p>
      </Panel>

      <Panel title="发票池" description="Agent 必须从 DOM 读取发票号与金额，而非沿用历史值" testId="invoice-table">
        <div className="overflow-x-auto">
          <table className="table-base whitespace-nowrap text-xs">
            <thead>
              <tr>
                <th>状态</th>
                <th>发票号码 / 代码</th>
                <th>开票日期</th>
                <th>供应商</th>
                <th>费用内容</th>
                <th>类别</th>
                <th className="text-right">金额</th>
              </tr>
            </thead>
            <tbody>
              {data.invoices.map((invoice) => {
                const isTarget = invoice.no === data.targetInvoiceNo
                return (
                  <tr
                    key={invoice.no}
                    data-testid={`invoice-row-${invoice.no}`}
                    data-status={invoice.status}
                    className={isTarget ? 'bg-indigo-50/70 font-medium' : ''}
                  >
                    <td>
                      <Badge tone={isTarget ? 'indigo' : 'slate'}>{invoice.status}</Badge>
                    </td>
                    <td className="font-mono" data-field="invoice-no">
                      {invoice.no}
                      <span className="ml-1.5 text-slate-400">{invoice.code}</span>
                    </td>
                    <td className="text-slate-500">{invoice.date}</td>
                    <td data-field="vendor">{invoice.vendor}</td>
                    <td>{invoice.item}</td>
                    <td data-field="category">{invoice.category}</td>
                    <td className="text-right font-mono" data-field="amount">
                      ¥{invoice.amount.toFixed(2)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span data-testid="target-invoice-no">
            本轮待报销发票号：<code className="font-mono text-sm text-slate-900">{target?.no}</code>
          </span>
          <a className="btn-primary" href={siblingHref('form')}>
            前往填写报销单 →
          </a>
        </div>
      </Panel>

      <Panel title="本轮进度" testId="progress">
        <div className="flex flex-wrap gap-3 text-sm text-slate-600">
          <span data-testid="submission-count">已提交报销单：{forms.length}</span>
          <span data-testid="approved-count">已通过：{forms.filter((f) => f.decision?.decision === 'approved').length}</span>
          <span data-testid="rejected-count">已驳回：{forms.filter((f) => f.decision?.decision === 'rejected').length}</span>
          <span data-testid="block-count">被前端校验拦截：{blocks} 次</span>
        </div>
      </Panel>
    </>
  )
}
