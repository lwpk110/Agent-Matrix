# ⚡ AGENT MATRIX · NEURAL TREE
### 生产级 AI 智能体运行时控制平面与安全审计网关 (Production-Grade Agent Control Plane)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.x-cyan.svg)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![VS Code](https://img.shields.io/badge/VS%20Code-Extension-007acc.svg)](https://code.visualstudio.com/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-4.x-38bdf8.svg)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-Apache%202.0-purple.svg)](LICENSE)

---

## 🌟 项目简介 (Overview)

**AGENT MATRIX · NEURAL TREE** 是一套专为 **Claude Code**（Opus / Sonnet / Haiku）与 **OpenAI Codex**（o3-pro / Codex-1 / Codex-Mini）多智能体工作流打造的**纯黑赛博朋克极简终端 HUD 看板与生产级安全审计控制平面**。

针对工程师体验进行了极致优化：
- **零 Python 依赖 (Zero-Python)**：无需安装 Python、pip、FastAPI 或 Uvicorn，全部采用纯 TypeScript / Node.js 实现。
- **VS Code / Cursor 原生插件 (One-Click Extension)**：随编辑器启动在后台无缝拉起 7788 网关，状态栏常驻指示灯，并支持在 IDE 内部直接分屏唤起暗黑控制看板。
- **内嵌统一网关服务 (`server.ts`)**：执行 `npm run dev` 即可同时启动 Web HUD 看板与 7788 安全拦截总线，零额外操作。

---

## 🎯 4 大生产级核心特性 (Production-Grade Features)

### 1. 原生 IDE 插件与实时 WebSocket 遥测总线
- **VS Code / Cursor 原生插件 (`vscode-extension/`)**: 随 IDE 启动自动启动网关服务，状态栏常驻 `$(shield) ⚡ Agent Matrix: Online [7788]`。
- **双向联动总线**: 自动握手 `ws://localhost:7788/ws` 接收 Claude Code `PreToolUse` / `PostToolUse` 与 Codex CLI 事件。
- **智能平滑降级**: 本地未启动网关时自动转入**实时仿真演练模式 (Simulation Mode)**，后台自带退避探针心跳探测，顶部状态灯直观显示 `LIVE / PROBING / SIMULATION`。

### 2. 高危操作热熔断与人工审批网关 (HITL Gatekeeper)
- **智能熔断策略**: 实时匹配高危路径（如 `auth.ts`、`k8s/prod-secrets.yaml`、数据库迁移或风险值 $Risk \ge 2.0\%$）。
- **节点热挂起**: 命中高危时自动冻结智能体执行流，相关拓扑节点进入红黄交替霓虹脉冲的 `[等待审批 / BLOCKED]` 状态。
- **IDE 弹窗与控制面板双重审批**:
  - **IDE 原生通知**: VS Code 右下角弹窗一键 `[Approve]` / `[Rollback]`。
  - **Opus 战略审计抽屉**: 高亮 Diff 对比，支持【批准放行】、【拒绝回滚】、【注入修正指令】。

### 3. 多会话并发集群 (Multi-Session Fleet) 与 FinOps 监控
- **预置 3 大真实生产工作区**:
  1. `#1 auth-oauth-refactor`: OAuth2 零信任安全重构，分支 `feat/neural-auth`。
  2. `#2 k8s-cnpg-scaling`: CloudNative-PG 伸缩与调度，触碰机密 `k8s/prod-secrets.yaml`。
  3. `#3 doris-sql-opt`: Apache Doris 分布式查询与物化视图性能调优。
- **实时 FinOps 指标栏**: Token 燃烧速率 ($/min)、上下文水位线 (91.2%)、AST 圈复杂度增量 ($\Delta M$)、死循环防击穿熔断计数。

### 4. 一键免配置与原生插件集成
- 顶部常驻 **【⚡ 接入本地 Claude/Codex】** 模态框：
  - **VS Code / Cursor 插件指南**: 一键加载与调试。
  - **1 行终端自动配置命令**: 自动写入 `.claude/settings.json`。
  - **免 Python 纯 TypeScript 网关源码**: 内置 Node.js 高可用实现。

---

## 🚀 极简快速启动 (Quick Start - Zero Python!)

### 方式 1：一键启动完整控制平面 (包含内嵌 7788 网关)
```bash
# 1. 安装依赖
npm install

# 2. 启动服务 (同时启动 Web HUD 看板与 7788 安全网关！)
npm run dev
```
> 在浏览器打开 `http://localhost:3000` 即可访问看板，且本地网关已自动就绪！

---

### 方式 2：作为 VS Code / Cursor 插件启动
```bash
cd vscode-extension
npm install
# 在 VS Code 中按 F5 启动 Extension Development Host
```
> VS Code 启动后状态栏将出现 `⚡ Agent Matrix: Online [7788]`，点击即可在侧边栏分屏打开控制平面！

---

### 方式 3：为 Claude Code 一键注入钩子
在你的任意项目根目录执行这 1 行命令：
```bash
mkdir -p .claude && cat << 'EOF' > .claude/settings.json
{
  "hooks": {
    "PreToolUse": "curl -s -X POST http://localhost:7788/hook/pre -H 'Content-Type: application/json' -d @-",
    "PostToolUse": "curl -s -X POST http://localhost:7788/hook/post -H 'Content-Type: application/json' -d @-"
  }
}
EOF
```

### 方式 4：查看 Codex CLI 真实运行事件

本仓库的 `.codex/hooks.json` 配置 Codex 官方生命周期 Hook。启动控制台后，在 Codex 中运行 `/hooks`，审核并信任 `Agent Matrix local Codex runtime telemetry`；Codex 只会在信任后向本地 `127.0.0.1:7789` 网关上报事件。Hook 覆盖提示提交、工具调用前后、权限请求、子 Agent、压缩与回合生命周期。

打开 `/codex` 工作台查看实时事件、会话/回合关联和脱敏详情。事件只通过本机回环接口传输，不广播给局域网看板客户端，服务端会为重连中的本地看板保留最近 500 条事件，并将脱敏事件追加到 `.codex/runtime-events.jsonl` 以便服务重启后恢复。MCP 及其他本地工具调用会按 Hook 实际上报展示；Codex 托管的 `WebSearch` 不经过本地工具 Hook，当前不会被采集。Skills 也没有独立的激活事件，只有 Hook 可见的明确技能元数据才会出现。Codex 不提供完整组装后的隐藏系统上下文或模型私有推理链；这些细节不会伪装成实时数据。

---

## ⌨️ 控制台交互命令行 (CLI Cheatsheet)

在看板底部的终端命令行（`~/agent-tree $`）中可直接输入指令：
| 指令 | 说明 |
| :--- | :--- |
| `approve` | 人工批准放行当前挂起的工具调用 |
| `rollback` | 拒绝并回滚当前补丁至安全快照 |
| `prompt <约束内容>` | 向挂起的 Agent 注入修正提示词并重新推理 |
| `inject [bash\|edit\|grep\|ast]` | 注入模拟的工具调用事件 |
| `session [1\|2\|3]` | 切换多会话并发集群工作区 |
| `alert` | 立即触发高危操作热熔断演练 |
| `mode [claude\|codex\|hybrid]` | 切换底层 AI 智能体模型矩阵栈 |
| `lang [zh\|en]` | 切换中英文系统语言 |
| `clear` | 清空当前会话日志流缓冲区 |

---

## 📄 授权协议 (License)

Apache License 2.0.
