import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  ArrowLeft,
  Crosshair,
  Info,
  Pause,
  Network,
  Play,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { createCodexRuntimeMock, type MockNodeId } from "../codexRuntimeMock";
import type { LogEntry } from "../../types/matrix";
import { createCodexRuntimeSessionFromLogs, latestObservedCodexEvent } from "../codexRuntimeAdapter";
import { RUNTIME_EDGES, RUNTIME_NODES, type RuntimeNode } from "./model";
import { glowTexture } from "../topology/visualAssets";
import { createEnergyConduit } from "./energyConduit";
import { runtimeFlow } from "../runtimeFlow";
import type { CodexRolloutTelemetry } from "../../types/codexTelemetry";
import "../codex3d/Codex3DTopology.css";

const nodeById = new Map(RUNTIME_NODES.map((node) => [node.id, node]));

function glyphTexture(node: RuntimeNode) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d")!;
  context.translate(32, 32);
  context.scale(8, 8);
  for (const [blur, opacity] of [
    [10, 0.18],
    [4, 0.45],
    [0, 1],
  ]) {
    context.globalAlpha = opacity;
    context.shadowColor = "#d8f4ff";
    context.shadowBlur = blur;
    context.strokeStyle = "#fff";
    context.lineWidth = 1.45;
    context.lineCap = "round";
    context.lineJoin = "round";
    node.glyph.forEach((path) => context.stroke(new Path2D(path)));
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

type NodeVisualState = "idle" | "active" | "waiting" | "failed" | "completed";

function lineLoop(points: Array<[number, number, number]>, material: THREE.LineBasicMaterial) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  return new THREE.LineLoop(geometry, material);
}

function linePath(points: Array<[number, number, number]>, material: THREE.LineBasicMaterial) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  return new THREE.Line(geometry, material);
}

function accentMaterial(color: string, opacity = 0.54) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

function accentLineMaterial(color: string, opacity = 0.6) {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

/** Small semantic ornaments keep every endpoint recognisable at a glance. */
function createNodeAccent(node: RuntimeNode) {
  const accent = new THREE.Group();
  accent.name = "semantic-accent";
  const color = node.color;
  const line = accentLineMaterial(color);
  const dimLine = accentLineMaterial(color, 0.34);
  const addRing = (radius: number, thickness = 0.025, opacity = 0.58) => {
    const mesh = new THREE.Mesh(new THREE.RingGeometry(radius, radius + thickness, 64), accentMaterial(color, opacity));
    mesh.rotation.x = -Math.PI / 2;
    mesh.name = "accent-ring";
    accent.add(mesh);
    return mesh;
  };
  if (node.id === "input") {
    // Three expanding message ripples.
    [1.9, 2.45, 3].forEach((radius, index) => {
      const ring = addRing(radius, 0.025, 0.28 - index * 0.05);
      ring.position.y = 0.16 + index * 0.025;
    });
  } else if (node.id === "context") {
    // Layered context snapshots, like translucent sheets being stacked.
    [0, 0.42, 0.84].forEach((offset, index) => {
      const sheet = lineLoop([[-1.45, 0.3 + offset, 0.3 - index * 0.18], [1.45, 0.3 + offset, 0.3 - index * 0.18], [1.45, 0.3 + offset, -0.55 - index * 0.18], [-1.45, 0.3 + offset, -0.55 - index * 0.18]], index === 0 ? line : dimLine);
      accent.add(sheet);
    });
  } else if (node.id === "prompt") {
    // A document frame with animated message baselines.
    accent.add(lineLoop([[-1.05, 0.25, 0], [0.75, 0.25, 0], [1.05, 0.65, 0], [1.05, 2.05, 0], [-1.05, 2.05, 0]], line));
    [0.75, 1.08, 1.41].forEach((y, index) => accent.add(linePath([[-0.72, y, 0], [index === 2 ? 0.38 : 0.78, y, 0]], dimLine)));
  } else if (node.id === "skill") {
    // Open guide ring / book silhouette.
    accent.add(lineLoop([[-1.38, 0.4, 0], [-0.1, 0.68, 0], [-0.1, 2.05, 0], [-1.38, 1.75, 0]], line));
    accent.add(lineLoop([[1.38, 0.4, 0], [0.1, 0.68, 0], [0.1, 2.05, 0], [1.38, 1.75, 0]], line));
    accent.add(linePath([[-0.1, 0.68, 0], [0, 0.52, 0], [0.1, 0.68, 0]], dimLine));
  } else if (node.id === "hook") {
    // Lifecycle fan: pre, around, post.
    const points: Array<[number, number, number]> = [[-1.2, 0.2, 0], [0, 1.85, 0], [1.2, 0.2, 0]];
    accent.add(linePath(points, line));
    points.forEach(([x, y, z], index) => {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(index === 1 ? 0.2 : 0.15, 12, 8), accentMaterial(color, 0.76));
      dot.position.set(x, y, z);
      dot.name = "hook-dot";
      accent.add(dot);
    });
  } else if (node.id === "gate") {
    // Hexagonal approval seal with a second lock ring.
    const seal = new THREE.Mesh(new THREE.RingGeometry(1.55, 1.59, 6), accentMaterial(color, 0.7));
    seal.rotation.x = -Math.PI / 2;
    seal.name = "gate-seal";
    accent.add(seal);
    const lock = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.045, 8, 32), accentMaterial(color, 0.75));
    lock.position.y = 1.15;
    lock.rotation.x = Math.PI / 2;
    accent.add(lock);
    accent.add(linePath([[-0.52, 0.8, 0], [0.52, 0.8, 0]], dimLine));
  } else if (node.id === "tool") {
    // Terminal frame and a scan cursor.
    accent.add(lineLoop([[-1.55, 0.35, 0], [1.55, 0.35, 0], [1.55, 1.95, 0], [-1.55, 1.95, 0]], line));
    accent.add(linePath([[-1.15, 0.75, 0], [-0.72, 1.1, 0], [-1.15, 1.45, 0]], line));
    accent.add(linePath([[-0.42, 0.75, 0], [0.78, 0.75, 0]], dimLine));
  } else if (node.id === "mcp") {
    // Two connector sockets joined by an external-service bridge.
    [-0.72, 0.72].forEach((x) => {
      const socket = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.065, 8, 32), accentMaterial(color, 0.7));
      socket.position.set(x, 1.05, 0);
      socket.rotation.y = Math.PI / 2;
      accent.add(socket);
    });
    accent.add(linePath([[-0.3, 1.05, 0], [0.3, 1.05, 0]], line));
    accent.add(addRing(1.8, 0.018, 0.22));
  } else if (node.id === "search") {
    // Retrieval scan ring and crosshair.
    accent.add(addRing(1.48, 0.035, 0.62));
    accent.add(linePath([[-1.85, 0.3, 0], [1.85, 0.3, 0]], dimLine));
    accent.add(linePath([[0, 0.3, -1.85], [0, 0.3, 1.85]], dimLine));
  } else if (node.id === "output") {
    // Return acknowledgement rings.
    [1.8, 2.35].forEach((radius, index) => {
      const ring = addRing(radius, 0.026, 0.3 - index * 0.06);
      ring.position.y = 0.12 + index * 0.04;
    });
    accent.add(linePath([[-1.1, 1.1, 0], [-0.2, 0.35, 0], [1.22, 1.75, 0]], line));
  }
  accent.position.y = -0.08;
  return accent;
}

function nodeRole(node: RuntimeNode) {
  return ({
    input: "MESSAGE",
    context: "SNAPSHOT",
    prompt: "ASSEMBLY",
    skill: "GUIDE",
    model: "INFERENCE",
    hook: "LIFECYCLE",
    gate: "CONTROL",
    tool: "LOCAL",
    mcp: "CONNECTOR",
    search: "RETRIEVAL",
    output: "RESPONSE",
  } as Record<MockNodeId, string>)[node.id];
}

export function Codex3DTopology({ logs = [] }: { logs?: LogEntry[] }) {
  const host = useRef<HTMLDivElement>(null);
  const labelRefs = useRef(new Map<MockNodeId, HTMLButtonElement>());
  const [selected, setSelected] = useState<MockNodeId | null>(null);
  const [hovered, setHovered] = useState<MockNodeId | null>(null);
  const [paused, setPaused] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [view, setView] = useState<"orbit" | "top">("orbit");
  const [replaying, setReplaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [traceReady, setTraceReady] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [lineageOpen, setLineageOpen] = useState(false);
  const [rolloutTelemetry, setRolloutTelemetry] = useState<CodexRolloutTelemetry | null>(null);
  const [stats, setStats] = useState({
    fps: 60,
    pulses: 1,
  });
  const observedSession = useMemo(() => createCodexRuntimeSessionFromLogs(logs), [logs]);
  useEffect(() => {
    if (!observedSession) {
      setRolloutTelemetry(null);
      return;
    }
    const { id: sessionId, turnId } = observedSession;
    let active = true;
    let pending = false;
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try {
        const query = new URLSearchParams({ sessionId, turnId });
        const response = await fetch(`/api/real/codex-rollout?${query}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Rollout telemetry unavailable");
        const result = await response.json() as { telemetry: CodexRolloutTelemetry | null };
        if (active) setRolloutTelemetry(result.telemetry);
      } catch {
        if (active) setRolloutTelemetry(null);
      } finally {
        pending = false;
      }
    };
    setRolloutTelemetry(null);
    void refresh();
    const timer = window.setInterval(refresh, 4000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [observedSession?.id, observedSession?.turnId]);
  const liveTelemetry = rolloutTelemetry?.sessionId === observedSession?.id && rolloutTelemetry?.turnId === observedSession?.turnId
    ? rolloutTelemetry
    : null;
  const liveSession = useMemo(() => createCodexRuntimeSessionFromLogs(logs, liveTelemetry), [logs, liveTelemetry]);
  const demoSession = useMemo(() => createCodexRuntimeMock(), []);
  const session = liveSession || demoSession;
  const liveMode = Boolean(liveSession);
  const observedTools = useMemo(() => {
    const groups = new Map<string, number>();
    session.calls.filter(call => call.type === "local").forEach(call => groups.set(call.name, (groups.get(call.name) ?? 0) + 1));
    return [...groups.entries()].map(([name, count]) => ({ name, count }));
  }, [session.calls]);
  const observedMcp = useMemo(() => {
    const groups = new Map<string, { count: number; tools: Map<string, number> }>();
    session.calls.filter(call => call.type === "mcp").forEach(call => {
      const namespaced = call.name.startsWith("mcp__") ? call.name.slice(5).split("__") : null;
      const separator = call.name.includes("/") ? "/" : ".";
      const [server, ...rest] = namespaced?.length === 2 ? namespaced : call.name.split(separator);
      const group = groups.get(server) ?? { count: 0, tools: new Map<string, number>() };
      group.count += 1;
      const tool = rest.join(separator) || call.name;
      group.tools.set(tool, (group.tools.get(tool) ?? 0) + 1);
      groups.set(server, group);
    });
    return [...groups.entries()].map(([name, value]) => ({ name, ...value }));
  }, [session.calls]);
  const observedSkills = useMemo(() => {
    const names = session.events.filter(event => event.node === "skill").map(event => event.input?.name || event.title);
    return [...new Set(names.map(name => String(name).trim()).filter(Boolean))];
  }, [session.events]);
  const totalTokens = liveSession?.rolloutTelemetry?.turnUsage?.totalTokens
    ?? (session.usage.inputTokens !== null && session.usage.outputTokens !== null
      ? session.usage.inputTokens + session.usage.outputTokens
      : null);
  const latestObservedEvent = useMemo(() => liveSession ? latestObservedCodexEvent(liveSession, logs) : undefined, [liveSession, logs]);
  const selectedNode = selected ? nodeById.get(selected) : undefined;
  const currentEvent = traceReady ? session.events[progress] : undefined;
  const visualEvent = replaying ? currentEvent : liveMode ? latestObservedEvent : currentEvent;
  const selectedEvents = selectedNode
    ? session.events
        .filter((event) => event.node === selectedNode.id || event.relatedNodes.includes(selectedNode.id))
        .slice(-4)
        .reverse()
    : [];
  const nodeNote = (node: RuntimeNode) => {
    if (!liveMode) return node.note;
    const nodeEvents = session.events.filter(event => event.node === node.id);
    if (node.id === "model") return session.rounds.length ? `${session.rounds.length} 条请求记录` : "模型请求未采集";
    if (nodeEvents.length) return `${nodeEvents.length} 条事件已采集`;
    return "本回合暂无事件";
  };
  const nodeSummary = (node: RuntimeNode) => {
    if (!liveMode) return node.summary;
    const lastEvent = session.events.filter(event => event.node === node.id).at(-1);
    return lastEvent?.summary || "当前会话没有采集到此节点事件；拓扑位置表示运行阶段，不代表本回合实际执行。";
  };
  const live = useRef({ selected, hovered, paused, autoRotate, view, currentEvent: visualEvent, playbackSpeed, liveMode, replaying });
  live.current = { selected, hovered, paused, autoRotate, view, currentEvent: visualEvent, playbackSpeed, liveMode, replaying };

  useEffect(() => {
    if (!replaying || paused) return;
    if (progress >= session.events.length - 1) {
      setReplaying(false);
      return;
    }
    const gap =
      session.events[progress + 1].offsetMs - session.events[progress].offsetMs;
    const timer = window.setTimeout(
      () => setProgress((value) => value + 1),
      Math.min(1500, Math.max(420, gap * 0.82) / playbackSpeed),
    );
    return () => window.clearTimeout(timer);
  }, [progress, replaying, paused, playbackSpeed, session]);

  useEffect(() => {
    const mount = host.current;
    if (!mount) return;
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x050914, 28, 64);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    mount.appendChild(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(16, 18, 23);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.autoRotateSpeed = 0.3;
    controls.minDistance = 10;
    controls.maxDistance = 44;
    controls.target.set(0, 1.2, 0);
    const mobilePositions: Record<MockNodeId, [number, number, number]> = {
      input: [-5, 0.2, 7],
      context: [-5, 1.7, 0],
      prompt: [-5, 1.7, -7],
      skill: [0, 1.7, -9],
      model: [0, 3.4, 0],
      hook: [5, 2.2, -7],
      gate: [5, 2.2, 0],
      tool: [5, 0.3, 7],
      mcp: [0, 0.3, 13],
      search: [-5, 1.7, 13],
      output: [0, 0.2, 7],
    };
    let mobileLayout = mount.clientWidth <= 600;
    const nodePosition = (node: RuntimeNode): [number, number, number] =>
      mobileLayout ? mobilePositions[node.id] : node.position;
    const textures = [
      glowTexture(),
      ...RUNTIME_NODES.map((node) => glyphTexture(node)),
    ];
    const glow = textures[0];
    const objectMap = new Map<
      MockNodeId,
      {
        group: THREE.Group;
        icon: THREE.Sprite;
        ring: THREE.Mesh;
        accent: THREE.Group;
        statusDot: THREE.Mesh;
        arrival: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
        hit: THREE.Mesh;
      }
    >();
    const coreOrbits: THREE.Mesh[] = [];
    const hitMaterial = new THREE.MeshBasicMaterial({ visible: false });
    const hitGeometry = new THREE.SphereGeometry(1.4, 12, 8);
    for (const node of RUNTIME_NODES) {
      const group = new THREE.Group();
      group.position.set(...nodePosition(node));
      const icon = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: textures[RUNTIME_NODES.indexOf(node) + 1],
          color: 0xffffff,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      icon.scale.setScalar(node.id === "model" ? 4 : 2.8);
      icon.position.y = 1.2;
      group.add(icon);
      const aura = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glow,
          color: node.color,
          opacity: node.id === "model" ? 0.34 : 0.3,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      aura.scale.setScalar(node.id === "model" ? 9 : 6.2);
      aura.position.y = 1;
      group.add(aura);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(
          node.id === "model" ? 2.2 : 1.5,
          node.id === "model" ? 2.25 : 1.54,
          64,
        ),
        new THREE.MeshBasicMaterial({
          color: node.color,
          transparent: true,
          opacity: 0.65,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      group.add(ring);
      const accent = createNodeAccent(node);
      group.add(accent);
      const statusDot = new THREE.Mesh(
        new THREE.SphereGeometry(0.095, 12, 8),
        accentMaterial("#496278", 0.72),
      );
      statusDot.position.set(1.58, 2.42, 0.02);
      statusDot.name = "status-dot";
      group.add(statusDot);
      const arrival = new THREE.Mesh(
        new THREE.RingGeometry(1.55, 1.58, 64),
        new THREE.MeshBasicMaterial({ color: 0xcafff7, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      arrival.rotation.x = -Math.PI / 2;
      arrival.position.y = 0.04;
      group.add(arrival);
      if (node.id === "model") {
        const positions = new Float32Array(200 * 3);
        for (let i = 0; i < 200; i++) {
          const y = 1 - (i / 199) * 2, radius = Math.sqrt(1 - y * y), angle = i * 2.39996;
          positions.set([Math.cos(angle) * radius * 1.65, y * 1.65 + 1.2, Math.sin(angle) * radius * 1.65], i * 3);
        }
        const shell = new THREE.BufferGeometry();
        shell.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        group.add(new THREE.Points(shell, new THREE.PointsMaterial({ color: 0xa5e9ec, size: 0.035, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false })));
        [3, 3.55, 4.05].forEach((radius, index) => {
          const orbit = new THREE.Mesh(
            new THREE.TorusGeometry(
              radius,
              index === 1 ? 0.018 : 0.03,
              8,
              180,
            ),
            new THREE.MeshBasicMaterial({
              color: index === 1 ? 0xc3a9ff : 0x8be6ff,
              transparent: true,
              opacity: index === 1 ? 0.58 : 0.76,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            }),
          );
          orbit.position.y = 1.2;
          orbit.rotation.set(0.74 + index * 0.18, index * 0.55, 0.25 + index * 0.42);
          coreOrbits.push(orbit);
          group.add(orbit);
        });
      }
      const tether = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, -0.1, 0),
          new THREE.Vector3(0, 0.85, 0),
        ]),
        new THREE.LineBasicMaterial({
          color: node.color,
          transparent: true,
          opacity: 0.35,
          blending: THREE.AdditiveBlending,
        }),
      );
      group.add(tether);
      const hit = new THREE.Mesh(hitGeometry, hitMaterial);
      hit.position.y = 1;
      hit.userData.nodeId = node.id;
      group.add(hit);
      objectMap.set(node.id, { group, icon, ring, accent, statusDot, arrival, hit });
      scene.add(group);
    }
    const grid = new THREE.GridHelper(42, 42, 0x1d5a78, 0x102a43);
    grid.position.y = -1;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.16;
    scene.add(grid);
    [6, 12, 18].forEach(radius => {
      const orbit = new THREE.Mesh(new THREE.RingGeometry(radius, radius + 0.018, 160), new THREE.MeshBasicMaterial({ color: 0x8bcdd5, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }));
      orbit.rotation.x = -Math.PI / 2; orbit.position.y = -0.97; scene.add(orbit);
    });
    const starPositions = new Float32Array(720 * 3);
    for (let i = 0; i < 720; i++) {
      const angle = i * 2.4;
      const radius = 18 + (i % 37) * 0.82;
      starPositions.set(
        [
          Math.cos(angle) * radius,
          -4 + (i % 39) * 0.62,
          Math.sin(angle) * radius,
        ],
        i * 3,
      );
    }
    const stars = new THREE.Points(
      new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.BufferAttribute(starPositions, 3),
      ),
      new THREE.PointsMaterial({
        map: glow,
        color: 0x9bdcff,
        size: 0.2,
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    scene.add(stars);
    const lines = RUNTIME_EDGES.map((edge, index) => {
      const trace = createEnergyConduit(
        edge.type === "feedback" ? 0xb89aff
          : edge.type === "call" ? 0xf0c578
          : edge.type === "reference" ? 0x88a7bf : 0x55dfff,
      );
      scene.add(trace.mesh);
      const packet = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xc8fff5, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      packet.scale.setScalar(0.65);
      scene.add(packet);
      return {
        edge, trace, packet, phase: index,
        curve: new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(),
        ),
        energy: 0,
      };
    });
    const resize = () => {
      const rect = mount.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height);
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
      const nextMobileLayout = rect.width <= 600;
      controls.maxDistance = nextMobileLayout ? 68 : 54;
      if (mobileLayout !== nextMobileLayout) {
        mobileLayout = nextMobileLayout;
        RUNTIME_NODES.forEach((node) =>
          objectMap.get(node.id)!.group.position.set(...nodePosition(node)),
        );
      }
      const mobileFit = Math.max(1, 0.78 / camera.aspect);
      if (mobileLayout) camera.position.set(0, 35 * mobileFit, 0.1);
      else if (live.current.view === "top") {
        camera.position.set(0, 50, 1.1);
        controls.target.set(0, 1.2, 1);
      }
      else camera.position.set(16, 18, 23);
      controls.update();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();
    const ray = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const projected = new THREE.Vector3();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let down = { x: 0, y: 0 };
    let alive = true;
    let elapsed = 1.4;
    let eventAge = 0;
    let eventId: string | undefined;
    const arrivals = new Map<MockNodeId, number>();
    const arrivalCycles = new Map<string, number>();
    const nodeEnergy = new Map<MockNodeId, number>();
    RUNTIME_NODES.forEach((node) => nodeEnergy.set(node.id, 0));
    let frames = 0;
    let last = performance.now();
    let fpsAt = last;
    let cameraDestination: THREE.Vector3 | undefined;
    const pointerDown = (event: PointerEvent) => {
      cameraDestination = undefined;
      down = { x: event.clientX, y: event.clientY };
    };
    const pointerUp = (event: PointerEvent) => {
      if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5)
        return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects(
        Array.from(objectMap.values()).map((item) => item.hit),
      )[0];
      if (hit?.object.userData.nodeId) setSelected(hit.object.userData.nodeId);
    };
    const pointerMove = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects(
        Array.from(objectMap.values()).map((item) => item.hit),
      )[0];
      const nodeId = hit?.object.userData.nodeId as MockNodeId | undefined;
      setHovered((current) => current === nodeId ? current : nodeId ?? null);
      renderer.domElement.style.cursor = nodeId ? "pointer" : "grab";
    };
    const pointerLeave = () => {
      setHovered(null);
      renderer.domElement.style.cursor = "grab";
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    renderer.domElement.addEventListener("pointermove", pointerMove);
    renderer.domElement.addEventListener("pointerleave", pointerLeave);
    let lastView = view;
    const frame = (now: number) => {
      if (!alive) return;
      requestAnimationFrame(frame);
      const state = live.current;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const moving = !state.paused && !reducedMotion.matches;
      const eventKey = state.currentEvent ? `${state.currentEvent.id}:${state.currentEvent.status}` : undefined;
      if (eventId !== eventKey) {
        eventId = eventKey;
        eventAge = state.paused && state.currentEvent ? 0.45 : 0;
        arrivalCycles.clear();
      }
      if (moving) { elapsed += dt; eventAge += dt; }
      controls.autoRotate =
        state.autoRotate && !state.paused && !reducedMotion.matches;
      if (lastView !== state.view) {
        lastView = state.view;
        cameraDestination = new THREE.Vector3(
          0,
          state.view === "top" ? 50 : 20,
          state.view === "top" ? 1.1 : 25,
        );
        controls.target.set(0, 1.2, state.view === "top" ? 1 : 0);
        controls.update();
      }
      if (cameraDestination) {
        camera.position.lerp(cameraDestination, 1 - Math.exp(-dt * 4));
        if (camera.position.distanceTo(cameraDestination) < 0.02) cameraDestination = undefined;
      }
      controls.update();
      const focusedNode = state.hovered ?? state.selected;
      const focusedPeers = new Set<MockNodeId>();
      if (focusedNode) {
        focusedPeers.add(focusedNode);
        RUNTIME_EDGES.forEach((edge) => {
          if (edge.from === focusedNode) focusedPeers.add(edge.to);
          if (edge.to === focusedNode) focusedPeers.add(edge.from);
        });
      }
      for (const node of RUNTIME_NODES) {
        const visual = objectMap.get(node.id)!;
        const inFocus = !focusedNode || focusedPeers.has(node.id);
        const focusOpacity = inFocus ? 1 : 0.18;
        const eventStatus: NodeVisualState = state.currentEvent?.node === node.id
          ? state.currentEvent.status === "waiting" ? "waiting"
            : state.currentEvent.status === "failed" ? "failed"
              : state.currentEvent.status === "completed" || state.currentEvent.status === "allowed" ? "completed" : "active"
          : state.currentEvent?.relatedNodes.includes(node.id) ? "active" : "idle";
        const active =
          state.selected === node.id ||
          state.currentEvent?.node === node.id ||
          state.currentEvent?.relatedNodes.includes(node.id);
        const intensity = nodeEnergy.get(node.id) || 0;
        const targetIntensity = active ? 1 : 0;
        const nextIntensity = THREE.MathUtils.lerp(
          intensity,
          targetIntensity,
          1 - Math.exp(-dt * 7),
        );
        nodeEnergy.set(node.id, nextIntensity);
        visual.group.position.lerp(
          new THREE.Vector3(...nodePosition(node)),
          state.paused ? 1 : 1 - Math.exp(-dt * 5),
        );
        visual.icon.position.y =
          1.2 + Math.sin(elapsed * 1.2 + node.position[0]) * 0.08;
        (visual.icon.material as THREE.SpriteMaterial).opacity =
          (0.78 + nextIntensity * 0.22) * focusOpacity;
        (visual.ring.material as THREE.MeshBasicMaterial).opacity =
          (0.4 + nextIntensity * 0.56) * focusOpacity;
        visual.ring.scale.setScalar(
          1 + nextIntensity * (0.12 + Math.sin(elapsed * 2) * 0.035),
        );
        const statusColor = eventStatus === "failed" ? "#ff7890"
          : eventStatus === "waiting" ? "#f2cf8d"
            : eventStatus === "completed" ? "#a6f2c6"
              : eventStatus === "active" ? node.color : "#496278";
        const statusMaterial = visual.statusDot.material as THREE.MeshBasicMaterial;
        statusMaterial.color.set(statusColor);
        statusMaterial.opacity = (eventStatus === "idle" ? 0.5 : 0.95) * focusOpacity;
        visual.statusDot.scale.setScalar(eventStatus === "waiting" ? 1 + Math.sin(elapsed * 4) * 0.15 : 1);
        const accentTarget = (eventStatus === "failed" ? 0.85
          : eventStatus === "waiting" ? 0.75
            : eventStatus === "active" ? 0.88
              : eventStatus === "completed" ? 0.62 : 0.3) * focusOpacity;
        visual.accent.scale.setScalar(1 + nextIntensity * 0.035 + (eventStatus === "waiting" ? Math.sin(elapsed * 3.2) * 0.025 : 0));
        visual.accent.traverse((child) => {
          const material = (child as THREE.Mesh | THREE.Line).material;
          if (!material) return;
          if (Array.isArray(material)) material.forEach((entry) => { entry.opacity = THREE.MathUtils.lerp(entry.opacity, accentTarget, 1 - Math.exp(-dt * 7)); });
          else material.opacity = THREE.MathUtils.lerp(material.opacity, accentTarget, 1 - Math.exp(-dt * 7));
        });
        const arrivalAt = arrivals.get(node.id);
        const arrivalAge = arrivalAt === undefined ? 2 : elapsed - arrivalAt;
        visual.arrival.scale.setScalar(1 + Math.min(1, arrivalAge / 0.8) * 0.8);
        visual.arrival.material.opacity = Math.max(0, 1 - arrivalAge / 0.8) * 0.65;
      }
      const flow = runtimeFlow(state.currentEvent);
      const nextEvent = state.currentEvent && session.events[session.events.indexOf(state.currentEvent) + 1];
      const duration = state.liveMode && !state.replaying ? 1.5
        : Math.min(1500, Math.max(420, ((nextEvent?.offsetMs ?? 0) - (state.currentEvent?.offsetMs ?? 0)) * 0.82) / state.playbackSpeed) / 1000;
      const pulseStep = elapsed / 1.85;
      let activePackets = 0;
      for (const item of lines) {
        const from = objectMap.get(item.edge.from)!.group.position;
        const to = objectMap.get(item.edge.to)!.group.position;
        item.curve.v0.copy(from).add(new THREE.Vector3(0, 0.8, 0));
        item.curve.v1
          .copy(from)
          .lerp(to, 0.5)
          .add(new THREE.Vector3(0, item.edge.type === "feedback" ? 3.4 : 0.8, 0));
        item.curve.v2.copy(to).add(new THREE.Vector3(0, 0.8, 0));
        const hot = flow?.from === item.edge.from && flow?.to === item.edge.to;
        const focused = !focusedNode || item.edge.from === focusedNode || item.edge.to === focusedNode;
        item.energy = THREE.MathUtils.lerp(
          item.energy,
          hot ? 1 : 0,
          1 - Math.exp(-dt * 6),
        );
        const group = item.phase < 4 ? [0, 4] : item.phase < 8 ? [4, 4] : [8, lines.length - 8];
        const idleAge = pulseStep + group[0] * 0.23;
        const active = flow
          ? hot
          : !state.liveMode && !state.currentEvent && group[0] + Math.floor(idleAge) % group[1] === item.phase;
        const rawProgress = state.currentEvent ? (eventAge / duration) % 1 : idleAge % 1;
        const eased = Math.min(1, rawProgress / 0.86);
        const pulseProgress = eased * eased * eased * (eased * (eased * 6 - 15) + 10);
        if (active && moving && rawProgress < 1) activePackets++;
        const trimStart = Math.min(0.28, (item.edge.from === "model" ? 2.7 : 1.6) / item.curve.getLength());
        const trimEnd = 1 - Math.min(0.28, (item.edge.to === "model" ? 2.7 : 1.6) / item.curve.getLength());
        item.curve.getPoint(trimStart + pulseProgress * (trimEnd - trimStart), item.packet.position);
        (item.packet.material as THREE.SpriteMaterial).opacity = active && !reducedMotion.matches ? Math.min(1, rawProgress * 5) * Math.min(1, (1 - rawProgress) * 6) * (focused ? 1 : 0.08) : 0;
        const edgeId = `${item.edge.from}:${item.edge.to}`;
        const pulseCycle = Math.floor(eventAge / duration);
        if (active && moving && rawProgress > 0.82 && rawProgress < 0.9 && arrivalCycles.get(edgeId) !== pulseCycle) {
          arrivals.set(item.edge.to, elapsed);
          arrivalCycles.set(edgeId, pulseCycle);
        }
        item.trace.update(
          item.curve, camera, pulseProgress, active && !reducedMotion.matches, item.energy,
          item.edge.from === "model" ? 2.7 : 1.6,
          item.edge.to === "model" ? 2.7 : 1.6,
          mount.clientWidth, mount.clientHeight,
        );
        (item.trace.mesh.material as THREE.ShaderMaterial).uniforms.opacity.value = focused ? 1 : 0.12;
      }
      coreOrbits.forEach((orbit, index) => {
        const motionDt = state.paused || reducedMotion.matches ? 0 : dt;
        orbit.rotation.y += motionDt * (index % 2 ? -0.19 : 0.13);
        orbit.rotation.z += motionDt * (index % 2 ? 0.11 : -0.08);
        (orbit.material as THREE.MeshBasicMaterial).opacity =
          0.48 + Math.sin(elapsed * 1.15 + index) * 0.12;
      });
      stars.rotation.y = elapsed * 0.008;
      renderer.render(scene, camera);
      RUNTIME_NODES.forEach((node) => {
        const label = labelRefs.current.get(node.id);
        if (!label) return;
        projected
          .copy(objectMap.get(node.id)!.group.position)
          .add(new THREE.Vector3(0, 2.6, 0))
          .project(camera);
        const screenX = (projected.x * 0.5 + 0.5) * mount.clientWidth;
        const edgePadding = window.innerWidth <= 600 ? 58 : 88;
        label.style.left = `${THREE.MathUtils.clamp(screenX, edgePadding, mount.clientWidth - edgePadding)}px`;
        label.style.top = `${(-projected.y * 0.5 + 0.5) * mount.clientHeight}px`;
        label.style.opacity = projected.z > 1
          ? "0"
          : focusedNode && !focusedPeers.has(node.id) ? "0.28" : "1";
      });
      frames++;
      if (now - fpsAt > 1000) {
        setStats({
          fps: frames,
          pulses: activePackets,
        });
        frames = 0;
        fpsAt = now;
      }
    };
    requestAnimationFrame(frame);
    return () => {
      alive = false;
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      renderer.domElement.removeEventListener("pointermove", pointerMove);
      renderer.domElement.removeEventListener("pointerleave", pointerLeave);
      controls.dispose();
      scene.traverse((item) => {
        const mesh = item as THREE.Mesh;
        mesh.geometry?.dispose();
        const material = mesh.material;
        (Array.isArray(material) ? material : [material]).forEach((value) =>
          value?.dispose(),
        );
      });
      textures.forEach((texture) => texture.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <main className="codex-3d-page">
      <header className="codex-3d-header">
        <a href="/codex" className="codex-3d-back">
          <ArrowLeft size={15} />
          返回 2D Runtime
        </a>
        <div>
            <span className="codex-3d-kicker">
            <Sparkles size={13} /> CODEX RUNTIME / 3D TOPOLOGY · {liveMode ? "LIVE" : "DEMO"}
          </span>
          <h1>
            Runtime <span>Observatory</span>
          </h1>
          <p>
            空间运行全景 · 消息进入、工具调用与结果回流
          </p>
        </div>
        <div className="codex-3d-actions">
          <button className={lineageOpen ? "is-selected" : ""} aria-expanded={lineageOpen} onClick={() => setLineageOpen(value => !value)}>
            <Network size={14} />会话血缘
          </button>
          <button
            onClick={() => {
              setProgress(0);
              setTraceReady(true);
              setReplaying(true);
              setPaused(false);
            }}
          >
            <Play size={14} />
            回放链路
          </button>
          <button onClick={() => setView(view === "orbit" ? "top" : "orbit")}>
            <Crosshair size={14} />
            {view === "orbit" ? "俯视布局" : "空间布局"}
          </button>
          <button onClick={() => setAutoRotate(!autoRotate)}>
            {autoRotate ? <Pause size={14} /> : <Play size={14} />}自动旋转
          </button>
          <button aria-label={paused ? "继续回放与光流" : "暂停回放与光流"} onClick={() => setPaused(!paused)}>
            {paused ? <Play size={14} /> : <Pause size={14} />}{paused ? "继续光流" : "暂停光流"}
          </button>
        </div>
      </header>
      <section className="codex-3d-stage">
        <div className="codex-3d-canvas" ref={host} />
        <div className="codex-3d-labels">
          {RUNTIME_NODES.map((node) => (
            <button
              ref={(element) => {
                if (element) labelRefs.current.set(node.id, element);
                else labelRefs.current.delete(node.id);
              }}
              key={node.id}
              className={[
                selected === node.id || currentEvent?.node === node.id ? "is-active" : "",
                hovered && hovered !== node.id && !RUNTIME_EDGES.some(edge =>
                  (edge.from === hovered && edge.to === node.id) ||
                  (edge.to === hovered && edge.from === node.id)) ? "is-dimmed" : "",
              ].filter(Boolean).join(" ")}
              onClick={() => setSelected(node.id)}
              onMouseEnter={() => setHovered(node.id)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(node.id)}
              onBlur={() => setHovered(null)}
              style={{ "--node-color": node.color } as React.CSSProperties}
            >
              <strong><i className="codex-3d-label-status" />{node.title}</strong>
              <small>{nodeRole(node)}</small>
              <span>{nodeNote(node)}</span>
            </button>
          ))}
        </div>
        <div className="codex-3d-hud">
          <span>
            <i /> {liveMode ? "CODEX EVENT STREAM · LIVE" : "MOCK EVENT STREAM"}
          </span>
          <span>
            {session.events.length} EVENTS · {session.calls.length} CALLS
          </span>
          {replaying && (
            <span>
              {progress + 1} / {session.events.length} · {currentEvent?.title}
            </span>
          )}
          <span>
            {stats.fps} FPS · {stats.pulses} PULSE
          </span>
        </div>
        <div className="codex-3d-legend">
          <span>
            <i className="legend-message" />
            消息 / 上下文
          </span>
          <span>
            <i className="legend-call" />
            工具 / 门禁
          </span>
          <span>
            <i className="legend-feedback" />
            结果回流
          </span>
        </div>
        <div className="codex-3d-signal-dock">
          <div className="codex-3d-playback">
            <button aria-label={replaying && !paused ? "暂停事件回放" : "继续事件回放"} onClick={() => {
              if (replaying && !paused) {
                setPaused(true);
                return;
              }
              if (!traceReady || progress >= session.events.length - 1) {
                setProgress(0);
                setTraceReady(true);
              }
              setPaused(false);
              setReplaying(true);
            }}>{replaying && !paused ? <Pause size={14} /> : <Play size={14} />}</button>
            <input aria-label="事件回放进度" type="range" min={0} max={session.events.length - 1} value={progress}
              style={{ "--playback-progress": `${session.events.length > 1 ? progress / (session.events.length - 1) * 100 : 0}%` } as React.CSSProperties}
              onChange={event => {
                setProgress(Number(event.currentTarget.value));
                setTraceReady(true);
                setReplaying(true);
                setPaused(true);
              }} />
            <span>{traceReady ? `${progress + 1} / ${session.events.length}` : "事件回放"}</span>
            <select aria-label="事件回放速度" value={playbackSpeed} onChange={event => setPlaybackSpeed(Number(event.currentTarget.value))}>
              <option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option>
            </select>
          </div>
          <span><i />{replaying ? paused ? "回放已暂停" : "会话回放" : "拓扑预览"}<small>{liveMode ? `${session.id} / ${session.turnId}` : "MOCK SESSION / TURN 08"}</small></span>
          <div><small>{currentEvent?.name ?? "AGENT RUNTIME / DATA FLOW"}</small><strong>{currentEvent?.title ?? "输入 → 上下文 → 模型 ⇄ 工具 → 返回用户"}</strong></div>
          <a href={`/codex${currentEvent ? `?node=${currentEvent.node}` : ""}`}>查看事件详情 <Info size={13} /></a>
        </div>
        {lineageOpen && (
          <aside className="codex-3d-lineage" aria-label="会话知识图谱">
            <header>
              <div><span><Network size={14} /> SESSION LINEAGE</span><strong>会话知识图谱</strong></div>
              <button aria-label="关闭会话血缘" onClick={() => setLineageOpen(false)}><X size={15} /></button>
            </header>
            <div className="codex-3d-lineage-session"><span>{liveMode ? "本机运行记录" : "演示会话"}</span><strong>{session.id}</strong><small>{session.turnId} · {session.model}</small></div>
            <div className="codex-3d-lineage-links" aria-hidden="true"><i /><i /><i /><i /></div>
            <div className="codex-3d-lineage-metrics">
              <button onClick={() => setSelected("model")}><span>本轮 Token</span><strong>{totalTokens === null ? "未采集" : totalTokens.toLocaleString()}</strong><small>输入 {session.usage.inputTokens?.toLocaleString() ?? "未采集"} · 输出 {session.usage.outputTokens?.toLocaleString() ?? "未采集"}</small></button>
              <button onClick={() => setSelected("tool")}><span>本地工具</span><strong>{observedTools.length} 种 · {session.calls.filter(call => call.type === "local").length} 次</strong><small>{observedTools.map(item => item.name).join(" · ") || "未观测到本地工具调用"}</small></button>
              <button onClick={() => setSelected("mcp")}><span>MCP 服务</span><strong>{observedMcp.length} 种 · {session.calls.filter(call => call.type === "mcp").length} 次</strong><small>{observedMcp.map(item => `${item.name}: ${[...item.tools].map(([tool, count]) => `${tool} ×${count}`).join(", ")}`).join(" · ") || "未观测到 MCP 调用"}</small></button>
              <button onClick={() => setSelected("skill")}><span>Skill</span><strong>{observedSkills.length} 项已观测</strong><small>{observedSkills.join(" · ") || "未观测到 Skill 加载事件"}</small></button>
            </div>
            <footer><span>关联模型请求</span><b>{liveSession?.rolloutTelemetry?.modelRequestCount ?? (session.rounds.length || "未采集")}</b><span>调用状态</span><b>{session.calls.filter(call => call.status === "failed").length ? `${session.calls.filter(call => call.status === "failed").length} 次失败` : "无失败记录"}</b></footer>
          </aside>
        )}
      </section>
      {selectedNode && (
        <aside className="codex-3d-inspector">
          <button aria-label="关闭节点详情" className="codex-3d-close" onClick={() => setSelected(null)}>
            <X size={17} />
          </button>
          <span
            className="codex-3d-inspector-code"
            style={{ color: selectedNode.color }}
          >
            {selectedNode.code}
          </span>
          <h2>{selectedNode.title}</h2>
          <p>{nodeSummary(selectedNode)}</p>
          <strong>{nodeNote(selectedNode)}</strong>
          <div className="codex-3d-inspector-data">
            <span>
              关联事件{" "}
              <b>
                {
                  session.events.filter(
                    (event) =>
                      event.node === selectedNode.id ||
                      event.relatedNodes.includes(selectedNode.id),
                  ).length
                }
              </b>
            </span>
            <span>
              关联调用{" "}
              <b>
                {new Set(session.events.filter(event => event.callId && (event.node === selectedNode.id || event.relatedNodes.includes(selectedNode.id))).map(event => event.callId)).size}
              </b>
            </span>
          </div>
          <div className="codex-3d-inspector-events">
            <span className="codex-3d-inspector-section">最近关联事件</span>
            {selectedEvents.length ? selectedEvents.map((event) => (
              <div className="codex-3d-event-row" key={event.id}>
                <i className={`event-status-${event.status}`} />
                <div>
                  <strong>{event.title}</strong>
                  <small>{event.time} · {({ completed: "完成", running: "执行中", waiting: "等待", failed: "失败", allowed: "已允许", unknown: "状态未采集" })[event.status]} · {event.source}</small>
                  <p>{event.summary}</p>
                </div>
              </div>
            )) : <p className="codex-3d-events-empty">当前会话没有该节点的事件记录</p>}
          </div>
          <a href={`/codex?node=${selectedNode.id}`}>
            进入 2D 详情 <Info size={13} />
          </a>
        </aside>
      )}
      <footer className="codex-3d-footer">
        <span>
          <RotateCcw size={12} /> 拖拽旋转 · 滚轮缩放 · 点击节点查看详情
        </span>
        <span>
          SESSION {session.id} / {session.turnId}
        </span>
      </footer>
    </main>
  );
}
