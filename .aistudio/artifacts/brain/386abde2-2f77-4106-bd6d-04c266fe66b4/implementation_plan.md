# 原生插件与零 Python 内嵌网关升级方案
## Native IDE Extension & Zero-Python Embedded Gateway Implementation Plan

---

### 1. 目标与用户选择 (User Intent & Confirmed Preferences)

针对用户提出的“启动独立 Python Web 服务不够原生友好，期望像插件一样一键安装、一键自启动”的诉求，结合用户的明确确认：
1. **形态定位**: **VS Code / Cursor IDE 插件 (Auto-start Extension)**，在编辑器内直接启动，并在状态栏常驻网关控制器；
2. **运行模式**: **内嵌网关模式 (Embedded Gateway)**，直接由 Node.js / TypeScript 驱动，与 Web 控制平面同生共存，**完全彻底摆脱 Python、pip、FastAPI、Uvicorn 等外部环境依赖**，实现零额外进程、开箱即用。

---

### 2. 系统架构与交互拓扑 (Architecture Diagram)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        VS Code / Cursor IDE 编辑器生态空间                              │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  [状态栏 Status Bar]: ⚡ Agent Matrix: Online [Port 7788]  [点击唤起 Webview 控制看板]   │
│                                                                                        │
│  ┌─────────────────────────────────┐        ┌──────────────────────────────────────┐  │
│  │ VS Code Extension (extension.ts)│◄──────►│ 内嵌 TypeScript 网关服务 (Node.js)    │  │
│  │ • 随 IDE 启动自动拉起            │        │ • 零 Python 依赖，无外部进程          │  │
│  │ • 注册审批拦截与快捷放行命令     │        │ • 监听 /hook/pre 与 /ws 遥测总线     │  │
│  └────────────────┬────────────────┘        └──────────────────┬───────────────────┘  │
└───────────────────┼────────────────────────────────────────────┼──────────────────────┘
                    │                                            │
        (PreToolUse 拦截与审计)                      (实时 WebSocket 广播)
                    │                                            │
                    ▼                                            ▼
┌───────────────────────────────────────┐    ┌──────────────────────────────────────────┐
│ Claude Code / Codex 本地运行时        │    │ 赛博朋克控制平面 (Web HUD / IDE Webview) │
│ • 自动生成 ~/.claude/settings.json    │    │ • 实时拓扑神经树与示波器波形             │
│ • 命中敏感操作挂起等待审批            │    │ • HITL 拦截抽屉: 批准/回滚/注入指令      │
└───────────────────────────────────────┘    └──────────────────────────────────────────┘
```

---

### 3. 具体实施模块 (Implementation Modules)

#### 模块 1：VS Code / Cursor 原生插件工程 (`vscode-extension/`)
- **`vscode-extension/package.json`**:
  - 声明插件激活事件 (`onStartupFinished`, `workspaceContains:.claude`),
  - 声明贡献点: 状态栏项 (`agentMatrix.status`)、快捷命令 (`Agent Matrix: Open Control Plane`、`Agent Matrix: Approve Current Block`、`Agent Matrix: Rollback`)、侧边栏视图 (`agentMatrix.view`).
- **`vscode-extension/src/extension.ts`**:
  - 随 VS Code / Cursor 打开自动启动内置轻量 HTTP + WebSocket 服务（Node.js 原生 `http` + `ws`，免除任何 Python 安装）；
  - 自动在当前工作区生成或更新 `.claude/settings.json` 钩子配置，实现真正的“安装插件即完成配置”；
  - 提供内嵌 Webview Panel，用户可直接在 VS Code 标签页中并排查看暗黑赛博朋克控制平面，无需离开编辑器！

#### 模块 2：Web 应用内嵌统一服务网关 (`server.ts`)
- 将原本独立的 Python `gateway.py` 逻辑用纯 TypeScript / Express / WebSocket 完整重写并合入项目的 `server.ts`；
- 支持统一单端口运行：同时提供 Web HUD 界面、`/hook/pre`、`/hook/post` 以及 `/ws` 遥测总线；
- 彻底废除本地对 Python、uvicorn 的环境依赖，用户仅需 `npm run dev` 或 `npm start` 即可同时拥有控制平面与网关。

#### 模块 3：【⚡ 接入本地 Agent】弹窗升级为【一键插件与零依赖安装】
- 弹窗重新设计为 3 大纯原生标签页：
  1. **【VS Code / Cursor 插件一键安装】**: 提供插件直接安装指南、`.vsix` 打包说明、与状态栏常驻效果说明。
  2. **【一键免配置脚本】**: 提供纯 Node.js / Bash 极简命令（`npx @agent-matrix/setup` 或 1 行 curl 自动写入 hooks 配置）。
  3. **【原生 TypeScript 内嵌网关源码】**: 展示免 Python 的纯 TypeScript 网关实现，支持作为微服务直接由 Node 运行。

#### 模块 4：文档全面更新 (`README.md` 与 `DEPLOYMENT.md`)
- 剔除必须安装 Python / pip 的过时要求；
- 增加 VS Code / Cursor 插件使用说明与 IDE 内嵌 Webview 控制面板体验指引。

---

### 4. 验证计划 (Verification Plan)

1. **类型与构建验证**: 执行 `npm run lint` 和 `npm run build` 确保零错误。
2. **VS Code 插件清单合法性验证**: 检查 `vscode-extension/package.json` 和 `extension.ts` 语法规范。
3. **内置网关联动测试**: 验证 Web 端状态灯即时显示内置网关连接状态，无需任何外部 Python 命令行。
4. **弹窗与交互体验测试**: 点击【⚡ 接入本地 Agent】验证全新 IDE 插件与一键安装指引流畅展示。
