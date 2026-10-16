import * as THREE from 'three';
import type { NodeId } from './model';

// Vector glyphs rendered locally at high resolution: no model downloads or image requests.
const GLYPHS: Record<NodeId, string[]> = {
  prompt: ['M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z', 'M8 9h8M8 13h5'],
  core: ['M12 5a3 3 0 1 0-6 .125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z', 'M9 13a4.5 4.5 0 0 0 3-4M6 18a4 4 0 0 1-2-.5M12 8h8M16 8V5a2 2 0 0 1 2-2M12 13h5M12 18h6a2 2 0 0 1 2 2v1', 'M19.5 7.5h1v1h-1ZM16.5 12.5h1v1h-1ZM17.5 2.5h1v1h-1ZM19.5 20.5h1v1h-1Z'],
  hook: ['M9 3h6v6H9ZM2 16h6v6H2ZM16 16h6v6h-6Z', 'M12 9v4M5 16v-3h14v3'],
  gate: ['M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V6c3 0 5.5-1.5 8-4 2.5 2.5 5 4 8 4Z', 'm8.5 12 2.5 2.5 4.5-5'],
  shell: ['M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z', 'm7 9 3 3-3 3M13 15h4'],
  files: ['M8 3h7l5 5v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z', 'M14 3v6h6M10 13h6M10 17h4M3 7v12a5 5 0 0 0 5 5'],
  feedback: ['m16 2 4 4-4 4M20 6H8a4 4 0 0 0-4 4v1', 'm8 22-4-4 4-4M4 18h12a4 4 0 0 0 4-4v-1'],
};

export function iconTexture(id: NodeId): THREE.CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(112, 112); ctx.scale(12, 12);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.25; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const paths = GLYPHS[id].map(path => new Path2D(path));
  // Broad bloom and a fine white core keep the silhouette sharp even when zoomed out.
  for (const [blur, alpha] of [[38, 0.32], [13, 0.65], [3, 1]]) {
    ctx.shadowColor = '#c8edff'; ctx.shadowBlur = blur; ctx.globalAlpha = alpha;
    paths.forEach(path => ctx.stroke(path));
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function glowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.08, 'rgba(230,247,255,.9)');
  gradient.addColorStop(0.22, 'rgba(170,222,255,.28)');
  gradient.addColorStop(0.5, 'rgba(110,190,255,.065)');
  gradient.addColorStop(1, 'rgba(100,180,255,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function orbitalTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(256, 256); ctx.strokeStyle = '#d3efff'; ctx.shadowColor = '#8ad9ff'; ctx.shadowBlur = 8;
  ctx.lineWidth = 1.2;
  for (const radius of [184, 218]) {
    ctx.globalAlpha = radius === 184 ? 0.5 : 0.2;
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
  }
  for (let i = 0; i < 48; i++) {
    ctx.save(); ctx.rotate(i / 48 * Math.PI * 2); ctx.globalAlpha = i % 8 ? 0.18 : 0.55;
    ctx.beginPath(); ctx.moveTo(0, -218); ctx.lineTo(0, i % 8 ? -222 : -228); ctx.stroke(); ctx.restore();
  }
  ctx.lineWidth = 4; ctx.globalAlpha = 0.8;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.arc(0, 0, 201, i * Math.PI * 2 / 3, i * Math.PI * 2 / 3 + 0.42); ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
