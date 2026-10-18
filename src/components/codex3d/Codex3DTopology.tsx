import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  ArrowLeft,
  Crosshair,
  Info,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { createCodexRuntimeMock, type MockNodeId } from "../codexRuntimeMock";
import { RUNTIME_EDGES, RUNTIME_NODES, type RuntimeNode } from "./model";
import { glowTexture } from "../topology/visualAssets";
import { createHeartbeatTrace } from "./heartbeatTrace";
import "../codex3d/Codex3DTopology.css";

const nodeById = new Map(RUNTIME_NODES.map((node) => [node.id, node]));

function glyphTexture(node: RuntimeNode) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d")!;
  context.translate(32, 32);
  context.scale(8, 8);
  for (const [blur, opacity] of [
    [18, 0.35],
    [7, 0.8],
    [1, 1],
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

export function Codex3DTopology() {
  const host = useRef<HTMLDivElement>(null);
  const labelRefs = useRef(new Map<MockNodeId, HTMLButtonElement>());
  const [selected, setSelected] = useState<MockNodeId | null>(null);
  const [paused, setPaused] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [view, setView] = useState<"orbit" | "top">("orbit");
  const [replaying, setReplaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({
    fps: 60,
    pulses: 1,
  });
  const session = useMemo(() => createCodexRuntimeMock(), []);
  const selectedNode = selected ? nodeById.get(selected) : undefined;
  const currentEvent = replaying ? session.events[progress] : undefined;
  const live = useRef({ selected, paused, autoRotate, view, currentEvent });
  live.current = { selected, paused, autoRotate, view, currentEvent };

  useEffect(() => {
    if (!replaying) return;
    if (progress >= session.events.length - 1) {
      setReplaying(false);
      return;
    }
    const gap =
      session.events[progress + 1].offsetMs - session.events[progress].offsetMs;
    const timer = window.setTimeout(
      () => setProgress((value) => value + 1),
      Math.min(620, Math.max(150, gap * 0.82)),
    );
    return () => window.clearTimeout(timer);
  }, [progress, replaying, session]);

  useEffect(() => {
    const mount = host.current;
    if (!mount) return;
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x050914, 28, 64);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    mount.appendChild(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(16, 18, 23);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 10;
    controls.maxDistance = 44;
    controls.target.set(0, -1.1, 0);
    const mobilePositions: Record<MockNodeId, [number, number, number]> = {
      input: [-5, 0, 7],
      context: [-5, 0, 0],
      prompt: [-5, 0, -7],
      skill: [0, 0, -9],
      model: [0, 0, 0],
      hook: [5, 0, -7],
      gate: [5, 0, 0],
      tool: [5, 0, 7],
      mcp: [0, 0, 13],
      search: [-5, 0, 13],
      output: [0, 0, 7],
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
      icon.scale.setScalar(node.id === "model" ? 5 : 3.6);
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
      if (node.id === "model") {
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
      objectMap.set(node.id, { group, icon, ring, hit });
      scene.add(group);
    }
    const grid = new THREE.GridHelper(42, 42, 0x1d5a78, 0x102a43);
    grid.position.y = -1;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.3;
    scene.add(grid);
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
      const trace = createHeartbeatTrace(
        edge.type === "feedback" ? 0xb89aff
          : edge.type === "call" ? 0xf0c578
          : edge.type === "reference" ? 0x88a7bf : 0x55dfff,
      );
      scene.add(trace.mesh);
      return {
        edge, trace, phase: index,
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
      if (mobileLayout !== nextMobileLayout) {
        mobileLayout = nextMobileLayout;
        RUNTIME_NODES.forEach((node) =>
          objectMap.get(node.id)!.group.position.set(...nodePosition(node)),
        );
      }
      const mobileFit = Math.max(1, 0.78 / camera.aspect);
      if (mobileLayout) camera.position.set(0, 35 * mobileFit, 0.1);
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
    const nodeEnergy = new Map<MockNodeId, number>();
    RUNTIME_NODES.forEach((node) => nodeEnergy.set(node.id, 0));
    let frames = 0;
    let last = performance.now();
    let fpsAt = last;
    const pointerDown = (event: PointerEvent) => {
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
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    let lastView = view;
    const frame = (now: number) => {
      if (!alive) return;
      requestAnimationFrame(frame);
      const state = live.current;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!state.paused && !reducedMotion.matches) elapsed += dt;
      controls.autoRotate =
        state.autoRotate && !state.paused && !reducedMotion.matches;
      if (lastView !== state.view) {
        lastView = state.view;
        camera.position.set(
          0,
          state.view === "top" ? 35 : 20,
          state.view === "top" ? 0.1 : 25,
        );
        controls.target.set(0, 0.4, 0);
        controls.update();
      }
      controls.update();
      for (const node of RUNTIME_NODES) {
        const visual = objectMap.get(node.id)!;
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
          0.78 + nextIntensity * 0.22;
        (visual.ring.material as THREE.MeshBasicMaterial).opacity =
          0.4 + nextIntensity * 0.56;
        visual.ring.scale.setScalar(
          1 + nextIntensity * (0.12 + Math.sin(elapsed * 2) * 0.035),
        );
      }
      for (const item of lines) {
        const from = objectMap.get(item.edge.from)!.group.position;
        const to = objectMap.get(item.edge.to)!.group.position;
        item.curve.v0.copy(from).add(new THREE.Vector3(0, 0.8, 0));
        item.curve.v1
          .copy(from)
          .lerp(to, 0.5);
        item.curve.v2.copy(to).add(new THREE.Vector3(0, 0.8, 0));
        const participants = [
          state.currentEvent?.node,
          ...(state.currentEvent?.relatedNodes || []),
        ];
        const hot =
          participants.includes(item.edge.from) &&
          participants.includes(item.edge.to);
        item.energy = THREE.MathUtils.lerp(
          item.energy,
          hot ? 1 : 0,
          1 - Math.exp(-dt * 6),
        );
        const pulseStep = (elapsed * 0.55) % lines.length;
        const active = state.currentEvent
          ? hot
          : Math.floor(pulseStep) === item.phase;
        const pulseProgress = state.currentEvent
          ? (elapsed * 0.55) % 1
          : pulseStep - item.phase;
        item.trace.update(
          item.curve, camera, pulseProgress, active, item.energy,
          item.edge.from === "model" ? 2.7 : 1.6,
          item.edge.to === "model" ? 2.7 : 1.6,
          mount.clientWidth, mount.clientHeight,
        );
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
        label.style.opacity = projected.z > 1 ? "0" : "1";
      });
      frames++;
      if (now - fpsAt > 1000) {
        setStats({
          fps: frames,
          pulses:
            live.current.paused || reducedMotion.matches
              ? 0
            : 1,
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
            <Sparkles size={13} /> CODEX RUNTIME / 3D TOPOLOGY
          </span>
          <h1>
            Agent Runtime <span>Orbit</span>
          </h1>
          <p>
            用一条可旋转的空间链路，查看同一 session
            的上下文、模型、工具与结果。
          </p>
        </div>
        <div className="codex-3d-actions">
          <button
            onClick={() => {
              setProgress(0);
              setReplaying(true);
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
          <button onClick={() => setPaused(!paused)}>
            {paused ? <Play size={14} /> : <Pause size={14} />}链路脉冲
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
              onClick={() => setSelected(node.id)}
              style={{ "--node-color": node.color } as React.CSSProperties}
            >
              <strong>{node.title}</strong>
              <span>{node.note}</span>
            </button>
          ))}
        </div>
        <div className="codex-3d-hud">
          <span>
            <i /> LIVE MOCK TRACE
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
      </section>
      {selectedNode && (
        <aside className="codex-3d-inspector">
          <button className="codex-3d-close" onClick={() => setSelected(null)}>
            <X size={17} />
          </button>
          <span
            className="codex-3d-inspector-code"
            style={{ color: selectedNode.color }}
          >
            {selectedNode.code}
          </span>
          <h2>{selectedNode.title}</h2>
          <p>{selectedNode.summary}</p>
          <strong>{selectedNode.note}</strong>
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
                {session.calls.filter(
                  (call) =>
                    call.type ===
                    (selectedNode.id === "tool" ? "local" : "mcp"),
                ).length || "—"}
              </b>
            </span>
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
