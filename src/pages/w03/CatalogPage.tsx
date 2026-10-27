import { useMemo, useState } from 'react'
import { AppShell, Badge, Callout, KeyValue, Panel } from '../../components/ui'
import { clearLog, regenerateRound, useLog, useRound, type Round } from '../../lib/store'
import { siblingHref } from '../../lib/workflows'
import {
  buildW03Round,
  deliveryBounds,
  lockedQuantity,
  readOrders,
  type W03Data,
} from '../../workflows/w03'

export function W03CatalogPage() {
  const round = useRound<W03Data>('w03')
  const log = useLog('w03')
  return (
    <AppShell
      wf="w03"
      currentPage="catalog"
      title="A · 资产目录与库存查询"
      run={round}
      actions={
        <>
          <button
            type="button"
            className="btn-secondary"
            data-testid="regenerate"
            onClick={() => regenerateRound('w03', buildW03Round)}
          >
            随机生成本轮测试数据
          </button>
          <button
            type="button"
            className="btn-danger"
            data-testid="clear-progress"
            onClick={() => clearLog('w03')}
          >
            清空本轮申请记录
          </button>
        </>
      }
    >
      {round ? (
        <>
          <Callout tone="info" title="库存锁定说明" testId="stock-note">
            本页<span className="font-semibold">不会</span>在刷新时重开一轮（否则会丢失已锁定库存）；需要新数据请点右上角
            「随机生成本轮测试数据」。剩余 = 初始库存 − 已提交申请单锁定的数量。
          </Callout>
          <Catalog round={round} log={log} />
        </>
      ) : null}
    </AppShell>
  )
}

function Catalog({ round, log }: { round: Round<W03Data>; log: ReturnType<typeof useLog> }) {
  const data = round.data
  const orders = readOrders(log, round)
  const [keyword, setKeyword] = useState('')
  const [inStockOnly, setInStockOnly] = useState(false)
  const bounds = deliveryBounds(data)

  const filtered = useMemo(() => {
    const kw = keyword.trim()
    return data.catalog
      .map((category) => ({
        ...category,
        models: category.models.filter((model) => {
          const matchesKeyword =
            kw === '' || `${model.name}${model.spec}${category.name}`.includes(kw)
          const locked = lockedQuantity(orders, model.id)
          return matchesKeyword && (!inStockOnly || model.stock - locked > 0)
        }),
      }))
      .filter((category) => category.models.length > 0)
  }, [data.catalog, keyword, inStockOnly, orders])

  return (
    <>
      <Panel title="本轮申请上下文" testId="applicant-brief">
        <KeyValue
          items={[
            { label: '申请人', value: data.applicant.name, testId: 'applicant-name' },
            { label: '部门 / 工位', value: `${data.applicant.department} ${data.applicant.seat}`, testId: 'applicant-dept' },
            { label: '单次领用额度', value: `¥${data.budgetCap.toLocaleString('zh-CN')}`, testId: 'budget-cap' },
            { label: '单次数量上限', value: `${data.maxQuantityPerOrder} 台`, testId: 'qty-cap' },
          ]}
        />
        <p className="mt-3 text-sm text-slate-600" data-testid="delivery-window">
          期望交付日期需为工作日，且在 {bounds.min} ~ {bounds.max} 之间；行政不安排周末配送。
        </p>
      </Panel>

      <Panel
        title="资产目录"
        description="库存与单价是申请页的必填依据，请在此读取"
        testId="catalog"
        actions={
          <div className="flex items-center gap-2">
            <input
              className="input w-44"
              placeholder="搜索型号 / 规格"
              data-testid="search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input
                type="checkbox"
                className="size-3.5 accent-indigo-600"
                data-testid="in-stock-only"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
              />
              仅看有货
            </label>
          </div>
        }
      >
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-500" data-testid="empty-catalog">
            没有符合条件的资产。
          </p>
        ) : (
          <div className="space-y-5">
            {filtered.map((category) => (
              <div key={category.id} data-testid={`category-${category.id}`}>
                <h3 className="mb-2 text-sm font-semibold text-slate-900">
                  {category.name}
                  <span className="ml-2 font-mono text-xs font-normal text-slate-400">{category.id}</span>
                </h3>
                <div className="overflow-x-auto">
                  <table className="table-base whitespace-nowrap text-xs">
                    <thead>
                      <tr>
                        <th>型号 ID</th>
                        <th>型号</th>
                        <th>规格</th>
                        <th className="text-right">单价</th>
                        <th className="text-right">初始库存</th>
                        <th className="text-right">已锁定</th>
                        <th className="text-right">剩余</th>
                      </tr>
                    </thead>
                    <tbody>
                      {category.models.map((model) => {
                        const locked = lockedQuantity(orders, model.id)
                        const remaining = model.stock - locked
                        return (
                          <tr
                            key={model.id}
                            data-testid={`model-row-${model.id}`}
                            data-stock={remaining > 0 ? 'in-stock' : 'out-of-stock'}
                            className={remaining <= 0 ? 'bg-rose-50/60' : ''}
                          >
                            <td className="font-mono text-slate-500">{model.id}</td>
                            <td className="font-medium text-slate-900" data-field="model-name">
                              {model.name}
                            </td>
                            <td className="text-slate-500">{model.spec}</td>
                            <td className="text-right font-mono" data-field="price">
                              ¥{model.price.toLocaleString('zh-CN')}
                            </td>
                            <td className="text-right font-mono">{model.stock}</td>
                            <td className="text-right font-mono" data-field="locked">
                              {locked}
                            </td>
                            <td className="text-right font-mono" data-field="remaining">
                              {remaining > 0 ? (
                                remaining
                              ) : (
                                <Badge tone="red" testId={`out-of-stock-${model.id}`}>
                                  缺货
                                </Badge>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4">
          <a className="btn-primary" href={siblingHref('apply')} data-testid="go-apply">
            前往领用申请 →
          </a>
        </div>
      </Panel>

      {orders.length > 0 ? (
        <Panel title="本轮已生成订单" description="提交即锁定库存" testId="order-summary">
          <ul className="space-y-1 text-sm text-slate-600">
            {orders.map((order) => (
              <li key={order.orderId} data-testid={`order-${order.orderId}`}>
                <span className="font-mono text-xs text-slate-400">{order.orderId}</span> · {order.modelName} ×
                {order.quantity} · 期望交付 <span className="font-mono">{order.deliveryDate}</span> · 合计{' '}
                <span className="font-mono">¥{order.total.toLocaleString('zh-CN')}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </>
  )
}
