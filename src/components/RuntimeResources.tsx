import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { Activity, ArrowUpRight, ChevronDown, Database, Layers3, Library, MessageSquareText, X, Zap } from "lucide-react";
import type { MockNodeId, MockRuntimeEvent, MockRuntimeSession } from "./codexRuntimeMock";
import { MockEventCard } from "./CodexMockDetails";
import { runtimeResources } from "./runtimeResourcesModel";
import { promptTraces } from "./promptQueueModel";
import type { LogEntry } from "../types/matrix";
import "./RuntimeResources.css";

type Resource = "usage" | "context" | "memory" | "capabilities" | "prompts";
const labels: Record<Resource, string> = { usage: "Token 用量", context: "当前上下文", memory: "记忆", capabilities: "能力与控制", prompts: "提示词监控" };
const colors = ["#83dce7", "#e5c98b", "#9dacf5", "#8ed9b9", "#d2a3ef", "#6791ad"];
const fmt = (n: number | null) => n === null ? "—" : n.toLocaleString("en-US");

export function RuntimeResources({ events, logs, session, onInspect, onCorrelate }: {
  events: MockRuntimeEvent[];
  logs: LogEntry[];
  session: MockRuntimeSession;
  onInspect: (node: MockNodeId, source: HTMLButtonElement) => void;
  onCorrelate: (callId: string) => void;
}) {
  const [expanded, setExpanded] = useState<Resource | null>(null);
  const panelRef = useRef<HTMLDialogElement>(null);
  const id = useId();
  const data = useMemo(() => runtimeResources(events), [events]);
  const context = data.context;
  const percent = context ? context.total / context.limit * 100 : null;
  const cards = [
    { key: "usage" as const, icon: Zap, value: fmt(data.total), unit: "tokens", note: data.pending ? "等待本轮用量回执" : `${data.rounds.length} 次请求已返回用量`, accent: colors[0] },
    { key: "context" as const, icon: Layers3, value: percent === null ? "—" : `${percent.toFixed(1)}%`, unit: "窗口占用", note: context ? `${fmt(context.total)} / ${fmt(context.limit)} · 演示估算` : "等待首次模型请求", accent: colors[2] },
    { key: "memory" as const, icon: Database, value: data.memories ? `${data.loaded.size} / ${data.memories.length}` : "—", unit: "已读 / 已保存", note: data.memories ? "本轮只读 · 无记忆写入" : "等待记忆库快照", accent: colors[3] },
    { key: "capabilities" as const, icon: Library, value: data.catalogue ? `${data.skillCount} · ${data.serverCount} · ${data.toolCount}` : "—", unit: "Skill / MCP / 本地工具", note: `${data.loadedSkills} 个 Skill 已加载 · ${data.calls} 次工具执行`, accent: colors[1] },
  ];
  const evidence = events.filter(event => expanded === "usage" ? event.name === "model.response.completed"
    : expanded === "context" ? event.name === "model.request"
    : expanded === "memory" ? event.name.startsWith("memory.")
    : event.name === "capabilities.snapshot" || event.name === "skill.reference.loaded" || event.name === "PermissionRequest");
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (expanded && !panel.open) panel.showModal();
    else if (!expanded && panel.open) panel.close();
  }, [expanded]);
  if (session.isReal) {
    const rollout = session.rolloutTelemetry;
    const total = rollout?.turnUsage?.totalTokens !== null && rollout?.turnUsage?.totalTokens !== undefined
      ? fmt(rollout.turnUsage.totalTokens)
      : session.usage.inputTokens !== null && session.usage.outputTokens !== null
        ? fmt(session.usage.inputTokens + session.usage.outputTokens) : "未采集";
    const contextTokens = rollout?.latestRequest?.inputTokens ?? null;
    const contextWindow = rollout?.contextWindowTokens ?? null;
    const contextPercent = contextTokens !== null && contextWindow
      ? Math.min(100, contextTokens / contextWindow * 100)
      : null;
    const traces = promptTraces(logs, session.id);
    const processingCount = traces.filter(trace => trace.status === "processing").length;
    const receivedCount = traces.filter(trace => trace.status === "received").length;
    const resourceCards = [
      { key: "usage" as const, icon: Zap, value: total, unit: "本轮 tokens", note: `${rollout?.modelRequestCount ?? session.rounds.length} 次模型响应` },
      { key: "context" as const, icon: Layers3, value: contextPercent === null ? "—" : `${contextPercent.toFixed(1)}%`, unit: "窗口占用", note: contextTokens !== null && contextWindow ? `${fmt(contextTokens)} / ${fmt(contextWindow)} tokens · 最近请求` : `${events.filter(event => event.node === "context").length} 条上下文事件 · 容量未采集` },
      { key: "memory" as const, icon: Database, value: "未采集", unit: "记忆", note: "当前数据源未提供记忆快照" },
      { key: "capabilities" as const, icon: Library, value: `${session.calls.length}`, unit: "已观测调用", note: "按真实调用事件统计" },
      { key: "prompts" as const, icon: MessageSquareText, value: `${traces.length}`, unit: "条提示词记录", note: `${receivedCount} 已接收 · ${processingCount} 处理中 · 排队深度未观测` },
    ];
    const liveEvidence = expanded === "usage" ? events.filter(event => event.roundId || /model/i.test(event.name))
      : expanded === "context" ? events.filter(event => event.node === "context")
        : expanded === "capabilities" ? events.filter(event => ["tool", "mcp", "search", "gate", "hook", "skill"].includes(event.node))
          : expanded === "prompts" ? events.filter(event => event.node === "input") : [];
    return <section className="rr" aria-label="本回合资源概览">
      <header className="rr-heading"><span><Activity size={13} /> 本回合资源 <small>仅显示已采集字段</small></span><span className="rr-mock">LIVE · CODEX</span></header>
      <div className="rr-cards rr-cards-live">{resourceCards.map(({ key, icon: Icon, value, unit, note }, index) => <button key={key} id={`${id}-${key}`} className={`rr-card ${expanded === key ? "is-open" : ""}`}
        style={{ "--rr-accent": colors[index] } as CSSProperties} aria-expanded={expanded === key} aria-controls={`${id}-panel`}
        onClick={() => setExpanded(expanded === key ? null : key)}>
        <span className="rr-card-label"><Icon size={15} />{labels[key]}<ChevronDown size={13} /></span>
        <strong>{value}<small>{unit}</small></strong><span className="rr-note">{note}</span>
      </button>)}</div>
      <dialog ref={panelRef} className="rr-panel" id={`${id}-panel`} aria-labelledby={`${id}-${expanded ?? "usage"}`}
        onClose={() => setExpanded(null)} onClick={event => { if (event.target === event.currentTarget) panelRef.current?.close(); }}>
        {expanded && <><header><div><span className="rr-kicker">LIVE RESOURCE INSPECTOR</span><h3 id={`${id}-${expanded}`}>{labels[expanded]}</h3></div><button className="rr-close" aria-label="收起资源详情" onClick={() => panelRef.current?.close()}><X size={16} /></button></header>
          <p className="rr-lead">数据来源：{expanded === "usage" || expanded === "context" ? "本机 Codex rollout 回执与 Hook / app-server 事件" : "本机 Codex Hook / app-server 事件"}。未观测到的字段保留为“未采集”。</p>
          {expanded === "usage" && <><div className="rr-metrics"><div><span>本轮输入 token</span><strong>{fmt(session.usage.inputTokens)}</strong></div><div><span>本轮输出 token</span><strong>{fmt(session.usage.outputTokens)}</strong></div><div><span>缓存输入 token</span><strong>{fmt(session.usage.cachedInputTokens)}</strong></div><div><span>推理 token</span><strong>{fmt(rollout?.turnUsage?.reasoningTokens ?? null)}</strong></div></div><p className="rr-explain">推理强度：{session.reasoningEffort}。用量来自本机 Codex 回合回执；缓存输入是输入 token 的子集。</p></>}
          {expanded === "context" && <>{contextPercent !== null ? <><div className="rr-subhead"><strong>最近一次模型请求</strong><span>{fmt(contextTokens)} / {fmt(contextWindow)} tokens · {contextPercent.toFixed(1)}%</span></div><div className="rr-context-track" role="img" aria-label={`上下文窗口占用 ${contextPercent.toFixed(1)}%，${fmt(contextTokens)} / ${fmt(contextWindow)} tokens`}><i style={{ width: `${contextPercent}%`, background: colors[2] }} /></div><p className="rr-explain">占用量和窗口容量来自 Codex 本机回执。系统指令、对话、工具结果等内容分段及记忆快照未由当前数据源提供。</p></> : <p className="rr-explain">已采集 {events.filter(event => event.node === "context").length} 条上下文相关事件；最近请求 token 数和上下文窗口容量尚未采集。</p>}</>}
          {expanded === "memory" && <p className="rr-explain">未采集到记忆快照，无法据此判断记忆是否存在或是否写入。</p>}
          {expanded === "prompts" && <>
            <div className="rr-prompt-status"><div><span>已接收</span><strong>{traces.length}</strong></div><div><span>处理中</span><strong>{processingCount}</strong></div><div><span>等待后续事件</span><strong>{receivedCount}</strong></div><div><span>实际排队深度</span><strong>未观测</strong></div></div>
            <p className="rr-explain">状态由本机 Codex 提示词、工具执行和最终回复事件推导。当前数据源没有提供独立的排队 / 出队信号；“等待后续事件”表示暂未看到执行事件，不等同于已确认进入队列。</p>
            <div className="rr-prompt-list">{traces.map(trace => <article key={trace.id}>
              <header><span className={`rr-prompt-state is-${trace.status}`}>{trace.status === "completed" ? "已完成" : trace.status === "processing" ? "处理中" : "已接收"}</span><time>{new Date(trace.timestamp).toLocaleString("zh-CN", { hour12: false })}</time></header>
              <p>{trace.prompt}</p><small>回合 {trace.turnId.slice(0, 12)} · 依据 {trace.evidence}</small>
            </article>)}{!traces.length && <p className="rr-empty">当前会话尚未观测到提示词提交事件。</p>}</div>
          </>}
          {expanded === "capabilities" && <div className="rr-capabilities">{(["skill", "mcp", "tool", "hook", "gate"] as const).map((node, index) => <button key={node} onClick={event => onInspect(node, event.currentTarget)} style={{ "--rr-accent": colors[index] } as CSSProperties}><span>{node.toUpperCase()}<ArrowUpRight size={13} /></span><strong>{events.filter(item => item.node === node).length} 条事件</strong><small>{node === "tool" || node === "mcp" ? `${session.calls.filter(call => node === "mcp" ? call.type === "mcp" : call.type === "local").length} 次关联调用` : "仅计入已观测记录"}</small></button>)}</div>}
          <details className="rr-evidence" open><summary>事件依据 <span>{liveEvidence.length} 条</span></summary>{liveEvidence.map(event => <MockEventCard key={event.id} event={event} onCorrelate={onCorrelate} />)}{!liveEvidence.length && <p className="rr-empty">没有采集到相关事件。</p>}</details>
        </>}
      </dialog>
    </section>;
  }
  return <section className="rr" aria-label="本回合资源概览">
    <header className="rr-heading"><span><Activity size={13} /> 本回合资源 <small>先看摘要，点击展开</small></span><span className="rr-mock">MOCK · 随事件回放</span></header>
      <div className="rr-cards">
      {cards.map(({ key, icon: Icon, value, unit, note, accent }) => <button key={key} id={`${id}-${key}`} className={`rr-card ${expanded === key ? "is-open" : ""}`}
        style={{ "--rr-accent": accent } as CSSProperties} aria-expanded={expanded === key} aria-controls={`${id}-panel`}
        onClick={() => setExpanded(expanded === key ? null : key)}>
        <span className="rr-card-label"><Icon size={15} />{labels[key]}<ChevronDown size={13} /></span>
        <strong>{value}<small>{unit}</small></strong>
        <span className="rr-mini" aria-hidden="true">{key === "usage" ? data.rounds.map(round => <i key={round.id} style={{ height: `${Math.max(8, (round.input + round.output) / 4000 * 100)}%` }} />)
          : key === "context" ? <i style={{ width: `${percent ?? 0}%` }} />
          : key === "memory" ? data.memories?.map(memory => <i className={data.loaded.has(memory.id) ? "is-lit" : ""} key={memory.id} />)
          : <><i className="is-lit" /><i className={data.loadedSkills ? "is-lit" : ""} /><i className={data.calls ? "is-lit" : ""} /></>}</span>
        <span className="rr-note">{note}</span>
      </button>)}
    </div>
    <dialog ref={panelRef} className="rr-panel" id={`${id}-panel`} aria-labelledby={`${id}-${expanded ?? "usage"}`}
      onClose={() => setExpanded(null)} onClick={event => { if (event.target === event.currentTarget) panelRef.current?.close(); }}>
      {expanded && <>
      <header><div><span className="rr-kicker">RESOURCE INSPECTOR</span><h3 id={`${id}-${expanded}`}>{labels[expanded]}</h3></div><button className="rr-close" aria-label="收起资源详情" onClick={() => panelRef.current?.close()}><X size={16} /></button></header>
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
          <div className="rr-context-track" role="img" aria-label={`上下文占用 ${percent!.toFixed(1)}%，${fmt(context.total)} / ${fmt(context.limit)} tokens`}>{context.segments.map((segment, index) => <i key={segment.id} style={{ width: `${segment.tokens / context.limit * 100}%`, background: colors[index] }} />)}</div>
          <div className="rr-context-list">{context.segments.map((segment, index) => <div key={segment.id}><i style={{ background: colors[index] }} /><span>{segment.label}</span><strong>{fmt(segment.tokens)}</strong><small>tokens</small></div>)}</div>
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
      {expanded === "capabilities" && <>
        <p className="rr-lead">先发现可用能力，再按需加载或执行。<b>Skill 是指南，MCP 是连接服务，工具才执行动作。</b> Hook 与门禁负责生命周期和权限。</p>
        <div className="rr-capabilities">{([
          ["skill", "Skill · 操作指南", `${fmt(data.skillCount)} 个可用 / ${data.loadedSkills} 个已加载`, "目录不等于全文进入上下文；本轮只加载页面检查指南。"],
          ["mcp", "MCP · 服务连接", `${fmt(data.serverCount)} 个服务`, "documentation 提供文档检索，browser 提供页面检查。"],
          ["tool", "工具 · 执行动作", `${fmt(data.toolCount)} 种本地工具 / ${data.calls} 次执行`, "调用次数包含 MCP 工具与失败尝试；工具结果随后回传模型。"],
          ["hook", "Hook · 生命周期", `${data.hooks} 类事件已观测`, "会话启动、工具前后与回合结束可挂接处理。"],
          ["gate", "门禁 · 权限检查", `${data.approvals} 次请求用户确认`, "策略允许、等待用户与单次批准分别记录。"],
        ] as const).map(([node, title, value, note], index) => <button key={node} onClick={event => onInspect(node, event.currentTarget)} style={{ "--rr-accent": colors[index] } as CSSProperties}><span>{title}<ArrowUpRight size={13} /></span><strong>{value}</strong><small>{data.catalogue ? note : "等待能力发现事件；点击可查看完整模拟场景。"}</small></button>)}</div>
      </>}
      <details className="rr-evidence" key={expanded}><summary>事件依据 <span>{evidence.length} 条 · 展示最近 3 条</span></summary>{evidence.slice(-3).map(event => <MockEventCard key={event.id} event={event} onCorrelate={onCorrelate} />)}{!evidence.length && <p className="rr-empty">等待对应事件。</p>}</details>
      </>}
    </dialog>
  </section>;
}
