export interface SpecCheck {
  id: string
  kind: string
  weight: number
  title: string
  hint?: string
  params?: Record<string, unknown>
}

export interface SpecTrap {
  id: string
  page: string
  name: string
  description: string
}

export interface SpecPage {
  file: string
  role: string
  regeneratesOnLoad: boolean
  /** `| undefined` 是必需的：JSON 页面结构不一致时 TS 会把缺失键推成 undefined */
  anchors?: Record<string, string | undefined>
  note?: string
  validation?: string
  cascading?: string
}

export interface WorkflowSpec {
  version: number
  /** JSON 导入会把它推宽为 string，由 specs.ts 在加载时断言与注册表的 key 一致 */
  workflow: string
  code: string
  title: string
  scenario: string
  pages: SpecPage[]
  state: { roundKey: string; logKey: string; actions: string[]; roundScope?: string }
  dynamicFields: string[]
  groundTruth: Record<string, string>
  traps: SpecTrap[]
  checks: SpecCheck[]
  fullScore: number
  partialCredit?: string
}
