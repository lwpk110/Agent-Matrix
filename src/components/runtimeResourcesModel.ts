import type { MockContextSnapshot, MockMemory, MockRuntimeEvent } from "./codexRuntimeMock";

/** Project only events already visible in the replay, never the scenario's future totals. */
export function runtimeResources(events: MockRuntimeEvent[]) {
  const usage = new Map<string, { id: string; input: number; cached: number | null; output: number; time: string }>();
  const requests = new Set<string>();
  let context: (MockContextSnapshot & { roundId: string; time: string }) | null = null;
  let memories: MockMemory[] | null = null;
  const loaded = new Set<string>();
  let catalogue: Record<string, unknown> | null = null;
  const skills = new Set<string>();
  const calls = new Set<string>();
  const hooks = new Set<string>();
  const approvals = new Set<string>();
  let lastUsage: string | null = null;
  const valid = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
  for (const event of events) {
    if (event.name === "model.request" && event.roundId) {
      requests.add(event.roundId);
      const snapshot = event.input?.context_snapshot as MockContextSnapshot | undefined;
      if (snapshot) context = { ...snapshot, roundId: event.roundId, time: event.time };
    }
    if (event.name === "model.response.completed" && event.roundId) {
      const data = event.output;
      if (valid(data?.input_tokens) && valid(data?.output_tokens)) {
        usage.set(event.roundId, { id: event.roundId, input: data.input_tokens, output: data.output_tokens,
          cached: valid(data.cached_input_tokens) && data.cached_input_tokens <= data.input_tokens ? data.cached_input_tokens : null, time: event.time });
        lastUsage = event.time;
      }
    }
    if (event.name === "memory.snapshot") {
      memories = (event.output?.entries as MockMemory[]) ?? [];
      loaded.clear();
      for (const id of (event.output?.loaded_ids as string[]) ?? []) loaded.add(id);
    }
    if (event.name === "memory.loaded" && typeof event.output?.memory_id === "string") loaded.add(event.output.memory_id);
    if (event.name === "capabilities.snapshot") catalogue = event.output ?? null;
    if (event.name === "skill.reference.loaded") skills.add(String(event.input?.name ?? event.id));
    if (event.name === "tool.started" && event.callId) calls.add(event.callId);
    if (event.source === "Hook") hooks.add(event.name);
    if (event.name === "PermissionRequest") approvals.add(String(event.input?.approval_id ?? event.id));
  }
  const rounds = [...usage.values()];
  const input = rounds.reduce((sum, round) => sum + round.input, 0);
  const output = rounds.reduce((sum, round) => sum + round.output, 0);
  const cached = rounds.length && rounds.every(round => round.cached !== null)
    ? rounds.reduce((sum, round) => sum + round.cached!, 0) : null;
  return {
    rounds, input, output, cached, total: rounds.length ? input + output : null,
    pending: [...requests].filter(id => !usage.has(id)).length,
    requests: requests.size, lastUsage,
    context, memories, loaded,
    catalogue, skillCount: Array.isArray(catalogue?.skills) ? catalogue.skills.length : null,
    serverCount: Array.isArray(catalogue?.servers) ? catalogue.servers.length : null,
    toolCount: Array.isArray(catalogue?.tools) ? catalogue.tools.length : null,
    loadedSkills: skills.size, calls: calls.size, hooks: hooks.size, approvals: approvals.size,
  };
}
