import React, { useMemo, useState } from 'react';
import { Activity, ArrowLeft, Check, ChevronDown, CircleAlert, Clock3, Command, Copy, Filter, Layers3, LockKeyhole, Network, Radio, Search, ShieldCheck, Sparkles, Terminal, X } from 'lucide-react';
import { LogEntry, WsConnectionState } from '../types/matrix';
import { Language } from '../i18n/translations';

type RuntimeEvent = NonNullable<LogEntry['runtimeEvent']>;
type StepKind = 'prompt' | 'context' | 'skill' | 'mcp' | 'search' | 'tool' | 'permission' | 'result';
type SessionGroup = { id: string; sessionId?: string; turnId?: string; events: LogEntry[]; model?: string; turnCount: number };
type ChainStep = { id: string; kind: StepKind; title: string; summary: string; time: string; events: LogEntry[]; status: 'done' | 'waiting' | 'unavailable'; tags: string[]; toolName?: string; duration?: number; technical?: string };

interface CodexRuntimePageProps {
  language: Language;
  connectionState: WsConnectionState;
  hookGatewayState: 'starting' | 'listening' | 'offline';
  historyLoaded: boolean;
  logs: LogEntry[];
  onBack: () => void;
  onClear: () => Promise<void>;
}

const iconFor: Record<StepKind, React.ReactNode> = { prompt: <Command size={16} />, context: <Layers3 size={16} />, skill: <Sparkles size={16} />, mcp: <Network size={16} />, search: <Search size={16} />, tool: <Terminal size={16} />, permission: <ShieldCheck size={16} />, result: <Check size={16} /> };
const colorFor: Record<StepKind, string> = { prompt: 'violet', context: 'slate', skill: 'fuchsia', mcp: 'cyan', search: 'sky', tool: 'emerald', permission: 'amber', result: 'green' };
const toneClasses: Record<string, string> = {
  violet: 'border-violet-500/30 bg-violet-400/10 text-violet-300', slate: 'border-slate-500/30 bg-slate-400/10 text-slate-300', fuchsia: 'border-fuchsia-500/30 bg-fuchsia-400/10 text-fuchsia-300', cyan: 'border-cyan-500/30 bg-cyan-400/10 text-cyan-300', sky: 'border-sky-500/30 bg-sky-400/10 text-sky-300', emerald: 'border-emerald-500/30 bg-emerald-400/10 text-emerald-300', amber: 'border-amber-500/30 bg-amber-400/10 text-amber-300', green: 'border-green-500/30 bg-green-400/10 text-green-300',
};
const labelFor = (kind: StepKind, zh: boolean) => ({ prompt: zh ? '你的输入' : 'Your input', context: zh ? 'Codex 准备' : 'Codex setup', skill: 'Skill', mcp: 'MCP', search: zh ? '搜索' : 'Search', tool: zh ? '工具执行' : 'Tool', permission: zh ? '权限检查' : 'Permission', result: zh ? '本轮结果' : 'Result' })[kind];
const filterLabelFor = (kind: StepKind | 'all', zh: boolean) => ({ all: zh ? '全部' : 'All', prompt: zh ? '输入' : 'Input', context: zh ? '上下文' : 'Context', skill: 'Skill', mcp: 'MCP', search: zh ? '搜索' : 'Search', tool: zh ? '工具' : 'Tool', permission: zh ? '门禁' : 'Gate', result: zh ? '结果' : 'Result' })[kind];

function parseDetails(log?: LogEntry): Record<string, unknown> {
  if (!log?.runtimeEvent?.details) return {};
  try { const parsed = JSON.parse(log.runtimeEvent.details); return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}; } catch { return {}; }
}

function promptText(log: LogEntry | undefined, zh: boolean) {
  const payload = parseDetails(log);
  const nested = payload.payload && typeof payload.payload === 'object' ? payload.payload as Record<string, unknown> : {};
  const value = payload.prompt ?? nested.prompt;
  if (typeof value !== 'string' || !value.trim()) return zh ? '收到一条提示词（内容未由 Hook 暴露）' : 'A prompt was received (text not exposed by Hook)';
  return value.replace(/<in-app-browser-context[\s\S]*?<\/in-app-browser-context>\s*/i, '').trim().slice(0, 280);
}

function compactCommand(log: LogEntry) {
  const payload = parseDetails(log);
  const input = payload.tool_input && typeof payload.tool_input === 'object' ? payload.tool_input as Record<string, unknown> : {};
  const command = input.command ?? input.cmd ?? input.query ?? input.url;
  return typeof command === 'string' ? command.replace(/\s+/g, ' ').trim().slice(0, 180) : '';
}

function readableAction(log: LogEntry, toolName: string, zh: boolean) {
  if (toolName !== 'Bash') return /^mcp(?:__|[-_]|\b)/i.test(toolName) ? (zh ? `通过 MCP 服务调用 ${toolName}` : `Call ${toolName} through an MCP server`) : (zh ? `调用内置工具 ${toolName}` : `Call built-in tool ${toolName}`);
  const command = compactCommand(log);
  if (/Get-Content|cat\s|type\s/i.test(command)) return zh ? '读取项目文件，获取实现上下文' : 'Read project files for context';
  if (/\b(rg|grep|find|fd)\b/i.test(command)) return zh ? '搜索项目代码，定位相关内容' : 'Search the project for relevant code';
  if (/npm\s+run|pnpm\s|yarn\s/i.test(command)) return zh ? '运行项目检查或构建命令' : 'Run a project check or build';
  if (/git\s/i.test(command)) return zh ? '检查 Git 工作区状态' : 'Inspect Git workspace state';
  if (/NetTCPConnection|netstat|port/i.test(command)) return zh ? '检查本地服务是否在线' : 'Check whether the local service is online';
  return zh ? '执行一条本地命令' : 'Run a local command';
}

function toolTags(log: LogEntry, toolName: string) {
  const payload = parseDetails(log);
  const nested = payload.payload && typeof payload.payload === 'object' ? payload.payload as Record<string, unknown> : {};
  const declaredTool = [toolName, payload.tool_name, nested.tool_name].filter((value): value is string => typeof value === 'string').join(' ');
  const declaredSkill = [payload.skill_name, payload.skillName, nested.skill_name, nested.skillName].filter((value): value is string => typeof value === 'string').join(' ');
  const declaredMcp = [payload.mcp_server, payload.mcpServer, nested.mcp_server, nested.mcpServer, payload.server, nested.server].filter((value): value is string => typeof value === 'string').join(' ');
  const command = compactCommand(log);
  const tags: string[] = [];
  if (/^mcp(?:__|[-_]|\b)/i.test(declaredTool) || declaredMcp) tags.push('MCP');
  if (/(^|__)skill(?:_|$)|skill[_/]|load_skill/i.test(declaredTool) || declaredSkill || /(?:^|[\\/])skills?[\\/]|SKILL\.md/i.test(command)) tags.push('SKILL');
  if (/search|browser|web_search/i.test(declaredTool) || /^(rg|grep|find|fd|curl|wget|Invoke-WebRequest)\b/i.test(command)) tags.push('SEARCH');
  if (!tags.length) tags.push(toolName === 'Bash' ? 'SHELL' : 'TOOL');
  return tags;
}

export function groupSessions(logs: LogEntry[]): SessionGroup[] {
  const groups = new Map<string, LogEntry[]>();
  logs.forEach((log) => { const sessionId = log.runtimeEvent?.sessionId || 'unknown'; groups.set(sessionId, [...(groups.get(sessionId) || []), log]); });
  const segments: SessionGroup[] = [];
  groups.forEach((rawEvents, sessionId) => {
    const sorted = rawEvents.slice().sort((a, b) => eventTime(a).localeCompare(eventTime(b)));
    const turns = new Map<string, LogEntry[]>();
    const unscoped: LogEntry[] = [];
    sorted.forEach((log) => {
      const turnId = log.runtimeEvent?.turnId;
      if (!turnId) unscoped.push(log);
      else turns.set(turnId, [...(turns.get(turnId) || []), log]);
    });
    const orderedTurns = [...turns.entries()].sort((a, b) => eventTime(a[1][0]).localeCompare(eventTime(b[1][0])));
    if (!orderedTurns.length) orderedTurns.push(['', unscoped]);
    else if (unscoped.length) orderedTurns[0][1].push(...unscoped);
    orderedTurns.forEach(([turnId, turnEvents], turnIndex) => {
      const turnSorted = turnEvents.slice().sort((a, b) => eventTime(a).localeCompare(eventTime(b)));
      const buckets: LogEntry[][] = [];
      let prelude: LogEntry[] = [];
      turnSorted.forEach((log) => {
        if (log.runtimeEvent?.eventName === 'UserPromptSubmit') {
          buckets.push(buckets.length ? [log] : [...prelude, log]);
          prelude = [];
        } else if (buckets.length) buckets.at(-1)!.push(log);
        else prelude.push(log);
      });
      if (!buckets.length) buckets.push(prelude);
      buckets.forEach((events, taskIndex) => {
        const first = events.find((event) => event.runtimeEvent?.turnId)?.runtimeEvent || events[0]?.runtimeEvent;
        segments.push({ id: `${sessionId}::${turnId || `unknown-${turnIndex + 1}`}::task-${taskIndex + 1}`, sessionId: first?.sessionId, turnId: first?.turnId, events, model: events.find((x) => x.runtimeEvent?.model)?.runtimeEvent?.model, turnCount: 1 });
      });
    });
  });
  return segments.sort((a, b) => eventTime(b.events.at(-1)!).localeCompare(eventTime(a.events.at(-1)!)));
}

function eventTime(log: LogEntry) {
  return log.runtimeEvent?.timestamp || log.timestamp;
}

export function buildChain(events: LogEntry[], zh: boolean): ChainStep[] {
  const result: ChainStep[] = [];
  const toolMap = new Map<string, ChainStep>();
  const sortedEvents = events.slice().sort((a, b) => eventTime(a).localeCompare(eventTime(b)));
  if (sortedEvents.length && !sortedEvents.some((log) => log.runtimeEvent?.eventName === 'UserPromptSubmit')) {
    const firstEvent = sortedEvents[0];
    result.push({ id: `prompt-unavailable-${firstEvent.runtimeEvent?.turnId || firstEvent.id}`, kind: 'prompt', title: zh ? '本轮输入未被 Hook 捕获' : 'Prompt not captured by Hook', summary: zh ? '当前回合没有收到 UserPromptSubmit 事件，因此无法还原用户输入。其余步骤仍来自真实 Hook。' : 'No UserPromptSubmit event was received for this turn, so the user input cannot be reconstructed. The remaining steps are real Hook events.', time: eventTime(firstEvent), events: [], status: 'unavailable', tags: ['MISSING PROMPT'] });
  }
  sortedEvents.forEach((log) => {
    const event = log.runtimeEvent as RuntimeEvent | undefined;
    if (!event) return;
    const name = event.eventName;
    if (name === 'UserPromptSubmit') { result.push({ id: event.eventId, kind: 'prompt', title: zh ? '你提交了任务' : 'You submitted a task', summary: promptText(log, zh), time: eventTime(log), events: [log], status: 'done', tags: ['PROMPT'] }); return; }
    if (name === 'PreToolUse' || name === 'PostToolUse') {
      const key = event.toolUseId || event.eventId;
      const existing = toolMap.get(key);
      const toolName = log.toolCall?.name || 'Tool';
      if (existing) { existing.events.push(log); existing.duration = event.observedIntervalMs ?? existing.duration; existing.status = name === 'PostToolUse' ? 'done' : existing.status; if (name === 'PostToolUse') existing.technical = compactCommand(log) || existing.technical; return; }
      const tags = toolTags(log, toolName);
      const kind: StepKind = tags.includes('MCP') ? 'mcp' : tags.includes('SEARCH') ? 'search' : tags.includes('SKILL') ? 'skill' : 'tool';
      const step: ChainStep = { id: key, kind, title: toolName === 'Bash' ? (zh ? '运行命令行' : 'Run a shell command') : `${zh ? '调用' : 'Call'} ${toolName}`, summary: name === 'PostToolUse' ? (zh ? `${readableAction(log, toolName, zh)}，执行完成并返回结果` : `${readableAction(log, toolName, zh)}; result returned`) : readableAction(log, toolName, zh), time: eventTime(log), events: [log], status: name === 'PostToolUse' ? 'done' : 'waiting', tags, toolName, duration: event.observedIntervalMs, technical: compactCommand(log) };
      toolMap.set(key, step); result.push(step); return;
    }
    if (name === 'PermissionRequest') { result.push({ id: event.eventId, kind: 'permission', title: zh ? 'Codex 请求权限' : 'Codex requested permission', summary: event.permissionDecision ? `${zh ? '决策：' : 'Decision: '}${event.permissionDecision}` : (zh ? '等待权限决策' : 'Waiting for a permission decision'), time: eventTime(log), events: [log], status: event.permissionDecision ? 'done' : 'waiting', tags: ['GATE', event.permissionDecision ? event.permissionDecision.toUpperCase() : 'WAITING'] }); return; }
    if (/SessionStart|Compact|SubagentStart|SubagentStop/.test(name)) { const title = name === 'SessionStart' ? (zh ? 'Codex 会话已启动' : 'Codex session started') : name === 'SubagentStart' ? (zh ? '启动子 Agent' : 'Subagent started') : name === 'SubagentStop' ? (zh ? '子 Agent 已完成' : 'Subagent finished') : (zh ? '上下文发生压缩' : 'Context compaction'); result.push({ id: event.eventId, kind: 'context', title, summary: zh ? '这是生命周期事件，页面不会猜测隐藏上下文内容' : 'Lifecycle evidence only; hidden context is not guessed', time: eventTime(log), events: [log], status: 'done', tags: [name === 'SessionStart' ? 'SESSION' : 'LIFECYCLE'] }); return; }
    if (/Stop|SessionEnd|Interrupt/.test(name)) result.push({ id: event.eventId, kind: 'result', title: name === 'Interrupt' ? (zh ? '回合被中断' : 'Turn interrupted') : (zh ? '本轮执行结束' : 'Turn finished'), summary: name === 'Interrupt' ? (zh ? 'Codex 在这里停止' : 'Codex stopped here') : (zh ? '最后一个 Hook 事件已收到' : 'The final Hook event was received'), time: eventTime(log), events: [log], status: 'done', tags: ['END'] });
    else result.push({ id: event.eventId, kind: 'context', title: zh ? `运行事件：${name}` : `Runtime event: ${name}`, summary: zh ? '收到 Hook 事件；此事件尚无专用展示规则，原始字段可在下方查看。' : 'Hook event received. No dedicated presentation rule exists yet; inspect its fields below.', time: eventTime(log), events: [log], status: 'done', tags: ['HOOK', 'LIFECYCLE'] });
  });
  return result.sort((a, b) => a.time.localeCompare(b.time));
}

const Tag: React.FC<{ children: React.ReactNode; tone?: string }> = ({ children, tone = 'slate' }) => <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-semibold tracking-wide ${toneClasses[tone] || toneClasses.slate}`}>{children}</span>;

export const CodexRuntimePage: React.FC<CodexRuntimePageProps> = ({ language, connectionState, hookGatewayState, historyLoaded, logs, onBack, onClear }) => {
  const zh = language === 'zh';
  const [selectedSessionId, setSelectedSessionId] = useState<string>();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<StepKind | 'all'>('all');
  const [copied, setCopied] = useState(false);
  const [clearError, setClearError] = useState(false);
  const runtimeLogs = useMemo(() => logs.filter((log) => log.runtimeEvent?.source === 'codex-hook'), [logs]);
  const sessions = useMemo(() => groupSessions(runtimeLogs), [runtimeLogs]);
  const selectedSession = sessions.find((session) => session.id === selectedSessionId) || sessions[0];
  const chain = useMemo(() => buildChain(selectedSession?.events || [], zh), [selectedSession, zh]);
  const toolCount = chain.filter((step) => ['tool', 'mcp', 'search', 'skill'].includes(step.kind)).length;
  const categoryCounts = useMemo(() => chain.reduce<Record<string, number>>((counts, step) => { counts[step.kind] = (counts[step.kind] || 0) + 1; return counts; }, {}), [chain]);
  const visibleChain = activeFilter === 'all' ? chain : chain.filter((step) => step.kind === activeFilter);
  const promptStep = chain.find((step) => step.kind === 'prompt');
  const lastStep = chain.at(-1);
  const connected = connectionState === 'connected';
  const copyPrompt = async () => { if (!promptStep) return; await navigator.clipboard?.writeText(promptStep.summary); setCopied(true); window.setTimeout(() => setCopied(false), 1400); };

  return <div className="min-h-screen bg-[#080b0f] text-slate-200 selection:bg-emerald-800/70 selection:text-white">
    <header className="sticky top-0 z-20 flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#0b1015]/95 px-4 py-2.5 backdrop-blur-xl sm:px-6"><div className="flex min-w-0 items-center gap-3"><button onClick={onBack} title={zh ? '返回 Agent Matrix' : 'Back to Agent Matrix'} className="grid size-8 shrink-0 place-items-center rounded-md border border-white/10 bg-white/[0.03] text-slate-400 hover:border-emerald-500/40 hover:text-emerald-300"><ArrowLeft size={15} /></button><span className="grid size-8 shrink-0 place-items-center rounded-md bg-emerald-400/10 text-emerald-300"><Command size={17} /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="text-sm font-semibold text-white">{zh ? 'Codex 会话链路' : 'Codex session trace'}</h1><Tag tone="emerald">RUNTIME</Tag></div><p className="truncate text-[10px] text-slate-500">{zh ? '用一条时间线看懂 Codex 如何完成任务' : 'Understand how Codex completes a task in one timeline'}</p></div></div><div className="flex flex-wrap items-center gap-2 text-[10px]"><span className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 ${connected ? 'border-emerald-800/70 bg-emerald-950/40 text-emerald-300' : 'border-amber-800/60 bg-amber-950/30 text-amber-300'}`}><Radio size={12} />{connected ? (zh ? '实时在线' : 'Live') : (zh ? '通道离线' : 'Offline')}</span><span className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 ${hookGatewayState === 'listening' ? 'border-cyan-800/70 bg-cyan-950/40 text-cyan-300' : 'border-rose-800/60 bg-rose-950/30 text-rose-300'}`}><Radio size={12} />{hookGatewayState === 'listening' ? 'Hook 7789' : (zh ? 'Hook 离线' : 'Hook offline')}</span><a href="/" className="hidden rounded border border-white/10 px-2 py-1 text-slate-400 hover:text-white sm:block">Agent Matrix</a></div></header>
    <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8"><section className="flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between"><div><div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-400"><Activity size={12} />{zh ? '一条会话 · 完整链路' : 'One session · complete trace'}</div><h2 className="text-2xl font-semibold tracking-tight text-white">{zh ? '这次 Codex 到底做了什么？' : 'What did Codex actually do?'}</h2><p className="mt-2 max-w-2xl text-xs leading-5 text-slate-400">{zh ? '下面只展示一个会话，并把技术事件翻译成可读的步骤。点击步骤可以查看技术字段。' : 'This view shows one session and translates runtime events into readable steps. Open a step for technical fields.'}</p></div><div className="flex flex-wrap items-center gap-2"><button onClick={async () => { setClearError(false); try { await onClear(); } catch { setClearError(true); } }} disabled={!runtimeLogs.length} className="inline-flex items-center gap-1.5 rounded border border-white/10 px-2.5 py-1.5 text-[10px] text-slate-400 hover:border-rose-700/60 hover:text-rose-300 disabled:opacity-40"><X size={12} />{zh ? '清除历史' : 'Clear history'}</button>{clearError && <span className="text-[10px] text-rose-300">{zh ? '清除失败' : 'Clear failed'}</span>}</div></section>
      <section className="grid items-start gap-3 md:grid-cols-[minmax(0,1fr)_auto]"><div className="rounded-lg border border-white/10 bg-white/[0.025] p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2 text-xs font-semibold text-white"><Radio size={14} className="text-emerald-400" />{zh ? '正在查看的任务回合' : 'Task in view'}<Tag tone="cyan">{selectedSession ? `${selectedSession.events.length} EVENTS` : 'NO EVENTS'}</Tag></div><select value={selectedSession?.id || ''} onChange={(event) => setSelectedSessionId(event.target.value)} className="max-w-full rounded border border-white/10 bg-[#0b1015] px-2 py-1.5 text-[10px] text-slate-300 outline-none"><option value="">{zh ? '最近一次任务' : 'Latest task'}</option>{sessions.map((session, index) => <option key={session.id} value={session.id}>{session.sessionId ? `${session.sessionId.slice(0, 8)} / task ${index + 1} · ${session.events.length} events` : (zh ? '未标识任务' : 'Unknown task')}</option>)}</select></div>{selectedSession ? <div className="grid gap-3 text-[10px] text-slate-400 sm:grid-cols-4"><Info label={zh ? '会话 ID' : 'Session ID'} value={selectedSession.sessionId?.slice(0, 20) || '—'} mono /><Info label={zh ? '回合 ID' : 'Turn ID'} value={selectedSession.turnId?.slice(0, 20) || '—'} mono /><Info label={zh ? '模型' : 'Model'} value={selectedSession.model || '—'} /><Info label={zh ? '步骤' : 'Readable steps'} value={String(chain.length)} /></div> : <Empty title={!historyLoaded ? (zh ? '正在恢复会话' : 'Restoring sessions') : (zh ? '等待 Codex 会话' : 'Waiting for a Codex session')} text={zh ? '在 Codex CLI 中通过 /hooks 审核并信任本工作区 Hook，然后提交一个任务。' : 'Review and trust this workspace Hook with /hooks in Codex CLI, then submit a task.'} />}</div><div className="grid grid-cols-3 gap-2 md:w-[250px] md:grid-cols-3"><MiniStat value={String(toolCount)} label={zh ? '工具步骤' : 'Tool steps'} tone="emerald" /><MiniStat value={String(chain.filter((step) => step.kind === 'permission').length)} label={zh ? '权限检查' : 'Permission checks'} tone="amber" /><MiniStat value={lastStep ? (lastStep.kind === 'result' ? '✓' : '…') : '—'} label={zh ? '当前状态' : 'State'} tone="cyan" /></div></section>
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_270px]"><div className="min-w-0"><div className="mb-3 flex items-center justify-between"><div><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500"><Filter size={12} />{zh ? '执行时间线' : 'Execution timeline'}</div><div className="mt-1 text-xs text-slate-400">{zh ? '先按类型筛选，再展开单步查看技术字段' : 'Filter by type first, then open a step for technical fields'}</div></div><div className="text-[10px] text-slate-600">{visibleChain.length}/{chain.length} {zh ? '个步骤' : 'steps'}</div></div><div className="mb-4 flex flex-wrap gap-1.5 rounded-lg border border-white/10 bg-white/[0.02] p-2">{(['all', 'prompt', 'context', 'mcp', 'skill', 'search', 'tool', 'permission', 'result'] as const).map((kind) => <button key={kind} onClick={() => setActiveFilter(kind)} className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[10px] transition ${activeFilter === kind ? `${toneClasses[kind === 'all' ? 'emerald' : colorFor[kind]]} ring-1 ring-white/10` : 'border-white/10 text-slate-500 hover:border-white/20 hover:text-slate-300'}`}><span>{filterLabelFor(kind, zh)}</span><span className="font-mono text-[9px] opacity-70">{kind === 'all' ? chain.length : categoryCounts[kind] || 0}</span></button>)}</div>{visibleChain.length ? <div className="relative pl-7 before:absolute before:bottom-5 before:left-[11px] before:top-5 before:w-px before:bg-gradient-to-b before:from-violet-500/50 before:via-cyan-500/30 before:to-emerald-500/50">{visibleChain.map((step, index) => <TimelineCard key={step.id} step={step} index={index} zh={zh} expanded={expanded === step.id} onToggle={() => setExpanded(expanded === step.id ? null : step.id)} onCopy={step.kind === 'prompt' ? copyPrompt : undefined} copied={copied} />)}</div> : <Empty title={zh ? '没有符合条件的步骤' : 'No matching steps'} text={zh ? '切换上方类型，查看这条会话的其他环节。' : 'Choose another type above to inspect the rest of this session.'} />}</div><aside className="flex flex-col gap-3"><div className="rounded-lg border border-white/10 bg-white/[0.02] p-4"><div className="mb-3 flex items-center gap-2 text-xs font-semibold text-white"><LockKeyhole size={14} className="text-emerald-300" />{zh ? '怎么看这些标签' : 'How to read tags'}</div><div className="space-y-2.5 text-[10px] leading-4 text-slate-400"><Legend tone="violet" label="PROMPT" text={zh ? '你的输入' : 'Your request'} /><Legend tone="fuchsia" label="SKILL" text={zh ? '工作区技能或技能加载' : 'Workspace skill or skill loading'} /><Legend tone="cyan" label="MCP" text={zh ? '外部 MCP 服务或扩展工具' : 'MCP server or extension tool'} /><Legend tone="emerald" label="SHELL" text={zh ? '本地命令行执行' : 'Local shell command'} /><Legend tone="slate" label="TOOL" text={zh ? '普通内置工具调用' : 'Built-in tool call'} /><Legend tone="amber" label="GATE" text={zh ? '权限检查或等待批准' : 'Permission check or approval'} /><Legend tone="sky" label="SEARCH" text={zh ? '定位代码或网页内容' : 'Code or web search'} /></div></div><div className="rounded-lg border border-white/10 bg-white/[0.02] p-4"><div className="mb-2 flex items-center gap-2 text-xs font-semibold text-white"><CircleAlert size={14} className="text-amber-300" />{zh ? '数据边界' : 'Data boundary'}</div><p className="text-[10px] leading-5 text-slate-500">{zh ? '页面只显示本机 Codex Hook 真实上报的证据。隐藏系统上下文、模型私有推理和 Codex 托管 WebSearch 不会被猜测填充。' : 'This page shows evidence reported by local Codex Hooks. Hidden system context, private reasoning, and hosted WebSearch are never guessed.'}</p></div></aside></section></main></div>;
};

const TimelineCard: React.FC<{ step: ChainStep; index: number; zh: boolean; expanded: boolean; onToggle: () => void; onCopy?: () => void; copied: boolean }> = ({ step, index, zh, expanded, onToggle, onCopy, copied }) => {
  const tone = colorFor[step.kind];
  const detail = step.kind === 'prompt' ? step.summary : step.technical;
  return <article className="relative mb-3 rounded-lg border border-white/10 bg-[#0b1015] transition hover:border-white/20"><span className={`absolute -left-[27px] top-4 grid size-6 place-items-center rounded-full border bg-[#0b1015] ${toneClasses[tone] || toneClasses.slate}`}>{iconFor[step.kind]}</span><button onClick={onToggle} className="flex w-full items-start gap-3 px-4 py-3 text-left"><span className="grid size-7 shrink-0 place-items-center rounded-md bg-white/[0.04] font-mono text-[10px] text-slate-500">{String(index + 1).padStart(2, '0')}</span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-1.5"><strong className="text-[12px] text-slate-100">{step.title}</strong><Tag tone={tone}>{labelFor(step.kind, zh).toUpperCase()}</Tag>{step.toolName && <Tag tone="slate">{zh ? '来源' : 'SOURCE'} · {step.toolName}</Tag>}{step.tags.filter((tag) => tag !== labelFor(step.kind, zh).toUpperCase()).map((tag) => <Tag key={tag} tone={tag === 'GATE' || tag === 'WAITING' || tag === 'MISSING PROMPT' ? 'amber' : tag === 'MCP' ? 'cyan' : tag === 'SKILL' ? 'fuchsia' : tag === 'SEARCH' ? 'sky' : tag === 'SHELL' ? 'emerald' : 'slate'}>{tag === 'SHELL' ? (zh ? '本地 Shell' : 'LOCAL SHELL') : tag}</Tag>)}{step.status === 'waiting' ? <Tag tone="amber">{zh ? '进行中' : 'IN PROGRESS'}</Tag> : step.status === 'unavailable' ? <Tag tone="amber">{zh ? '未捕获' : 'NOT CAPTURED'}</Tag> : <Tag tone="emerald">{zh ? '已完成' : 'DONE'}</Tag>}</span><span className="mt-1 block break-words text-[11px] leading-5 text-slate-300">{step.summary}</span>{step.technical && step.kind !== 'prompt' && <span className="mt-1 block truncate rounded border border-white/[0.06] bg-black/20 px-2 py-1 font-mono text-[9px] text-slate-500">{step.technical}</span>}<span className="mt-1.5 flex flex-wrap items-center gap-2 text-[9px] text-slate-600"><span>{step.time}</span>{step.duration !== undefined && <span>{zh ? '耗时' : 'Duration'} · {step.duration}ms</span>}{step.events.length > 1 && <span>{step.events.length} {zh ? '个运行事件' : 'runtime events'}</span>}</span></span><ChevronDown size={15} className={`mt-1 shrink-0 text-slate-600 transition ${expanded ? 'rotate-180 text-emerald-300' : ''}`} /></button>{expanded && <div className="border-t border-white/[0.08] px-4 pb-4 pt-3"><div className="grid gap-2 text-[10px] sm:grid-cols-2"><Info label={zh ? '事件' : 'Event'} value={step.events.map((event) => event.runtimeEvent?.eventName).join(' → ') || '—'} /><Info label={zh ? '回合' : 'Turn'} value={step.events[0]?.runtimeEvent?.turnId?.slice(0, 20) || '—'} mono /><Info label={zh ? '输入字段' : 'Input fields'} value={step.events[0]?.runtimeEvent?.toolInputKeys?.join(', ') || '—'} /><Info label={zh ? '权限模式' : 'Permission mode'} value={step.events[0]?.runtimeEvent?.permissionMode || '—'} /></div>{detail && <div className="mt-3 rounded border border-white/10 bg-black/20 p-2.5 font-mono text-[10px] leading-4 text-slate-400">{detail}</div>}{onCopy && step.status !== 'unavailable' && <button onClick={(event) => { event.stopPropagation(); onCopy(); }} className="mt-2 inline-flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-[10px] text-slate-400 hover:text-white"><Copy size={11} />{copied ? (zh ? '已复制' : 'Copied') : (zh ? '复制提示词' : 'Copy prompt')}</button>}<details className="mt-3"><summary className="cursor-pointer text-[9px] text-slate-600 hover:text-slate-400">{zh ? '查看脱敏原始载荷' : 'View redacted payload'}</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded border border-white/10 bg-[#05080b] p-2 text-[9px] leading-4 text-slate-500">{step.events[0]?.runtimeEvent?.details || '—'}</pre></details></div>}</article>;
};

const Info: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => <div className="min-w-0"><div className="text-[9px] uppercase tracking-wide text-slate-600">{label}</div><div className={`mt-0.5 truncate text-[10px] text-slate-300 ${mono ? 'font-mono' : ''}`}>{value}</div></div>;
const statToneClasses: Record<string, string> = { emerald: 'text-emerald-300', amber: 'text-amber-300', cyan: 'text-cyan-300' };
const MiniStat: React.FC<{ value: string; label: string; tone: string }> = ({ value, label, tone }) => <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5"><div className={`text-lg font-semibold ${statToneClasses[tone] || statToneClasses.cyan}`}>{value}</div><div className="mt-0.5 text-[9px] text-slate-500">{label}</div></div>;
const Legend: React.FC<{ tone: string; label: string; text: string }> = ({ tone, label, text }) => <div className="flex items-center gap-2"><Tag tone={tone}>{label}</Tag><span>{text}</span></div>;
const Empty: React.FC<{ title: string; text: string }> = ({ title, text }) => <div className="rounded-lg border border-dashed border-white/10 px-5 py-12 text-center"><Clock3 size={20} className="mx-auto mb-2 text-slate-600" /><div className="text-xs text-slate-300">{title}</div><div className="mx-auto mt-1 max-w-sm text-[10px] leading-5 text-slate-600">{text}</div></div>;
