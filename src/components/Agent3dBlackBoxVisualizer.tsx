/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { BlackBoxStage, MatrixMode } from '../types/matrix';
import { Language } from '../i18n/translations';
import { soundFx } from '../utils/audio';

interface Agent3dBlackBoxVisualizerProps {
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

interface PipelineNodeDef {
  stage: BlackBoxStage;
  stepNum: number;
  labelEn: string;
  labelZh: string;
  icon: string;
  color: number;
  emissive: number;
  pos: THREE.Vector3;
  sublabelEn: string;
  sublabelZh: string;
}

export const Agent3dBlackBoxVisualizer: React.FC<Agent3dBlackBoxVisualizerProps> = ({
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewPreset, setViewPreset] = useState<'orbit' | 'pipeline' | 'hook' | 'shield'>('pipeline');
  const [isAutoFlow, setIsAutoFlow] = useState<boolean>(true);
  const [flowSpeed, setFlowSpeed] = useState<number>(1);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  // References to communicate with Three.js animation loop
  const sceneContextRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    coreMesh: THREE.Mesh;
    coreWire: THREE.Mesh;
    shieldMesh: THREE.Mesh;
    pipelineSpline: THREE.CatmullRomCurve3;
    packetMeshes: { mesh: THREE.Mesh; light: THREE.PointLight; offset: number; speed: number; color: number }[];
    nodeGroups: { stage: BlackBoxStage; group: THREE.Group; light: THREE.PointLight; ring: THREE.Mesh; stepNum: number }[];
    targetCamPos: THREE.Vector3;
    targetLookAt: THREE.Vector3;
    isDestroyed: boolean;
    triggerPulse: (type: 'trace' | 'block' | 'hook') => void;
  } | null>(null);

  // Define the 6 sequential nodes forming the orderly call chain
  const pipelineNodes: PipelineNodeDef[] = [
    {
      stage: 'prompt',
      stepNum: 1,
      labelEn: 'Step 01: Prompt Layer',
      labelZh: '步骤 01: 提示词编织层',
      icon: '🔮',
      color: 0xa855f7,
      emissive: 0x9333ea,
      pos: new THREE.Vector3(-5.2, 1.8, 1.2),
      sublabelEn: '4 Layers • 15.2k Tok',
      sublabelZh: '4 层分层 • 15.2k Token',
    },
    {
      stage: 'llm',
      stepNum: 2,
      labelEn: 'Step 02: Attention Core',
      labelZh: '步骤 02: 核心推理引擎',
      icon: '🧠',
      color: 0x38bdf8,
      emissive: 0x0284c7,
      pos: new THREE.Vector3(-2.2, 0.4, -1.2),
      sublabelEn: mode === 'claude' ? 'Claude 3.7 Opus' : 'Codex Engine',
      sublabelZh: mode === 'claude' ? 'Claude 3.7 推理' : 'Codex 引擎',
    },
    {
      stage: 'mcp_hook',
      stepNum: 3,
      labelEn: 'Step 03: MCP Hook Gate',
      labelZh: '步骤 03: MCP 协议拦截',
      icon: '🪝',
      color: 0x00f0ff,
      emissive: 0x00d4ff,
      pos: new THREE.Vector3(0.5, 2.0, 1.6),
      sublabelEn: 'PreToolUse AST Check',
      sublabelZh: '工具调用前置校验',
    },
    {
      stage: 'permission',
      stepNum: 4,
      labelEn: 'Step 04: Zero-Trust Guard',
      labelZh: '步骤 04: 零信任安全守门',
      icon: '🛡️',
      color: 0xf59e0b,
      emissive: 0xd97706,
      pos: new THREE.Vector3(2.8, -0.6, -1.4),
      sublabelEn: 'Least-Privilege Shield',
      sublabelZh: '最小权限与越权防御',
    },
    {
      stage: 'sandbox',
      stepNum: 5,
      labelEn: 'Step 05: Tool Sandbox',
      labelZh: '步骤 05: 隔离工具沙箱',
      icon: '📦',
      color: 0x10b981,
      emissive: 0x059669,
      pos: new THREE.Vector3(5.2, 1.4, 0.8),
      sublabelEn: 'Subshell Execution',
      sublabelZh: '隔离子进程执行',
    },
    {
      stage: 'feedback',
      stepNum: 6,
      labelEn: 'Step 06: Sanitizer & Stream',
      labelZh: '步骤 06: 脱敏审计回流',
      icon: '⚡',
      color: 0xec4899,
      emissive: 0xdb2777,
      pos: new THREE.Vector3(1.4, -2.4, 0.2),
      sublabelEn: 'State & Memory Commit',
      sublabelZh: '状态反思与记忆持久化',
    },
  ];

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 320;

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020409, 0.032);

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 100);
    camera.position.set(0, 4.5, 13.5);
    const targetCamPos = new THREE.Vector3(0, 4.5, 13.5);
    const targetLookAt = new THREE.Vector3(0, 0, 0);

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.replaceChildren(renderer.domElement);

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0x061526, 1.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x00f0ff, 1.6);
    dirLight.position.set(5, 14, 8);
    scene.add(dirLight);

    const purpleDirLight = new THREE.DirectionalLight(0xa855f7, 1.2);
    purpleDirLight.position.set(-8, -4, -6);
    scene.add(purpleDirLight);

    // 4. Central Hologram Core (LLM Neural Engine)
    const coreGeo = new THREE.IcosahedronGeometry(1.3, 2);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x051b30,
      emissive: 0x00e1ff,
      emissiveIntensity: 0.7,
      roughness: 0.15,
      metalness: 0.85,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    scene.add(coreMesh);

    // Outer wireframe core cage
    const wireGeo = new THREE.IcosahedronGeometry(1.5, 1);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.4,
    });
    const coreWire = new THREE.Mesh(wireGeo, wireMat);
    scene.add(coreWire);

    // 5. Zero-Trust Security Forcefield Shield
    const shieldGeo = new THREE.SphereGeometry(1.9, 24, 24);
    const shieldMat = new THREE.MeshStandardMaterial({
      color: isBlocked ? 0xff0055 : 0x00ff88,
      emissive: isBlocked ? 0xff0044 : 0x00e676,
      emissiveIntensity: isBlocked ? 1.5 : 0.35,
      transparent: true,
      opacity: isBlocked ? 0.6 : 0.18,
      wireframe: true,
    });
    const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    scene.add(shieldMesh);

    // 6. Sequential Calling Chain Pipeline Curve (Smooth 3D Spline Conduit)
    const splinePoints = pipelineNodes.map((n) => n.pos.clone());
    // Close the loop back through center/step 1
    splinePoints.push(new THREE.Vector3(-3.0, -1.0, 0.5));
    const pipelineSpline = new THREE.CatmullRomCurve3(splinePoints, true, 'centripetal', 0.5);

    // Render glowing translucent cyber tube conduit
    const tubeGeo = new THREE.TubeGeometry(pipelineSpline, 160, 0.05, 8, true);
    const tubeMat = new THREE.MeshStandardMaterial({
      color: 0x003366,
      emissive: 0x00d4ff,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.65,
      roughness: 0.3,
    });
    const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
    scene.add(tubeMesh);

    // Outer wire conduit
    const outerTubeGeo = new THREE.TubeGeometry(pipelineSpline, 90, 0.08, 6, true);
    const outerTubeMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.22,
    });
    const outerTubeMesh = new THREE.Mesh(outerTubeGeo, outerTubeMat);
    scene.add(outerTubeMesh);

    // 7. Render Sequential Nodes
    const nodeGroups: {
      stage: BlackBoxStage;
      group: THREE.Group;
      light: THREE.PointLight;
      ring: THREE.Mesh;
      stepNum: number;
    }[] = [];

    pipelineNodes.forEach((nodeDef) => {
      const group = new THREE.Group();
      group.position.copy(nodeDef.pos);

      // Octahedron core node
      const nodeGeo = new THREE.OctahedronGeometry(0.42);
      const nodeMat = new THREE.MeshStandardMaterial({
        color: nodeDef.color,
        emissive: nodeDef.emissive,
        emissiveIntensity: 0.85,
        metalness: 0.7,
        roughness: 0.2,
      });
      const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);
      group.add(nodeMesh);

      // Glowing pulse ring
      const ringGeo = new THREE.TorusGeometry(0.65, 0.025, 8, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: nodeDef.color,
        transparent: true,
        opacity: 0.75,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      group.add(ring);

      // Light beam
      const light = new THREE.PointLight(nodeDef.color, 1.4, 4.5);
      group.add(light);

      group.userData = {
        stage: nodeDef.stage,
        stepNum: nodeDef.stepNum,
        label: language === 'zh' ? nodeDef.labelZh : nodeDef.labelEn,
        icon: nodeDef.icon,
        sublabel: language === 'zh' ? nodeDef.sublabelZh : nodeDef.sublabelEn,
      };

      scene.add(group);
      nodeGroups.push({
        stage: nodeDef.stage,
        group,
        light,
        ring,
        stepNum: nodeDef.stepNum,
      });
    });

    // 8. Dynamic Luminous Data Packets Traveling Along the Spline Conduits (6 Photons)
    const packetMeshes: {
      mesh: THREE.Mesh;
      light: THREE.PointLight;
      offset: number;
      speed: number;
      color: number;
    }[] = [];

    const packetColors = [0xa855f7, 0x38bdf8, 0x00f0ff, 0xf59e0b, 0x10b981, 0xec4899];
    for (let i = 0; i < 6; i++) {
      const pGeo = new THREE.SphereGeometry(0.14, 12, 12);
      const pMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
      });
      const pMesh = new THREE.Mesh(pGeo, pMat);

      const pLight = new THREE.PointLight(packetColors[i], 2.2, 2.5);
      pMesh.add(pLight);

      // Trailing tail ring
      const tailGeo = new THREE.RingGeometry(0.1, 0.22, 16);
      const tailMat = new THREE.MeshBasicMaterial({
        color: packetColors[i],
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      });
      const tail = new THREE.Mesh(tailGeo, tailMat);
      pMesh.add(tail);

      scene.add(pMesh);
      packetMeshes.push({
        mesh: pMesh,
        light: pLight,
        offset: i / 6,
        speed: 0.08,
        color: packetColors[i],
      });
    }

    // 9. Floating Ambient Cyber Dust (400 particles)
    const particleCount = 400;
    const particleGeo = new THREE.BufferGeometry();
    const posArr = new Float32Array(particleCount * 3);
    const colArr = new Float32Array(particleCount * 3);
    const pCyan = new THREE.Color(0x00f0ff);
    const pPurp = new THREE.Color(0xa855f7);

    for (let i = 0; i < particleCount; i++) {
      posArr[i * 3] = (Math.random() - 0.5) * 16;
      posArr[i * 3 + 1] = (Math.random() - 0.5) * 10;
      posArr[i * 3 + 2] = (Math.random() - 0.5) * 12;

      const c = i % 2 === 0 ? pCyan : pPurp;
      colArr[i * 3] = c.r;
      colArr[i * 3 + 1] = c.g;
      colArr[i * 3 + 2] = c.b;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    const particleMat = new THREE.PointsMaterial({
      size: 0.045,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    const dustParticles = new THREE.Points(particleGeo, particleMat);
    scene.add(dustParticles);

    // 10. Pulse Reactions
    const triggerPulse = (type: 'trace' | 'block' | 'hook') => {
      if (type === 'block') {
        shieldMat.color.setHex(0xff0044);
        shieldMat.emissive.setHex(0xff0044);
        shieldMat.opacity = 0.85;
        shieldMat.emissiveIntensity = 2.4;
        setTimeout(() => {
          shieldMat.opacity = isBlocked ? 0.6 : 0.18;
          shieldMat.emissiveIntensity = 0.35;
        }, 1200);
      } else if (type === 'hook') {
        dirLight.intensity = 3.8;
        setTimeout(() => {
          dirLight.intensity = 1.6;
        }, 600);
      } else if (type === 'trace') {
        coreMat.emissiveIntensity = 2.5;
        tubeMat.emissiveIntensity = 1.6;
        setTimeout(() => {
          coreMat.emissiveIntensity = 0.7;
          tubeMat.emissiveIntensity = 0.6;
        }, 1400);
      }
    };

    sceneContextRef.current = {
      scene,
      camera,
      renderer,
      coreMesh,
      coreWire,
      shieldMesh,
      pipelineSpline,
      packetMeshes,
      nodeGroups,
      targetCamPos,
      targetLookAt,
      isDestroyed: false,
      triggerPulse,
    };

    // 11. Raycasting for hover / click
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onPointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      let found: string | null = null;
      for (const hit of intersects) {
        let parent = hit.object.parent;
        while (parent) {
          if (parent.userData && parent.userData.label) {
            found = `${parent.userData.icon} ${parent.userData.label} - ${parent.userData.sublabel}`;
            break;
          }
          parent = parent.parent;
        }
        if (found) break;
      }
      setHoveredNode(found);
    };

    const onClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      for (const hit of intersects) {
        let parent = hit.object.parent;
        while (parent) {
          if (parent.userData && parent.userData.stage) {
            const stg = parent.userData.stage as BlackBoxStage;
            if (onSelectStage) onSelectStage(stg);
            if (onOpenDrillDown) onOpenDrillDown(stg);
            soundFx.playKeyClick();
            return;
          }
          parent = parent.parent;
        }
      }
    };

    container.addEventListener('mousemove', onPointerMove);
    container.addEventListener('click', onClick);

    // 12. Animation Loop
    let clock = new THREE.Clock();
    let animId: number;

    const animate = () => {
      if (sceneContextRef.current?.isDestroyed) return;
      animId = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Smooth camera interpolation
      camera.position.lerp(targetCamPos, 0.05);
      camera.lookAt(targetLookAt);

      // Core rotation & breathe
      coreMesh.rotation.y += 0.3 * delta;
      coreMesh.rotation.x += 0.12 * delta;
      coreWire.rotation.y -= 0.2 * delta;
      coreWire.rotation.z += 0.15 * delta;

      const breath = 1 + Math.sin(elapsed * 2.8) * 0.04;
      coreMesh.scale.set(breath, breath, breath);

      // Shield rotation
      shieldMesh.rotation.y += 0.15 * delta;
      shieldMesh.rotation.x += 0.08 * delta;

      // Outer conduit rotation pulse
      outerTubeMesh.rotation.y += 0.02 * delta;

      // Animate Nodes (Subtle floating & ring spin)
      nodeGroups.forEach(({ group, ring, stepNum, stage }) => {
        ring.rotation.z += 1.2 * delta;
        ring.rotation.x += 0.6 * delta;

        // Floating offset
        const baseDef = pipelineNodes.find((p) => p.stage === stage);
        if (baseDef) {
          group.position.y = baseDef.pos.y + Math.sin(elapsed * 2 + stepNum) * 0.08;
        }

        // Highlight active step
        if (stage === activeStage) {
          ring.scale.set(1.2, 1.2, 1.2);
        } else {
          ring.scale.set(1.0, 1.0, 1.0);
        }
      });

      // Animate Dynamic Data Packets Streaming along the Spline Conduit (有动态数据流动)
      packetMeshes.forEach((packet, idx) => {
        if (isAutoFlow) {
          packet.offset = (packet.offset + packet.speed * flowSpeed * delta) % 1.0;
        }
        const point = pipelineSpline.getPointAt(packet.offset);
        if (point) {
          packet.mesh.position.copy(point);

          // Align packet tail with tangent of spline
          const tangent = pipelineSpline.getTangentAt(packet.offset);
          packet.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
        }
      });

      // Ambient dust drift
      dustParticles.rotation.y += 0.04 * delta;

      renderer.render(scene, camera);
    };

    animate();

    // 13. Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: newW, height: newH } = entry.contentRect;
        if (newW > 0 && newH > 0) {
          camera.aspect = newW / newH;
          camera.updateProjectionMatrix();
          renderer.setSize(newW, newH);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      if (sceneContextRef.current) {
        sceneContextRef.current.isDestroyed = true;
      }
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      container.removeEventListener('mousemove', onPointerMove);
      container.removeEventListener('click', onClick);

      coreGeo.dispose();
      coreMat.dispose();
      wireGeo.dispose();
      wireMat.dispose();
      shieldGeo.dispose();
      shieldMat.dispose();
      tubeGeo.dispose();
      tubeMat.dispose();
      outerTubeGeo.dispose();
      outerTubeMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      renderer.dispose();
    };
  }, [isBlocked, isAutoFlow, flowSpeed, activeStage, language, mode]);

  // Handle Preset Camera Views
  const setPreset = (preset: 'orbit' | 'pipeline' | 'hook' | 'shield') => {
    setViewPreset(preset);
    soundFx.playKeyClick();
    if (!sceneContextRef.current) return;

    if (preset === 'orbit') {
      sceneContextRef.current.targetCamPos.set(0, 7, 14.5);
      sceneContextRef.current.targetLookAt.set(0, 0, 0);
    } else if (preset === 'pipeline') {
      sceneContextRef.current.targetCamPos.set(0, 3.8, 12.8);
      sceneContextRef.current.targetLookAt.set(0, 0.2, 0);
    } else if (preset === 'hook') {
      sceneContextRef.current.targetCamPos.set(1.5, 3.2, 6.5);
      sceneContextRef.current.targetLookAt.set(0.5, 2.0, 1.6);
      if (onSelectStage) onSelectStage('mcp_hook');
    } else if (preset === 'shield') {
      sceneContextRef.current.targetCamPos.set(3.2, 0.5, 5.0);
      sceneContextRef.current.targetLookAt.set(2.8, -0.6, -1.4);
      if (onSelectStage) onSelectStage('permission');
    }
  };

  // Step through sequence manually
  const stepForward = () => {
    const nextStep = (currentStep % 6) + 1;
    setCurrentStep(nextStep);
    const targetNode = pipelineNodes[nextStep - 1];
    if (targetNode && onSelectStage) {
      onSelectStage(targetNode.stage);
    }
    soundFx.playChirp(700 + nextStep * 120);

    if (sceneContextRef.current) {
      sceneContextRef.current.targetLookAt.copy(targetNode.pos);
    }
  };

  const stepBackward = () => {
    const prevStep = currentStep === 1 ? 6 : currentStep - 1;
    setCurrentStep(prevStep);
    const targetNode = pipelineNodes[prevStep - 1];
    if (targetNode && onSelectStage) {
      onSelectStage(targetNode.stage);
    }
    soundFx.playChirp(600 + prevStep * 100);

    if (sceneContextRef.current) {
      sceneContextRef.current.targetLookAt.copy(targetNode.pos);
    }
  };

  return (
    <div className="bg-[#02050b]/95 border border-cyan-500/40 rounded-lg relative overflow-hidden flex flex-col shadow-[0_0_30px_rgba(0,240,255,0.12)] transition-all">
      {/* Top Cockpit Header: At-A-Glance Status & Quick Controls */}
      <div className="bg-gradient-to-r from-[#030a16]/95 via-[#041022]/95 to-[#02050b]/95 px-3 py-2 border-b border-cyan-800/40 flex flex-wrap items-center justify-between gap-2 z-20">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#00f0ff]" />
          <div className="flex items-center gap-1.5">
            <span className="text-cyan-300 font-bold text-xs tracking-wider font-mono flex items-center gap-1">
              <span>🌐</span> 3D AGENT CALL-CHAIN & DATA FLOW (THREE.JS)
            </span>
            <span className="px-1.5 py-0.2 rounded text-[9px] bg-cyan-950/80 text-cyan-300 border border-cyan-700/60 font-mono">
              ORDERLY PIPELINE
            </span>
          </div>

          {/* Real-time Stage Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/60 border border-cyan-900/60 font-mono text-[10px]">
            <span className="text-slate-400">STAGE:</span>
            <span className="text-cyan-300 font-bold">
              {pipelineNodes.find((p) => p.stage === activeStage)?.icon}{' '}
              {language === 'zh'
                ? pipelineNodes.find((p) => p.stage === activeStage)?.labelZh
                : pipelineNodes.find((p) => p.stage === activeStage)?.labelEn}
            </span>
          </div>
        </div>

        {/* Action & Preset View Controls */}
        <div className="flex items-center gap-1.5 font-mono text-[10px]">
          {/* Orderly Stepper Controls */}
          <div className="flex items-center gap-1 bg-black/70 px-1.5 py-0.5 rounded border border-cyan-900/60">
            <button
              onClick={stepBackward}
              className="px-1.5 py-0.5 rounded text-slate-300 hover:text-cyan-200 hover:bg-cyan-950 transition-colors"
              title="Previous Step"
            >
              ⏮
            </button>
            <button
              onClick={() => {
                setIsAutoFlow(!isAutoFlow);
                soundFx.playKeyClick();
              }}
              className={`px-2 py-0.5 rounded font-bold transition-all ${
                isAutoFlow
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50'
                  : 'bg-slate-800 text-slate-400'
              }`}
              title="Toggle Auto Flow"
            >
              {isAutoFlow ? '▶ FLOWING' : '⏸ PAUSED'}
            </button>
            <button
              onClick={stepForward}
              className="px-1.5 py-0.5 rounded text-slate-300 hover:text-cyan-200 hover:bg-cyan-950 transition-colors"
              title="Next Step"
            >
              ⏭
            </button>
            <select
              value={flowSpeed}
              onChange={(e) => setFlowSpeed(Number(e.target.value))}
              className="bg-transparent text-[9px] text-cyan-300 outline-none cursor-pointer border-l border-cyan-900/80 pl-1 ml-0.5"
            >
              <option value={0.5} className="bg-slate-900 text-slate-200">0.5x</option>
              <option value={1} className="bg-slate-900 text-slate-200">1.0x</option>
              <option value={2} className="bg-slate-900 text-slate-200">2.0x</option>
            </select>
          </div>

          {/* Camera Presets */}
          <div className="hidden md:flex items-center gap-1">
            {(
              [
                { key: 'pipeline', label: '调用链全景' },
                { key: 'hook', label: 'MCP 拦截点' },
                { key: 'shield', label: '安全防御' },
                { key: 'orbit', label: '自由轨道' },
              ] as const
            ).map((p) => (
              <button
                key={p.key}
                onClick={() => setPreset(p.key)}
                className={`px-2 py-0.5 rounded transition-all ${
                  viewPreset === p.key
                    ? 'bg-cyan-500 text-black font-bold shadow-[0_0_10px_#00f0ff]'
                    : 'bg-black/60 text-slate-300 hover:text-cyan-200 border border-slate-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Minimize / Expand Toggle */}
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="px-2 py-0.5 rounded bg-slate-900/80 text-slate-300 hover:text-cyan-200 border border-slate-800 text-[10px]"
          >
            {isMinimized ? '展开 3D ▼' : '折叠 ▲'}
          </button>
        </div>
      </div>

      {/* 3D WebGL Canvas Container */}
      {!isMinimized && (
        <div className="relative w-full h-[280px] sm:h-[320px] bg-[#02050b]">
          <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

          {/* Floating Hover Inspection Tooltip */}
          {hoveredNode && (
            <div className="absolute bottom-3 left-3 z-30 pointer-events-none px-2.5 py-1.5 rounded bg-black/90 border border-cyan-400 text-cyan-200 text-[11px] font-mono shadow-[0_0_15px_rgba(0,240,255,0.4)] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span>{hoveredNode}</span>
              <span className="text-[9px] text-slate-400 pl-1 border-l border-slate-700">点击下钻详情</span>
            </div>
          )}

          {/* Quick HUD legend on bottom-right */}
          <div className="absolute bottom-2.5 right-2.5 z-20 pointer-events-none hidden sm:flex items-center gap-2 text-[9px] font-mono text-slate-400 bg-black/75 px-2.5 py-1 rounded border border-cyan-900/60 backdrop-blur-sm">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" /> 01 Prompt
            </span>
            <span className="text-slate-600">➔</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" /> 02 LLM
            </span>
            <span className="text-slate-600">➔</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> 03 MCP Hook
            </span>
            <span className="text-slate-600">➔</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> 04 Zero-Trust
            </span>
            <span className="text-slate-600">➔</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> 05 Sandbox
            </span>
            <span className="text-slate-600">➔</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-pink-400" /> 06 Stream
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
