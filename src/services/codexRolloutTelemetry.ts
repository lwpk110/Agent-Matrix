import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { CodexRolloutTelemetry } from '../types/codexTelemetry';

type Usage = NonNullable<CodexRolloutTelemetry['turnUsage']>;
type RequestUsage = NonNullable<CodexRolloutTelemetry['latestRequest']>;
type Turn = {
  model: string | null;
  reasoningEffort: string | null;
  responseIds: Set<string>;
  usage: Usage | null;
  latestRequest: RequestUsage | null;
  contextWindowTokens: number | null;
};
type RolloutState = {
  sessionId: string;
  matched: boolean;
  activeTurnId: string;
  turns: Map<string, Turn>;
};
type FileCache = { offset: number; state: RolloutState };

const cache = new Map<string, FileCache>();
const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]{8,128}$/;

function numberField(record: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  }
  return null;
}

function stringField(record: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 160);
  }
  return null;
}

function usageFrom(value: unknown): Usage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const inputTokens = numberField(record, 'input_tokens', 'inputTokens');
  const outputTokens = numberField(record, 'output_tokens', 'outputTokens');
  if (inputTokens === null && outputTokens === null) return null;
  return {
    inputTokens,
    cachedInputTokens: numberField(record, 'cached_input_tokens', 'cachedInputTokens'),
    outputTokens,
    reasoningTokens: numberField(record, 'reasoning_output_tokens', 'reasoningTokens'),
    totalTokens: numberField(record, 'total_tokens', 'totalTokens'),
  };
}

function requestUsageFrom(value: unknown): RequestUsage | null {
  const usage = usageFrom(value);
  if (!usage) return null;
  return {
    inputTokens: usage.inputTokens,
    cachedInputTokens: usage.cachedInputTokens,
    outputTokens: usage.outputTokens,
    reasoningTokens: usage.reasoningTokens,
  };
}

function emptyTurn(): Turn {
  return { model: null, reasoningEffort: null, responseIds: new Set(), usage: null, latestRequest: null, contextWindowTokens: null };
}

function ensureTurn(state: RolloutState, turnId: string): Turn {
  const existing = state.turns.get(turnId);
  if (existing) return existing;
  const turn = emptyTurn();
  state.turns.set(turnId, turn);
  return turn;
}

function parseLine(line: string, state: RolloutState) {
  let item: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(line);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
    item = parsed as Record<string, unknown>;
  } catch {
    return;
  }

  const type = item.type;
  const payload = item.payload && typeof item.payload === 'object' && !Array.isArray(item.payload)
    ? item.payload as Record<string, unknown>
    : {};

  if (type === 'session_meta') {
    state.matched = payload.session_id === state.sessionId || payload.id === state.sessionId;
    return;
  }
  if (!state.matched) return;

  if (type === 'turn_context') {
    const turnId = stringField(payload, 'turn_id');
    if (!turnId) return;
    state.activeTurnId = turnId;
    const turn = ensureTurn(state, turnId);
    turn.model = stringField(payload, 'model') || turn.model;
    turn.reasoningEffort = stringField(payload, 'effort', 'reasoning_effort') || turn.reasoningEffort;
    return;
  }

  if (type === 'token_usage_record') {
    if (payload.session_id !== state.sessionId) return;
    const turnId = stringField(payload, 'turn_id');
    if (!turnId) return;
    const turn = ensureTurn(state, turnId);
    const responseId = stringField(payload, 'response_id');
    if (responseId) turn.responseIds.add(responseId);
    turn.usage = usageFrom(payload.turn_token_usage) || usageFrom(payload.usage) || turn.usage;
    return;
  }

  if (type === 'event_msg' && payload.type === 'token_count') {
    const info = payload.info && typeof payload.info === 'object' && !Array.isArray(payload.info)
      ? payload.info as Record<string, unknown>
      : {};
    const turnId = state.activeTurnId;
    if (!turnId) return;
    const turn = ensureTurn(state, turnId);
    turn.latestRequest = requestUsageFrom(info.last_token_usage) || turn.latestRequest;
    turn.contextWindowTokens = numberField(info, 'model_context_window') ?? turn.contextWindowTokens;
  }
}

function createState(sessionId: string): RolloutState {
  return { sessionId, matched: false, activeTurnId: '', turns: new Map() };
}

async function findRolloutFiles(root: string, sessionId: string): Promise<string[]> {
  const matches: string[] = [];
  const visit = async (directory: string) => {
    let entries: fs.Dirent[];
    try { entries = await fs.promises.readdir(directory, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(candidate);
      else if (entry.isFile() && entry.name.endsWith('.jsonl') && entry.name.includes(sessionId)) matches.push(candidate);
    }
  };
  await visit(root);
  return matches;
}

async function readCachedRollout(filePath: string, sessionId: string): Promise<FileCache> {
  const stat = await fs.promises.stat(filePath);
  let entry = cache.get(filePath);
  if (!entry || stat.size < entry.offset) {
    entry = { offset: 0, state: createState(sessionId) };
    cache.set(filePath, entry);
  }
  if (stat.size === entry.offset) return entry;

  const handle = await fs.promises.open(filePath, 'r');
  try {
    const length = stat.size - entry.offset;
    const chunk = Buffer.allocUnsafe(length);
    const { bytesRead } = await handle.read(chunk, 0, length, entry.offset);
    const completeBytes = chunk.subarray(0, bytesRead);
    const lastNewline = completeBytes.lastIndexOf(0x0a);
    if (lastNewline < 0) return entry;
    const text = completeBytes.subarray(0, lastNewline).toString('utf8');
    for (const line of text.split(/\r?\n/)) if (line) parseLine(line, entry.state);
    entry.offset += lastNewline + 1;
  } finally {
    await handle.close();
  }
  return entry;
}

export async function readCodexRolloutTelemetry(
  sessionId: string,
  requestedTurnId?: string,
  root = path.join(os.homedir(), '.codex', 'sessions'),
): Promise<CodexRolloutTelemetry | null> {
  if (!SESSION_ID_PATTERN.test(sessionId)) return null;
  const files = await findRolloutFiles(root, sessionId);
  const candidates = await Promise.all(files.map(async (filePath) => {
    try {
      return { filePath, modified: (await fs.promises.stat(filePath)).mtimeMs };
    } catch {
      return null;
    }
  }));
  const file = candidates.filter((candidate): candidate is { filePath: string; modified: number } => candidate !== null)
    .sort((a, b) => b.modified - a.modified)[0];
  if (!file) return null;

  const entry = await readCachedRollout(file.filePath, sessionId);
  if (!entry.state.matched) return null;
  const turnId = requestedTurnId || entry.state.activeTurnId;
  const turn = entry.state.turns.get(turnId);
  if (!turn) return null;
  return {
    sessionId,
    turnId,
    model: turn.model,
    reasoningEffort: turn.reasoningEffort,
    modelRequestCount: turn.responseIds.size || null,
    turnUsage: turn.usage,
    latestRequest: turn.latestRequest,
    contextWindowTokens: turn.contextWindowTokens,
  };
}
