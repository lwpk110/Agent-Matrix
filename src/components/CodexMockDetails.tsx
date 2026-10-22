import {
  ArrowDown,
  ArrowRight,
  ChevronRight,
  Download,
  Link2,
  Cpu,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  Terminal,
  PlugZap,
} from "lucide-react";
import { useEffect, useState } from "react";
import "./CodexMockDetails.css";
import { mockEventsForNode } from "./codexRuntimeMock";
import type { RuntimeEvent, RuntimeNodeId, RuntimeSession } from "../types/runtime";
import { getRuntimePlugin } from "../services/runtimePlugins";
import { runtimeCallNode } from "./runtimeLeafModel";

export const statusLabels: Record<RuntimeEvent["status"], string> = {
  completed: "已完成",
  running: "开始执行",
  waiting: "等待确认",
  failed: "失败",
  allowed: "已允许",
  unknown: "状态未采集",
};

const fieldLabels: Record<string, string> = {
  cmd: "执行命令", cwd: "工作目录", query: "搜索内容", server: "MCP 服务", tool: "工具名称",
  url: "访问地址", allowed_domains: "允许的域名", timeout_ms: "超时（ms）", wait_until: "等待条件",
  exit_code: "退出码", stdout: "标准输出", stderr: "错误输出", truncated: "结果已截断",
  content: "内容", result_count: "结果数量", isError: "是否出错", error: "错误详情",
  code: "错误代码", message: "说明", retryable: "允许重试", title: "标题", excerpt: "摘要",
  heading: "页面主标题", http_status: "HTTP 状态", console_errors: "控制台错误", checks: "检查结果",
  model: "模型名称", effort: "推理强度", attachments: "附件", history_turns: "历史回合",
  sandbox: "沙箱策略", approval_policy: "审批策略", external_network: "外部联网",
  allowed_without_confirmation: "无需确认的操作", permission_scope: "授权范围",
  inputTokens: "输入 token", outputTokens: "输出 token", cachedInputTokens: "缓存 token",
  call_id: "调用 ID", result: "返回结果", arguments: "调用参数", status: "状态",
  context_budget_tokens: "上下文容量", estimated_tokens: "预计 token", compaction: "上下文压缩",
  triggered: "是否触发", reason: "原因", path: "文件路径", constraints: "用户约束",
  previous_turns: "历史回合", selected_files: "选中文件", project_rules_file: "项目规则文件",
  demonstration_instruction: "演示指令", user_message: "用户消息", context_refs: "上下文引用",
  tools: "工具列表", servers: "MCP 服务列表", skills: "Skill 目录", name: "名称", description: "说明",
  input_schema: "输入定义", note: "备注", source: "来源", text: "文本", active_skill_refs: "已加载 Skill",
  added_tool_results: "追加工具结果", tool_choice: "工具选择", previous_context_retained: "保留前序上下文",
  response_mode: "响应类型", full_internal_system_prompt: "完整内部系统提示词", hidden_reasoning: "隐藏推理",
};

function ReadableText({ content, field }: { content: string; field?: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = content.length > 500 || content.split("\n").length > 8;
  const code = ["cmd", "stdout", "stderr", "cwd", "path"].includes(field || "");
  return (
    <>
      <div className={`mx-value-text ${code ? "mx-value-code" : ""} ${long && !expanded ? "mx-text-preview" : ""}`}>
        {content}
      </div>
      {long && (
        <button className="mx-expand-text" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? "收起长内容" : "展开完整内容"}
        </button>
      )}
    </>
  );
}

function DataValue({ value, field }: { value: unknown; field?: string }) {
  if (value === null || value === undefined) return <span className="mx-value-muted">未提供</span>;
  if (typeof value === "boolean") return <span className={`mx-value-boolean ${value ? "mx-true" : "mx-false"}`}>{value ? "是" : "否"}</span>;
  if (typeof value === "number") return <span className="mx-value-number">{value.toLocaleString()}</span>;
  if (Array.isArray(value)) {
    if (!value.length) return <span className="mx-value-muted">无 · 0 项</span>;
    if (value.every(item => typeof item === "string" || typeof item === "number")) {
      return <ul className="mx-value-list">{value.map((item, i) => <li key={i}>{String(item)}</li>)}</ul>;
    }
    return (
      <div className="mx-value-items">
        {value.map((item, i) => (
          <details key={i} className="mx-value-nested">
            <summary>
              {typeof item === "object" && item
                ? String(item.title || item.name || item.call_id || `第 ${i + 1} 项`)
                : `第 ${i + 1} 项`}
            </summary>
            <DataValue value={item} />
          </details>
        ))}
      </div>
    );
  }
  if (typeof value === "object") {
    return (
      <dl className="mx-field-list">
        {Object.entries(value).map(([key, item]) => (
          <div className="mx-field-row" key={key}>
            <dt title={key}>{fieldLabels[key] || key}</dt>
            <dd>
              {item && typeof item === "object" && !Array.isArray(item) ? (
                <details className="mx-value-nested">
                  <summary>查看 {Object.keys(item).length} 个字段</summary>
                  <DataValue value={item} />
                </details>
              ) : <DataValue value={item} field={key} />}
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  const content = String(value);
  if (!content) return <span className="mx-value-muted">空</span>;
  if (field === "url" && /^https?:\/\//.test(content)) return <a className="mx-value-link" href={content} target="_blank" rel="noreferrer">{content} ↗</a>;
  return <ReadableText content={content} field={field} />;
}

function DataBlock({ label, value, tone = "neutral", raw = false }: {
  label: string;
  value: unknown;
  tone?: "neutral" | "input" | "output";
  raw?: boolean;
}) {
  return (
    <section className={`mx-data-block mx-data-${tone}`}>
      <h4>{label}</h4>
      {raw ? (
        <pre className="mx-raw-json">{JSON.stringify(value, null, 2)}</pre>
      ) : (
        <div className="mx-readable-data"><DataValue value={value} /></div>
      )}
    </section>
  );
}

export function ModelIdentity({ session }: { session: RuntimeSession }) {
  return (
    <div className="mx-model-identity" aria-label={session.isReal ? "实时模型配置" : "模拟模型配置"}>
      <span className="mx-model-chip">
        <Cpu size={14} /><span>模型 <b>{session.model}</b></span>
      </span>
      <span className="mx-effort-chip">
        <Gauge size={14} /><span>推理强度 <b>{session.reasoningEffort === "未采集" ? "未采集" : session.reasoningEffort}</b></span>
      </span>
      <span className="mx-mock-label">{session.isReal ? "实时观测" : "模拟配置"}</span>
    </div>
  );
}

function callResultSummary(call: RuntimeSession["calls"][number]) {
  if (call.status === "running") return "调用仍在执行，尚未收到完成事件。";
  if (call.status === "waiting") return "调用正在等待权限决定。";
  if (call.status === "unknown") return "事件未包含可确认的执行状态。";
  if (call.resultReceived === false) return "事件中没有采集到调用返回值。";
  if (call.resultReceived && !Object.keys(call.result).length) return "Hook 标记收到了返回值，但载荷内容未包含在事件中。";
  if (call.status === "failed") {
    const error = call.result.error as { message?: string } | string | undefined;
    if (typeof error === "string") return error;
    return error?.message || "执行失败，展开结果查看原因。";
  }
  if (call.result.result_count !== undefined) {
    return `找到 ${call.result.result_count} 条资料，可在下方展开来源。`;
  }
  if (call.result.http_status !== undefined) {
    const checks = Array.isArray(call.result.checks) ? call.result.checks : [];
    return `HTTP ${call.result.http_status} · ${checks.length} 项页面检查`;
  }
  return call.result.exit_code !== undefined
    ? `命令正常结束 · 退出码 ${call.result.exit_code}。`
    : "已收到调用完成事件。";
}

function formatTokens(value: number | null) {
  return value === null ? "未采集" : value.toLocaleString();
}

export function MockEventCard({
  event,
  highlight,
  onCorrelate,
}: {
  event: RuntimeEvent;
  highlight?: boolean;
  onCorrelate: (id: string) => void;
}) {
  const [raw, setRaw] = useState(false);
  return (
    <article
      id={`record-${event.id}`}
      className={`mx-event-card mx-card-${event.status} ${highlight ? "mx-highlight" : ""}`}
    >
      <div className="mx-meta">
        <time>{event.time}</time>
        <span>{event.source}{event.isReal ? "" : " · 模拟"}</span>
        <span className={`mx-status mx-${event.status}`}>
          {statusLabels[event.status]}
        </span>
      </div>
      <h3>{event.title}</h3>
      <code className="mx-event-name">{event.name}</code>
      <p>{event.summary}</p>
      <div className="mx-ids">
        <span>{event.id}</span>
        {event.roundId && <span>{event.roundId}</span>}
        {event.durationMs !== undefined && <span>{event.durationMs} ms</span>}
      </div>
      {event.content && <DataBlock label="具体内容" value={event.content} />}
      {(event.input || event.output) && <details className="mx-disclosure">
        <summary>查看输入与输出 <span>结构化字段</span></summary>
        {event.input && <DataBlock label="输入 / 参数" value={event.input} tone="input" />}
        {event.output && <DataBlock label="输出 / 结果" value={event.output} tone="output" />}
      </details>}
      <div className="mx-record-actions">
        {event.callId && (
          <button onClick={() => onCorrelate(event.callId!)}>
            <Link2 size={12} />
            {event.callId}
            <ChevronRight size={12} />
          </button>
        )}
        <button aria-expanded={raw} onClick={() => setRaw(!raw)}>
          {raw ? "收起原始 JSON" : "原始事件 JSON"}
        </button>
      </div>
      {raw && <DataBlock label={`${event.isReal ? "RUNTIME" : "MOCK"} EVENT · 完整记录`} value={event} raw />}
    </article>
  );
}

function CallCard({
  call,
  onCorrelate,
}: {
  call: RuntimeSession["calls"][number];
  onCorrelate: (id: string) => void;
}) {
  return (
    <article className={`mx-call-card mx-card-${call.status}`}>
      <div className="mx-meta">
        <span className={`mx-kind-tag mx-kind-${call.type}`}>{call.type === "local" ? <Terminal size={12} /> : <PlugZap size={12} />}{call.type === "local" ? "本地工具" : "MCP 工具"}</span>
        <span>{call.durationMs === null ? "耗时未采集" : `${call.durationMs} ms`}</span>
        <span className={`mx-status mx-${call.status}`}>
          {statusLabels[call.status]}
        </span>
      </div>
      <h3>{call.title}</h3>
      <code>{call.name}</code>
      <div className="mx-ids">
        <span>{call.id}</span>
        {call.roundId && <span>{call.roundId}</span>}
      </div>
      {call.approvalId && (
        <p className="mx-call-note">经一次性联网确认 · {call.approvalId}</p>
      )}
      {call.retryOf && (
        <p className="mx-call-note">
          重试自 {call.retryOf} · 超时由 3 秒调整为 10 秒
        </p>
      )}
      <div className={`mx-result-summary ${call.status === "failed" ? "mx-result-failed" : ""}`}>
        {call.status === "failed" ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
        <div>
          <strong>{call.status === "failed" ? "本次调用失败" : call.status === "completed" ? "调用已完成" : call.status === "running" ? "调用进行中" : call.status === "waiting" ? "等待权限" : "状态未知"}</strong>
          <p>{callResultSummary(call)}</p>
        </div>
      </div>
      {call.metadataOnly ? <p className="mx-call-note">来源：Claude transcript 统计 · {call.resultReceived ? call.resultError === true ? "已收到失败结果标记" : "已收到结果标记" : "结果未观测"}{call.observedAt ? ` · ${new Date(call.observedAt).toLocaleString("zh-CN", { hour12: false })}` : ""}。不采集参数或结果正文。</p> : <details className="mx-disclosure">
        <summary>查看参数与完整结果 <span>输入 → 执行 → 输出</span></summary>
        <DataBlock label="01 · 发送的参数" value={call.arguments} tone="input" />
        <ArrowDown className="mx-data-arrow" size={15} />
        <DataBlock label="02 · 调用结果" value={call.resultReceived === false ? null : Object.keys(call.result).length ? call.result : "Hook 标记已返回；结果载荷未采集。"} tone="output" />
      </details>}
      <button className="mx-link-button" onClick={() => onCorrelate(call.id)}>
        <Link2 size={13} />
        追踪这次调用的完整链路
        <ArrowRight size={13} />
      </button>
    </article>
  );
}

function RuntimeStats({ events, calls }: { events: RuntimeEvent[]; calls: RuntimeSession["calls"] }) {
  const names = calls.length
    ? new Set(calls.map((call) => call.name.trim().toLocaleLowerCase()))
    : new Set(events.map((event) => event.name));
  const callNames = new Map<string, { name: string; count: number; failed: number }>();
  calls.forEach((call) => {
    const key = call.name.trim().toLocaleLowerCase() || call.title.toLocaleLowerCase();
    const group = callNames.get(key) ?? { name: call.name || call.title, count: 0, failed: 0 };
    group.count += 1;
    if (call.status === "failed") group.failed += 1;
    callNames.set(key, group);
  });
  return <>
    <div className="mx-stat-grid mx-runtime-stats">
      <span>关联事件<b>{events.length}</b></span>
      <span>唯一名称<b>{names.size}</b></span>
      <span>调用次数<b>{calls.length}</b></span>
    </div>
    {callNames.size > 0 && <div className="mx-call-counts" aria-label="按运行项统计调用次数">
      {[...callNames.values()].map((group) => <div key={group.name}>
        <code>{group.name}</code><strong>{group.count} 次</strong>{group.failed > 0 && <em>{group.failed} 次失败</em>}
      </div>)}
    </div>}
  </>;
}

type SkillSource = {
  scope: "project" | "global" | "runtime";
  root: string;
  path: string;
  modifiedAt: string;
  sizeBytes: number;
  metadata: Record<string, string>;
  rawMetadata: string;
  content: string;
};

function SkillSourceDetails({ name, cwd, provider }: { name: string; cwd: string; provider?: string }) {
  const [sources, setSources] = useState<SkillSource[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true; const controller = new AbortController();
    const loader = provider ? getRuntimePlugin(provider).loadSkillSources : undefined;
    if (!loader) { setSources([]); setLoading(false); return () => controller.abort(); }
    setLoading(true);
    loader(name, cwd, controller.signal)
      .then((result) => { if (active) setSources(result); })
      .catch(() => { if (active) setSources([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [name, cwd, provider]);

  return <section className="mx-skill-sources" aria-label={`${name} 的来源文件`}>
    <div className="mx-skill-sources-heading"><strong>Skill 原始文件</strong><span>{loading ? "正在查找…" : `${sources.length} 个匹配来源`}</span></div>
    {!loading && sources.length === 0 && <p className="mx-note">本机常见 Skill 目录中未找到对应文件。运行事件只记录了 Skill 名称，文件可能来自其他目录或远程环境。</p>}
    {sources.map((source) => <article className="mx-skill-source" key={source.path}>
      <div className="mx-skill-source-meta">
        <span className={`mx-skill-scope is-${source.scope}`}>{source.scope === "project" ? "项目级" : "全局"}</span>
        <code>{source.path}</code>
      </div>
      <div className="mx-skill-facts">
        <span>文件大小 <b>{source.sizeBytes.toLocaleString()} B</b></span>
        <span>修改时间 <b>{new Date(source.modifiedAt).toLocaleString()}</b></span>
      </div>
      {Object.keys(source.metadata).length > 0 && <dl className="mx-skill-frontmatter">
        {Object.entries(source.metadata).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value || "（空）"}</dd></div>)}
      </dl>}
      <details className="mx-disclosure">
        <summary>查看原始元数据与 SKILL.md 正文 <span>本机文件</span></summary>
        {source.rawMetadata && <pre className="mx-skill-raw">{`---\n${source.rawMetadata}\n---`}</pre>}
        <pre className="mx-skill-raw mx-skill-content">{source.content}</pre>
      </details>
    </article>)}
  </section>;
}

export function downloadMockSession(session: RuntimeSession) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(session, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${session.id}-${session.turnId}.${session.isReal ? "runtime" : "mock"}.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function CodexMockDetails({
  session,
  node,
  onCorrelate,
}: {
  session: RuntimeSession;
  node: RuntimeNodeId;
  onCorrelate: (id: string) => void;
}) {
  if (session.isReal) return <LiveRuntimeDetails session={session} node={node} onCorrelate={onCorrelate} />;
  const events = mockEventsForNode(session, node);
  const find = (name: string) => events.find((event) => event.name === name);
  const eventView = (event: RuntimeEvent | undefined) =>
    event && (
      <MockEventCard key={event.id} event={event} onCorrelate={onCorrelate} />
    );
  const calls = session.calls.filter((call) =>
    node === "tool"
      ? call.type === "local"
      : node === "mcp"
        ? call.type === "mcp"
        : node === "search"
          ? ["call_files_01", "call_docs_04"].includes(call.id)
          : false,
  );
  const summaries: Record<RuntimeNodeId, string> = {
    input: `用户输入：${session.prompt}`,
    context: "初始上下文包含工作区、用户约束、工具定义和演示回答偏好；项目记忆按需读取，执行结果逐轮追加。本轮未触发上下文压缩。",
    prompt: "本轮组合演示指令、用户消息、上下文引用与能力定义，后续随工具返回值补充材料。",
    skill: "本轮加载了 browser-inspection 指南，约束页面检查范围与重试方式；其余目录能力未加载。",
    model: `${session.rounds.length} 轮模型请求，累计生成 ${session.usage.outputTokens} 个输出 token。模型读取工具结果后继续请求，最后返回回答。`,
    hook: "记录会话启动、工具执行前后、失败和回合结束，并通过调用 ID 将各阶段配对。",
    gate: "本轮采用只读策略。本地读取直接放行；一次外部文档查询经用户确认后获得单次授权。",
    tool: `${calls.length} 次本地只读调用：列出文件、读取项目说明、加载 Skill，均已完成。`,
    mcp: "连接文档与浏览器两个服务，共 3 次调用。首次页面检查超时，下一轮模型调整参数后重试成功。",
    search: "完成两类搜索：在工作区列出文件、通过 MCP 查询 React 官方文档。外部查询获得 1 条来源。",
    output: "最终回答汇总了项目架构、文档依据、页面检查结果与一次超时重试；本轮未修改文件。",
  };
  return (
    <div className="mx-node-details">
      <div className="mx-session-strip">
        <span>{session.isReal ? "LIVE ·" : "MOCK ·"} {session.id}</span>
        <span>{session.turnId}</span>
        <span>{events.length} 条关联事件</span>
      </div>
      <div className="mx-detail-intro">
        <span>本节点 · 执行摘要</span>
        <p>{summaries[node]}</p>
      </div>
      <RuntimeStats events={events} calls={calls} />
      {node === "input" && (
        <>
          <DataBlock label="用户实际输入（模拟会话）" value={session.prompt} />
          <DataBlock
            label="会话环境"
            value={{
              cwd: session.cwd,
              attachments: [],
              history_turns: 0,
              sandbox: "read-only",
              approval_policy: "on-request",
            }}
          />
          <p className="mx-note">
            输入框仅替换这条模拟会话的用户消息，后续执行使用固定演示脚本。
          </p>
        </>
      )}
      {node === "context" && (
        <>
          {eventView(find("context.snapshot"))}
          <h3>演示记忆如何进入上下文</h3>
          <p className="mx-note">记忆库为虚构示例，未读取或写入真实记忆文件。已保存的 3 条中，本轮读取了 2 条；历史发布约定未带入请求。</p>
          {events.filter(event => event.name.startsWith("memory.")).map(event => eventView(event))}
          <h3>读取后进入上下文的具体材料</h3>
          {session.calls.slice(0, 3).map((call) => (
            <DataBlock
              key={call.id}
              label={`${call.id} · ${call.title}`}
              value={call.result.stdout}
            />
          ))}
          <h3>工具结果如何回到模型</h3>
          <p className="mx-note">
            每次调用后追加 role=tool
            的消息。出错也会写回，下一轮模型才能决定重试。
          </p>
          {events
            .filter((event) => event.name === "context.tool_result")
            .map((event) => eventView(event))}
        </>
      )}
      {node === "prompt" && (
        <>
          <DataBlock
            label="演示指令 · 本原型编写"
            value={session.instruction}
          />
          <DataBlock label="用户消息" value={session.prompt} />
          {eventView(find("prompt.composition"))}
          {eventView(find("capabilities.snapshot"))}
          <p className="mx-note">
            工作区材料和工具结果在后续模型轮次逐步追加。内部系统提示词、隐藏推理均不可观测。
          </p>
        </>
      )}
      {node === "skill" && (
        <>
          {eventView(find("skill.reference.loaded"))}
          <p className="mx-note">
            browser-inspection 是演示用
            Skill，并不代表该文件已存在于当前工作区。它通过 exec_command
            读取，再加入模型上下文。
          </p>
        </>
      )}
      {node === "model" && (
        <>
          <div className="mx-stat-grid">
            <span>
              模型请求<b>{session.rounds.length}</b>
            </span>
            <span>
              输入 token（累计）
              <b>{formatTokens(session.usage.inputTokens)}</b>
            </span>
            <span>
              输出 token<b>{formatTokens(session.usage.outputTokens)}</b>
            </span>
            <span>
              缓存输入（计入输入）
              <b>{formatTokens(session.usage.cachedInputTokens)}</b>
            </span>
          </div>
          {session.rounds.map((round, index) => (
            <article className="mx-round" key={round.id}>
              <div className="mx-meta">
                <span>MODEL ROUND {String(index + 1).padStart(2, "0")}</span>
                <code>{round.id}</code>
              </div>
              <h3>
                {round.callIds.length ? "模型返回工具调用" : "模型生成最终回答"}
              </h3>
              <div className="mx-ids">
                <span>输入 {formatTokens(round.inputTokens)}</span>
                <span>缓存 {formatTokens(round.cachedInputTokens)}</span>
                <span>输出 {formatTokens(round.outputTokens)}</span>
              </div>
              <DataBlock label="Agent 可见响应" value={round.response} />
              <details className="mx-disclosure"><summary>本轮工具交接 <span>收到 {round.consumedCallIds.length} · 发出 {round.callIds.length}</span></summary><DataBlock
                label="本轮消费的工具返回值"
                value={round.consumedCallIds.map((id) => ({
                  call_id: id,
                  result: session.calls.find((call) => call.id === id)!.result,
                }))}
              />
              <DataBlock
                label="本轮发出的调用"
                value={round.callIds.map((id) => {
                  const call = session.calls.find((call) => call.id === id)!;
                  return {
                    call_id: id,
                    tool: call.name,
                    arguments: call.arguments,
                  };
                })}
              /></details>
            </article>
          ))}
        </>
      )}
      {(node === "tool" || node === "mcp" || node === "search") && (
        <>
          {node === "mcp" && (
            <div className="mx-service-list">
              <span>
                <b>documentation</b>就绪 · search · 1 次调用
              </span>
              <span>
                <b>browser</b>就绪 · inspect_page · 2 次调用
              </span>
            </div>
          )}
          {calls.map((call) => (
            <CallCard key={call.id} call={call} onCorrelate={onCorrelate} />
          ))}
          {node === "mcp" && (
            <details className="mx-schema">
              <summary>深入查看 MCP 能力发现与工具定义</summary>
              {eventView(find("capabilities.snapshot"))}
            </details>
          )}
        </>
      )}
      {node === "gate" && (
        <>
          <DataBlock
            label="本轮策略"
            value={{
              sandbox: "read-only",
              external_network: "用户逐次确认",
              allowed_without_confirmation: [
                "工作区只读命令",
                "localhost 页面检查",
              ],
              permission_scope: "single-call",
            }}
          />
          {events.map((event) => eventView(event))}
        </>
      )}
      {node === "hook" && (
        <>
          <p className="mx-note">
            按 call ID 将执行前、执行后或失败 Hook 配对。这里的 Hook
            名称和触发顺序为原型模拟配置。
          </p>
          {events
            .filter((event) => !event.callId)
            .map((event) => eventView(event))}
          {session.calls.map((call) => (
            <article className="mx-hook-pair" key={call.id}>
              <h3>{call.title}</h3>
              <button
                className="mx-link-button"
                onClick={() => onCorrelate(call.id)}
              >
                <Link2 size={12} />
                {call.id} · 查看全链路
              </button>
              {events
                .filter(
                  (event) =>
                    event.callId === call.id && event.source === "Hook",
                )
                .map((event) => (
                  <div className="mx-hook-entry" key={event.id}>
                    <time>{event.time}</time>
                    <strong>{event.name}</strong>
                    <span>{event.summary}</span>
                    <DataBlock
                      label={event.input ? "Hook 输入与处理结果" : "Hook 结果"}
                      value={{ ...event.input, ...event.output }}
                    />
                  </div>
                ))}
            </article>
          ))}
        </>
      )}
      {node === "output" && (
        <>
          <DataBlock label="返回用户的完整回答" value={session.finalAnswer} />
          <div className="mx-reference">
            <h3>引用来源</h3>
            <span>README.md · package.json</span>
            <a
              href="https://react.dev/reference/react-dom/client/createRoot"
              target="_blank"
              rel="noreferrer"
            >
              react.dev / createRoot ↗
            </a>
          </div>
          {eventView(find("turn.completed"))}
          <button
            className="mx-link-button"
            onClick={() => downloadMockSession(session)}
          >
            <Download size={13} />
            导出完整 mock 会话 JSON
          </button>
        </>
      )}
    </div>
  );
}

function LiveRuntimeDetails({
  session,
  node,
  onCorrelate,
}: {
  session: RuntimeSession;
  node: RuntimeNodeId;
  onCorrelate: (id: string) => void;
}) {
  const events = mockEventsForNode(session, node);
  const nodeCallIds = new Set(events.filter((event) => event.callId).map((event) => event.callId));
  const calls = session.calls.filter((call) => nodeCallIds.has(call.id) || (call.metadataOnly && runtimeCallNode(call) === node));
  const context = session.rolloutTelemetry?.contextMetadata;
  const prompt = session.rolloutTelemetry?.promptMetadata;
  const metadataNode = session.provider === "claude" && (node === "context" || node === "prompt");
  const snapshotOrigin = (metadata: { scope: 'turn' | 'session'; observedAt: string | null }) => `Claude transcript · ${metadata.scope === 'session' ? '会话快照（沿父链继承）' : '本回合快照'} · ${metadata.observedAt ? new Date(metadata.observedAt).toLocaleString('zh-CN', { hour12: false }) : '时间未采集'}`;
  const tokens = (value: number | null) => value === null ? "未采集" : value.toLocaleString();
  const summary = `${events.length} 条关联事件${calls.length ? ` · ${calls.length} 次关联调用` : ""}。详情仅呈现当前 Agent 已观测字段。`;
  const modelRequestCount = session.rolloutTelemetry?.modelRequestCount ?? (session.rounds.length || null);
  return (
    <div className="mx-node-details">
      <div className="mx-session-strip">
        <span>LIVE · {session.id}</span>
        <span>{session.turnId}</span>
        <span>{events.length} 条关联事件</span>
      </div>
      <div className="mx-detail-intro">
        <span>本节点 · 实时观测摘要</span>
        <p>{summary}</p>
      </div>
      <RuntimeStats events={events} calls={calls} />
      {node === "input" && <>
        <DataBlock label="捕获到的用户输入" value={session.prompt || null} />
        <DataBlock label="运行环境字段" value={{ cwd: session.cwd, session_id: session.id, turn_id: session.turnId }} />
      </>}
      {node === "context" && context && <>
        <div className="mx-stat-grid"><span>规则快照文件<b>{context.instructionFileCount ?? "未采集"}</b></span></div>
        <p className="mx-note">{snapshotOrigin(context)}。仅采集条目数量，不代表独立文件去重或已载入内容。</p>
      </>}
      {node === "prompt" && prompt && <>
        <div className="mx-stat-grid"><span>系统指令分段<b>{prompt.systemSegmentCount ?? "未采集"}</b></span><span>工具定义条目<b>{prompt.toolDefinitionCount ?? "未采集"}</b></span></div>
        <p className="mx-note">{snapshotOrigin(prompt)}。仅采集结构统计，不展示提示词或工具定义正文。</p>
      </>}
      {node === "model" && <>
        <div className="mx-stat-grid">
          <span>模型请求<b>{modelRequestCount ?? "未采集"}</b></span>
          <span>输入 token<b>{tokens(session.usage.inputTokens)}</b></span>
          <span>输出 token<b>{tokens(session.usage.outputTokens)}</b></span>
          <span>缓存输入 token<b>{tokens(session.usage.cachedInputTokens)}</b></span>
        </div>
        {session.rounds.map((round) => <article className="mx-round" key={round.id}>
          <div className="mx-meta"><span>MODEL REQUEST</span><code>{round.id}</code></div>
          <div className="mx-ids"><span>输入 {tokens(round.inputTokens)}</span><span>缓存 {tokens(round.cachedInputTokens)}</span><span>输出 {tokens(round.outputTokens)}</span></div>
          <DataBlock label="可见响应字段" value={round.response || null} />
        </article>)}
      </>}
      {node === "skill" && session.capabilities?.skills && [...new Set(events.filter((event) => event.name === "SkillActivated").map((event) => String(event.input?.skillName || event.title.split(" · ").at(-1) || "")))].filter(Boolean).map((name) => <SkillSourceDetails key={name} name={name} cwd={session.cwd} provider={session.provider} />)}
      {node === "skill" && !session.capabilities?.skills && <p className="mx-note">当前 Agent 未提供可读取的 Skill 文件来源；仅展示已观测到的生命周期事件。</p>}
      {(node === "tool" || node === "mcp" || node === "search") && calls.map((call) => <CallCard key={call.id} call={call} onCorrelate={onCorrelate} />)}
      {node === "output" && <DataBlock label="采集到的最终回答" value={session.finalAnswer || null} />}
      {metadataNode ? <p className="mx-note">仅展示统计元数据，未采集正文。</p> : events.length > 0 ? events.map((event) => <MockEventCard key={event.id} event={event} onCorrelate={onCorrelate} />)
        : !calls.length && <p className="mx-empty">当前会话没有采集到此节点的事件。</p>}
    </div>
  );
}
