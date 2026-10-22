import { strict as assert } from "node:assert";
import { test } from "node:test";
import { advanceRuntimeVisualPlayback, createRuntimeVisualPlayback, currentRuntimeVisualCue } from "./runtimeVisualPlayback";
import type { RuntimeEvent } from "../types/runtime";

const input = (id: string): RuntimeEvent => ({
  id, provider: "claude", sessionId: "session-a", turnId: "turn-a", offsetMs: 0, time: "10:00:00.000",
  name: "UserPromptSubmit", kind: "input", node: "input", relatedNodes: ["prompt"], source: "Claude Hook",
  title: "用户提交提示词", summary: "已提交", status: "completed", isReal: true,
});

const observation = (event?: RuntimeEvent, metadataKey?: string, modelRequestCount: number | null = null) => ({
  provider: "claude", sessionId: "session-a", turnId: "turn-a", events: event ? [event] : [], metadataKey, modelRequestCount,
});

test("首次历史快照只建立基线，不播放已存在的阶段", () => {
  const state = createRuntimeVisualPlayback(observation(input("input-1"), "context-1:prompt-1", 3));

  assert.equal(currentRuntimeVisualCue(state, 1_000), undefined);
});

test("新输入、真实 metadata 与请求数增量按顺序加入有限视觉队列", () => {
  let state = createRuntimeVisualPlayback(observation(undefined, "context-1:prompt-1", 3));
  state = advanceRuntimeVisualPlayback(state, observation(input("input-2"), "context-2:prompt-2", 4), 1_000);

  assert.deepEqual(state.cues.map(cue => [cue.flow, cue.source]), [
    [{ from: "input", to: "context" }, "observed"],
    [{ from: "context", to: "prompt" }, "derived"],
    [{ from: "prompt", to: "model" }, "derived"],
  ]);
  assert.equal(currentRuntimeVisualCue(state, 1_100)?.active, true);
  assert.deepEqual(currentRuntimeVisualCue(state, 2_000)?.cue.flow, { from: "context", to: "prompt" });
  assert.deepEqual(currentRuntimeVisualCue(state, 2_900)?.cue.flow, { from: "prompt", to: "model" });
  assert.equal(currentRuntimeVisualCue(state, 5_100)?.active, false);
  assert.equal(currentRuntimeVisualCue(state, 7_500), undefined);
});

test("等待、失败和生命周期记录不会注入成功流，新回合会播放其首个输入", () => {
  let state = createRuntimeVisualPlayback(observation(undefined, "context-1:prompt-1", 1));
  const waiting = { ...input("wait-1"), name: "SessionStart", node: "context" as const, kind: "context" as const, status: "waiting" as const };
  state = advanceRuntimeVisualPlayback(state, observation(waiting, "context-1:prompt-1", 1), 1_000);
  assert.equal(state.cues.length, 0);

  state = advanceRuntimeVisualPlayback(state, { ...observation(input("input-3"), "context-2:prompt-2", 1), turnId: "turn-b", liveNewTurn: true }, 1_100);
  assert.deepEqual(state.cues.map(cue => cue.flow), [
    { from: "input", to: "context" },
    { from: "context", to: "prompt" },
    { from: "prompt", to: "model" },
  ]);
});

test("同一回合会消费同批新增事件，并以事件状态去重", () => {
  const first = input("input-4");
  const completed = { ...first, id: "tool-4", name: "tool.completed", node: "tool" as const, kind: "tool" as const };
  let state = createRuntimeVisualPlayback(observation(undefined, "context-1:prompt-1", 1));
  state = advanceRuntimeVisualPlayback(state, { ...observation(undefined, "context-1:prompt-1", 1), events: [first, completed] }, 1_000);
  assert.deepEqual(state.cues.map(cue => cue.flow), [{ from: "input", to: "context" }, { from: "tool", to: "model" }]);
  state = advanceRuntimeVisualPlayback(state, { ...observation(undefined, "context-1:prompt-1", 1), events: [first, completed] }, 2_000);
  assert.equal(state.cues.length, 2);
});

test("同回合首次有效 telemetry 到达会播放，零请求与轮询重复不会播放", () => {
  let state = createRuntimeVisualPlayback(observation(undefined, undefined, null));
  state = advanceRuntimeVisualPlayback(state, observation(undefined, "context-1:prompt-1", 0), 1_000);
  assert.deepEqual(state.cues.map(cue => cue.flow), [{ from: "context", to: "prompt" }]);

  state = advanceRuntimeVisualPlayback(state, observation(undefined, "context-1:prompt-1", 1), 2_000);
  assert.deepEqual(state.cues.map(cue => cue.flow), [
    { from: "context", to: "prompt" },
    { from: "prompt", to: "model" },
  ]);

  state = advanceRuntimeVisualPlayback(state, observation(undefined, "context-1:prompt-1", 1), 3_000);
  assert.equal(state.cues.length, 2);
  assert.equal(new Set(state.seenEventKeys).size, state.seenEventKeys.length);
});

test("长回合轮询不会重播旧事件，溢出时优先保留输入和派生主阶段", () => {
  const history = Array.from({ length: 81 }, (_, index) => ({
    ...input(`history-${index}`), name: "SessionStart", node: "context" as const, kind: "context" as const,
  }));
  let state = createRuntimeVisualPlayback({ ...observation(undefined, undefined, null), events: history });
  const incoming = [input("input-primary"), ...Array.from({ length: 8 }, (_, index) => ({
    ...input(`tool-${index}`), name: "tool.completed", node: "tool" as const, kind: "tool" as const,
  }))];
  state = advanceRuntimeVisualPlayback(state, { ...observation(undefined, "context-1:prompt-1", 1), events: [...history, ...incoming] }, 1_000);

  assert.equal(state.cues.length, 6);
  assert.deepEqual(state.cues.slice(0, 3).map(cue => cue.flow), [
    { from: "input", to: "context" },
    { from: "context", to: "prompt" },
    { from: "prompt", to: "model" },
  ]);
  assert.equal(state.cues.every(cue => cue.startsAt < 6_400), true);
  state = advanceRuntimeVisualPlayback(state, { ...observation(undefined, "context-1:prompt-1", 1), events: [...history, ...incoming] }, 2_000);
  assert.equal(state.cues.length, 6);
});

test("队列满时新主阶段替换待播工具，已完成留亮不阻挡新输入", () => {
  const tools = Array.from({ length: 6 }, (_, index) => ({ ...input(`busy-${index}`), name: "tool.completed", node: "tool" as const, kind: "tool" as const }));
  let state = createRuntimeVisualPlayback(observation());
  state = advanceRuntimeVisualPlayback(state, { ...observation(), events: tools }, 1_000);
  const activeId = currentRuntimeVisualCue(state, 1_100)?.cue.id;
  const newInput = input("priority-input");
  state = advanceRuntimeVisualPlayback(state, { ...observation(undefined, "snapshot-new", 1), events: [...tools, newInput] }, 1_100);
  assert.equal(currentRuntimeVisualCue(state, 1_100)?.cue.id, activeId);
  assert.deepEqual(state.cues.slice(1, 4).map(item => item.flow), [
    { from: "input", to: "context" }, { from: "context", to: "prompt" }, { from: "prompt", to: "model" },
  ]);
  const laterInput = input("retained-input");
  const finishedAt = Math.max(...state.cues.map(item => item.endsAt)) + 1;
  state = advanceRuntimeVisualPlayback(state, { ...observation(undefined, "snapshot-new", 1), events: [...tools, newInput, laterInput] }, finishedAt);
  assert.equal(currentRuntimeVisualCue(state, finishedAt)?.cue.event?.id, "retained-input");
  assert.equal(currentRuntimeVisualCue(state, finishedAt)?.active, true);
});
