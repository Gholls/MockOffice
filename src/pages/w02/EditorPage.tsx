import { useState } from 'react'
import { AppShell, Badge, Callout, Field, Panel } from '../../components/ui'
import { readLog, useLog, useRound, type LogEntry, type Round } from '../../lib/store'
import {
  METRIC_FIELDS,
  completedTasks,
  readReports,
  recordValidationBlock,
  saveDraft,
  submitReport,
  validateReport,
  type ReportIssue,
  type WeeklyMetrics,
  type W02Data,
} from '../../workflows/w02'

type MetricKey = keyof WeeklyMetrics
type DraftForm = { summary: string; nextPlan: string; metrics: Record<MetricKey, string> }

const BLANK: DraftForm = {
  summary: '',
  nextPlan: '',
  metrics: { commits: '', mergedPRs: '', reviews: '', bugsClosed: '' },
}

export function W02EditorPage() {
  const round = useRound<W02Data>('w02')
  const log = useLog('w02')
  return (
    <AppShell wf="w02" currentPage="editor" title="B · 周报编辑与提交" run={round}>
      {round ? (
        <>
          <Callout tone="info" title="数据需从工作台搬运" testId="cross-page-note">
            本页不展示任务与指标原值，需先在 dashboard.html 读取后填写。刷新工作台会重开一轮，旧周报会被记为上一轮。
          </Callout>
          <ReportForm round={round} />
          <SubmissionHistory round={round} log={log} />
        </>
      ) : (
        <Callout tone="warn">尚未生成本轮数据，请先访问 dashboard.html。</Callout>
      )}
    </AppShell>
  )
}

function toPayload(draft: DraftForm) {
  const metrics = {} as WeeklyMetrics
  for (const field of METRIC_FIELDS) {
    const raw = draft.metrics[field.key].trim()
    metrics[field.key] = raw === '' ? Number.NaN : Number(raw)
  }
  return { summary: draft.summary, nextPlan: draft.nextPlan, metrics }
}

function ReportForm({ round }: { round: Round<W02Data> }) {
  const [draft, setDraft] = useState<DraftForm>(() => restoreDraft(round) ?? BLANK)
  const [issues, setIssues] = useState<ReportIssue[]>([])
  const [notice, setNotice] = useState<string | null>(null)

  const issueFor = (field: ReportIssue['field']) => issues.filter((issue) => issue.field === field)

  function patch<K extends keyof DraftForm>(key: K, value: DraftForm[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
    setNotice(null)
  }

  function handleSaveDraft() {
    saveDraft(toPayload(draft))
    setNotice('草稿已保存：草稿不会进入周报闭环，仍需点击「正式提交」。')
  }

  function handleSubmit() {
    const payload = toPayload(draft)
    const found = validateReport(round.data, payload)
    setIssues(found)
    if (found.length > 0) {
      recordValidationBlock(found[0].message, { summaryLength: payload.summary.length })
      setNotice(null)
      return
    }
    submitReport(payload)
    setNotice('周报已正式提交，可在主页 Scorecard 查看评分。')
  }

  return (
    <Panel
      title={`${round.data.weekLabel} 周报`}
      description={`填报人 ${round.data.owner} · 统计区间 ${round.data.weekRange}`}
      testId="report-form"
    >
      <div className="space-y-4">
        <Field
          label="本周工作总结"
          htmlFor="summary"
          required
          hint={`逐条列出已完成任务（含单号），不少于 ${round.data.minSummaryChars} 字；当前 ${draft.summary.trim().length} 字`}
          error={issueFor('summary')[0]?.message ?? null}
        >
          <textarea
            id="summary"
            rows={7}
            className="input"
            data-testid="input-summary"
            placeholder={'示例：\n1. …'}
            value={draft.summary}
            onChange={(e) => patch('summary', e.target.value)}
          />
        </Field>
        {issueFor('summary').length > 1 ? (
          <ul className="list-disc pl-5 text-xs text-rose-600" data-testid="summary-issues">
            {issueFor('summary').map((issue) => (
              <li key={issue.message}>{issue.message}</li>
            ))}
          </ul>
        ) : null}

        <Field
          label="下周计划"
          htmlFor="next-plan"
          required
          hint={`需包含主管指定的重点方向（见工作台「下周方向」）`}
          error={issueFor('nextPlan')[0]?.message ?? null}
        >
          <textarea
            id="next-plan"
            rows={3}
            className="input"
            data-testid="input-next-plan"
            placeholder="下周计划"
            value={draft.nextPlan}
            onChange={(e) => patch('nextPlan', e.target.value)}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {METRIC_FIELDS.map((field) => (
            <Field key={field.key} label={field.label} htmlFor={`metric-${field.key}`} required error={issueFor(field.key)[0]?.message ?? null}>
              <input
                id={`metric-${field.key}`}
                type="number"
                className="input font-mono"
                data-testid={`input-${field.key}`}
                data-metric-field={field.key}
                value={draft.metrics[field.key]}
                onChange={(e) => patch('metrics', { ...draft.metrics, [field.key]: e.target.value })}
              />
            </Field>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-secondary" data-testid="save-draft" onClick={handleSaveDraft}>
            保存草稿
          </button>
          <button type="button" className="btn-primary" data-testid="submit-report" onClick={handleSubmit}>
            正式提交
          </button>
          <button type="button" className="btn-secondary" data-testid="clear-form" onClick={() => setDraft(BLANK)}>
            清空表单
          </button>
        </div>

        {issues.length > 0 ? (
          <Callout tone="danger" title={`校验未通过 ${issues.length} 项，未生成正式周报`} testId="issue-summary">
            <ul className="list-disc pl-5">
              {issues.map((issue) => (
                <li key={issue.message}>{issue.message}</li>
              ))}
            </ul>
          </Callout>
        ) : null}

        {notice ? (
          <Callout
            tone={notice.startsWith('周报已正式提交') ? 'success' : 'warn'}
            title={notice}
            testId="form-notice"
          >
            已完成任务共 {completedTasks(round.data).length} 项，提交前请确认逐条覆盖。
          </Callout>
        ) : null}
      </div>
    </Panel>
  )
}

function restoreDraft(round: Round<W02Data>): DraftForm | null {
  const reports = readReports(readLog('w02'), round)
  const last = [...reports].reverse().find((report) => report.kind === 'draft')
  if (!last) return null
  return {
    summary: last.summary,
    nextPlan: last.nextPlan,
    metrics: {
      commits: String(last.metrics.commits ?? ''),
      mergedPRs: String(last.metrics.mergedPRs ?? ''),
      reviews: String(last.metrics.reviews ?? ''),
      bugsClosed: String(last.metrics.bugsClosed ?? ''),
    },
  }
}

function SubmissionHistory({ round, log }: { round: Round<W02Data>; log: LogEntry[] }) {
  const reports = readReports(log, round)
  return (
    <Panel title="本轮填报记录" description="草稿与正式提交都会留痕，仅正式提交计入闭环" testId="report-history">
      {reports.length === 0 ? (
        <p className="text-sm text-slate-500" data-testid="empty-history">
          本轮尚无填报记录。
        </p>
      ) : (
        <ul className="space-y-1.5">
          {reports.map((report, index) => (
            <li key={report.savedAt + index} className="flex items-center gap-2 text-sm" data-testid={`report-${index}`}>
              {report.kind === 'submit' ? <Badge tone="green">正式提交</Badge> : <Badge tone="slate">草稿</Badge>}
              <span className="font-mono text-xs text-slate-400">{new Date(report.savedAt).toLocaleTimeString('zh-CN')}</span>
              <span className="truncate text-slate-600">{report.summary.slice(0, 40) || '(空)'}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
