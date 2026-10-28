import { useMemo } from 'react'
import { Badge, Panel } from '../components/ui'
import { clearAll, regenerateRound, useStoreTick, type WorkflowId } from '../lib/store'
import type { Rng } from '../lib/rng'
import { hrefFromRoot, type WorkflowMeta } from '../lib/workflows'
import { flowViews, type FlowView } from '../lib/progress'
import { buildW01Round } from '../workflows/w01'
import { buildW02Round } from '../workflows/w02'
import { buildW03Round } from '../workflows/w03'
import { Scorecard } from './Scorecard'

const REBUILDERS: Record<WorkflowId, (rng: Rng, seed: number) => unknown> = {
  w01: buildW01Round,
  w02: buildW02Round,
  w03: buildW03Round,
}

export function HomePage() {
  const tick = useStoreTick()
  const flows = useMemo(() => flowViews(), [tick])

  const total = flows.reduce((sum, item) => sum + item.score.score, 0)
  const totalMax = flows.reduce((sum, item) => sum + item.score.max, 0)
  const completed = flows.filter((item) => item.progress.status === 'complete').length
  const nextUp = flows.find((item) => item.progress.status !== 'complete') ?? flows[0]

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm"
      >
        跳到主要内容
      </a>

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="indigo">零后端 · 纯静态</Badge>
            <Badge tone="slate">数据每轮随机</Badge>
            <Badge tone="slate">spec.json 评测契约</Badge>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
            MockOffice —— Web Agent 浏览器自动化能力测试站
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            三条独立的办公工作流：在数据页读取本轮随机生成的业务数据，跨页面搬运到表单精确填写，
            最后在审批或提交页完成闭环。考察跨页读数、条件闸门、多级联动与抗干扰能力。
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <a className="btn-primary" href={hrefFromRoot(nextUp.meta, nextPageMeta(nextUp))} data-testid="hero-cta">
              {nextUp.progress.status === 'not-started' ? '开始评测：' : '继续：'}
              {nextUp.meta.name} · {nextUp.progress.nextLabel} →
            </a>
            <a className="btn-secondary" href="#scorecard" data-testid="hero-scorecard-link">
              查看评分明细
            </a>
            <p className="ml-auto text-sm text-slate-600" data-testid="hero-summary">
              总分 <span className="font-mono text-base font-semibold text-slate-900">{total}</span>
              <span className="font-mono text-slate-400">/{totalMax}</span> · 闭环完成{' '}
              <span className="font-semibold text-slate-900">
                {completed}/{flows.length}
              </span>
            </p>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-6xl space-y-5 px-5 py-6">
        <section aria-labelledby="flows-heading">
          <h2 id="flows-heading" className="sr-only">
            评测工作流
          </h2>
          <ul className="grid gap-4 lg:grid-cols-3">
            {flows.map((flow) => (
              <FlowCard key={flow.meta.id} flow={flow} />
            ))}
          </ul>
        </section>

        <div id="scorecard">
          <Scorecard flows={flows} />
        </div>

        <Panel title="怎么玩" testId="howto">
          <div className="grid gap-4 text-sm text-slate-600 md:grid-cols-3">
            <Step index={1} title="进入流程 A 页">
              A 页加载即重开一轮随机数据；<span className="font-medium">刷新 A 页会作废本轮进度</span>，
              请在同一轮内走完所有步骤。
            </Step>
            <Step index={2} title="按页面要求搬运数据">
              表单页刻意不显示业务原值，必须回 A 页读取；校验报错只说哪一项不对，不回显正确答案。
            </Step>
            <Step index={3} title="完成闭环并看分">
              最后一步是审批 / 正式提交 / 生成订单，写入 localStorage 后下方 Scorecard 会逐条判定。
            </Step>
          </div>
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-medium text-slate-700">给自动化 harness 的接口</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-600">
              <li>
                控制台：<code className="font-mono">window.mockOffice.inspect()</code> 导出当前轮次，
                <code className="font-mono">window.mockOffice.clearAll()</code> 全局重置。
              </li>
              <li>
                评测模式：<code className="font-mono">/workflow-01-reimbursement/audit?eval=1</code> 才渲染标准答案。
              </li>
              <li>
                选择器与锚点清单见各流程 <code className="font-mono">spec.json</code> 的{' '}
                <code className="font-mono">pages[].anchors</code>。
              </li>
              <li>
                开发：<code className="font-mono">npm run dev</code>；部署验证：
                <code className="font-mono">npm run build &amp;&amp; npm run preview</code>。
              </li>
            </ul>
          </details>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-danger"
              data-testid="reset-all"
              onClick={() => {
                if (window.confirm('将清空三条流程的轮次数据与全部动作流水，且不可撤销。确认重置？')) clearAll()
              }}
            >
              重置全部数据
            </button>
          </div>
        </Panel>
      </main>

      <footer className="mx-auto max-w-6xl px-5 pb-10 text-xs text-slate-400">
        状态全部存于浏览器 localStorage（命名空间 <code className="font-mono">mockoffice.*</code>），无服务端。
      </footer>
    </div>
  )
}

function nextPageMeta(flow: FlowView): WorkflowMeta['pages'][number] {
  const page = flow.meta.pages.find((item) => item.file === flow.progress.nextFile) ?? flow.meta.pages[0]
  return page
}

function FlowCard({ flow }: { flow: FlowView }) {
  const { meta, progress, score } = flow
  const tone = progress.status === 'complete' ? 'green' : progress.status === 'in-progress' ? 'amber' : 'slate'
  const label = progress.status === 'complete' ? '闭环完成' : progress.status === 'in-progress' ? '进行中' : '未开始'
  return (
    <li className="card flex flex-col p-5" data-testid={`flow-${meta.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600">{meta.code}</div>
          <h3 className="mt-0.5 text-base font-semibold text-slate-900">{meta.name}</h3>
        </div>
        <Badge tone={tone}>{label}</Badge>
      </div>

      <p className="mt-1.5 text-sm text-slate-500">{meta.scenario}</p>

      <div className="mt-3 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
          <div
            className={score.score === score.max ? 'h-full bg-emerald-500' : 'h-full bg-indigo-500'}
            style={{ width: `${(score.score / score.max) * 100}%` }}
          />
        </div>
        <span className="font-mono text-sm text-slate-600" data-testid={`flow-score-${meta.id}`}>
          {score.score}/{score.max}
        </span>
      </div>

      <ol className="mt-4 space-y-1.5">
        {meta.pages.map((page, index) => {
          const done = progress.completedFiles.includes(page.file)
          const current = progress.nextFile === page.file && progress.status !== 'complete'
          return (
            <li key={page.file}>
              <a
                href={hrefFromRoot(meta, page)}
                aria-current={current ? 'step' : undefined}
                data-testid={`flow-step-${meta.id}-${page.file}`}
                data-state={done ? 'done' : current ? 'current' : 'todo'}
                className={`flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-sm transition-colors ${
                  current
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-900'
                    : done
                      ? 'border-emerald-200 bg-emerald-50/60 text-slate-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span
                  className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full text-[10px] font-semibold ${
                    done ? 'bg-emerald-500 text-white' : current ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}
                  aria-hidden
                >
                  {done ? '✓' : index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{page.label}</span>
                  <span className="block text-xs opacity-75">{page.note}</span>
                </span>
              </a>
            </li>
          )
        })}
      </ol>

      <p className="mt-3 text-xs text-slate-500" data-testid={`flow-reason-${meta.id}`}>
        {progress.reason}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a className="btn-primary" href={hrefFromRoot(meta, nextPageMeta(flow))} data-testid={`flow-cta-${meta.id}`}>
          {progress.nextLabel} →
        </a>
        <button
          type="button"
          className="btn-secondary"
          data-testid={`flow-restart-${meta.id}`}
          onClick={() => {
            if (window.confirm(`重开 ${meta.code} 会生成全新的随机数据，本轮已提交的单据/周报/订单将不再计入评分。确认重开？`)) {
              regenerateRound(meta.id, REBUILDERS[meta.id])
            }
          }}
        >
          重开本轮
        </button>
      </div>
    </li>
  )
}

function Step({ index, title, children }: { index: number; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="grid size-5 place-items-center rounded-full bg-indigo-600 text-[11px] font-semibold text-white">
          {index}
        </span>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      <p className="mt-1 text-slate-600">{children}</p>
    </div>
  )
}
