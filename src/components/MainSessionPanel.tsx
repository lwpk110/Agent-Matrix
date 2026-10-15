import React from 'react';
import { MatrixMode } from '../types/matrix';
import { Language, translations } from '../i18n/translations';
import { Terminal, GitBranch, Code2, Layers, CheckSquare, Sparkles, AlertOctagon } from 'lucide-react';

interface MainSessionPanelProps {
  mode: MatrixMode;
  language: Language;
  step: number;
  totalSteps: number;
  tokensUsed: number;
  maxTokens: number;
  activeFile: string;
  activeDiff: {
    oldCode: string;
    newCode: string;
  };
  goal: string;
  branch?: string;
  sessionTag?: string;
  isBlocked?: boolean;
}

export const MainSessionPanel: React.FC<MainSessionPanelProps> = ({
  mode,
  language,
  step,
  totalSteps,
  tokensUsed,
  maxTokens,
  activeFile,
  activeDiff,
  goal,
  branch = 'feat/neural-auth',
  sessionTag,
  isBlocked = false,
}) => {
  const t = translations[language];
  const isZh = language === 'zh';
  const modelName = mode === 'codex' ? 'Codex-1 Architecture Lead' : 'Claude 3.7 Sonnet Main Session';
  const tokenPct = Math.round((tokensUsed / maxTokens) * 100);

  return (
    <div
      className={`relative flex flex-col bg-[#07090e]/95 backdrop-blur rounded-lg p-4 border border-dashed transition-all duration-300 ${
        isBlocked
          ? 'border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.3)]'
          : 'border-[#fb923c] shadow-[0_0_15px_rgba(251,146,60,0.18)]'
      }`}
    >
      {/* Header with pill tag [plan] */}
      <div className="flex flex-wrap items-center justify-between border-b border-amber-900/40 pb-2 mb-3 gap-2">
        <div className="flex items-center gap-2">
          <span className="p-1 rounded bg-amber-950/80 text-amber-300 border border-amber-700/60">
            <Terminal className="w-4 h-4 text-amber-400" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                {modelName}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-600/40">
                {t.badgePlan}
              </span>
              {sessionTag && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-teal-300 border border-teal-800">
                  {sessionTag}
                </span>
              )}
            </div>
            <div className="text-[10px] font-mono text-amber-400/60 flex items-center gap-2">
              <span className="flex items-center gap-1">
                <GitBranch className="w-3 h-3 text-amber-500" /> {branch}
              </span>
              <span>·</span>
              <span>PID: 88412</span>
            </div>
          </div>
        </div>

        {/* Step counter & token gauge */}
        <div className="flex items-center gap-3">
          {isBlocked && (
            <div className="bg-rose-950/80 px-2 py-0.5 rounded border border-rose-500 text-rose-300 text-[10px] font-mono font-bold flex items-center gap-1 animate-pulse">
              <AlertOctagon className="w-3 h-3 text-rose-400" />
              <span>{isZh ? '操作已被热熔断挂起' : 'EXECUTION SUSPENDED'}</span>
            </div>
          )}

          <div className="bg-[#0b0e14] px-2.5 py-1 rounded border border-amber-900/40 text-[10px] font-mono">
            <span className="text-slate-400">{t.planExecution}</span>{' '}
            <span className="text-amber-400 font-bold">
              {String(step).padStart(2, '0')}/{String(totalSteps).padStart(2, '0')}
            </span>
          </div>

          <div className="bg-[#0b0e14] px-2.5 py-1 rounded border border-amber-900/40 text-[10px] font-mono">
            <span className="text-slate-400">{t.contextTokens}</span>{' '}
            <span className={tokenPct > 90 ? 'text-amber-300 font-bold' : 'text-emerald-400 font-bold'}>
              {(tokensUsed / 1000).toFixed(1)}k / {(maxTokens / 1000).toFixed(0)}k ({tokenPct}%)
            </span>
          </div>
        </div>
      </div>

      {/* Primary goal & prompt */}
      <div className="mb-3 bg-[#0a0d14] p-2.5 rounded border border-amber-950/60 font-mono">
        <div className="text-[10px] text-amber-400/80 uppercase tracking-wider mb-1 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-400" />
          {t.activeDirective}
        </div>
        <p className="text-xs text-slate-200 font-medium leading-relaxed">
          {goal}
        </p>
      </div>

      {/* Split: Live AST File Diff + Active Subagent Orchestration Plan */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[11px]">
        {/* Active file diff */}
        <div className="bg-[#050608] border border-amber-950/50 rounded p-2 overflow-hidden">
          <div className="flex justify-between items-center text-[10px] text-amber-400/90 border-b border-slate-800 pb-1 mb-1.5">
            <span className="flex items-center gap-1">
              <Code2 className="w-3 h-3 text-amber-400" />
              {activeFile}
            </span>
            <span className="text-[9px] text-slate-500">{t.synthesizingDiff}</span>
          </div>
          <div className="space-y-0.5 text-[10px] font-mono bg-black/40 p-1.5 rounded overflow-x-auto">
            <div className="text-slate-500">@@ -41,7 +41,9 @@</div>
            {activeDiff.oldCode.split('\n').map((line, idx) => (
              <div key={'old-' + idx} className="text-rose-400/90 bg-rose-950/20 px-1 rounded-sm line-through">
                - {line}
              </div>
            ))}
            {activeDiff.newCode.split('\n').map((line, idx) => (
              <div key={'new-' + idx} className="text-emerald-400 bg-emerald-950/20 px-1 rounded-sm font-semibold">
                + {line}
              </div>
            ))}
          </div>
        </div>

        {/* Execution Pipeline Steps */}
        <div className="bg-[#050608] border border-amber-950/50 rounded p-2">
          <div className="text-[10px] text-amber-400/90 border-b border-slate-800 pb-1 mb-1.5 flex items-center gap-1">
            <Layers className="w-3 h-3 text-amber-400" />
            {t.activePlanHierarchy}
          </div>
          <div className="space-y-1 text-[10px]">
            {t.planSteps.map((stepDesc, idx) => {
              const isDone = idx < 2;
              const isCurrent = idx === 2;
              return (
                <div
                  key={idx}
                  className={`flex items-center gap-1.5 ${
                    isDone
                      ? 'text-emerald-400'
                      : isCurrent
                      ? isBlocked
                        ? 'text-rose-300 font-bold bg-rose-950/40 px-1 py-0.5 rounded'
                        : 'text-amber-300 font-bold bg-amber-950/30 px-1 py-0.5 rounded'
                      : 'text-slate-500'
                  }`}
                >
                  {isDone ? (
                    <CheckSquare className="w-3 h-3 text-emerald-400 shrink-0" />
                  ) : isCurrent ? (
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        isBlocked ? 'bg-rose-400 animate-ping' : 'bg-amber-400 animate-ping'
                      } shrink-0`}
                    />
                  ) : (
                    <span className="w-3 h-3 rounded border border-slate-700 inline-block shrink-0" />
                  )}
                  <span className="truncate">{stepDesc}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
