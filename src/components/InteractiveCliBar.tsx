import React, { useState } from 'react';
import { MatrixMode } from '../types/matrix';
import { Language, translations } from '../i18n/translations';
import { Terminal, Send, Zap, ShieldAlert, Cpu, RefreshCw, FileText, ChevronDown, CheckCircle2, RotateCcw } from 'lucide-react';

interface InteractiveCliBarProps {
  mode: MatrixMode;
  language: Language;
  isBlocked?: boolean;
  onApproveHitl?: () => void;
  onRollbackHitl?: () => void;
  onToggleMode: () => void;
  onInjectToolCall: (toolType?: string) => void;
  onTriggerAlert: () => void;
  onRestartSubagents: () => void;
  onClearLogs: () => void;
  onOpenTuiModal: () => void;
  onExecuteCustomCommand: (cmd: string) => void;
}

export const InteractiveCliBar: React.FC<InteractiveCliBarProps> = ({
  mode,
  language,
  isBlocked = false,
  onApproveHitl,
  onRollbackHitl,
  onToggleMode,
  onInjectToolCall,
  onTriggerAlert,
  onRestartSubagents,
  onClearLogs,
  onOpenTuiModal,
  onExecuteCustomCommand,
}) => {
  const t = translations[language];
  const isZh = language === 'zh';
  const [commandInput, setCommandInput] = useState('');
  const [showToolDropdown, setShowToolDropdown] = useState(false);

  const cliPrompt =
    mode === 'codex'
      ? '~/agent-tree $ codex --advisor o3-pro --subagents mini'
      : '~/agent-tree $ claude --advisor opus --subagents haiku';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim()) return;
    onExecuteCustomCommand(commandInput.trim());
    setCommandInput('');
  };

  const toolOptions = [
    { label: t.toolBash, type: 'bash' },
    { label: t.toolFileEdit, type: 'file_edit' },
    { label: t.toolGrep, type: 'grep' },
    { label: t.toolAst, type: 'ast' },
  ];

  return (
    <div className="bg-[#080b12] border-t border-b border-slate-800 p-2.5 font-mono">
      {/* Top action button toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {/* Inject Tool Call button with dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowToolDropdown(!showToolDropdown)}
              className="px-2.5 py-1 rounded bg-amber-950/70 hover:bg-amber-900/80 text-amber-300 border border-amber-700/60 transition flex items-center gap-1 cursor-pointer font-bold shadow-sm"
              title="Inject a simulated tool call into the agent session"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>{t.injectToolCall}</span>
              <ChevronDown className="w-3 h-3 text-amber-400/80" />
            </button>

            {showToolDropdown && (
              <div className="absolute left-0 bottom-full mb-1 w-64 bg-[#0a0e18] border border-amber-600/50 rounded shadow-2xl py-1 z-50">
                <div className="px-2 py-1 text-[9px] text-amber-400/80 uppercase font-semibold border-b border-slate-800">
                  {isZh ? '选择待注入的工具调用' : 'Select Tool To Inject'}
                </div>
                {toolOptions.map((opt) => (
                  <button
                    key={opt.type}
                    onClick={() => {
                      onInjectToolCall(opt.type);
                      setShowToolDropdown(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-[10px] text-slate-200 hover:bg-amber-950/60 hover:text-amber-300 transition flex items-center justify-between cursor-pointer"
                  >
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick HITL Approve/Rollback Buttons when Blocked */}
          {isBlocked && (
            <>
              <button
                onClick={onApproveHitl}
                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center gap-1 cursor-pointer shadow-md shadow-emerald-950 animate-bounce"
                title={isZh ? '立即批准放行当前挂起的工具调用' : 'Approve and unblock tool execution'}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isZh ? '批准 (Approve)' : 'Approve'}</span>
              </button>
              <button
                onClick={onRollbackHitl}
                className="px-2.5 py-1 rounded bg-rose-700 hover:bg-rose-600 text-white font-bold transition flex items-center gap-1 cursor-pointer shadow-md shadow-rose-950"
                title={isZh ? '立即回滚当前操作' : 'Rollback current operation'}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isZh ? '回滚 (Rollback)' : 'Rollback'}</span>
              </button>
            </>
          )}

          {/* Toggle Dual Mode (Claude vs Codex) */}
          <button
            onClick={onToggleMode}
            className="px-2.5 py-1 rounded bg-teal-950/70 hover:bg-teal-900/80 text-teal-300 border border-teal-700/60 transition flex items-center gap-1 cursor-pointer font-bold shadow-sm"
            title="Toggle between Claude Code stack and OpenAI Codex stack"
          >
            <Cpu className="w-3.5 h-3.5 text-teal-400" />
            <span>
              {t.toggleMode} {mode === 'codex' ? 'OpenAI Codex' : 'Claude Code'}
            </span>
          </button>

          {/* Trigger OAuth High Risk Alert */}
          <button
            onClick={onTriggerAlert}
            className="px-2.5 py-1 rounded bg-rose-950/70 hover:bg-rose-900/80 text-rose-300 border border-rose-700/80 transition flex items-center gap-1 cursor-pointer font-bold shadow-sm"
            title="Simulate token exfiltration hazard to wake Opus advisor panel"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>{t.triggerOAuthAlert}</span>
          </button>

          {/* Restart Subagents Fleet */}
          <button
            onClick={onRestartSubagents}
            className="px-2.5 py-1 rounded bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-700/60 transition flex items-center gap-1 cursor-pointer shadow-sm"
            title="Restart the 3 parallel subagents"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t.dispatchFleet}</span>
          </button>
        </div>

        {/* View/Download Native Python TUI */}
        <div className="flex items-center gap-1.5 text-[11px]">
          <button
            onClick={onOpenTuiModal}
            className="px-2.5 py-1 rounded bg-purple-950/70 hover:bg-purple-900/80 text-purple-300 border border-purple-700/60 transition flex items-center gap-1 cursor-pointer font-semibold shadow-sm"
            title="View native terminal TUI script (cli/agent_matrix.py)"
          >
            <FileText className="w-3.5 h-3.5 text-purple-400" />
            <span>{t.tuiScriptBtn}</span>
          </button>
        </div>
      </div>

      {/* Interactive Command Line Prompt Form */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 bg-[#040508] p-2 rounded border border-slate-800">
        <span className="text-teal-400 select-none flex items-center gap-1 text-xs font-bold whitespace-nowrap">
          <Terminal className="w-3.5 h-3.5 text-teal-400 shrink-0" />
          <span>{cliPrompt}</span>
        </span>

        <input
          type="text"
          value={commandInput}
          onChange={(e) => setCommandInput(e.target.value)}
          placeholder={
            isZh
              ? "输入命令: 'approve', 'rollback', 'inject bash', 'session 2', 'mode codex', 'alert'..."
              : "type 'approve', 'rollback', 'inject bash', 'session 2', 'mode codex', 'alert'..."
          }
          className="flex-1 bg-transparent border-none outline-none text-slate-200 placeholder:text-slate-600 text-xs font-mono"
        />

        <button
          type="submit"
          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-teal-900 text-slate-300 hover:text-teal-200 transition text-[10px] flex items-center gap-1 cursor-pointer font-bold"
        >
          <Send className="w-3 h-3" />
          <span>{t.btnRun}</span>
        </button>
      </form>
    </div>
  );
};
