# 生产与本地部署指南 (Deployment & Real Data Guide)
## AI Agent Control Plane & Security Audit Gateway

---

## 1. 真实数据模式与演练仿真模式 (Real Data vs Simulation)

本控制平面默认采用 **【真实本地工程模式 (Real Local Mode)】**：

| 数据模式 | 标识徽章 | 数据来源 | 说明 |
| :--- | :--- | :--- | :--- |
| **真实本地工作区** | `[⚡ REAL 本地]` | 本地 Git、真实文件目录、系统进程、实时 Claude/Codex 钩子 | 实时挂载当前本地工程，显示当前 Git 分支、未提交变更 (`git status`)、最新提交，支持真实终端命令执行与 Claude Code 拦截。 |
| **演练仿真场景** | `[仿真]` | 预设的 3 组企业级架构高危演练矩阵 | `#1 OAuth2 重构`、`#2 K8s 灾备`、`#3 Doris 视图`，用于演练安全熔断、人工审批与团队展示。 |

---

## 2. 快速启动与 1 键接入真实 Agent

### 2.1 启动统一服务 (纯 Node.js / TypeScript，零 Python 依赖)
在工程根目录下执行：
```bash
npm install
npm run dev
```
启动后：
- **Web 控制平面 HUD** 运行在: `http://localhost:3000`
- **安全拦截与 WebSocket 网关** 运行在: `http://127.0.0.1:7788` 及 `ws://localhost:3000/ws`

### 2.2 1 键注入 Claude Code 真实钩子
无需手动编写配置文件：
1. 打开 `http://localhost:3000`。
2. 点击底部 CLI 栏左侧的 **【⚡ 注入 Claude 钩子】** 按钮。
3. 系统将自动在当前工程创建 `.claude/settings.json`：
```json
{
  "hooks": {
    "PreToolUse": "curl -s -X POST http://localhost:7788/hook/pre -H 'Content-Type: application/json' -d @-",
    "PostToolUse": "curl -s -X POST http://localhost:7788/hook/post -H 'Content-Type: application/json' -d @-"
  },
  "security": {
    "gatekeeperEnabled": true,
    "gatekeeperPort": 7788,
    "dashboardUrl": "http://localhost:3000"
  }
}
```
4. 现在直接在终端启动 Claude Code：
```bash
claude
```
Claude Code 执行的每一个工具调用（如 `FileEdit`, `Bash` 等）均会自动流入控制平面。一旦触碰核心资产（如 `auth.ts`, `prod-secrets.yaml` 等），命令立即在本地被挂起，等待你在 Web 控制台点击 **【批准放行】**、**【拒绝回滚】** 或 **【注入修正指令】**！

---

## 3. 在控制台执行真实终端指令

在控制平面底部的交互式命令行输入框中，支持直接执行真实主机命令：
- `git status`: 查询当前工作区真实未提交变更与文件状态
- `git branch`: 查看当前 Git 分支
- `git log -3`: 查看最近 3 次本地真实提交
- `ls -la`: 列出当前工作区文件
- `node -v` / `npm test`: 运行真实测试套件

命令将在本地实时执行，并将 stdout/stderr 结果高亮流式打印在赛博朋克控制台中。

---

## 4. 真实链路一键验证 (无需先开 Claude)

点击底部 CLI 栏的 **【🧪 真实 Hook 测试】** 按钮：
- **常规操作测试 (`git status`)**：调用真实 `/hook/pre` 接口，控制平面实时接收并放行。
- **高危操作测试 (`auth.ts`)**：调用真实 `/hook/pre` 接口，自动触发安全热熔断与人工审批抽屉，验证阻断与放行链路。
