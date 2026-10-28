import { useState } from 'react'
import { Badge, Panel } from '../components/ui'
import { SPECS } from '../lib/specs'
import { toReportJson } from '../lib/checks'
import { hrefFromRoot } from '../lib/workflows'
import type { FlowView } from '../lib/progress'

/**
 * 全局 Scorecard：逐条判定来自各流程 spec.json 的 checks。
 * 未通过项直接展开（这是需要行动的信息），通过项收进 details，避免首屏被 27 行绿勾淹没。
 */
export function Scorecard({ flows }: { flows: FlowView[] }) {
  const [copied, setCopied] = useState(false)
  const total = flows.reduce((sum, item) => sum + item.score.score, 0)
  const totalMax = flows.reduce((sum, item) => sum + item.score.max, 0)
  const report = toReportJson(flows.map((item) => item.score))

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(report)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Panel
      title="Scorecard"
      description="检查项与各权重的定义见每个流程目录下的 spec.json"
      testId="scorecard"
      actions={
        <button type="button" className="btn-secondary" data-testid="copy-report" onClick={copyReport}>
          {copied ? '已复制' : '复制评测结果 JSON'}
        </button>
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <span className="text-2xl font-bold text-slate-900" data-testid="total-score">
            {total}
            <span className="text-base font-medium text-slate-400"> / {totalMax}</span>
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {flows.map((item) => {
            const complete = item.score.score === item.score.max
            const failed = item.score.outcomes.filter((outcome) => !outcome.pass).length
            return (
              <Badge key={item.meta.id} tone={complete ? 'green' : item.score.score > 0 ? 'amber' : 'slate'}>
                {item.meta.id.toUpperCase()} {item.score.score}/{item.score.max}
                {complete ? ' 全通过' : ` 待办 ${failed}`}
              </Badge>
            )
          })}
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {flows.map((item) => (
          <FlowScore key={item.meta.id} flow={item} />
        ))}
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-slate-500">机器可读评测结果</summary>
        <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">
          {report}
        </pre>
      </details>
    </Panel>
  )
}

function FlowScore({ flow }: { flow: FlowView }) {
  const { meta, score } = flow
  const spec = SPECS[meta.id]
  const failed = score.outcomes.filter((outcome) => !outcome.pass)
  const passed = score.outcomes.filter((outcome) => outcome.pass)

  return (
    <article className="rounded-lg border border-slate-200 p-4" data-testid={`score-${meta.id}`}>
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">
          {meta.code} · {spec.title}
        </h3>
        <span className="font-mono text-xs text-slate-500">
          {score.runId ? `轮次 ${score.runId} · seed ${score.seed} · 动作 ${score.actionCount}` : '本轮尚未开始'}
        </span>
      </header>

      {failed.length === 0 ? (
        <p className="mt-2 text-sm text-emerald-700" data-testid={`all-pass-${meta.id}`}>
          {score.outcomes.length} 项检查全部通过。
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {failed.map((outcome) => (
            <li
              key={outcome.id}
              className="rounded-md border border-rose-200 bg-rose-50/60 px-2.5 py-1.5 text-sm"
              data-testid={`check-${outcome.id}`}
              data-pass="false"
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-rose-600" aria-hidden>
                  ✗
                </span>
                <span className="font-mono text-xs text-slate-500">{outcome.id}</span>
                <span className="font-medium text-slate-900">{outcome.title}</span>
                <span className="text-xs text-slate-500">权重 {outcome.weight}</span>
              </div>
              <p className="mt-0.5 pl-5 text-xs text-rose-700">{outcome.detail}</p>
              {outcome.hint ? <p className="pl-5 text-xs text-slate-500">提示：{outcome.hint}</p> : null}
            </li>
          ))}
        </ul>
      )}

      {passed.length > 0 ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-slate-500">已通过的 {passed.length} 项检查</summary>
          <ul className="mt-1 space-y-0.5">
            {passed.map((outcome) => (
              <li key={outcome.id} className="text-xs text-slate-500" data-testid={`check-${outcome.id}`} data-pass="true">
                <span className="text-emerald-600">✓</span>{' '}
                <span className="font-mono">{outcome.id}</span> {outcome.title} —— {outcome.detail}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {meta.pages.map((page) => (
          <a key={page.file} className="chip bg-slate-100 text-slate-600 hover:bg-indigo-50" href={hrefFromRoot(meta, page)}>
            {page.label}
          </a>
        ))}
      </div>
    </article>
  )
}
