import type { RuntimeEvent } from "../types/runtime";
import { runtimeFlow, type RuntimeFlow } from "./runtimeFlow";

const ACTIVE_DURATION_MS = 900;
const RETENTION_MS = 3600;
const MAX_CUES = 6;

function eventKey(event: RuntimeEvent) { return `${event.id}\u0000${event.status}`; }
function eventId(key: string) { return key.slice(0, key.lastIndexOf("\u0000")); }

export type RuntimeVisualObservation = {
  provider: string;
  sessionId: string;
  turnId: string;
  /** 当前回合的已观测事件；仅以其 id + status 判断是否为新增证据。 */
  events?: RuntimeEvent[];
  /** 兼容仅能提供单条事件的调用方。 */
  latestEvent?: RuntimeEvent;
  /** 仅由已采集 metadata 构成，用于判断快照是否真的变化。 */
  metadataKey?: string;
  modelRequestCount: number | null;
  isLiveSession?: boolean;
  /** 由视图在已有 live 回合切换到新回合时传入。 */
  liveNewTurn?: boolean;
};

export type RuntimeVisualCue = {
  id: string;
  flow: RuntimeFlow;
  source: "observed" | "derived";
  evidence: "runtime-event" | "metadata" | "model-request";
  durationMs: number;
  retentionMs: number;
  startsAt: number;
  endsAt: number;
  retainUntil: number;
  event?: RuntimeEvent;
};

export type RuntimeVisualPlayback = {
  identity: string;
  latestEventId?: string;
  seenEventKeys: string[];
  metadataKey?: string;
  modelRequestCount: number | null;
  isLiveSession: boolean;
  cues: RuntimeVisualCue[];
};

function identityOf(observation: RuntimeVisualObservation) {
  return `${observation.provider}:${observation.sessionId}:${observation.turnId}`;
}

function cue(id: string, flow: RuntimeFlow, source: RuntimeVisualCue["source"], evidence: RuntimeVisualCue["evidence"], startsAt: number, event?: RuntimeEvent): RuntimeVisualCue {
  const endsAt = startsAt + ACTIVE_DURATION_MS;
  return { id, flow, source, evidence, durationMs: ACTIVE_DURATION_MS, retentionMs: RETENTION_MS, startsAt, endsAt, retainUntil: endsAt + RETENTION_MS, event };
}

/** 首次加载只记录已知证据，避免把历史事件当作刚发生的活动。 */
export function createRuntimeVisualPlayback(observation: RuntimeVisualObservation): RuntimeVisualPlayback {
  return {
    identity: identityOf(observation),
    latestEventId: observation.latestEvent?.id,
    seenEventKeys: (observation.events ?? (observation.latestEvent ? [observation.latestEvent] : [])).map(eventKey),
    metadataKey: observation.metadataKey,
    modelRequestCount: observation.modelRequestCount,
    isLiveSession: Boolean(observation.isLiveSession),
    cues: [],
  };
}

/**
 * 将新增的真实证据转为短暂视觉提示。提示不写回 RuntimeEvent，因此不会被当作 Hook、请求或日志记录。
 */
export function advanceRuntimeVisualPlayback(previous: RuntimeVisualPlayback, observation: RuntimeVisualObservation, now: number): RuntimeVisualPlayback {
  const identity = identityOf(observation);
  const newTurn = previous.identity !== identity && observation.liveNewTurn;
  if (previous.identity !== identity && !newTurn) return createRuntimeVisualPlayback(observation);

  const baseline = previous.identity !== identity
    ? { ...createRuntimeVisualPlayback({ ...observation, events: [], latestEvent: undefined, metadataKey: undefined, modelRequestCount: null }), cues: [] }
    : previous;

  const retained = baseline.cues.filter(item => item.endsAt <= now && item.retainUntil > now).slice(-MAX_CUES);
  const active = baseline.cues.find(item => item.startsAt <= now && item.endsAt > now);
  const pending = baseline.cues.filter(item => item.startsAt > now);
  const additions: RuntimeVisualCue[] = [];
  const events = observation.events ?? (observation.latestEvent ? [observation.latestEvent] : []);
  const seen = new Set(baseline.seenEventKeys);
  for (const event of events) {
    const key = eventKey(event);
    if (seen.has(key)) continue;
    const flow = runtimeFlow(event);
    if (flow) additions.push(cue(`event:${key}`, flow, "observed", "runtime-event", now, event));
  }

  const metadataChanged = Boolean(observation.metadataKey && (newTurn || observation.metadataKey !== baseline.metadataKey));
  if (metadataChanged) additions.push(cue(`metadata:${observation.metadataKey}`, { from: "context", to: "prompt" }, "derived", "metadata", now));

  const requestCountIncreased = observation.modelRequestCount !== null
    && observation.modelRequestCount > 0
    && (newTurn || baseline.modelRequestCount === null || observation.modelRequestCount > baseline.modelRequestCount);
  if (requestCountIncreased) additions.push(cue(`model-request:${observation.modelRequestCount}`, { from: "prompt", to: "model" }, "derived", "model-request", now));

  const observedInput = additions.find(item => item.flow.from === "input");
  const derivedContext = additions.find(item => item.evidence === "metadata");
  const derivedRequest = additions.find(item => item.evidence === "model-request");
  const primary = [observedInput, derivedContext, derivedRequest].filter((item): item is RuntimeVisualCue => Boolean(item));
  // 留亮不占待播容量；新主阶段可替换尚未开始的密集工具动效，当前传输保持完整。
  const prioritized = [...primary, ...pending, ...additions.filter(item => !primary.includes(item))].slice(0, MAX_CUES - (active ? 1 : 0));
  let nextStart = active?.endsAt ?? now;
  const scheduled = prioritized.map(item => {
    const next = { ...item, startsAt: nextStart, endsAt: nextStart + ACTIVE_DURATION_MS, retainUntil: nextStart + ACTIVE_DURATION_MS + RETENTION_MS };
    nextStart = next.endsAt;
    return next;
  });
  return {
    identity,
    latestEventId: observation.latestEvent?.id ?? events.at(-1)?.id,
    seenEventKeys: [...new Set([
      ...baseline.seenEventKeys.filter(key => events.some(event => event.id === eventId(key))),
      ...events.map(eventKey),
    ])],
    metadataKey: observation.metadataKey,
    modelRequestCount: observation.modelRequestCount,
    isLiveSession: Boolean(observation.isLiveSession),
    cues: [...retained, ...(active ? [active] : []), ...scheduled],
  };
}

export function currentRuntimeVisualCue(playback: RuntimeVisualPlayback, now: number): { cue: RuntimeVisualCue; active: boolean } | undefined {
  const active = playback.cues.find(item => now >= item.startsAt && now < item.endsAt);
  if (active) return { cue: active, active: true };
  const retained = playback.cues.filter(item => now >= item.startsAt && now < item.retainUntil).at(-1);
  return retained ? { cue: retained, active: false } : undefined;
}
