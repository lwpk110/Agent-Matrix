import * as THREE from "three";
import { runtimeHeartbeat } from "../runtimeHeartbeat";

const SAMPLES = 220;

/** A screen-width ribbon keeps the luminous ECG legible from every orbit angle. */
export function createHeartbeatTrace(color: THREE.ColorRepresentation) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(SAMPLES * 2 * 3);
  const neighbors = new Float32Array(positions.length);
  const sides = new Float32Array(SAMPLES * 2);
  const energy = new Float32Array(SAMPLES * 2);
  const indices: number[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    sides.set([-1, 1], i * 2);
    if (i < SAMPLES - 1) {
      const k = i * 2;
      indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("neighbor", new THREE.BufferAttribute(neighbors, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("side", new THREE.BufferAttribute(sides, 1));
  geometry.setAttribute("energy", new THREE.BufferAttribute(energy, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setIndex(indices);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      tint: { value: new THREE.Color(color) },
      resolution: { value: new THREE.Vector2(1, 1) },
      opacity: { value: 1 },
    },
    vertexShader: `
      attribute vec3 neighbor;
      attribute float side;
      attribute float energy;
      uniform vec2 resolution;
      varying float vSide;
      varying float vEnergy;
      void main() {
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vec4 n = projectionMatrix * modelViewMatrix * vec4(neighbor, 1.0);
        vec2 direction = (n.xy / n.w - p.xy / p.w) * resolution;
        direction /= max(length(direction), 0.001);
        vec2 normal = vec2(-direction.y, direction.x);
        p.xy += normal * side * 7.0 * 2.0 / resolution * p.w;
        gl_Position = p;
        vSide = side;
        vEnergy = energy;
      }
    `,
    fragmentShader: `
      uniform vec3 tint;
      uniform float opacity;
      varying float vSide;
      varying float vEnergy;
      void main() {
        float core = 1.0 - smoothstep(0.065, 0.18, abs(vSide));
        float halo = exp(-abs(vSide) * 4.8);
        float alpha = (core * 0.78 + halo * 0.48) * vEnergy * opacity;
        gl_FragColor = vec4(mix(tint, vec3(0.92, 1.0, 1.0), core * 0.65), alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  const points = Array.from({ length: SAMPLES }, () => new THREE.Vector3());
  const tangent = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const cameraUp = new THREE.Vector3();
  const update = (
    curve: THREE.QuadraticBezierCurve3,
    camera: THREE.Camera,
    progress: number,
    active: boolean,
    intensity: number,
    startRadius: number,
    endRadius: number,
    width: number,
    height: number,
  ) => {
    const length = curve.getLength();
    const start = Math.min(0.28, startRadius / length);
    const end = 1 - Math.min(0.28, endRadius / length);
    const span = (end - start) * length;
    const halfBeat = Math.min(2.1, span * 0.36);
    const center = progress * span;
    cameraUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    for (let i = 0; i < SAMPLES; i++) {
      const u = i / (SAMPLES - 1);
      const t = start + u * (end - start);
      const x = active ? (u * span - center) / halfBeat : 2;
      const fade = THREE.MathUtils.smoothstep(u, 0, 0.08) * (1 - THREE.MathUtils.smoothstep(u, 0.92, 1));
      curve.getTangent(t, tangent);
      normal.copy(cameraUp).addScaledVector(tangent, -cameraUp.dot(tangent)).normalize();
      curve.getPoint(t, points[i]).addScaledVector(
        normal,
        (active ? runtimeHeartbeat(x) : 0) * Math.min(0.95, span * 0.2) * fade,
      );
      const glow = active
        ? 0.08 + Math.exp(-x * x * 2.8) * (0.82 + intensity * 0.1)
        : 0.2;
      energy.fill(glow * (0.25 + fade * 0.75), i * 2, i * 2 + 2);
      points[i].toArray(positions, i * 6);
      points[i].toArray(positions, i * 6 + 3);
    }
    for (let i = 0; i < SAMPLES; i++) {
      // The last vertex extrapolates forward, preserving ribbon orientation.
      if (i === 0) tangent.copy(points[1]).sub(points[0]).add(points[0]);
      else if (i === SAMPLES - 1) tangent.copy(points[i]).sub(points[i - 1]).add(points[i]);
      else tangent.copy(points[i + 1]).sub(points[i - 1]).add(points[i]);
      tangent.toArray(neighbors, i * 6);
      tangent.toArray(neighbors, i * 6 + 3);
    }
    geometry.getAttribute("position").needsUpdate = true;
    geometry.getAttribute("neighbor").needsUpdate = true;
    geometry.getAttribute("energy").needsUpdate = true;
    material.uniforms.resolution.value.set(width, height);
  };
  return { mesh, update };
}
