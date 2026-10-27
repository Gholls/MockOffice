import { useEffect, useMemo, useState } from 'react'
import { Badge, Panel } from '../components/ui'
import { subscribe } from '../lib/store'
import { SPECS } from '../lib/specs'
import { scoreWorkflow, toReportJson } from '../lib/checks'
import { WORKFLOWS, hrefFromRoot } from '../lib/workflows'

export function Scorecard() {
  const [tick, setTick] = useState(0)
  const [copied, setCopied] = useState(false)

  useEffect(() => subscribe(() => setTick((value) => value + 1)), [])

  const scores = useMemo(
    () => WORKFLOWS.map((meta) => ({ meta, score: scoreWorkflow(meta.id, SPECS[meta.id]) })),
    // tick 变化代表 localStorage 有写入
    [tick],
  )

  const total = scores.reduce((sum, item) => sum + item.score.score, 0)
  const totalMax = scores.reduce((sum, item) => sum + item.score.max, 0)
  const finished = scores.filter((item) => item.score.score === item.score.max).length
  const report = toReportJson(scores.map((item) => item.score))

  return (
    <Panel
      title="全局 Scorecard"
      description="逐条检查项由各自 spec.json 声明、src/lib/checks.ts 解释执行，实时读取 localStorage 判定"
      testId="scorecard"
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-secondary"
            data-testid="copy-report"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(report)
                setCopied(true)
                window.setTimeout(() => setCopied(false), 1600)
              } catch {
                setCopied(false)
              }
            }}
          >
            {copied ? '已复制' : '复制评测结果 JSON'}
          </button>
        </div>
      }
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-3xl font-bold text-slate-900" data-testid="total-score">
            {total}
            <span className="text-lg font-medium text-slate-400"> / {totalMax}</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">三条工作流合计加权得分</div>
        </div>
        <div className="flex gap-2">
          {WORKFLOWS.map((meta, index) => {
            const item = scores[index]
            const complete = item.score.score === item.score.max
            return (
              <Badge key={meta.id} tone={complete ? 'green' : item.score.score > 0 ? 'amber' : 'slate'}>
                {meta.id.toUpperCase()} {item.score.score}/{item.score.max}
              </Badge>
            )
          })}
          <Badge tone={finished === WORKFLOWS.length ? 'green' : 'indigo'}>
            闭环完成 {finished}/{WORKFLOWS.length}
          </Badge>
        </div>
      </div>

      <div className="mt-5 space-y-5">
        {scores.map(({ meta, score }) => (
          <article key={meta.id} className="rounded-lg border border-slate-200 p-4" data-testid={`score-${meta.id}`}>
            <header className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  {meta.code} · {SPECS[meta.id].title}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {score.runId ? (
                    <>
                      轮次 <code className="font-mono">{score.runId}</code> · seed{' '}
                      <code className="font-mono">{score.seed}</code> · 动作 {score.actionCount} 条
                    </>
                  ) : (
                    '本轮尚未开始：未访问任何 A 页'
                  )}
                </p>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-slate-900" data-testid={`score-value-${meta.id}`}>
                  {score.score}
                  <span className="text-sm font-medium text-slate-400"> / {score.max}</span>
                </div>
                <div className="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={score.score === score.max ? 'h-full bg-emerald-500' : 'h-full bg-indigo-500'}
                    style={{ width: `${score.max === 0 ? 0 : (score.score / score.max) * 100}%` }}
                  />
                </div>
              </div>
            </header>

            <ul className="mt-3 space-y-1">
              {score.outcomes.map((outcome) => (
                <li
                  key={outcome.id}
                  className="flex flex-wrap items-baseline gap-2 rounded-md px-2 py-1.5 text-sm odd:bg-slate-50"
                  data-testid={`check-${outcome.id}`}
                  data-pass={outcome.pass ? 'true' : 'false'}
                >
                  <span className={outcome.pass ? 'text-emerald-600' : 'text-rose-600'} aria-hidden>
                    {outcome.pass ? '✓' : '✗'}
                  </span>
                  <span className="font-mono text-xs text-slate-400">{outcome.id}</span>
                  <span className="text-slate-800">{outcome.title}</span>
                  <span className="text-xs text-slate-400">权重 {outcome.weight}</span>
                  <span className={outcome.pass ? 'ml-auto text-xs text-slate-500' : 'ml-auto text-xs text-rose-600'}>
                    {outcome.detail}
                  </span>
                  {!outcome.pass && outcome.hint ? (
                    <span className="w-full text-xs text-slate-500" data-testid={`hint-${outcome.id}`}>
                      提示：{outcome.hint}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              {meta.pages.map((page) => (
                <a key={page.file} className="chip bg-slate-100 text-slate-600 hover:bg-indigo-50" href={hrefFromRoot(meta, page)}>
                  {page.label}
                </a>
              ))}
              <details className="ml-auto">
                <summary className="cursor-pointer text-slate-500">陷阱与评测契约（{SPECS[meta.id].traps.length} 项）</summary>
                <ul className="mt-2 w-80 space-y-1 border-l border-slate-200 pl-3 text-left">
                  {SPECS[meta.id].traps.map((trap) => (
                    <li key={trap.id} className="text-slate-600">
                      <span className="font-mono text-[11px] text-slate-400">
                        {trap.id} · {trap.page}
                      </span>{' '}
                      <span className="font-medium text-slate-700">{trap.name}</span>：{trap.description}
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          </article>
        ))}
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-slate-500">机器可读评测结果（供 harness 直接读取）</summary>
        <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">
          {report}
        </pre>
      </details>
    </Panel>
  )
}
