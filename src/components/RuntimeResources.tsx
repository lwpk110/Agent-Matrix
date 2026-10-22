import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Activity, ArrowUpRight, ChevronDown, Database, Layers3, Library, MessageSquareText, X, Zap } from "lucide-react";
import type { RuntimeNodeId, RuntimeEvent, RuntimeSession } from "../types/runtime";
import { MockEventCard } from "./CodexMockDetails";
import { runtimeResources } from "./runtimeResourcesModel";
import { promptObservations, promptTraces } from "./promptQueueModel";
import type { LogEntry } from "../types/matrix";
import "./RuntimeResources.css";

type Resource = "usage" | "context" | "memory" | "capabilities" | "prompts";
type CardResource = Exclude<Resource, "prompts">;
const labels: Record<Resource, string> = { usage: "Token 用量", context: "当前上下文", memory: "记忆", capabilities: "能力与控制", prompts: "提示词监控" };
const colors: Record<Resource, string> = { usage: "#83dce7", context: "#9dacf5", memory: "#8ed9b9", capabilities: "#e5c98b", prompts: "#d2a3ef" };
const detailColors = [colors.usage, colors.context, colors.memory, colors.capabilities, colors.prompts];
const fmt = (n: number | null) => n === null ? "—" : n.toLocaleString("en-US");
const isObservedTokenCount = (value: number | null): value is number => value !== null && Number.isFinite(value) && value >= 0;
type MemoryFilePreview = { scope: "global" | "project"; name: string; content: string; truncated: boolean; updatedAt: string };

function ResourceCards({ cards, expanded, id, onToggle }: {
  cards: Array<{ key: CardResource; icon: typeof Zap; value: string; unit: string; note: string; mini: ReactNode }>;
  expanded: Resource | null;
  id: string;
  onToggle: (key: CardResource) => void;
}) {
  return <div className="rr-cards">{cards.map(({ key, icon: Icon, value, unit, note, mini }) => <button key={key} id={`${id}-${key}`} className={`rr-card rr-card-${key} ${expanded === key ? "is-open" : ""}`}
    style={{ "--rr-accent": colors[key] } as CSSProperties} aria-expanded={expanded === key} aria-controls={`${id}-panel`}
    onClick={() => onToggle(key)}>
    <span className="rr-card-label"><Icon size={15} />{labels[key]}<ChevronDown size={13} /></span>
    <strong>{value}<small>{unit}</small></strong>
    <span className="rr-mini" aria-hidden="true">{mini}</span>
    <span className="rr-note">{note}</span>
  </button>)}</div>;
}

export function RuntimeResources({ events, logs, session, onInspect, onCorrelate }: {
  events: RuntimeEvent[];
  logs: LogEntry[];
  session: RuntimeSession;
  onInspect: (node: RuntimeNodeId, source: HTMLButtonElement) => void;
  onCorrelate: (callId: string) => void;
}) {
  const [expanded, setExpanded] = useState<Resource | null>(null);
  const [memoryFiles, setMemoryFiles] = useState<MemoryFilePreview[] | null>(null);
  const [memoryFilesLoading, setMemoryFilesLoading] = useState(false);
  const panelRef = useRef<HTMLDialogElement>(null);
  const id = useId();
  const data = useMemo(() => runtimeResources(events), [events]);
  const context = data.context;
  const percent = context ? context.total / context.limit * 100 : null;
  const mockRoundMaximum = Math.max(...data.rounds.map(round => round.input + round.output), 1);
  const cards = [
    { key: "usage" as const, icon: Zap, value: fmt(data.total), unit: "tokens", note: data.pending ? "等待本轮用量回执" : `${data.rounds.length} 次请求已返回用量`, mini: data.rounds.map(round => <i key={round.id} style={{ height: `${Math.min(100, Math.max(8, (round.input + round.output) / mockRoundMaximum * 100))}%` }} />) },
    { key: "context" as const, icon: Layers3, value: percent === null ? "—" : `${percent.toFixed(1)}%`, unit: "窗口占用", note: context ? `${fmt(context.total)} / ${fmt(context.limit)} · 演示估算` : "等待首次模型请求", mini: <i style={{ width: `${percent ?? 0}%` }} /> },
    { key: "memory" as const, icon: Database, value: data.memories ? `${data.loaded.size} / ${data.memories.length}` : "—", unit: "已读 / 已保存", note: data.memories ? "本轮只读 · 无记忆写入" : "等待记忆库快照", mini: data.memories?.map(memory => <i className={data.loaded.has(memory.id) ? "is-lit" : ""} key={memory.id} />) },
    { key: "capabilities" as const, icon: Library, value: data.catalogue ? `${data.skillCount} · ${data.serverCount} · ${data.toolCount}` : "—", unit: "Skill / MCP / 本地工具", note: `${data.loadedSkills} 个 Skill 已加载 · ${data.calls} 次工具执行`, mini: <><i className="is-lit" /><i className={data.loadedSkills ? "is-lit" : ""} /><i className={data.calls ? "is-lit" : ""} /></> },
  ];
  const evidence = events.filter(event => expanded === "usage" ? event.name === "model.response.completed"
    : expanded === "context" ? event.name === "model.request"
    : expanded === "memory" ? event.name.startsWith("memory.")
    : expanded === "prompts" ? event.node === "input" || event.node === "prompt"
    : event.name === "capabilities.snapshot" || event.name === "skill.reference.loaded" || event.name === "PermissionRequest");
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (expanded && !panel.open) panel.showModal();
    else if (!expanded && panel.open) panel.close();
  }, [expanded]);
  useEffect(() => {
    if (expanded !== "memory" || session.provider !== "codex" || !session.isReal) {
      setMemoryFiles(null);
      setMemoryFilesLoading(false);
      return;
    }
    const controller = new AbortController();
    setMemoryFiles(null);
    setMemoryFilesLoading(true);
    fetch(`/api/real/codex-memory?${new URLSearchParams({ sessionId: session.id })}`, { cache: "no-store", signal: controller.signal })
      .then(response => response.ok ? response.json() as Promise<{ files: MemoryFilePreview[] }> : Promise.reject(new Error("Memory files unavailable")))
      .then(result => setMemoryFiles(result.files))
      .catch(error => { if (error.name !== "AbortError") setMemoryFiles([]); })
      .finally(() => { if (!controller.signal.aborted) setMemoryFilesLoading(false); });
    return () => controller.abort();
  }, [expanded, session.id, session.isReal, session.provider]);
  if (session.isReal) {
    const rollout = session.rolloutTelemetry;
    const hasRolloutTelemetry = Boolean(session.capabilities?.rolloutTelemetry);
    const total = rollout?.turnUsage?.totalTokens !== null && rollout?.turnUsage?.totalTokens !== undefined
      ? fmt(rollout.turnUsage.totalTokens)
      : session.usage.inputTokens !== null && session.usage.outputTokens !== null
        ? fmt(session.usage.inputTokens + session.usage.outputTokens) : "未采集";
    const contextTokens = rollout?.latestRequest?.inputTokens ?? null;
    const contextWindow = rollout?.contextWindowTokens ?? null;
    const contextPercent = contextTokens !== null && contextWindow
      ? Math.min(100, contextTokens / contextWindow * 100)
      : null;
    const promptMetadataOnly = session.provider === "claude";
    const traces = session.capabilities?.promptTelemetry && !promptMetadataOnly ? promptTraces(logs, session.id, session.turnId, session.provider) : [];
    const observedPrompts = session.capabilities?.promptTelemetry ? (promptMetadataOnly ? promptObservations(logs, session.id, session.turnId, session.provider) : traces) : [];
    const processingCount = observedPrompts.filter(trace => trace.status === "processing").length;
    const receivedCount = observedPrompts.filter(trace => trace.status === "received").length;
    const memoryMetadata = rollout?.memoryMetadata ?? null;
    const contextMetadata = rollout?.contextMetadata ?? null;
    const promptMetadata = rollout?.promptMetadata ?? null;
    const modelRequestCount = rollout?.modelRequestCount ?? (session.provider === "claude" ? null : session.rounds.length);
    const inputUsage = rollout?.turnUsage;
    const hasInputBreakdown = [inputUsage?.nativeInputTokens, inputUsage?.cacheCreationInputTokens, inputUsage?.cacheReadInputTokens]
      .some((value) => value !== null && value !== undefined);
    const requestSamples = rollout?.requests ?? [];
    const requestUsage = requestSamples.length
      ? requestSamples.map((request, index) => ({
        id: `request-${index + 1}`,
        requestNumber: Math.max(0, (modelRequestCount ?? requestSamples.length) - requestSamples.length) + index + 1,
        ...request,
      }))
      : session.rounds.map((round, index) => ({ ...round, requestNumber: index + 1 }));
    const observedUsageRounds = requestUsage.filter((round): round is typeof round & { inputTokens: number; outputTokens: number } => isObservedTokenCount(round.inputTokens) && isObservedTokenCount(round.outputTokens));
    const observedUsageMaximum = Math.max(...observedUsageRounds.map(round => round.inputTokens + round.outputTokens), 1);
    const usageNote = requestUsage.length
      ? observedUsageRounds.length === requestUsage.length
        ? modelRequestCount !== null && modelRequestCount > requestUsage.length
          ? `最近 ${requestUsage.length} / ${modelRequestCount} 次有用量`
          : `${observedUsageRounds.length} 次请求已返回用量`
        : `最近 ${requestUsage.length} 条中 ${observedUsageRounds.length} 条有完整用量`
      : hasRolloutTelemetry ? `${modelRequestCount ?? "未采集"} 次模型响应` : "当前 Agent 未提供模型用量回执";
    const resourceCards = [
      { key: "usage" as const, icon: Zap, value: hasRolloutTelemetry ? total : "未采集", unit: "tokens", note: usageNote, mini: observedUsageRounds.length
        ? observedUsageRounds.map(round => <i key={round.id} style={{ height: `${Math.min(100, Math.max(8, (round.inputTokens + round.outputTokens) / observedUsageMaximum * 100))}%` }} />)
        : <i className="is-unknown" /> },
      { key: "context" as const, icon: Layers3, value: contextPercent === null ? (contextTokens === null ? "未采集" : fmt(contextTokens)) : `${contextPercent.toFixed(1)}%`, unit: contextPercent === null ? "最近请求 tokens" : "窗口占用", note: contextMetadata?.instructionFileCount !== null && contextMetadata?.instructionFileCount !== undefined ? `${contextMetadata.instructionFileCount} 条规则快照文件 · Claude transcript` : contextTokens !== null && contextWindow ? `${fmt(contextTokens)} / ${fmt(contextWindow)} tokens · 最近请求` : contextTokens !== null ? `${fmt(contextTokens)} tokens · 窗口容量未采集` : `${events.filter(event => event.node === "context").length} 条上下文事件 · 容量未采集`, mini: contextPercent === null ? <i className="is-unknown" /> : <i style={{ width: `${contextPercent}%` }} /> },
      { key: "memory" as const, icon: Database, value: memoryMetadata?.status === "present" ? `${memoryMetadata.fileCount}` : "未采集", unit: memoryMetadata?.globalFileCount !== undefined ? "全局 + 项目 memory 文件" : "当前项目 memory 文件", note: memoryMetadata?.status === "present" ? `${fmt(memoryMetadata.totalBytes)} bytes · 仅文件元数据` : memoryMetadata?.status === "missing" ? (memoryMetadata.globalFileCount !== undefined ? "未发现全局或项目 memory 文件" : "当前项目未发现 memory 目录") : "未采集 memory 文件元数据", mini: memoryMetadata?.status === "present" ? <><i className="is-lit" /><i className={memoryMetadata.fileCount > 1 ? "is-lit" : ""} /><i className={memoryMetadata.fileCount > 2 ? "is-lit" : ""} /></> : <i className="is-unknown" /> },
      { key: "capabilities" as const, icon: Library, value: `${events.filter(event => event.node === "skill").length} · ${session.calls.filter(call => call.type === "mcp").length} · ${session.calls.filter(call => call.type === "local").length}`, unit: "Skill / MCP / 本地工具", note: `${session.calls.length} 次已观测工具调用 · 不代表完整能力目录`, mini: <><i className={events.some(event => event.node === "skill") ? "is-lit" : ""} /><i className={session.calls.some(call => call.type === "mcp") ? "is-lit" : ""} /><i className={session.calls.some(call => call.type === "local") ? "is-lit" : ""} /></> },
    ];
    const liveEvidence = expanded === "usage" ? events.filter(event => event.roundId || /model/i.test(event.name))
      : expanded === "context" ? events.filter(event => event.node === "context")
        : expanded === "capabilities" ? events.filter(event => ["tool", "mcp", "search", "gate", "hook", "skill"].includes(event.node))
          : expanded === "prompts" ? events.filter(event => event.node === "input") : [];
    return <section className="rr" aria-label="本回合资源概览">
      <header className="rr-heading"><span><Activity size={13} /> 本回合资源 <small>先看摘要，点击展开</small><button id={`${id}-prompts`} className="rr-prompt-link" aria-expanded={expanded === "prompts"} aria-controls={`${id}-panel`} onClick={() => setExpanded(expanded === "prompts" ? null : "prompts")}><MessageSquareText size={13} />提示词监控 <b>{session.capabilities?.promptTelemetry ? observedPrompts.length : "未采集"}</b></button></span><span className="rr-mock">LIVE · {(session.provider ?? "AGENT").toUpperCase()}</span></header>
      <ResourceCards cards={resourceCards} expanded={expanded} id={id} onToggle={key => setExpanded(expanded === key ? null : key)} />
      <dialog ref={panelRef} className="rr-panel" id={`${id}-panel`} aria-labelledby={`${id}-${expanded ?? "usage"}-title`}
        onClose={() => setExpanded(null)} onClick={event => { if (event.target === event.currentTarget) panelRef.current?.close(); }}>
        {expanded && <><header><div><span className="rr-kicker">LIVE RESOURCE INSPECTOR</span><h3 id={`${id}-${expanded}-title`}>{labels[expanded]}</h3></div><button className="rr-close" aria-label="收起资源详情" onClick={() => panelRef.current?.close()}><X size={16} /></button></header>
          <p className="rr-lead">数据来源：{expanded === "memory" && session.provider === "codex" ? "本机 Codex 记忆文件" : hasRolloutTelemetry && (expanded === "usage" || expanded === "context") ? "本机运行时 telemetry 与生命周期事件" : "本机生命周期事件"}。未观测到的字段保留为“未采集”。</p>
          {expanded === "usage" && <>
            <div className="rr-metrics"><div><span>本轮输入 token</span><strong>{fmt(session.usage.inputTokens)}</strong></div><div><span>本轮输出 token</span><strong>{fmt(session.usage.outputTokens)}</strong></div><div><span>缓存输入 token</span><strong>{fmt(session.usage.cachedInputTokens)}</strong></div><div><span>推理 token</span><strong>{fmt(rollout?.turnUsage?.reasoningTokens ?? null)}</strong></div></div>
            {hasInputBreakdown && <div className="rr-metrics"><div><span>原生输入</span><strong>{fmt(inputUsage?.nativeInputTokens ?? null)}</strong></div><div><span>创建缓存</span><strong>{fmt(inputUsage?.cacheCreationInputTokens ?? null)}</strong></div><div><span>读取缓存</span><strong>{fmt(inputUsage?.cacheReadInputTokens ?? null)}</strong></div></div>}
            <p className="rr-explain">推理强度：{session.reasoningEffort}。{hasInputBreakdown ? "输入合计包含原生输入、创建缓存和读取缓存。" : hasRolloutTelemetry ? "用量来自本机回合回执；缓存输入是输入 token 的子集。" : "当前数据源未提供模型用量回执，未知值不会按 0 展示。"}</p>
            <div className="rr-subhead"><strong>逐次模型请求</strong><span>{requestUsage.length ? modelRequestCount !== null && modelRequestCount > requestUsage.length ? `最近 ${requestUsage.length} / ${modelRequestCount} 次 · ${observedUsageRounds.length} 条有完整用量` : `${observedUsageRounds.length} / ${requestUsage.length} 条有完整用量` : modelRequestCount !== null ? `${modelRequestCount} 次响应 · 无逐次明细` : "逐次用量未采集"}</span></div>
            {observedUsageRounds.length ? <>
              <div className="rr-rounds">{observedUsageRounds.map((round, index) => {
                const cached = isObservedTokenCount(round.cachedInputTokens) && round.cachedInputTokens <= round.inputTokens ? round.cachedInputTokens : null;
                return <div key={round.id}><span>请求 {round.requestNumber ?? index + 1}</span><div className="rr-round-track" role="img" aria-label={`请求 ${round.requestNumber ?? index + 1}：输入 ${fmt(round.inputTokens)} tokens，输出 ${fmt(round.outputTokens)} tokens`}><i style={{ width: `${(round.inputTokens - (cached ?? 0)) / observedUsageMaximum * 100}%` }} /><i className="rr-cache" style={{ width: `${(cached ?? 0) / observedUsageMaximum * 100}%` }} /><i className="rr-output" style={{ width: `${round.outputTokens / observedUsageMaximum * 100}%` }} /></div><span>{fmt(round.inputTokens)} 入 / {fmt(round.outputTokens)} 出</span></div>;
              })}</div>
              <div className="rr-legend"><span><i />非缓存输入</span><span><i className="rr-cache" />缓存输入</span><span><i className="rr-output" />输出</span></div>
            </> : <p className="rr-empty">当前数据源没有返回逐次 Token 明细；上方只展示可验证的回合累计，用量不会被拆分估算。</p>}
          </>}
          {expanded === "context" && <>{contextPercent !== null ? <><div className="rr-subhead"><strong>最近一次模型请求</strong><span>{fmt(contextTokens)} / {fmt(contextWindow)} tokens · {contextPercent.toFixed(1)}%</span></div><div className="rr-context-track" role="img" aria-label={`上下文窗口占用 ${contextPercent.toFixed(1)}%，${fmt(contextTokens)} / ${fmt(contextWindow)} tokens`}><i style={{ width: `${contextPercent}%`, background: colors.context }} /></div><p className="rr-explain">占用量和窗口容量来自本机运行时回执。</p></> : contextTokens !== null ? <p className="rr-explain">最近一次模型请求已采集 <b>{fmt(contextTokens)} tokens</b>；上下文窗口容量未采集，不能据此计算占用百分比。</p> : <p className="rr-explain">已采集 {events.filter(event => event.node === "context").length} 条上下文相关事件；最近请求 token 数和上下文窗口容量尚未采集。</p>}{contextMetadata && <p className="rr-explain">规则快照文件：<b>{contextMetadata.instructionFileCount === null ? "未采集" : `${contextMetadata.instructionFileCount} 条`}</b> · 来源 Claude transcript · {contextMetadata.observedAt ? new Date(contextMetadata.observedAt).toLocaleString("zh-CN", { hour12: false }) : "时间未采集"}。仅统计条目数，不读取文件路径或正文。</p>}</>}
          {expanded === "memory" && <>
            {session.provider === "codex" ? <>
              <p className="rr-lead">已保存 <b>{memoryFiles?.length ?? memoryMetadata?.fileCount ?? "—"} 个文件</b>，本轮已读取 <b>未采集</b>。文件存在只代表已保存，不能据此判断它是否进入模型上下文。</p>
              <p className="rr-explain">下面展示本机 Codex 全局与当前项目的 Markdown 记忆文件；正文按需加载，未采集本轮记忆读取记录。</p>
              <div className="rr-memories">{memoryFilesLoading ? <p className="rr-empty">正在读取记忆文件…</p> : memoryFiles?.length ? memoryFiles.map(file => <article key={`${file.scope}-${file.name}`}>
                <header><strong>{file.name}</strong><span>文件存在</span></header>
                <div className="rr-tags"><span>{file.scope === "global" ? "全局" : "当前项目"}</span><span>Markdown</span><span>更新 {new Date(file.updatedAt).toLocaleString("zh-CN", { hour12: false })}</span></div>
                <p>{file.content}{file.truncated ? "\n\n…（文件过大，已截断预览）" : ""}</p>
                <details><summary>来源与使用位置</summary><code>{file.scope === "global" ? `全局记忆 / ${file.name}` : `当前项目记忆 / ${file.name}`}</code><p>文件已保存；本轮是否读取或带入上下文未采集。</p></details>
              </article>) : <p className="rr-empty">没有可展示的 Markdown 记忆文件。</p>}</div>
            </> : <>{memoryMetadata?.status === "present" ? <div className="rr-prompt-list"><article><header><span className="rr-prompt-state is-completed">文件存在</span><time>{memoryMetadata.latestModifiedAt ? new Date(memoryMetadata.latestModifiedAt).toLocaleString("zh-CN", { hour12: false }) : "更新时间未采集"}</time></header><small>当前项目 {memoryMetadata.fileCount} 个 memory 文件 / {fmt(memoryMetadata.totalBytes)} bytes · 仅读取文件元数据，未读取内容。</small></article></div> : <p className="rr-explain">{memoryMetadata?.status === "missing" ? "当前项目未发现 memory 目录。" : "未采集当前项目 memory 文件元数据。"} 无法判断记忆是否已加载或写入。</p>}</>}
          </>}
          {expanded === "prompts" && <>
            <div className="rr-prompt-status"><div><span>已观测提交</span><strong>{observedPrompts.length}</strong></div><div><span>处理中</span><strong>{processingCount}</strong></div><div><span>等待后续事件</span><strong>{receivedCount}</strong></div><div><span>实际排队深度</span><strong>未观测</strong></div></div>
            <p className="rr-explain">状态由本机提示词、工具执行和最终回复事件推导。当前数据源没有提供独立的排队 / 出队信号；“等待后续事件”表示暂未看到执行事件，不等同于已确认进入队列。</p>
            {promptMetadata && <p className="rr-explain">提示词快照：系统段 {promptMetadata.systemSegmentCount === null ? "未采集" : `${promptMetadata.systemSegmentCount} 段`} · 工具定义 {promptMetadata.toolDefinitionCount === null ? "未采集" : `${promptMetadata.toolDefinitionCount} 条`} · 来源 Claude transcript · {promptMetadata.observedAt ? new Date(promptMetadata.observedAt).toLocaleString("zh-CN", { hour12: false }) : "时间未采集"}。不读取或展示提示词正文。</p>}
            <div className="rr-prompt-list">{observedPrompts.map(trace => <article key={trace.id}>
              <header><span className={`rr-prompt-state is-${trace.status}`}>{trace.status === "completed" ? "已完成" : trace.status === "processing" ? "处理中" : "已接收"}</span><time>{new Date(trace.timestamp).toLocaleString("zh-CN", { hour12: false })}</time></header>
              {!promptMetadataOnly && <p>{(trace as typeof traces[number]).prompt}</p>}<small>回合 {trace.turnId.slice(0, 12)} · 依据 {trace.evidence}{promptMetadataOnly ? " · 未读取或展示提示词正文" : ""}</small>
            </article>)}{!observedPrompts.length && <p className="rr-empty">当前会话尚未观测到提示词提交事件。</p>}</div>
          </>}
          {expanded === "capabilities" && <div className="rr-capabilities">{(["skill", "mcp", "tool", "hook", "gate"] as const).map((node, index) => <button key={node} onClick={event => onInspect(node, event.currentTarget)} style={{ "--rr-accent": detailColors[index] } as CSSProperties}><span>{node.toUpperCase()}<ArrowUpRight size={13} /></span><strong>{events.filter(item => item.node === node).length} 条事件</strong><small>{node === "tool" || node === "mcp" ? `${session.calls.filter(call => node === "mcp" ? call.type === "mcp" : call.type === "local").length} 次关联调用` : "仅计入已观测记录"}</small></button>)}</div>}
      <details className="rr-evidence" open><summary>事件依据 <span>{liveEvidence.length} 条</span></summary>{expanded === "prompts" ? <p className="rr-explain">提示词面板仅以 UserPromptSubmit、后续工具/权限事件与 Stop 的生命周期关系为依据，不渲染原始事件正文。</p> : liveEvidence.map(event => <MockEventCard key={event.id} event={event} onCorrelate={onCorrelate} />)}{!liveEvidence.length && expanded !== "prompts" && <p className="rr-empty">没有采集到相关事件。</p>}</details>
        </>}
      </dialog>
    </section>;
  }
  return <section className="rr" aria-label="本回合资源概览">
    <header className="rr-heading"><span><Activity size={13} /> 本回合资源 <small>先看摘要，点击展开</small><button id={`${id}-prompts`} className="rr-prompt-link" aria-expanded={expanded === "prompts"} aria-controls={`${id}-panel`} onClick={() => setExpanded(expanded === "prompts" ? null : "prompts")}><MessageSquareText size={13} />提示词监控 <b>模拟</b></button></span><span className="rr-mock">MOCK · 随事件回放</span></header>
    <ResourceCards cards={cards} expanded={expanded} id={id} onToggle={key => setExpanded(expanded === key ? null : key)} />
    <dialog ref={panelRef} className="rr-panel" id={`${id}-panel`} aria-labelledby={`${id}-${expanded ?? "usage"}-title`}
      onClose={() => setExpanded(null)} onClick={event => { if (event.target === event.currentTarget) panelRef.current?.close(); }}>
      {expanded && <>
      <header><div><span className="rr-kicker">RESOURCE INSPECTOR</span><h3 id={`${id}-${expanded}-title`}>{labels[expanded]}</h3></div><button className="rr-close" aria-label="收起资源详情" onClick={() => panelRef.current?.close()}><X size={16} /></button></header>
      {expanded === "usage" && <>
        <p className="rr-lead">本回合累计 <b>{fmt(data.total)} tokens</b>。每次模型返回用量后更新；正在生成的请求尚未计入。</p>
        <div className="rr-metrics"><div><span>输入 · 包含缓存</span><strong>{data.rounds.length ? fmt(data.input) : "—"}</strong></div><div><span>输出</span><strong>{data.rounds.length ? fmt(data.output) : "—"}</strong></div><div><span>输入中命中缓存</span><strong>{fmt(data.cached)}</strong></div><div><span>费用 / 推理 token</span><strong>未提供</strong></div></div>
        <p className="rr-explain">缓存属于输入的一部分，不再加到总量里。演示模型未配置价格，也未提供独立推理 token，不能计算这些值。</p>
        <div className="rr-subhead"><strong>逐次模型请求</strong><span>{data.pending ? `${data.pending} 次等待用量` : "统计已结算"}</span></div>
        <div className="rr-rounds">{data.rounds.map((round, index) => <div key={round.id}><span>请求 {index + 1}</span><div className="rr-round-track" aria-hidden="true"><i style={{ width: `${(round.input - (round.cached ?? 0)) / 4000 * 100}%` }} /><i className="rr-cache" style={{ width: `${(round.cached ?? 0) / 4000 * 100}%` }} /><i className="rr-output" style={{ width: `${round.output / 4000 * 100}%` }} /></div><span>{fmt(round.input)} 入 / {fmt(round.output)} 出</span></div>)}</div>
        {!data.rounds.length && <p className="rr-empty">尚无模型用量回执，等待事件到达。</p>}
        <div className="rr-legend"><span><i />非缓存输入</span><span><i className="rr-cache" />缓存输入</span><span><i className="rr-output" />输出</span></div>
        <footer>更新依据：model.response.completed {data.lastUsage && `· 最近 ${data.lastUsage}`} · 所有数值为模拟回执</footer>
      </>}
      {expanded === "context" && <>
        <p className="rr-lead">模型这一次请求带着什么？<b>{context ? `${fmt(context.total)} tokens` : "尚未发送请求"}</b>。这是最近一次输入的组成，与上方累计用量分开统计。</p>
        {context && <>
          <div className="rr-subhead"><strong>{context.roundId} · 发送时快照</strong><span>{percent!.toFixed(1)}% · 演示窗口 32K</span></div>
          <div className="rr-context-track" role="img" aria-label={`上下文占用 ${percent!.toFixed(1)}%，${fmt(context.total)} / ${fmt(context.limit)} tokens`}>{context.segments.map((segment, index) => <i key={segment.id} style={{ width: `${segment.tokens / context.limit * 100}%`, background: detailColors[index % detailColors.length] }} />)}</div>
          <div className="rr-context-list">{context.segments.map((segment, index) => <div key={segment.id}><i style={{ background: detailColors[index % detailColors.length] }} /><span>{segment.label}</span><strong>{fmt(segment.tokens)}</strong><small>tokens</small></div>)}</div>
          <p className="rr-explain">剩余窗口 {fmt(context.limit - context.total)} tokens · 本轮未压缩。分类分配与 32K 容量均为原型示例，不代表实际 Codex 配置；工具结果只有回传并进入请求后才计入。</p>
        </>}
        <button className="rr-link" onClick={event => onInspect("context", event.currentTarget)}>查看上下文准备链路 <ArrowUpRight size={13} /></button>
      </>}
      {expanded === "memory" && <>
        <p className="rr-lead">已保存 <b>{data.memories?.length ?? "—"} 条</b>，本轮已读取 <b>{data.memories ? data.loaded.size : "—"} 条</b>。保存进记忆库的内容，只有带入请求后才会占用模型上下文。</p>
        <p className="rr-explain">以下是虚构记忆库的交互示例，未读取或写入工作区的真实记忆文件。本轮无记忆写入，也未发生历史压缩。</p>
        <div className="rr-memories">{data.memories?.map(memory => <article key={memory.id}>
          <header><strong>{memory.title}</strong><span className={data.loaded.has(memory.id) ? "is-loaded" : ""}>{data.loaded.has(memory.id) ? "本轮已读" : "尚未读取"}</span></header>
          <div className="rr-tags"><span>{memory.scope}</span><span>{memory.mode}</span><span>更新 {memory.updatedAt}</span></div>
          <p>{memory.content}</p><details><summary>来源与使用位置</summary><code>{memory.source}</code><p>{context?.memoryIds.includes(memory.id) ? `已带入最近的 ${context.roundId} 请求` : data.loaded.has(memory.id) ? "已读取，等待下次模型请求带入" : "保存在演示库中，未带入当前请求"}</p></details>
        </article>)}</div>
        {!data.memories && <p className="rr-empty">尚未收到记忆库快照；不能将其解释为没有记忆。</p>}
      </>}
      {expanded === "prompts" && <>
        <p className="rr-lead">这是一个可回放的 <b>MOCK 提示词监控</b>，仅用于原型演示，不表示存在真实提示词队列或实际排队深度。</p>
        <div className="rr-prompt-status"><div><span>模拟输入事件</span><strong>{events.filter(event => event.node === "input").length}</strong></div><div><span>模拟提示词编排</span><strong>{events.filter(event => event.node === "prompt").length}</strong></div><div><span>队列深度</span><strong>模拟</strong></div><div><span>正文采集</span><strong>关闭</strong></div></div>
        <p className="rr-explain">事件依据来自演示回放中的用户输入和提示词编排节点；为避免把原型当作真实观测，不展示提示词正文，也不声称采集到了独立排队事件。</p>
      </>}
      {expanded === "capabilities" && <>
        <p className="rr-lead">先发现可用能力，再按需加载或执行。<b>Skill 是指南，MCP 是连接服务，工具才执行动作。</b> Hook 与门禁负责生命周期和权限。</p>
        <div className="rr-capabilities">{([
          ["skill", "Skill · 操作指南", `${fmt(data.skillCount)} 个可用 / ${data.loadedSkills} 个已加载`, "目录不等于全文进入上下文；本轮只加载页面检查指南。"],
          ["mcp", "MCP · 服务连接", `${fmt(data.serverCount)} 个服务`, "documentation 提供文档检索，browser 提供页面检查。"],
          ["tool", "工具 · 执行动作", `${fmt(data.toolCount)} 种本地工具 / ${data.calls} 次执行`, "调用次数包含 MCP 工具与失败尝试；工具结果随后回传模型。"],
          ["hook", "Hook · 生命周期", `${data.hooks} 类事件已观测`, "会话启动、工具前后与回合结束可挂接处理。"],
          ["gate", "门禁 · 权限检查", `${data.approvals} 次请求用户确认`, "策略允许、等待用户与单次批准分别记录。"],
        ] as const).map(([node, title, value, note], index) => <button key={node} onClick={event => onInspect(node, event.currentTarget)} style={{ "--rr-accent": detailColors[index] } as CSSProperties}><span>{title}<ArrowUpRight size={13} /></span><strong>{value}</strong><small>{data.catalogue ? note : "等待能力发现事件；点击可查看完整模拟场景。"}</small></button>)}</div>
      </>}
      <details className="rr-evidence" key={expanded}><summary>事件依据 <span>{evidence.length} 条 · 展示最近 3 条</span></summary>{evidence.slice(-3).map(event => <MockEventCard key={event.id} event={event} onCorrelate={onCorrelate} />)}{!evidence.length && <p className="rr-empty">等待对应事件。</p>}</details>
      </>}
    </dialog>
  </section>;
}
