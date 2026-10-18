import test from "node:test";
import assert from "node:assert/strict";
import { createCodexRuntimeMock } from "./codexRuntimeMock";
import { runtimeResources } from "./runtimeResourcesModel";

test("resources use only observed events, with unknown usage before the first receipt", () => {
  const { events } = createCodexRuntimeMock();
  const empty = runtimeResources([]);
  assert.equal(empty.total, null);
  assert.equal(empty.cached, null);
  assert.equal(empty.context, null);
  assert.equal(empty.memories, null);
  assert.equal(empty.skillCount, null);
  const requested = runtimeResources(events.filter(event => event.offsetMs <= 350));
  assert.equal(requested.total, null);
  assert.equal(requested.pending, 1);
  assert.equal(requested.loaded.size, 1);
  assert.equal(requested.context?.total, 1240);
  assert.equal(requested.loadedSkills, 0);
  assert.equal(requested.calls, 0);
  const first = runtimeResources(events.filter(event => event.offsetMs <= 900));
  assert.equal(first.total, 1390);
  assert.equal(first.cached, 800);
  assert.equal(first.pending, 0);
});

test("cache is included in input, duplicate receipts are not counted twice, missing values remain unknown", () => {
  const { events } = createCodexRuntimeMock();
  const receipt = events.find(event => event.name === "model.response.completed")!;
  const full = runtimeResources([...events, receipt]);
  assert.equal(full.input, 11930);
  assert.equal(full.output, 915);
  assert.equal(full.cached, 9000);
  assert.equal(full.total, 12845);
  assert.equal(full.rounds.length, 5);
  assert.equal(runtimeResources([{ ...receipt, output: { input_tokens: 12, output_tokens: 3 } }]).cached, null);
  assert.equal(runtimeResources([{ ...receipt, output: { input_tokens: -1, output_tokens: 3 } }]).total, null);
});

test("latest context is not accumulated usage; memory read precedes injection and unused memory stays outside", () => {
  const { events } = createCodexRuntimeMock();
  const read = runtimeResources(events.filter(event => event.offsetMs <= 4000));
  assert.equal(read.loaded.size, 2);
  assert.deepEqual(read.context?.memoryIds, ["answer-style"]);
  const full = runtimeResources(events);
  assert.equal(full.context?.total, 3540);
  assert.notEqual(full.context?.total, full.input);
  assert.equal(full.memories?.length, 3);
  assert.equal(full.loaded.size, 2);
  assert.equal(full.loaded.has("release-notes"), false);
  assert.deepEqual(full.context?.memoryIds, ["answer-style", "project-map"]);
  assert.equal(full.loadedSkills, 1);
  assert.equal(full.skillCount, 5);
  assert.equal(full.serverCount, 2);
  assert.equal(full.calls, 6);
  assert.equal(full.approvals, 1);
  for (const event of events.filter(event => event.name === "model.request")) {
    const state = runtimeResources(events.filter(candidate => candidate.offsetMs <= event.offsetMs));
    assert.equal(state.context!.segments.reduce((sum, segment) => sum + segment.tokens, 0), state.context!.total);
    assert.ok(state.context!.memoryIds.every(id => state.loaded.has(id)));
  }
});
