import type { LogEntry } from "../types/matrix";
import { readablePrompt } from "./codexRuntimeAdapter";

export type PromptTraceStatus = "received" | "processing" | "completed";
export type PromptTrace = {
  id: string;
  turnId: string;
  prompt: string;
  timestamp: string;
  status: PromptTraceStatus;
  evidence: string;
};
export type PromptObservation = Omit<PromptTrace, "prompt">;

const WORK_EVENTS = /^(PreToolUse|PostToolUse|AppServerCommandExecution|AppServerMcpToolCall|AppServerDynamicToolCall|AppServerWebSearch|PermissionRequest)$/;
const END_EVENTS = /^(Stop|AppServerFinalAnswer|TurnCompleted)$/;

function payloadOf(log: LogEntry): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(log.runtimeEvent?.details || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const record = parsed as Record<string, unknown>;
    const nested = record.payload;
    return nested && typeof nested === "object" && !Array.isArray(nested)
      ? { ...(nested as Record<string, unknown>), ...record }
      : record;
  } catch {
    return {};
  }
}

export function promptTraces(logs: LogEntry[], sessionId: string, turnId?: string | number, provider?: string, limit = 8): PromptTrace[] {
  if (typeof turnId === "number") { limit = turnId; turnId = undefined; }
  const sessionLogs = logs.filter(log => log.runtimeEvent?.sessionId === sessionId && (!turnId || !log.runtimeEvent?.turnId || log.runtimeEvent.turnId === turnId) && (!provider || log.runtimeEvent?.provider === provider));
  const candidates = sessionLogs.map((log, index) => ({ log, index, prompt: readablePrompt(payloadOf(log).prompt) }))
    .filter(({ log }) => log.runtimeEvent?.eventName === "UserPromptSubmit");
  const prompts = candidates.filter((candidate, index) => {
    const event = candidate.log.runtimeEvent!;
    return !candidates.slice(index + 1).some(next => {
      const nextEvent = next.log.runtimeEvent!;
      const duplicateSources = event.source !== nextEvent.source;
      return duplicateSources && event.turnId === nextEvent.turnId && candidate.prompt === next.prompt;
    });
  });

  return prompts.slice(-limit).map(({ log, index, prompt: readable }, promptIndex) => {
    const event = log.runtimeEvent!;
    const nextPrompt = prompts.find(prompt => prompt.index > index)?.index ?? sessionLogs.length;
    const later = sessionLogs.slice(index + 1, nextPrompt)
      .filter(candidate => !candidate.runtimeEvent?.turnId || candidate.runtimeEvent.turnId === event.turnId);
    const end = later.find(candidate => END_EVENTS.test(candidate.runtimeEvent?.eventName || ""));
    const work = later.find(candidate => WORK_EVENTS.test(candidate.runtimeEvent?.eventName || "") ||
      candidate.runtimeEvent?.phase === "started" || candidate.runtimeEvent?.phase === "permission");
    const payload = payloadOf(log);
    const rawPrompt = typeof payload.prompt === "string" ? payload.prompt : "";
    const prompt = readable || (rawPrompt ? "[包含非文本内容]" : "[提示词正文未采集]");
    const status: PromptTraceStatus = end ? "completed" : work ? "processing" : "received";
    const evidence = end?.runtimeEvent?.eventName || work?.runtimeEvent?.eventName || "UserPromptSubmit";

    return {
      id: event.eventId || `${event.turnId || "turn"}-${index}-${promptIndex}`,
      turnId: event.turnId || "未关联回合",
      prompt,
      timestamp: event.timestamp || log.timestamp,
      status,
      evidence,
    };
  }).reverse();
}

/** 仅投影生命周期元数据，供不允许展示提示词正文的运行时使用。 */
export function promptObservations(logs: LogEntry[], sessionId: string, turnId?: string | number, provider?: string, limit = 8): PromptObservation[] {
  if (typeof turnId === "number") { limit = turnId; turnId = undefined; }
  const sessionLogs = logs.filter(log => log.runtimeEvent?.sessionId === sessionId && (!turnId || !log.runtimeEvent?.turnId || log.runtimeEvent.turnId === turnId) && (!provider || log.runtimeEvent?.provider === provider));
  const prompts = sessionLogs.map((log, index) => ({ log, index })).filter(({ log }) => log.runtimeEvent?.eventName === "UserPromptSubmit");
  return prompts.slice(-limit).map(({ log, index }) => {
    const event = log.runtimeEvent!;
    const nextPrompt = prompts.find(prompt => prompt.index > index)?.index ?? sessionLogs.length;
    const later = sessionLogs.slice(index + 1, nextPrompt).filter(candidate => !candidate.runtimeEvent?.turnId || candidate.runtimeEvent?.turnId === event.turnId);
    const end = later.find(candidate => END_EVENTS.test(candidate.runtimeEvent?.eventName || ""));
    const work = later.find(candidate => WORK_EVENTS.test(candidate.runtimeEvent?.eventName || "") || candidate.runtimeEvent?.phase === "started" || candidate.runtimeEvent?.phase === "permission");
    const evidence = end?.runtimeEvent?.eventName || work?.runtimeEvent?.eventName || "UserPromptSubmit";
    return {
      id: event.eventId || `${event.turnId || "turn"}-${index}`,
      turnId: event.turnId || "未关联回合",
      timestamp: event.timestamp || log.timestamp,
      status: end ? "completed" as const : work ? "processing" as const : "received" as const,
      evidence: evidence === "UserPromptSubmit" ? evidence : `UserPromptSubmit -> ${evidence}`,
    };
  }).reverse();
}
