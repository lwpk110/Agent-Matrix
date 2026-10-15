import React from 'react';
import { SessionWorkspace } from '../types/matrix';
import { Language } from '../i18n/translations';
import { Layers, ShieldAlert, GitBranch, CheckCircle2, Play } from 'lucide-react';

interface SessionTabBarProps {
  sessions: SessionWorkspace[];
  activeSessionId: string;
  language: Language;
  onSelectSession: (id: string) => void;
}

export const SessionTabBar: React.FC<SessionTabBarProps> = ({
  sessions,
  activeSessionId,
  language,
  onSelectSession,
}) => {
  const isZh = language === 'zh';

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-800/80 font-mono text-[11px] select-none">
      <div className="flex items-center gap-1 text-slate-500 text-[10px] uppercase font-bold tracking-wider mr-1 px-1">
        <Layers className="w-3.5 h-3.5 text-teal-400" />
        <span className="hidden sm:inline">{isZh ? '并发会话集群:' : 'FLEET SESSIONS:'}</span>
      </div>

      {sessions.map((sess) => {
        const isActive = sess.id === activeSessionId;
        const isBlocked = sess.isBlocked;

        return (
          <button
            key={sess.id}
            onClick={() => onSelectSession(sess.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded transition cursor-pointer text-left whitespace-nowrap border ${
              isActive
                ? isBlocked
                  ? 'bg-rose-950/70 border-rose-500 text-rose-200 shadow-[0_0_12px_rgba(244,63,94,0.3)] font-bold'
                  : 'bg-teal-950/70 border-teal-500/80 text-teal-200 shadow-[0_0_12px_rgba(45,212,191,0.2)] font-bold'
                : isBlocked
                ? 'bg-[#0a080d] border-rose-900/60 text-rose-400 hover:border-rose-700'
                : 'bg-[#080b12] border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            {/* Session Indicator */}
            {isBlocked ? (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block shrink-0" />
            ) : isActive ? (
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse inline-block shrink-0" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-slate-600 inline-block shrink-0" />
            )}

            {/* Title & Tag */}
            <span className="font-mono text-xs">{sess.tag}</span>

            {/* Blocked or Step badge */}
            {isBlocked ? (
              <span className="text-[9px] px-1 rounded bg-rose-950 text-rose-300 border border-rose-600 font-bold animate-pulse">
                {isZh ? '待审批' : 'BLOCKED'}
              </span>
            ) : (
              <span className="text-[9px] px-1 rounded bg-slate-900 text-slate-400 border border-slate-800">
                S{sess.step}/{sess.totalSteps}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
