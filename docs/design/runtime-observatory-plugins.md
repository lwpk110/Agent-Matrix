# 多 Agent 运行时观测站

2026-10-20，基于 `12e040a`。用户已确认复用现有 Codex 观测站，通过插件接入 Claude 和后续 Agent。

## 目标与边界

2D、3D、回放、资源面板和事件详情消费同一套正式运行时展示模型。协议差异、品牌、路由、连接状态和可选数据读取由内置插件负责。本轮提供 Codex、Claude 两个实现，静态注册受信任的项目代码；不增加远程插件安装机制，不改后端 journal/REST/WS 格式。

保留 `/codex`、`/codex/3d`、`/codex/runtime` 和模拟原型路由；新增 `/claude`、`/claude/3d`，保留 `/claude/runtime`。Three.js、布局及现有样式沿用，避免同时重写数据流与视觉交互。

## 数据与职责

流程为：已脱敏日志 → Agent 插件 → 公共会话投影 → 正式 RuntimeSession/RuntimeEvent → 共用 2D/3D。

正式类型独立于 mock 工厂。事件携带 provider、会话、回合、调用标识、规范化节点和状态、原始事件名、明确的真实/模拟标记及已观测流向。既有 mock 类型可通过别名兼容。资源用量和耗时允许未知值，不将缺失值转成 0。

插件负责接纳自己的日志、事件语义映射、名称和路由、网关状态，以及可选 telemetry/Skill 来源读取。公共层负责会话选择、排序和调用合并；身份至少包含 provider/session/turn/call。共享组件不得根据品牌字符串判断事件真伪，也不得直接请求 Codex 专属 API。

统一观测数据 Hook 按插件和当前会话读取可选数据，支持取消请求，切换 provider/session/turn 后旧响应不能覆盖新会话。原始协议保留在证据详情中，不向展示层泄露未脱敏字段。

## Claude 映射

`UserPromptSubmit` 为输入；工具前后事件映射开始/完成；`PostToolUseFailure` 映射失败；`PermissionRequest` 等待，`PermissionDenied` 拒绝；主 `Stop` 的 `last_assistant_message` 为最终答复；子 Agent 启停只表达子生命周期，不结束主回合。MCP、搜索和工具按官方可见字段分类。

Claude Hook 本身不提供完整模型用量；经用户授权的本地统计读取器可通过 Claude 专属 telemetry 接口补齐明确关联回合的模型、推理档位、用量、请求数和时长，实际请求模型优先于 Hook 宣告。上下文容量、完整系统指令和记忆快照没有来源时仍显示未采集。工具响应仅有存在标记，不恢复正文。Claude 页面不请求 Codex rollout 或 Skill API。Desktop 统计独立位于 `/claude/desktop`，仅展示统计元数据，不伪造工具链或流程。

## 空态与兼容

实时入口无事件显示等待，历史失败显示错误，离线显示连接状态；只有显式原型入口可使用 demo。所有导航跟随当前插件，2D/3D/trace 不跨到另一个 Agent。

2D/3D 使用独立空态组件，避免缺少真实会话时渲染模拟资源、输入和光流。3D 在空态转为已观测会话时初始化画布；原型入口忽略实时日志，也不启动 telemetry 读取。

## 插件接入接口

在 `src/services/runtimePlugins.ts` 注册静态插件，必填 `provider`、`label`、三种视图的 `paths`、`accepts` 与 `mapEvent`。公共投影负责形成当前会话；有特殊协议的插件可实现 `project`。新增插件无需修改共享 2D/3D 组件。

可选扩展包括 `connectionStatus(status)`、`loadTelemetry(sessionId, turnId, signal)`、`loadSkillSources(name, cwd, signal)` 与 `clearRuntime()`。连接状态包含可选的 Hook 网关状态、端口及 app-server 状态；未实现时显示未采集，不读取其他 Agent 的状态。`capabilities` 声明可用的资源遥测、Skill 来源和提示词遥测能力。

telemetry 轮询使用 provider/session/turn 身份，单次请求完成前不并发轮询；切换身份后立即隐藏旧数据并取消请求。取消后仍返回的旧响应也不会发布，成功返回 `null` 会清除旧数据。返回值省略会话或回合 ID 时沿用请求身份，明确返回了冲突 ID 时拒绝展示。

本轮插件扩展范围为规范化日志的展示与可选数据读取。第三方 Agent 的协议采集、后端 journal/REST/WS 接入仍需在数据源侧提供，注册展示插件不会自动安装采集器。

## 验收

- Codex 现有 telemetry、Skill、流向及调用配对回归通过。
- Claude 两种视图正确呈现输入、调用成功/失败、权限拒绝、最终答复和子 Agent 事件。
- 同 session/turn/call ID 的混合日志不串 provider，迟到请求不覆盖当前数据。
- 测试插件无需修改渲染组件即可生成展示模型与导航。
- 实时空态不落入 demo，原型仍独立可回放。
- Claude/Codex 测试、类型检查、生产构建和 diff 检查通过；浏览器核对六个实时入口及原型入口。

### 品牌图标与 Claude 统计（2026-10-21）

- Claude 使用 [Claude 官方首页](https://claude.com) Wordmark 中的 sun mark 原始 SVG 路径和 `#D97757`；Codex 使用 [LobeHub Codex 矢量图标](https://github.com/lobehub/lobe-icons/blob/master/packages/static-svg/icons/codex.svg) 的专用 `>_` 标识，来源为第三方整理，未声称由 OpenAI 官网直接下载。2D SVG 与 3D CanvasTexture 共用路径，品牌标以填充而非描边渲染。
- 核心图标与文字分开排布，图标盒与圆形核心的中心坐标一致；错误和压缩告警继续覆盖基础品牌色。
- Claude 上下文显示最近一次请求的输入合计，即使窗口容量未知也保留已知 Token；容量不按模型名推测。
- Claude 提示词监控仅投影提交时间、回合关联及接收/处理/完成生命周期，面板和事件依据不渲染正文。
- memory 仅根据同一会话的 Hook `cwd` 映射当前项目，读取常规文件数量、总大小和最新修改时间；拒绝符号链接逃逸，文件存在不代表已经加载或使用。
