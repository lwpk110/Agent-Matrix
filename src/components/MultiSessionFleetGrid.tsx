/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SessionWorkspace } from '../types/matrix';
import { Language } from '../i18n/translations';
import { soundFx } from '../utils/audio';
import {
  Layers,
  ShieldAlert,
  Play,
  Pause,
  Maximize2,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Terminal,
  Cpu,
  Clock,
  Coins,
  FileCode,
  GitBranch,
  ExternalLink,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface MultiSessionFleetGridProps {
  sessions: SessionWorkspace[];
  activeSessionId: string;
  language: Language;
  onSelectSession: (id: string) => void;
  onApproveSessionHitl: (sessionId: string) => void;
  onAddSession?: (session: Partial<SessionWorkspace>) => void;
  onInjectDirective?: (sessionId: string, directive: string) => void;
  onPauseSession?: (sessionId: string) => void;
}

export const MultiSessionFleetGrid: React.FC<MultiSessionFleetGridProps> = ({
  sessions,
  activeSessionId,
  language,
  onSelectSession,
  onApproveSessionHitl,
  onAddSession,
  onInjectDirective,
  onPauseSession,
}) => {
  const isZh = language === 'zh';
  const [filterState, setFilterState] = useState<'all' | 'running' | 'blocked' | 'real'>('all');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newBranch, setNewBranch] = useState<string>('feat/new-agent-task');

  // Detect concurrent file collisions (e.g. two sessions editing same file)
  const fileUsageMap: Record<string, string[]> = {};
  sessions.forEach((s) => {
    if (s.activeFile) {
      if (!fileUsageMap[s.activeFile]) fileUsageMap[s.activeFile] = [];
      fileUsageMap[s.activeFile].push(s.tag);
    }
  });

  const conflicts = Object.entries(fileUsageMap).filter(([_, tags]) => tags.length > 1);

  // Aggregate Fleet Metrics
  const totalBurnRate = sessions.reduce((acc, s) => acc + (s.finOps?.burnRatePerMin || 0), 0);
  const totalTokens = sessions.reduce((acc, s) => acc + (s.finOps?.tokensUsed || 0), 0);
  const totalCost = sessions.reduce((acc, s) => acc + (s.finOps?.totalSessionCost || 0), 0);
  const blockedCount = sessions.filter((s) => s.isBlocked).length;
  const runningCount = sessions.filter((s) => !s.isBlocked).length;

  const filteredSessions = sessions.filter((s) => {
    if (filterState === 'running') return !s.isBlocked;
    if (filterState === 'blocked') return s.isBlocked;
    if (filterState === 'real') return s.isRealWorkspace;
    return true;
  });

  const handleCreateSession = () => {
    if (!newTitle.trim()) return;
    soundFx.playKeyClick();
    const id = `sess-${Date.now().toString().slice(-4)}`;
    onAddSession?.({
      id,
      tag: `#${sessions.length + 1} ${newTitle.toLowerCase().replace(/\s+/g, '-')}`,
      title: newTitle,
      branch: newBranch || 'main',
      activeFile: 'src/index.ts',
      step: 1,
      totalSteps: 5,
      directive: `${newTitle}: 正在启动独立子进程沙箱与 MCP 工具流...`,
      isBlocked: false,
    });
    setNewTitle('');
    setShowAddModal(false);
  };

  return (
    <div className="rounded-xl bg-gradient-to-b from-[#070c18] via-[#091122] to-[#040711] border border-cyan-500/30 p-4 shadow-[0_0_30px_rgba(0,240,255,0.08)] select-none">
      {/* Top Banner: Multi-Session Architecture Fleet Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-cyan-900/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-950/80 border border-cyan-400/60 flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.3)]">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black tracking-wider text-white font-mono flex items-center gap-1.5">
                {isZh ? 'CLAUDE CODE 多会话并发矩阵调度中心' : 'CLAUDE CODE MULTI-SESSION FLEET MATRIX'}
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                {sessions.length} {isZh ? '并发实例' : 'INSTANCES'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              {isZh
                ? '支持多分支任务并行演进 • 自动捕获跨会话资源竞态 • 统一权限审批队列 • 实时聚合成本'
                : 'Concurrent branch tasks • Race-condition detection • Unified approval queue • Aggregate FinOps'}
            </p>
          </div>
        </div>

        {/* Fleet Aggregate Telemetry Counters */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <div className="px-2.5 py-1.5 rounded-lg bg-black/60 border border-cyan-900/50 flex items-center gap-2">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <div>
              <div className="text-[9px] text-slate-500 uppercase">{isZh ? '全集群燃烧率' : 'FLEET BURN'}</div>
              <div className="text-amber-300 font-bold">${totalBurnRate.toFixed(2)}/min</div>
            </div>
          </div>

          <div className="px-2.5 py-1.5 rounded-lg bg-black/60 border border-cyan-900/50 flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <div>
              <div className="text-[9px] text-slate-500 uppercase">{isZh ? '总消耗 Token' : 'TOTAL TOKENS'}</div>
              <div className="text-cyan-300 font-bold">{(totalTokens / 1000).toFixed(1)}k</div>
            </div>
          </div>

          <div className="px-2.5 py-1.5 rounded-lg bg-black/60 border border-cyan-900/50 flex items-center gap-2">
            <ShieldAlert className={`w-3.5 h-3.5 ${blockedCount > 0 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`} />
            <div>
              <div className="text-[9px] text-slate-500 uppercase">{isZh ? '审批与拦截' : 'APPROVALS'}</div>
              <div className={`font-bold ${blockedCount > 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                {blockedCount} {isZh ? '待确认' : 'PENDING'}
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              soundFx.playKeyClick();
              setShowAddModal(true);
            }}
            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-black font-bold flex items-center gap-1.5 shadow-[0_0_12px_rgba(0,240,255,0.4)] transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isZh ? '新建会话' : 'New Session'}</span>
          </button>
        </div>
      </div>

      {/* Concurrent Conflict Radar Banner (if overlapping file writes detected) */}
      {conflicts.length > 0 && (
        <div className="mt-3 p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/60 flex items-center justify-between gap-3 font-mono text-xs text-rose-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 animate-bounce" />
            <div>
              <span className="font-bold text-rose-300">
                {isZh ? '⚠️ 跨会话资源竞态与文件锁预警 (Concurrency Conflict Detected):' : '⚠️ Concurrency Lock Warning:'}
              </span>
              <span className="ml-2 text-rose-300/80">
                {conflicts.map(([file, tags]) => `文件 [${file}] 正被 ${tags.join(' 与 ')} 同时并发写入`).join('; ')}
              </span>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded bg-rose-900/80 text-[10px] text-rose-200 border border-rose-600 font-bold">
            {isZh ? '已启用沙箱写隔离' : 'SANDBOX ISOLATED'}
          </span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center justify-between mt-3 mb-3">
        <div className="flex items-center gap-1.5 text-xs font-mono">
          <span className="text-slate-500 text-[11px] mr-1">{isZh ? '视图过滤:' : 'Filter:'}</span>
          {(['all', 'running', 'blocked', 'real'] as const).map((filter) => {
            const labels = {
              all: isZh ? `全部 (${sessions.length})` : `All (${sessions.length})`,
              running: isZh ? `正在运行 (${runningCount})` : `Running (${runningCount})`,
              blocked: isZh ? `待授权 (${blockedCount})` : `Pending Auth (${blockedCount})`,
              real: isZh ? `真实本地 (1)` : `Real Local (1)`,
            };
            return (
              <button
                key={filter}
                onClick={() => {
                  soundFx.playKeyClick();
                  setFilterState(filter);
                }}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                  filterState === filter
                    ? 'bg-cyan-950 text-cyan-200 border border-cyan-400/80 shadow-[0_0_8px_rgba(0,240,255,0.3)]'
                    : 'bg-black/40 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                {labels[filter]}
              </button>
            );
          })}
        </div>

        <div className="text-[11px] font-mono text-slate-500">
          {isZh ? '点击卡片可即时聚焦切换工作区' : 'Click card to focus workspace'}
        </div>
      </div>

      {/* Concurrent Session Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredSessions.map((sess) => {
          const isFocused = sess.id === activeSessionId;
          const isBlocked = sess.isBlocked;
          const hasConflict = conflicts.some(([file]) => file === sess.activeFile);

          return (
            <div
              key={sess.id}
              onClick={() => onSelectSession(sess.id)}
              className={`rounded-xl p-3.5 font-mono text-xs transition-all duration-200 cursor-pointer relative overflow-hidden flex flex-col justify-between border ${
                isFocused
                  ? isBlocked
                    ? 'bg-[#150a10] border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.3)]'
                    : 'bg-[#061524] border-cyan-400 shadow-[0_0_22px_rgba(0,240,255,0.25)]'
                  : isBlocked
                  ? 'bg-[#0f070c] border-rose-900/60 hover:border-rose-700'
                  : 'bg-[#070b14]/90 border-slate-800 hover:border-cyan-800/80 hover:bg-[#0a101e]'
              }`}
            >
              {/* Top Accent Strip */}
              <div
                className={`absolute top-0 left-0 right-0 h-1 ${
                  isBlocked
                    ? 'bg-rose-500 animate-pulse'
                    : isFocused
                    ? 'bg-gradient-to-r from-cyan-400 via-teal-400 to-purple-500'
                    : 'bg-slate-800'
                }`}
              />

              {/* Card Header: Tag, Real Badge, Status Badge */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-2 pt-1">
                  <div className="flex items-center gap-1.5">
                    {isBlocked ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping inline-block shrink-0" />
                    ) : isFocused ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse inline-block shrink-0" />
                    ) : (
                      <span className="w-2 rounded-full bg-emerald-500 inline-block shrink-0" />
                    )}
                    <span className="font-bold text-white tracking-wide text-[12px] truncate max-w-[170px]">
                      {sess.tag}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {sess.isRealWorkspace && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.3)]">
                        {isZh ? '真实进程' : 'REAL'}
                      </span>
                    )}

                    {isBlocked ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-600 animate-pulse flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" />
                        {isZh ? '待授权' : 'WAITING'}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">
                        {isZh ? '运行中' : 'RUNNING'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Session Title & Directive */}
                <h4 className="text-[12px] font-semibold text-slate-200 line-clamp-1 mb-1">{sess.title}</h4>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-3 bg-black/40 p-2 rounded border border-slate-900">
                  {sess.directive}
                </p>

                {/* Conflict warning badge if any */}
                {hasConflict && (
                  <div className="mb-2 px-2 py-1 rounded bg-rose-950/60 border border-rose-600/80 text-[10px] text-rose-300 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span>{isZh ? '并发文件锁已生效，正排队同步' : 'File lock queued'}</span>
                  </div>
                )}

                {/* Micro Meta: Branch, Active File, Step */}
                <div className="grid grid-cols-2 gap-1.5 text-[10px] text-slate-400 mb-3 bg-black/30 p-2 rounded border border-slate-900/60">
                  <div className="flex items-center gap-1 truncate">
                    <GitBranch className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span className="truncate">{sess.branch}</span>
                  </div>
                  <div className="flex items-center gap-1 truncate justify-end">
                    <FileCode className="w-3 h-3 text-purple-400 shrink-0" />
                    <span className="text-purple-300 truncate">{sess.activeFile}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                    <span>
                      {isZh ? '步骤' : 'Step'} {sess.step}/{sess.totalSteps}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 justify-end font-bold text-amber-300">
                    <Coins className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>${sess.finOps?.burnRatePerMin?.toFixed(2) || '0.15'}/m</span>
                  </div>
                </div>

                {/* Subagents Progress or Current Activity */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                    <span>{isZh ? '子任务与沙箱链路' : 'Subagents & Pipeline'}</span>
                    <span className="text-cyan-300 font-bold">
                      {Math.round((sess.step / sess.totalSteps) * 100)}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        isBlocked
                          ? 'bg-rose-500'
                          : 'bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400'
                      }`}
                      style={{ width: `${Math.round((sess.step / sess.totalSteps) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Card Footer: Quick Actions */}
              <div className="pt-2 border-t border-slate-900 flex items-center justify-between gap-1.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    soundFx.playKeyClick();
                    onSelectSession(sess.id);
                  }}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold transition flex items-center gap-1 ${
                    isFocused
                      ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(0,240,255,0.4)]'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>{isFocused ? (isZh ? '当前聚焦中' : 'Focused') : (isZh ? '聚焦该会话' : 'Focus')}</span>
                </button>

                {isBlocked ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      soundFx.playKeyClick();
                      onApproveSessionHitl(sess.id);
                    }}
                    className="px-2.5 py-1 rounded text-[10px] font-bold bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1 shadow-[0_0_10px_rgba(244,63,94,0.4)] animate-pulse"
                  >
                    <ShieldCheck className="w-3 h-3" />
                    <span>{isZh ? '一键放行授权' : 'Approve'}</span>
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      soundFx.playKeyClick();
                      onPauseSession?.(sess.id);
                    }}
                    className="px-2 py-1 rounded text-[10px] bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center gap-1"
                  >
                    <Pause className="w-3 h-3" />
                    <span>{isZh ? '暂停' : 'Pause'}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add New Session Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl bg-[#091122] border border-cyan-500/50 p-5 shadow-[0_0_40px_rgba(0,240,255,0.2)] font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-cyan-900/40">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-cyan-400" />
                {isZh ? '创建新的并发 Claude Code 实例' : 'Spawn New Concurrent Session'}
              </h4>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-3">
              <div>
                <label className="text-slate-400 block mb-1">
                  {isZh ? '任务标题 / 目标:' : 'Session Title / Directive:'}
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={isZh ? '如: 优化 Redis 缓存穿透策略' : 'e.g. Optimize Redis cache strategy'}
                  className="w-full px-3 py-2 rounded bg-black/60 border border-cyan-900/60 text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">
                  {isZh ? '关联 Git 分支:' : 'Git Branch:'}
                </label>
                <input
                  type="text"
                  value={newBranch}
                  onChange={(e) => setNewBranch(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-black/60 border border-cyan-900/60 text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="p-2.5 rounded bg-cyan-950/40 border border-cyan-800/40 text-[11px] text-cyan-300">
                {isZh
                  ? '💡 多会话将在独立进程中并行调度，系统会自动监听文件冲突并在出现跨会话写入时进行权限排队。'
                  : '💡 Sessions run in isolated subprocesses with automatic conflict resolution.'}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-cyan-900/40">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 rounded bg-slate-900 text-slate-300 hover:bg-slate-800"
              >
                {isZh ? '取消' : 'Cancel'}
              </button>
              <button
                onClick={handleCreateSession}
                className="px-4 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-black font-bold shadow-[0_0_12px_rgba(0,240,255,0.4)]"
              >
                {isZh ? '确认创建并启动' : 'Create & Spawn'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
