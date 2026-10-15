# Agent Matrix · VS Code & Cursor IDE Extension

> ⚡ 生产级 AI 智能体运行时控制平面与安全审计网关的原生 IDE 插件 (Zero-Python 纯原生体系)

---

## 🌟 核心特性 (Features)

1. **自动后台启动安全网关 (Port 7788)**:
   - 随 VS Code / Cursor 启动，自动由 Node.js 运行时启动本地轻量 HTTP 与 WebSocket 服务；
   - **完全免除 Python、pip、FastAPI、Uvicorn 外部依赖**。

2. **状态栏常驻指标 (Status Bar Integration)**:
   - 状态栏右侧常驻徽章 `$(shield) ⚡ Agent Matrix: Online [7788]`；
   - 点击可直接在 VS Code 标签页中分屏打开控制平面 Webview。

3. **智能感知与 1 键注入配置**:
   - 首次打开工作区时，自动检测是否存在 `.claude/settings.json`；
   - 若未配置，弹出气泡提示 `[一键配置 (Auto-Configure)]`，自动注入 `PreToolUse` 和 `PostToolUse` 钩子。

4. **IDE 原生 HITL 人工审批交互**:
   - 当 Claude Code 或 Codex 尝试修改 `auth.ts`、`prod-secrets.yaml` 时，VS Code 右下角即刻弹出原生通知，提供快捷操作：
     - **Approve (放行)** (快捷键: `Cmd+Alt+Y` / `Ctrl+Alt+Y`)
     - **Rollback (回滚)** (快捷键: `Cmd+Alt+N` / `Ctrl+Alt+N`)
     - **Open Control Plane (打开控制平面)** (快捷键: `Cmd+Alt+M` / `Ctrl+Alt+M`)

---

## 🚀 本地开发与体验 (Development)

```bash
cd vscode-extension
npm install
```
在 VS Code 中按 `F5` 即可在新的扩展开发宿主窗口中实时调试并体验全部插件功能！
