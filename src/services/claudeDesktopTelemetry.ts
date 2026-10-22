import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { RuntimeTelemetry } from '../types/runtime';

export type ClaudeTelemetrySource = 'claude-desktop' | 'claude-code';
type InternalSource = ClaudeTelemetrySource | 'unknown';
export type ClaudeTelemetryStatus = 'ready' | 'missing' | 'unavailable' | 'disabled';
export type ClaudeTurnUsage = NonNullable<RuntimeTelemetry['turnUsage']> & { nativeInputTokens?: number | null; cacheCreationInputTokens?: number | null; cacheReadInputTokens?: number | null; usageSemantics?: 'native-input-plus-cache-creation-plus-cache-read' };
export interface ClaudeTelemetrySession extends RuntimeTelemetry { source: ClaudeTelemetrySource; sessionId: string; turnId: string; turnUsage: ClaudeTurnUsage | null; durationMs: number | null; timestamp: string | null; }
export interface ClaudeTelemetrySnapshot { status: ClaudeTelemetryStatus; sessions: ClaudeTelemetrySession[]; partial?: boolean; truncated?: boolean; }
type HookTurn = { sessionId?: string; turnId?: string; hookEventName?: string; timestamp?: string; cwd?: string; payload?: Record<string, unknown> };
type Usage = { inputTokens: number | null; cacheCreationTokens: number | null; cachedInputTokens: number | null; outputTokens: number | null; reasoningTokens: number | null; totalTokens: number | null };
type ToolCall = { callId: string; name: string; resultObserved: boolean; isError: boolean | null; observedAt: string | null };
type TurnState = { promptId: string | null; source: InternalSource; model: string | null; effort: string | null; requests: Map<string, { usage: Usage | null; timestamp: string | null; node: Node }>; durationMs: number | null; timestamp: string | null; nodes: Node[] };
type Node = { sessionId: string; uuid: string; parentUuid: string | null; type: string; isUserBoundary: boolean; promptId: string | null; timestamp: string | null; source: InternalSource; model: string | null; effort: string | null; requestId: string | null; usage: Usage | null; durationMs: number | null; instructionFileCount: number | null; systemSegmentCount: number | null; toolDefinitionCount: number | null; toolCalls: ToolCall[]; toolResults: Array<{ callId: string; isError: boolean | null }> };
type FileCache = { offset: number; size: number; inode: number; mtimeMs: number; ctimeMs: number; nodes: Node[]; lastSeen: number };
type SkippedFile = { size: number; mtimeMs: number; ctimeMs: number; lastSeen: number };
type Options = { root?: string; disabled?: boolean };
export type ClaudeProjectMemoryMetadata = NonNullable<RuntimeTelemetry['memoryMetadata']>;
type MemoryOptions = { root?: string; cwd: string };

const DEFAULT_ROOT = path.join(os.homedir(), '.claude', 'projects');
const MAX_DIRECTORIES = 80, MAX_FILES = 160, MAX_CANDIDATES = 640, MAX_FILE_BYTES_PER_READ = 512 * 1024, MAX_TOTAL_BYTES_PER_SCAN = 2 * 1024 * 1024, MAX_NODES_PER_FILE = 3000, MAX_CACHE_NODES = 24_000, MAX_TEXT_BYTES = 160;
const cache = new Map<string, FileCache>();
const skipped = new Map<string, SkippedFile>();
let scanGeneration = 0;
const stringField = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim().slice(0, MAX_TEXT_BYTES) : null;
const numberField = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const object = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

function usageFrom(value: unknown): Usage | null {
  const source = object(value); if (!source) return null;
  const outputDetails = object(source.output_tokens_details) ?? {};
  const usage = { inputTokens: numberField(source.input_tokens ?? source.inputTokens), cacheCreationTokens: numberField(source.cache_creation_input_tokens ?? source.cacheCreationInputTokens), cachedInputTokens: numberField(source.cache_read_input_tokens ?? source.cacheReadInputTokens ?? source.cached_input_tokens ?? source.cachedInputTokens), outputTokens: numberField(source.output_tokens ?? source.outputTokens), reasoningTokens: numberField(source.reasoning_output_tokens ?? source.reasoningTokens ?? outputDetails.thinking_tokens), totalTokens: numberField(source.total_tokens ?? source.totalTokens) };
  return Object.values(usage).some(value => value !== null) ? usage : null;
}
function sourceFrom(entrypoint: string | null): InternalSource { return entrypoint === 'claude-desktop-3p' ? 'claude-desktop' : entrypoint === 'cli' || entrypoint === 'sdk-cli' ? 'claude-code' : 'unknown'; }
function hasUserInput(record: Record<string, unknown>, message: Record<string, unknown>) {
  if (record.isMeta === true || record.toolUseResult !== undefined || record.tool_result !== undefined) return false;
  const content = message.content;
  if (typeof content === 'string') return true;
  return Array.isArray(content) && content.some(block => object(block)?.type === 'text');
}
function arrayCount(value: unknown): number | null { return Array.isArray(value) ? value.length : null; }
function countInstructionFiles(value: unknown): number | null { const source = object(value); return source ? arrayCount(source.files) : null; }
function snapshotCounts(value: unknown) { const source = object(value); return { systemSegmentCount: source ? arrayCount(source.systemPrompt ?? source.system_prompt) : null, toolDefinitionCount: source ? arrayCount(source.tools) : null }; }
function contentBlocks(value: unknown): Record<string, unknown>[] { return Array.isArray(value) ? value.flatMap(item => object(item) ? [item] : []) : []; }
function toolCallsFrom(message: Record<string, unknown>): ToolCall[] { return contentBlocks(message.content).flatMap(block => block.type === 'tool_use' && stringField(block.id) && stringField(block.name) ? [{ callId: stringField(block.id)!, name: stringField(block.name)!, resultObserved: false, isError: null, observedAt: null }] : []); }
function toolResultsFrom(message: Record<string, unknown>): Array<{ callId: string; isError: boolean | null }> { return contentBlocks(message.content).flatMap(block => { const callId = block.type === 'tool_result' ? stringField(block.tool_use_id ?? block.toolUseId) : null; return callId ? [{ callId, isError: typeof block.is_error === 'boolean' ? block.is_error : null }] : []; }); }

/** 只提取聚合需要的字段；正文、工具结果、路径和原始 JSON 均不进入缓存。 */
function parseNode(line: string): Node | null {
  let record: Record<string, unknown>;
  try { record = object(JSON.parse(line)) ?? {}; } catch { return null; }
  const sessionId = stringField(record.sessionId ?? record.session_id), uuid = stringField(record.uuid), rawType = stringField(record.type);
  const type = rawType === 'api_response' ? 'assistant' : rawType;
  if (!sessionId || !uuid || !type) return null;
  const message = object(record.message) ?? object(record.response) ?? {}, metadata = object(record.metadata) ?? {};
  const isUserBoundary = rawType === 'user' && hasUserInput(record, message);
  const isTurnDuration = rawType === 'system' && stringField(record.subtype) === 'turn_duration';
  const attachment = object(record.attachment) ?? {};
  const attachmentType = stringField(attachment.type);
  const snapshot = snapshotCounts(record.prompt_snapshot ?? record.promptSnapshot ?? (attachmentType === 'prompt_snapshot' ? attachment : undefined));
  return { sessionId, uuid, parentUuid: stringField(record.parentUuid ?? record.parent_uuid), type, isUserBoundary, promptId: stringField(record.promptId ?? record.prompt_id), timestamp: stringField(record.timestamp), source: sourceFrom(stringField(record.entrypoint ?? metadata.entrypoint)), model: stringField(message.model ?? record.model), effort: stringField(record.effort ?? record.reasoning_effort ?? metadata.effort ?? metadata.reasoning_effort), requestId: stringField(message.id), usage: usageFrom(message.usage ?? record.usage), durationMs: isTurnDuration ? numberField(record.durationMs ?? record.duration_ms) : null, instructionFileCount: countInstructionFiles(record.instructions ?? (attachmentType === 'instructions' ? attachment : undefined)), systemSegmentCount: snapshot.systemSegmentCount, toolDefinitionCount: snapshot.toolDefinitionCount, toolCalls: toolCallsFrom(message), toolResults: toolResultsFrom(message) };
}

function productionRoot(): { root: string | null; status: ClaudeTelemetryStatus } {
  if (process.env.CLAUDE_DESKTOP_TELEMETRY_DISABLED === '1') return { root: null, status: 'disabled' };
  try {
    if (!fs.existsSync(DEFAULT_ROOT)) return { root: null, status: 'missing' };
    const home = fs.realpathSync(os.homedir()), root = fs.realpathSync(DEFAULT_ROOT), expected = path.join(home, '.claude', 'projects');
    return root === expected && fs.statSync(root).isDirectory() ? { root, status: 'ready' } : { root: null, status: 'unavailable' };
  } catch { return { root: null, status: 'unavailable' }; }
}

function safeFiles(root: string): string[] {
  const rootReal = fs.realpathSync(root), files: string[] = [];
  let directories = 0;
  const visit = (directory: string, depth: number) => {
    if (depth > 2 || directories++ >= MAX_DIRECTORIES || files.length >= MAX_CANDIDATES) return;
    let entries: fs.Dirent[]; try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (files.length >= MAX_CANDIDATES) break;
      const candidate = path.join(directory, entry.name);
      try {
        const stat = fs.lstatSync(candidate); if (stat.isSymbolicLink()) continue;
        if (stat.isDirectory()) { const real = fs.realpathSync(candidate); if (real.startsWith(`${rootReal}${path.sep}`)) visit(real, depth + 1); }
        else if (stat.isFile() && entry.name.endsWith('.jsonl') && stat.size > 0) files.push(candidate);
      } catch { /* 单个不可读文件不应影响其他会话。 */ }
    }
  };
  visit(rootReal, 0);
  return files.sort((left, right) => {
    try { return fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs; } catch { return 0; }
  }).slice(0, MAX_FILES);
}

function cacheKey(filePath: string) { return createHash('sha256').update(filePath).digest('base64url'); }
function updateFile(filePath: string, byteBudget: { value: number }, generation: number): Node[] {
  const stat = fs.statSync(filePath), key = cacheKey(filePath); let entry = cache.get(key);
  if (!entry || stat.size < entry.offset || stat.ino !== entry.inode || (stat.size === entry.offset && (stat.mtimeMs !== entry.mtimeMs || stat.ctimeMs !== entry.ctimeMs))) entry = { offset: 0, size: stat.size, inode: stat.ino, mtimeMs: stat.mtimeMs, ctimeMs: stat.ctimeMs, nodes: [], lastSeen: generation };
  entry.size = stat.size;
  entry.lastSeen = generation;
  if (stat.size === entry.offset) { cache.set(key, entry); return entry.nodes; }
  if (byteBudget.value <= 0) return entry.nodes;
  const length = Math.min(MAX_FILE_BYTES_PER_READ, byteBudget.value, stat.size - entry.offset), fd = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.allocUnsafe(length), read = fs.readSync(fd, buffer, 0, length, entry.offset), bytes = buffer.subarray(0, read), lastNewline = bytes.lastIndexOf(0x0a);
    if (lastNewline < 0) {
      // 正在写入的普通半行下次从原位置重读；超过单次预算的超长行则跳过，避免缓存正文。
      if (read === MAX_FILE_BYTES_PER_READ && stat.size > length) entry.offset += read;
      entry.mtimeMs = stat.mtimeMs; entry.ctimeMs = stat.ctimeMs; byteBudget.value -= read;
      cache.set(key, entry);
      return entry.nodes;
    }
    for (const line of bytes.subarray(0, lastNewline).toString('utf8').split(/\r?\n/)) { const node = parseNode(line); if (node) entry.nodes.push(node); }
    // 不保存半行原文；下轮从该换行位置重读，避免损坏 JSON 误入统计。
    entry.offset += lastNewline + 1; entry.mtimeMs = stat.mtimeMs; entry.ctimeMs = stat.ctimeMs; byteBudget.value -= read;
  } finally { fs.closeSync(fd); }
  trimCompleteTurns(entry.nodes);
  cache.set(key, entry); return entry.nodes;
}

/** 超额时只丢弃完整的最旧用户回合，保留任一仍在缓存中节点的全部祖先。 */
function trimCompleteTurns(nodes: Node[]) {
  if (nodes.length <= MAX_NODES_PER_FILE) return;
  const byId = new Map(nodes.map(node => [node.uuid, node]));
  const rootId = (node: Node) => { let current: Node | undefined = node; const seen = new Set<string>(); while (current && !seen.has(current.uuid)) { seen.add(current.uuid); if (current.isUserBoundary) return current.uuid; current = current.parentUuid ? byId.get(current.parentUuid) : undefined; } return null; };
  const groups = new Map<string, Node[]>();
  for (const node of nodes) { const key = rootId(node); if (key) groups.set(key, [...(groups.get(key) ?? []), node]); }
  let retained = new Set(nodes);
  for (const [turnId, group] of groups) {
    if (retained.size <= MAX_NODES_PER_FILE) break;
    // 仅存在多个完整回合时淘汰，长单回合宁可保留以免切断 parent tree。
    if (groups.size > 1) for (const node of group) retained.delete(node);
    groups.delete(turnId);
  }
  if (retained.size !== nodes.length) nodes.splice(0, nodes.length, ...nodes.filter(node => retained.has(node)));
}

function aggregate(nodes: Node[]): ClaudeTelemetrySession[] {
  const sessions = new Map<string, Map<string, Node>>();
  for (const node of nodes) { const map = sessions.get(node.sessionId) ?? new Map<string, Node>(); sessions.set(node.sessionId, map); if (!map.has(node.uuid)) map.set(node.uuid, node); }
  const output: ClaudeTelemetrySession[] = [];
  for (const [sessionId, map] of sessions) {
    const resolvedUsers = new Map<string, Node | null>();
    const userFor = (node: Node): Node | null => {
      const known = resolvedUsers.get(node.uuid); if (known !== undefined) return known;
      const trail: Node[] = []; let current: Node | undefined = node; const seen = new Set<string>(); let resolved: Node | null = null;
      while (current && !seen.has(current.uuid)) {
        const cached = resolvedUsers.get(current.uuid);
        if (cached !== undefined) { resolved = cached; break; }
        seen.add(current.uuid); trail.push(current);
        if (current.isUserBoundary) { resolved = current; break; }
        current = current.parentUuid ? map.get(current.parentUuid) : undefined;
      }
      for (const item of trail) resolvedUsers.set(item.uuid, resolved);
      return resolved;
    };
    const turns = new Map<string, TurnState>();
    for (const node of map.values()) {
      const user = userFor(node); if (!user) continue;
      const state = turns.get(user.uuid) ?? { promptId: user.promptId, source: user.source, model: null, effort: null, requests: new Map<string, { usage: Usage | null; timestamp: string | null; node: Node }>(), durationMs: null, timestamp: user.timestamp, nodes: [] }; turns.set(user.uuid, state);
      state.nodes.push(node);
      if (state.source === 'unknown' && node.source !== 'unknown') state.source = node.source;
      if (node.type === 'system' && node.durationMs !== null) state.durationMs = Math.max(state.durationMs ?? 0, node.durationMs);
      if (node.type !== 'assistant' || !node.requestId) continue;
      const prior = state.requests.get(node.requestId);
      if (!prior) state.requests.set(node.requestId, { usage: node.usage, timestamp: node.timestamp, node });
      else if (node.usage) state.requests.set(node.requestId, { node: prior.node, timestamp: prior.timestamp, usage: {
        inputTokens: node.usage.inputTokens ?? prior.usage?.inputTokens ?? null,
        cacheCreationTokens: node.usage.cacheCreationTokens ?? prior.usage?.cacheCreationTokens ?? null,
        cachedInputTokens: node.usage.cachedInputTokens ?? prior.usage?.cachedInputTokens ?? null,
        outputTokens: node.usage.outputTokens ?? prior.usage?.outputTokens ?? null,
        reasoningTokens: node.usage.reasoningTokens ?? prior.usage?.reasoningTokens ?? null,
        totalTokens: node.usage.totalTokens ?? prior.usage?.totalTokens ?? null,
      } });
      state.model = node.model ?? state.model; state.effort = node.effort ?? state.effort;
    }
    for (const [turnId, state] of turns) {
      const requestRecords = [...state.requests.values()].sort((left, right) => (left.timestamp ?? '').localeCompare(right.timestamp ?? ''));
      const requests = requestRecords.map(request => request.usage);
      const requestUsage = requestRecords.slice(-20).map(({ usage }) => {
        const hasCompleteInput = usage?.inputTokens !== null && usage?.inputTokens !== undefined && usage.cacheCreationTokens !== null && usage.cacheCreationTokens !== undefined && usage.cachedInputTokens !== null && usage.cachedInputTokens !== undefined;
        return {
          inputTokens: hasCompleteInput ? usage.inputTokens! + usage.cacheCreationTokens! + usage.cachedInputTokens! : null,
          cachedInputTokens: usage?.cacheCreationTokens !== null && usage?.cacheCreationTokens !== undefined && usage.cachedInputTokens !== null && usage.cachedInputTokens !== undefined ? usage.cacheCreationTokens + usage.cachedInputTokens : null,
          outputTokens: usage?.outputTokens ?? null,
          reasoningTokens: usage?.reasoningTokens ?? null,
        };
      });
      const hasMissingUsage = requests.some(usage => usage === null);
      const usages = requests.filter((usage): usage is Usage => usage !== null);
      const sum = (key: keyof Usage) => usages.some(usage => usage[key] === null) ? null : usages.reduce((total, usage) => total + usage[key]!, 0);
      if (state.source === 'unknown') continue;
      const inputComplete = !hasMissingUsage && sum('inputTokens') !== null && sum('cacheCreationTokens') !== null && sum('cachedInputTokens') !== null;
      const latestRequest = [...state.requests.values()].sort((left, right) => (right.timestamp ?? '').localeCompare(left.timestamp ?? ''))[0];
      const latest = latestRequest?.usage ?? null;
      const latestInput = latest && latest.inputTokens !== null && latest.cacheCreationTokens !== null && latest.cachedInputTokens !== null ? latest.inputTokens + latest.cacheCreationTokens + latest.cachedInputTokens : null;
      const lineage: Node[] = []; let ancestor: Node | undefined = latestRequest?.node;
      while (ancestor && !lineage.some(node => node.uuid === ancestor!.uuid)) { lineage.push(ancestor); ancestor = ancestor.parentUuid ? map.get(ancestor.parentUuid) : undefined; }
      const lineageNodes = lineage;
      const boundaryIndex = lineage.findIndex(node => node.uuid === turnId);
      const scopeFor = (node: Node | undefined): 'session' | 'turn' => node && boundaryIndex >= 0 && lineage.indexOf(node) > boundaryIndex ? 'session' : 'turn';
      const latestMetadata = <K extends 'instructionFileCount' | 'systemSegmentCount' | 'toolDefinitionCount'>(key: K) => lineageNodes.find(node => node[key] !== null);
      const instruction = latestMetadata('instructionFileCount'), system = latestMetadata('systemSegmentCount'), tools = latestMetadata('toolDefinitionCount');
      const toolCalls = new Map<string, ToolCall>();
      const requestNodes = state.nodes.filter(node => node.type === 'assistant' && node.requestId);
      const requestIds = new Set(requestNodes.map(node => node.uuid));
      for (const node of requestNodes) for (const call of node.toolCalls) if (!toolCalls.has(call.callId)) toolCalls.set(call.callId, { ...call, observedAt: node.timestamp });
      for (const node of state.nodes) {
        let current: Node | undefined = node; const seen = new Set<string>(); let descendsFromRequest = false;
        while (current && !seen.has(current.uuid)) { if (requestIds.has(current.uuid)) { descendsFromRequest = true; break; } seen.add(current.uuid); current = current.parentUuid ? map.get(current.parentUuid) : undefined; }
        if (!descendsFromRequest) continue;
        for (const result of node.toolResults) {
          const call = toolCalls.get(result.callId); if (!call) continue;
          const terminalError = call.isError === true;
          toolCalls.set(result.callId, { ...call, resultObserved: true, isError: terminalError ? true : result.isError, observedAt: node.timestamp });
        }
      }
      const item: ClaudeTelemetrySession = { source: state.source, sessionId, turnId, model: state.model, reasoningEffort: state.effort, modelRequestCount: state.requests.size || null, requests: requestUsage, latestRequest: { inputTokens: latestInput }, contextMetadata: { instructionFileCount: instruction?.instructionFileCount ?? null, observedAt: instruction?.timestamp ?? null, source: 'claude-transcript', scope: scopeFor(instruction) }, promptMetadata: { systemSegmentCount: system?.systemSegmentCount ?? null, toolDefinitionCount: tools?.toolDefinitionCount ?? null, observedAt: system?.timestamp ?? tools?.timestamp ?? null, source: 'claude-transcript', scope: scopeFor(system) === 'session' || scopeFor(tools) === 'session' ? 'session' : 'turn' }, toolCallMetadata: [...toolCalls.values()], turnUsage: requests.length ? { inputTokens: inputComplete ? sum('inputTokens')! + sum('cacheCreationTokens')! + sum('cachedInputTokens')! : null, cachedInputTokens: hasMissingUsage ? null : sum('cachedInputTokens'), outputTokens: hasMissingUsage ? null : sum('outputTokens'), reasoningTokens: hasMissingUsage ? null : sum('reasoningTokens'), totalTokens: hasMissingUsage ? null : sum('totalTokens'), nativeInputTokens: hasMissingUsage ? null : sum('inputTokens'), cacheCreationInputTokens: hasMissingUsage ? null : sum('cacheCreationTokens'), cacheReadInputTokens: hasMissingUsage ? null : sum('cachedInputTokens'), usageSemantics: 'native-input-plus-cache-creation-plus-cache-read' } : null, durationMs: state.durationMs, timestamp: state.timestamp };
      // 仅供同进程 Hook 关联，非枚举属性不会跨 REST 边界泄露。
      Object.defineProperty(item, '_promptId', { value: state.promptId, enumerable: false });
      output.push(item);
    }
  }
  return output.sort((left, right) => (right.timestamp ?? '').localeCompare(left.timestamp ?? ''));
}

export function readClaudeDesktopTelemetry(options: Options = {}): ClaudeTelemetrySnapshot {
  if (options.disabled) return { status: 'disabled', sessions: [] };
  let root: string | null = options.root ?? null, status: ClaudeTelemetryStatus = 'ready'; if (!root) ({ root, status } = productionRoot());
  if (!root) return { status, sessions: [] };
  try {
    if (!fs.existsSync(root)) return { status: 'missing', sessions: [] };
    const budget = { value: MAX_TOTAL_BYTES_PER_SCAN }, files = safeFiles(root), generation = ++scanGeneration;
    const sessions = aggregate(files.flatMap(file => {
      const key = cacheKey(file);
      try {
        const stat = fs.statSync(file), omitted = skipped.get(key);
        if (omitted && omitted.size === stat.size && omitted.mtimeMs === stat.mtimeMs && omitted.ctimeMs === stat.ctimeMs) { omitted.lastSeen = generation; return []; }
        skipped.delete(key);
      } catch { return []; }
      return updateFile(file, budget, generation);
    }));
    for (const [key, entry] of cache) if (entry.lastSeen !== generation) cache.delete(key);
    for (const [key, entry] of skipped) if (entry.lastSeen !== generation) skipped.delete(key);
    while ([...cache.values()].reduce((total, entry) => total + entry.nodes.length, 0) > MAX_CACHE_NODES) {
      // mtime 是稳定的新旧顺序；同一轮的 lastSeen 不能用作 LRU，否则会随机先删最新文件。
      const oldest = [...cache.entries()].sort((left, right) => left[1].mtimeMs - right[1].mtimeMs || left[0].localeCompare(right[0]))[0];
      if (!oldest) break;
      cache.delete(oldest[0]);
      skipped.set(oldest[0], { size: oldest[1].size, mtimeMs: oldest[1].mtimeMs, ctimeMs: oldest[1].ctimeMs, lastSeen: generation });
    }
    const partial = budget.value <= 0 && files.some(file => {
      try {
        const key = cacheKey(file);
        if (skipped.has(key)) return false;
        return fs.statSync(file).size > (cache.get(key)?.offset ?? 0);
      } catch { return false; }
    });
    const truncated = [...skipped.values()].some(entry => entry.lastSeen === generation);
    return { status: 'ready', sessions, ...(partial ? { partial: true } : {}), ...(truncated ? { truncated: true } : {}) };
  } catch { return { status: 'unavailable', sessions: [] }; }
}

export function readClaudeDesktopOnlyTelemetry(options: Options = {}): ClaudeTelemetrySnapshot {
  const snapshot = readClaudeDesktopTelemetry(options);
  return { ...snapshot, sessions: snapshot.sessions.filter(item => item.source === 'claude-desktop') };
}

/** 仅按当前 cwd 映射对应项目目录，并读取 memory 文件的 stat；不读取文件正文、名称或路径。 */
export function readClaudeProjectMemoryMetadata({ root, cwd }: MemoryOptions): ClaudeProjectMemoryMetadata {
  if (!cwd || !path.isAbsolute(cwd)) return { status: 'unavailable', fileCount: 0, totalBytes: 0, latestModifiedAt: null };
  const base = root ?? productionRoot().root;
  if (!base) return { status: 'unavailable', fileCount: 0, totalBytes: 0, latestModifiedAt: null };
  try {
    const baseReal = fs.realpathSync(base), projectName = cwd.replace(/[\\/]/g, '-'), project = path.join(baseReal, projectName), memory = path.join(project, 'memory');
    if (!project.startsWith(`${baseReal}${path.sep}`) || !fs.existsSync(project) || !fs.existsSync(memory)) return { status: 'missing', fileCount: 0, totalBytes: 0, latestModifiedAt: null };
    if (fs.lstatSync(project).isSymbolicLink() || fs.lstatSync(memory).isSymbolicLink()) return { status: 'unavailable', fileCount: 0, totalBytes: 0, latestModifiedAt: null };
    const projectReal = fs.realpathSync(project), memoryReal = fs.realpathSync(memory);
    if (!projectReal.startsWith(`${baseReal}${path.sep}`) || memoryReal !== path.join(projectReal, 'memory') || !fs.statSync(memoryReal).isDirectory()) return { status: 'unavailable', fileCount: 0, totalBytes: 0, latestModifiedAt: null };
    let fileCount = 0, totalBytes = 0, latestMs = 0;
    for (const entry of fs.readdirSync(memoryReal, { withFileTypes: true })) {
      const candidate = path.join(memoryReal, entry.name); const stat = fs.lstatSync(candidate);
      if (!stat.isFile() || stat.isSymbolicLink()) continue;
      fileCount++; totalBytes += stat.size; latestMs = Math.max(latestMs, stat.mtimeMs);
    }
    return { status: 'present', fileCount, totalBytes, latestModifiedAt: latestMs ? new Date(latestMs).toISOString() : null };
  } catch { return { status: 'unavailable', fileCount: 0, totalBytes: 0, latestModifiedAt: null }; }
}

/** Hook cwd 是会话归属的唯一可信项目提示；缺失时不回退到服务进程 cwd。 */
export function findClaudeSessionCwd(sessionId: string, history: readonly HookTurn[]): string | null {
  const value = [...history].reverse().find(event => event.sessionId === sessionId && typeof event.cwd === 'string' && path.isAbsolute(event.cwd))?.cwd;
  return value ?? null;
}

function promptId(event: HookTurn): string | null { return stringField(event.payload?.prompt_id ?? event.payload?.promptId); }
/** Hook turnId 与 transcript UUID 分离；只接受显式 prompt id 或唯一的 90 秒时间匹配。 */
export function findClaudeTelemetry(snapshot: ClaudeTelemetrySnapshot, sessionId: string, turnId: string, history: readonly HookTurn[]): RuntimeTelemetry | null {
  if (snapshot.status !== 'ready' || !sessionId || !turnId) return null;
  const event = history.filter(item => item.sessionId === sessionId && item.turnId === turnId && item.hookEventName === 'UserPromptSubmit').at(-1); if (!event) return null;
  const candidates = snapshot.sessions.filter(item => item.sessionId === sessionId), id = promptId(event);
  const matched = id ? candidates.find(item => (item as ClaudeTelemetrySession & { _promptId?: string })._promptId === id) : (() => { const time = Date.parse(event.timestamp ?? ''); if (!Number.isFinite(time)) return null; const nearby = candidates.filter(item => { const candidateTime = Date.parse(item.timestamp ?? ''); return Number.isFinite(candidateTime) && Math.abs(candidateTime - time) <= 90_000; }); return nearby.length === 1 ? nearby[0] : null; })();
  return matched ? { sessionId, turnId, model: matched.model, reasoningEffort: matched.reasoningEffort, modelRequestCount: matched.modelRequestCount, requests: matched.requests, latestRequest: matched.latestRequest, contextMetadata: matched.contextMetadata, promptMetadata: matched.promptMetadata, toolCallMetadata: matched.toolCallMetadata, turnUsage: matched.turnUsage, ...(matched.durationMs === null ? {} : { durationMs: matched.durationMs }) } : null;
}
