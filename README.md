# MockOffice

轻量、零后端、纯静态的 **Web Agent 浏览器自动化能力测试与办公场景模拟站**。

三条独立的办公工作流，每条由若干真实 `.html` 页面组成：Agent 需要在 A 页读取**每轮随机生成**的数据，跨页面搬运到 B 页填写，再在 C 页完成审批/提交动作，全过程只靠 `localStorage` 留痕，最后由主页的全局 Scorecard 按 `spec.json` 声明的评测契约逐条判定。

## 快速开始

```bash
npm install
npm run dev        # http://localhost:5173 —— 开发
npm run build      # tsc 类型检查 + 产出 dist/
npm run preview    # 以真实静态托管方式验证 dist/
```

`dist/` 是纯静态产物，任意静态服务器（nginx、GitHub Pages、`npx serve`）都能直接托管，无需任何服务端逻辑。

## 目录结构

```
MockOffice/
├── index.html                     # 导航主页 + 全局 Scorecard
├── assets/styles.css              # Tailwind 入口（构建为 dist/assets/*.css）
├── workflow-01-reimbursement/     # 工作流 1：报销审批闭环
│   ├── index.html                 # 目录落地页，自动进入 A 页
│   ├── source.html  form.html  audit.html
│   └── spec.json                  # 评测标准与 Ground Truth 定义
├── workflow-02-weekly-report/     # 工作流 2：周报汇总与提交
│   ├── index.html
│   ├── dashboard.html  editor.html
│   └── spec.json
├── workflow-03-asset-apply/       # 工作流 3：行政资产领用
│   ├── index.html
│   ├── catalog.html  apply.html
│   └── spec.json
└── src/
    ├── entries/                   # 每个 .html 对应一个 React 挂载入口
    ├── pages/                     # 页面组件（按工作流分目录）
    ├── workflows/                 # 各流程的数据生成、校验规则与状态派生
    ├── components/ui.tsx          # AppShell / Panel / Field / Callout 等
    └── lib/
        ├── store.ts               # 基于 localStorage 的全局状态机
        ├── rng.ts                 # 可复现的伪随机数（seed 持久化）
        ├── spec.ts / specs.ts     # spec.json 的 TS 契约与注册表
        ├── checks.ts              # spec 驱动的检查项解释器
        └── workflows.ts           # 工作流元信息与页面导航
```

**与 PRD 的差异**：PRD 要求使用 React，因此工程采用 Vite 多页模式——每个工作流页面仍是磁盘上的真实 `.html`（URL 与 PRD 完全一致），但共享脚本以 TS 模块组织：PRD 的 `assets/store.js` 对应 [src/lib/store.ts](file:///Volumes/G/work/gholl/MockOffice/src/lib/store.ts)，`assets/tailwind.min.css` 对应 [assets/styles.css](file:///Volumes/G/work/gholl/MockOffice/assets/styles.css)（由 Tailwind v4 构建产出压缩 CSS）。

## 三条硬性指标如何落实

| 指标 | 实现 |
| --- | --- |
| 纯前端 / 零后端 | 所有读写走 `localStorage`，`npm run build` 产物无任何后端依赖；`window.mockOffice.inspect()` 可直接导出状态 |
| 防硬编码（动态扰动） | 每轮生成随机 `seed` 并持久化，发票号、金额、任务单号、库存、政策编号全部由 seed 派生；A 页刷新即重开一轮 |
| 闭环可测 | 每条流程的最后一步（审批 / 正式提交 / 生成订单）写入动作流水，Scorecard 按 `spec.json` 加权判定 |

## 工作流详解

### Workflow 01 · 智能报销与审批闭环

| 页面 | 作用 |
| --- | --- |
| `source.html` | 发票池（发票号/代码/日期/供应商/内容/类别/金额/状态），**每次加载重开一轮**；仅一张为「待报销」，其余 4~6 张是「已报销」干扰项 |
| `form.html` | 报销单：发票号、类别下拉、金额、备注、合规勾选。**本页不提供任何发票数据** |
| `audit.html` | 主管审批后台：待审批列表 + 通过/驳回，驳回意见必须引用本轮随机政策编号 |

陷阱：餐饮类别未勾选「已附带合规说明」时提交按钮置灰，且提交函数二次校验（即使程序化移除 `disabled` 也只会写入 `validation_block`，不生成单据）；备注需 ≥8 字且包含发票供应商；政策随机导致正确决定可能是「通过」也可能是「驳回」（餐饮且 > ¥2000 必须驳回）。

### Workflow 02 · 日常周报自动汇总与提交

`dashboard.html` 展示本周任务（已完成/进行中/已阻塞混排、顺序打乱，标题带随机 CR/WIP 单号）、四项核心指标与三个无需填报的干扰指标、主管指定的下周重点词；`editor.html` 要求逐条照抄已完成任务标题、精确填报四项指标、下周计划包含指定重点词，且**「保存草稿」不计闭环**，必须点「正式提交」。

### Workflow 03 · 行政资产/设备领用申请

`catalog.html` 每轮随机生成 3 个大类下的型号、单价与库存（至少一个缺货项），并展示「初始库存 / 已锁定 / 剩余」；`apply.html` 的型号下拉在未选大类时 `disabled` 且为空选项，选定后动态加载，同时校验数量 ≤ 剩余库存、数量 ≤ 单次上限、合计 ≤ 领用额度、领用理由字数、期望交付日期必须是窗口内的工作日。提交成功后生成订单并锁定库存，回到目录页可见「已锁定/剩余」变化。

目录页**刷新不重开轮次**（否则会丢失已锁定库存），需要新数据时点「随机生成本轮测试数据」。

## 状态模型

```
mockoffice.<w01|w02|w03>.round   { runId, seed, createdAt, schema, data }
mockoffice.<w01|w02|w03>.log     [ { at, action, detail }, ... ]
```

- **round**：本轮随机数据。`schema` 是结构版本号，旧版本数据会被自动丢弃并重开一轮，因此升级数据结构不会让页面崩溃。
- **log**：Agent 动作流水（`submit_reimbursement` / `audit_decision` / `submit_report` / `create_order` / `validation_block` …），只追加不改写。派生状态（审批结果、库存锁定量）一律由流水计算。
- **轮次作用域**：所有检查只统计 `entry.at >= round.createdAt` 的动作。刷新 A 页 = 作废上一轮进度，这是「防硬编码」的一部分。

## 评测契约 spec.json

每个流程目录下的 `spec.json` 是唯一评测标准，`src/lib/specs.ts` 在构建期用 TS 类型校验其结构，`src/lib/checks.ts` 在运行期解释执行；构建时 `spec.json` 会被原样拷贝进 `dist/`，外部 harness 读的是同一份文件。

```jsonc
{
  "pages": [{ "file": "form.html", "anchors": { "submit": "[data-testid=\"submit-form\"]" } }],
  "state": { "roundKey": "mockoffice.w01.round", "logKey": "mockoffice.w01.log", "actions": [...] },
  "dynamicFields": ["data.invoices[].no", "data.targetInvoiceNo", ...],
  "groundTruth": { "expectedDecision": "category === '餐饮' && amount > mealCap ? 'rejected' : 'approved'" },
  "traps": [{ "id": "T3", "page": "form.html", "name": "餐饮合规闸门", "description": "..." }],
  "checks": [{ "id": "W01-C6", "kind": "mealComplianceGate", "weight": 2, "title": "...", "hint": "..." }]
}
```

新增检查项：在 `spec.json` 的 `checks` 里加一条 `{ id, kind, weight, title, hint }`，并在 `src/lib/checks.ts` 的 `EVALUATORS` 注册同名 `kind`。未注册的 kind 不会崩，会被判为失败并提示「未实现的检查类型」。

三条流程各 13 分，总分 39 分。

## 给 Agent / 评测脚本的接口

- **选择器**：所有可交互元素与关键数据都带 `data-testid`（如 `input-invoice-no`、`approve-<发票号>`、`metric-commits`、`model-row-<型号ID>`），`spec.json` 的 `pages[].anchors` 列出每页关键锚点。
- **控制台桥**：`window.mockOffice.inspect()` 导出三条流程的当前轮次；`window.mockOffice.clearAll()` 全局重置。
- **评测模式**：`audit.html?eval=1` 才会渲染「本轮应做决定」，默认不显示，避免 Agent 直接读屏拿答案。
- **seed 复现**：轮次里的 `seed` 配合 `mulberry32` 可完整重算 Ground Truth，无需读 DOM。
- **结果导出**：主页 Scorecard 的「复制评测结果 JSON」输出机器可读的逐项判定。

校验提示刻意**不回显标准答案**（只说「与工作台数值不一致」），Agent 无法靠反复试错读出正确值，必须回 A 页读数。

## 部署到 Cloudflare Pages

**Git 集成（推荐）**

1. Cloudflare Dashboard → `Workers & Pages` → `Create` → `Pages` → `Connect to Git` → 选 `Gholls/MockOffice`。
2. Build settings：

   | 项 | 值 |
   | --- | --- |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Node.js version | 由仓库根的 `.node-version`（22.20.0）钉住 |

   Vite 8 要求 Node `^20.19 || >=22.12`，而 Pages 构建环境默认可能仍是 Node 18，**不钉版本会直接构建失败**；`package.json` 的 `engines` 同步声明了该约束。若想在控制台覆盖，可加环境变量 `NODE_VERSION=22.20.0`。

3. 保存并首次部署。此后 `main` 每次 push 自动构建，分支/PR 会拿到独立的预览域名。

**wrangler 手动部署（可选）**

```bash
npx wrangler pages deploy dist --project-name mockoffice
```

**为什么不需要额外配置**

- `base: './'` + 每个页面都是磁盘上的真实 `.html`，因此**不需要 SPA 回退（`_redirects`）规则**，也不依赖根路径部署；子路径托管和分支预览域名都能直接访问：
  `https://<project>.pages.dev/workflow-01-reimbursement/source.html`
- `spec.json` 会原样出现在 `dist/` 各流程目录下，外部 harness 可直接 `fetch('https://<project>.pages.dev/workflow-01-reimbursement/spec.json')`。
- 状态存在浏览器侧的 `localStorage`，按域名隔离：正式域名与预览域名互不影响，评测时固定用同一个域名即可。
- 全局广告干扰项在 Cloudflare 上会真实向 `pagead2.googlesyndication.com` 发起请求；因为没挂广告位，页面上不会出现可见内容。

**可用的 URL 形式**

| URL | 结果 |
| --- | --- |
| `/workflow-01-reimbursement` 或 `/workflow-01-reimbursement/` | 命中该目录的 `index.html`，自动跳到 A 页（发票池） |
| `/workflow-01-reimbursement/source.html` | 直接访问 A 页 |
| `/workflow-01-reimbursement/source` | Cloudflare Pages 的 pretty URL，等价于上一条 |

**Pages 设置里请关闭 SPA 回退**（Build & deploy 里的 "Single Page Application" / 自定义 404 回退到 `index.html` 那类选项）。本项目是真正的多页站点，开启后任何拼错的路径都会返回 **200 + 根主页**，页面看起来"打开了"但内容完全不对——这正是"进不去流程、提交按钮一直置灰"的典型成因。关闭后错误路径会正常返回 404。

## 已知边界

- **全局广告干扰项**：每个 HTML 入口都会由 Vite 的 `transformIndexHtml` 注入一段真实的 Google AdSense `<script async>`（见 [vite.config.ts](file:///Volumes/G/work/gholl/MockOffice/vite.config.ts) 的 `adsenseDistractor`），用来考察 Agent 是否会被第三方脚本、额外的网络请求和控制台报错带偏。它不挂 `<ins class="adsbygoogle">` 广告位，因此不会渲染出可见内容、不影响布局与 `localStorage`；在离线或网络受限环境下会在控制台留下一条资源加载失败的 error —— 这是预期噪声，评测脚本不应把「控制台有 error」当作任务失败。新增页面会自动继承该注入，无需手工复制标签；如需彻底移除，删掉 `plugins` 里的 `adsenseDistractor()` 即可。
- 视口较窄时资产目录等宽表格会横向滚动（数据完整在 DOM 中，可正常读取）。
- 交付日期窗口在轮次创建时冻结为 `deliveryWindow`，跨天评测不会漂移，但旧轮次的窗口提示会沿用创建当天的日期。
- 直接以 `file://` 打开 `dist/` 时，部分浏览器会限制 `localStorage` 与 JSON 读取，请通过 HTTP 托管（`npm run preview` 即可）。
