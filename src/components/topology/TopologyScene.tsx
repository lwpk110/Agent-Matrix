import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import type { BlackBoxStage } from '../../types/matrix';
import type { Language } from '../../i18n/translations';
import { EDGES, NODES, matchesNode, nodeState, relatedNodes, type Layout, type NodeId } from './model';
import { glowTexture, iconTexture, orbitalTexture } from './visualAssets';

export interface SceneHandle { reset(): void; focus(id: NodeId): void; zoom(factor: number): void; pulse(): void }
interface Props {
  language: Language; layout: Layout; selected: NodeId; activeStage?: BlackBoxStage;
  blocked: boolean; query: string; focus: boolean; labels: boolean; paused: boolean; autoRotate: boolean;
  onSelect(id: NodeId): void;
  onStats(stats: { fps: number; quality: string }): void;
}
interface NodeVisual { group: THREE.Group; icon: THREE.Sprite; aura: THREE.Sprite; orbit: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>; ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>; pick: THREE.Mesh }

export const TopologyScene = forwardRef<SceneHandle, Props>((props, forwardedRef) => {
  const mount = useRef<HTMLDivElement>(null);
  const labelRefs = useRef(new Map<NodeId, HTMLButtonElement>());
  const latest = useRef(props); latest.current = props;
  const actions = useRef<SceneHandle>({ reset() {}, focus() {}, zoom() {}, pulse() {} });
  const [failure, setFailure] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useImperativeHandle(forwardedRef, () => ({ reset: () => actions.current.reset(), focus: id => actions.current.focus(id), zoom: factor => actions.current.zoom(factor), pulse: () => actions.current.pulse() }), []);

  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); }
    catch { setFailure(true); latest.current.onStats({ fps: 0, quality: 'offline' }); return; }
    setFailure(false);
    renderer.setClearColor(0x050a13, 1);
    let pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
    renderer.setPixelRatio(pixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    host.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', '3D architecture canvas');
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x050a13, 24, 65);
    const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 100);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.09;
    controls.minDistance = 5; controls.maxDistance = 48;
    controls.minPolarAngle = 0.15; controls.maxPolarAngle = Math.PI / 2.05;
    controls.autoRotateSpeed = 0.35;
    controls.target.set(0, 0, 0);
    camera.position.set(16, 21, 26);
    controls.update();
    const glow = glowTexture();
    const orbital = orbitalTexture();
    const textures = new Set<THREE.Texture>([glow, orbital]);
    const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false };
    const grid = new THREE.GridHelper(100, 100, 0x163b55, 0x102338);
    grid.position.y = -0.85;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.3;
    scene.add(grid);

    // Fine orbital tracks and a distant star field add depth without solid model primitives.
    const zones: THREE.LineLoop[] = [];
    for (const radius of [12, 20]) {
      const points = Array.from({ length: 180 }, (_, i) => new THREE.Vector3(Math.cos(i / 180 * Math.PI * 2) * radius, -0.82, Math.sin(i / 180 * Math.PI * 2) * radius));
      const orbit = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0x4e91ba, transparent: true, opacity: 0.13 }));
      zones.push(orbit); scene.add(orbit);
    }
    const stars = new Float32Array(130 * 3);
    for (let i = 0; i < 130; i++) {
      const angle = i * 2.39996, radius = 12 + (i % 31) * 0.8;
      stars.set([Math.cos(angle) * radius, 1 + (i % 17) * 0.6, Math.sin(angle) * radius], i * 3);
    }
    const starfield = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(stars, 3)), new THREE.PointsMaterial({ map: glow, color: 0xb8dcff, size: 0.12, opacity: 0.65, ...additive }));
    scene.add(starfield);
    const atmosphere = new THREE.Mesh(new THREE.PlaneGeometry(38, 38), new THREE.MeshBasicMaterial({ map: glow, color: 0x187aaf, opacity: 0.16, ...additive }));
    atmosphere.rotation.x = -Math.PI / 2; atmosphere.position.y = -0.83; scene.add(atmosphere);

    const nodeVisuals = new Map<NodeId, NodeVisual>();
    const pickables: THREE.Mesh[] = [];
    const pickGeometry = new THREE.SphereGeometry(1.35, 8, 8);
    const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });
    const ringGeometry = new THREE.RingGeometry(1.23, 1.25, 96);
    const orbitGeometry = new THREE.PlaneGeometry(3.9, 3.9);
    const arrowGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.13, -0.16, 0), new THREE.Vector3(0, 0.14, 0), new THREE.Vector3(0.13, -0.16, 0)]);
    NODES.forEach(n => {
      const group = new THREE.Group(); group.position.set(...n.positions[latest.current.layout]);
      const texture = iconTexture(n.id); textures.add(texture);
      const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, color: 0xffffff, ...additive }));
      icon.scale.setScalar(n.id === 'core' ? 4.2 : 3.05); icon.position.y = n.id === 'core' ? 1.28 : 1.05; icon.renderOrder = 3; group.add(icon);
      const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: n.color, opacity: 0.18, ...additive }));
      aura.scale.setScalar(n.id === 'core' ? 6.8 : 4.35); aura.position.y = n.id === 'core' ? 1.05 : 0.85; group.add(aura);
      const orbit = new THREE.Mesh(orbitGeometry, new THREE.MeshBasicMaterial({ map: orbital, color: n.color, opacity: 0.65, side: THREE.DoubleSide, ...additive }));
      orbit.rotation.x = -Math.PI / 2; orbit.position.y = -0.42; group.add(orbit);
      const ring = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({ color: n.color, opacity: 0.7, side: THREE.DoubleSide, ...additive }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = -0.4; group.add(ring);
      // The narrow vertical light tether locates the floating glyph on its orbital footprint.
      const tether = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -0.4, 0), new THREE.Vector3(0, 0.6, 0)]), new THREE.LineBasicMaterial({ color: n.color, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending }));
      group.add(tether);
      const pick = new THREE.Mesh(pickGeometry, pickMaterial); pick.position.y = 1.1; pick.userData.nodeId = n.id; group.add(pick); pickables.push(pick);
      nodeVisuals.set(n.id, { group, icon, aura, orbit, ring, pick }); scene.add(group);
    });

    const edgeVisuals = EDGES.map(edge => {
      const color = edge.id === 'loopback' ? '#c1a7ff' : edge.from === 'gate' || edge.to === 'gate' ? '#f6cd90' : '#89dfff';
      const line = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(65 * 3), 3)), new THREE.LineDashedMaterial({ color, ...additive, opacity: 0.55, dashSize: 1000, gapSize: 0 }));
      const arrow = new THREE.Line(arrowGeometry, new THREE.LineBasicMaterial({ color: 0xe4f7ff, ...additive, opacity: 0.8 }));
      const packets = [0, 1, 2].map(() => { const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffffff, ...additive })); sprite.scale.setScalar(0.65); scene.add(sprite); return sprite; });
      scene.add(line, arrow);
      return { edge, line, arrow, packets, color, curve: new THREE.CubicBezierCurve3(), length: 1 };
    });

    let width = 1, height = 1, alive = true, inView = true, contextHealthy = true, raf = 0;
    let lastDraw = 0, lastFrame = performance.now(), statsTime = lastFrame, frames = 0, elapsed = 0, pulseUntil = 0;
    let dirty = true, lastSignature = '', previousLayout = latest.current.layout, lowSamples = 0;
    let cameraDestination: { position: THREE.Vector3; target: THREE.Vector3 } | null = null;
    const temp = new THREE.Vector3();
    const direction = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const projection = new THREE.Vector3();
    const fit = () => {
      const aspect = Math.max(width / height, 0.3);
      const distance = Math.max(21, 12 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.min(aspect, 1.6));
      cameraDestination = { position: new THREE.Vector3(0.25, 0.64, 0.73).normalize().multiplyScalar(Math.min(distance, 46)), target: new THREE.Vector3(0, 0.4, 0) };
      dirty = true; schedule();
    };
    actions.current = {
      reset: fit,
      focus: id => { const target = nodeVisuals.get(id)!.group.position.clone(); cameraDestination = { position: camera.position.clone().sub(controls.target).normalize().multiplyScalar(9).add(target), target }; dirty = true; schedule(); },
      zoom: factor => { const distance = THREE.MathUtils.clamp(camera.position.distanceTo(controls.target) * factor, controls.minDistance, controls.maxDistance); cameraDestination = { position: camera.position.clone().sub(controls.target).normalize().multiplyScalar(distance).add(controls.target), target: controls.target.clone() }; dirty = true; schedule(); },
      pulse: () => { pulseUntil = elapsed + 2.8; dirty = true; schedule(); },
    };
    const resize = new ResizeObserver(entries => {
      const rect = entries[0].contentRect; width = Math.max(1, rect.width); height = Math.max(1, rect.height);
      renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); fit();
    }); resize.observe(host);

    function updateEdges() {
      edgeVisuals.forEach(v => {
        const from = nodeVisuals.get(v.edge.from)!.group.position;
        const to = nodeVisuals.get(v.edge.to)!.group.position;
        v.curve.v0.copy(from).add(new THREE.Vector3(0, 0.3, 0));
        v.curve.v3.copy(to).add(new THREE.Vector3(0, 0.3, 0));
        const arch = v.edge.id === 'loopback' ? 3.5 : 0.75;
        v.curve.v1.copy(from).lerp(to, 0.28).add(new THREE.Vector3(0, arch, 0));
        v.curve.v2.copy(from).lerp(to, 0.72).add(new THREE.Vector3(0, arch, 0));
        const positions = v.line.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i <= 64; i++) { v.curve.getPoint(i / 64, temp); positions.setXYZ(i, temp.x, temp.y, temp.z); }
        positions.needsUpdate = true; v.line.computeLineDistances(); v.length = v.curve.getLength();
        v.curve.getPoint(0.76, temp); v.arrow.position.copy(temp); v.curve.getTangent(0.76, direction); v.arrow.quaternion.setFromUnitVectors(up, direction.normalize());
      });
    }
    updateEdges();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let down: { x: number; y: number; id: number } | null = null;
    const hitNode = (event: PointerEvent) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(pickables, false).find(hit => matchesNode(NODES.find(n => n.id === hit.object.userData.nodeId)!, latest.current.query))?.object.userData.nodeId as NodeId | undefined;
    };
    const pointerDown = (event: PointerEvent) => { if (event.button === 0) down = { x: event.clientX, y: event.clientY, id: event.pointerId }; cameraDestination = null; };
    const pointerUp = (event: PointerEvent) => { if (down && down.id === event.pointerId && Math.hypot(event.clientX - down.x, event.clientY - down.y) < 5) { const id = hitNode(event); if (id) latest.current.onSelect(id); } down = null; };
    const pointerMove = (event: PointerEvent) => { renderer.domElement.style.cursor = hitNode(event) ? 'pointer' : 'grab'; };
    const cancelPointer = () => { down = null; };
    const cancelCamera = () => { cameraDestination = null; dirty = true; schedule(); };
    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointerup', pointerUp);
    renderer.domElement.addEventListener('pointermove', pointerMove);
    renderer.domElement.addEventListener('pointercancel', cancelPointer);
    renderer.domElement.addEventListener('pointerleave', cancelPointer);
    controls.addEventListener('start', cancelCamera);
    controls.addEventListener('change', () => { dirty = true; schedule(); });

    function placeLabels() {
      const current = latest.current;
      const neighbors = relatedNodes(current.selected);
      const placed: { x: number; y: number; w: number; h: number }[] = [];
      const sorted = [...NODES].sort((a, b) => Number(b.id === current.selected) - Number(a.id === current.selected));
      sorted.forEach(n => {
        const label = labelRefs.current.get(n.id); if (!label) return;
        const visible = current.labels && matchesNode(n, current.query) && (!current.focus || neighbors.has(n.id));
        projection.copy(nodeVisuals.get(n.id)!.group.position).add(new THREE.Vector3(0, -0.3, 0)).project(camera);
        const w = label.offsetWidth || 132, h = label.offsetHeight || 43;
        const rawX = (projection.x * 0.5 + 0.5) * width - w / 2, rawY = (-projection.y * 0.5 + 0.5) * height + 38;
        let x = Math.max(8, Math.min(width - w - 8, rawX)), y = rawY;
        let valid = visible && projection.z > -1 && projection.z < 1 && rawX > -w / 2 && rawX < width - w / 2 && rawY > 65 && rawY < height - 55;
        for (let k = 0; k < 6 && valid; k++) {
          const overlap = placed.some(r => x < r.x + r.w + 6 && x + w + 6 > r.x && y < r.y + r.h + 5 && y + h + 5 > r.y);
          if (!overlap) break;
          y = rawY + (k % 2 ? -1 : 1) * (Math.floor(k / 2) + 1) * (h + 6);
          if (k === 5) valid = false;
        }
        valid = valid && y > 65 && y + h < height - 40;
        label.style.visibility = valid ? 'visible' : 'hidden'; label.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
        if (valid) placed.push({ x, y, w, h });
      });
    }

    function frame(now: number) {
      raf = 0;
      if (!alive || !inView || document.hidden || !contextHealthy) return;
      if (now - lastDraw < 1000 / 60 - 1) { schedule(); return; }
      const dt = Math.min((now - lastFrame) / 1000, 0.05); lastFrame = now; lastDraw = now;
      const p = latest.current;
      if (!p.paused) elapsed += dt;
      const signature = [p.layout, p.selected, p.activeStage, p.blocked, p.query, p.focus, p.labels, p.paused, p.autoRotate, p.language].join('|');
      const changed = signature !== lastSignature; lastSignature = signature;
      if (p.layout !== previousLayout) { previousLayout = p.layout; fit(); }
      let moving = false;
      const neighbors = relatedNodes(p.selected);
      NODES.forEach(n => {
        const visual = nodeVisuals.get(n.id)!;
        temp.set(...n.positions[p.layout]);
        if (visual.group.position.distanceToSquared(temp) > 0.00001) { visual.group.position.lerp(temp, p.paused ? 1 : 1 - Math.exp(-dt * 7)); moving = true; }
        const emphasized = matchesNode(n, p.query) && (!p.focus || neighbors.has(n.id));
        const state = nodeState(n, p.activeStage, p.blocked);
        const color = state === 'blocked' ? '#fb9275' : n.color;
        const selected = n.id === p.selected;
        const breath = 1 + Math.sin(elapsed * 1.5 + n.layer) * 0.06;
        visual.icon.material.color.set(state === 'blocked' ? '#ffd2bd' : '#ffffff');
        visual.icon.material.opacity = emphasized ? 1 : 0.12;
        visual.icon.position.y = (n.id === 'core' ? 1.28 : 1.05) + Math.sin(elapsed * 1.15 + n.layer * 1.7) * 0.065;
        visual.aura.material.color.set(color);
        visual.aura.material.opacity = emphasized ? (selected ? 0.32 : state === 'active' ? 0.2 : 0.12) * breath : 0.015;
        visual.orbit.material.color.set(color);
        visual.orbit.material.opacity = emphasized ? selected ? 0.88 : 0.3 : 0.035;
        visual.orbit.rotation.z = elapsed * (selected ? 0.16 : -0.07) + n.layer;
        visual.ring.material.color.set(color);
        visual.ring.material.opacity = emphasized ? selected ? 0.9 : state === 'active' ? 0.52 : 0.28 : 0.02;
        visual.ring.scale.setScalar(n.id === p.selected ? 1.08 + (!p.paused ? Math.sin(elapsed * 2) * 0.025 : 0) : 1);

      });
      if (moving) updateEdges();
      zones.forEach(zone => { zone.visible = true; });
      edgeVisuals.forEach(v => {
        const held = p.blocked && !!v.edge.downstream;
        const relevant = (!p.focus || v.edge.from === p.selected || v.edge.to === p.selected) && matchesNode(NODES.find(n => n.id === v.edge.from)!, p.query) && matchesNode(NODES.find(n => n.id === v.edge.to)!, p.query);
        const adjacent = v.edge.from === p.selected || v.edge.to === p.selected;
        v.line.material.color.set(held ? '#a87552' : v.color); v.line.material.opacity = relevant ? held ? 0.32 : adjacent ? 0.85 : 0.4 : 0.055;
        v.line.material.dashSize = held ? 0.18 : 1000; v.line.material.gapSize = held ? 0.16 : 0;
        v.arrow.material.opacity = relevant ? held ? 0.2 : 0.8 : 0.05;
        v.packets.forEach((packet, i) => {
          packet.visible = !held && relevant;
          const progress = ((elapsed * (pulseUntil > elapsed ? 4.5 : 1.8)) / v.length + i / 3) % 1;
          v.curve.getPoint(progress, packet.position);
          packet.scale.setScalar(pulseUntil > elapsed ? 1.05 : 0.6);
        });
      });
      if (cameraDestination) {
        const k = p.paused ? 1 : 1 - Math.exp(-dt * 6);
        camera.position.lerp(cameraDestination.position, k); controls.target.lerp(cameraDestination.target, k);
        if (camera.position.distanceToSquared(cameraDestination.position) < 0.002) cameraDestination = null;
        dirty = true;
      }
      controls.autoRotate = p.autoRotate && !p.paused;
      const cameraChanged = controls.update(dt);
      if (dirty || changed || moving || cameraChanged || !p.paused) {
        renderer.render(scene, camera); placeLabels(); frames++; dirty = false;
      }
      if (now - statsTime >= 2200) {
        const fps = Math.round(frames * 1000 / (now - statsTime));
        if (!p.paused && fps < 24) lowSamples++; else lowSamples = 0;
        if (lowSamples >= 2 && pixelRatio > 1) { pixelRatio = 1; renderer.setPixelRatio(1); renderer.setSize(width, height); lowSamples = 0; }
        latest.current.onStats({ fps: p.paused ? 0 : fps, quality: pixelRatio > 1 ? 'high' : 'balanced' }); statsTime = now; frames = 0;
      }
      schedule();
    }
    function schedule() { if (alive && !raf && inView && !document.hidden && contextHealthy) raf = requestAnimationFrame(frame); }
    const visibility = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else { lastFrame = performance.now(); statsTime = lastFrame; frames = 0; dirty = true; schedule(); } };
    const observer = new IntersectionObserver(entries => { inView = entries[0].isIntersecting; if (inView) { lastFrame = performance.now(); statsTime = lastFrame; frames = 0; dirty = true; schedule(); } else { cancelAnimationFrame(raf); raf = 0; } }); observer.observe(host);
    const lost = (event: Event) => { event.preventDefault(); contextHealthy = false; cancelAnimationFrame(raf); raf = 0; setFailure(true); latest.current.onStats({ fps: 0, quality: 'offline' }); };
    const restored = () => { contextHealthy = true; setFailure(false); dirty = true; lastFrame = performance.now(); schedule(); };
    renderer.domElement.addEventListener('webglcontextlost', lost);
    renderer.domElement.addEventListener('webglcontextrestored', restored);
    document.addEventListener('visibilitychange', visibility);
    schedule();
    return () => {
      alive = false; cancelAnimationFrame(raf); resize.disconnect(); observer.disconnect(); document.removeEventListener('visibilitychange', visibility);
      renderer.domElement.removeEventListener('webglcontextlost', lost); renderer.domElement.removeEventListener('webglcontextrestored', restored);
      renderer.domElement.removeEventListener('pointerdown', pointerDown); renderer.domElement.removeEventListener('pointerup', pointerUp); renderer.domElement.removeEventListener('pointermove', pointerMove); renderer.domElement.removeEventListener('pointercancel', cancelPointer); renderer.domElement.removeEventListener('pointerleave', cancelPointer);
      controls.dispose();
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
      scene.traverse(object => { const mesh = object as THREE.Mesh; if (mesh.geometry) geometries.add(mesh.geometry); if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(m => materials.add(m)); });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
      actions.current = { reset() {}, focus() {}, zoom() {}, pulse() {} };
    };
  }, [attempt]);

  return <div className="topology-scene-shell">
    <div className="topology-webgl" ref={mount} />
    <div className="topology-labels" aria-hidden={failure}>
      {NODES.map(n => <button key={n.id} ref={element => { if (element) labelRefs.current.set(n.id, element); else labelRefs.current.delete(n.id); }} tabIndex={-1} className={`topology-label ${props.selected === n.id ? 'is-selected' : ''} is-${nodeState(n, props.activeStage, props.blocked)}`} style={{ '--node-color': n.color } as React.CSSProperties} onClick={() => props.onSelect(n.id)}><span><i />{n.label[props.language === 'zh' ? 0 : 1]}</span><small>{n.code}<span>{props.blocked && n.layer >= 3 ? 'ON HOLD' : props.blocked && n.id === 'gate' ? 'BLOCKED' : '→ ' + n.stage.toUpperCase()}</span></small></button>)}
    </div>
    {failure && <div className="topology-render-fallback" role="alert"><AlertTriangle size={28} /><b>{props.language === 'zh' ? '三维渲染暂不可用' : '3D rendering is unavailable'}</b><p>{props.language === 'zh' ? '仍可使用节点目录和连接关系检查架构。请启用浏览器硬件加速后重试。' : 'Explore nodes and connections in the side panels. Enable browser hardware acceleration and retry.'}</p><button onClick={() => setAttempt(a => a + 1)}><RotateCcw size={14} />{props.language === 'zh' ? '重试渲染' : 'Retry rendering'}</button></div>}
  </div>;
});
TopologyScene.displayName = 'TopologyScene';
