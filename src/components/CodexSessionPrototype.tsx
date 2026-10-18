import React, { useEffect, useMemo, useRef, useState } from "react";
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

export function CodexSessionPrototype() {
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
  const session = useMemo(() => createCodexRuntimeMock(submitted), [submitted]);
  const [detailTab, setDetailTab] = useState<"story" | "evidence" | "events">(
    "evidence",
  );
  const [eventQuery, setEventQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<Kind | "all">("all");
  const [showAll, setShowAll] = useState(false);
  const [callFilter, setCallFilter] = useState<string | null>(null);
  const [focusedEvent, setFocusedEvent] = useState<string | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const closeButton = useRef<HTMLButtonElement | null>(null);
  const drawer = useRef<HTMLElement | null>(null);
  const mapRef = useRef<HTMLElement | null>(null);
  const activeStep = nodes.find((step) => step.id === selected);
  const currentEvent = replaying ? session.events[progress - 1] : undefined;
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
      Math.min(900, Math.max(140, gap)),
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
      currentEvent?.node === id ? "is-active" : "",
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
          <a className="cp-real-link cp-3d-link" href="/codex/3d">
            3D 拓扑 <Sparkles size={12} />
          </a>
          <span className="cp-prototype">
            <span />
            RUNTIME TRACE · PROTOTYPE
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
            当前会话 <span className="cp-mono">sess_demo_024</span>
          </div>
          <div className="rt-session-card">
            <span className="rt-session-dot" /> DEMO SESSION
            <strong>一个输入，完整运行轨迹</strong>
            <span>5 轮模型 · 1 次审批 · 1 次重试</span>
            <div>
              <span>
                TURN <b>08</b>
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
            <div>
              <span className="cp-tiny-dot" />
              可观测 session
            </div>
            <p>
              先看运行时全景，再点开任意事件。
              <br />
              所有内容均为原型示例。
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
            <span className="cp-mono">/ sess_demo_024</span>
          </div>
          <section className="cp-page-heading">
            <div>
              <div className="cp-eyebrow">
                <span />
                AGENT RUNTIME / NEURAL OBSERVATORY
              </div>
              <h1>
                看见 Agent 的<span>每一次行动。</span>
              </h1>
              <p>从用户输入，到模型与工具之间的每一次往返。</p>
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
              完整模拟会话 · MOCK
            </span>
            <span className="cp-runtime-pill">
              <Activity size={12} /> turn_08
            </span>
            <span className="cp-runtime-pill">
              <Zap size={12} /> AGENT LOOP
            </span>
            <span className="cp-runtime-hint">
              <i />
              消息流 <i />
              工具循环 <i />
              事件观测
            </span>
          </div>
          <section
            className="rt-map"
            ref={mapRef}
            aria-label="Codex runtime 完整链路"
          >
            <RuntimeParticles
              host={mapRef}
              playing={playing}
              activeEvent={currentEvent}
            />
            <div className="rt-map-bar">
              <span>
                <CircleDot size={12} /> RUNTIME TOPOLOGY
              </span>
              <span>
                {replaying
                  ? `${Math.min(progress, session.events.length)} / ${session.events.length} · ${currentEvent?.title || "开始回放"}`
                  : "点击任意节点，逐层深入"}{" "}
                <span className="rt-blink" />
              </span>
            </div>
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
                  aria-label="演示任务输入"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength={1200}
                  rows={2}
                />
                <div className="rt-composer-footer">
                  <span>
                    <LockKeyhole size={10} />
                    固定 mock 剧本 · 不执行真实任务
                  </span>
                  <button disabled={!draft.trim()} type="submit">
                    发送演示 <Send size={12} />
                  </button>
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
                  <span>会话历史</span>
                  <span>工作区</span>
                  <span>项目规则</span>
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
                  <span>用户消息</span>
                  <span>指令与工具定义</span>
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
                    browser-inspection → 加入上下文
                  </span>
                  <span className="rt-mini-tags">
                    <span>SKILL.md</span>
                    <span>参考资料</span>
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
                  data-runtime-node="model"
                  aria-label="查看模型调用循环"
                  onClick={(event) => select("model", event.currentTarget)}
                >
                  <span className="rt-model-orbit rt-orbit-one" />
                  <span className="rt-model-orbit rt-orbit-two" />
                  <span className="rt-model-orbit rt-orbit-three" />
                  <span className="rt-model-dots" />
                  <span className="rt-model-center">
                    <Sparkles size={32} />
                    <strong>CODEX</strong>
                    <small>MODEL RUNTIME</small>
                  </span>
                  <span className="rt-model-caption">
                    <span className="rt-blink" />5 轮请求 · 6 次工具调用
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
                  EXECUTION LOOP <span>可多次循环</span>
                </div>
                <div className="rt-hook-line">
                  <button
                    data-runtime-node="hook"
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
                  <span className="rt-gate-status">1 次确认</span>
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
                      exec_command · 3 次只读调用
                    </span>
                  </GraphNode>
                  <GraphNode
                    id="mcp"
                    onSelect={select}
                    stateClass={graphState("mcp")}
                  >
                    <span className="rt-tool-commands">
                      2 个服务 · 3 次调用 · 1 次重试
                    </span>
                  </GraphNode>
                </div>
                <button
                  className="rt-search-note"
                  data-runtime-node="search"
                  aria-label="查看搜索"
                  onClick={(event) => select("search", event.currentTarget)}
                >
                  <span className="rt-search-icon">
                    <Search size={12} />
                  </span>
                  <strong>搜索</strong>
                  <span>rg --files / React 官方文档</span>
                  <ChevronRight size={10} />
                </button>
                <div className="rt-lane-beam">
                  <i />
                  <ArrowDown size={12} />
                </div>
                <button
                  className={`rt-result ${graphState("hook")}`}
                  data-runtime-node="result"
                  aria-label="查看 Hook 观测层"
                  onClick={(event) => select("hook", event.currentTarget)}
                >
                  <Zap size={16} />
                  <span>
                    <strong>结果与状态回传</strong>
                    <small>PostToolUse / 失败事件 · 按配置触发</small>
                  </span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
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
          <section className="mx-session-overview" aria-label="模拟会话总览">
            <div>
              <span>MODEL ROUNDS</span>
              <strong>
                {session.rounds.length}
                <small>轮模型请求</small>
              </strong>
            </div>
            <div>
              <span>TOOL CALLS</span>
              <strong>
                {session.calls.length}
                <small>3 本地 / 3 MCP</small>
              </strong>
            </div>
            <div>
              <span>APPROVAL & RETRY</span>
              <strong>
                1 / 1<small>一次确认 / 一次重试</small>
              </strong>
            </div>
            <div>
              <span>TRACE / TOKENS</span>
              <strong>
                {session.events.length}
                <small>事件 · {session.usage.outputTokens} 输出 token</small>
              </strong>
            </div>
          </section>
          <section
            className="cp-activity mx-trace"
            aria-label="完整模拟事件轨迹"
          >
            <div className="cp-activity-heading">
              <span>
                <Terminal size={15} />
                完整事件轨迹{" "}
                <small>{session.events.length} 条记录 · 17.1 秒模拟会话</small>
              </span>
              <button onClick={() => downloadMockSession(session)}>
                导出 JSON <ArrowRight size={12} />
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
              模拟数据 ·
              点击节点先看具体内容，再追踪事件与原始字段。输入框仅替换用户消息；模型、工具和审批结果均使用演示脚本。
            </p>
          </section>
          <footer className="cp-footer">
            <span>
              AGENT MATRIX <span>/</span> CODEX RUNTIME EXPLORER
            </span>
            <span>原型数据 · 不执行真实任务</span>
          </footer>
        </main>
      </div>
      {activeStep && (
        <>
          <div className="cp-drawer-scrim" onClick={close} />
          <aside
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
                {activeStep.kicker} <span>MOCK · 完整数据</span>
              </span>
              <h2 id="cp-detail-title">{activeStep.title}</h2>
              <p>{activeStep.subtitle}</p>
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
                      <p>模型请求 → Hook → 权限 → 执行 → 结果 → 上下文</p>
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
          </aside>
        </>
      )}
    </div>
  );
}
