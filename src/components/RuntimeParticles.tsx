import { useEffect, useRef, type RefObject } from "react";
import { runtimeHeartbeat } from "./runtimeHeartbeat";

type Point = { x: number; y: number };
type Anchor = Point & { left: number; right: number; top: number; bottom: number };
type Trace = { points: Point[]; distances: number[]; length: number; color: string; from: string; to: string };

/** ECG traces sit on straight node-to-node lanes so the topology stays readable. */
export function RuntimeParticles({ host, playing, activeEvent }: {
  host: RefObject<HTMLElement | null>;
  playing: boolean;
  activeEvent?: { node: string; relatedNodes: string[] };
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef({ playing, activeEvent });
  live.current = { playing, activeEvent };
  useEffect(() => {
    const element = host.current;
    const surface = canvas.current;
    const ctx = surface?.getContext("2d");
    if (!element || !surface || !ctx) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0, height = 0, frame = 0, previous = 0, elapsed = 1.4;
    let visible = true, dirty = true;
    let traces: Trace[] = [];
    const measure = () => {
      const bounds = element.getBoundingClientRect();
      width = bounds.width;
      height = bounds.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      surface.width = Math.round(width * dpr);
      surface.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      traces = [];
      const anchors = new Map<string, Anchor>();
      element.querySelectorAll<HTMLElement>("[data-runtime-node]").forEach(node => {
        const r = node.getBoundingClientRect();
        anchors.set(node.dataset.runtimeNode!, {
          x: r.left - bounds.left + r.width / 2,
          y: r.top - bounds.top + r.height / 2,
          left: r.left - bounds.left, right: r.right - bounds.left,
          top: r.top - bounds.top, bottom: r.bottom - bounds.top,
        });
      });
      const add = (points: Point[], color = "#63e8ff", from = "", to = "") => {
        const distances = [0];
        for (let i = 1; i < points.length; i++) {
          distances.push(distances[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
        }
        const length = distances.at(-1) || 0;
        if (length > 3) traces.push({ points, distances, length, color, from, to });
      };
      const edgePoint = (from: Anchor, to: Anchor): Point => {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const scale = 1 / Math.max(Math.abs(dx) / Math.max(1, (from.right - from.left) / 2), Math.abs(dy) / Math.max(1, (from.bottom - from.top) / 2));
        return { x: from.x + dx * scale, y: from.y + dy * scale };
      };
      const straight = (fromId: string, toId: string, color?: string) => {
        const from = anchors.get(fromId), to = anchors.get(toId);
        if (!from || !to) return;
        const a = edgePoint(from, to);
        const b = edgePoint(to, from);
        add(Array.from({ length: 180 }, (_, i) => {
          const t = i / 179;
          return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        }), color, fromId, toId);
      };
      straight("input", "context");
      straight("context", "prompt");
      straight("prompt", "model");
      straight("skill", "model", "#c0a1ff");
      straight("model", "hook", "#82ffbf");
      straight("hook", "gate", "#edcf92");
      straight("gate", "tool", "#edcf92");
      straight("gate", "mcp", "#edcf92");
      straight("tool", "search", "#82ffbf");
      straight("mcp", "search", "#82ffbf");
      straight("tool", "result", "#82ffbf");
      straight("mcp", "result", "#82ffbf");
      straight("result", "model", "#c0a1ff");
      straight("model", "output");
      dirty = true;
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element.querySelectorAll("[data-runtime-node]").forEach(node => observer.observe(node));
    measure();
    const onMotion = () => { dirty = true; };
    media.addEventListener("change", onMotion);
    function draw(now: number) {
      frame = requestAnimationFrame(draw);
      if (!visible || document.hidden || now - previous < 32) return;
      const dt = previous ? Math.min((now - previous) / 1000, 0.06) : 0;
      previous = now;
      const moving = live.current.playing && !media.matches;
      if (!moving && !dirty) return;
      if (moving) elapsed += dt;
      dirty = false;
      ctx!.clearRect(0, 0, width, height);
      ctx!.globalCompositeOperation = "lighter";
      ctx!.lineCap = "round";
      ctx!.lineJoin = "round";
      traces.forEach((trace, index) => {
        ctx!.beginPath();
        trace.points.forEach((p, i) => {
          if (i === 0) ctx!.moveTo(p.x, p.y);
          else ctx!.lineTo(p.x, p.y);
        });
        ctx!.lineWidth = 0.8;
        ctx!.globalAlpha = 0.28;
        ctx!.strokeStyle = trace.color;
        ctx!.shadowBlur = 0;
        ctx!.stroke();

        const event = live.current.activeEvent;
        const participants = event ? [event.node, ...event.relatedNodes] : [];
        const activeIndex = event
          ? traces.findIndex(trace => participants.includes(trace.from) && participants.includes(trace.to))
          : Math.floor((elapsed * 0.55) % traces.length);
        if (activeIndex !== index) return;
        const step = (elapsed * 0.55) % traces.length;
        const activeTrace = traces[activeIndex];
        const travel = (elapsed * 0.55) % 1;
        const progress = event
          ? event.node === activeTrace.from ? travel : 1 - travel
          : step - index;
        const halfBeat = Math.min(72, trace.length * 0.36);
        const center = progress * trace.length;
        const amplitude = Math.min(16, trace.length * 0.2);
        const shape = trace.points.map((p, i) => {
          const before = trace.points[Math.max(0, i - 1)];
          const after = trace.points[Math.min(trace.points.length - 1, i + 1)];
          const dx = after.x - before.x, dy = after.y - before.y;
          const norm = Math.hypot(dx, dy) || 1;
          const u = trace.distances[i] / trace.length;
          const fade = Math.min(1, u * 12, (1 - u) * 12);
          const offset = runtimeHeartbeat((trace.distances[i] - center) / halfBeat) * amplitude * fade;
          return { x: p.x + dy / norm * offset, y: p.y - dx / norm * offset };
        });
        const stroke = (lineWidth: number, opacity: number, blur: number, highlight: boolean) => {
          ctx!.beginPath();
          let started = false;
          shape.forEach((p, i) => {
            if (highlight && Math.abs(trace.distances[i] - center) > halfBeat * 1.15) { started = false; return; }
            if (!started) ctx!.moveTo(p.x, p.y);
            else ctx!.lineTo(p.x, p.y);
            started = true;
          });
          ctx!.lineWidth = lineWidth;
          ctx!.globalAlpha = opacity;
          ctx!.strokeStyle = highlight && lineWidth < 2 ? "#e5fff8" : trace.color;
          ctx!.shadowColor = trace.color;
          ctx!.shadowBlur = blur;
          ctx!.stroke();
        };
        stroke(4, 0.24, 12, true);
        stroke(1.5, 0.98, 5, true);
      });
      ctx!.globalAlpha = 1;
      ctx!.shadowBlur = 0;
    }
    const intersection = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      previous = 0;
      dirty = true;
    });
    intersection.observe(element);
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      intersection.disconnect();
      media.removeEventListener("change", onMotion);
    };
  }, [host]);
  return <canvas ref={canvas} className="rt-particle-field" aria-hidden="true" />;
}
