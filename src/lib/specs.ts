import type { WorkflowId } from './store'
import type { WorkflowSpec } from './spec'
import w01 from '../../workflow-01-reimbursement/spec.json'
import w02 from '../../workflow-02-weekly-report/spec.json'
import w03 from '../../workflow-03-asset-apply/spec.json'

/**
 * 构建期做结构校验（JSON 必须匹配 WorkflowSpec），
 * 运行期再断言 spec.workflow 与注册表 key 一致，防止文件被复制错目录。
 */
function bind(spec: WorkflowSpec, id: WorkflowId): WorkflowSpec {
  if (spec.workflow !== id) {
    throw new Error(`spec.json 声明的 workflow=${spec.workflow} 与所在目录 ${id} 不一致`)
  }
  return spec
}

export const SPECS: Record<WorkflowId, WorkflowSpec> = {
  w01: bind(w01, 'w01'),
  w02: bind(w02, 'w02'),
  w03: bind(w03, 'w03'),
}
