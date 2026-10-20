#!/usr/bin/env bash
# ==============================================================================
# AGENT MATRIX · 一键安装与配置脚本 (One-Click Setup Script)
# 支持 Linux / macOS / WSL
# ==============================================================================

set -e

echo -e "\033[1;36m"
cat << "EOF"
   ___   _____  _______  ________   __  ______ _____ ___  _______  __
  / _ | / ___/ / __/ _ \/_  __/ /  /  |/  / _ /_  __/ _ \/  _/ _ \/_/
 / __ |/ (_ / / _// // / / / / /__/ /|_/ / __ |/ / / , _// // // /__ 
/_/ |_|\___/ /___/____/ /_/ /____/_/  /_/_/ |_/_/ /_/|_/___/____/_/ 
EOF
echo -e "\033[0m"
echo -e "\033[1;33m>>> 正在安装 AGENT MATRIX · 生产级智能体控制平面与安全网关...\033[0m"

# 1. 检查 Node.js 环境
if ! command -v node &> /dev/null; then
    echo -e "\033[1;31m[错误]\033[0m 未检测到 Node.js，请先安装 Node.js (推荐 v18+ 或 v20+): https://nodejs.org/"
    exit 1
fi

echo -e "\033[1;32m[✓]\033[0m 检测到 Node.js 版本: $(node -v)"

# 检查 pnpm 环境，若未安装则尝试自动安装
if ! command -v pnpm &> /dev/null; then
    echo -e "\033[1;33m[提示]\033[0m 未检测到 pnpm，正在通过 npm 自动安装 pnpm..."
    npm install -g pnpm || {
        echo -e "\033[1;31m[错误]\033[0m 自动安装 pnpm 失败，请手动运行 'npm install -g pnpm' 后重试。"
        exit 1
    }
fi
echo -e "\033[1;32m[✓]\033[0m 检测到 pnpm 版本: $(pnpm -v)"

# 2. 清理历史锁文件残留并安装主依赖
echo -e "\n\033[1;34m[1/3] 正在清理历史锁文件残留并安装主依赖 (pnpm install)...\033[0m"
rm -rf package-lock.json
pnpm install

# 3. 安全合并 Claude Code 运行时观测 Hook
echo -e "\n\033[1;34m[2/3] 正在配置 Claude Code 安全审计钩子 (.claude/settings.json)...\033[0m"
node --import tsx scripts/configure-claude-runtime.mjs
echo -e "\033[1;32m[✓]\033[0m Claude Code runtime Hook 已安全合并到 .claude/settings.json！"

# 4. 赋予脚本执行权限
chmod +x codex-wrapper.sh 2>/dev/null || true

echo -e "\n\033[1;32m====================================================================\033[0m"
echo -e "\033[1;32m🎉 AGENT MATRIX 安装已全部就绪！(Zero-Python 零外部依赖)\033[0m"
echo -e "\033[1;32m====================================================================\033[0m"
echo -e ""
echo -e "👉 \033[1;37m启动控制看板与安全网关：\033[0m"
echo -e "   \033[1;36mpnpm dev\033[0m"
echo -e ""
echo -e "👉 \033[1;37m浏览器访问：\033[0m"
echo -e "   \033[1;35mhttp://localhost:3000\033[0m"
echo -e ""
echo -e "👉 \033[1;37m在 VS Code / Cursor 中作为原生插件运行：\033[0m"
echo -e "   cd vscode-extension && pnpm install，按 F5 启动即可！"
echo -e ""
