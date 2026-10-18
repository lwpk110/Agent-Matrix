import * as THREE from "three";

const SAMPLES = 100;

/** A quiet screen-width conduit with a white packet head and a fading colored tail. */
export function createEnergyConduit(color: THREE.ColorRepresentation) {
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
      progress: { value: 0 },
      uActive: { value: 0 },
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
      uniform float progress;
      uniform float uActive;
      varying float vSide;
      varying float vEnergy;
      void main() {
        float core = 1.0 - smoothstep(0.065, 0.18, abs(vSide));
        float halo = exp(-abs(vSide) * 4.8);
        float delta = progress - vEnergy;
        float tail = exp(-max(0.0, delta) * 17.0) * smoothstep(-0.012, 0.0, delta);
        float head = exp(-pow(delta * 135.0, 2.0));
        float fade = smoothstep(0.0, 0.06, vEnergy) * (1.0 - smoothstep(0.94, 1.0, vEnergy));
        float light = 0.3 + uActive * (tail * 1.2 + head * 0.9);
        float alpha = (core * 0.78 + halo * 0.35) * light * fade * opacity;
        gl_FragColor = vec4(mix(tint, vec3(0.94, 1.0, 1.0), clamp(head * uActive + core * 0.35, 0.0, 1.0)), alpha);
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
    material.uniforms.progress.value = progress;
    material.uniforms.uActive.value = active ? 1 : 0;
    material.uniforms.opacity.value = 0.85 + intensity * 0.15;
    for (let i = 0; i < SAMPLES; i++) {
      const u = i / (SAMPLES - 1);
      const t = start + u * (end - start);
      curve.getPoint(t, points[i]);
      energy.fill(u, i * 2, i * 2 + 2);
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
