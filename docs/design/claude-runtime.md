# Claude Code 运行时观测

Claude runtime 通过 Claude Code 官方 command Hook 将生命周期 JSON 发送到本机 `127.0.0.1:7788/hook/claude`。采集范围是官方 Hook 实际暴露的 `session_id`、`tool_use_id`、工具、工作目录、模型、权限模式和子代理标识，以及 `Stop`/`SubagentStop` 的用户可见最终答复。

事件会先脱敏，再写入独立的 `.claude/runtime-events.jsonl`。最近 2,000 条事件可通过 REST 与本机 WebSocket 重放；清除 Claude 历史不会触碰 Codex journal。网关、历史读取、设置安装和 WebSocket replay 都限制为 loopback 客户端。

Hook 不采集 transcript 路径、隐藏系统上下文、私有推理或工具返回内容。`PreToolUse` 与 `PostToolUse` 只基于同一 session 的 `tool_use_id` 配对；展示的毫秒值是 Hook 的观测间隔，不是工具执行时间。

2026-10-21 用户授权读取本地 Claude 日志，仅提取统计元数据。统计读取器独立于 Hook，从本地项目 JSONL 中投影模型、推理档位、Token、请求计数、时长和会话/回合身份；不保存或展示日志正文、工具输出及原始路径。CLI 与 `claude-desktop-3p` 来源分开处理，Code 统计须与 Hook 回合明确关联。Desktop 统计单独展示，不生成虚构运行时事件。普通 Desktop Chat 没有受支持的本地记录时保持未接入。

`/api/real/claude-telemetry` 通过 Hook 的 `prompt_id` 与日志用户回合的 `promptId` 关联；不改变既有 Hook turnId。工具结果和内部消息不形成新用户回合，attachment 等父链节点只保留关联骨架。同一个模型请求的多条记录按请求身份合并，已知 Token 分项保持原生语义；输入合计包含原生输入、缓存创建和缓存读取。

当 transcript 具有完整父链时，观测站还只投影结构统计：`instructions.files` 的条目数、`prompt_snapshot` 的系统段和工具定义条目数，以及工具调用 ID、名称、结果是否观测到和显式失败标记。不会保存或返回文件路径、提示词、工具参数、工具结果或 schema。快照只沿当前最新模型请求的祖先链继承；祖先越过当前用户回合时标记为 session scope。工具调用按当前用户回合所有关联模型请求的 call ID 去重，缺少结果保持“未观测”。

`/api/real/claude-desktop-telemetry` 仅返回 Desktop 来源，页面位于 `/claude/desktop`。接口只允许本机观测站访问并禁止缓存响应。读取采用文件与字节预算，`partial` 表示增量读取尚未完成；前端持续刷新。`truncated` 表示超出缓存预算的旧历史已省略，未变化的省略文件不会反复重读。缓存只保存统计与哈希身份，按完整回合保留关联链。设置 `CLAUDE_DESKTOP_TELEMETRY_DISABLED=1` 可关闭本地统计读取。时长仅使用明确的回合时长记录，不由事件时间差推算。

运行 `node --import tsx scripts/configure-claude-runtime.mjs` 会合并 `.claude/settings.json`：保留已有配置与 Hook，重复运行不追加重复项。已有 settings 不是合法 JSON 时，脚本拒绝覆盖。
