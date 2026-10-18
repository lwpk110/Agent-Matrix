import {
  ArrowDown,
  ArrowRight,
  ChevronRight,
  Download,
  Link2,
} from "lucide-react";
import { useState } from "react";
import {
  mockEventsForNode,
  type MockCall,
  type MockNodeId,
  type MockRuntimeEvent,
  type MockRuntimeSession,
} from "./codexRuntimeMock";

export const statusLabels: Record<MockRuntimeEvent["status"], string> = {
  completed: "已完成",
  running: "开始执行",
  waiting: "等待确认",
  failed: "失败",
  allowed: "已允许",
};

function DataBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <section className="mx-data-block">
      <h4>{label}</h4>
      <pre>
        {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
      </pre>
    </section>
  );
}

export function MockEventCard({
  event,
  highlight,
  onCorrelate,
}: {
  event: MockRuntimeEvent;
  highlight?: boolean;
  onCorrelate: (id: string) => void;
}) {
  const [raw, setRaw] = useState(false);
  return (
    <article
      id={`record-${event.id}`}
      className={`mx-event-card ${highlight ? "mx-highlight" : ""}`}
    >
      <div className="mx-meta">
        <time>{event.time}</time>
        <span>{event.source} · 模拟</span>
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
      {event.input && <DataBlock label="输入 / 参数" value={event.input} />}
      {event.output && <DataBlock label="输出 / 结果" value={event.output} />}
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
      {raw && <DataBlock label="MOCK EVENT · 完整记录" value={event} />}
    </article>
  );
}

function CallCard({
  call,
  onCorrelate,
}: {
  call: MockCall;
  onCorrelate: (id: string) => void;
}) {
  return (
    <article className="mx-call-card">
      <div className="mx-meta">
        <span>{call.type === "local" ? "本地工具" : "MCP 工具"}</span>
        <span>{call.durationMs} ms</span>
        <span className={`mx-status mx-${call.status}`}>
          {statusLabels[call.status]}
        </span>
      </div>
      <h3>{call.title}</h3>
      <code>{call.name}</code>
      <div className="mx-ids">
        <span>{call.id}</span>
        <span>{call.roundId}</span>
      </div>
      {call.approvalId && (
        <p className="mx-call-note">经一次性联网确认 · {call.approvalId}</p>
      )}
      {call.retryOf && (
        <p className="mx-call-note">
          重试自 {call.retryOf} · 超时由 3 秒调整为 10 秒
        </p>
      )}
      <DataBlock label="发送的参数" value={call.arguments} />
      <ArrowDown className="mx-data-arrow" size={15} />
      <DataBlock label="收到的完整模拟结果" value={call.result} />
      <button className="mx-link-button" onClick={() => onCorrelate(call.id)}>
        <Link2 size={13} />
        追踪这次调用的完整链路
        <ArrowRight size={13} />
      </button>
    </article>
  );
}

export function downloadMockSession(session: MockRuntimeSession) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(session, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${session.id}-${session.turnId}.mock.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function CodexMockDetails({
  session,
  node,
  onCorrelate,
}: {
  session: MockRuntimeSession;
  node: MockNodeId;
  onCorrelate: (id: string) => void;
}) {
  const events = mockEventsForNode(session, node);
  const find = (name: string) => events.find((event) => event.name === name);
  const eventView = (event: MockRuntimeEvent | undefined) =>
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
  return (
    <div className="mx-node-details">
      <div className="mx-session-strip">
        <span>MOCK · {session.id}</span>
        <span>{session.turnId}</span>
        <span>{events.length} 条关联事件</span>
      </div>
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
              <b>{session.usage.inputTokens.toLocaleString()}</b>
            </span>
            <span>
              输出 token<b>{session.usage.outputTokens.toLocaleString()}</b>
            </span>
            <span>
              缓存输入（计入输入）
              <b>{session.usage.cachedInputTokens.toLocaleString()}</b>
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
                <span>输入 {round.inputTokens}</span>
                <span>缓存 {round.cachedInputTokens}</span>
                <span>输出 {round.outputTokens}</span>
              </div>
              <DataBlock label="Agent 可见响应" value={round.response} />
              <DataBlock
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
              />
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
          {node === "search" && (
            <p className="mx-note">
              这次会话有两种搜索：rg 枚举工作区文件；documentation MCP 查询
              React 官方文档。下面分别展示参数与结果。
            </p>
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
