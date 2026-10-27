import type { ReactNode } from 'react'
import { HOME_HREF, siblingHref, workflowById, type WorkflowId } from '../lib/workflows'
import type { Round } from '../lib/store'

interface AppShellProps {
  wf: WorkflowId
  currentPage: string
  title: string
  run?: Round<unknown> | null
  actions?: ReactNode
  children: ReactNode
}

export function AppShell({ wf, currentPage, title, run, actions, children }: AppShellProps) {
  const meta = workflowById(wf)
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <a
                href={HOME_HREF}
                className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold tracking-wide text-slate-500 hover:bg-slate-50"
                data-testid="home-link"
              >
                ← MockOffice
              </a>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600">
                  {meta.code} · {meta.name}
                </div>
                <h1 className="text-lg leading-tight font-semibold text-slate-900" data-testid="page-title">
                  {title}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {run ? (
                <span className="chip bg-slate-100 text-slate-600" data-testid="run-id" title={`seed=${run.seed}`}>
                  轮次 <code className="ml-1 font-mono text-xs">{run.runId}</code>
                </span>
              ) : null}
              {actions}
            </div>
          </div>
          <nav className="mt-3 flex flex-wrap gap-1.5" data-testid="step-nav">
            {meta.pages.map((page) => {
              const active = page.file === currentPage
              return (
                <a
                  key={page.file}
                  href={siblingHref(page.file)}
                  aria-current={active ? 'page' : undefined}
                  data-testid={`step-${page.file}`}
                  className={
                    active
                      ? 'chip bg-indigo-600 text-white'
                      : 'chip bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }
                >
                  {page.label}
                </a>
              )
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-5 px-5 py-6">{children}</main>
      <footer className="mx-auto max-w-5xl px-5 pb-10 text-xs text-slate-400">
        零后端 · 全部状态存于 localStorage（命名空间 <code className="font-mono">mockoffice.*</code>）·{' '}
        <a className="text-indigo-500 hover:underline" href={HOME_HREF}>
          返回导航主页 / Scorecard
        </a>
      </footer>
    </div>
  )
}

export function Panel({
  title,
  description,
  actions,
  children,
  testId,
}: {
  title?: string
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  testId?: string
}) {
  return (
    <section className="card p-5" data-testid={testId}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title ? <h2 className="text-base font-semibold text-slate-900">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: ReactNode
  error?: string | null
  required?: boolean
  children: ReactNode
}) {
  return (
    <div>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
        {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-rose-600" data-testid="field-error">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  )
}

export function Callout({
  tone = 'info',
  title,
  children,
  testId,
}: {
  tone?: 'info' | 'warn' | 'danger' | 'success'
  title?: string
  children?: ReactNode
  testId?: string
}) {
  const tones: Record<string, string> = {
    info: 'border-indigo-200 bg-indigo-50 text-indigo-900',
    warn: 'border-amber-200 bg-amber-50 text-amber-900',
    danger: 'border-rose-200 bg-rose-50 text-rose-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  }
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${tones[tone]}`} data-testid={testId} role="status">
      {title ? <div className="font-semibold">{title}</div> : null}
      {children ? <div className={title ? 'mt-1' : ''}>{children}</div> : null}
    </div>
  )
}

export function Badge({
  tone = 'slate',
  children,
  testId,
}: {
  tone?: 'slate' | 'green' | 'red' | 'amber' | 'indigo'
  children: ReactNode
  testId?: string
}) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-600',
    green: 'bg-emerald-100 text-emerald-700',
    red: 'bg-rose-100 text-rose-700',
    amber: 'bg-amber-100 text-amber-700',
    indigo: 'bg-indigo-100 text-indigo-700',
  }
  return (
    <span className={`chip ${tones[tone]}`} data-testid={testId}>
      {children}
    </span>
  )
}

export function KeyValue({ items }: { items: { label: string; value: ReactNode; testId?: string }[] }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <dt className="text-xs text-slate-500">{item.label}</dt>
          <dd className="mt-0.5 font-mono text-lg text-slate-900" data-testid={item.testId}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
