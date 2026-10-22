# 多 Agent 观测站实施清单

**目标：** Codex、Claude 共用 2D/3D 观测站，第三个 Agent 通过内置插件注册接入。

**架构：** 正式展示类型 + 插件注册表 + 公共会话投影/加载 Hook + 共用渲染。保留旧 URL、适配器导出与 mock 别名，不改后端存储协议。

**技术：** TypeScript、React、Three.js、node:test、tsx、Vite。

## 所有权与依赖

| 任务 | 类型 | owner | 依赖 | 边界与完成条件 |
| --- | --- | --- | --- | --- |
| P | plan | 主 agent | 无 | 本设计和清单，已批准的架构边界明确 |
| I1 | implement | global_implementer_terra | P | `src/types/runtime.ts`、mock 兼容、插件契约与注册表；正式类型不依赖 mock 工厂 |
| I2 | implement | 同一 implementer | I1 | 公共投影、Codex/Claude 插件、旧 adapter wrapper；provider 隔离与 Claude 语义测试通过 |
| I3 | implement | 同一 implementer | I2 | 共用数据 Hook、2D/3D/详情/资源与路由；Claude 无 Codex API 请求，实时空态无 demo |
| V | verify | 主 agent | I3 | 全部相关测试、lint/build、浏览器行为与 API 状态检查 |
| R | review | global_reviewer_sol | V | 只读审查实际 diff，修复有效问题并定向复验 |

## 测试优先步骤

- [x] 混合 provider 同标识隔离、Claude 失败/拒绝/最终答复/子 Agent 行为用例通过。
- [x] 抽正式 RuntimeSession/RuntimeEvent，保留 mock alias；公共适配不依赖品牌字符串。
- [x] 实现插件投影，保留 Codex 既有 adapter 行为。
- [x] 增加可选 telemetry/Skill 接口和取消/过期响应用例，收敛两个视图重复 polling。
- [x] 将 2D/3D 渲染改为消费插件与统一模型，扩展 `/claude`、`/claude/3d`，保留旧入口和原型。
- [x] 核对导航、空态、未知资源、来源标记以及第三插件三路由接入用例。
- [x] 执行 Claude/Codex runtime、Codex prototype、runtime observation、runtime views 测试及 lint、build、diff 检查。
- [x] 浏览器核对 Codex/Claude 2D、3D、trace、节点详情和原型；记录无法执行的验证。
- [x] reviewer 审查，修复有效问题并定向复验；最终结论 `ship`，无剩余 finding。

本轮共享文件和模型串行由同一实现 agent 修改，主 agent 只维护文档和整合验证。`.claude/settings.json` 为已有本机配置，保持不动。

## 复审验收项

首轮自动检查通过后，浏览器和只读审查发现了测试覆盖缺口；以下行为必须通过后才视为完成：

| 场景 | 完成条件 |
| --- | --- |
| 实时无事件 | 2D/3D 显示等待、加载或错误；无 demo 文案、模拟输入、模拟资源或虚构光流 |
| 明确原型入口 | 仍可使用演示输入、回放和模拟资源，与实时入口分离 |
| 混合同标识 | core 状态、提示词、工具调用和 telemetry 按 provider/session/turn 隔离 |
| 压缩后结束 | 主 Stop 或明确恢复事件结束旧 PreCompact 状态；子 Agent 结束不会结束主回合 |
| 调用详情 | 保留实际工具名；未知耗时和模型请求数显示未采集 |
| 第三插件 | 仅注册即可解析路由、自定义 flow、telemetry 和 Skill 数据源，无需修改共享视图 |
| 异步切换 | 取消后与旧 provider/session/turn 的迟到响应不会覆盖当前数据 |
| 3D 导航 | 中央节点品牌正确；约 997px 宽度下标题与插件导航正常排布 |

验收数据运行在独立端口与临时 journal，主服务真实历史不写入合成事件。已提交基线 `12e040a` 已推送到 `origin/main`；本轮插件改造保持未提交，待最终验收。

## 浏览器验证记录（2026-10-21）

- 主服务 `3000`：Codex Hook/app-server 均 listening，事件缓冲已达 2000 条；Claude 事件为 0，2D/3D 均显示等待空态且无 demo。Codex 实时 3D 创建一个 canvas；显式 2D/3D 原型在真实日志存在时仍显示 `sess_demo_024`。
- 独立服务 `3100`：使用临时 journal，Codex 3 条、Claude 24 条，包含相同 session/call 标识。Claude 当前回合 12 条事件、2 次调用，2D 正确显示失败、拒绝、MCP、压缩和主/子结束；Bash 详情显示失败且耗时未采集。Codex 2D 保留自己的对照提示词。
- Claude 3D 历史加载后创建一个 canvas，工具节点详情显示失败且跳转到 `/claude?node=tool`；1003px 宽视口标题可用宽度 925px。Claude trace 展示自身提示词及主回合最终答复。
- 未启动真实 Claude 客户端执行任务；隔离 Hook 数据验证不能替代真实 Claude 客户端端到端验收。
- 390px 手机视口为单列标题，可用宽度 356px；1003px 中屏标题可用宽度 925px，两者均无横向溢出且有一个 canvas。浏览器视口覆盖已恢复默认。

## 最终验证

Claude runtime 18 项、Codex runtime 34 项、Codex prototype 37 项、runtime observation 5 项、runtime views 3 项，共 97 项通过。类型检查、生产构建、`git diff --check` 通过。构建保留既有 Vite 配置与 chunk 大小提示。

最终复审结论为 `ship`。残余验证缺口：真实 Claude 客户端端到端采集、Skill 客户端 `useEffect` 加载链路的 DOM 测试。第三方 Agent 的后端 journal/REST/WS 接入不属于本轮静态展示插件范围。
