import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCheck,
  ChevronRight,
  CircleDot,
  Layers3,
  ListTree,
  LockKeyhole,
  MessageSquare,
  Network,
  Pause,
  Play,
  PlugZap,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Terminal,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import "./CodexSessionPrototype.css";
import { RuntimeParticles } from "./RuntimeParticles";
import { RuntimeTelemetry } from "./RuntimeTelemetry";
import { RuntimeLeafTopology, type LeafPreviewAnchor } from "./RuntimeLeafTopology";
import { RuntimeResources } from "./RuntimeResources";
import { runtimeFlow } from "./runtimeFlow";
import type { RuntimeLeaf } from "./runtimeLeafModel";
import type { LogEntry, RealSystemStatus, WsConnectionState } from "../types/matrix";
import { createCodexRuntimeSessionFromLogs, latestObservedCodexEvent } from "./codexRuntimeAdapter";
import { codexCoreStatus } from "./codexCoreStatus";
import type { CodexRolloutTelemetry } from "../types/codexTelemetry";
import "./RuntimeObservatory.css";
import {
  createCodexRuntimeMock,
  MOCK_USER_PROMPT,
  mockEventsForNode,
  mockEventsForCall,
  type MockRuntimeEvent,
} from "./codexRuntimeMock";
import {
  CodexMockDetails,
  MockEventCard,
  downloadMockSession,
  statusLabels,
  ModelIdentity,
} from "./CodexMockDetails";

type Kind =
  | "input"
  | "context"
  | "prompt"
  | "skill"
  | "mcp"
  | "hook"
  | "tool"
  | "search"
  | "gate"
  | "model"
  | "result";
type StepId =
  | "input"
  | "context"
  | "prompt"
  | "skill"
  | "mcp"
  | "hook"
  | "tool"
  | "search"
  | "gate"
  | "model"
  | "output";
type Step = {
  id: StepId;
  title: string;
  kicker: string;
  subtitle: string;
  explanation: string;
  icon: React.ElementType;
};

const kinds: Record<Kind, { label: string; icon: React.ElementType }> = {
  input: { label: "用户输入", icon: MessageSquare },
  context: { label: "上下文", icon: Layers3 },
  prompt: { label: "提示词", icon: Sparkles },
  skill: { label: "Skill", icon: BookOpen },
  mcp: { label: "MCP", icon: Network },
  hook: { label: "Hook", icon: Zap },
  tool: { label: "工具", icon: Terminal },
  search: { label: "搜索", icon: Search },
  gate: { label: "门禁", icon: ShieldCheck },
  model: { label: "模型响应", icon: Activity },
  result: { label: "最终结果", icon: CheckCheck },
};

const steps: Step[] = [
  {
    id: "input",
    title: "用户输入",
    kicker: "01 · USER INPUT",
    subtitle: "从输入框开始一个新的回合",
    explanation:
      "用户在 Codex 输入框提交自然语言任务。这里是可见链路的起点，原始文本会被保留并关联到本次 session 与 turn。",
    icon: MessageSquare,
  },
  {
    id: "context",
    title: "上下文组装",
    kicker: "02 · CONTEXT",
    subtitle: "工作区、历史与当前回合",
    explanation:
      "运行时把工作目录、会话历史、当前文件状态和可用能力整理成模型可用的上下文。页面只展示可解释的摘要，不泄露隐藏推理。",
    icon: Layers3,
  },
  {
    id: "prompt",
    title: "提示词编排",
    kicker: "PROMPT · MESSAGES",
    subtitle: "指令、用户消息与工具定义",
    explanation:
      "模型请求包含指令、用户消息、历史上下文和可用工具定义。这里展示这些信息的组合关系；原型不声称采集到了完整系统提示词或模型内部推理。",
    icon: Sparkles,
  },
  {
    id: "skill",
    title: "Skill 能力加载",
    kicker: "SKILL · ON DEMAND",
    subtitle: "匹配任务所需的方法与规范",
    explanation:
      "Skill 是可复用的工作指南。需要时，Agent 会读取 SKILL.md 和相关资料，再依据其中的规范使用工具。它不是每个回合都会运行的独立执行阶段。",
    icon: BookOpen,
  },
  {
    id: "mcp",
    title: "MCP 连接器",
    kicker: "MCP · EXTERNAL TOOLS",
    subtitle: "通过服务调用外部能力",
    explanation:
      "MCP 为 Agent 提供外部工具定义。模型选择其中一个工具后，经权限检查调用对应服务，再把结果返回模型。MCP 与本地工具是可选的执行路径，可在一个回合中分别调用。",
    icon: Network,
  },
  {
    id: "hook",
    title: "Hook 观测层",
    kicker: "HOOK · OBSERVABILITY",
    subtitle: "记录进入、执行与退出事件",
    explanation:
      "Hook 是按配置触发的生命周期回调，可以执行检查或收集事件。本项目把可用的 Hook 事件转发到本地网关，并与 app-server 记录关联。PreToolUse、PostToolUse 等围绕工具发生，不是每次都必经的独立业务步骤；触发顺序以实际配置与运行时为准。",
    icon: PlugZap,
  },
  {
    id: "tool",
    title: "工具执行",
    kicker: "TOOLS · EXECUTION",
    subtitle: "命令、文件读取与本地操作",
    explanation:
      "模型发出工具调用，运行时执行命令或文件操作，并将输出和退出状态返回。rg 是命令内容，exec_command 才是本示例中的工具名称。",
    icon: Terminal,
  },
  {
    id: "gate",
    title: "权限门禁",
    kicker: "POLICY · BEFORE EXECUTION",
    subtitle: "执行前判断权限与策略",
    explanation:
      "工具执行前，运行时依据当前沙箱和审批策略判断是否允许。需要确认时才请求用户；拒绝后返回拒绝结果。本地读操作也受策略约束，具体决策取决于实际配置。",
    icon: ShieldCheck,
  },
  {
    id: "output",
    title: "模型响应与结果",
    kicker: "09 · MODEL → USER",
    subtitle: "汇总上下文、工具与事件后返回",
    explanation:
      "模型使用上下文和工具结果生成可见回答。最终结果会回到用户界面，并保留本轮的可追溯链路。",
    icon: CheckCheck,
  },
];

const modelStep: Step = {
  id: "model",
  title: "模型调用循环",
  kicker: "MODEL · AGENT LOOP",
  subtitle: "接收消息 → 生成响应或工具调用",
  icon: Activity,
  explanation:
    "模型接收当前消息、上下文和可用工具定义，返回可见响应或工具调用请求。工具结果会追加回消息，再次进入模型；这个循环可以重复多次，也可以直接结束。",
};
const searchStep: Step = {
  id: "search",
  title: "搜索",
  kicker: "SEARCH · CAPABILITY",
  subtitle: "本地代码 / 外部资料 / 网页搜索",
  icon: Search,
  explanation:
    "搜索是一种用途，不是固定的运行时阶段。本地代码搜索可通过 exec_command 运行 rg；外部资料可通过 MCP 获取，也可能使用托管网页搜索。具体方式由本轮任务和可用能力决定。",
};
const nodes = [
  ...steps.slice(0, 3),
  modelStep,
  ...steps.slice(3, 7),
  searchStep,
  ...steps.slice(7),
];

function Tag({ kind }: { kind: Kind }) {
  const { label, icon: Icon } = kinds[kind];
  return (
    <span className={`cp-tag cp-tag-${kind}`}>
      <Icon size={11} />
      {label}
    </span>
  );
}

function GraphNode({
  id,
  className = "",
  stateClass,
  children,
  onSelect,
}: {
  id: StepId;
  className?: string;
  stateClass: string;
  children?: React.ReactNode;
  onSelect: (id: StepId, source?: HTMLButtonElement) => void;
}) {
  const step = nodes.find((node) => node.id === id)!;
  const Icon = step.icon;
  return (
    <button
      aria-label={`查看${step.title}`}
      data-runtime-node={id}
      className={`rt-node rt-${id} ${className} ${stateClass}`}
      onClick={(event) => onSelect(id, event.currentTarget)}
    >
      <span className="rt-node-top">
        <span className="rt-icon">
          <Icon size={20} />
        </span>
        <span className="rt-node-code">{id.toUpperCase()}</span>
        <ChevronRight size={13} />
      </span>
      <strong>{step.title}</strong>
      <span className="rt-node-summary">{step.subtitle}</span>
      {children}
    </button>
  );
}

export function CodexSessionPrototype({
  logs = [],
  connectionState = "simulation",
  realStatus,
  prototypeMode = false,
}: {
  logs?: LogEntry[];
  connectionState?: WsConnectionState;
  realStatus?: RealSystemStatus | null;
  prototypeMode?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const [selected, setSelected] = useState<StepId | null>(() => {
    const candidate = new URLSearchParams(window.location.search).get("node");
    return nodes.some((node) => node.id === candidate)
      ? (candidate as StepId)
      : null;
  });
  const [playing, setPlaying] = useState(true);
  const [replaying, setReplaying] = useState(false);
  const [progress, setProgress] = useState(Infinity);
  const [draft, setDraft] = useState(MOCK_USER_PROMPT);
  const [submitted, setSubmitted] = useState(MOCK_USER_PROMPT);
  const observedLiveSession = useMemo(() => createCodexRuntimeSessionFromLogs(logs), [logs]);
  const [rolloutTelemetry, setRolloutTelemetry] = useState<CodexRolloutTelemetry | null>(null);
  useEffect(() => {
    if (!observedLiveSession) {
      setRolloutTelemetry(null);
      return;
    }
    const sessionId = observedLiveSession.id;
    const turnId = observedLiveSession.turnId;
    let active = true;
    let pending = false;
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try {
        const query = new URLSearchParams({ sessionId, turnId });
        const response = await fetch(`/api/real/codex-rollout?${query}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Rollout telemetry unavailable");
        const result = await response.json() as { telemetry: CodexRolloutTelemetry | null };
        if (active) setRolloutTelemetry(result.telemetry);
      } catch {
        if (active) setRolloutTelemetry(null);
      } finally {
        pending = false;
      }
    };
    setRolloutTelemetry(null);
    void refresh();
    const timer = window.setInterval(refresh, 4000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [observedLiveSession?.id, observedLiveSession?.turnId]);
  const liveTelemetry = rolloutTelemetry?.sessionId === observedLiveSession?.id && rolloutTelemetry?.turnId === observedLiveSession?.turnId
    ? rolloutTelemetry
    : null;
  const liveSession = useMemo(() => createCodexRuntimeSessionFromLogs(logs, liveTelemetry), [logs, liveTelemetry]);
  const demoSession = useMemo(() => createCodexRuntimeMock(submitted), [submitted]);
  const session = liveSession || demoSession;
  const liveMode = Boolean(liveSession);
  const modelRequestCount = liveSession?.rolloutTelemetry?.modelRequestCount ?? session.rounds.length;
  const latestObservedEvent = useMemo(() => liveSession ? latestObservedCodexEvent(liveSession, logs) : undefined, [liveSession, logs]);
  const [statusClock, setStatusClock] = useState(() => Date.now());
  useEffect(() => {
    if (!liveMode) return;
    const timer = window.setInterval(() => setStatusClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [liveMode]);
  const coreStatus = useMemo(() => codexCoreStatus({
    logs,
    sessionId: session.id,
    turnId: session.turnId,
    connectionState,
    realStatus,
    telemetry: liveSession?.rolloutTelemetry,
    now: statusClock,
  }), [logs, session.id, session.turnId, connectionState, realStatus, liveSession?.rolloutTelemetry, statusClock]);
  const observedLocalCalls = session.calls.filter(call => call.type === "local").length;
  const observedMcpCalls = session.calls.filter(call => call.type === "mcp").length;
  const observedPermissions = session.events.filter(event => event.node === "gate").length;
  const observedSkills = [...new Set(session.events.filter(event => event.node === "skill").map(event => event.title))];
  const observedMcpServers = [...new Set(session.calls.filter(call => call.type === "mcp").map(call => call.name.split("/")[0]))];
  const observedLocalTools = [...new Set(session.calls.filter(call => call.type === "local").map(call => call.name))];
  const observedSearches = session.events.filter(event => event.node === "search");
  const observedHookStarts = session.events.filter(event => /PreToolUse|BeforeTool/i.test(event.name)).length;
  const observedHookFinishes = session.events.filter(event => /PostToolUse/i.test(event.name)).length;
  const [detailTab, setDetailTab] = useState<"story" | "evidence" | "events">(
    "evidence",
  );
  const [eventQuery, setEventQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<Kind | "all">("all");
  const [showAll, setShowAll] = useState(false);
  const [callFilter, setCallFilter] = useState<string | null>(null);
  const [focusedEvent, setFocusedEvent] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<LeafPreviewAnchor | null>(null);
  const previewTimers = useRef<{ open?: number; close?: number }>({});
  const previewSource = useRef<HTMLElement | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const closeButton = useRef<HTMLButtonElement | null>(null);
  const drawer = useRef<HTMLElement | null>(null);
  const mapRef = useRef<HTMLElement | null>(null);
  const activeStep = nodes.find((step) => step.id === selected);
  const currentEvent = replaying ? session.events[progress - 1] : undefined;
  const flowEvent = replaying ? currentEvent : liveMode ? latestObservedEvent : undefined;
  const arrivalFlow = runtimeFlow(flowEvent);
  const activeFlowNode = arrivalFlow?.from ?? flowEvent?.node;
  const arrivalNode = flowEvent
    ? arrivalFlow?.to ?? (["running", "waiting", "failed"].includes(flowEvent.status) ? flowEvent.node : undefined)
    : undefined;
  const currentStage = !currentEvent ? undefined : currentEvent.node === "input" ? "input"
    : ["context", "prompt", "skill"].includes(currentEvent.node) ? "context"
    : currentEvent.node === "output" ? "output" : "model";
  const replayGap = (session.events[progress]?.offsetMs ?? 0) - (currentEvent?.offsetMs ?? 0);
  const eventDuration = replaying
    ? Math.min(1500, Math.max(420, replayGap))
    : liveMode ? 1500 : 900;
  const visibleEvents = session.events.slice(0, progress);
  const filteredEvents = visibleEvents.filter(
    (event) =>
      (kindFilter === "all" ||
        event.kind === kindFilter ||
        (kindFilter === "search" && event.relatedNodes.includes("search"))) &&
      (!eventQuery ||
        [event.title, event.name, event.summary, event.callId, event.roundId]
          .join(" ")
          .toLowerCase()
          .includes(eventQuery.toLowerCase())),
  );
  const nodeEvents = selected
    ? mockEventsForNode(session, selected).filter((event) =>
        visibleEvents.includes(event),
      )
    : [];
  const detailEvents = callFilter
    ? mockEventsForCall(session, callFilter).filter((event) =>
        visibleEvents.includes(event),
      )
    : nodeEvents;
  const orderedDetailEvents = focusedEvent
    ? [
        ...detailEvents.filter((event) => event.id === focusedEvent),
        ...detailEvents.filter((event) => event.id !== focusedEvent),
      ]
    : detailEvents;
  useEffect(() => {
    if (!playing || !replaying) return;
    if (progress >= session.events.length) {
      setReplaying(false);
      return;
    }
    const gap =
      session.events[progress].offsetMs -
      (session.events[progress - 1]?.offsetMs || 0);
    const timer = window.setTimeout(
      () => setProgress((value) => value + 1),
      Math.min(1500, Math.max(420, gap)),
    );
    return () => window.clearTimeout(timer);
  }, [playing, progress, replaying, session]);
  useEffect(() => {
    if (selected) closeButton.current?.focus();
    else opener.current?.focus();
  }, [selected]);
  useEffect(() => {
    drawer.current?.querySelector(".cp-detail-content")?.scrollTo({ top: 0 });
  }, [selected, detailTab]);
  const detailOpen = Boolean(selected);
  useEffect(() => {
    if (!detailOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [detailOpen]);
  const select = (id: StepId, source?: HTMLButtonElement) => {
    window.clearTimeout(previewTimers.current.open);
    window.clearTimeout(previewTimers.current.close);
    previewSource.current = null;
    setHoveredNode(null);
    if (source) opener.current = source;
    setSelected(id);
    setDetailTab("evidence");
    setCallFilter(null);
    setFocusedEvent(null);
  };
  const close = () => {
    setSelected(null);
  };
  const state = (index: number) =>
    currentEvent?.node === nodes[index]?.id ? "running" : "done";
  const startReplay = () => {
    if (!draft.trim()) return;
    setSubmitted(draft.trim());
    setProgress(0);
    setReplaying(true);
    setPlaying(true);
    setShowAll(false);
    setEventQuery("");
    setKindFilter("all");
  };
  const graphState = (id: StepId) =>
    [
      selected === id ? "is-selected" : "",
      currentEvent?.node === id || (!replaying && activeFlowNode === id) ? "is-active" : "",
      activeFlowNode === id ? "is-flow-source" : "",
      arrivalNode === id ? "is-flow-target" : "",
      arrivalNode === id && flowEvent?.status === "waiting" ? "is-flow-warning" : "",
      arrivalNode === id && flowEvent?.status === "failed" ? "is-flow-error" : "",
    ].join(" ");
  const correlate = (callId: string) => {
    setCallFilter(callId);
    setFocusedEvent(null);
    setDetailTab("events");
    drawer.current?.querySelector(".cp-detail-content")?.scrollTo({ top: 0 });
  };
  const openEvent = (event: MockRuntimeEvent, source: HTMLButtonElement) => {
    select(event.node, source);
    setFocusedEvent(event.id);
    setDetailTab("events");
  };
  const keepPreview = () => {
    window.clearTimeout(previewTimers.current.close);
  };
  const closePreview = () => {
    window.clearTimeout(previewTimers.current.open);
    window.clearTimeout(previewTimers.current.close);
    previewSource.current = null;
    setHoveredNode(null);
  };
  const leavePreview = () => {
    window.clearTimeout(previewTimers.current.open);
    window.clearTimeout(previewTimers.current.close);
    previewTimers.current.close = window.setTimeout(closePreview, 220);
  };
  const updateHoveredNode = (target: Element | null) => {
    const source = target?.closest<HTMLElement>('[data-runtime-node]');
    if (!source || selected) return;
    const rawId = source.dataset.runtimeNode;
    const id = rawId === "result" ? "hook" : rawId;
    if (!id || !nodes.some(node => node.id === id)) return;
    keepPreview();
    if (source === previewSource.current && hoveredNode) return;
    window.clearTimeout(previewTimers.current.open);
    previewTimers.current.open = window.setTimeout(() => {
      const rect = source.getBoundingClientRect();
      previewSource.current = source;
      setHoveredNode({ id: id as StepId, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom });
    }, 180);
  };
  const inspectLeaf = (leaf: RuntimeLeaf) => {
    if (!hoveredNode) return;
    select(hoveredNode.id, previewSource.current?.matches("button") ? previewSource.current as HTMLButtonElement : undefined);
    setCallFilter(leaf.callId ?? null);
    setFocusedEvent(leaf.eventId ?? null);
    setDetailTab("events");
    closePreview();
  };
  useEffect(() => {
    const dismiss = () => {
      window.clearTimeout(previewTimers.current.open);
      window.clearTimeout(previewTimers.current.close);
      previewSource.current = null;
      setHoveredNode(null);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") dismiss(); };
    const scroll = (event: Event) => {
      if (!(event.target instanceof Element) || !event.target.closest(".runtime-leaf-preview")) dismiss();
    };
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", dismiss);
    window.addEventListener("keydown", escape);
    return () => {
      window.clearTimeout(previewTimers.current.open);
      window.clearTimeout(previewTimers.current.close);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("keydown", escape);
    };
  }, []);

  return (
    <div
      className={`cp-app cp-runtime-prototype ${playing ? "rt-motion-on" : "rt-motion-off"}`}
    >
      <header className="cp-header" inert={Boolean(selected)}>
        <a href="/" className="cp-brand">
          <span className="cp-brand-icon">
            <Workflow size={20} />
          </span>
          <strong>Agent Matrix</strong>
          <span className="cp-brand-divider" />
          <span className="cp-brand-section">Codex Runtime</span>
        </a>
        <div className="cp-header-right">
          <a className="cp-real-link" href={prototypeMode ? '/codex' : '/codex/prototype'}>
            {prototypeMode ? '对比实时页面' : '查看模拟原型'} <ArrowRight size={12} />
          </a>
          <a className="cp-real-link cp-3d-link" href={prototypeMode ? '/codex/prototype/3d' : '/codex/3d'}>
            3D 拓扑 <Sparkles size={12} />
          </a>
          <span className={`cp-prototype ${liveMode ? "is-live" : ""}`}>
            <span />
            {liveMode ? "RUNTIME TRACE · LIVE" : "RUNTIME TRACE · PROTOTYPE"}
          </span>
          <a className="cp-real-link" href="/codex/runtime">
            打开真实监测 <ArrowRight size={12} />
          </a>
        </div>
      </header>
      <div className="cp-shell" inert={Boolean(selected)}>
        <aside className="cp-sidebar">
          <div className="cp-workspace">
            <span className="cp-project-icon">
              <Activity size={17} />
            </span>
            <div>
              <strong>Codex Runtime</strong>
              <span>session / turn / events</span>
            </div>
          </div>
          <div className="cp-side-label">
            当前会话 <span className="cp-mono">{session.id}</span>
          </div>
          <div className="rt-session-card">
            <span className="rt-session-dot" /> {liveMode ? "LIVE SESSION" : "DEMO SESSION"}
            <strong>{liveMode ? "真实 Codex 事件流" : "一个输入，完整运行轨迹"}</strong>
            <span>{liveMode ? `${session.events.length} 条已采集事件 · ${session.calls.length} 次调用` : "5 轮模型 · 1 次审批 · 1 次重试"}</span>
            <div>
              <span>
                TURN <b>{session.turnId.slice(-8)}</b>
              </span>
              <span>
                CALLS <b>{session.calls.length.toString().padStart(2, "0")}</b>
              </span>
            </div>
          </div>
          <div className="cp-side-label cp-plan-label">
            探索运行时 <span>{nodes.length} 个节点</span>
          </div>
          <nav className="cp-step-nav" aria-label="运行时步骤">
            {nodes.map((step, index) => {
              const Icon = step.icon;
              return (
                <button
                  key={step.id}
                  className={`${selected === step.id ? "active" : ""} ${state(index)}`}
                  onClick={(event) => select(step.id, event.currentTarget)}
                >
                  <Icon size={14} />
                  <span>{step.title}</span>
                  <ChevronRight size={13} />
                </button>
              );
            })}
          </nav>
          <div className="cp-side-bottom">
            <div className="rt-channel-list">
              <span><small>本地工具</small><b>{liveMode ? String(observedLocalCalls).padStart(2, "0") : "03"}</b><i /></span>
              <span><small>MCP 调用</small><b>{liveMode ? String(observedMcpCalls).padStart(2, "0") : "03"}</b><i /></span>
              <span><small>权限确认</small><b>{liveMode ? String(observedPermissions).padStart(2, "0") : "01"}</b><i /></span>
            </div>
            <div>
              <span className="cp-tiny-dot" />
              {liveMode ? "真实可观测 session" : "可观测 session"}
            </div>
            <p>
              先看运行时全景，再点开任意事件。
              <br />
              {liveMode ? "内容来自本机 Codex Hook / app-server。" : "所有内容均为原型示例。"}
            </p>
            <div className="cp-sidebar-key">
              <LockKeyhole size={12} />
              不展示隐藏推理与凭据
            </div>
          </div>
        </aside>
        <main className="cp-main">
          <div className="cp-breadcrumb">
            <ListTree size={13} />
            Codex <ChevronRight size={12} />
            <span>Runtime trace</span>
            <span className="cp-mono">/ {session.id}{realStatus?.cwd ? ` · ${realStatus.cwd}` : ""}</span>
          </div>
          <section className="cp-page-heading">
            <div>
              <div className="cp-eyebrow">
                <span />
                AGENT MATRIX / RUNTIME OBSERVATORY
              </div>
              <h1>
                Agent Runtime<span>运行观测站</span>
              </h1>
              <p>沿着一次输入，看清上下文、模型决策、工具执行与结果回流。</p>
            </div>
            <div className="rt-controls">
              <button className="rt-replay" onClick={startReplay}>
                <Play size={13} />
                回放链路
              </button>
              <button
                className="rt-motion"
                aria-label={
                  playing
                    ? replaying
                      ? "暂停回放与光效"
                      : "暂停光流"
                    : replaying
                      ? "继续回放与光效"
                      : "开启光流"
                }
                onClick={() => setPlaying(!playing)}
              >
                {playing ? <Pause size={15} /> : <Play size={15} />}
              </button>
            </div>
          </section>
          <div className="cp-runtime-status">
            <span className="cp-session-status">
              <span />
              {liveMode ? "实时会话 · LIVE" : "完整模拟会话 · MOCK"}
            </span>
            <span className="cp-runtime-pill">
              <Activity size={12} /> {session.turnId}
            </span>
            <span className="cp-runtime-pill">
              <Zap size={12} /> AGENT LOOP
            </span>
            <span className="cp-runtime-pill">
              <CircleDot size={12} /> {connectionState === "connected" ? "GATEWAY LIVE" : liveMode ? "HISTORY" : "SIMULATION"}
            </span>
            <span className="cp-runtime-hint">
              <i />
              消息流 <i />
              工具循环 <i />
              事件观测
            </span>
          </div>
          <nav className="rt-journey" aria-label="会话执行主线">
            {([
              ["input", "01", "用户输入", "任务进入会话"],
              ["context", "02", "上下文准备", "消息 · 规则 · 能力定义"],
              ["model", "03", "Agent 执行循环", "模型 ↔ 门禁 ↔ 工具"],
              ["output", "04", "返回结果", "回答与可追溯证据"],
            ] as const).map(([id, index, title, note]) => (
              <button key={id} onClick={event => select(id, event.currentTarget)}
                className={id === currentStage ? "is-current" : ""}>
                <span>{index}</span><div><strong>{title}</strong><small>{note}</small></div><ChevronRight size={13} />
              </button>
            ))}
          </nav>
          <ModelIdentity session={session} />
          <RuntimeResources events={visibleEvents} logs={logs} session={session} onInspect={(node, source) => select(node, source)} onCorrelate={correlate} />
          <section
            className="rt-map"
            ref={mapRef}
            aria-label="Codex runtime 完整链路"
            onMouseOver={(event) => updateHoveredNode(event.target as Element)}
            onFocusCapture={(event) => updateHoveredNode(event.target as Element)}
            onMouseLeave={leavePreview}
            onMouseOut={event => {
              const next = event.relatedTarget as Element | null;
              if (!next?.closest?.('[data-runtime-node], .runtime-leaf-preview')) leavePreview();
            }}
            onBlurCapture={event => {
              const next = event.relatedTarget as Element | null;
              if (!next?.closest?.('[data-runtime-node], .runtime-leaf-preview')) leavePreview();
            }}
            onKeyDown={event => {
              if (event.key === "ArrowDown" && hoveredNode && (event.target as HTMLElement).matches('[data-runtime-node]')) {
                event.preventDefault();
                document.querySelector<HTMLButtonElement>(".rlp-leaf")?.focus();
              }
            }}
          >
            <RuntimeParticles
              host={mapRef}
              playing={playing}
              activeEvent={flowEvent}
              eventDuration={eventDuration}
              replaying={replaying}
              liveMode={liveMode}
            />
            <div className="rt-map-bar">
              <span>
                <CircleDot size={12} /> SESSION TOPOLOGY <b>运行全景</b>
              </span>
              <span>
                {replaying
                  ? `${Math.min(progress, session.events.length)} / ${session.events.length} · ${currentEvent?.title || "开始回放"}`
                  : "悬浮展开内部条目 · 点击查看执行详情"}{" "}
                <span className="rt-blink" />
              </span>
            </div>
            {hoveredNode && !selected && (
              <RuntimeLeafTopology
                key={hoveredNode.id}
                anchor={hoveredNode}
                session={session}
                events={visibleEvents}
                playing={playing}
                onKeep={keepPreview}
                onLeave={leavePreview}
                onClose={closePreview}
                onInspect={inspectLeaf}
              />
            )}
            <div className="rt-composer-row">
              <form
                className={`rt-composer ${graphState("input")}`}
                data-runtime-node="input"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (draft.trim()) startReplay();
                }}
              >
                <div className="rt-composer-label">
                  <MessageSquare size={15} />
                  <span>用户输入</span>
                  <button
                    type="button"
                    aria-label="查看用户输入"
                    onClick={(event) => select("input", event.currentTarget)}
                  >
                    <ChevronRight size={14} />
                  </button>
                  <small>01 / INPUT</small>
                </div>
                <textarea
                  aria-label={liveMode ? "最近捕获的用户输入" : "演示任务输入"}
                  value={liveMode ? session.prompt : draft}
                  readOnly={liveMode}
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength={1200}
                  rows={2}
                />
                <div className="rt-composer-footer">
                  <span>
                    <LockKeyhole size={10} />
                    {liveMode ? "Codex 输入事件 · 只读展示" : "固定 mock 剧本 · 不执行真实任务"}
                  </span>
                  {!liveMode && <button disabled={!draft.trim()} type="submit">
                    发送演示 <Send size={12} />
                  </button>}
                </div>
              </form>
              <span className="rt-horizontal-beam">
                <i />
                <ArrowRight size={14} />
              </span>
              <GraphNode
                id="context"
                onSelect={select}
                stateClass={graphState("context")}
              >
                <span className="rt-mini-tags">
                  {liveMode ? <>
                    <span>{session.events.filter(event => event.node === "context").length} 条上下文事件</span>
                    <span>{session.cwd === "未采集" ? "工作区未采集" : "工作区已采集"}</span>
                    <span>规则文件未采集</span>
                  </> : <><span>会话历史</span><span>工作区</span><span>项目规则</span></>}
                </span>
              </GraphNode>
              <span className="rt-horizontal-beam">
                <i />
                <ArrowRight size={14} />
              </span>
              <GraphNode
                id="prompt"
                onSelect={select}
                stateClass={graphState("prompt")}
              >
                <span className="rt-mini-tags">
                  {liveMode ? <><span>用户消息已采集</span><span>完整提示词未采集</span></> : <><span>用户消息</span><span>指令与工具定义</span></>}
                </span>
              </GraphNode>
            </div>
            <div className="rt-bridge-row">
              <span />
              <span>
                消息与上下文 <ArrowDown size={12} />
              </span>
            </div>
            <div className="rt-engine-grid">
              <svg
                className="rt-call-path"
                viewBox="0 0 1000 440"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  <marker
                    id="rt-flow-arrow"
                    markerWidth="6"
                    markerHeight="6"
                    refX="5"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0,0 L6,3 L0,6" fill="none" stroke="#7bd8c5" />
                  </marker>
                </defs>
                <path
                  d="M535 158 H557 Q570 158 570 145 V85 Q570 72 583 72 H602"
                  markerEnd="url(#rt-flow-arrow)"
                />
                <path
                  className="rt-call-light"
                  d="M535 158 H557 Q570 158 570 145 V85 Q570 72 583 72 H602"
                />
                <path
                  d="M840 414 V428 Q840 438 830 438 H581 Q568 438 568 425 V240 Q568 227 555 227 H535"
                  markerEnd="url(#rt-flow-arrow)"
                />
                <path
                  className="rt-feedback-light"
                  d="M840 414 V428 Q840 438 830 438 H581 Q568 438 568 425 V240 Q568 227 555 227 H535"
                />
              </svg>
              <div className="rt-support-lane">
                <div className="rt-lane-label">
                  ON DEMAND <span>按需载入</span>
                </div>
                <GraphNode
                  id="skill"
                  onSelect={select}
                  stateClass={graphState("skill")}
                >
                  <span className="rt-support-note">
                    {liveMode ? (observedSkills.length ? observedSkills.join(" · ") : "未观测到 Skill 激活") : "browser-inspection → 加入上下文"}
                  </span>
                  <span className="rt-mini-tags">
                    {liveMode ? <><span>{observedSkills.length} 个 Skill 事件</span><span>正文未采集</span></> : <><span>SKILL.md</span><span>参考资料</span></>}
                  </span>
                </GraphNode>
                <div className="rt-support-explainer">
                  <BookOpen size={13} />
                  <p>
                    Skill 提供方法与规范，
                    <br />
                    需要时才读取。
                  </p>
                </div>
                <div className="rt-signal-key">
                  <span />
                  <p>
                    能力定义与运行时
                    <br />
                    保持关联
                  </p>
                </div>
              </div>
              <div className="rt-model-lane">
                <button
                  className={`rt-model ${graphState("model")}`}
                  data-core-state={coreStatus.state}
                  data-runtime-node="model"
                  aria-label={`查看模型调用循环，${coreStatus.label}。${coreStatus.detail}`}
                  title={`${coreStatus.label}：${coreStatus.detail}`}
                  onClick={(event) => select("model", event.currentTarget)}
                >
                  <span className="rt-model-orbit rt-orbit-one" />
                  <span className="rt-model-orbit rt-orbit-two" />
                  <span className="rt-model-orbit rt-orbit-three" />
                  <span className="rt-model-dots" />
                  <svg className="rt-core-reticle" viewBox="0 0 300 300" aria-hidden="true">
                    <circle cx="150" cy="150" r="143" />
                    <path d="M150 0v15M150 285v15M0 150h15M285 150h15M42 42l10 10M248 248l10 10M42 258l10-10M248 52l10-10" />
                    <circle cx="150" cy="150" r="117" strokeDasharray="2 11" />
                  </svg>
                  <span className="rt-core-coordinate rt-coordinate-top">MODEL / 01</span>
                  <span className="rt-core-coordinate rt-coordinate-bottom">CONTEXT → RESPONSE</span>
                  <span className="rt-model-center">
                    <Activity size={32} />
                    <strong>CODEX</strong>
                    <small>{coreStatus.label}</small>
                  </span>
                  <span className={`rt-model-caption is-${coreStatus.state}`} role="status" aria-live="polite">
                    <span className="rt-core-status-dot" />{coreStatus.state === "normal"
                      ? liveMode ? `${modelRequestCount} 次模型请求 · ${session.calls.length} 次调用` : "5 轮请求 · 6 次工具调用"
                      : coreStatus.label}
                  </span>
                </button>
                <div className="rt-model-decision">
                  <span>
                    生成工具调用 <ArrowRight size={13} />
                  </span>
                  <span>
                    或直接回答 <ArrowDown size={13} />
                  </span>
                </div>
                <button
                  className={`rt-output ${graphState("output")}`}
                  data-runtime-node="output"
                  aria-label="查看模型响应与结果"
                  onClick={(event) => select("output", event.currentTarget)}
                >
                  <CheckCheck size={20} />
                  <span>
                    <strong>返回用户</strong>
                    <small>完整回答 · 证据引用 · 异常说明</small>
                  </span>
                  <ChevronRight size={14} />
                </button>
              </div>
              <div className="rt-tool-lane">
                <div className="rt-lane-label">
                  EXECUTION LOOP <span>执行与权限</span>
                </div>
                <div className="rt-hook-line">
                  <button className={`${graphState("hook")} ${currentEvent?.name === "PreToolUse" ? "is-active" : ""}`}
                    data-runtime-node="hook"
                    aria-label="查看执行前 Hook"
                    onClick={(event) => select("hook", event.currentTarget)}
                  >
                    <PlugZap size={13} />
                    PreToolUse <ChevronRight size={11} />
                  </button>
                  <span>执行前事件 · 按配置触发</span>
                </div>
                <button
                  className={`rt-gate ${graphState("gate")}`}
                  data-runtime-node="gate"
                  aria-label="查看权限门禁"
                  onClick={(event) => select("gate", event.currentTarget)}
                >
                  <ShieldCheck size={19} />
                  <span>
                    <strong>权限与策略检查</strong>
                    <small>允许执行 / 请求确认 / 拒绝</small>
                  </span>
                  <span className="rt-gate-status">{liveMode ? `${observedPermissions} 条门禁事件` : "1 次确认"}</span>
                  <ChevronRight size={13} />
                </button>
                <div className="rt-lane-beam">
                  <i />
                  <ArrowDown size={12} />
                </div>
                <div className="rt-tool-choices">
                  <GraphNode
                    id="tool"
                    onSelect={select}
                    stateClass={graphState("tool")}
                  >
                    <span className="rt-tool-commands">
                      {liveMode ? `${observedLocalTools.length ? observedLocalTools.join(" · ") : "未观测到本地调用"} · ${observedLocalCalls} 次调用` : "exec_command · 3 次只读调用"}
                    </span>
                  </GraphNode>
                  <GraphNode
                    id="mcp"
                    onSelect={select}
                    stateClass={graphState("mcp")}
                  >
                    <span className="rt-tool-commands">
                      {liveMode ? `${observedMcpServers.length ? observedMcpServers.join(" · ") : "未观测到 MCP 调用"} · ${observedMcpCalls} 次调用` : "2 个服务 · 3 次调用 · 1 次重试"}
                    </span>
                  </GraphNode>
                </div>
                <button
                  className={`rt-search-note ${graphState("search")}`}
                  data-runtime-node="search"
                  aria-label="查看搜索"
                  onClick={(event) => select("search", event.currentTarget)}
                >
                  <span className="rt-search-icon">
                    <Search size={12} />
                  </span>
                  <strong>搜索</strong>
                  <span>{liveMode ? observedSearches.map(event => event.summary).join(" · ") || "未观测到搜索事件" : "rg --files / React 官方文档"}</span>
                  <ChevronRight size={10} />
                </button>
                <div className="rt-lane-beam">
                  <i />
                  <ArrowDown size={12} />
                </div>
                <button
                  className={`rt-result ${selected === "hook" ? "is-selected" : ""} ${currentEvent?.name.startsWith("PostToolUse") ? "is-active" : ""}`}
                  data-runtime-node="result"
                  aria-label="查看 Hook 观测层"
                  onClick={(event) => select("hook", event.currentTarget)}
                >
                  <Zap size={16} />
                  <span>
                    <strong>结果与状态回传</strong>
                    <small>{liveMode ? `${observedHookStarts} 次执行前 · ${observedHookFinishes} 次执行后 Hook` : "PostToolUse / 失败事件 · 按配置触发"}</small>
                  </span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
            <RuntimeTelemetry events={visibleEvents} activeEvent={currentEvent} replaying={replaying} playing={playing} isReal={liveMode} onEvent={openEvent} />
            <div className="rt-return-path">
              <span>
                <ArrowLeft size={12} />
                工具结果追加到上下文，返回模型继续下一轮
              </span>
            </div>
            <div className="rt-observer">
              <span>
                <Activity size={12} />
                HOOK / APP SERVER
              </span>
              <i />
              <span>
                关联 session · turn · call <span className="rt-blink" />
              </span>
              <button onClick={(event) => select("hook", event.currentTarget)}>
                查看观测层 <ArrowRight size={12} />
              </button>
            </div>
          </section>
          <section className="mx-session-overview" aria-label={liveMode ? "实时会话总览" : "模拟会话总览"}>
            <div>
              <span>MODEL ROUNDS</span>
              <strong>
                {modelRequestCount}
                <small>{liveMode ? "已关联模型请求" : "轮模型请求"}</small>
              </strong>
            </div>
            <div>
              <span>TOOL CALLS</span>
              <strong>
                {session.calls.length}
                <small>{liveMode ? `${observedLocalCalls} 本地 / ${observedMcpCalls} MCP` : "3 本地 / 3 MCP"}</small>
              </strong>
            </div>
            <div>
              <span>APPROVAL & RETRY</span>
              <strong>
                {liveMode ? `${observedPermissions} / —` : "1 / 1"}<small>{liveMode ? "门禁事件 / 重试未采集" : "一次确认 / 一次重试"}</small>
              </strong>
            </div>
            <div>
              <span>TRACE EVENTS</span>
              <strong>
                {session.events.length}
                <small>{liveMode ? "Codex Hook / app-server 事件" : "完整模拟场景事件"}</small>
              </strong>
            </div>
          </section>
          <section
            className="cp-activity mx-trace"
            aria-label={liveMode ? "Codex 实时事件轨迹" : "完整模拟事件轨迹"}
          >
            <div className="cp-activity-heading">
              <span>
                <Terminal size={15} />
                {liveMode ? "已采集事件轨迹" : "完整事件轨迹"}{" "}
                <small>{session.events.length} 条记录 · {liveMode ? (session.durationMs === null ? "持续时间未采集" : `${(session.durationMs / 1000).toFixed(1)} 秒`) : "17.1 秒模拟会话"}</small>
              </span>
              <button onClick={() => downloadMockSession(session)}>
                {liveMode ? "导出 Runtime JSON" : "导出 JSON"} <ArrowRight size={12} />
              </button>
            </div>
            <div className="mx-trace-toolbar">
              <label>
                <Search size={13} />
                <input
                  aria-label="搜索事件"
                  placeholder="搜索事件、工具名、call ID…"
                  value={eventQuery}
                  onChange={(event) => setEventQuery(event.target.value)}
                />
              </label>
              <select
                aria-label="筛选事件类型"
                value={kindFilter}
                onChange={(event) =>
                  setKindFilter(event.target.value as Kind | "all")
                }
              >
                <option value="all">全部类型</option>
                {Object.entries(kinds).map(([kind, info]) => (
                  <option key={kind} value={kind}>
                    {info.label}
                  </option>
                ))}
              </select>
              {replaying && (
                <>
                  <span className="mx-replay-count">
                    {progress} / {session.events.length}
                  </span>
                  <button
                    onClick={() =>
                      setProgress((value) =>
                        Math.min(value + 1, session.events.length),
                      )
                    }
                  >
                    下一事件
                  </button>
                  <button
                    onClick={() => {
                      setProgress(Infinity);
                      setReplaying(false);
                    }}
                  >
                    查看完整会话
                  </button>
                </>
              )}
            </div>
            <div className="mx-trace-rows">
              {(showAll ? filteredEvents : filteredEvents.slice(-10)).map(
                (event) => (
                  <button
                    key={event.id}
                    className={
                      event.id === currentEvent?.id ? "mx-trace-active" : ""
                    }
                    onClick={(click) => openEvent(event, click.currentTarget)}
                  >
                    <time>{event.time}</time>
                    <Tag kind={event.kind} />
                    <span className="mx-trace-title">
                      <strong>{event.title}</strong>
                      <small>
                        {event.name} {event.callId && "· " + event.callId}
                      </small>
                    </span>
                    <span className={"mx-status mx-" + event.status}>
                      {statusLabels[event.status]}
                    </span>
                    <ChevronRight size={13} />
                  </button>
                ),
              )}
              {!filteredEvents.length && (
                <p className="mx-empty">
                  {replaying && !progress
                    ? "等待第一个事件…"
                    : "没有匹配的记录，请调整搜索条件。"}
                </p>
              )}
            </div>
            {filteredEvents.length > 10 && (
              <button
                className="mx-show-all"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll
                  ? "收起为最近 10 条"
                  : "展开全部 " + filteredEvents.length + " 条事件"}
              </button>
            )}
            <p className="mx-trace-caption">
              {liveMode ? "LIVE · 事件来自本机 Codex Hook / app-server。未采集字段不会用演示数据补齐。" : "模拟数据 · 点击节点先看具体内容，再追踪事件与原始字段。输入框仅替换用户消息；模型、工具和审批结果均使用演示脚本。"}
            </p>
          </section>
          <footer className="cp-footer">
            <span>
              AGENT MATRIX <span>/</span> CODEX RUNTIME EXPLORER
            </span>
            <span>{liveMode ? "实时观测 · 只读展示" : "原型数据 · 不执行真实任务"}</span>
          </footer>
        </main>
      </div>
      <AnimatePresence>
      {activeStep && (
        <motion.div className="rt-detail-layer" key="runtime-detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.2 }}>
          <div className="cp-drawer-scrim" onClick={close} />
          <motion.aside
            initial={{ x: reducedMotion ? 0 : 45 }} animate={{ x: 0 }} exit={{ x: reducedMotion ? 0 : 45 }}
            transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
            ref={drawer}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cp-detail-title"
            className="cp-drawer"
            onKeyDown={(event) => {
              if (event.key === "Escape") close();
              if (event.key === "Tab") {
                const controls = drawer.current?.querySelectorAll<HTMLElement>(
                  "button, a[href], input, select, textarea, summary",
                );
                if (!controls?.length) return;
                const first = controls[0],
                  last = controls[controls.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                  event.preventDefault();
                  last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault();
                  first.focus();
                }
              }
            }}
          >
            <div className="cp-detail-top">
              <span>
                RUNTIME MAP <ChevronRight size={12} /> {activeStep.kicker}
              </span>
              <button
                aria-label="关闭步骤详情"
                ref={closeButton}
                onClick={close}
              >
                <X size={19} />
              </button>
            </div>
            <div className="cp-detail-title">
              <span className="cp-detail-eyebrow">
                {activeStep.kicker} <span>{liveMode ? "LIVE · 已观测字段" : "MOCK · 完整数据"}</span>
              </span>
              <h2 id="cp-detail-title">{activeStep.title}</h2>
              <p>{activeStep.subtitle}</p>
              <ModelIdentity session={session} />
            </div>
            <div
              className="cp-detail-tabs"
              role="tablist"
              aria-label="节点详情"
            >
              {(
                [
                  ["evidence", "本次执行"],
                  ["events", "关联事件"],
                  ["story", "运行原理"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  id={"rt-" + id + "-tab"}
                  role="tab"
                  aria-controls="rt-detail-panel"
                  aria-selected={detailTab === id}
                  onClick={() => {
                    setDetailTab(id);
                    setCallFilter(null);
                    setFocusedEvent(null);
                  }}
                >
                  {label}
                  {id === "events" && <span>{nodeEvents.length}</span>}
                </button>
              ))}
            </div>
            <div
              id="rt-detail-panel"
              aria-labelledby={"rt-" + detailTab + "-tab"}
              className="cp-detail-content"
              role="tabpanel"
            >
              {detailTab === "story" ? (
                <>
                  <div className="cp-detail-explanation">
                    <h3>在运行时中做什么</h3>
                    <p>{activeStep.explanation}</p>
                  </div>
                  <button
                    className="cp-evidence-link"
                    onClick={() => setDetailTab("evidence")}
                  >
                    查看这次会话的具体数据
                    <ArrowRight size={14} />
                  </button>
                </>
              ) : detailTab === "evidence" ? (
                <>
                  <CodexMockDetails
                    session={session}
                    node={activeStep.id}
                    onCorrelate={correlate}
                  />
                  {replaying && (
                    <p className="mx-note">
                      本次执行展示完整演示数据；关联事件标签按回放进度逐条出现。
                    </p>
                  )}
                </>
              ) : (
                <>
                  {callFilter ? (
                    <div className="mx-correlation">
                      <span>调用追踪 · {callFilter}</span>
                      <p>{liveMode ? (session.events.filter(event => event.callId === callFilter).map(event => event.title).join(" → ") || "未采集到可关联的调用事件") : "模型请求 → Hook → 权限 → 执行 → 结果 → 上下文"}</p>
                      <button
                        onClick={() => {
                          setCallFilter(null);
                          setFocusedEvent(null);
                        }}
                      >
                        清除调用筛选
                      </button>
                    </div>
                  ) : (
                    <p className="mx-note">
                      {focusedEvent
                        ? "已定位所选事件，下面列出该节点的其他关联记录。"
                        : "按时间顺序展示；点击 call ID 可以追踪一次调用的前后过程。"}
                    </p>
                  )}
                  {orderedDetailEvents.map((event) => (
                    <MockEventCard
                      key={event.id}
                      event={event}
                      highlight={event.id === focusedEvent}
                      onCorrelate={correlate}
                    />
                  ))}
                  {!orderedDetailEvents.length && (
                    <p className="mx-empty">
                      回放尚未到达这个节点，继续回放即可看到事件。
                    </p>
                  )}
                </>
              )}
            </div>
            <div className="cp-detail-bottom">
              <button onClick={close}>
                <ArrowLeft size={13} />
                返回全景
              </button>
              {nodes.indexOf(activeStep) < nodes.length - 1 && (
                <button
                  onClick={() =>
                    select(nodes[nodes.indexOf(activeStep) + 1].id)
                  }
                >
                  下一节点 <ArrowRight size={13} />
                </button>
              )}
            </div>
          </motion.aside>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
