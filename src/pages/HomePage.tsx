import { clearAll, useLog, type WorkflowId } from '../lib/store'
import { WORKFLOWS, hrefFromRoot } from '../lib/workflows'
import { Badge, Panel } from '../components/ui'
import { Scorecard } from './Scorecard'

export function HomePage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-8">
          <div className="flex items-center gap-2">
            <Badge tone="indigo">纯静态 · 零后端 · localStorage 状态机</Badge>
            <Badge tone="slate">React + Vite 多页</Badge>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
            MockOffice —— Web Agent 浏览器自动化能力测试与办公场景模拟站
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            每条工作流是一组独立页面：A 页读取动态数据 → B 页跨页搬运并填写 → C 页完成审批/提交闭环。
            关键数据（发票号、金额、任务、库存）每轮随机生成，评测标准写在各流程目录的{' '}
            <code className="font-mono">spec.json</code>。
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-5 px-5 py-6">
        <Scorecard />
        <WorkflowNav />
        <Panel title="使用说明" testId="howto">
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-600">
            <li>
              启动：<code className="font-mono">npm run dev</code>（开发）或{' '}
              <code className="font-mono">npm run build &amp;&amp; npm run preview</code>（贴近真实静态托管）。
            </li>
            <li>
              每个流程的 A 页会在加载时重开一轮随机数据；B/C 页读取同一轮数据，因此刷新 A 页等于作废当前进度。
            </li>
            <li>
              Agent 完成后回到本页查看全局 Scorecard 的逐条判定；控制台也可调用{' '}
              <code className="font-mono">window.mockOffice.inspect()</code> 导出本轮状态，{' '}
              <code className="font-mono">window.mockOffice.clearAll()</code> 重置。
            </li>
          </ol>
          <div className="mt-3">
            <ResetAllButton />
          </div>
        </Panel>
      </main>
    </div>
  )
}

function WorkflowNav() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {WORKFLOWS.map((meta) => (
        <article key={meta.id} className="card flex flex-col p-5" data-testid={`workflow-${meta.id}`}>
          <div className="text-[11px] font-semibold tracking-wider text-indigo-600 uppercase">{meta.code}</div>
          <h2 className="mt-1 text-base font-semibold text-slate-900">{meta.name}</h2>
          <p className="mt-1.5 flex-1 text-sm text-slate-500">{meta.scenario}</p>
          <ol className="mt-3 space-y-1.5">
            {meta.pages.map((page) => (
              <li key={page.file}>
                <a
                  className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:border-indigo-300 hover:bg-indigo-50"
                  href={hrefFromRoot(meta, page)}
                  data-testid={`link-${meta.id}-${page.file}`}
                >
                  <span className="font-medium">{page.label}</span>
                  <span className="truncate text-xs text-slate-400">{page.note}</span>
                </a>
              </li>
            ))}
          </ol>
          <ActivityCount wf={meta.id} />
        </article>
      ))}
    </div>
  )
}

function ActivityCount({ wf }: { wf: WorkflowId }) {
  const log = useLog(wf)
  return (
    <p className="mt-3 text-xs text-slate-400" data-testid={`activity-${wf}`}>
      本轮动作流水：{log.length} 条
    </p>
  )
}

function ResetAllButton() {
  return (
    <button
      type="button"
      className="btn-danger"
      onClick={() => {
        clearAll()
      }}
      data-testid="reset-all"
    >
      重置全部数据（清空所有轮次与动作流水）
    </button>
  )
}
