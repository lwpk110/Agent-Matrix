/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { BlackBoxStage, MatrixMode } from '../types/matrix';
import { Language } from '../i18n/translations';
import { soundFx } from '../utils/audio';
import {
  Orbit,
  Shield,
  Layers,
  Cpu,
  Terminal,
  FileCode,
  Globe,
  Database,
  Crosshair,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  Zap,
  ShieldAlert,
  Radio,
  Eye,
  Camera,
  RefreshCw,
  Info,
  ChevronDown,
  ChevronUp,
  Tag,
  HelpCircle,
  Sparkles,
  Compass,
  Video,
} from 'lucide-react';

interface Agent3dArchitectureTopologyProps {
  language: Language;
  mode: MatrixMode;
  activeStage?: BlackBoxStage;
  isBlocked?: boolean;
  isRealWorkspace?: boolean;
  onSelectStage?: (stage: BlackBoxStage) => void;
  onOpenDrillDown?: (stage: BlackBoxStage) => void;
  onTriggerTrace?: () => void;
  onTriggerDenial?: () => void;
  onTriggerHook?: () => void;
}

export type TopologyType = 'orbit-reactor' | 'tiered-fortress' | 'cyber-motherboard';
export type MaterialPreset = 'cyber-circuit' | 'hologram-glass' | 'titanium-alloy';
export type CameraTrackingMode = 'global' | 'track-active' | 'focus-node' | 'free';

interface StationInfo {
  id: string;
  stage: BlackBoxStage;
  nameZh: string;
  nameEn: string;
  roleZh: string;
  roleEn: string;
  category: 'core' | 'prompt' | 'security' | 'tool' | 'feedback';
  categoryLabelZh: string;
  categoryLabelEn: string;
  icon: string;
  pos: {
    orbit: [number, number, number];
    fortress: [number, number, number];
    board: [number, number, number];
  };
  color: number;
  emissive: number;
  qps: number;
  latencyMs: number;
  status: 'ACTIVE' | 'STANDBY' | 'PROTECTED' | 'ISOLATED' | 'BLOCKED';
  payloadPreview: string;
  plainMeaningZh: string;
  plainMeaningEn: string;
}

// Procedural Canvas Texture Generators for rich PBR rendering
function createCircuitBoardTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Dark metallic background
  ctx.fillStyle = '#030b14';
  ctx.fillRect(0, 0, 512, 512);

  // Micro grid lines
  ctx.strokeStyle = '#092138';
  ctx.lineWidth = 1;
  for (let i = 0; i < 512; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  // Circuit traces
  ctx.strokeStyle = '#00f0ff';
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 6;
  ctx.lineWidth = 2;

  const tracePoints = [
    [[32, 64], [128, 64], [160, 96], [280, 96]],
    [[64, 180], [140, 180], [180, 220], [350, 220]],
    [[200, 320], [256, 320], [300, 360], [480, 360]],
    [[100, 420], [180, 420], [220, 460], [400, 460]],
    [[320, 60], [320, 160], [380, 220], [380, 300]],
  ];

  tracePoints.forEach((path) => {
    ctx.beginPath();
    ctx.moveTo(path[0][0], path[0][1]);
    for (let k = 1; k < path.length; k++) {
      ctx.lineTo(path[k][0], path[k][1]);
    }
    ctx.stroke();
  });

  // Circuit solder pads & micro-vias
  ctx.fillStyle = '#00ffff';
  [
    [128, 64], [280, 96], [180, 220], [350, 220],
    [256, 320], [480, 360], [220, 460], [380, 300],
    [256, 256], [128, 256], [384, 128], [384, 384]
  ].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  // Golden data IC nodes
  ctx.fillStyle = '#f59e0b';
  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur = 8;
  [[128, 128], [384, 256], [256, 384]].forEach(([x, y]) => {
    ctx.fillRect(x - 8, y - 8, 16, 16);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function createHexGridTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = 'rgba(0, 0, 0, 0)';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 8;

  const hexRadius = 24;
  const hexHeight = hexRadius * Math.sqrt(3);
  const hexWidth = hexRadius * 2;

  for (let row = -1; row < 256 / hexHeight + 2; row++) {
    for (let col = -1; col < 256 / (hexWidth * 0.75) + 2; col++) {
      const cx = col * hexWidth * 0.75;
      const cy = row * hexHeight + (col % 2 === 0 ? 0 : hexHeight / 2);

      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        const x = cx + hexRadius * Math.cos(angle);
        const y = cy + hexRadius * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
}

function createCarbonBumpTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 128, 128);

  // Brushed micro streaks
  for (let i = 0; i < 600; i++) {
    const val = Math.floor(Math.random() * 80 + 80);
    ctx.fillStyle = `rgb(${val}, ${val}, ${val})`;
    const x = Math.random() * 128;
    const y = Math.random() * 128;
    const len = Math.random() * 20 + 5;
    ctx.fillRect(x, y, len, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  return texture;
}

// =========================================================================
// PRODUCTION-GRADE PROCEDURAL GEOMETRY GENERATORS & MODEL BUILDER
// Replaces primitive default boxes/cones with engineered multi-part aerospace modules
// =========================================================================

function createBeveledPolygonGeometry(radius: number, sides: number, height: number, bevel = 0.04): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  for (let i = 0; i < sides; i++) {
    const angle = (i * Math.PI * 2) / sides;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
  });
  geom.center();
  return geom;
}

function createBeveledBoxGeometry(w: number, h: number, d: number, r = 0.04): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const hw = Math.max(0.01, w / 2 - r);
  const hh = Math.max(0.01, h / 2 - r);
  shape.moveTo(-hw, -h / 2);
  shape.lineTo(hw, -h / 2);
  shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -hh);
  shape.lineTo(w / 2, hh);
  shape.quadraticCurveTo(w / 2, h / 2, hw, h / 2);
  shape.lineTo(-hw, h / 2);
  shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, hh);
  shape.lineTo(-w / 2, -hh);
  shape.quadraticCurveTo(-w / 2, -h / 2, -hw, -h / 2);
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: d,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: r * 0.4,
    bevelThickness: r * 0.4,
  });
  geom.center();
  return geom;
}

function createSteppedLatheGeometry(profile: [number, number][], segments = 24): THREE.BufferGeometry {
  const vPoints = profile.map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(vPoints, segments);
}

// =========================================================================
// GLOWING HOLOGRAPHIC CHART TEXTURE GENERATOR & 3D HUD CHART BOARD BUILDER
// Replaces confusing abstract geometric primitives with luminous, self-explanatory
// holographic infographic charts (发光的图表) that instantly communicate system state
// =========================================================================

function createStationGlowingChartTexture(st: StationInfo, isBlocked: boolean, isZh: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 420;
  const ctx = canvas.getContext('2d')!;

  // 1. Cyber Dark Translucent Plaque Background
  const bgGrad = ctx.createLinearGradient(0, 0, 640, 420);
  bgGrad.addColorStop(0, '#040816');
  bgGrad.addColorStop(1, '#081329');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 640, 420);

  // 2. Fine Holographic Scan Grid
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.06)';
  ctx.lineWidth = 1;
  for (let x = 0; x < 640; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 420);
    ctx.stroke();
  }
  for (let y = 0; y < 420; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(640, y);
    ctx.stroke();
  }

  // 3. Glowing Neon Cyber Frame with Chamfered Corners
  const strokeColor = st.id === 'sentinel' && isBlocked ? '#f43f5e' : `#${st.color.toString(16).padStart(6, '0')}`;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2.5;
  ctx.shadowColor = strokeColor;
  ctx.shadowBlur = 12;

  ctx.beginPath();
  ctx.moveTo(24, 8);
  ctx.lineTo(616, 8);
  ctx.lineTo(632, 24);
  ctx.lineTo(632, 396);
  ctx.lineTo(616, 412);
  ctx.lineTo(24, 412);
  ctx.lineTo(8, 396);
  ctx.lineTo(8, 24);
  ctx.closePath();
  ctx.stroke();

  // Corner Brackets
  const drawCornerBracket = (x: number, y: number, dx: number, dy: number) => {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + dx * 20, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + dy * 20);
    ctx.stroke();
  };
  drawCornerBracket(12, 12, 1, 1);
  drawCornerBracket(628, 12, -1, 1);
  drawCornerBracket(12, 408, 1, -1);
  drawCornerBracket(628, 408, -1, -1);

  // 4. Top Header Row: Icon, Category Badge, Station Title, Status Pill
  ctx.shadowBlur = 0;
  // Header bar background
  ctx.fillStyle = 'rgba(4, 15, 34, 0.85)';
  ctx.fillRect(10, 10, 620, 52);
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(10, 10, 620, 52);

  // Station Category & Icon
  ctx.font = 'bold 22px "Noto Sans SC", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(st.icon, 24, 44);

  ctx.font = 'bold 11px monospace';
  ctx.fillStyle = strokeColor;
  ctx.fillText(`[${isZh ? st.categoryLabelZh : st.categoryLabelEn}]`, 56, 32);

  ctx.font = 'bold 17px "Noto Sans SC", sans-serif';
  ctx.fillStyle = '#f8fafc';
  ctx.fillText(isZh ? st.nameZh : st.nameEn, 56, 52);

  // Status Pill
  const isErr = st.id === 'sentinel' && isBlocked;
  ctx.fillStyle = isErr ? '#4c0519' : 'rgba(2, 44, 34, 0.9)';
  ctx.strokeStyle = isErr ? '#f43f5e' : '#10b981';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(495, 20, 125, 30, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = isErr ? '#fda4af' : '#6ee7b7';
  ctx.font = 'bold 11px monospace';
  ctx.fillText(isErr ? '● BLOCKED' : `● ${st.status}`, 510, 40);

  // 5. Procedural Infographic Glowing Charts per Station
  if (st.id === 'prompt_deck') {
    // ========================================================
    // CHART 1: TOKEN CONTEXT FUSION DONUT CHART & METRICS
    // ========================================================
    const cx = 140;
    const cy = 230;
    const outerR = 82;
    const innerR = 52;

    const segments = [
      { label: isZh ? '系统提示词' : 'System Prompt', val: 0.25, color: '#00f0ff', tokens: '1,230T' },
      { label: isZh ? '工具 Schema' : 'Tool Schemas', val: 0.35, color: '#c084fc', tokens: '1,722T' },
      { label: isZh ? '项目工程规范' : 'Project Rules', val: 0.20, color: '#f59e0b', tokens: '984T' },
      { label: isZh ? '历史会话窗口' : 'History Context', val: 0.20, color: '#10b981', tokens: '984T' },
    ];

    let startAng = -Math.PI / 2;
    segments.forEach((seg) => {
      const endAng = startAng + seg.val * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, startAng, endAng);
      ctx.arc(cx, cy, innerR, endAng, startAng, true);
      ctx.closePath();
      ctx.fillStyle = seg.color;
      ctx.shadowColor = seg.color;
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
      startAng = endAng;
    });

    // Donut Center Text
    ctx.textAlign = 'center';
    ctx.font = 'black 22px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('4,920', cx, cy + 4);
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#00f0ff';
    ctx.fillText('TOKENS', cx, cy + 20);
    ctx.textAlign = 'left';

    // Right Side Legend & Gauge Bars
    ctx.font = 'bold 13px "Noto Sans SC", sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(isZh ? '全息上下文熔铸比例 (Fusion Spectrum)' : 'Context Fusion Spectrum', 265, 115);

    let rowY = 145;
    segments.forEach((seg) => {
      // Color Dot
      ctx.fillStyle = seg.color;
      ctx.beginPath();
      ctx.arc(272, rowY - 4, 5, 0, Math.PI * 2);
      ctx.fill();

      // Label & Token count
      ctx.font = '12px "Noto Sans SC", sans-serif';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(seg.label, 286, rowY);

      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = seg.color;
      ctx.fillText(seg.tokens, 450, rowY);

      // Bar track & fill
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(286, rowY + 6, 210, 6);
      ctx.fillStyle = seg.color;
      ctx.shadowColor = seg.color;
      ctx.shadowBlur = 6;
      ctx.fillRect(286, rowY + 6, 210 * seg.val, 6);
      ctx.shadowBlur = 0;

      rowY += 46;
    });

    // Cache Hit Telemetry Footer
    ctx.fillStyle = 'rgba(0, 240, 255, 0.12)';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1;
    ctx.fillRect(30, 355, 580, 42);
    ctx.strokeRect(30, 355, 580, 42);

    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#00f0ff';
    ctx.fillText('⚡ PROMPT CACHE HIT: 78.4% (3,840T Cached) • TTFT REDUCTION: -82%', 48, 381);
  } else if (st.id === 'core') {
    // ========================================================
    // CHART 2: ATTENTION SPIDER RADAR & REAL-TIME TPS WAVE
    // ========================================================
    const cx = 135;
    const cy = 215;
    const radius = 74;
    const axes = [
      { label: isZh ? '逻辑推理' : 'Logic', score: 0.98 },
      { label: isZh ? '代码编写' : 'Coding', score: 0.95 },
      { label: isZh ? '工具调用' : 'Tools', score: 0.92 },
      { label: isZh ? '自愈规划' : 'Planning', score: 0.96 },
      { label: isZh ? '上下文' : 'Context', score: 0.94 },
    ];
    const totalAxes = axes.length;

    // Spider web rings
    [0.25, 0.5, 0.75, 1.0].forEach((level) => {
      ctx.beginPath();
      for (let i = 0; i < totalAxes; i++) {
        const ang = (i * Math.PI * 2) / totalAxes - Math.PI / 2;
        const x = cx + Math.cos(ang) * radius * level;
        const y = cy + Math.sin(ang) * radius * level;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
      ctx.stroke();
    });

    // Spokes & Axis Labels
    for (let i = 0; i < totalAxes; i++) {
      const ang = (i * Math.PI * 2) / totalAxes - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(ang) * radius, cy + Math.sin(ang) * radius);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
      ctx.stroke();

      // Axis label
      const lx = cx + Math.cos(ang) * (radius + 18);
      const ly = cy + Math.sin(ang) * (radius + 18);
      ctx.textAlign = 'center';
      ctx.font = '10px "Noto Sans SC", monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(axes[i].label, lx, ly + 3);
    }
    ctx.textAlign = 'left';

    // Filled Glowing Radar Polygon
    ctx.beginPath();
    for (let i = 0; i < totalAxes; i++) {
      const ang = (i * Math.PI * 2) / totalAxes - Math.PI / 2;
      const score = axes[i].score;
      const x = cx + Math.cos(ang) * radius * score;
      const y = cy + Math.sin(ang) * radius * score;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 240, 255, 0.35)';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Right Side: Attention & TPS Oscillogram
    ctx.font = 'bold 13px "Noto Sans SC", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('CLAUDE 3.7 SONNET // 推理中枢', 265, 115);

    ctx.font = '11px monospace';
    ctx.fillStyle = '#00f0ff';
    ctx.fillText('THINKING PROTOCOL: ACTIVE (16,384 Budget)', 265, 136);

    // Mini Live Oscillogram Line Graph
    ctx.fillStyle = 'rgba(2, 10, 25, 0.8)';
    ctx.fillRect(265, 150, 345, 95);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
    ctx.strokeRect(265, 150, 345, 95);

    // Sinusoidal Waveform
    ctx.beginPath();
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 10;
    for (let x = 0; x < 345; x += 4) {
      const wave = Math.sin(x * 0.08) * 22 + Math.cos(x * 0.03) * 14;
      const py = 198 + wave;
      if (x === 0) ctx.moveTo(265 + x, py);
      else ctx.lineTo(265 + x, py);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Stat Badges
    const stats = [
      { label: 'THROUGHPUT', val: '128 TPS', color: '#10b981' },
      { label: 'TTFT LATENCY', val: '142.8 ms', color: '#00f0ff' },
      { label: 'ATTENTION TEMP', val: '0.20', color: '#c084fc' },
    ];
    let statX = 30;
    stats.forEach((st) => {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = st.color;
      ctx.lineWidth = 1;
      ctx.fillRect(statX, 350, 185, 48);
      ctx.strokeRect(statX, 350, 185, 48);

      ctx.font = '9px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(st.label, statX + 12, 368);
      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = st.color;
      ctx.fillText(st.val, statX + 12, 388);

      statX += 197;
    });
  } else if (st.id === 'sentinel') {
    // ========================================================
    // CHART 3: ZERO-TRUST DEFENSE RADAR & VERDICT SECTOR
    // ========================================================
    const cx = 140;
    const cy = 230;
    const radius = 80;

    // Radar Concentric Circles
    [0.3, 0.6, 1.0].forEach((r) => {
      ctx.beginPath();
      ctx.arc(cx, cy, radius * r, 0, Math.PI * 2);
      ctx.strokeStyle = isBlocked ? 'rgba(244, 63, 94, 0.4)' : 'rgba(16, 185, 129, 0.4)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    });

    // Crosshairs
    ctx.beginPath();
    ctx.moveTo(cx - radius, cy);
    ctx.lineTo(cx + radius, cy);
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx, cy + radius);
    ctx.strokeStyle = isBlocked ? 'rgba(244, 63, 94, 0.3)' : 'rgba(16, 185, 129, 0.3)';
    ctx.stroke();

    // Radar Sweep Cone
    const sweepGrad = ctx.createRadialGradient(cx, cy, 5, cx, cy, radius);
    if (isBlocked) {
      sweepGrad.addColorStop(0, 'rgba(244, 63, 94, 0.8)');
      sweepGrad.addColorStop(1, 'rgba(244, 63, 94, 0.1)');
    } else {
      sweepGrad.addColorStop(0, 'rgba(16, 185, 129, 0.8)');
      sweepGrad.addColorStop(1, 'rgba(16, 185, 129, 0.1)');
    }
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, -0.6, 0.6);
    ctx.closePath();
    ctx.fillStyle = sweepGrad;
    ctx.fill();

    // Center Radar Beacon
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = isBlocked ? '#f43f5e' : '#10b981';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Right Side Verdict Panel
    if (isBlocked) {
      ctx.fillStyle = '#450a0a';
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 2;
      ctx.fillRect(265, 110, 345, 130);
      ctx.strokeRect(265, 110, 345, 130);

      ctx.font = 'black 20px monospace';
      ctx.fillStyle = '#f43f5e';
      ctx.fillText('🚨 HARD_DENY 熔断拦截', 285, 145);

      ctx.font = '12px "Noto Sans SC", sans-serif';
      ctx.fillStyle = '#fca5a5';
      ctx.fillText('触发规则: SEC-ZERO-TRUST-01 危险指令阻断', 285, 175);
      ctx.fillText('命中威胁: rm -rf / 提权破坏行为被物理拦截', 285, 200);
      ctx.fillText('人机交互: 已暂停自动化执行，等待人工审批', 285, 225);
    } else {
      ctx.fillStyle = '#064e3b';
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.fillRect(265, 110, 345, 130);
      ctx.strokeRect(265, 110, 345, 130);

      ctx.font = 'black 20px monospace';
      ctx.fillStyle = '#10b981';
      ctx.fillText('🛡️ ZERO-TRUST: 0ms 放行', 285, 145);

      ctx.font = '12px "Noto Sans SC", sans-serif';
      ctx.fillStyle = '#a7f3d0';
      ctx.fillText('静态签名校验: PASSED (白名单工具 24 项)', 285, 175);
      ctx.fillText('爆炸半径限制: 工作区沙箱内隔离 (Scoped)', 285, 200);
      ctx.fillText('拦截耗时: 0.8ms • 零信任不变量恒真', 285, 225);
    }

    // Telemetry Footer
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(30, 350, 580, 48);
    ctx.strokeStyle = isBlocked ? '#f43f5e' : '#10b981';
    ctx.lineWidth = 1;
    ctx.strokeRect(30, 350, 580, 48);

    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = isBlocked ? '#f43f5e' : '#10b981';
    ctx.fillText(
      isBlocked
        ? 'TRIPWIRE ACTIVATED: 100% THREAT CONTAINED • AUDIT LOG FORWARDED'
        : 'CONTINUOUS SENTINEL SCAN: ALL SUBPROCESS HANDLES VERIFIED (96 QPS)',
      45,
      380
    );
  } else if (st.id === 'mcp_hook') {
    // ========================================================
    // CHART 4: MCP PROTOCOL HOOK THROUGHPUT BAR CHART
    // ========================================================
    const bars = [
      { label: 'JSON-RPC 2.0', score: 0.95, ms: '0.4ms', color: '#06b6d4' },
      { label: 'PreTool AST', score: 0.88, ms: '1.2ms', color: '#00f0ff' },
      { label: 'Schema Match', score: 0.98, ms: '0.2ms', color: '#a855f7' },
      { label: 'Arg Sanitize', score: 0.85, ms: '0.6ms', color: '#10b981' },
    ];

    let bx = 50;
    bars.forEach((b) => {
      const bh = b.score * 160;
      const by = 290 - bh;

      // Track
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(bx, 130, 80, 160);

      // Filled Bar
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 10;
      ctx.fillRect(bx, by, 80, bh);
      ctx.shadowBlur = 0;

      // Top score badge
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(`${(b.score * 100).toFixed(0)}%`, bx + 40, by - 8);

      // Label & Latency
      ctx.font = '11px monospace';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(b.label, bx + 40, 312);
      ctx.fillStyle = b.color;
      ctx.fillText(b.ms, bx + 40, 328);

      bx += 115;
    });
    ctx.textAlign = 'left';

    // Top description
    ctx.font = 'bold 13px "Noto Sans SC", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('MODEL CONTEXT PROTOCOL // 协议哨卡吞吐柱状图', 50, 100);

    // Footer
    ctx.fillStyle = 'rgba(6, 182, 212, 0.15)';
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 1;
    ctx.fillRect(30, 355, 580, 42);
    ctx.strokeRect(30, 355, 580, 42);
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#06b6d4';
    ctx.fillText('MCP PROTOCOL: STDIO/SSE ACTIVE • 84 QPS • INVARIANTS: PASS', 48, 381);
  } else if (st.id === 'pod_cli' || st.id === 'pod_fs') {
    // ========================================================
    // CHART 5: BASH PTY & FILE SYSTEM EXECUTION METRICS
    // ========================================================
    // Terminal window representation
    ctx.fillStyle = '#020617';
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.5;
    ctx.fillRect(30, 95, 340, 230);
    ctx.strokeRect(30, 95, 340, 230);

    // Terminal top bar
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(30, 95, 340, 26);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(46, 108, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(60, 108, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(74, 108, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '10px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(st.id === 'pod_cli' ? 'bash_pty_sandbox' : 'virtual_fs_worker', 120, 112);

    // Terminal text stream
    ctx.font = '11px monospace';
    if (st.id === 'pod_cli') {
      ctx.fillStyle = '#10b981';
      ctx.fillText('$ npm run test:unit', 45, 145);
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('> RUNS src/auth.test.ts', 45, 170);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('✓ 24 tests passed (100%)', 45, 195);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText('PID: 4892 • CWD: /workspace', 45, 220);
      ctx.fillStyle = '#10b981';
      ctx.fillText('EXIT CODE: 0 (NOMINAL)', 45, 245);
    } else {
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('DIFF PATCH: ProductCard.tsx', 45, 145);
      ctx.fillStyle = '#10b981';
      ctx.fillText('+ 14 additions (responsive grid)', 45, 170);
      ctx.fillStyle = '#f43f5e';
      ctx.fillText('-  2 deletions (fixed width)', 45, 195);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText('SNAPSHOT: armed (sha: 7f8a9e)', 45, 220);
      ctx.fillStyle = '#10b981';
      ctx.fillText('ATOMIC TRANSACTION: COMMITTED', 45, 245);
    }

    // Right Side: Resource Gauge Meters
    const meters = [
      { label: 'CPU LOAD', val: '14%', fill: 0.14, color: '#10b981' },
      { label: 'MEMORY CGROUP', val: '128 MB / 1GB', fill: 0.18, color: '#38bdf8' },
      { label: 'IOPS THROUGHPUT', val: '62 QPS', fill: 0.62, color: '#c084fc' },
    ];
    let my = 120;
    meters.forEach((m) => {
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(m.label, 395, my);
      ctx.fillStyle = m.color;
      ctx.fillText(m.val, 530, my);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(395, my + 8, 215, 8);
      ctx.fillStyle = m.color;
      ctx.fillRect(395, my + 8, 215 * m.fill, 8);
      my += 58;
    });

    // Footer
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(30, 350, 580, 48);
    ctx.strokeStyle = strokeColor;
    ctx.strokeRect(30, 350, 580, 48);
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = strokeColor;
    ctx.fillText('SANDBOX ISOLATION: PTY RAW OUTPUT CAPTURED • ZERO POLLUTION', 45, 380);
  } else {
    // ========================================================
    // CHART 6: REACT DELIBERATION LOOP OSCILLOGRAM & SUMMARY
    // ========================================================
    // Sinusoidal Feedback Waveform Chart
    ctx.fillStyle = '#020617';
    ctx.strokeStyle = '#ec4899';
    ctx.lineWidth = 1.5;
    ctx.fillRect(30, 95, 360, 230);
    ctx.strokeRect(30, 95, 360, 230);

    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#ec4899';
    ctx.fillText('REACT DELIBERATION LOOPBACK WAVE', 45, 125);

    // Oscillation wave
    ctx.beginPath();
    ctx.strokeStyle = '#ec4899';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#ec4899';
    ctx.shadowBlur = 12;
    for (let x = 0; x < 330; x += 3) {
      const decay = Math.exp(-x * 0.005);
      const wave = Math.sin(x * 0.09) * 45 * decay;
      const py = 220 + wave;
      if (x === 0) ctx.moveTo(45 + x, py);
      else ctx.lineTo(45 + x, py);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Right Side: Checklist
    ctx.font = 'bold 13px "Noto Sans SC", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('ReAct 闭环反思状态', 410, 115);

    const checks = [
      { text: '测试断言全数通过', sub: '24/24 PASS (0 ERRORS)', ok: true },
      { text: '差异收敛度验证', sub: 'DIFF CONVERGED: 100%', ok: true },
      { text: '循环终止条件达成', sub: 'READY FOR FINAL DELIVERY', ok: true },
    ];
    let cyY = 145;
    checks.forEach((chk) => {
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('✓', 410, cyY);

      ctx.font = '12px "Noto Sans SC", sans-serif';
      ctx.fillStyle = '#f1f5f9';
      ctx.fillText(chk.text, 430, cyY);

      ctx.font = '10px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(chk.sub, 430, cyY + 16);

      cyY += 46;
    });

    // Footer
    ctx.fillStyle = 'rgba(236, 72, 153, 0.15)';
    ctx.strokeStyle = '#ec4899';
    ctx.fillRect(30, 350, 580, 48);
    ctx.strokeRect(30, 350, 580, 48);
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#ec4899';
    ctx.fillText('OBSERVATION RE-PACKAGED: TRIGGER NEXT THOUGHT OR FINALIZE (58 QPS)', 45, 380);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

interface StationModelResult {
  group: THREE.Group;
  primaryHitMesh: THREE.Mesh;
  rotators: THREE.Object3D[];
  ring: THREE.Mesh;
  chartBoard?: THREE.Group;
}

function buildProductionStationModel(
  st: StationInfo,
  textures: { circuit: THREE.CanvasTexture; hex: THREE.CanvasTexture; bump: THREE.CanvasTexture },
  isBlocked: boolean,
  isZh = true
): StationModelResult {
  const group = new THREE.Group();
  const rotators: THREE.Object3D[] = [];

  // ========================================================
  // 1. Sleek Ground Cyber Pedestal with Luminous Ring
  // ========================================================
  const plinthGeo = createBeveledPolygonGeometry(1.4, 8, 0.14, 0.04);
  const plinthMat = new THREE.MeshStandardMaterial({
    color: 0x071120,
    metalness: 0.92,
    roughness: 0.22,
    map: textures.circuit,
  });
  const plinthMesh = new THREE.Mesh(plinthGeo, plinthMat);
  plinthMesh.rotation.x = Math.PI / 2;
  plinthMesh.position.y = 0.07;
  group.add(plinthMesh);

  // Soft Contact Grounding Shadow
  const shadowGeo = new THREE.CircleGeometry(1.65, 32);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = -0.01;
  group.add(shadowMesh);

  // Spinning Hologram Floor Ring
  const rGeo = new THREE.TorusGeometry(1.45, 0.038, 16, 48);
  const rMat = new THREE.MeshStandardMaterial({
    color: st.color,
    emissive: st.emissive,
    emissiveIntensity: 1.4,
    metalness: 0.95,
    roughness: 0.1,
  });
  const ring = new THREE.Mesh(rGeo, rMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.15;
  group.add(ring);

  // Upward Ethereal Holographic Projector Cone
  const coneGeo = new THREE.CylinderGeometry(0.85, 1.35, 1.1, 24, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({
    color: st.color,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const coneMesh = new THREE.Mesh(coneGeo, coneMat);
  coneMesh.position.y = 0.65;
  group.add(coneMesh);

  // ========================================================
  // 2. Large Floating Glowing Hologram Chart Board (发光的图表)
  // Wraps in a billboardable group so it can pivot to camera
  // ========================================================
  const chartBoard = new THREE.Group();
  chartBoard.position.y = 1.65;

  const chartTexture = createStationGlowingChartTexture(st, isBlocked, isZh);

  // Aerospace Composite Backing Plate
  const plateGeo = createBeveledBoxGeometry(3.2, 2.1, 0.04, 0.03);
  const plateMat = new THREE.MeshStandardMaterial({
    color: 0x050c18,
    metalness: 0.88,
    roughness: 0.2,
    map: textures.circuit,
  });
  const plateMesh = new THREE.Mesh(plateGeo, plateMat);
  plateMesh.position.set(0, 0, 0);
  chartBoard.add(plateMesh);

  // Glowing Outer Bezel Frame
  const bezelGeo = new THREE.BoxGeometry(3.26, 2.16, 0.03);
  const bezelMat = new THREE.MeshStandardMaterial({
    color: st.color,
    emissive: st.emissive,
    emissiveIntensity: 1.2,
    metalness: 0.9,
    roughness: 0.15,
  });
  const bezelMesh = new THREE.Mesh(bezelGeo, bezelMat);
  bezelMesh.position.set(0, 0, 0);
  chartBoard.add(bezelMesh);

  // Dual-Faced Luminous Holographic Chart Screen (Front & Back)
  const screenGeo = new THREE.PlaneGeometry(3.15, 2.05);
  const screenMat = new THREE.MeshStandardMaterial({
    map: chartTexture,
    emissiveMap: chartTexture,
    emissive: 0xffffff,
    emissiveIntensity: 1.15,
    roughness: 0.15,
    metalness: 0.1,
    transparent: true,
    opacity: 0.98,
    side: THREE.DoubleSide,
  });

  const primaryHitMesh = new THREE.Mesh(screenGeo, screenMat);
  primaryHitMesh.position.set(0, 0, 0.025);
  primaryHitMesh.userData = { stationId: st.id };
  chartBoard.add(primaryHitMesh);

  // Back face display
  const backScreen = new THREE.Mesh(screenGeo, screenMat);
  backScreen.position.set(0, 0, -0.025);
  backScreen.rotation.y = Math.PI;
  chartBoard.add(backScreen);

  group.add(chartBoard);

  // Corner Mounting Struts
  const strutGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.7, 12);
  const strutMat = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: 0x0088cc,
    emissiveIntensity: 0.8,
    metalness: 0.95,
  });
  const strut1 = new THREE.Mesh(strutGeo, strutMat);
  strut1.position.set(-1.1, 0.55, 0);
  strut1.rotation.z = -Math.PI / 12;
  group.add(strut1);

  const strut2 = new THREE.Mesh(strutGeo, strutMat);
  strut2.position.set(1.1, 0.55, 0);
  strut2.rotation.z = Math.PI / 12;
  group.add(strut2);

  rotators.push(coneMesh);

  return { group, primaryHitMesh, rotators, ring, chartBoard };
}

export const Agent3dArchitectureTopology: React.FC<Agent3dArchitectureTopologyProps> = ({
  language,
  mode,
  activeStage = 'prompt',
  isBlocked = false,
  isRealWorkspace = false,
  onSelectStage,
  onOpenDrillDown,
  onTriggerTrace,
  onTriggerDenial,
  onTriggerHook,
}) => {
  const isZh = language === 'zh';
  const containerRef = useRef<HTMLDivElement>(null);
  const labelsOverlayRef = useRef<HTMLDivElement>(null);

  // Interactive States
  const [topologyType, setTopologyType] = useState<TopologyType>('orbit-reactor');
  const [materialPreset, setMaterialPreset] = useState<MaterialPreset>('cyber-circuit');
  const [cameraTrackingMode, setCameraTrackingMode] = useState<CameraTrackingMode>('global');
  const [selectedStationId, setSelectedStationId] = useState<string>('core');
  const [hoveredStationId, setHoveredStationId] = useState<string | null>(null);
  const [isAutoRotate, setIsAutoRotate] = useState<boolean>(true);
  const [flowSpeed, setFlowSpeed] = useState<number>(1);
  const [labelVisibility, setLabelVisibility] = useState<'all' | 'focused' | 'none'>('all');
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Camera Telemetry for UI HUD
  const [camDistance, setCamDistance] = useState<number>(24);
  const [camTrackTargetName, setCamTrackTargetName] = useState<string>('全局拓扑 (Global Overview)');

  // 7 Architectural Stations with Spacious Uncrowded Topology Coordinates
  const stations: StationInfo[] = useMemo(
    () => [
      {
        id: 'prompt_deck',
        stage: 'prompt',
        nameZh: '需求输入与规则设定站',
        nameEn: 'Task & Context Platform',
        roleZh: '接收用户需求、项目代码规范与系统行为守则',
        roleEn: 'User Directives, Project Rules & System Guidelines',
        category: 'prompt',
        categoryLabelZh: '任务输入源',
        categoryLabelEn: 'INPUT CONTEXT',
        icon: '📥',
        pos: {
          orbit: [0, 5.6, 0],
          fortress: [0, 6.0, 0],
          board: [-7.8, 0.6, -4.6],
        },
        color: 0xa855f7,
        emissive: 0x9333ea,
        qps: 42,
        latencyMs: 12.4,
        status: 'ACTIVE',
        payloadPreview: 'Task: Claude Code v1.2 • Context: 15.2k tokens • Workspace rules active',
        plainMeaningZh: 'Agent 接收你的指令，并结合项目代码规范与安全守则，作为思考第一步',
        plainMeaningEn: 'Starting point: receives your task with project guidelines & safety rules',
      },
      {
        id: 'core',
        stage: 'llm',
        nameZh: '中央推理认知反应堆',
        nameEn: 'Cognitive Reasoning Reactor',
        roleZh: '核心注意力机制、思维链推理与多模态决策中枢',
        roleEn: 'Transformer Attention Engine & Deliberation Core',
        category: 'core',
        categoryLabelZh: '核心大脑中枢',
        categoryLabelEn: 'BRAIN CORE',
        icon: '🧠',
        pos: {
          orbit: [0, 0, 0],
          fortress: [0, 2.2, 0],
          board: [0, 0.8, 0],
        },
        color: 0x00f0ff,
        emissive: 0x00d4ff,
        qps: 128,
        latencyMs: 142.8,
        status: 'ACTIVE',
        payloadPreview: mode === 'claude' ? 'Claude 3.7 Sonnet (Thinking Protocol ON)' : 'Codex Engine Core',
        plainMeaningZh: 'Agent 灵魂大脑：负责阅读代码、深度思考，决定调用哪个工具',
        plainMeaningEn: 'LLM Brain: Runs reasoning loop and formulates structured tool calls',
      },
      {
        id: 'sentinel',
        stage: 'permission',
        nameZh: '零信任安全巡航哨兵环',
        nameEn: 'Zero-Trust Sentinel Field',
        roleZh: '高危文件热熔断、敏感路径拦截与人机介入(HITL)闸门',
        roleEn: 'Zero-Trust Sentinel Gate & Blast-Radius Limiter',
        category: 'security',
        categoryLabelZh: '零信任安全哨所',
        categoryLabelEn: 'SECURITY GATE',
        icon: '🛡️',
        pos: {
          orbit: [6.5, 1.8, 2.6],
          fortress: [5.8, 2.2, 0],
          board: [6.2, 0.6, -2.8],
        },
        color: isBlocked ? 0xf43f5e : 0x10b981,
        emissive: isBlocked ? 0xe11d48 : 0x059669,
        qps: 96,
        latencyMs: 0.8,
        status: isBlocked ? 'BLOCKED' : 'PROTECTED',
        payloadPreview: isBlocked
          ? '🚨 DENIAL: High-risk file access locked (.env.production)'
          : 'Zero-Trust Invariant: PASSED (Signature OK)',
        plainMeaningZh: '安全铁门：任何工具调用必须经过此门裁决，拦截越权与高危破坏',
        plainMeaningEn: 'Security Gate: Inspects all tool calls and blocks dangerous actions',
      },
      {
        id: 'mcp_hook',
        stage: 'mcp_hook',
        nameZh: 'MCP Hook 协议哨卡',
        nameEn: 'MCP Protocol Hook Gate',
        roleZh: 'PreToolUse 静态 AST 检查与安全规范不变量拦截',
        roleEn: 'PreToolUse AST Static Analysis & Protocol Interceptor',
        category: 'security',
        categoryLabelZh: '协议哨卡',
        categoryLabelEn: 'PROTOCOL GATE',
        icon: '🪝',
        pos: {
          orbit: [-6.5, 1.8, 2.6],
          fortress: [-5.8, 2.2, 0],
          board: [-6.2, 0.6, -2.8],
        },
        color: 0x06b6d4,
        emissive: 0x0891b2,
        qps: 84,
        latencyMs: 1.2,
        status: 'PROTECTED',
        payloadPreview: 'PreTool AST Verification: Invariants match schema',
        plainMeaningZh: '工具调用协议检验站：在代码落地前做语法树与模式扫描',
        plainMeaningEn: 'Inspects AST & schema compliance before dispatch',
      },
      {
        id: 'pod_cli',
        stage: 'sandbox',
        nameZh: 'Bash PTY 命令执行沙箱',
        nameEn: 'Bash PTY Sandbox Pod',
        roleZh: '独立子进程命令执行容器、环境变量隔离与实时输出捕获',
        roleEn: 'Isolated Shell Subprocess & Output Stream Capture',
        category: 'tool',
        categoryLabelZh: '隔离执行舱',
        categoryLabelEn: 'SANDBOX POD',
        icon: '💻',
        pos: {
          orbit: [6.8, -2.4, -2.5],
          fortress: [5.8, -2.2, 3.2],
          board: [7.2, 0.6, 4.8],
        },
        color: 0x10b981,
        emissive: 0x059669,
        qps: 34,
        latencyMs: 46.2,
        status: 'ISOLATED',
        payloadPreview: 'exec: npm run test:unit • pid: 4892 • exit: 0',
        plainMeaningZh: '手脚执行舱 1：安全运行命令行，捕获编译报错与测试反馈',
        plainMeaningEn: 'Isolated terminal sandbox running shell commands safely',
      },
      {
        id: 'pod_fs',
        stage: 'sandbox',
        nameZh: '原子虚拟文件系统仓',
        nameEn: 'Atomic Safe FileSystem Pod',
        roleZh: '事务级文件写入、快照回滚与 Diff 变更有序追踪',
        roleEn: 'Atomic File IO & Transactional Rollback Buffer',
        category: 'tool',
        categoryLabelZh: '隔离执行舱',
        categoryLabelEn: 'SANDBOX POD',
        icon: '📁',
        pos: {
          orbit: [0, -3.6, 5.8],
          fortress: [0, -2.2, 4.8],
          board: [0, 0.6, 6.4],
        },
        color: 0x3b82f6,
        emissive: 0x2563eb,
        qps: 62,
        latencyMs: 3.4,
        status: 'ISOLATED',
        payloadPreview: 'modify: src/auth.ts (+14, -2 lines) • sha256: 7f8a9e',
        plainMeaningZh: '手脚执行舱 2：读写工作区代码文件，支持安全快照回退',
        plainMeaningEn: 'Safely modifies code files with rollback diff capabilities',
      },
      {
        id: 'feedback_dock',
        stage: 'feedback',
        nameZh: '观察反馈与反思回收港',
        nameEn: 'Observation & Feedback Dock',
        roleZh: '执行结果清洗、错误堆栈提取与 ReAct 自主闭环反思',
        roleEn: 'Output Sanitization & ReAct Deliberation Loopback',
        category: 'feedback',
        categoryLabelZh: '反思反馈回路',
        categoryLabelEn: 'FEEDBACK LOOP',
        icon: '🔄',
        pos: {
          orbit: [-6.8, -2.4, -2.5],
          fortress: [-5.8, -2.2, 3.2],
          board: [-7.2, 0.6, 4.8],
        },
        color: 0xec4899,
        emissive: 0xdb2777,
        qps: 58,
        latencyMs: 8.6,
        status: 'ACTIVE',
        payloadPreview: 'Obs: Test Suite Passed (24 tests OK) -> Trigger next deliberation',
        plainMeaningZh: '耳目反馈港：把工具执行输出打包回传给大模型，开启下一轮反思',
        plainMeaningEn: 'Packages tool output back into LLM memory for next turn',
      },
    ],
    [mode, isBlocked]
  );

  // References for Three.js Context
  const threeContextRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    coreGroup: THREE.Group;
    coreMesh: THREE.Mesh;
    shieldMesh: THREE.Mesh;
    gimbalRings: THREE.Mesh[];
    groundPlate: THREE.Mesh;
    gridHelper: THREE.GridHelper;
    stationMeshes: Map<string, { group: THREE.Group; mesh: THREE.Mesh; ring: THREE.Mesh; rotators: THREE.Object3D[] }>;
    conduitTubes: THREE.Mesh[];
    photonPackets: {
      mesh: THREE.Mesh;
      light: THREE.PointLight;
      curve: THREE.CatmullRomCurve3;
      progress: number;
      speed: number;
      color: number;
    }[];
    attackPacket: {
      mesh: THREE.Mesh;
      light: THREE.PointLight;
      curve: THREE.CatmullRomCurve3;
      progress: number;
    } | null;
    spherical: { radius: number; phi: number; theta: number };
    currentLookAt: THREE.Vector3;
    targetLookAt: THREE.Vector3;
    currentCamPos: THREE.Vector3;
    targetCamPos: THREE.Vector3;
    controls: {
      isDragging: boolean;
      prevMouse: { x: number; y: number };
    };
    isDestroyed: boolean;
    textures: {
      circuit: THREE.CanvasTexture;
      hex: THREE.CanvasTexture;
      bump: THREE.CanvasTexture;
    };
  } | null>(null);

  // Helper to get position based on active topology mode
  const getStationPosition = (st: StationInfo, type: TopologyType): [number, number, number] => {
    if (type === 'tiered-fortress') return st.pos.fortress;
    if (type === 'cyber-motherboard') return st.pos.board;
    return st.pos.orbit;
  };

  // Switch Camera Mode Handler
  const handleSwitchCameraMode = (newMode: CameraTrackingMode, targetStationId?: string) => {
    soundFx.playKeyClick();
    setCameraTrackingMode(newMode);
    const ctx = threeContextRef.current;
    if (!ctx) return;

    if (newMode === 'global') {
      // Global Overview: elevated cinematic panorama
      ctx.targetLookAt.set(0, 0, 0);
      ctx.spherical.radius = 21;
      ctx.spherical.phi = 1.05;
      setCamTrackTargetName(isZh ? '🌐 全局总览拓扑 (Global Overview)' : '🌐 Global Overview');
    } else if (newMode === 'track-active') {
      // Track active stage
      const activeSt = stations.find((s) => s.stage === activeStage) || stations[1];
      const pos = getStationPosition(activeSt, topologyType);
      ctx.targetLookAt.set(pos[0], pos[1], pos[2]);
      ctx.spherical.radius = 12;
      setCamTrackTargetName(`🎥 正在跟踪: [${isZh ? activeSt.nameZh : activeSt.nameEn}]`);
    } else if (newMode === 'focus-node' && targetStationId) {
      const st = stations.find((s) => s.id === targetStationId);
      if (st) {
        setSelectedStationId(st.id);
        const pos = getStationPosition(st, topologyType);
        ctx.targetLookAt.set(pos[0], pos[1], pos[2]);
        ctx.spherical.radius = 9;
        setCamTrackTargetName(`🎯 聚焦锁定: [${isZh ? st.nameZh : st.nameEn}]`);
      }
    } else if (newMode === 'free') {
      setCamTrackTargetName(isZh ? '🔄 自由 3D 漫游' : '🔄 Free Roam');
    }
  };

  // Initialize Three.js Scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 560;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020712, 0.024);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    const currentCamPos = new THREE.Vector3(0, 14, 20);
    const targetCamPos = new THREE.Vector3(0, 14, 20);
    camera.position.copy(currentCamPos);

    const currentLookAt = new THREE.Vector3(0, 0, 0);
    const targetLookAt = new THREE.Vector3(0, 0, 0);
    camera.lookAt(targetLookAt);

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    // Studio Environment reflection for physical PBR materials
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. Generate Procedural PBR Textures
    const circuitTexture = createCircuitBoardTexture();
    const hexTexture = createHexGridTexture();
    const bumpTexture = createCarbonBumpTexture();

    // 5. Rich Multi-Light Rig
    const ambientLight = new THREE.AmbientLight(0x0a192f, 1.4);
    scene.add(ambientLight);

    // Cyan Key light
    const keyLight = new THREE.DirectionalLight(0x00f0ff, 2.4);
    keyLight.position.set(15, 20, 15);
    scene.add(keyLight);

    // Violet Rim light
    const rimLight = new THREE.DirectionalLight(0xa855f7, 2.0);
    rimLight.position.set(-15, 12, -15);
    scene.add(rimLight);

    // Emerald bottom fill
    const fillLight = new THREE.DirectionalLight(0x10b981, 1.2);
    fillLight.position.set(0, -10, 8);
    scene.add(fillLight);

    // 6. Ground Platform: Brushed Cyber Motherboard Plate with Laser Grid
    const groundGeo = new THREE.CylinderGeometry(16, 16, 0.4, 64);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x030d1a,
      map: circuitTexture,
      bumpMap: bumpTexture,
      bumpScale: 0.08,
      metalness: 0.88,
      roughness: 0.22,
    });
    const groundPlate = new THREE.Mesh(groundGeo, groundMat);
    groundPlate.position.y = -4.0;
    scene.add(groundPlate);

    const gridHelper = new THREE.GridHelper(32, 32, 0x00f0ff, 0x0c2540);
    gridHelper.position.y = -3.78;
    gridHelper.material.opacity = 0.45;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);

    // Telemetry Concentric Rings on Ground
    [4.0, 8.5, 13.0].forEach((r) => {
      const ringGeo = new THREE.RingGeometry(r - 0.05, r + 0.05, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      ringMesh.position.y = -3.75;
      scene.add(ringMesh);
    });

    // 7. Central Cognitive Reactor: Multi-Shell Translucent Core
    const coreGroup = new THREE.Group();
    coreGroup.position.set(0, 0, 0);

    // Inner Crystalline Dodecahedron with Refractive Glass Material
    const coreGeo = new THREE.DodecahedronGeometry(1.3, 1);
    const coreMat = new THREE.MeshPhysicalMaterial({
      color: 0x00e5ff,
      emissive: 0x0088cc,
      emissiveIntensity: 0.9,
      roughness: 0.1,
      metalness: 0.2,
      transmission: 0.8,
      ior: 1.45,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreGroup.add(coreMesh);

    // Internal Core Glow Point Light
    const corePointLight = new THREE.PointLight(0x00f0ff, 3.5, 16);
    coreGroup.add(corePointLight);

    // Outer Geodesic Titanium Cage
    const cageGeo = new THREE.IcosahedronGeometry(1.65, 1);
    const cageMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      wireframe: true,
      metalness: 0.9,
      roughness: 0.1,
      transparent: true,
      opacity: 0.65,
    });
    const cageMesh = new THREE.Mesh(cageGeo, cageMat);
    coreGroup.add(cageMesh);

    // Dual Counter-Rotating Gimbal Rings with Laser Emitters
    const gimbalRings: THREE.Mesh[] = [];
    [2.0, 2.35].forEach((r, idx) => {
      const gGeo = new THREE.TorusGeometry(r, 0.045, 16, 64);
      const gMat = new THREE.MeshStandardMaterial({
        color: idx === 0 ? 0x00f0ff : 0xa855f7,
        emissive: idx === 0 ? 0x0099cc : 0x7c3aed,
        emissiveIntensity: 0.8,
        metalness: 0.95,
        roughness: 0.15,
        map: circuitTexture,
      });
      const gMesh = new THREE.Mesh(gGeo, gMat);
      gMesh.rotation.x = idx * 0.9;
      gMesh.rotation.y = idx * 0.6;
      coreGroup.add(gMesh);
      gimbalRings.push(gMesh);
    });

    scene.add(coreGroup);

    // 8. Zero-Trust Security Sentinel Forcefield Shield: Refractive Honeycomb Dome
    const shieldGeo = new THREE.SphereGeometry(3.0, 32, 32);
    const shieldMat = new THREE.MeshPhysicalMaterial({
      color: isBlocked ? 0xff0044 : 0x00f0ff,
      emissive: isBlocked ? 0xff0033 : 0x0088cc,
      emissiveIntensity: isBlocked ? 1.6 : 0.45,
      transparent: true,
      opacity: isBlocked ? 0.65 : 0.28,
      roughness: 0.15,
      metalness: 0.1,
      transmission: 0.75,
      ior: 1.4,
      alphaMap: hexTexture,
      side: THREE.DoubleSide,
    });
    const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    shieldMesh.position.set(0, 0, 0);
    scene.add(shieldMesh);

    // 9. Station Pods with Production-Grade Composite 4-8 Part Procedural Modules
    const stationMeshes = new Map<
      string,
      { group: THREE.Group; mesh: THREE.Mesh; ring: THREE.Mesh; rotators: THREE.Object3D[]; chartBoard?: THREE.Group }
    >();

    stations.forEach((st) => {
      const pos = getStationPosition(st, topologyType);
      const { group, primaryHitMesh, rotators, ring, chartBoard } = buildProductionStationModel(
        st,
        { circuit: circuitTexture, hex: hexTexture, bump: bumpTexture },
        isBlocked
      );
      group.position.set(pos[0], pos[1], pos[2]);
      scene.add(group);
      stationMeshes.set(st.id, { group, mesh: primaryHitMesh, ring, rotators, chartBoard });
    });

    // 10. Glowing Fiber-Optic Light Conduits & Dynamic Light Stream Pulses
    const conduitTubes: THREE.Mesh[] = [];
    const photonPackets: {
      mesh: THREE.Mesh;
      light: THREE.PointLight;
      curve: THREE.CatmullRomCurve3;
      progress: number;
      speed: number;
      color: number;
    }[] = [];

    const podConnections = [
      { from: 'prompt_deck', to: 'core', color: 0xa855f7 },
      { from: 'core', to: 'sentinel', color: 0x00f0ff },
      { from: 'core', to: 'mcp_hook', color: 0x06b6d4 },
      { from: 'sentinel', to: 'pod_cli', color: 0x10b981 },
      { from: 'sentinel', to: 'pod_fs', color: 0x3b82f6 },
      { from: 'mcp_hook', to: 'pod_cli', color: 0x06b6d4 },
      { from: 'pod_cli', to: 'feedback_dock', color: 0xec4899 },
      { from: 'pod_fs', to: 'feedback_dock', color: 0xec4899 },
      { from: 'feedback_dock', to: 'prompt_deck', color: 0xa855f7 },
    ];

    podConnections.forEach((conn) => {
      const fromSt = stations.find((s) => s.id === conn.from);
      const toSt = stations.find((s) => s.id === conn.to);
      if (!fromSt || !toSt) return;

      const p1 = new THREE.Vector3(...getStationPosition(fromSt, topologyType));
      const p2 = new THREE.Vector3(...getStationPosition(toSt, topologyType));
      const mid = new THREE.Vector3()
        .addVectors(p1, p2)
        .multiplyScalar(0.5)
        .add(new THREE.Vector3(0, 0.8, 0));

      const curve = new THREE.CatmullRomCurve3([p1, mid, p2]);
      const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.055, 8, false);

      // Translucent Fiber Optic Conduit Material
      const tubeMat = new THREE.MeshStandardMaterial({
        color: conn.color,
        emissive: conn.color,
        emissiveIntensity: 0.65,
        transparent: true,
        opacity: 0.5,
        roughness: 0.1,
        metalness: 0.4,
      });

      const tube = new THREE.Mesh(tubeGeo, tubeMat);
      scene.add(tube);
      conduitTubes.push(tube);

      // Glowing Photon Light Packet with Real Point Light
      const pGeo = new THREE.SphereGeometry(0.18, 16, 16);
      const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const pMesh = new THREE.Mesh(pGeo, pMat);

      const pLight = new THREE.PointLight(conn.color, 2.0, 4);
      pMesh.add(pLight);

      scene.add(pMesh);
      photonPackets.push({
        mesh: pMesh,
        light: pLight,
        curve,
        progress: Math.random(),
        speed: 0.35 + Math.random() * 0.25,
        color: conn.color,
      });
    });

    // Spherical Orbiting Controls
    const spherical = {
      radius: 20,
      phi: 1.1,
      theta: 0.4,
    };

    const controls = {
      isDragging: false,
      prevMouse: { x: 0, y: 0 },
    };

    const sceneCtx = {
      scene,
      camera,
      renderer,
      coreGroup,
      coreMesh,
      shieldMesh,
      gimbalRings,
      groundPlate,
      gridHelper,
      stationMeshes,
      conduitTubes,
      photonPackets,
      attackPacket: null,
      spherical,
      currentLookAt,
      targetLookAt,
      currentCamPos,
      targetCamPos,
      controls,
      isDestroyed: false,
      textures: {
        circuit: circuitTexture,
        hex: hexTexture,
        bump: bumpTexture,
      },
    };

    threeContextRef.current = sceneCtx;

    // Mouse Interaction for Dragging / Orbiting
    const domEl = renderer.domElement;

    const onMouseDown = (e: MouseEvent) => {
      controls.isDragging = true;
      controls.prevMouse = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!controls.isDragging) {
        const rect = domEl.getBoundingClientRect();
        const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);

        const meshesToTest: THREE.Mesh[] = [];
        stationMeshes.forEach((val) => meshesToTest.push(val.mesh));

        const intersects = raycaster.intersectObjects(meshesToTest);
        if (intersects.length > 0) {
          const hitStationId = intersects[0].object.userData.stationId;
          setHoveredStationId(hitStationId);
          domEl.style.cursor = 'pointer';
        } else {
          setHoveredStationId(null);
          domEl.style.cursor = 'grab';
        }
        return;
      }

      // If user drags, switch camera tracking to free roam
      if (cameraTrackingMode !== 'free') {
        setCameraTrackingMode('free');
        setCamTrackTargetName(isZh ? '🔄 自由 3D 漫游 (Free Orbit)' : '🔄 Free Orbit');
      }

      const dx = e.clientX - controls.prevMouse.x;
      const dy = e.clientY - controls.prevMouse.y;
      controls.prevMouse = { x: e.clientX, y: e.clientY };

      spherical.theta -= dx * 0.007;
      spherical.phi = Math.max(0.12, Math.min(Math.PI / 2 + 0.35, spherical.phi - dy * 0.007));
    };

    const onMouseUp = () => {
      controls.isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      spherical.radius = Math.max(6, Math.min(36, spherical.radius + e.deltaY * 0.015));
      setCamDistance(Math.round(spherical.radius));
    };

    const onClick = (e: MouseEvent) => {
      const rect = domEl.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);

      const meshesToTest: THREE.Mesh[] = [];
      stationMeshes.forEach((val) => meshesToTest.push(val.mesh));

      const intersects = raycaster.intersectObjects(meshesToTest);
      if (intersects.length > 0) {
        const hitStationId = intersects[0].object.userData.stationId;
        soundFx.playKeyClick();
        setSelectedStationId(hitStationId);
        handleSwitchCameraMode('focus-node', hitStationId);
        const hitStation = stations.find((s) => s.id === hitStationId);
        if (hitStation) {
          onSelectStage?.(hitStation.stage);
        }
      }
    };

    domEl.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    domEl.addEventListener('wheel', onWheel, { passive: false });
    domEl.addEventListener('click', onClick);

    // 11. Main Render & Camera Animation Loop
    let animId: number;
    let lastTime = performance.now();
    const tempProjVector = new THREE.Vector3();

    const animate = () => {
      if (sceneCtx.isDestroyed) return;

      const now = performance.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      // Auto-rotation in Global/Free mode when not dragging
      if (isAutoRotate && !controls.isDragging && cameraTrackingMode === 'global') {
        spherical.theta += 0.18 * delta;
      }

      // Smooth Camera Target Interpolation (Camera Tracking)
      currentLookAt.lerp(targetLookAt, 0.08);

      // Compute ideal camera position from spherical coords relative to targetLookAt
      const camX = currentLookAt.x + spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
      const camY = currentLookAt.y + spherical.radius * Math.cos(spherical.phi);
      const camZ = currentLookAt.z + spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);

      targetCamPos.set(camX, camY, camZ);
      camera.position.lerp(targetCamPos, 0.09);
      camera.lookAt(currentLookAt);

      // Rotations & Core Dynamics
      coreMesh.rotation.y += 0.015;
      coreMesh.rotation.x += 0.009;
      cageMesh.rotation.y -= 0.012;

      gimbalRings[0].rotation.z += 0.018;
      gimbalRings[1].rotation.x += 0.022;

      // Forcefield Shield Pulsing
      const pulseFactor = 1.0 + Math.sin(now * 0.004) * 0.04;
      shieldMesh.scale.set(pulseFactor, pulseFactor, pulseFactor);
      shieldMesh.rotation.y += 0.005;

      // Station Pods Bobbing, Orbit Ring Spin & Internal Component Rotators
      stationMeshes.forEach(({ group, ring, rotators, chartBoard }, stId) => {
        const isSel = selectedStationId === stId;
        const hover = hoveredStationId === stId;
        const st = stations.find((s) => s.id === stId);
        const targetScale = isSel ? 1.25 : hover ? 1.15 : 1.0;
        group.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);

        ring.rotation.z += 0.02;

        // Animate internal composite rotators (projector light beam)
        rotators?.forEach((rot, idx) => {
          rot.rotation.y += 0.018 * (idx % 2 === 0 ? 1 : -1);
          rot.rotation.z += 0.012;
        });

        // Glowing Chart Board: Smoothly pivot to face camera for optimal legibility
        if (chartBoard) {
          const dx = camera.position.x - group.position.x;
          const dz = camera.position.z - group.position.z;
          chartBoard.rotation.y = Math.atan2(dx, dz);
        }

        if (st) {
          const basePos = getStationPosition(st, topologyType);
          const bob = Math.sin(now * 0.003 + st.qps) * 0.08;
          group.position.y = basePos[1] + bob;
        }
      });

      // Advance Dynamic Light Stream Pulses
      photonPackets.forEach((pkt) => {
        pkt.progress += delta * pkt.speed * flowSpeed;
        if (pkt.progress > 1) pkt.progress = 0;
        const pt = pkt.curve.getPoint(pkt.progress);
        pkt.mesh.position.copy(pt);
      });

      // Render Scene
      renderer.render(scene, camera);

      // Project 3D station coordinates to 2D HTML Billboard Overlay
      const overlayEl = labelsOverlayRef.current;
      if (overlayEl) {
        stations.forEach((st) => {
          const podObj = stationMeshes.get(st.id);
          const badgeEl = overlayEl.querySelector(`[data-station-label="${st.id}"]`) as HTMLElement;
          if (podObj && badgeEl) {
            podObj.group.getWorldPosition(tempProjVector);
            tempProjVector.y += 1.45; // Float above the pod
            tempProjVector.project(camera);

            const isVisibleInFront = tempProjVector.z < 1;
            const x = (tempProjVector.x * 0.5 + 0.5) * width;
            const y = (-(tempProjVector.y * 0.5) + 0.5) * height;

            if (isVisibleInFront) {
              badgeEl.style.transform = `translate(-50%, -100%) translate(${x}px, ${y}px)`;
              badgeEl.style.opacity = '1';
              badgeEl.style.pointerEvents = 'auto';
            } else {
              badgeEl.style.opacity = '0';
              badgeEl.style.pointerEvents = 'none';
            }
          }
        });
      }

      animId = requestAnimationFrame(animate);
    };

    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      sceneCtx.isDestroyed = true;
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      domEl.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      domEl.removeEventListener('wheel', onWheel);
      domEl.removeEventListener('click', onClick);

      // Dispose Geometries and Materials
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material?.dispose();
          }
        }
      });
      circuitTexture.dispose();
      hexTexture.dispose();
      bumpTexture.dispose();
      renderer.dispose();
    };
  }, [topologyType, mode, isBlocked]);

  // Synchronize Camera Tracking when activeStage changes
  useEffect(() => {
    if (cameraTrackingMode === 'track-active') {
      const activeSt = stations.find((s) => s.stage === activeStage);
      if (activeSt && threeContextRef.current) {
        const pos = getStationPosition(activeSt, topologyType);
        threeContextRef.current.targetLookAt.set(pos[0], pos[1], pos[2]);
        setCamTrackTargetName(`🎥 正在跟踪: [${isZh ? activeSt.nameZh : activeSt.nameEn}]`);
      }
    }
  }, [activeStage, cameraTrackingMode, topologyType, stations, isZh]);

  // Escape key listener for fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Handle resize when toggling fullscreen
  useEffect(() => {
    const ctx = threeContextRef.current;
    const container = containerRef.current;
    if (ctx && container) {
      const timer = setTimeout(() => {
        const w = container.clientWidth || window.innerWidth;
        const h = container.clientHeight || window.innerHeight;
        ctx.camera.aspect = w / h;
        ctx.camera.updateProjectionMatrix();
        ctx.renderer.setSize(w, h);
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isFullscreen]);

  // Active Station Details
  const selectedStation = stations.find((s) => s.id === selectedStationId) || stations[1];

  return (
    <div className={`flex flex-col gap-3 font-sans transition-all duration-300 ${
      isFullscreen ? 'fixed inset-0 z-50 bg-[#02050f] p-2 sm:p-3 w-screen h-screen' : 'w-full'
    }`}>
      {/* 3D Scene Viewport Container */}
      <div className={`relative w-full rounded-2xl overflow-hidden border border-cyan-500/40 bg-[#020712] shadow-[0_0_35px_rgba(0,240,255,0.18)] flex flex-col ${
        isFullscreen ? 'h-full flex-1' : 'h-[640px]'
      }`}>
        {/* Three.js Canvas Element */}
        <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* 2D HTML Spatial Billboard Labels Overlay */}
        <div ref={labelsOverlayRef} className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
          {stations.map((st) => {
            const isSelected = selectedStationId === st.id;
            const isHovered = hoveredStationId === st.id;
            const isActiveStage = activeStage === st.stage;

            if (labelVisibility === 'none') return null;
            if (labelVisibility === 'focused' && !isSelected && !isActiveStage && !isHovered) return null;

            return (
              <div
                key={st.id}
                data-station-label={st.id}
                onClick={(e) => {
                  e.stopPropagation();
                  soundFx.playKeyClick();
                  setSelectedStationId(st.id);
                  handleSwitchCameraMode('focus-node', st.id);
                  onSelectStage?.(st.stage);
                }}
                className={`absolute transition-opacity duration-200 cursor-pointer select-none ${
                  isSelected
                    ? 'z-30 scale-105'
                    : isActiveStage
                    ? 'z-20 scale-100'
                    : 'z-10 opacity-80 hover:opacity-100 hover:scale-105'
                }`}
                style={{ willChange: 'transform' }}
              >
                {/* Luminous High-Tech Floating Marker */}
                <div
                  className={`flex flex-col items-center group ${
                    isSelected
                      ? 'drop-shadow-[0_0_15px_rgba(0,240,255,0.8)]'
                      : isActiveStage
                      ? 'drop-shadow-[0_0_12px_rgba(168,85,247,0.7)]'
                      : ''
                  }`}
                >
                  <div
                    className={`px-2.5 py-1.5 rounded-lg border backdrop-blur-md flex items-center gap-2 shadow-2xl transition-colors ${
                      isSelected
                        ? 'bg-black/95 border-cyan-400 text-white ring-2 ring-cyan-400/60 shadow-[0_0_20px_rgba(0,240,255,0.4)]'
                        : isActiveStage
                        ? 'bg-purple-950/90 border-purple-400 text-purple-200 ring-1 ring-purple-400/50'
                        : 'bg-black/80 border-slate-800 text-slate-300 hover:border-cyan-500/60'
                    }`}
                  >
                    <span className="text-base">{st.icon}</span>
                    <div className="flex flex-col text-left">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold tracking-wide">
                          {isZh ? st.nameZh : st.nameEn}
                        </span>
                        {isActiveStage && (
                          <span className="px-1 py-0.2 rounded text-[8px] font-mono bg-cyan-400 text-black font-extrabold animate-pulse">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] font-mono text-cyan-300/80">
                        {isZh ? st.categoryLabelZh : st.categoryLabelEn} • {st.latencyMs}ms
                      </span>
                    </div>
                  </div>

                  {/* Leader pin dot pointing down to 3D mesh */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-0.5 h-3 ${
                        isSelected ? 'bg-cyan-400' : isActiveStage ? 'bg-purple-400' : 'bg-slate-700'
                      }`}
                    />
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSelected
                          ? 'bg-cyan-400 shadow-[0_0_8px_#00f0ff]'
                          : isActiveStage
                          ? 'bg-purple-400 shadow-[0_0_8px_#a855f7]'
                          : 'bg-slate-600'
                      }`}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Top Control Bar: Camera Tracking Director + Topology Presets + Materials */}
        <div className="absolute top-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2.5 z-20 pointer-events-auto">
          {/* Left: Camera Tracking Director Toolbar */}
          <div className="flex items-center gap-1 bg-black/85 backdrop-blur-md border border-cyan-500/40 p-1.5 rounded-xl shadow-xl">
            <span className="text-[10px] font-mono font-bold text-cyan-400 px-2 flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5" />
              <span>{isZh ? '镜头运镜:' : 'CAMERA:'}</span>
            </span>

            {/* 1. Global Topology */}
            <button
              onClick={() => handleSwitchCameraMode('global')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition flex items-center gap-1 cursor-pointer ${
                cameraTrackingMode === 'global'
                  ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(0,240,255,0.6)] font-black'
                  : 'bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Globe className="w-3 h-3" />
              <span>{isZh ? '🌐 全局拓扑' : 'Global'}</span>
            </button>

            {/* 2. Track Active Stage */}
            <button
              onClick={() => handleSwitchCameraMode('track-active')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition flex items-center gap-1 cursor-pointer ${
                cameraTrackingMode === 'track-active'
                  ? 'bg-purple-500 text-white shadow-[0_0_12px_rgba(168,85,247,0.6)] font-black'
                  : 'bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Video className="w-3 h-3" />
              <span>{isZh ? '🎥 镜头跟踪' : 'Track Active'}</span>
            </button>

            {/* 3. Focus Core Brain */}
            <button
              onClick={() => handleSwitchCameraMode('focus-node', 'core')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition flex items-center gap-1 cursor-pointer ${
                cameraTrackingMode === 'focus-node' && selectedStationId === 'core'
                  ? 'bg-cyan-900 text-cyan-200 border border-cyan-400'
                  : 'bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Cpu className="w-3 h-3" />
              <span>{isZh ? '🧠 聚焦大脑' : 'Core'}</span>
            </button>

            {/* 4. Focus Sentinel */}
            <button
              onClick={() => handleSwitchCameraMode('focus-node', 'sentinel')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition flex items-center gap-1 cursor-pointer ${
                cameraTrackingMode === 'focus-node' && selectedStationId === 'sentinel'
                  ? 'bg-emerald-900 text-emerald-200 border border-emerald-400'
                  : 'bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Shield className="w-3 h-3" />
              <span>{isZh ? '🛡️ 聚焦哨卡' : 'Sentinel'}</span>
            </button>

            {/* 5. Free Roam Orbit */}
            <button
              onClick={() => handleSwitchCameraMode('free')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition flex items-center gap-1 cursor-pointer ${
                cameraTrackingMode === 'free'
                  ? 'bg-teal-900 text-teal-200 border border-teal-400'
                  : 'bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Compass className="w-3 h-3" />
              <span>{isZh ? '🔄 自由漫游' : 'Free'}</span>
            </button>
          </div>

          {/* Right: Topology Architecture Model + Material Shader Presets */}
          <div className="flex items-center gap-2">
            {/* Topology Geometry Switcher */}
            <div className="flex items-center gap-1 bg-black/85 backdrop-blur-md border border-slate-800 p-1 rounded-xl">
              <button
                onClick={() => {
                  soundFx.playKeyClick();
                  setTopologyType('orbit-reactor');
                }}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition cursor-pointer flex items-center gap-1 ${
                  topologyType === 'orbit-reactor'
                    ? 'bg-cyan-950 text-cyan-200 border border-cyan-400 shadow-[0_0_10px_rgba(0,240,255,0.3)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Orbit className="w-3 h-3" />
                <span>{isZh ? '环形反应堆' : 'Reactor Orbit'}</span>
              </button>

              <button
                onClick={() => {
                  soundFx.playKeyClick();
                  setTopologyType('cyber-motherboard');
                }}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition cursor-pointer flex items-center gap-1 ${
                  topologyType === 'cyber-motherboard'
                    ? 'bg-cyan-950 text-cyan-200 border border-cyan-400 shadow-[0_0_10px_rgba(0,240,255,0.3)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Cpu className="w-3 h-3" />
                <span>{isZh ? '母板平面' : 'Motherboard'}</span>
              </button>
            </div>

            {/* Label Visibility Toggle */}
            <div className="flex items-center bg-black/85 backdrop-blur-md border border-slate-800 p-1 rounded-xl text-[10px] font-mono">
              <button
                onClick={() => {
                  soundFx.playKeyClick();
                  setLabelVisibility((prev) => (prev === 'all' ? 'focused' : prev === 'focused' ? 'none' : 'all'));
                }}
                className="px-2 py-1 text-slate-300 hover:text-cyan-300 flex items-center gap-1 cursor-pointer font-bold"
              >
                <Tag className="w-3 h-3 text-cyan-400" />
                <span>
                  {labelVisibility === 'all'
                    ? isZh
                      ? '标签: 全部'
                      : 'Labels: All'
                    : labelVisibility === 'focused'
                    ? isZh
                      ? '标签: 聚焦'
                      : 'Labels: Focus'
                    : isZh
                    ? '标签: 隐藏'
                    : 'Labels: Off'}
                </span>
              </button>
            </div>

            {/* Architectural Explanation Toggle */}
            <button
              onClick={() => {
                soundFx.playKeyClick();
                setIsGuideOpen((prev) => !prev);
              }}
              className={`px-2.5 py-1.5 rounded-xl border text-[10px] font-mono font-bold transition flex items-center gap-1 cursor-pointer ${
                isGuideOpen
                  ? 'bg-amber-950/80 border-amber-400 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                  : 'bg-black/85 border-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>{isZh ? '架构通俗图解' : 'Architecture Guide'}</span>
            </button>

            {/* Fullscreen Display Toggle */}
            <button
              onClick={() => {
                soundFx.playKeyClick();
                setIsFullscreen((prev) => !prev);
              }}
              className={`px-2.5 py-1.5 rounded-xl border text-[10px] font-mono font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md ${
                isFullscreen
                  ? 'bg-cyan-500 text-black border-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.7)] font-black'
                  : 'bg-black/85 border-slate-800 text-slate-300 hover:text-white hover:border-cyan-500/60'
              }`}
              title={isZh ? '全屏沉浸显示 (ESC 退出)' : 'Fullscreen Toggle'}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>{isZh ? '退出全屏 (ESC)' : 'Exit (ESC)'}</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{isZh ? '全屏显示' : 'Fullscreen'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Bottom Left HUD: Camera Telemetry & Real-Time Target */}
        <div className="absolute bottom-3 left-3 z-20 pointer-events-none flex flex-col gap-1 text-[10px] font-mono">
          <div className="bg-black/90 backdrop-blur-md border border-cyan-900/60 px-3 py-1.5 rounded-xl text-cyan-300 flex items-center gap-2 shadow-xl">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span className="font-bold">{camTrackTargetName}</span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400">{isZh ? '视距:' : 'DIST:'} {camDistance}m</span>
            <span className="text-slate-500">|</span>
            <span className="text-emerald-400">{isZh ? 'PBR 光线追踪与微表面反射' : 'PBR Micro-surface ON'}</span>
          </div>
        </div>

        {/* Bottom Right HUD: Interactive Simulation Triggers */}
        <div className="absolute bottom-3 right-3 z-20 pointer-events-auto flex items-center gap-2">
          {/* Light Stream Pulse Trigger */}
          <button
            onClick={() => {
              soundFx.playKeyClick();
              onTriggerTrace?.();
            }}
            className="px-3 py-1.5 rounded-xl bg-cyan-950/90 hover:bg-cyan-900 text-cyan-200 border border-cyan-400 text-xs font-mono font-bold shadow-[0_0_15px_rgba(0,240,255,0.4)] transition cursor-pointer flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isZh ? '⚡ 激发光线流脉冲' : 'Pulse Beam'}</span>
          </button>

          {/* High-Risk Sentinel Block Trigger */}
          <button
            onClick={() => {
              soundFx.playAlert();
              onTriggerDenial?.();
            }}
            className="px-3 py-1.5 rounded-xl bg-rose-950/90 hover:bg-rose-900 text-rose-200 border border-rose-500 text-xs font-mono font-bold shadow-[0_0_15px_rgba(244,63,94,0.4)] transition cursor-pointer flex items-center gap-1.5"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>{isZh ? '🚨 模拟高危拦截' : 'Simulate Block'}</span>
          </button>

          {/* Auto Rotate Toggle */}
          <button
            onClick={() => {
              soundFx.playKeyClick();
              setIsAutoRotate((prev) => !prev);
            }}
            className="p-1.5 rounded-xl bg-black/80 hover:bg-black text-slate-300 hover:text-white border border-slate-800 text-xs font-mono transition cursor-pointer"
            title={isZh ? '自转开关' : 'Toggle Auto Rotation'}
          >
            <RefreshCw className={`w-4 h-4 ${isAutoRotate ? 'animate-spin-slow text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Selected Station Deep Details Bar */}
      <div className="bg-[#030a16] border border-cyan-900/60 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-black/80 border border-cyan-500/50 flex items-center justify-center text-xl shadow-inner">
            {selectedStation.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-white">
                {isZh ? selectedStation.nameZh : selectedStation.nameEn}
              </h4>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/50">
                {isZh ? selectedStation.categoryLabelZh : selectedStation.categoryLabelEn}
              </span>
              <span
                className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-extrabold border ${
                  selectedStation.status === 'BLOCKED'
                    ? 'bg-rose-950 text-rose-300 border-rose-500'
                    : 'bg-emerald-950 text-emerald-300 border-emerald-500'
                }`}
              >
                {selectedStation.status}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              💡 <span className="font-semibold text-cyan-200">
                {isZh ? selectedStation.plainMeaningZh : selectedStation.plainMeaningEn}
              </span>
            </p>
          </div>
        </div>

        {/* Telemetry Metrics & Drill-Down Action */}
        <div className="flex items-center gap-3 shrink-0 font-mono text-xs">
          <div className="bg-black/60 px-2.5 py-1.5 rounded-lg border border-slate-800 text-slate-300">
            <span className="text-[10px] text-slate-400 block">{isZh ? '吞吐 QPS' : 'QPS'}</span>
            <span className="font-bold text-cyan-400">{selectedStation.qps} req/s</span>
          </div>

          <div className="bg-black/60 px-2.5 py-1.5 rounded-lg border border-slate-800 text-slate-300">
            <span className="text-[10px] text-slate-400 block">{isZh ? '处理延时' : 'LATENCY'}</span>
            <span className="font-bold text-emerald-400">{selectedStation.latencyMs} ms</span>
          </div>

          <button
            onClick={() => {
              soundFx.playKeyClick();
              onOpenDrillDown?.(selectedStation.stage);
            }}
            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-black font-extrabold shadow-[0_0_12px_rgba(0,240,255,0.4)] transition cursor-pointer flex items-center gap-1.5"
          >
            <span>{isZh ? '🔍 深入黑盒解析' : 'Drill Down'}</span>
          </button>
        </div>
      </div>

      {/* Architecture Explainer Guide (Collapsible) */}
      {isGuideOpen && (
        <div className="bg-slate-950/95 border border-amber-500/40 rounded-xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3 border-b border-amber-900/40 pb-2">
            <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>{isZh ? '3D 真实拓扑设计含义与对照指南' : '3D Architecture Mapping Guide'}</span>
            </div>
            <button
              onClick={() => setIsGuideOpen(false)}
              className="text-slate-400 hover:text-white text-xs font-mono cursor-pointer"
            >
              {isZh ? '收起 ✕' : 'Close ✕'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="bg-black/60 p-3 rounded-lg border border-slate-800">
              <div className="text-cyan-400 font-bold mb-1 flex items-center gap-1.5">
                <span>🧠</span>
                <span>{isZh ? '1. 为什么是中心反应堆？' : '1. Central Reactor Core'}</span>
              </div>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                {isZh
                  ? '中心发光十二面体映射 Agent 的 LLM 推理引擎（如 Claude 3.7 / Codex），是所有注意力计算、思维链推理的发源地。'
                  : 'Represents the LLM attention reasoning engine where token computation happens.'}
              </p>
            </div>

            <div className="bg-black/60 p-3 rounded-lg border border-slate-800">
              <div className="text-emerald-400 font-bold mb-1 flex items-center gap-1.5">
                <span>🛡️</span>
                <span>{isZh ? '2. 为什么有全息蜂窝防护罩？' : '2. Zero-Trust Forcefield Shield'}</span>
              </div>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                {isZh
                  ? '半透明折射蜂窝力场映射「零信任权限哨兵与沙箱隔离屏障」。当 Agent 试图越权读取生产密钥时，力场即刻亮红阻断。'
                  : 'Refraction forcefield represents the zero-trust blast radius boundary locking down dangerous commands.'}
              </p>
            </div>

            <div className="bg-black/60 p-3 rounded-lg border border-slate-800">
              <div className="text-purple-400 font-bold mb-1 flex items-center gap-1.5">
                <span>⚡</span>
                <span>{isZh ? '3. 环绕轨道与数据光缆是什么？' : '3. Orbital Conduits & Packets'}</span>
              </div>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                {isZh
                  ? '环形轨道与发光光缆真实映射 ReAct 循环：Prompt 装配 ➔ LLM 推理 ➔ 权限裁决 ➔ 沙箱工具执行 ➔ 结果反馈回传。'
                  : 'The glowing conduit cables visualize the ReAct loop: Prompt -> LLM -> Gate -> Tool -> Feedback.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
