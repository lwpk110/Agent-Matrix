import React, { useState, useMemo } from 'react';
import { FinOpsMetrics } from '../types/matrix';
import { Language } from '../i18n/translations';
import { DollarSign, Cpu, GitCommit, ShieldAlert, Activity, TrendingUp, ChevronDown, ChevronUp, LineChart } from 'lucide-react';
import { TokenBurnChart } from './TokenBurnChart';
import { generate60mHistory } from '../utils/finOpsHistory';

interface FinOpsBarProps {
  metrics: FinOpsMetrics;
  language: Language;
  agentTag?: string;
  isRealWorkspace?: boolean;
}

export const FinOpsBar: React.FC<FinOpsBarProps> = ({
  metrics,
  language,
  agentTag = 'ACTIVE AGENT',
  isRealWorkspace = false,
}) => {
  const isZh = language === 'zh';
  const isHighWatermark = metrics.watermarkPct >= 90;
  const [showD3Chart, setShowD3Chart] = useState<boolean>(false);

  // Derive scenario from agent tag or workspace
  const scenarioType = useMemo(() => {
    if (isRealWorkspace) return 'real';
    const tagLower = agentTag.toLowerCase();
    if (tagLower.includes('auth')) return 'auth';
    if (tagLower.includes('k8s') || tagLower.includes('cnpg')) return 'k8s';
    if (tagLower.includes('doris') || tagLower.includes('sql')) return 'doris';
    return 'auth';
  }, [agentTag, isRealWorkspace]);

  // Ensure 60-minute historical points exist
  const historyData = useMemo(() => {
    if (metrics.historical60m && metrics.historical60m.length >= 10) {
      return metrics.historical60m;
    }
    // Synthesize tailored 60m history based on current metrics
    const base = Math.max(0.02, metrics.burnRatePerMin * 0.7);
    const peak = Math.max(0.18, metrics.burnRatePerMin * 1.6);
    return generate60mHistory(base, peak, scenarioType, metrics.burnRatePerMin);
  }, [metrics.historical60m, metrics.burnRatePerMin, scenarioType]);

  return (
    <div className="flex flex-col gap-2 font-mono text-[11px] bg-[#07090e] border border-slate-800/80 rounded-lg p-2.5 shadow-lg">
      {/* Top 4 Summary Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {/* 1. Token Burn Rate ($/min) with D3 Chart Toggle */}
        <div className="bg-[#040810] p-2 rounded border border-cyan-900/60 flex flex-col justify-between relative group hover:border-cyan-500/70 transition-colors shadow-[0_0_12px_rgba(0,240,255,0.06)]">
          <div className="flex items-center justify-between text-slate-400 text-[10px] mb-1">
            <span className="flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-cyan-400 drop-shadow-[0_0_5px_rgba(0,240,255,0.7)]" />
              <span className="text-cyan-200/90 font-medium">{isZh ? 'Token 燃烧速率' : 'Token Burn Rate'}</span>
            </span>
            <button
              onClick={() => setShowD3Chart(!showD3Chart)}
              className={`text-[9px] flex items-center gap-1 px-1.5 py-0.5 rounded transition-all ${
                showD3Chart
                  ? 'bg-cyan-500/25 text-cyan-300 font-bold border border-cyan-400/50 shadow-[0_0_10px_rgba(0,240,255,0.35)]'
                  : 'bg-slate-900 text-slate-400 hover:text-cyan-300 border border-slate-800'
              }`}
              title={isZh ? '展开/收起 60分钟 D3 趋势曲线' : 'Toggle 60-Min D3 Trend Chart'}
            >
              <LineChart className="w-2.5 h-2.5 text-cyan-400" />
              <span>{showD3Chart ? (isZh ? 'D3曲线 ▲' : 'D3 Chart ▲') : (isZh ? 'D3曲线 ▼' : 'D3 Chart ▼')}</span>
            </button>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-extrabold text-cyan-300 font-mono tracking-tight drop-shadow-[0_0_6px_rgba(0,240,255,0.5)]">
              ${metrics.burnRatePerMin.toFixed(2)}
              <span className="text-[10px] font-normal text-cyan-600"> /min</span>
            </span>
            <span className="text-[9.5px] text-slate-400">
              {isZh ? '累计' : 'Total'}:{' '}
              <span className="text-slate-200 font-bold">${metrics.totalSessionCost.toFixed(3)}</span>
            </span>
          </div>
        </div>

        {/* 2. Context Window Watermark */}
        <div className="bg-[#050609] p-2 rounded border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[10px] mb-1">
            <span className="flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-teal-400" />
              <span>{isZh ? '上下文窗口水位' : 'Context Watermark'}</span>
            </span>
            <span
              className={`font-bold text-[10px] ${
                isHighWatermark ? 'text-amber-400 animate-pulse' : 'text-teal-400'
              }`}
            >
              {metrics.watermarkPct.toFixed(1)}%
            </span>
          </div>
          <div>
            <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden mb-1">
              <div
                className={`h-full transition-all duration-300 ${
                  isHighWatermark ? 'bg-amber-400 shadow-[0_0_8px_#fb923c]' : 'bg-teal-400'
                }`}
                style={{ width: `${Math.min(metrics.watermarkPct, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-slate-500">
              <span>{(metrics.tokensUsed / 1000).toFixed(1)}k tokens</span>
              <span>{(metrics.maxTokens / 1000).toFixed(0)}k limit</span>
            </div>
          </div>
        </div>

        {/* 3. Cyclomatic Complexity Delta */}
        <div className="bg-[#050609] p-2 rounded border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[10px] mb-1">
            <span className="flex items-center gap-1">
              <GitCommit className="w-3.5 h-3.5 text-purple-400" />
              <span>{isZh ? 'AST 圈复杂度增量' : 'Complexity Delta'}</span>
            </span>
            <span className="text-[9px] text-purple-400 font-mono">McCabe ΔM</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-extrabold text-purple-300 font-mono">
              {metrics.cyclomaticComplexityDelta > 0
                ? `+${metrics.cyclomaticComplexityDelta}`
                : metrics.cyclomaticComplexityDelta}
            </span>
            <span className="text-[9.5px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-1.5 py-0.2 rounded font-semibold">
              {metrics.cyclomaticComplexityDelta <= 3
                ? isZh
                  ? '低负荷'
                  : 'LOW RISK'
                : isZh
                ? '需重构'
                : 'HIGH RISK'}
            </span>
          </div>
        </div>

        {/* 4. Infinite Loop Circuit Breaker */}
        <div className="bg-[#050609] p-2 rounded border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[10px] mb-1">
            <span className="flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>{isZh ? '死循环防击穿熔断' : 'Loop Circuit Breaker'}</span>
            </span>
            <span className="text-[9px] text-slate-500">{isZh ? '保险丝' : 'Fuse'}</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-extrabold text-slate-200 font-mono">
              {metrics.loopCircuitBreakerCount} / 3{' '}
              <span className="text-[10px] font-normal text-slate-500">
                {isZh ? '次重试' : 'retries'}
              </span>
            </span>
            <span className="text-[9.5px] text-teal-400 bg-teal-950/40 border border-teal-800/40 px-1.5 py-0.2 rounded font-semibold">
              {isZh ? '保护开启' : 'GUARDED'}
            </span>
          </div>
        </div>
      </div>

      {/* Integrated D3 60-Minute Line Chart Section */}
      {showD3Chart && (
        <div className="pt-1">
          <TokenBurnChart
            history={historyData}
            currentBurnRate={metrics.burnRatePerMin}
            language={language}
            agentTag={agentTag}
            isRealWorkspace={isRealWorkspace}
          />
        </div>
      )}
    </div>
  );
};
