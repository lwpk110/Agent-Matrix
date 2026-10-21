import assert from "node:assert/strict";
import test from "node:test";
import { createRuntimeTelemetryPoller, type RuntimeTelemetryScheduler } from "./runtimeObservation";

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(value => { resolve = value; }); return { promise, resolve }; }
function telemetry(sessionId: string, turnId: string) { return { sessionId, turnId, model: "test" }; }
function scheduler() {
  let callback: (() => void) | undefined;
  const value: RuntimeTelemetryScheduler = { setInterval(next) { callback = next; return 1 as unknown as ReturnType<typeof setInterval>; }, clearInterval() { callback = undefined; } };
  return { value, tick: () => callback?.() };
}

test("does not publish a late response after provider/session key disposal", async () => {
  const pending = deferred<ReturnType<typeof telemetry>>(); const values: unknown[] = []; const timers = scheduler();
  const poller = createRuntimeTelemetryPoller({ key: { provider: "codex", sessionId: "shared", turnId: "turn" }, loadTelemetry: async () => pending.promise, onTelemetry: value => values.push(value), scheduler: timers.value });
  poller.dispose(); pending.resolve(telemetry("shared", "turn")); await Promise.resolve();
  assert.deepEqual(values, [null]);
});

test("keeps sessions and turns isolated even when ids overlap across providers", async () => {
  const codex = deferred<ReturnType<typeof telemetry>>(); const claude = deferred<ReturnType<typeof telemetry>>(); const first: unknown[] = []; const second: unknown[] = [];
  const oldPoller = createRuntimeTelemetryPoller({ key: { provider: "codex", sessionId: "shared", turnId: "turn-a" }, loadTelemetry: async () => codex.promise, onTelemetry: value => first.push(value), scheduler: scheduler().value });
  oldPoller.dispose();
  createRuntimeTelemetryPoller({ key: { provider: "claude", sessionId: "shared", turnId: "turn-b" }, loadTelemetry: async () => claude.promise, onTelemetry: value => second.push(value), scheduler: scheduler().value });
  codex.resolve(telemetry("shared", "turn-a")); claude.resolve(telemetry("shared", "turn-b")); await new Promise<void>(resolve => setImmediate(resolve));
  assert.deepEqual(first, [null]); assert.deepEqual(second, [null, telemetry("shared", "turn-b")]);
});

test("clears on a successful null response and does not re-enter while pending", async () => {
  const pending = deferred<ReturnType<typeof telemetry> | null>(); const values: unknown[] = []; const timers = scheduler(); let calls = 0;
  const poller = createRuntimeTelemetryPoller({ key: { provider: "test", sessionId: "s", turnId: "t" }, loadTelemetry: async () => { calls++; return pending.promise; }, onTelemetry: value => values.push(value), scheduler: timers.value });
  timers.tick(); timers.tick(); void poller.refresh();
  assert.equal(calls, 1);
  pending.resolve(null); await new Promise<void>(resolve => setImmediate(resolve));
  assert.deepEqual(values, [null, null]);
});

test("does not schedule a request when no loader is provided", () => {
  const values: unknown[] = []; const timers = scheduler();
  createRuntimeTelemetryPoller({ key: { provider: "test", sessionId: "s", turnId: "t" }, onTelemetry: value => values.push(value), scheduler: timers.value });
  timers.tick();
  assert.deepEqual(values, [null]);
});

test("accepts telemetry without identity but rejects an explicit mismatched identity", async () => {
  const values: unknown[] = [];
  const missing = createRuntimeTelemetryPoller({ key: { provider: "test", sessionId: "s", turnId: "t" }, loadTelemetry: async () => ({ model: "unscoped" }), onTelemetry: value => values.push(value), scheduler: scheduler().value });
  await new Promise<void>(resolve => setImmediate(resolve));
  missing.dispose();
  assert.deepEqual(values, [null, { model: "unscoped" }]);
  const rejected: unknown[] = [];
  const mismatch = createRuntimeTelemetryPoller({ key: { provider: "test", sessionId: "s", turnId: "t" }, loadTelemetry: async () => telemetry("other", "t"), onTelemetry: value => rejected.push(value), scheduler: scheduler().value });
  await new Promise<void>(resolve => setImmediate(resolve));
  mismatch.dispose();
  assert.deepEqual(rejected, [null, null]);
});
