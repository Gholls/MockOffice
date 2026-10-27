import { AppShell, Badge, Callout, Panel } from '../../components/ui'
import { regenerateRound, useRound, type Round } from '../../lib/store'
import { buildW02Round, completedTasks, METRIC_FIELDS, unfinishedTasks, type W02Data } from '../../workflows/w02'

export function W02DashboardPage() {
  const round = useRound<W02Data>('w02')
  return (
    <AppShell
      wf="w02"
      currentPage="dashboard"
      title="A · 个人工作台"
      run={round}
      actions={
        <button
          type="button"
          className="btn-secondary"
          data-testid="regenerate"
          onClick={() => regenerateRound('w02', buildW02Round)}
        >
          随机生成本轮测试数据
        </button>
      }
    >
      {round ? <Dashboard round={round} /> : null}
    </AppShell>
  )
}

function Dashboard({ round }: { round: Round<W02Data> }) {
  const data = round.data
  const done = completedTasks(data)
  const others = unfinishedTasks(data)
  return (
    <>
      <Callout tone="warn" title="动态扰动提示" testId="fresh-round-note">
        本页每次加载都会重开一轮：任务单号、指标数字、下周重点全部重新随机。刷新本页会作废上一轮周报进度。
      </Callout>

      <Panel title={`${data.owner} · ${data.weekLabel}`} description={`统计区间 ${data.weekRange}（数据源：Jira + Git 模拟聚合）`} testId="week-header">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="metric-grid">
          {METRIC_FIELDS.map((field) => (
            <div key={field.key} className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
              <div className="text-xs text-indigo-700">{field.label}</div>
              <div className="mt-0.5 font-mono text-2xl text-indigo-900" data-testid={`metric-${field.key}`} data-metric={field.key}>
                {data.metrics[field.key]}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500" data-testid="extra-metrics">
          <span>变更行数 {data.extraMetrics.linesChanged}</span>
          <span>· 参会 {data.extraMetrics.meetings} 场</span>
          <span>· 线上事件 {data.extraMetrics.incidents} 次</span>
          <span className="text-slate-400">（参考项，无需填报）</span>
        </div>
      </Panel>

      <Panel title="本周任务" description="按状态区分：只有「已完成」需要写入周报总结" testId="task-list">
        <ul className="space-y-2">
          {data.tasks.map((task) => (
            <li
              key={task.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
              data-testid={`task-${task.id}`}
              data-status={task.status}
            >
              <Badge tone={task.status === '已完成' ? 'green' : task.status === '进行中' ? 'amber' : 'red'}>
                {task.status}
              </Badge>
              <span className="font-mono text-xs text-slate-400">{task.id}</span>
              <span className="text-sm text-slate-900" data-field="task-title">
                {task.title}
              </span>
              <span className="ml-auto text-xs text-slate-400">
                {task.project} · {task.points} 点
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-slate-600" data-testid="completed-count">
          已完成 {done.length} 项 · 未完结 {others.length} 项
        </p>
      </Panel>

      <Panel title="下周方向" testId="focus-panel">
        <p className="text-sm text-slate-600">主管在晨会指定的本周后续重点，周报「下周计划」必须包含：</p>
        <p className="mt-2 text-lg font-semibold text-slate-900" data-testid="next-week-focus">
          {data.nextWeekFocus}
        </p>
      </Panel>

      <Panel title="OA 周报填写要求" testId="requirements">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>「本周工作总结」需逐条包含全部已完成任务的完整标题（含括号内单号），不得写入进行中或已阻塞任务，且不少于 {data.minSummaryChars} 字。</li>
          <li>「下周计划」需包含上方「下周方向」给出的重点词。</li>
          <li>四项核心指标按工作台数字精确填报，整数、不做估算或四舍五入。</li>
          <li>「保存草稿」不算提交，必须点「正式提交」才进入闭环。</li>
        </ul>
      </Panel>
    </>
  )
}
