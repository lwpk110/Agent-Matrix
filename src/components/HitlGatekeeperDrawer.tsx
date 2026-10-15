import React, { useState } from 'react';
import { HitlApprovalRequest } from '../types/matrix';
import { Language, translations } from '../i18n/translations';
import { ShieldAlert, CheckCircle2, RotateCcw, MessageSquarePlus, AlertTriangle, FileCode, Lock, Terminal } from 'lucide-react';

interface HitlGatekeeperDrawerProps {
  request: HitlApprovalRequest | null;
  language: Language;
  onApprove: (requestId: string) => void;
  onRollback: (requestId: string) => void;
  onInjectPrompt: (requestId: string, prompt: string) => void;
}

export const HitlGatekeeperDrawer: React.FC<HitlGatekeeperDrawerProps> = ({
  request,
  language,
  onApprove,
  onRollback,
  onInjectPrompt,
}) => {
  const t = translations[language];
  const [showPromptInput, setShowPromptInput] = useState(false);
  const [promptInput, setPromptInput] = useState(
    language === 'zh'
      ? '注意：必须强制启用 RFC 7636 PKCE S256 校验，并在返回凭证时写入 __Host_state Cookie (SameSite=Strict)'
      : 'Strict invariant: Enforce RFC 7636 PKCE S256 code challenge and set __Host_state cookie with SameSite=Strict.'
  );

  if (!request) return null;

  const isZh = language === 'zh';

  return (
    <div className="relative mt-3 p-3.5 rounded-lg border-2 border-dashed border-rose-500 bg-[#090b12] shadow-[0_0_25px_rgba(244,63,94,0.3)] animate-pulse-subtle font-mono">
      {/* Header with BLOCKED badge */}
      <div className="flex flex-wrap items-center justify-between border-b border-rose-900/60 pb-2 mb-3 gap-2">
        <div className="flex items-center gap-2">
          <span className="p-1 rounded bg-rose-950 text-rose-300 border border-rose-600 animate-bounce">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-rose-300 uppercase tracking-wider">
                {isZh ? 'HITL 安全网关: 操作热熔断' : 'HITL GATEKEEPER: HOT-BREAK'}
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-950 text-rose-200 border border-rose-500 font-extrabold animate-pulse">
                {isZh ? '[等待审批 / BLOCKED]' : '[AWAITING APPROVAL / BLOCKED]'}
              </span>
            </div>
            <div className="text-[10px] text-rose-400/80">
              {request.cveOrRule} · Risk: {request.riskScore.toFixed(1)}% (Ceil: 2.0%)
            </div>
          </div>
        </div>

        <div className="text-[10px] text-slate-400 bg-black/60 px-2 py-0.5 rounded border border-slate-800">
          REQ-ID: <span className="text-amber-300">{request.id}</span>
        </div>
      </div>

      {/* Security Audit Breakdown */}
      <div className="mb-3 bg-[#05070a] p-2.5 rounded border border-rose-950/80 text-[11px]">
        <div className="flex items-center gap-1.5 text-rose-400 font-bold mb-1 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          <span>{isZh ? 'Opus 战略审计评估报告' : 'Opus Strategic Security Audit'}</span>
        </div>
        <p className="text-slate-300 text-[10.5px] leading-relaxed mb-2">
          {request.summary}
        </p>
        <div className="space-y-1 text-[10px] text-slate-400 border-t border-slate-800/80 pt-1.5">
          {request.detailedAudit.map((item, idx) => (
            <div key={idx} className="flex items-start gap-1.5">
              <span className="text-rose-400 font-bold">•</span>
              <span className="text-slate-300">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Code Diff Preview */}
      <div className="mb-3 bg-[#030406] p-2.5 rounded border border-slate-800 text-[10.5px]">
        <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-1 mb-1.5">
          <span className="flex items-center gap-1 text-amber-300">
            <FileCode className="w-3.5 h-3.5 text-amber-400" />
            <span>{request.targetPath}</span>
          </span>
          <span className="text-[9.5px] text-slate-500 font-semibold">
            {isZh ? '拟定 AST 修改差异 (Diff)' : 'Proposed AST Mutation Diff'}
          </span>
        </div>

        <div className="space-y-0.5 bg-black/80 p-2 rounded border border-slate-900 text-[10px] font-mono overflow-x-auto">
          <div className="text-slate-500 select-none">@@ -41,7 +41,9 @@</div>
          {request.diffSnippet.oldCode.split('\n').map((line, idx) => (
            <div key={'old-' + idx} className="text-rose-400 bg-rose-950/40 px-1 rounded-sm line-through">
              - {line}
            </div>
          ))}
          {request.diffSnippet.newCode.split('\n').map((line, idx) => (
            <div key={'new-' + idx} className="text-emerald-400 bg-emerald-950/40 px-1 rounded-sm font-semibold">
              + {line}
            </div>
          ))}
        </div>
      </div>

      {/* Optional Injected Prompt Drawer */}
      {showPromptInput && (
        <div className="mb-3 bg-[#0a0f1d] p-2 rounded border border-teal-600/50">
          <div className="text-[10px] text-teal-300 font-bold mb-1 flex items-center gap-1">
            <Terminal className="w-3 h-3 text-teal-400" />
            <span>{isZh ? '输入需要向 Agent 注入的修正约束指令:' : 'Inject Prompt Constraints to Agent:'}</span>
          </div>
          <textarea
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            rows={2}
            className="w-full bg-black/60 border border-slate-800 rounded p-1.5 text-slate-200 text-[10px] font-mono outline-none focus:border-teal-400"
          />
          <div className="flex justify-end gap-2 mt-1">
            <button
              onClick={() => setShowPromptInput(false)}
              className="text-[9px] text-slate-400 hover:text-white px-2 py-0.5 rounded cursor-pointer"
            >
              {isZh ? '取消' : 'Cancel'}
            </button>
            <button
              onClick={() => {
                onInjectPrompt(request.id, promptInput);
                setShowPromptInput(false);
              }}
              className="text-[9.5px] font-bold bg-teal-800 hover:bg-teal-700 text-white px-2.5 py-0.5 rounded cursor-pointer"
            >
              {isZh ? '提交并重新推理' : 'Submit & Re-infer'}
            </button>
          </div>
        </div>
      )}

      {/* 3 Interactive Operational Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {/* Approve & Continue */}
        <button
          onClick={() => onApprove(request.id)}
          className="py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-mono font-bold text-[10px] tracking-wide transition shadow-md shadow-emerald-950 flex items-center justify-center gap-1 cursor-pointer"
          title={isZh ? '人工批准本次工具调用并放行执行' : 'Approve tool execution and resume agent workflow'}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{isZh ? '批准放行 (Approve)' : 'Approve & Continue'}</span>
        </button>

        {/* Rollback */}
        <button
          onClick={() => onRollback(request.id)}
          className="py-1.5 px-2 bg-rose-700 hover:bg-rose-600 text-white rounded font-mono font-bold text-[10px] tracking-wide transition shadow-md shadow-rose-950 flex items-center justify-center gap-1 cursor-pointer"
          title={isZh ? '拒绝执行并回滚至上一个安全快照' : 'Reject modification and rollback to last clean AST snapshot'}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{isZh ? '拒绝并回滚 (Rollback)' : 'Reject & Rollback'}</span>
        </button>

        {/* Inject Prompt */}
        <button
          onClick={() => setShowPromptInput(!showPromptInput)}
          className="py-1.5 px-2 bg-purple-900/80 hover:bg-purple-800 text-purple-200 border border-purple-600 rounded font-mono font-bold text-[10px] tracking-wide transition flex items-center justify-center gap-1 cursor-pointer"
          title={isZh ? '注入补充约束与修订提示词' : 'Inject prompt amendments to steer agent'}
        >
          <MessageSquarePlus className="w-3.5 h-3.5 text-purple-300" />
          <span>{isZh ? '注入修正指令 (Inject)' : 'Inject Prompt'}</span>
        </button>
      </div>
    </div>
  );
};
