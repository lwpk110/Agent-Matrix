import test from "node:test";
import assert from "node:assert/strict";
import {
  createCodexRuntimeMock,
  mockEventsForCall,
  mockEventsForNode,
} from "./codexRuntimeMock";

test("mock session has a complete chronological trace with stable session and call references", () => {
  const session = createCodexRuntimeMock();
  assert.equal(session.isMock, true);
  assert.equal(
    new Set(session.events.map((event) => event.id)).size,
    session.events.length,
  );
  session.events.forEach((event, index) => {
    assert.equal(event.sessionId, session.id);
    assert.equal(event.turnId, session.turnId);
    assert.ok(
      index === 0 || event.offsetMs >= session.events[index - 1].offsetMs,
    );
    if (event.callId)
      assert.ok(session.calls.some((call) => call.id === event.callId));
    if (event.roundId)
      assert.ok(session.rounds.some((round) => round.id === event.roundId));
  });
  assert.equal(session.events[0].name, "SessionStart");
  assert.equal(session.events.at(-1)?.name, "turn.completed");
  assert.equal(session.events.at(-1)?.offsetMs, session.durationMs);
  assert.equal(
    session.events.find((event) => event.name === "assistant.message.completed")
      ?.content,
    session.finalAnswer,
  );
});

test("each tool request executes only after its model response, Hook and policy, then returns its actual result", () => {
  const session = createCodexRuntimeMock();
  for (const call of session.calls) {
    const events = mockEventsForCall(session, call.id);
    const one = (name: string) => {
      const found = events.filter((event) => event.name === name);
      assert.equal(found.length, 1, `${call.id}: ${name}`);
      return found[0];
    };
    const request = one("model.tool_call"),
      pre = one("PreToolUse"),
      policy = one("policy.decision"),
      start = one("tool.started");
    const complete = one(
      call.status === "failed" ? "tool.failed" : "tool.completed",
    );
    const post = one(
      call.status === "failed" ? "PostToolUseFailure" : "PostToolUse",
    );
    const context = one("context.tool_result");
    const response = session.events.find(
      (event) =>
        event.name === "model.response.completed" &&
        event.roundId === call.roundId,
    )!;
    assert.ok(
      request.offsetMs < response.offsetMs && response.offsetMs < pre.offsetMs,
    );
    assert.ok(
      pre.offsetMs < policy.offsetMs && policy.offsetMs < start.offsetMs,
    );
    assert.equal(complete.offsetMs - start.offsetMs, call.durationMs);
    assert.ok(
      complete.offsetMs < post.offsetMs && post.offsetMs < context.offsetMs,
    );
    assert.deepEqual(start.input, call.arguments);
    assert.deepEqual(complete.output, call.result);
    assert.deepEqual(context.output?.result, call.result);
    const next = one("model.request");
    assert.ok(next.offsetMs > context.offsetMs);
    assert.equal(next.roundId, context.output?.next_model_request);
  }
});

test("network approval is pending before execution and scoped to the single mock call", () => {
  const session = createCodexRuntimeMock();
  const events = mockEventsForCall(session, "call_docs_04");
  const pending = events.find((event) => event.name === "PermissionRequest")!;
  const approved = events.find((event) => event.name === "approval.decision")!;
  const start = events.find((event) => event.name === "tool.started")!;
  assert.equal(pending.status, "waiting");
  assert.equal(pending.output?.tool_executed, false);
  assert.equal(
    approved.offsetMs - pending.offsetMs,
    approved.output?.wait_duration_ms,
  );
  assert.equal(approved.input?.approval_id, pending.input?.approval_id);
  assert.equal(approved.input?.decision, "allow_once");
  assert.equal(approved.output?.real_permission_granted, false);
  assert.ok(approved.offsetMs < start.offsetMs);
  assert.equal(
    session.events.filter((event) => event.name === "PermissionRequest").length,
    1,
  );
});

test("failure is consumed by the next model before retry, and successful retry reaches final response", () => {
  const session = createCodexRuntimeMock();
  const failure = session.calls.find((call) => call.status === "failed")!;
  const retry = session.calls.find((call) => call.retryOf === failure.id)!;
  const retryRound = session.rounds.find(
    (round) => round.id === retry.roundId,
  )!;
  assert.ok(retryRound.consumedCallIds.includes(failure.id));
  assert.equal(retry.status, "completed");
  assert.ok(
    Number(retry.arguments.timeout_ms) > Number(failure.arguments.timeout_ms),
  );
  const finalRound = session.rounds.at(-1)!;
  assert.ok(finalRound.consumedCallIds.includes(retry.id));
  assert.deepEqual(finalRound.callIds, []);
  assert.equal(finalRound.response, session.finalAnswer);
  assert.deepEqual(session.usage, {
    inputTokens: 11930,
    cachedInputTokens: 9000,
    outputTokens: 915,
  });
  assert.ok(
    session.rounds.every(
      (round) => round.cachedInputTokens <= round.inputTokens,
    ),
  );
});

test("node drilldown preserves related searches and custom prompt flows into all model requests", () => {
  const prompt = "这是另一个演示输入，包含中文与换行。\n不要真实执行。";
  const session = createCodexRuntimeMock(prompt);
  assert.equal(
    session.events.find((event) => event.name === "UserPromptSubmit")?.content,
    prompt,
  );
  assert.equal(
    session.events.find((event) => event.name === "prompt.composition")?.input
      ?.user_message,
    prompt,
  );
  for (const event of session.events.filter(
    (event) => event.name === "model.request",
  ))
    assert.equal(event.input?.user_message, prompt);
  assert.deepEqual(
    mockEventsForNode(session, "search").map((event) => event.callId),
    ["call_files_01", "call_docs_04"],
  );
  assert.ok(
    mockEventsForNode(session, "skill").some(
      (event) => event.content === session.skillText,
    ),
  );
});
