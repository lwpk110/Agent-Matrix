import React from 'react';
import { AdvisorState, MatrixMode } from '../types/matrix';
import { Language, translations } from '../i18n/translations';
import { HitlGatekeeperDrawer } from './HitlGatekeeperDrawer';
import { ShieldCheck, AlertTriangle, Lock, ArrowUpRight, Zap, AlertOctagon } from 'lucide-react';

interface AdvisorPanelProps {
  advisor: AdvisorState;
  mode: MatrixMode;
  language: Language;
  onAuthorizePatch: () => void;
  onDismissAlert: () => void;
  onTriggerAlert: () => void;
  onApproveHitl: (id: string) => void;
  onRollbackHitl: (id: string) => void;
  onInjectPromptHitl: (id: string, prompt: string) => void;
  onTriggerHighRiskTest: (type?: string) => void;
}

export const AdvisorPanel: React.FC<AdvisorPanelProps> = ({
  advisor,
  mode,
  language,
  onAuthorizePatch,
  onDismissAlert,
  onTriggerAlert,
  onApproveHitl,
  onRollbackHitl,
  onInjectPromptHitl,
  onTriggerHighRiskTest,
}) => {
  const t = translations[language];
  const isZh = language === 'zh';
  const isAlert = advisor.alertActive || !!advisor.pendingHitl;
  const isBlocked = !!advisor.pendingHitl;
  const advisorName = mode === 'codex' ? 'o3-pro High-Reasoning Advisor' : 'Claude 3.7 Opus Advisor';
  const roleCode = mode === 'codex' ? 'CODEX-ADVISOR::O3-PRO' : t.advisorRoleCode;

  // Localized check names helper
  const getLocalizedCheckName = (idx: number, fallback: string) => {
    if (language === 'zh') {
      const keys = [t.checks.evalGuard, t.checks.fsGuard, t.checks.oauthWatcher, t.checks.consensus];
      return keys[idx] || fallback;
    }
    return fallback;
  };

  const getLocalizedCheckStatus = (status: 'pass' | 'fail' | 'watching') => {
    if (status === 'pass') return t.checks.passed;
    if (status === 'fail') return t.checks.failed;
    return t.checks.watching;
  };

  return (
    <div
      className={`relative flex flex-col justify-between bg-[#07090e]/95 backdrop-blur rounded-lg p-4 transition-all duration-300 ${
        isBlocked
          ? 'border-2 border-dashed border-rose-500 shadow-[0_0_25px_rgba(244,63,94,0.4)]'
          : isAlert
          ? 'border-2 border-dashed border-amber-500 shadow-[0_0_20px_rgba(251,146,60,0.3)]'
          : 'border border-dashed border-[#a855f7] shadow-[0_0_15px_rgba(168,85,247,0.18)]'
      }`}
    >
      {/* Header with pill tag [review] */}
      <div>
        <div className="flex items-center justify-between border-b border-purple-900/40 pb-2 mb-3">
          <div className="flex items-center gap-2">
            {isBlocked ? (
              <span className="p-1 rounded bg-rose-950/90 text-rose-300 border border-rose-600 animate-pulse">
                <AlertOctagon className="w-4 h-4 text-rose-400" />
              </span>
            ) : isAlert ? (
              <span className="p-1 rounded bg-amber-950/80 text-amber-300 border border-amber-600/60 animate-pulse">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              </span>
            ) : (
              <span className="p-1 rounded bg-purple-950/80 text-purple-300 border border-purple-700/60">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
              </span>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-300">
                  {advisorName}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-600/40">
                  {t.badgeReview}
                </span>
              </div>
              <div className="text-[10px] font-mono text-purple-400/60">{roleCode}</div>
            </div>
          </div>

          <div className="text-right">
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                isBlocked
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500 animate-pulse'
                  : isAlert
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500 animate-pulse'
                  : 'bg-purple-950 text-purple-300 border border-purple-800'
              }`}
            >
              {isBlocked
                ? isZh ? '状态: 熔断挂起 [BLOCKED]' : 'STATUS: BLOCKED (HITL)'
                : isAlert
                ? t.advisorWoken
                : t.advisorStandby}
            </span>
          </div>
        </div>

        {/* Risk meter & ceiling */}
        <div className="mb-3 bg-[#0a0d14] p-2.5 rounded border border-purple-950/70">
          <div className="flex justify-between items-center text-[11px] font-mono mb-1.5">
            <span className="text-slate-400 flex items-center gap-1">
              <Lock className="w-3 h-3 text-purple-400" />
              {t.riskGate}
            </span>
            <span
              className={`font-bold ${
                isAlert ? 'text-rose-400 animate-text-glow' : 'text-purple-300'
              }`}
            >
              {advisor.riskScore.toFixed(1)}% / {t.riskCeiling} {advisor.riskCeiling}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                isAlert ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]' : 'bg-purple-500'
              }`}
              style={{ width: `${Math.min(advisor.riskScore * 10, 100)}%` }}
            />
          </div>
        </div>

        {/* Invariant Policy Table */}
        <div className="space-y-1.5 font-mono text-[11px] mb-3">
          <div className="text-[10px] uppercase tracking-wider text-purple-400/80 mb-1 flex items-center justify-between">
            <span>{t.astWatchers}</span>
            <span className="text-[9px] text-slate-500">OWASP-2026</span>
          </div>
          {advisor.checks.map((check, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between py-1 px-2 rounded bg-purple-950/20 border border-purple-900/30 text-[10px]"
            >
              <span className="text-slate-300">{getLocalizedCheckName(idx, check.name)}</span>
              <span
                className={`px-1.5 py-0.2 rounded font-semibold ${
                  check.status === 'pass'
                    ? 'text-emerald-400 bg-emerald-950/40'
                    : check.status === 'fail'
                    ? 'text-rose-400 bg-rose-950/60 animate-pulse'
                    : 'text-amber-400 bg-amber-950/40'
                }`}
              >
                {getLocalizedCheckStatus(check.status)}
              </span>
            </div>
          ))}
        </div>

        {/* HITL Gatekeeper Interactive Drawer (Approve / Rollback / Inject Prompt) */}
        {advisor.pendingHitl ? (
          <HitlGatekeeperDrawer
            request={advisor.pendingHitl}
            language={language}
            onApprove={onApproveHitl}
            onRollback={onRollbackHitl}
            onInjectPrompt={onInjectPromptHitl}
          />
        ) : null}
      </div>

      {/* Bottom quick actions & One-Click Test Buttons */}
      <div className="pt-2 border-t border-purple-900/30 flex flex-wrap items-center justify-between text-[10px] font-mono gap-1.5 mt-2">
        <span className="text-purple-400/70">{t.autopilotActive}</span>

        <div className="flex items-center gap-1.5">
          {/* One-click test button 1: auth.ts high risk */}
          <button
            onClick={() => onTriggerHighRiskTest('auth')}
            className="px-1.5 py-0.5 rounded bg-rose-950/50 hover:bg-rose-900/70 text-rose-300 border border-rose-800 text-[9.5px] transition cursor-pointer flex items-center gap-0.5"
            title={isZh ? '一键测试: 触发 auth.ts 敏感修改拦截' : 'Test: Trigger auth.ts mutation block'}
          >
            <Zap className="w-2.5 h-2.5 text-rose-400" />
            <span>{isZh ? '测试 auth 拦截' : 'Test auth block'}</span>
          </button>

          {/* One-click test button 2: k8s/prod-secrets.yaml */}
          <button
            onClick={() => onTriggerHighRiskTest('k8s')}
            className="px-1.5 py-0.5 rounded bg-amber-950/50 hover:bg-amber-900/70 text-amber-300 border border-amber-800 text-[9.5px] transition cursor-pointer flex items-center gap-0.5"
            title={isZh ? '一键测试: 触发 k8s/prod-secrets.yaml 生产机密拦截' : 'Test: Trigger k8s secret block'}
          >
            <Zap className="w-2.5 h-2.5 text-amber-400" />
            <span>{isZh ? '测试 k8s 拦截' : 'Test k8s block'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
