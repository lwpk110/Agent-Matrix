import React from 'react';
import { SubagentTask, MatrixMode } from '../types/matrix';
import { Language, translations } from '../i18n/translations';
import { Oscilloscope } from './Oscilloscope';
import { Network, FileCode2, BookOpen, CheckCircle, Play, RotateCcw } from 'lucide-react';

interface SubagentsDispatcherPanelProps {
  mode: MatrixMode;
  language: Language;
  subagents: SubagentTask[];
  onTriggerWorker: (id: string) => void;
  onRestartAll: () => void;
}

export const SubagentsDispatcherPanel: React.FC<SubagentsDispatcherPanelProps> = ({
  mode,
  language,
  subagents,
  onTriggerWorker,
  onRestartAll,
}) => {
  const t = translations[language];
  const dispatcherTitle =
    mode === 'codex'
      ? (language === 'zh' ? 'Codex-Mini 并行三联体' : 'Codex-Mini Parallel Triad')
      : t.dispatcherTitle;
  const subagentModel = mode === 'codex' ? 'codex-mini' : 'Claude 3.5 Haiku';

  const getSubagentTitle = (type: string, fallback: string) => {
    if (language === 'zh') {
      if (type === 'worker') return t.worker01Title;
      if (type === 'explorer') return t.explorer02Title;
      if (type === 'researcher') return t.researcher03Title;
    }
    return fallback;
  };

  const getSubagentPayload = (type: string, fallback: string) => {
    if (language === 'zh') {
      if (type === 'worker') return t.worker01Payload;
      if (type === 'explorer') return t.explorer02Payload;
      if (type === 'researcher') return t.researcher03Payload;
    }
    return fallback;
  };

  return (
    <div className="relative flex flex-col bg-[#07090e]/95 backdrop-blur rounded-lg p-3.5 border border-dashed border-[#10b981] shadow-[0_0_15px_rgba(16,185,129,0.18)]">
      {/* Header with oscilloscope & pill tag */}
      <div className="flex flex-wrap items-center justify-between border-b border-emerald-900/40 pb-2 mb-3 gap-2">
        <div className="flex items-center gap-2">
          <span className="p-1 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-700/60">
            <Network className="w-4 h-4 text-emerald-400" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                {dispatcherTitle}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-600/40">
                3x parallel
              </span>
            </div>
            <div className="text-[10px] font-mono text-emerald-400/60">
              CLUSTER: {subagentModel} · {t.dispatcherSubtitle}
            </div>
          </div>
        </div>

        {/* Oscilloscope inside the Header */}
        <div className="flex items-center gap-2">
          <Oscilloscope active={true} intensity={1.1} color="#10b981" />
          <button
            onClick={onRestartAll}
            className="p-1 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-400 border border-emerald-800 transition cursor-pointer"
            title={t.btnRestartAll}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 3 Parallel Subagents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 font-mono">
        {subagents.map((agent) => {
          const isWorker = agent.type === 'worker';
          const isExplorer = agent.type === 'explorer';
          const isResearcher = agent.type === 'researcher';

          return (
            <div
              key={agent.id}
              className="bg-[#080c12] p-2.5 rounded border border-emerald-950/70 hover:border-emerald-800/80 transition flex flex-col justify-between"
            >
              <div>
                {/* Agent Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
                  <div className="flex items-center gap-1.5">
                    {isWorker && <FileCode2 className="w-3.5 h-3.5 text-emerald-400" />}
                    {isExplorer && <BookOpen className="w-3.5 h-3.5 text-cyan-400" />}
                    {isResearcher && <CheckCircle className="w-3.5 h-3.5 text-teal-400" />}
                    <span className="text-xs font-bold text-slate-200">
                      {getSubagentTitle(agent.type, agent.name)}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/50">
                    {isWorker ? t.badgeAst : isExplorer ? t.badgeDocs : t.badgeTests}
                  </span>
                </div>

                {/* Current Task Payload */}
                <p className="text-[10.5px] text-slate-300 leading-snug mb-2 line-clamp-2">
                  {getSubagentPayload(agent.type, agent.currentPayload)}
                </p>
              </div>

              <div>
                {/* Progress bar */}
                <div className="mb-2">
                  <div className="flex justify-between text-[9px] text-slate-400 mb-0.5">
                    <span>{t.progress}</span>
                    <span className="text-emerald-400 font-bold">{agent.progress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 shadow-[0_0_6px_#10b981] transition-all duration-300"
                      style={{ width: `${agent.progress}%` }}
                    />
                  </div>
                </div>

                {/* Subagent Mini Footer & Trigger button */}
                <div className="flex items-center justify-between text-[9.5px] text-slate-500 pt-1 border-t border-slate-800/80">
                  <span className="flex items-center gap-1 text-emerald-400/90 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {agent.itemsProcessed}/{agent.totalItems} {t.itemsProcessed}
                  </span>

                  <button
                    onClick={() => onTriggerWorker(agent.id)}
                    className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 rounded border border-emerald-800 transition cursor-pointer text-[9px]"
                  >
                    <Play className="w-2.5 h-2.5" /> {t.btnTick}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
