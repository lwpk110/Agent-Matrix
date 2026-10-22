import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { test } from "node:test";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { prototypeSessionFixtures, prototypeSessionIdFromSearch, selectPrototypeSession } from "./runtimePrototypeFixtures";

const cache = join(process.cwd(), "node_modules/.cache/runtime-observatory-views");

async function loadViews() {
  rmSync(cache, { recursive: true, force: true }); mkdirSync(cache, { recursive: true });
  (globalThis as { window?: unknown }).window = { location: { search: "" } };
  await build({ entryPoints: ["src/components/CodexSessionPrototype.tsx", "src/components/codex3d/Codex3DTopology.tsx", "src/components/CodexMockDetails.tsx", "src/components/RuntimeFleetPrototype.tsx", "src/components/RuntimeResources.tsx"], outdir: cache, bundle: true, format: "esm", platform: "node", jsx: "automatic", external: ["react", "react-dom", "react-dom/*", "motion/react", "three", "three/*", "lucide-react"], loader: { ".css": "empty" } });
  const two = await import(pathToFileURL(join(cache, "CodexSessionPrototype.js")).href);
  const three = await import(pathToFileURL(join(cache, "codex3d/Codex3DTopology.js")).href);
  const details = await import(pathToFileURL(join(cache, "CodexMockDetails.js")).href);
  const fleet = await import(pathToFileURL(join(cache, "RuntimeFleetPrototype.js")).href);
  const resources = await import(pathToFileURL(join(cache, "RuntimeResources.js")).href);
  return { two, three, details, fleet, resources };
}

test("runtime fleet prototype exposes searchable parallel sessions with status, model, activity and token fields", async () => {
  try {
    const { fleet } = await loadViews();
    const html = renderToStaticMarkup(React.createElement(fleet.RuntimeFleetPrototype, { selectedId: "session-active", onSelect: () => {} }));
    assert.match(html, /本地会话/);
    assert.match(html, /正在运行/);
    assert.match(html, /claude-sonnet-5/);
    assert.match(html, /最近活动/);
    assert.match(html, /5,830/);
    assert.match(html, /turn-7c21/);
    assert.match(html, /同一工作区 · workspace-alpha/);
    assert.match(html, /历史会话/);
    assert.match(html, /aria-pressed="true"/);
  } finally { if (existsSync(cache)) rmSync(cache, { recursive: true, force: true }); }
});

test("多会话选择投影出各自 provider、回合、事件和状态，不共用默认 Codex 事件", () => {
  const selected = prototypeSessionFixtures.map(fixture => selectPrototypeSession(fixture.id));
  const eventIds = selected.flatMap(item => item.session.events.map(event => event.id));
  assert.equal(new Set(eventIds).size, eventIds.length);
  for (const item of selected) {
    assert.equal(item.session.provider, item.fixture.provider);
    assert.equal(item.session.id, item.fixture.id);
    assert.equal(item.session.turnId, item.fixture.turnId);
    assert.ok(item.session.events.length > 0);
    assert.ok(item.session.events.every(event => event.sessionId === item.fixture.id && event.turnId === item.fixture.turnId));
  }
  assert.equal(selected.find(item => item.fixture.id === "session-review")?.session.calls.some(call => call.status === "waiting"), true);
  assert.equal(selected.find(item => item.fixture.id === "session-failed")?.session.calls.some(call => call.status === "failed"), true);
  assert.ok(selected.find(item => item.fixture.id === "session-done")?.session.finalAnswer);
  assert.equal(selectPrototypeSession("session-codex", "自定义演示输入").session.prompt, "自定义演示输入");
  assert.equal(prototypeSessionIdFromSearch("?session=session-review"), "session-review");
  assert.equal(prototypeSessionIdFromSearch("?session=unknown"), "session-codex");
});

test("prototype session deep link restores the matching provider in the main runtime view", async () => {
  try {
    const { two } = await loadViews();
    const window = globalThis as { window?: { location: { search: string } } };
    const previousSearch = window.window?.location.search ?? "";
    if (window.window) window.window.location.search = "?session=session-review";
    const html = renderToStaticMarkup(React.createElement(two.CodexSessionPrototype, { prototypeMode: true, logs: [] }));
    assert.match(html, /Claude Code Runtime/);
    assert.match(html, /PR 复核/);
    if (window.window) window.window.location.search = previousSearch;
  } finally { if (existsSync(cache)) rmSync(cache, { recursive: true, force: true }); }
});

async function loadRoute() {
  rmSync(cache, { recursive: true, force: true }); mkdirSync(cache, { recursive: true });
  (globalThis as { window?: unknown }).window = { location: { search: "" } };
  await build({ stdin: { contents: `
    export { RuntimeObservatoryRoute } from "./src/components/RuntimeObservatoryRoute";
    export { createRuntimeSessionFromLogs, getRuntimePlugin, registerRuntimePlugin } from "./src/services/runtimePlugins";
    export { createRuntimeTelemetryPoller } from "./src/services/runtimeObservation";
  `, resolveDir: process.cwd(), sourcefile: "runtime-observatory-route-entry.tsx" }, outfile: join(cache, "route.js"), bundle: true, format: "esm", platform: "node", jsx: "automatic", external: ["react", "react-dom", "react-dom/*", "motion/react", "three", "three/*", "lucide-react"], loader: { ".css": "empty" } });
  return import(pathToFileURL(join(cache, "route.js")).href);
}

test("empty real views never render prototype content and prototypes ignore real logs", async () => {
  try {
    const { two, three } = await loadViews();
    const empty2d = renderToStaticMarkup(React.createElement(two.CodexSessionPrototype, { logs: [], connectionState: "connected" }));
    const empty3d = renderToStaticMarkup(React.createElement(three.Codex3DTopology, { logs: [], connectionState: "connected" }));
    for (const html of [empty2d, empty3d]) {
      assert.match(html, /等待首条运行时事件/);
      assert.doesNotMatch(html, /MOCK|DEMO|browser-inspection|5 轮|发送演示/);
    }
    const realLog = { id: "real", timestamp: "2026-10-20T00:00:00.000Z", agentTag: "CODEX", agentColor: "cyan", category: "system", message: "real", runtimeEvent: { provider: "codex", source: "codex-hook", eventId: "real", eventName: "UserPromptSubmit", sessionId: "real", turnId: "turn", phase: "prompt", hasToolResponse: false, details: JSON.stringify({ prompt: "real data" }) } };
    const prototype = renderToStaticMarkup(React.createElement(two.CodexSessionPrototype, { prototypeMode: true, logs: [realLog] }));
    assert.match(prototype, /完整模拟会话|模拟数据/);
    assert.doesNotMatch(prototype, /real data/);
  } finally { if (existsSync(cache)) rmSync(cache, { recursive: true, force: true }); }
});

test("third-party plugin routes render only its live data, connection contract and navigation", async () => {
  try {
    const route = await loadRoute();
    route.registerRuntimePlugin({
      provider: "test-agent",
      label: "Test Agent",
      paths: { twoDimensional: "/test-agent", threeDimensional: "/test-agent/3d", runtime: "/test-agent/runtime" },
      accepts: (log: { runtimeEvent?: { provider?: string } }) => log.runtimeEvent?.provider === "test-agent",
      mapEvent: ({ base }: { base: object }) => base,
      connectionStatus: () => ({ hookGatewayState: "listening", hookPort: 9191 }),
      loadTelemetry: async () => ({ model: "test-model", reasoningEffort: "low", contextWindowTokens: null, latestRequest: null, turnUsage: { inputTokens: 3, outputTokens: 2, cachedInputTokens: null } }),
      loadSkillSources: async () => [{ scope: "project", root: "/tmp", path: "/tmp/SKILL.md", modifiedAt: "2026-10-20T00:00:00.000Z", sizeBytes: 12, metadata: {}, rawMetadata: "", content: "# Test Skill" }],
    });
    const event = (provider: string, id: string, prompt: string) => ({ id, timestamp: "2026-10-20T00:00:00.000Z", agentTag: provider, agentColor: "cyan", category: "system", message: prompt, runtimeEvent: { provider, source: `${provider}-hook`, eventId: id, eventName: "UserPromptSubmit", sessionId: "shared", turnId: "turn", phase: "prompt", hasToolResponse: false, details: JSON.stringify({ prompt }) } });
    const logs = [event("codex", "codex", "codex secret"), event("claude", "claude", "claude secret"), event("test-agent", "test", "third prompt")];
    const props = { logs, connectionState: "connected", language: "zh", realStatus: null, historyByProvider: { "test-agent": { loaded: true, error: false } }, onBack: () => {}, onClear: async () => {} };
    const render = (pathname: string) => renderToStaticMarkup(React.createElement(route.RuntimeObservatoryRoute, { ...props, pathname }));
    const two = render("/test-agent");
    assert.match(two, /Test Agent Runtime/);
    assert.match(two, /third prompt/);
    assert.doesNotMatch(two, /codex secret|claude secret/);
    assert.match(two, /href="\/codex"/);
    const three = render("/test-agent/3d");
    assert.match(three, /TEST AGENT RUNTIME/);
    assert.match(three, /1 条事件已采集/);
    assert.match(three, /SESSION shared \/ turn/);
    assert.doesNotMatch(three, /codex secret|claude secret/);
    const runtime = render("/test-agent/runtime");
    assert.match(runtime, /Test Agent 会话链路/);
    assert.match(runtime, /HOOK 9191/);
    assert.match(runtime, /third prompt/);
    assert.doesNotMatch(runtime, /codex secret|claude secret/);
    const plugin = route.getRuntimePlugin("test-agent");
    const telemetryValues: unknown[] = [];
    const poller = route.createRuntimeTelemetryPoller({ key: { provider: "test-agent", sessionId: "shared", turnId: "turn" }, loadTelemetry: plugin.loadTelemetry, onTelemetry: (value: unknown) => telemetryValues.push(value) });
    await new Promise<void>(resolve => setImmediate(resolve));
    poller.dispose();
    const projected = route.createRuntimeSessionFromLogs(plugin, logs, telemetryValues.at(-1));
    assert.equal(projected?.model, "test-model");
    assert.deepEqual(projected?.usage, { inputTokens: 3, outputTokens: 2, cachedInputTokens: null });
    assert.equal((await plugin.loadSkillSources("test-skill", "/tmp", new AbortController().signal))[0].content, "# Test Skill");
  } finally { if (existsSync(cache)) rmSync(cache, { recursive: true, force: true }); }
});

test("a provider-specific offline gateway makes the real empty view offline", async () => {
  try {
    const route = await loadRoute();
    const html = renderToStaticMarkup(React.createElement(route.RuntimeObservatoryRoute, {
      pathname: "/claude", logs: [], connectionState: "connected", language: "zh",
      realStatus: { claudeHookGatewayState: "offline" }, historyByProvider: { claude: { loaded: true, error: false } }, onBack: () => {}, onClear: async () => {},
    }));
    assert.match(html, /本机事件网关离线/);
  } finally { if (existsSync(cache)) rmSync(cache, { recursive: true, force: true }); }
});

test("Claude Desktop route exposes only metadata-statistics language", async () => {
  try {
    const route = await loadRoute();
    const html = renderToStaticMarkup(React.createElement(route.RuntimeObservatoryRoute, { pathname: "/claude/desktop", logs: [], connectionState: "connected", language: "zh", realStatus: null, historyByProvider: {}, onBack: () => {}, onClear: async () => {} }));
    assert.match(html, /Claude 本地统计/);
    assert.match(html, /不保存或展示提示词、答复或工具输出/);
  } finally { if (existsSync(cache)) rmSync(cache, { recursive: true, force: true }); }
});

test("Claude visual uses request metadata language and cache-inclusive input wording", async () => {
  try {
    const { two, three } = await loadViews();
    const log = { id: "claude", timestamp: "2026-10-20T00:00:00.000Z", agentTag: "CLAUDE", agentColor: "amber", category: "system", message: "start", runtimeEvent: { provider: "claude", source: "claude-hook", eventId: "claude", eventName: "SessionStart", sessionId: "s", turnId: "t", model: "claude-opus", phase: "lifecycle", hasToolResponse: false, details: "{}" } };
    const html = renderToStaticMarkup(React.createElement(two.CodexSessionPrototype, { logs: [log], provider: "claude", connectionState: "connected" }));
    assert.match(html, /Claude Code Runtime/);
    assert.match(html, /模型来自运行时事件/);
    assert.match(html, /输入合计包含原生输入、创建缓存和读取缓存/);
    assert.match(html, /提示词监控/);
    assert.match(html, /未采集/);
    assert.equal(html.match(/rr-card rr-card-/g)?.length, 4);
    const model = await import(pathToFileURL(join(process.cwd(), "src/components/codex3d/model.ts")).href);
    assert.notDeepEqual(model.coreGlyph("activity"), model.coreGlyph("sparkles"));
    assert.ok(three.Codex3DTopology);
  } finally { if (existsSync(cache)) rmSync(cache, { recursive: true, force: true }); }
});

test("live runtime page lists and selects only real sessions for the active provider", async () => {
  try {
    const { two } = await loadViews();
    const browserWindow = globalThis as { window?: { location: { search: string } } };
    const previousSearch = browserWindow.window?.location.search ?? "";
    const event = (id: string, sessionId: string, prompt: string, timestamp: string) => ({
      id, timestamp, agentTag: "CODEX", agentColor: "cyan", category: "system", message: prompt,
      runtimeEvent: { provider: "codex", source: "codex-hook", eventId: id, eventName: "UserPromptSubmit", sessionId, turnId: `turn-${sessionId}`, phase: "prompt", hasToolResponse: false, timestamp, details: JSON.stringify({ prompt }) },
    });
    const logs = [event("a", "session-a", "A real task", "2026-10-20T00:00:01.000Z"), event("b", "session-b", "Another real task", "2026-10-20T00:00:02.000Z")];
    const html = renderToStaticMarkup(React.createElement(two.CodexSessionPrototype, { logs, connectionState: "connected" }));
    assert.match(html, /本地会话/);
    assert.match(html, /A real task/);
    assert.match(html, /Another real task/);
    assert.match(html, /LIVE · 本地运行时事件/);
    assert.doesNotMatch(html, /PR 复核|session-review|仅原型数据/);
    assert.match(html, /当前会话.*session-b/);
    if (browserWindow.window) browserWindow.window.location.search = "?session=session-a";
    const restored = renderToStaticMarkup(React.createElement(two.CodexSessionPrototype, { logs, connectionState: "connected" }));
    assert.match(restored, /当前会话.*session-a/);
    assert.match(restored, /aria-pressed="true"[^>]*>.*A real task/s);
    if (browserWindow.window) browserWindow.window.location.search = previousSearch;
  } finally { if (existsSync(cache)) rmSync(cache, { recursive: true, force: true }); }
});

test("原型资源概览使用与实时态一致的四张核心卡，并提供明确的提示词模拟入口", async () => {
  try {
    const { two } = await loadViews();
    const html = renderToStaticMarkup(React.createElement(two.CodexSessionPrototype, { prototypeMode: true, logs: [] }));
    assert.equal(html.match(/rr-card rr-card-/g)?.length, 4);
    assert.match(html, /提示词监控/);
    assert.match(html, /MOCK · 随事件回放/);
  } finally { if (existsSync(cache)) rmSync(cache, { recursive: true, force: true }); }
});

test("实时资源概览不会将缺失的逐次 Token 回执渲染为零值柱", async () => {
  try {
    const { resources } = await loadViews();
    const session = {
      id: "live", provider: "claude", turnId: "turn", cwd: "未采集", prompt: "", model: "未采集", reasoningEffort: "未采集", instruction: "", skillText: "", skillCatalog: [], finalAnswer: "", calls: [], events: [],
      rounds: [{ id: "partial", inputTokens: null, cachedInputTokens: null, outputTokens: 31, consumedCallIds: [], callIds: [], response: "" }],
      usage: { inputTokens: null, outputTokens: 31, cachedInputTokens: null }, durationMs: null, schemaVersion: "agent-matrix.runtime.v1", isMock: false, isReal: true, dataSource: "live", capabilities: { rolloutTelemetry: true, promptTelemetry: false },
    };
    const html = renderToStaticMarkup(React.createElement(resources.RuntimeResources, { events: [], logs: [], session, onInspect: () => {}, onCorrelate: () => {} }));
    assert.match(html, /rr-card-usage[\s\S]*is-unknown/);
    assert.doesNotMatch(html, /height:0%/);
  } finally { if (existsSync(cache)) rmSync(cache, { recursive: true, force: true }); }
});

test("实时资源摘要沿用原型提示文案并按已观测能力分类", async () => {
  try {
    const { resources } = await loadViews();
    const session = {
      id: "live", provider: "codex", turnId: "turn", cwd: "未采集", prompt: "", model: "GPT", reasoningEffort: "未采集", instruction: "", skillText: "", skillCatalog: [], finalAnswer: "", events: [],
      calls: [
        { id: "mcp-1", roundId: "turn", name: "search", title: "search", type: "mcp", arguments: {}, result: {}, durationMs: null, status: "completed" },
        { id: "local-1", roundId: "turn", name: "read", title: "read", type: "local", arguments: {}, result: {}, durationMs: null, status: "completed" },
      ],
      rounds: [], usage: { inputTokens: null, outputTokens: null, cachedInputTokens: null }, durationMs: null, schemaVersion: "agent-matrix.runtime.v1", isMock: false, isReal: true, dataSource: "live",
      capabilities: { promptTelemetry: false },
    };
    const events = [{ id: "skill-1", sessionId: "live", turnId: "turn", offsetMs: 0, time: "2026-10-22T00:00:00.000Z", name: "skill.loaded", kind: "skill", node: "skill", relatedNodes: [], source: "Codex Hook", title: "Skill loaded", summary: "Skill activation observed", status: "completed" }];
    const html = renderToStaticMarkup(React.createElement(resources.RuntimeResources, { events, logs: [], session, onInspect: () => {}, onCorrelate: () => {} }));
    assert.match(html, /本回合资源 <small>先看摘要，点击展开<\/small>/);
    assert.match(html, /1 · 1 · 1/);
    assert.match(html, /Skill \/ MCP \/ 本地工具/);
    assert.match(html, /2 次已观测工具调用 · 不代表完整能力目录/);
  } finally { if (existsSync(cache)) rmSync(cache, { recursive: true, force: true }); }
});


test("实时 Token 摘要从独立 telemetry 显示请求数，不覆盖生命周期回合关联", async () => {
  try {
    const { resources } = await loadViews();
    const session = {
      id: "live", provider: "codex", turnId: "turn", cwd: "未采集", prompt: "", model: "GPT", reasoningEffort: "high", instruction: "", skillText: "", skillCatalog: [], finalAnswer: "", events: [],
      calls: [{ id: "call-1", roundId: "request-event", name: "search", title: "search", type: "mcp", arguments: {}, result: {}, durationMs: null, status: "completed" }],
      rounds: [{ id: "request-event", inputTokens: null, cachedInputTokens: null, outputTokens: null, consumedCallIds: [], callIds: ["call-1"], response: "" }],
      rolloutTelemetry: { modelRequestCount: 3, requests: [
        { inputTokens: 120, cachedInputTokens: 70, outputTokens: 20, reasoningTokens: 4 },
        { inputTokens: 90, cachedInputTokens: 0, outputTokens: 10, reasoningTokens: 2 },
      ], turnUsage: { inputTokens: 210, cachedInputTokens: 70, outputTokens: 30, totalTokens: 240 } },
      usage: { inputTokens: 210, outputTokens: 30, cachedInputTokens: 70 }, durationMs: null, schemaVersion: "agent-matrix.runtime.v1", isMock: false, isReal: true, dataSource: "live", capabilities: { rolloutTelemetry: true, promptTelemetry: false },
    };
    const html = renderToStaticMarkup(React.createElement(resources.RuntimeResources, { events: [], logs: [], session, onInspect: () => {}, onCorrelate: () => {} }));
    assert.match(html, /<strong>240<small>tokens<\/small><\/strong>/);
    assert.match(html, /最近 2 \/ 3 次有用量/);
    assert.match(html, /height:100%/);
    assert.match(html, /height:71\.42857142857143%/);
  } finally { if (existsSync(cache)) rmSync(cache, { recursive: true, force: true }); }
});

test("Codex and Claude use their provider brand marks in the shared runtime plugin contract", async () => {
  try {
    const route = await loadRoute();
    assert.equal(route.getRuntimePlugin("claude").visual.coreIcon, "claude-mark");
    assert.equal(route.getRuntimePlugin("codex").visual.coreIcon, "codex-mark");
  } finally { if (existsSync(cache)) rmSync(cache, { recursive: true, force: true }); }
});


test("Claude 节点详情显示快照与无 Hook 工具元数据，并不泄露相关事件正文", async () => {
  try {
    const { details } = await loadViews();
    const { createCodexRuntimeMock } = await import("./codexRuntimeMock");
    const session = { ...createCodexRuntimeMock(), isReal: true, isMock: false, provider: "claude", events: [], calls: [{ id: "safe-call", roundId: "", name: "Bash", title: "Bash", type: "local", status: "unknown", arguments: {}, result: {}, durationMs: null, metadataOnly: true, resultReceived: false }], rolloutTelemetry: {
      contextMetadata: { instructionFileCount: 2, observedAt: "2026-10-21T00:00:00Z", source: "claude-transcript", scope: "session" },
      promptMetadata: { systemSegmentCount: 13, toolDefinitionCount: 14, observedAt: "2026-10-21T00:00:01Z", source: "claude-transcript", scope: "turn" },
    } };
    const render = (node: string) => renderToStaticMarkup(React.createElement(details.CodexMockDetails, { session, node, onCorrelate: () => {} }));
    const context = render("context"), prompt = render("prompt"), tool = render("tool");
    assert.match(context, /规则快照文件/); assert.match(context, /会话快照/); assert.match(context, />2</);
    assert.match(prompt, /系统指令分段/); assert.match(prompt, />13</); assert.match(prompt, />14</);
    assert.match(tool, /safe-call/); assert.match(tool, /结果未观测/); assert.doesNotMatch(tool, /调用参数|调用结果/);
  } finally { if (existsSync(cache)) rmSync(cache, { recursive: true, force: true }); }
});

test("统计工具详情在 MCP 与搜索节点间互斥", async () => {
  try {
    const { details } = await loadViews();
    const { createCodexRuntimeMock } = await import("./codexRuntimeMock");
    const base = createCodexRuntimeMock();
    const session = { ...base, isReal: true, provider: "claude", events: [], calls: ["mcp__docs__search", "WebSearch"].map((name, index) => ({ ...base.calls[0], id: `exclusive-call-${index}`, name, title: name, type: "mcp", metadataOnly: true })) };
    const render = (node: string) => renderToStaticMarkup(React.createElement(details.CodexMockDetails, { session, node, onCorrelate: () => {} }));
    assert.match(render("mcp"), /exclusive-call-0/);
    assert.doesNotMatch(render("mcp"), /exclusive-call-1/);
    assert.match(render("search"), /exclusive-call-1/);
    assert.doesNotMatch(render("search"), /exclusive-call-0/);
  } finally { if (existsSync(cache)) rmSync(cache, { recursive: true, force: true }); }
});
