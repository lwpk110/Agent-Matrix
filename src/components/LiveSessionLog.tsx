import React, { useState, useEffect, useRef } from 'react';
import { LogEntry } from '../types/matrix';
import { Language, translations } from '../i18n/translations';
import { Terminal, Trash2, ArrowDown, FileCode, AlertOctagon } from 'lucide-react';

interface LiveSessionLogProps {
  logs: LogEntry[];
  language: Language;
  onClearLogs: () => void;
  onSelectLog?: (log: LogEntry) => void;
}

export const LiveSessionLog: React.FC<LiveSessionLogProps> = ({
  logs,
  language,
  onClearLogs,
  onSelectLog,
}) => {
  const t = translations[language];
  const [filter, setFilter] = useState<'all' | 'diff' | 'tool' | 'router' | 'alert'>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter((log) => {
    if (filter === 'all') return true;
    return log.category === filter;
  });

  const getTagColorClass = (color: string) => {
    switch (color) {
      case 'purple':
        return 'text-purple-300 bg-purple-950/70 border-purple-800/60';
      case 'amber':
        return 'text-amber-300 bg-amber-950/70 border-amber-800/60';
      case 'cyan':
        return 'text-teal-300 bg-teal-950/70 border-teal-800/60';
      case 'emerald':
        return 'text-emerald-300 bg-emerald-950/70 border-emerald-800/60';
      case 'rose':
        return 'text-rose-300 bg-rose-950/90 border-rose-600 animate-pulse';
      default:
        return 'text-slate-300 bg-slate-900 border-slate-700';
    }
  };

  const filterTabs = [
    { key: 'all', label: t.filterAll },
    { key: 'diff', label: t.filterDiff },
    { key: 'tool', label: t.filterTool },
    { key: 'router', label: t.filterRouter },
    { key: 'alert', label: t.filterAlert },
  ] as const;

  return (
    <div className="flex flex-col bg-[#050609] border border-slate-800/80 rounded-lg overflow-hidden font-mono">
      {/* Log Header with Controls */}
      <div className="flex flex-wrap items-center justify-between px-3 py-2 bg-[#090b10] border-b border-slate-800 text-[11px] gap-2">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-teal-400" />
          <span className="font-bold text-slate-200 tracking-wider">
            {t.liveLogTitle}
          </span>
          <span className="text-[10px] text-slate-500">
            ({filteredLogs.length} {t.eventsCount})
          </span>
        </div>

        {/* Filters and Actions */}
        <div className="flex items-center gap-2">
          {/* Filter tabs */}
          <div className="flex items-center bg-[#05070a] p-0.5 rounded border border-slate-800 text-[10px]">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-2 py-0.5 rounded transition uppercase cursor-pointer ${
                  filter === tab.key
                    ? 'bg-teal-950 text-teal-300 font-bold border border-teal-800/70'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Auto scroll toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2 py-0.5 rounded text-[10px] border transition cursor-pointer flex items-center gap-1 ${
              autoScroll
                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                : 'bg-slate-900 text-slate-400 border-slate-700'
            }`}
            title="Toggle auto-scrolling to bottom"
          >
            <ArrowDown className={`w-3 h-3 ${autoScroll ? 'animate-bounce' : ''}`} />
            {t.btnAutoScroll}
          </button>

          {/* Clear logs */}
          <button
            onClick={onClearLogs}
            className="p-1 rounded bg-slate-900 hover:bg-rose-950 hover:text-rose-400 text-slate-400 border border-slate-800 transition cursor-pointer"
            title={t.btnClearBuffer}
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Scrolling Stream Content */}
      <div
        ref={logContainerRef}
        className="h-48 md:h-56 overflow-y-auto p-2 space-y-1.5 select-text text-[11px] leading-relaxed bg-[#050609]"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-center py-8 text-slate-600 text-xs italic">
            {t.bufferEmpty}
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              onClick={() => onSelectLog?.(log)}
              className={`p-1.5 rounded border transition-all cursor-pointer ${
                log.riskLevel === 'critical'
                  ? 'bg-rose-950/30 border-rose-600/70 text-rose-200'
                  : 'bg-[#080a10]/80 border-slate-800/60 hover:border-slate-700 text-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Timestamp */}
                  <span className="text-[10px] text-slate-500 font-mono">
                    {log.timestamp}
                  </span>

                  {/* Agent tag badge */}
                  <span
                    className={`text-[9.5px] font-mono px-1.5 py-0.2 rounded font-bold border ${getTagColorClass(
                      log.agentColor
                    )}`}
                  >
                    [{log.agentTag}]
                  </span>

                  {/* Category icon */}
                  {log.riskLevel === 'critical' && (
                    <AlertOctagon className="w-3.5 h-3.5 text-rose-400 inline" />
                  )}

                  {/* Message body */}
                  <span className="text-slate-200">{log.message}</span>
                </div>

                {/* Probability metric chip if available */}
                {log.probabilities && (
                  <span className="text-[9.5px] text-teal-400/90 bg-teal-950/60 border border-teal-800/40 px-1.5 py-0.2 rounded shrink-0">
                    P(sub)={(log.probabilities.pSubagents * 100).toFixed(0)}%
                  </span>
                )}
              </div>

              {/* Render Tool call details if present */}
              {log.toolCall && (
                <div className="mt-1 pl-3 border-l-2 border-slate-700 text-[10px] text-slate-400 flex items-center justify-between">
                  <span className="font-mono text-teal-300">
                    &gt; {log.toolCall.name}: <span className="text-slate-300">{log.toolCall.args}</span>
                  </span>
                  {log.toolCall.durationMs && (
                    <span className="text-slate-500">
                      {log.toolCall.durationMs}ms ({log.toolCall.status})
                    </span>
                  )}
                </div>
              )}

              {/* Render File Diff if present */}
              {log.diffSnippet && (
                <div className="mt-1.5 bg-[#030406] p-2 rounded border border-slate-800 text-[10px] font-mono">
                  <div className="text-slate-400 mb-1 flex items-center gap-1">
                    <FileCode className="w-3 h-3 text-amber-400" />
                    <span>{log.diffSnippet.filePath}</span>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-rose-400/90 bg-rose-950/30 px-1 rounded line-through">
                      - {log.diffSnippet.oldCode}
                    </div>
                    <div className="text-emerald-400 bg-emerald-950/30 px-1 rounded font-semibold">
                      + {log.diffSnippet.newCode}
                    </div>
                  </div>
                </div>
              )}

              {log.runtimeEvent && (
                <details className="mt-1.5 border-t border-slate-800/80 pt-1.5 text-[10px]">
                  <summary className="flex cursor-pointer list-none items-center gap-1.5 text-cyan-300">
                    <span className="rounded border border-cyan-800/70 bg-cyan-950/50 px-1 py-0.5 font-bold">REAL RUNTIME</span>
                    <span>{log.runtimeEvent.provider} · {log.runtimeEvent.eventName}</span>
                    {log.runtimeEvent.sessionId && <span className="ml-auto text-slate-500">{log.runtimeEvent.sessionId.slice(0, 18)}</span>}
                  </summary>
                  <pre className="mt-1.5 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-black/40 p-2 text-slate-300">{log.runtimeEvent.details}</pre>
                </details>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
