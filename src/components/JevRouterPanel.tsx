import React from 'react';
import { JevMetrics } from '../types/matrix';
import { Language, translations } from '../i18n/translations';
import { GitFork, Zap, RefreshCw } from 'lucide-react';

interface JevRouterPanelProps {
  metrics: JevMetrics;
  language: Language;
  onRecalculate: () => void;
  onForceSubagents: () => void;
  onForceInline: () => void;
}

export const JevRouterPanel: React.FC<JevRouterPanelProps> = ({
  metrics,
  language,
  onRecalculate,
  onForceSubagents,
  onForceInline,
}) => {
  const t = translations[language];
  const pInlinePercent = Math.round(metrics.pInline * 100);
  const pSubagentsPercent = Math.round(metrics.pSubagents * 100);
  const pEscalatePercent = Math.round(metrics.pEscalate * 100);

  return (
    <div className="relative flex flex-col bg-[#07090e]/95 backdrop-blur rounded-lg p-3.5 border border-dashed border-[#2dd4bf] shadow-[0_0_15px_rgba(45,212,191,0.18)]">
      {/* Header with pill tag [route] */}
      <div className="flex flex-wrap items-center justify-between border-b border-teal-900/40 pb-2 mb-3 gap-2">
        <div className="flex items-center gap-2">
          <span className="p-1 rounded bg-teal-950/80 text-teal-300 border border-teal-700/60">
            <GitFork className="w-4 h-4 text-teal-400" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-300">
                {t.routerTitle}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-600/40">
                {t.badgeRoute}
              </span>
            </div>
            <div className="text-[10px] font-mono text-teal-400/60">
              {t.routerSubtitle}
            </div>
          </div>
        </div>

        {/* Telemetry chips */}
        <div className="flex items-center gap-2 font-mono text-[10px]">
          <div className="bg-[#090d14] px-2 py-0.5 rounded border border-teal-900/50 text-teal-300">
            {t.entropy} <span className="font-bold">{metrics.entropy.toFixed(3)} bit</span>
          </div>
          <div className="bg-[#090d14] px-2 py-0.5 rounded border border-teal-900/50 text-teal-300">
            {t.monteCarlo} <span className="font-bold">{metrics.monteCarloSamples.toLocaleString()} runs</span>
          </div>
          <button
            onClick={onRecalculate}
            className="p-1 rounded bg-teal-950 hover:bg-teal-900 text-teal-400 border border-teal-800 transition cursor-pointer"
            title={t.btnRecalculate}
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Probability Distribution Meters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 font-mono text-[11px] mb-3">
        {/* P(inline) */}
        <div className="bg-[#080b12] p-2 rounded border border-teal-950/60 flex flex-col justify-between">
          <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
            <span>{t.pInlineTitle}</span>
            <span className="text-teal-300 font-bold">{pInlinePercent}%</span>
          </div>
          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden mb-1.5">
            <div
              className="h-full bg-teal-500/70 transition-all duration-300"
              style={{ width: `${pInlinePercent}%` }}
            />
          </div>
          <div className="text-[9px] text-slate-500 flex justify-between">
            <span>{t.pInlineLatency}</span>
            <span>{t.pInlineCost}</span>
          </div>
        </div>

        {/* P(subagents) - High Value winner */}
        <div className="bg-[#080b12] p-2 rounded border border-teal-500/40 shadow-[0_0_8px_rgba(45,212,191,0.15)] flex flex-col justify-between">
          <div className="flex justify-between items-center text-[10px] text-teal-200 mb-1">
            <span className="flex items-center gap-1 font-bold">
              <Zap className="w-3 h-3 text-teal-400" />
              {t.pSubagentsTitle}
            </span>
            <span className="text-teal-300 font-bold text-xs">{pSubagentsPercent}%</span>
          </div>
          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden mb-1.5">
            <div
              className="h-full bg-teal-400 shadow-[0_0_8px_#2dd4bf] transition-all duration-300"
              style={{ width: `${pSubagentsPercent}%` }}
            />
          </div>
          <div className="text-[9px] text-teal-400/80 flex justify-between font-semibold">
            <span>{t.pSubagentsDesc}</span>
            <span>{t.pSubagentsArgmax}</span>
          </div>
        </div>

        {/* P(escalate) */}
        <div className="bg-[#080b12] p-2 rounded border border-teal-950/60 flex flex-col justify-between">
          <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
            <span>{t.pEscalateTitle}</span>
            <span className="text-purple-400 font-bold">{pEscalatePercent}%</span>
          </div>
          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden mb-1.5">
            <div
              className="h-full bg-purple-500/70 transition-all duration-300"
              style={{ width: `${pEscalatePercent}%` }}
            />
          </div>
          <div className="text-[9px] text-slate-500 flex justify-between">
            <span>{t.pEscalateDesc}</span>
            <span>{t.pEscalateGate}</span>
          </div>
        </div>
      </div>

      {/* Decision Footer & Override Bar */}
      <div className="flex flex-wrap items-center justify-between pt-2 border-t border-teal-950 text-[10px] font-mono gap-2">
        <div className="flex items-center gap-1.5 text-slate-300">
          <span className="text-teal-400">{t.routerDirective}</span>
          <span className="bg-teal-950 text-teal-300 px-1.5 py-0.5 rounded font-bold border border-teal-800">
            {metrics.decisionRule}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onForceInline}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
          >
            {t.btnForceInline}
          </button>
          <button
            onClick={onForceSubagents}
            className="px-2 py-0.5 rounded bg-teal-900 hover:bg-teal-800 text-teal-200 border border-teal-700 transition cursor-pointer font-bold"
          >
            {t.btnForceFleet}
          </button>
        </div>
      </div>
    </div>
  );
};
