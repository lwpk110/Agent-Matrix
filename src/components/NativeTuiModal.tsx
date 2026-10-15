import React, { useState } from 'react';
import { Language, translations } from '../i18n/translations';
import { X, Copy, Download, Check, Terminal, FileCode } from 'lucide-react';

interface NativeTuiModalProps {
  isOpen: boolean;
  language: Language;
  onClose: () => void;
}

const MATRIX_PY_CODE = `#!/usr/bin/env python3
"""
AGENT MATRIX · NEURAL TREE - Native Terminal TUI
A real-time cyberpunk terminal HUD dashboard for monitoring Claude Code
(Opus/Sonnet/Haiku) & OpenAI Codex (o3-pro/codex-1/codex-mini) multi-agent trees.

Run directly in Linux/macOS zsh/bash:
    pip install rich textual
    python3 cli/agent_matrix.py
"""
import sys, time, random
from datetime import datetime
from rich.console import Console
from rich.layout import Layout
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich.live import Live

console = Console()

def make_header(mode="claude", alert=False):
    grid = Table.grid(expand=True)
    grid.add_column(justify="left", ratio=1)
    grid.add_column(justify="right", ratio=1)
    title = Text()
    title.append(" ⚡ AGENT MATRIX ", style="bold black on bright_cyan")
    title.append(" · NEURAL TREE ", style="bold bright_white on grey11")
    title.append(f" [MODE: {mode.upper()}] ", style="bold yellow on grey15")
    if alert:
        title.append(" ⚠ HIGH RISK ALERT ACTIVE ", style="bold white on red blink")
    grid.add_row(title, Text("STATUS: ACTIVE | CLOCK: " + datetime.now().strftime("%H:%M:%S"), style="dim cyan"))
    return Panel(grid, style="cyan")

# Run in fullscreen terminal:
# python3 cli/agent_matrix.py
`;

const HOOK_PY_CODE = `#!/usr/bin/env python3
"""
AGENT MATRIX · EVENT EMITTER HOOK
Claude Code and Codex hook script that emits structured telemetry events
into the Agent Matrix neural tree HUD via JSON-RPC / WebSocket / stdout.

Usage:
    python3 hooks/emit_event.py --event tool_call --agent sonnet --tool Bash --cmd "git status"
    python3 hooks/emit_event.py --event risk_alert --agent opus --severity critical --reason "OAuth Exfiltration"
"""
import sys, json, argparse
from datetime import datetime

parser = argparse.ArgumentParser()
parser.add_argument("--event", default="tool_call")
parser.add_argument("--agent", default="sonnet")
parser.add_argument("--tool", default="Bash")
parser.add_argument("--cmd", default="")
parser.add_argument("--severity", default="low")
args = parser.parse_args()

payload = {
    "timestamp": datetime.now().isoformat(),
    "event_type": args.event,
    "agent": args.agent,
    "tool": args.tool,
    "cmd": args.cmd,
    "severity": args.severity
}
print(json.dumps(payload, indent=2))
`;

export const NativeTuiModal: React.FC<NativeTuiModalProps> = ({ isOpen, language, onClose }) => {
  const t = translations[language];
  const [activeTab, setActiveTab] = useState<'matrix' | 'hook'>('matrix');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentCode = activeTab === 'matrix' ? MATRIX_PY_CODE : HOOK_PY_CODE;
  const currentFileName = activeTab === 'matrix' ? 'agent_matrix.py' : 'emit_event.py';

  const handleCopy = () => {
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([currentCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-mono">
      <div className="relative w-full max-w-3xl bg-[#07090e] border border-teal-500/50 rounded-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#0a0e18] border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-teal-400" />
            <span className="text-xs font-bold text-slate-100 uppercase tracking-wide">
              {t.modalTitle}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab selector and Action bar */}
        <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-[#05070c] border-b border-slate-800 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('matrix')}
              className={`px-3 py-1 rounded transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'matrix'
                  ? 'bg-teal-950 text-teal-300 font-bold border border-teal-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5 text-teal-400" />
              cli/agent_matrix.py
            </button>
            <button
              onClick={() => setActiveTab('hook')}
              className={`px-3 py-1 rounded transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'hook'
                  ? 'bg-teal-950 text-teal-300 font-bold border border-teal-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5 text-cyan-400" />
              hooks/emit_event.py
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition text-xs flex items-center gap-1 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? t.btnCopied : t.btnCopy}</span>
            </button>
            <button
              onClick={handleDownload}
              className="px-2.5 py-1 rounded bg-teal-900 hover:bg-teal-800 text-teal-200 font-semibold transition text-xs flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t.btnDownload}</span>
            </button>
          </div>
        </div>

        {/* Instructions banner */}
        <div className="bg-[#0b101d] px-4 py-2 border-b border-slate-800 text-[11px] text-teal-300 flex items-center justify-between">
          <span>{t.modalRunLocally} <code className="bg-black/50 px-1 py-0.5 rounded text-amber-300">python3 cli/agent_matrix.py</code></span>
          <span className="text-slate-400 text-[10px]">{t.modalDesc}</span>
        </div>

        {/* Code Content */}
        <div className="flex-1 p-4 overflow-y-auto bg-[#030407] text-[11px] leading-relaxed text-slate-300 select-text">
          <pre className="font-mono whitespace-pre">{currentCode}</pre>
        </div>
      </div>
    </div>
  );
};
