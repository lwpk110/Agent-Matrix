import { useEffect, useRef, type RefObject } from "react";
import type { MockRuntimeEvent } from "./codexRuntimeMock";
import { runtimeFlow, type RuntimeFlow } from "./runtimeFlow";

type Point = { x: number; y: number };
type Anchor = Point & { left: number; right: number; top: number; bottom: number };
type Trace = { points: Point[]; distances: number[]; length: number; color: string; from: string; to: string };

function rounded(points: Point[]) {
  const sampled: Point[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1], b = points[i], c = points[i + 1];
    const before = Math.hypot(b.x - a.x, b.y - a.y), after = Math.hypot(c.x - b.x, c.y - b.y);
    const radius = Math.min(18, before / 2, after / 2);
    const enter = { x: b.x + (a.x - b.x) * radius / (before || 1), y: b.y + (a.y - b.y) * radius / (before || 1) };
    const exit = { x: b.x + (c.x - b.x) * radius / (after || 1), y: b.y + (c.y - b.y) * radius / (after || 1) };
    sampled.push(enter);
    for (let k = 1; k <= 12; k++) {
      const t = k / 12, s = 1 - t;
      sampled.push({ x: s * s * enter.x + 2 * s * t * b.x + t * t * exit.x, y: s * s * enter.y + 2 * s * t * b.y + t * t * exit.y });
    }
  }
  sampled.push(points.at(-1)!);
  return sampled;
}

/** Routed energy packets: quiet conduits, a luminous head, and a short fading tail. */
export function RuntimeParticles({ host, playing, activeEvent, activeFlow, visualKey, flowActive = true, eventDuration = 900, replaying = false, liveMode = false }: {
  host: RefObject<HTMLElement | null>; playing: boolean; activeEvent?: MockRuntimeEvent; activeFlow?: RuntimeFlow; visualKey?: string; flowActive?: boolean; eventDuration?: number; replaying?: boolean; liveMode?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef({ playing, activeEvent, activeFlow, visualKey, flowActive, eventDuration, replaying, liveMode });
  live.current = { playing, activeEvent, activeFlow, visualKey, flowActive, eventDuration, replaying, liveMode };
  useEffect(() => {
    const element = host.current, surface = canvas.current, ctx = surface?.getContext("2d");
    if (!element || !surface || !ctx) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0, height = 0, frame = 0, previous = 0, elapsed = 0, eventAge = 0;
    let eventId: string | undefined, visible = true, dirty = true;
    let traces: Trace[] = [];
    const measure = () => {
      const bounds = element.getBoundingClientRect();
      width = bounds.width; height = bounds.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      surface.width = Math.round(width * dpr); surface.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const anchors = new Map<string, Anchor>();
      element.querySelectorAll<HTMLElement>("[data-runtime-node]").forEach(node => {
        const target = node.dataset.runtimeNode === "model"
          ? node.querySelector<SVGElement>(".rt-core-reticle") ?? node
          : node;
        const r = target.getBoundingClientRect();
        anchors.set(node.dataset.runtimeNode!, { x: r.left - bounds.left + r.width / 2, y: r.top - bounds.top + r.height / 2, left: r.left - bounds.left, right: r.right - bounds.left, top: r.top - bounds.top, bottom: r.bottom - bounds.top });
      });
      traces = [];
      const add = (from: string, to: string, path: (a: Anchor, b: Anchor) => Point[], color = "#72e7f4") => {
        const a = anchors.get(from), b = anchors.get(to);
        if (!a || !b) return;
        const points = rounded(path(a, b)), distances = [0];
        for (let i = 1; i < points.length; i++) distances.push(distances[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
        traces.push({ from, to, points, distances, length: distances.at(-1)! , color });
      };
      const across = (a: Anchor, b: Anchor) => b.top >= a.bottom
        ? [{ x: a.right, y: a.y }, { x: width - 8, y: a.y }, { x: width - 8, y: b.y }, { x: b.right, y: b.y }]
        : [{ x: a.right, y: a.y }, { x: (a.right + b.left) / 2, y: a.y }, { x: (a.right + b.left) / 2, y: b.y }, { x: b.left, y: b.y }];
      const down = (a: Anchor, b: Anchor) => [{ x: a.x, y: a.bottom }, { x: a.x, y: (a.bottom + b.top) / 2 }, { x: b.x, y: (a.bottom + b.top) / 2 }, { x: b.x, y: b.top }];
      add("input", "context", across); add("context", "prompt", across);
      add("prompt", "model", (a, b) => width <= 600 ? [{ x: a.right, y: a.y }, { x: width - 8, y: a.y }, { x: width - 8, y: b.y - 38 }, { x: b.right, y: b.y - 38 }] : [{ x: a.x, y: a.bottom }, { x: a.x, y: a.bottom + 23 }, { x: b.x, y: a.bottom + 23 }, { x: b.x, y: b.top }]);
      add("skill", "model", across, "#bca8f7"); add("model", "hook", across);
      add("hook", "gate", down, "#dfc18a"); add("gate", "tool", down, "#dfc18a"); add("gate", "mcp", down, "#dfc18a");
      add("model", "tool", across); add("model", "mcp", across);
      add("search", "model", across, "#bca8f7");
      ["tool", "mcp"].forEach(id => add(id, "result", (a, b) => {
        const left = id === "tool", side = left ? a.left - 9 : a.right + 9;
        return [{ x: a.x, y: a.bottom }, { x: a.x, y: a.bottom + 8 }, { x: side, y: a.bottom + 8 }, { x: side, y: b.y }, { x: left ? b.left : b.right, y: b.y }];
      }, "#bca8f7"));
      add("result", "model", (a, b) => {
        const side = width <= 800 ? -1 : 1;
        const scale = Math.min(b.right - b.left, b.bottom - b.top) / 300;
        // Match the diagonal connector endpoint in rt-core-reticle's 300x300 viewBox.
        const port = { x: b.x + side * 108 * scale, y: b.y + 108 * scale };
        const approach = { x: port.x + side * 18 * scale, y: port.y + 18 * scale };
        return width <= 800
          ? [{ x: a.left, y: a.y }, { x: 8, y: a.y }, { x: 8, y: approach.y }, approach, port]
          : [{ x: a.left, y: a.y }, { x: (a.left + b.right) / 2, y: a.y }, { x: (a.left + b.right) / 2, y: approach.y }, approach, port];
      }, "#bca8f7");
      add("model", "output", down);
      dirty = true;
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element); element.querySelectorAll("[data-runtime-node]").forEach(node => observer.observe(node)); measure();
    const onMotion = () => { dirty = true; }; media.addEventListener("change", onMotion);
    const pointAt = (trace: Trace, distance: number) => {
      const d = Math.max(0, Math.min(trace.length, distance)); let i = 1;
      while (i < trace.distances.length - 1 && trace.distances[i] < d) i++;
      const a = trace.points[i - 1], b = trace.points[i], t = (d - trace.distances[i - 1]) / (trace.distances[i] - trace.distances[i - 1] || 1);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    };
    const drawPacket = (trace: Trace, section: number) => {
      const t = Math.min(1, section / 0.86), eased = t * t * t * (t * (t * 6 - 15) + 10), head = eased * trace.length;
      const tail = Math.min(76, trace.length * 0.44), opacity = Math.min(1, section * 5) * Math.min(1, (1 - section) * 6);
      ctx!.shadowColor = trace.color;
      for (let s = 0; s < 30; s++) {
        const d = head - tail + tail * s / 30; if (d < 0) continue;
        const a = pointAt(trace, d), b = pointAt(trace, d + tail / 30 + 0.5);
        ctx!.beginPath(); ctx!.moveTo(a.x, a.y); ctx!.lineTo(b.x, b.y);
        ctx!.strokeStyle = s > 25 ? "#eaffff" : trace.color; ctx!.lineWidth = 1.2 + s / 30;
        ctx!.shadowBlur = 8; ctx!.globalAlpha = (s / 30) ** 2 * opacity; ctx!.stroke();
      }
      const tip = pointAt(trace, head); ctx!.beginPath(); ctx!.arc(tip.x, tip.y, 2.3, 0, Math.PI * 2);
      ctx!.fillStyle = "#f2ffff"; ctx!.shadowBlur = 13; ctx!.globalAlpha = opacity; ctx!.fill();
      if (section > 0.7) {
        const arrival = (section - 0.7) / 0.3, end = trace.points.at(-1)!;
        ctx!.beginPath(); ctx!.arc(end.x, end.y, 4 + arrival * 21, 0, Math.PI * 2);
        ctx!.lineWidth = 1; ctx!.strokeStyle = trace.color; ctx!.shadowBlur = 4; ctx!.globalAlpha = (1 - arrival) * 0.65; ctx!.stroke();
      }
    };
    const routeFor = (from: string, to: string): Trace | undefined => {
      const direct = traces.find(trace => trace.from === from && trace.to === to);
      if (direct) return direct;
      const queue: Array<{ node: string; segments: Trace[] }> = [{ node: from, segments: [] }];
      const visited = new Set([from]);
      while (queue.length) {
        const current = queue.shift()!;
        for (const trace of traces.filter(item => item.from === current.node)) {
          if (visited.has(trace.to)) continue;
          const segments = [...current.segments, trace];
          if (trace.to === to) {
            const points: Point[] = [];
            segments.forEach(segment => points.push(...(points.length ? segment.points.slice(1) : segment.points)));
            const distances = [0];
            for (let i = 1; i < points.length; i++) distances.push(distances[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
            return { from, to, points, distances, length: distances.at(-1)!, color: segments[0].color };
          }
          visited.add(trace.to);
          queue.push({ node: trace.to, segments });
        }
      }
      return undefined;
    };
    function draw(now: number) {
      frame = requestAnimationFrame(draw);
      if (!visible || document.hidden) { previous = 0; return; }
      if (now - previous < 30) return;
      const dt = previous ? Math.min((now - previous) / 1000, 0.06) : 0; previous = now;
      const state = live.current;
      const eventKey = state.visualKey ?? (state.activeEvent ? `${state.activeEvent.id}:${state.activeEvent.status}` : undefined);
      if (eventId !== eventKey) { eventId = eventKey; eventAge = 0; dirty = true; }
      const moving = state.playing && !media.matches;
      if (!moving && !dirty) return;
      if (moving) { elapsed += dt; eventAge += dt; } dirty = false;
      ctx!.clearRect(0, 0, width, height); ctx!.lineCap = "round"; ctx!.lineJoin = "round";
      const flow = state.activeFlow ?? runtimeFlow(state.activeEvent), idleStep = elapsed / 1.85;
      let drewActiveRoute = false;
      traces.forEach((trace, index) => {
        ctx!.beginPath(); trace.points.forEach((p, i) => i ? ctx!.lineTo(p.x, p.y) : ctx!.moveTo(p.x, p.y));
        ctx!.lineWidth = 1; ctx!.strokeStyle = trace.color; ctx!.globalAlpha = 0.19; ctx!.shadowBlur = 0; ctx!.stroke();
        const group = index < 3 ? [0, 3] : index < 8 ? [3, 5] : [8, traces.length - 8];
        const idleAge = idleStep + group[0] * 0.23;
        const active = flow && state.flowActive
          ? trace.from === flow.from && trace.to === flow.to
          : !state.liveMode && !state.replaying && group[0] + Math.floor(idleAge) % group[1] === index;
        if (!active) return;
        const section = flow ? Math.min(1, eventAge / Math.max(0.42, state.eventDuration / 1000)) : idleAge % 1;
        if (section >= 0 && section <= 1) { drawPacket(trace, section); if (flow) drewActiveRoute = true; }
      });
      if (flow && state.flowActive && !drewActiveRoute) {
        const route = routeFor(flow.from, flow.to);
        const section = Math.min(1, eventAge / Math.max(0.42, state.eventDuration / 1000));
        if (route) drawPacket(route, section);
      }
      ctx!.globalAlpha = 1; ctx!.shadowBlur = 0;
    }
    const intersection = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; previous = 0; dirty = true; });
    intersection.observe(element); frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); intersection.disconnect(); media.removeEventListener("change", onMotion); };
  }, [host]);
  return <canvas ref={canvas} className="rt-particle-field" aria-hidden="true" />;
}
