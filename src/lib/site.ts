/**
 * 站点元数据注册表：title / description / canonical 路径 / 静态骨架文案的唯一来源。
 * vite.config.ts 在构建期据此给每个 HTML 入口注入 head 标签，
 * 因此新增页面只需要在这里登记一条，不会出现各页面手写漂移。
 *
 * 本文件必须保持纯数据（不得引用 store 等含浏览器副作用的模块），因为它同时在 Node 侧被读取。
 */

export interface PageMeta {
  /** 磁盘路径，与 HTML 入口一一对应 */
  file: string
  /** 规范化的对外 URL（Cloudflare Pages pretty URL，不带 .html） */
  path: string
  title: string
  description: string
  /** 静态骨架的 h1 */
  heading: string
  /** 静态骨架正文，不执行 JS 的抓取器与 LLM 也能读到站点语义 */
  intro: string[]
  /** 所属工作流，用于面包屑与 JSON-LD */
  workflow?: 'w01' | 'w02' | 'w03'
  /** 在该流程内的步骤序号（1 起） */
  step?: number
  /** 流程目录落地页：canonical 指向真正的 A 页，避免重复内容 */
  redirectsTo?: string
}

export const WORKFLOW_TITLES = {
  w01: '智能报销与审批闭环',
  w02: '日常周报自动汇总与提交',
  w03: '行政资产与设备领用申请',
} as const

export const WORKFLOW_DIRS = {
  w01: 'workflow-01-reimbursement',
  w02: 'workflow-02-weekly-report',
  w03: 'workflow-03-asset-apply',
} as const

export const PAGES: PageMeta[] = [
  {
    file: 'index.html',
    path: '/',
    title: 'MockOffice｜Web Agent 浏览器自动化能力测试与办公场景模拟站',
    description:
      '零后端纯静态的 Agent 评测站：报销审批、周报提交、资产领用三条办公工作流，数据每轮随机，含跨页搬运、条件闸门与多级联动陷阱，附 spec.json 评测契约与全局 Scorecard。',
    heading: 'MockOffice —— Web Agent 浏览器自动化测试站',
    intro: [
      'MockOffice 是一个轻量、零后端、纯静态的网页应用，用来评测 AI Agent 的浏览器自动化能力。',
      '站内有三个相互独立的办公工作流：智能报销与审批闭环、日常周报自动汇总与提交、行政资产与设备领用申请。',
      '每条工作流要求 Agent 在数据页读取本轮随机生成的业务数据，跨页面搬运到表单精确填写，再在审批或提交页完成闭环动作。',
      '所有状态都保存在浏览器 localStorage 中，没有服务端；每个流程目录下的 spec.json 是该流程的评测标准与 Ground Truth 推导规则。',
    ],
  },

  // ---------- Workflow 01 ----------
  {
    file: 'workflow-01-reimbursement/index.html',
    path: '/workflow-01-reimbursement/',
    title: '智能报销与审批闭环｜MockOffice 工作流 01',
    description: '报销审批工作流入口：自动进入发票数据池，读取本轮随机发票并完成填报与主管审批闭环。',
    heading: '工作流 01 · 智能报销与审批闭环',
    intro: [
      '本页是工作流 01 的目录落地页，会自动跳转到发票数据池。',
      '流程共三步：在发票池读取本轮待报销发票，在报销表单精确填写并提交，在主管审批后台依据政策通过或驳回。',
    ],
    workflow: 'w01',
    redirectsTo: '/workflow-01-reimbursement/source',
  },
  {
    file: 'workflow-01-reimbursement/source.html',
    path: '/workflow-01-reimbursement/source',
    title: 'A·发票数据池｜智能报销与审批闭环｜MockOffice',
    description:
      '报销工作流数据页：展示发票号、发票代码、开票日期、供应商、费用内容、类别与金额，每次加载重开一轮随机数据，其中仅一张为待报销。',
    heading: 'A · 发票数据池',
    intro: [
      '这张表格是本轮报销任务唯一的数据来源：发票号码为 12 位数字，金额精确到两位小数。',
      '表中只有一张发票状态为「待报销」，其余为已报销的干扰项；页面每次加载都会重新随机生成全部数据。',
      '需要报销的发票号、类别、金额与供应商都要从这里读取，再带到报销表单填写页使用。',
    ],
    workflow: 'w01',
    step: 1,
  },
  {
    file: 'workflow-01-reimbursement/form.html',
    path: '/workflow-01-reimbursement/form',
    title: 'B·报销表单填写｜智能报销与审批闭环｜MockOffice',
    description:
      '报销单填写页：填写发票号、报销类别、金额与费用说明，餐饮类必须勾选已附带合规说明，本页不提供任何发票数据。',
    heading: 'B · 报销表单填写',
    intro: [
      '本页用于提交费用报销申请，不提供任何发票原值，需要先在发票数据池读取待报销发票的信息。',
      '校验规则：发票号必须属于本轮待报销单据，类别与金额必须与发票一致，费用说明不少于 8 字且需包含供应商名称。',
      '当报销类别选择「餐饮」时，必须勾选「已附带合规说明」才允许提交。',
    ],
    workflow: 'w01',
    step: 2,
  },
  {
    file: 'workflow-01-reimbursement/audit.html',
    path: '/workflow-01-reimbursement/audit',
    title: 'C·主管审批后台｜智能报销与审批闭环｜MockOffice',
    description:
      '主管审批页：在待审批列表中定位目标报销单，依据本轮随机政策编号决定通过或驳回，驳回意见必须原样引用政策编号。',
    heading: 'C · 主管审批后台',
    intro: [
      '本页是主管视角的报销审批后台，列出本轮已提交的待审批单据。',
      '审批依据来自本轮随机政策：餐饮类且金额超过上限的单据一律驳回，且驳回意见必须原样引用本轮政策编号，其余单据可通过。',
      '通过或驳回的决定会写入浏览器 localStorage，供首页的全局 Scorecard 校验闭环是否完成。',
    ],
    workflow: 'w01',
    step: 3,
  },

  // ---------- Workflow 02 ----------
  {
    file: 'workflow-02-weekly-report/index.html',
    path: '/workflow-02-weekly-report/',
    title: '日常周报自动汇总与提交｜MockOffice 工作流 02',
    description: '周报工作流入口：自动进入个人工作台，提取本周已完成任务与核心指标后到 OA 周报页正式提交。',
    heading: '工作流 02 · 日常周报自动汇总与提交',
    intro: [
      '本页是工作流 02 的目录落地页，会自动跳转到个人工作台。',
      '流程共两步：在工作台提取本周已完成任务与核心指标，在周报编辑页填写并正式提交。',
    ],
    workflow: 'w02',
    redirectsTo: '/workflow-02-weekly-report/dashboard',
  },
  {
    file: 'workflow-02-weekly-report/dashboard.html',
    path: '/workflow-02-weekly-report/dashboard',
    title: 'A·个人工作台｜日常周报自动汇总与提交｜MockOffice',
    description:
      '个人工作台：展示本周任务（已完成/进行中/已阻塞混排、标题含随机单号）、四项核心指标与下周重点方向，每次加载重开一轮。',
    heading: 'A · 个人工作台',
    intro: [
      '本页模拟从 Jira 与 Git 聚合出的个人工作台，是周报任务唯一的数据来源。',
      '任务列表按已完成、进行中、已阻塞三种状态混排且顺序随机，每条标题带有随机单号；只有已完成任务需要写入周报总结。',
      '四项核心指标需要精确填报，另有变更行数、参会场次、线上事件等无需填报的参考项。',
    ],
    workflow: 'w02',
    step: 1,
  },
  {
    file: 'workflow-02-weekly-report/editor.html',
    path: '/workflow-02-weekly-report/editor',
    title: 'B·周报编辑与提交｜日常周报自动汇总与提交｜MockOffice',
    description:
      'OA 周报编辑页：填写本周工作总结、下周计划与四项核心指标，保存草稿不计入闭环，必须点击正式提交才完成流程。',
    heading: 'B · 周报编辑与提交',
    intro: [
      '本页用于填写并提交 OA 周报，不展示工作台的任务与指标原值。',
      '本周工作总结需逐条包含全部已完成任务的完整标题（含随机单号），且不得混入进行中或已阻塞任务。',
      '四项核心指标必须与工作台数值精确一致，下周计划需包含主管指定的重点方向词。',
      '「保存草稿」不会形成闭环，必须点击「正式提交」。',
    ],
    workflow: 'w02',
    step: 2,
  },

  // ---------- Workflow 03 ----------
  {
    file: 'workflow-03-asset-apply/index.html',
    path: '/workflow-03-asset-apply/',
    title: '行政资产与设备领用申请｜MockOffice 工作流 03',
    description: '资产领用工作流入口：自动进入资产目录，查询库存与单价后填写多级联动领用申请并锁定库存。',
    heading: '工作流 03 · 行政资产与设备领用申请',
    intro: [
      '本页是工作流 03 的目录落地页，会自动跳转到资产目录。',
      '流程共两步：在资产目录查询型号、单价与剩余库存，在领用申请页完成多级联动表单并提交生成订单。',
    ],
    workflow: 'w03',
    redirectsTo: '/workflow-03-asset-apply/catalog',
  },
  {
    file: 'workflow-03-asset-apply/catalog.html',
    path: '/workflow-03-asset-apply/catalog',
    title: 'A·资产目录与库存查询｜行政资产领用申请｜MockOffice',
    description:
      '资产目录页：按大类展示型号、规格、单价与初始库存、已锁定、剩余数量，含缺货干扰项，支持关键词搜索与仅看有货筛选。',
    heading: 'A · 资产目录与库存查询',
    intro: [
      '本页列出可领用的行政资产，按设备大类分组，给出每个型号的规格、单价、初始库存、已锁定数量与剩余数量。',
      '每轮至少有一个型号初始库存为 0，属于不可申请的缺货干扰项。',
      '剩余数量等于初始库存减去本轮已提交订单锁定的数量；本页刷新不会重开一轮，以免丢失已锁定库存。',
    ],
    workflow: 'w03',
    step: 1,
  },
  {
    file: 'workflow-03-asset-apply/apply.html',
    path: '/workflow-03-asset-apply/apply',
    title: 'B·资产领用申请（多级联动）｜MockOffice',
    description:
      '资产领用申请页：先选设备大类才会加载对应型号，需填写数量、领用理由与期望交付日期，交付日期不接受周末与窗口外日期。',
    heading: 'B · 资产领用申请',
    intro: [
      '本页是行政资产领用的多级联动申请表单，不展示库存与单价，需要先在资产目录页读取。',
      '型号下拉在选定设备大类之前处于禁用且为空的状态，选定后才会动态加载该大类下的型号。',
      '提交时校验数量不超过剩余库存与单次上限、合计不超过领用额度、领用理由字数达标、期望交付日期为窗口内的工作日。',
      '校验通过后生成领用订单并锁定对应库存，可回目录页看到剩余数量变化。',
    ],
    workflow: 'w03',
    step: 2,
  },
]

/** 落地页的静态骨架里给出的跳转目标 */
export const WORKFLOW_ENTRY: Record<'w01' | 'w02' | 'w03', string> = {
  w01: '/workflow-01-reimbursement/source',
  w02: '/workflow-02-weekly-report/dashboard',
  w03: '/workflow-03-asset-apply/catalog',
}

export function findPageByIdentifier(identifier: string): PageMeta | undefined {
  const normalized = identifier.replace(/\\/g, '/').replace(/^.*?\/(?=index\.html|workflow-)/, '')
  return PAGES.find((page) => page.file === normalized) || PAGES.find((page) => normalized.endsWith(page.file))
}
