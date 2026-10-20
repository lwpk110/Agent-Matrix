import React, { useState } from 'react';
import { Language } from '../i18n/translations';
import { X, Copy, Download, Check, Terminal, FileCode, Zap, Layers, Sparkles, CheckCircle2 } from 'lucide-react';

interface LocalAgentModalProps {
  isOpen: boolean;
  language: Language;
  onClose: () => void;
}

const VSCODE_EXTENSION_GUIDE = `# VS Code / Cursor 原生插件接入指南 (Zero-Python 纯原生体验)
================================================================================
本插件专为 VS Code 与 Cursor 设计，完全运行在 IDE 的 Node.js 运行时中。
无需安装 Python、无需 pip install、无需手动启动独立终端进程！

1. 插件特性：
   • 随编辑器启动自动在后台拉起 7788 端口安全网关与 WebSocket 遥测服务。
   • 状态栏常驻实时状态徽章：[$(shield) ⚡ Agent Matrix: Online [7788]]。
   • 智能感知工作区：首次打开自动检测并一键注入 .claude/settings.json 钩子。
   • 命中高危操作（如修改 auth.ts 或生产配置）时，IDE 弹出原生悬浮通知，
     支持直接在编辑器内快捷键（Cmd+Alt+Y / Cmd+Alt+N）完成【批准】或【回滚】。
   • 快捷键 Cmd+Alt+M 一键在侧边标签页中分屏打开暗黑赛博朋克控制平面 Webview。

2. 本地直接加载运行方法 (F5 调试或打包为 .vsix)：
   cd vscode-extension
   npm install
   # 在 VS Code 中按 F5 启动 Extension Development Host 即可立即体验！
`;

const QUICK_ONE_LINER_SH = `npm run configure:claude-runtime`;

const EMBEDDED_NODE_GATEWAY_TS = `/**
 * 免 Python 纯 TypeScript 内嵌网关 (server.ts)
 * 随 npm run dev 或 npm start 一并启动，同生共存，零额外进程！
 */
import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(express.json());

// PreToolUse 拦截接口
app.post('/hook/pre', (req, res) => {
  const { tool, args } = req.body || {};
  const isSensitive = ['auth.ts', 'prod-secrets.yaml', 'schema.prisma'].some(
    p => JSON.stringify(args).includes(p)
  );
  
  if (isSensitive) {
    // 广播阻断消息至 Web 控制平面并挂起等待审批 (120s 超时)
    return handleHitlBlock(tool, args, res);
  }
  
  res.json({ status: 'proceed' });
});

// PostToolUse 遥测接口
app.post('/hook/post', (req, res) => {
  broadcastTelemetry(req.body);
  res.json({ status: 'ok' });
});

server.listen(7788, '127.0.0.1', () => {
  console.log('⚡ Agent Security Gateway listening on http://127.0.0.1:7788');
});
`;

export const LocalAgentModal: React.FC<LocalAgentModalProps> = ({ isOpen, language, onClose }) => {
  const [activeTab, setActiveTab] = useState<'extension' | 'oneliner' | 'nodegateway'>('extension');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const isZh = language === 'zh';

  const snippets = {
    extension: {
      filename: 'vscode-extension/README.md',
      code: VSCODE_EXTENSION_GUIDE,
      desc: isZh
        ? 'VS Code / Cursor 原生插件工程（位于本仓库 vscode-extension/），内嵌 Node.js 运行时，免 Python 环境！'
        : 'Native VS Code / Cursor extension package with embedded Node.js gateway. Zero Python required!',
    },
    oneliner: {
      filename: 'setup-claude-hooks.sh',
      code: QUICK_ONE_LINER_SH,
      desc: isZh
        ? '运行仓库脚本，将观测 Hook 合并到现有配置并保留原设置。'
        : 'Run the repository script to merge runtime hooks while preserving existing settings.',
    },
    nodegateway: {
      filename: 'server.ts',
      code: EMBEDDED_NODE_GATEWAY_TS,
      desc: isZh
        ? '项目内置的纯 TypeScript/Express 统一网关，执行 npm run dev 即自动同时拉起 Web HUD 与 7788 安全端口。'
        : 'Built-in TypeScript/Express server powering both the Web HUD and 7788 security gateway in one command.',
    },
  };

  const current = snippets[activeTab];

  const handleCopy = () => {
    navigator.clipboard.writeText(current.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([current.code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = current.filename.split('/').pop() || 'config';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 font-mono">
      <div className="relative w-full max-w-4xl bg-[#07090e] border border-teal-500/70 rounded-xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#0a0f1d] border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded bg-teal-950 text-teal-300 border border-teal-600/60">
              <Zap className="w-4 h-4 text-teal-400" />
            </span>
            <div>
              <div className="text-sm font-extrabold text-white tracking-wide flex items-center gap-2">
                <span>
                  {isZh
                    ? '⚡ 原生 IDE 插件与免 Python 一键接入'
                    : '⚡ Native IDE Extension & Zero-Python Integration'}
                </span>
                <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-700/60 px-1.5 py-0.2 rounded font-bold">
                  ZERO-PYTHON
                </span>
              </div>
              <div className="text-[10.5px] text-slate-400 font-mono">
                {isZh
                  ? '集成 VS Code / Cursor 插件直接自启，或通过内置 Node.js 网关一键运行，无需安装 Python 环境'
                  : 'Embedded Node.js gateway inside VS Code extension or web server. Zero external processes needed.'}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex flex-wrap items-center justify-between px-5 py-2.5 bg-[#05070c] border-b border-slate-800 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('extension')}
              className={`px-3 py-1.5 rounded transition cursor-pointer flex items-center gap-1.5 font-bold ${
                activeTab === 'extension'
                  ? 'bg-teal-950 text-teal-300 border border-teal-600'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-teal-400" />
              1. VS Code / Cursor 插件 (一键自动拉起)
            </button>
            <button
              onClick={() => setActiveTab('oneliner')}
              className={`px-3 py-1.5 rounded transition cursor-pointer flex items-center gap-1.5 font-bold ${
                activeTab === 'oneliner'
                  ? 'bg-teal-950 text-teal-300 border border-teal-600'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-amber-400" />
              2. 1 行命令配置 Claude Code
            </button>
            <button
              onClick={() => setActiveTab('nodegateway')}
              className={`px-3 py-1.5 rounded transition cursor-pointer flex items-center gap-1.5 font-bold ${
                activeTab === 'nodegateway'
                  ? 'bg-teal-950 text-teal-300 border border-teal-600'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5 text-purple-400" />
              3. 内嵌 Node.js 网关 (server.ts)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition text-xs flex items-center gap-1 cursor-pointer font-semibold"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? (isZh ? '已复制' : 'Copied') : isZh ? '复制代码' : 'Copy'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 rounded bg-teal-900 hover:bg-teal-800 text-teal-200 font-bold transition text-xs flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isZh ? '下载文件' : 'Download'}</span>
            </button>
          </div>
        </div>

        {/* Description Banner */}
        <div className="bg-[#0b1222] px-5 py-2.5 border-b border-slate-800 text-xs text-teal-300 flex items-center justify-between">
          <span>{current.desc}</span>
          <span className="text-slate-400 text-[10.5px]">
            {isZh ? '零环境依赖 · 开箱即用' : 'Zero dependencies · Out-of-the-box'}
          </span>
        </div>

        {/* Code Content Viewport */}
        <div className="flex-1 p-5 overflow-y-auto bg-[#030407] text-[11px] leading-relaxed text-slate-300 select-text">
          <pre className="font-mono whitespace-pre">{current.code}</pre>
        </div>

        {/* Footer command prompt */}
        <div className="bg-[#05070c] px-5 py-3 border-t border-slate-800 text-[11px] flex flex-wrap items-center justify-between gap-2 text-slate-400">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-bold">✔</span>
            <span className="text-slate-300 font-semibold">
              {isZh
                ? '提示：在 VS Code / Cursor 中打开本仓库，或直接运行 npm run dev 即可一并启动网关与看板！'
                : 'Tip: Open in VS Code/Cursor or run npm run dev to start both gateway and HUD in 1 step!'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition cursor-pointer"
          >
            {isZh ? '关闭' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
