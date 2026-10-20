# Claude Code 运行时观测

Claude runtime 通过 Claude Code 官方 command Hook 将生命周期 JSON 发送到本机 `127.0.0.1:7788/hook/claude`。采集范围是官方 Hook 实际暴露的 `session_id`、`tool_use_id`、工具、工作目录、模型、权限模式和子代理标识，以及 `Stop`/`SubagentStop` 的用户可见最终答复。

事件会先脱敏，再写入独立的 `.claude/runtime-events.jsonl`。最近 2,000 条事件可通过 REST 与本机 WebSocket 重放；清除 Claude 历史不会触碰 Codex journal。网关、历史读取、设置安装和 WebSocket replay 都限制为 loopback 客户端。

不会采集 transcript 路径、隐藏系统上下文、私有推理或工具返回内容。`PreToolUse` 与 `PostToolUse` 只基于同一 session 的 `tool_use_id` 配对；展示的毫秒值是 Hook 的观测间隔，不是工具执行时间。

运行 `node --import tsx scripts/configure-claude-runtime.mjs` 会合并 `.claude/settings.json`：保留已有配置与 Hook，重复运行不追加重复项。已有 settings 不是合法 JSON 时，脚本拒绝覆盖。
