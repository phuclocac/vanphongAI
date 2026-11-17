import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  AGENTS,
  ASSISTANT_AGENT,
  HALL_AGENTS,
  getAgentProgressState,
  getAgentRoleForMode,
  resolveBeamLinkState,
  resolveJanitorTargetPlan,
  type AgentDefinition,
  type AgentId,
  type AgentStatus,
  type WorkModeId,
} from '../core/workModes';
import { escapeHtmlText } from '../services/openrouter';
import type { BurstTimers, CameraView, ErrorType } from '../types/office';

interface Office3DCanvasProps {
  mode: WorkModeId;
  statuses: Record<AgentId, AgentStatus>;
  outputs: Record<AgentId, string>;
  errorTypes: Record<AgentId, ErrorType>;
  errorLabels: Record<AgentId, string>;
  retryStatus: Record<AgentId, string>;
  agentStartedAt: Record<AgentId, number>;
  isRunning: boolean;
  runningAgents: AgentId[];
  burstTimers: BurstTimers;
  cameraView: CameraView;
  cameraResetVersion: number;
  sidebarCollapsed: boolean;
  cinemaMode: boolean;
  onFocusAgentSection: (agentId: AgentId) => void;
  onSelectCameraView: (view: CameraView) => void;
  onPlayClick: () => void;
  onElectricZap: () => void;
}

interface AgentRig {
  agent: AgentDefinition;
  root: THREE.Group;
  charGroup: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  floorRingGroup: THREE.Group;
  floorRing: THREE.Mesh;
  ringMat: THREE.MeshStandardMaterial;
  arcMat: THREE.MeshBasicMaterial;
  stripMat: THREE.MeshStandardMaterial;
  monitorScreenMat: THREE.MeshStandardMaterial;
  deskLight: THREE.PointLight | null;
  holoGroup: THREE.Group;
  holoFrameMat: THREE.MeshBasicMaterial;
  holoCoreBarMat: THREE.MeshBasicMaterial;
  holoNode: THREE.Mesh;
  doneBadgeGroup: THREE.Group;
  errorBadgeGroup: THREE.Group;
  labelEl: HTMLButtonElement;
  progressWrapEl: HTMLElement | null;
  progressArcEl: SVGCircleElement | null;
  progressPctEl: HTMLElement | null;
  progressStageEl: HTMLElement | null;
  cardEl: HTMLElement | null;
  nameEl: HTMLElement | null;
  subtitleEl: HTMLElement | null;
  badgeEl: HTMLElement | null;
}

interface LightningBolt {
  line: THREE.Line;
  arr: Float32Array;
  posAttr: THREE.BufferAttribute;
  mat: THREE.LineBasicMaterial;
}

const SLEEP_MOON_SVG =
  '<svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';

const RING_CIRCUMFERENCE = 2 * Math.PI * 14;

export function Office3DCanvas({
  mode,
  statuses,
  outputs,
  errorTypes,
  errorLabels,
  retryStatus,
  agentStartedAt,
  isRunning,
  runningAgents,
  burstTimers,
  cameraView,
  cameraResetVersion,
  sidebarCollapsed,
  cinemaMode,
  onFocusAgentSection,
  onSelectCameraView,
  onPlayClick,
  onElectricZap,
}: Office3DCanvasProps) {
  const sceneContainerRef = useRef<HTMLDivElement | null>(null);
  const labelsContainerRef = useRef<HTMLDivElement | null>(null);

  const liveStateRef = useRef({
    mode,
    statuses,
    outputs,
    errorTypes,
    errorLabels,
    retryStatus,
    agentStartedAt,
    isRunning,
    runningAgents,
    burstTimers,
    cameraView,
    sidebarCollapsed,
    cinemaMode,
  });

  liveStateRef.current = {
    mode,
    statuses,
    outputs,
    errorTypes,
    errorLabels,
    retryStatus,
    agentStartedAt,
    isRunning,
    runningAgents,
    burstTimers,
    cameraView,
    sidebarCollapsed,
    cinemaMode,
  };

  const callbacksRef = useRef({
    onFocusAgentSection,
    onSelectCameraView,
    onPlayClick,
    onElectricZap,
  });

  callbacksRef.current = {
    onFocusAgentSection,
    onSelectCameraView,
    onPlayClick,
    onElectricZap,
  };

  const syncDomRef = useRef<(() => void) | null>(null);
  const triggerCameraResetRef = useRef<((enable: boolean) => void) | null>(null);
  const didMountCamRef = useRef(false);

  // Mount WebGL + CSS2DRenderer scene once
  useEffect(() => {
    const sceneContainer = sceneContainerRef.current;
    const labelsContainer = labelsContainerRef.current;
    if (!sceneContainer || !labelsContainer) return;

    const isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    if (!isSoftwareGl) {
      document.documentElement.classList.add('has-hw-webgl');
    } else {
      document.documentElement.classList.remove('has-hw-webgl');
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090d16);
    scene.fog = new THREE.FogExp2(0x090d16, 0.013);

    const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.5, 140);
    const CAM_OPEN_POS = new THREE.Vector3(31.2, 23.0, 28.6);
    const CAM_OPEN_TARGET = new THREE.Vector3(1.85, 1.15, 0.25);
    const CAM_CENTER_POS = new THREE.Vector3(20.5, 16.5, 21.0);
    const CAM_CENTER_TARGET = new THREE.Vector3(-3.3, 0.75, 0);
    const CAM_DIRECTOR_POS = new THREE.Vector3(-3.2, 7.0, 9.2);
    const CAM_DIRECTOR_TARGET = new THREE.Vector3(-10.3, 1.15, 0.35);

    const getTargetCameraPreset = () => {
      const s = liveStateRef.current;
      if (s.cameraView === 'director') {
        const offsetX = !s.sidebarCollapsed && window.innerWidth >= 1024 ? 1.55 : 0;
        return {
          pos: CAM_DIRECTOR_POS,
          target: new THREE.Vector3(
            CAM_DIRECTOR_TARGET.x + offsetX,
            CAM_DIRECTOR_TARGET.y,
            CAM_DIRECTOR_TARGET.z
          ),
        };
      }
      const useShifted = !s.sidebarCollapsed && window.innerWidth >= 1024;
      return {
        pos: useShifted ? CAM_OPEN_POS : CAM_CENTER_POS,
        target: useShifted ? CAM_OPEN_TARGET : CAM_CENTER_TARGET,
      };
    };

    const initialPreset = getTargetCameraPreset();
    camera.position.copy(initialPreset.pos);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.14;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    sceneContainer.appendChild(renderer.domElement);

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    labelRenderer.domElement.style.left = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    labelsContainer.appendChild(labelRenderer.domElement);

    // Studio PMREM Reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(initialPreset.target);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 6.5;
    controls.maxDistance = 42;
    controls.minPolarAngle = 0.25;
    controls.maxPolarAngle = Math.PI * 0.45;
    controls.update();

    let cameraResetActive = false;
    let userDraggingOrbit = false;
    controls.addEventListener('start', () => {
      cameraResetActive = false;
      userDraggingOrbit = true;
    });
    controls.addEventListener('end', () => {
      userDraggingOrbit = false;
    });
    triggerCameraResetRef.current = (enable: boolean) => {
      cameraResetActive = enable;
    };

    // 3-Point Studio Lighting + Cyan/Violet Hall vs Amber-Gold Executive Contrast
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x1e1b4b, 0.96);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1dc, 2.05);
    keyLight.position.set(12, 19, 13);
    keyLight.target.position.set(-3.2, 0, 0);
    scene.add(keyLight.target);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 55;
    const d = 16.5;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x8b5cf6, 0.88);
    rimLight.position.set(-16, 9, -12);
    scene.add(rimLight);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    function createFloorGridTexture(): THREE.CanvasTexture {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, 512, 512);

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
      ctx.lineWidth = 2;
      for (let i = 0; i <= 512; i += 64) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 512);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(512, i);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(96, 165, 250, 0.22)';
      for (let x = 0; x <= 512; x += 64) {
        for (let y = 0; y <= 512; y += 64) {
          ctx.fillRect(x - 2, y - 2, 4, 4);
        }
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(4, 4);
      tex.anisotropy = maxAnisotropy;
      return tex;
    }

    function createMonitorTexture(agent: AgentDefinition): THREE.CanvasTexture {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 320;
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = '#070b14';
      ctx.fillRect(0, 0, 512, 320);

      ctx.fillStyle = agent.colorHex;
      ctx.globalAlpha = 0.22;
      ctx.fillRect(0, 0, 512, 42);
      ctx.globalAlpha = 1;

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(agent.name.toUpperCase(), 20, 28);

      if (agent.id === 'researcher') {
        ctx.strokeStyle = agent.colorHex;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(28, 250);
        ctx.lineTo(120, 195);
        ctx.lineTo(210, 215);
        ctx.lineTo(310, 130);
        ctx.lineTo(410, 145);
        ctx.lineTo(480, 82);
        ctx.stroke();
        ctx.fillStyle = 'rgba(59,130,246,0.22)';
        for (let i = 0; i < 4; i++) {
          ctx.fillRect(28 + i * 115, 62, 95, 24);
        }
      } else if (agent.id === 'quant') {
        for (let i = 0; i < 8; i++) {
          const h = 45 + ((i * 37) % 130);
          ctx.fillStyle = i % 2 === 0 ? '#10b981' : '#34d399';
          ctx.fillRect(36 + i * 56, 265 - h, 34, h);
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 2;
        ctx.strokeRect(24, 62, 464, 224);
      } else if (agent.id === 'strategist') {
        ctx.strokeStyle = '#a78bfa';
        ctx.lineWidth = 3;
        ctx.strokeRect(36, 70, 210, 100);
        ctx.strokeRect(266, 70, 210, 100);
        ctx.strokeRect(36, 185, 210, 100);
        ctx.strokeRect(266, 185, 210, 100);
        ctx.fillStyle = 'rgba(139,92,246,0.25)';
        ctx.fillRect(46, 82, 120, 16);
        ctx.fillRect(276, 82, 145, 16);
        ctx.fillRect(46, 197, 155, 16);
        ctx.fillRect(276, 197, 110, 16);
      } else if (agent.id === 'critic') {
        const widths = [340, 260, 390, 210];
        widths.forEach((w, idx) => {
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.fillRect(32, 76 + idx * 54, 448, 28);
          ctx.fillStyle = idx % 2 === 0 ? '#f97316' : '#ef4444';
          ctx.fillRect(32, 76 + idx * 54, w, 28);
        });
      } else {
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.7)';
        ctx.lineWidth = 3;
        ctx.strokeRect(28, 66, 456, 224);
        const rows = [
          { c: '#3b82f6', w: 320 },
          { c: '#10b981', w: 360 },
          { c: '#8b5cf6', w: 290 },
          { c: '#f97316', w: 340 },
        ];
        rows.forEach((r, idx) => {
          ctx.fillStyle = r.c;
          ctx.fillRect(46, 88 + idx * 46, 18, 22);
          ctx.fillStyle = 'rgba(251, 191, 36, 0.25)';
          ctx.fillRect(76, 88 + idx * 46, r.w, 22);
        });
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAnisotropy;
      return tex;
    }

    function createContactShadowTexture(): THREE.CanvasTexture {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
      grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.22)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }

    function createExecutiveMarbleTexture(): THREE.CanvasTexture {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#0f1119';
      ctx.fillRect(0, 0, 512, 512);

      ctx.strokeStyle = 'rgba(212, 175, 55, 0.16)';
      ctx.lineWidth = 2.2;
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        let x = (i * 73) % 512;
        let y = 0;
        ctx.moveTo(x, y);
        for (let s = 0; s < 6; s++) {
          x += (i % 2 === 0 ? 1 : -1) * 42 + ((s * 17) % 24);
          y += 92;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(248, 250, 252, 0.08)';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 40 + i * 85);
        ctx.bezierCurveTo(180, 10 + i * 80, 320, 90 + i * 75, 512, 35 + i * 82);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.14)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(1, 1, 254, 254);
      ctx.strokeRect(256, 1, 254, 254);
      ctx.strokeRect(1, 256, 254, 254);
      ctx.strokeRect(256, 256, 254, 254);

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(2, 3);
      tex.anisotropy = maxAnisotropy;
      return tex;
    }

    function createExecutiveRugTexture(): THREE.CanvasTexture {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#182032';
      ctx.fillRect(0, 0, 512, 512);

      for (let y = 0; y < 512; y += 4) {
        ctx.fillStyle = y % 8 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.08)';
        ctx.fillRect(0, y, 512, 2);
      }
      ctx.strokeStyle = 'rgba(217, 170, 74, 0.65)';
      ctx.lineWidth = 8;
      ctx.strokeRect(20, 20, 472, 472);
      ctx.strokeStyle = 'rgba(217, 170, 74, 0.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(36, 36, 440, 440);

      ctx.strokeStyle = 'rgba(245, 196, 95, 0.18)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(256, 120);
      ctx.lineTo(392, 256);
      ctx.lineTo(256, 392);
      ctx.lineTo(120, 256);
      ctx.closePath();
      ctx.stroke();

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAnisotropy;
      return tex;
    }

    function createExecutiveDashboardTexture(): THREE.CanvasTexture {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 256;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#070a12';
      ctx.fillRect(0, 0, 640, 256);

      ctx.fillStyle = 'rgba(245, 158, 11, 0.22)';
      ctx.fillRect(0, 0, 640, 40);
      ctx.fillStyle = '#fcd34d';
      ctx.font = 'bold 19px sans-serif';
      ctx.fillText('EXECUTIVE COMMAND · CEO PHÚC', 20, 27);

      const kpis = [
        { label: 'PORTFOLIO ROI', val: '+24.8%', color: '#10b981' },
        { label: 'CAPITAL INDEX', val: '1,482.5', color: '#fbbf24' },
        { label: 'AI COUNCIL', val: '4 ACTIVE', color: '#60a5fa' },
      ];
      kpis.forEach((k, i) => {
        const x = 20 + i * 204;
        ctx.fillStyle = 'rgba(30, 41, 59, 0.65)';
        ctx.fillRect(x, 54, 190, 62);
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.32)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, 54, 190, 62);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px sans-serif';
        ctx.fillText(k.label, x + 12, 74);
        ctx.fillStyle = k.color;
        ctx.font = 'bold 21px sans-serif';
        ctx.fillText(k.val, x + 12, 102);
      });

      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(26, 224);
      ctx.lineTo(120, 198);
      ctx.lineTo(220, 206);
      ctx.lineTo(340, 158);
      ctx.lineTo(465, 165);
      ctx.lineTo(612, 126);
      ctx.stroke();

      for (let i = 0; i < 14; i++) {
        const h = 18 + ((i * 23) % 48);
        ctx.fillStyle = i > 9 ? 'rgba(251, 191, 36, 0.35)' : 'rgba(59, 130, 246, 0.25)';
        ctx.fillRect(28 + i * 42, 236 - h, 24, h);
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAnisotropy;
      return tex;
    }

    function createExecutiveSignTexture(): THREE.CanvasTexture {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 192;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#0c101b';
      ctx.fillRect(0, 0, 640, 192);

      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 5;
      ctx.strokeRect(10, 10, 620, 172);
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.3)';
      ctx.lineWidth = 2;
      ctx.strokeRect(20, 20, 600, 152);

      ctx.fillStyle = '#fde68a';
      ctx.textAlign = 'center';
      ctx.font = 'bold 34px sans-serif';
      ctx.fillText('PHÒNG CEO · PHÚC', 320, 96);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '600 17px sans-serif';
      ctx.fillText('CHỦ TỊCH & ĐIỀU HÀNH CHIẾN LƯỢC', 320, 136);

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAnisotropy;
      return tex;
    }

    function createMacroWallScreenTexture(): THREE.CanvasTexture {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 256;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#060c18';
      ctx.fillRect(0, 0, 512, 256);

      ctx.fillStyle = 'rgba(59, 130, 246, 0.22)';
      ctx.fillRect(0, 0, 512, 36);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('MACRO ANALYTICS & COUNCIL TELEMETRY', 18, 24);

      const bars = [0.62, 0.78, 0.54, 0.88, 0.71, 0.94];
      bars.forEach((b, i) => {
        const h = b * 145;
        ctx.fillStyle = i % 2 === 0 ? '#3b82f6' : '#10b981';
        ctx.fillRect(28 + i * 76, 224 - h, 44, h);
      });
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(38, 175);
      ctx.lineTo(126, 132);
      ctx.lineTo(202, 148);
      ctx.lineTo(278, 95);
      ctx.lineTo(354, 112);
      ctx.lineTo(440, 68);
      ctx.stroke();

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAnisotropy;
      return tex;
    }

    function createOuterNeonGridTexture(): THREE.CanvasTexture {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#050811';
      ctx.fillRect(0, 0, 512, 512);
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.28)';
      ctx.lineWidth = 2;
      for (let i = 0; i <= 512; i += 64) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 512);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(512, i);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.16)';
      ctx.lineWidth = 1;
      for (let i = 32; i < 512; i += 64) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 512);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(512, i);
        ctx.stroke();
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(22, 22);
      tex.anisotropy = maxAnisotropy;
      return tex;
    }

    const contactShadowTex = createContactShadowTexture();
    const contactShadowMat = new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.75,
    });

    // Shared PBR Materials
    const floorMat = new THREE.MeshStandardMaterial({
      map: createFloorGridTexture(),
      color: 0xffffff,
      roughness: 0.72,
      metalness: 0.16,
    });
    const execMarbleMat = new THREE.MeshStandardMaterial({
      map: createExecutiveMarbleTexture(),
      color: 0xffffff,
      roughness: 0.28,
      metalness: 0.22,
    });
    const floorTrimMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.45,
      metalness: 0.65,
    });
    const brushedGoldMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.24,
      metalness: 0.9,
    });
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x131b2e,
      roughness: 0.85,
      metalness: 0.08,
    });
    const slatWoodMat = new THREE.MeshStandardMaterial({
      color: 0x3b2a20,
      roughness: 0.68,
      metalness: 0.05,
    });
    const walnutWoodMat = new THREE.MeshStandardMaterial({
      color: 0x2c1b12,
      roughness: 0.44,
      metalness: 0.1,
    });
    const deskWoodMat = new THREE.MeshStandardMaterial({
      color: 0x1e2536,
      roughness: 0.52,
      metalness: 0.15,
    });
    const brushedMetalMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.26,
      metalness: 0.86,
    });
    const chairFabricMat = new THREE.MeshStandardMaterial({
      color: 0x263147,
      roughness: 0.85,
      metalness: 0.05,
    });
    const execLeatherMat = new THREE.MeshStandardMaterial({
      color: 0x3c2419,
      roughness: 0.56,
      metalness: 0.08,
    });
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xf1c29b,
      roughness: 0.65,
      metalness: 0.02,
    });
    const hairDarkMat = new THREE.MeshStandardMaterial({
      color: 0x1e2433,
      roughness: 0.75,
      metalness: 0.05,
    });
    const shirtWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.8,
      metalness: 0.02,
    });

    /* -----------------------------------------------------------------------
     * 3A. ARCHITECTURAL OFFICE COMPOUND & UPGRADED DECOR
     * ----------------------------------------------------------------------- */
    const officeGroup = new THREE.Group();
    scene.add(officeGroup);

    const floorBase = new THREE.Mesh(new THREE.BoxGeometry(15.6, 0.45, 13.6), floorMat);
    floorBase.position.set(0, -0.225, 0);
    floorBase.receiveShadow = true;
    officeGroup.add(floorBase);

    const execFloorBase = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.69, 13.6), execMarbleMat);
    execFloorBase.position.set(-11.3, -0.105, 0);
    execFloorBase.receiveShadow = true;
    execFloorBase.castShadow = true;
    officeGroup.add(execFloorBase);

    const execTrimSouth = new THREE.Mesh(new THREE.BoxGeometry(7.06, 0.05, 0.08), brushedGoldMat);
    execTrimSouth.position.set(-11.3, 0.23, 6.8);
    officeGroup.add(execTrimSouth);

    const execTrimEastN = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 4.9), brushedGoldMat);
    execTrimEastN.position.set(-7.8, 0.23, -4.35);
    officeGroup.add(execTrimEastN);

    const execTrimEastS = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 4.9), brushedGoldMat);
    execTrimEastS.position.set(-7.8, 0.23, 4.35);
    officeGroup.add(execTrimEastS);

    const step1 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 3.6), execMarbleMat);
    step1.position.set(-7.58, 0.06, 0);
    step1.receiveShadow = true;
    officeGroup.add(step1);

    const step1Trim = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 3.62), brushedGoldMat);
    step1Trim.position.set(-7.37, 0.12, 0);
    officeGroup.add(step1Trim);

    const step2Trim = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 3.62), brushedGoldMat);
    step2Trim.position.set(-7.79, 0.24, 0);
    officeGroup.add(step2Trim);

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(23.1, 0.2, 14.1), floorTrimMat);
    plinth.position.set(-3.5, -0.37, 0);
    plinth.receiveShadow = true;
    officeGroup.add(plinth);

    const outerNeonGrid = new THREE.Mesh(
      new THREE.PlaneGeometry(110, 110),
      new THREE.MeshBasicMaterial({ map: createOuterNeonGridTexture() })
    );
    outerNeonGrid.rotation.x = -Math.PI / 2;
    outerNeonGrid.position.set(-3.5, -1.35, 0);
    officeGroup.add(outerNeonGrid);

    const hallLedCyanMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 1.45,
      roughness: 0.2,
    });
    const hallLedVioletMat = new THREE.MeshStandardMaterial({
      color: 0xa78bfa,
      emissive: 0x8b5cf6,
      emissiveIntensity: 1.35,
      roughness: 0.2,
    });
    const execLedAmberMat = new THREE.MeshStandardMaterial({
      color: 0xfcd34d,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.4,
      roughness: 0.2,
    });

    const floorStrips: Array<{
      pos: [number, number, number];
      size: [number, number, number];
      mat: THREE.MeshStandardMaterial;
    }> = [
      { pos: [0, 0.025, 6.72], size: [15.3, 0.035, 0.06], mat: hallLedCyanMat },
      { pos: [0, 0.025, -6.54], size: [15.3, 0.035, 0.06], mat: hallLedVioletMat },
      { pos: [7.72, 0.025, 0], size: [0.06, 0.035, 13.4], mat: hallLedCyanMat },
      { pos: [-11.3, 0.26, 6.72], size: [6.8, 0.035, 0.06], mat: execLedAmberMat },
      { pos: [-11.3, 0.26, -6.54], size: [6.8, 0.035, 0.06], mat: execLedAmberMat },
      { pos: [-14.52, 0.26, 0], size: [0.06, 0.035, 13.3], mat: execLedAmberMat },
    ];
    floorStrips.forEach((s) => {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(s.size[0], s.size[1], s.size[2]), s.mat);
      strip.position.set(s.pos[0], s.pos[1], s.pos[2]);
      officeGroup.add(strip);
    });

    const backWallNorthLeft = new THREE.Mesh(new THREE.BoxGeometry(15.2, 3.9, 0.24), wallMat);
    backWallNorthLeft.position.set(-7.2, 1.95, -6.68);
    backWallNorthLeft.receiveShadow = true;
    backWallNorthLeft.castShadow = true;
    officeGroup.add(backWallNorthLeft);

    const backWallWestNorth = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.9, 3.44), wallMat);
    backWallWestNorth.position.set(-14.68, 1.95, -5.08);
    backWallWestNorth.receiveShadow = true;
    officeGroup.add(backWallWestNorth);
    const backWallWestSouth = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.9, 2.64), wallMat);
    backWallWestSouth.position.set(-14.68, 1.95, 5.48);
    backWallWestSouth.receiveShadow = true;
    officeGroup.add(backWallWestSouth);
    const backWallWestBottom = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.98, 7.62), wallMat);
    backWallWestBottom.position.set(-14.68, 0.49, 0.4);
    backWallWestBottom.receiveShadow = true;
    officeGroup.add(backWallWestBottom);
    const backWallWestTop = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.5, 7.62), wallMat);
    backWallWestTop.position.set(-14.68, 3.65, 0.4);
    backWallWestTop.receiveShadow = true;
    officeGroup.add(backWallWestTop);

    const curtainGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x0ea5e9,
      roughness: 0.08,
      metalness: 0.18,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    });

    const northGlassBay = new THREE.Mesh(new THREE.BoxGeometry(7.35, 3.55, 0.05), curtainGlassMat);
    northGlassBay.position.set(4.08, 1.85, -6.66);
    officeGroup.add(northGlassBay);
    [0.45, 2.25, 4.08, 5.9, 7.72].forEach((mx) => {
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.85, 0.12), brushedMetalMat);
      mullion.position.set(mx, 1.92, -6.66);
      officeGroup.add(mullion);
    });
    const northGlassTopBeam = new THREE.Mesh(new THREE.BoxGeometry(7.45, 0.14, 0.18), brushedMetalMat);
    northGlassTopBeam.position.set(4.08, 3.82, -6.66);
    officeGroup.add(northGlassTopBeam);

    const eastGlassBay = new THREE.Mesh(new THREE.BoxGeometry(0.05, 3.55, 13.32), curtainGlassMat);
    eastGlassBay.position.set(7.75, 1.85, 0);
    officeGroup.add(eastGlassBay);
    [-6.66, -3.33, 0, 3.33, 6.66].forEach((mz) => {
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.85, 0.08), brushedMetalMat);
      mullion.position.set(7.75, 1.92, mz);
      officeGroup.add(mullion);
    });
    const eastGlassTopBeam = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 13.45), brushedMetalMat);
    eastGlassTopBeam.position.set(7.75, 3.82, 0);
    officeGroup.add(eastGlassTopBeam);

    const glassPartitionMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      roughness: 0.12,
      metalness: 0.15,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    });

    [-4.25, 4.25].forEach((zCenter) => {
      const glassPanel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.95, 4.5), glassPartitionMat);
      glassPanel.position.set(-7.8, 1.78, zCenter);
      officeGroup.add(glassPanel);

      const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 4.6), brushedGoldMat);
      topRail.position.set(-7.8, 3.26, zCenter);
      officeGroup.add(topRail);

      const botRail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 4.6), brushedGoldMat);
      botRail.position.set(-7.8, 0.28, zCenter);
      officeGroup.add(botRail);
    });

    [-6.5, -4.25, -1.9, 1.9, 4.25, 6.5].forEach((zPos) => {
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.1, 0.1), brushedGoldMat);
      mullion.position.set(-7.8, 1.8, zPos);
      mullion.castShadow = true;
      officeGroup.add(mullion);
    });
    const portalHeader = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 3.95), brushedGoldMat);
    portalHeader.position.set(-7.8, 3.28, 0);
    officeGroup.add(portalHeader);

    const slatCount = 22;
    const slatGeo = new THREE.BoxGeometry(0.14, 3.25, 0.08);
    const slatInst = new THREE.InstancedMesh(slatGeo, slatWoodMat, slatCount);
    const dummyObj = new THREE.Object3D();
    for (let i = 0; i < slatCount; i++) {
      dummyObj.position.set(-7.1 + i * 0.34, 1.88, -6.52);
      dummyObj.updateMatrix();
      slatInst.setMatrixAt(i, dummyObj.matrix);
    }
    slatInst.computeBoundingSphere();
    officeGroup.add(slatInst);

    const macroScreenFrame = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.8, 0.1), brushedMetalMat);
    macroScreenFrame.position.set(-3.4, 2.05, -6.48);
    officeGroup.add(macroScreenFrame);

    const macroScreenTex = createMacroWallScreenTexture();
    const macroScreenMat = new THREE.MeshStandardMaterial({
      map: macroScreenTex,
      emissiveMap: macroScreenTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.65,
      roughness: 0.2,
    });
    const macroScreen = new THREE.Mesh(new THREE.PlaneGeometry(3.26, 1.56), macroScreenMat);
    macroScreen.position.set(-3.4, 2.05, -6.42);
    officeGroup.add(macroScreen);

    const coveStripMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 1.05,
      roughness: 0.2,
    });
    const coveNorthHall = new THREE.Mesh(new THREE.BoxGeometry(15.2, 0.06, 0.06), coveStripMat);
    coveNorthHall.position.set(0, 3.72, -6.52);
    officeGroup.add(coveNorthHall);

    const coveGoldMat = new THREE.MeshStandardMaterial({
      color: 0xfde68a,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.15,
      roughness: 0.2,
    });
    const coveNorthExec = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.06, 0.06), coveGoldMat);
    coveNorthExec.position.set(-11.3, 3.72, -6.52);
    officeGroup.add(coveNorthExec);

    const coveWestExec = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 13.2), coveGoldMat);
    coveWestExec.position.set(-14.52, 3.72, 0);
    officeGroup.add(coveWestExec);

    // Server Monolith
    const serverGroup = new THREE.Group();
    serverGroup.position.set(6.95, 0, -5.65);
    officeGroup.add(serverGroup);

    const serverBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 2.25, 0.85),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35, metalness: 0.7 })
    );
    serverBody.position.y = 1.125;
    serverBody.castShadow = true;
    serverGroup.add(serverBody);

    const serverTrim = new THREE.Mesh(new THREE.BoxGeometry(0.89, 0.08, 0.89), brushedMetalMat);
    serverTrim.position.y = 2.26;
    serverGroup.add(serverTrim);

    for (let i = 0; i < 6; i++) {
      const led = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.03, 0.02),
        new THREE.MeshStandardMaterial({
          color: i % 2 === 0 ? 0x38bdf8 : 0x10b981,
          emissive: i % 2 === 0 ? 0x0ea5e9 : 0x10b981,
          emissiveIntensity: 1.2,
        })
      );
      led.position.set(0, 0.45 + i * 0.28, 0.43);
      serverGroup.add(led);
    }

    // Potted Plants
    const planterMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      roughness: 0.6,
      metalness: 0.2,
    });
    const soilMat = new THREE.MeshStandardMaterial({ color: 0x2b1e16, roughness: 0.95 });
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x4b3621, roughness: 0.85 });
    const leafPalette = [0x15803d, 0x16a34a, 0x22c55e, 0x166534].map(
      (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.52, metalness: 0.04 })
    );

    function buildPottedPlant(x: number, y: number, z: number, scale = 1, isGoldPot = false) {
      const pGroup = new THREE.Group();
      pGroup.position.set(x, y, z);
      pGroup.scale.setScalar(scale);
      officeGroup.add(pGroup);

      const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.24, 0.54, 16),
        isGoldPot ? brushedGoldMat : planterMat
      );
      pot.position.y = 0.27;
      pot.castShadow = true;
      pot.receiveShadow = true;
      pGroup.add(pot);

      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.025, 8, 20), brushedGoldMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.56;
      pGroup.add(rim);

      const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.285, 0.285, 0.04, 14), soilMat);
      soil.position.y = 0.545;
      soil.receiveShadow = true;
      pGroup.add(soil);

      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 0.72, 8), stemMat);
      trunk.position.y = 0.9;
      trunk.castShadow = true;
      pGroup.add(trunk);

      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI * 2) / 8 + (i % 2) * 0.22;
        const height = 0.85 + (i % 3) * 0.24;
        const leaf = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.18, 0),
          leafPalette[i % leafPalette.length]
        );
        leaf.scale.set(1.35, 0.35, 0.85);
        leaf.position.set(Math.cos(angle) * 0.24, height, Math.sin(angle) * 0.24);
        leaf.rotation.set(0.32, -angle, 0.25);
        leaf.castShadow = true;
        pGroup.add(leaf);
      }
    }

    buildPottedPlant(-6.9, 0, -5.8, 1.05, false);
    buildPottedPlant(6.95, 0, 5.85, 1.15, false);
    buildPottedPlant(-7.1, 0, 2.35, 0.9, true);
    buildPottedPlant(-7.1, 0, -2.35, 0.9, true);
    buildPottedPlant(-14.0, 0.24, 5.9, 1.15, true);
    buildPottedPlant(-8.55, 0.24, -5.9, 0.95, true);

    /* -----------------------------------------------------------------------
     * 3B. CENTRAL MEETING TABLE (BÀN HỌP TRUNG TÂM)
     * ----------------------------------------------------------------------- */
    const meetingGroup = new THREE.Group();
    meetingGroup.position.set(0, 0, 0);
    officeGroup.add(meetingGroup);

    const centerShadow = new THREE.Mesh(new THREE.CircleGeometry(2.6, 32), contactShadowMat);
    centerShadow.rotation.x = -Math.PI / 2;
    centerShadow.position.y = 0.015;
    meetingGroup.add(centerShadow);

    const pedBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 1.25, 0.14, 24),
      brushedMetalMat
    );
    pedBase.position.y = 0.07;
    pedBase.castShadow = true;
    pedBase.receiveShadow = true;
    meetingGroup.add(pedBase);

    const pedCol = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.52, 0.68, 20),
      deskWoodMat
    );
    pedCol.position.y = 0.48;
    pedCol.castShadow = true;
    meetingGroup.add(pedCol);

    const tableTop = new THREE.Mesh(
      new THREE.CylinderGeometry(1.95, 1.9, 0.1, 32),
      deskWoodMat
    );
    tableTop.position.y = 0.86;
    tableTop.castShadow = true;
    tableTop.receiveShadow = true;
    meetingGroup.add(tableTop);

    const tableGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x1e3a5f,
      roughness: 0.12,
      metalness: 0.15,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.85,
    });
    const tableInlay = new THREE.Mesh(
      new THREE.CylinderGeometry(1.32, 1.32, 0.04, 32),
      tableGlassMat
    );
    tableInlay.position.y = 0.91;
    meetingGroup.add(tableInlay);

    const holoRingMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.1,
      roughness: 0.2,
      metalness: 0.8,
    });
    const holoRing = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.025, 12, 36), holoRingMat);
    holoRing.rotation.x = Math.PI / 2;
    holoRing.position.y = 1.05;
    meetingGroup.add(holoRing);

    const holoCoreMat = new THREE.MeshStandardMaterial({
      color: 0x60a5fa,
      emissive: 0x3b82f6,
      emissiveIntensity: 1.3,
      roughness: 0.15,
      metalness: 0.6,
      wireframe: true,
    });
    const holoCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), holoCoreMat);
    holoCore.position.y = 1.24;
    meetingGroup.add(holoCore);

    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2 + Math.PI / 4;
      const chair = new THREE.Group();
      chair.position.set(Math.cos(angle) * 2.35, 0, Math.sin(angle) * 2.35);
      chair.rotation.y = -angle + Math.PI / 2;

      const cBase = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.05, 16), brushedMetalMat);
      cBase.position.y = 0.025;
      chair.add(cBase);

      const cStem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.44, 10), brushedMetalMat);
      cStem.position.y = 0.25;
      chair.add(cStem);

      const cSeat = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.24, 0.08, 16), chairFabricMat);
      cSeat.position.y = 0.48;
      cSeat.castShadow = true;
      chair.add(cSeat);

      const cBack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.07), chairFabricMat);
      cBack.position.set(0, 0.68, -0.2);
      cBack.castShadow = true;
      chair.add(cBack);

      meetingGroup.add(chair);
    }

    /* -----------------------------------------------------------------------
     * 3C. 5 AGENT WORKSTATIONS & STYLIZED CHARACTERS
     * ----------------------------------------------------------------------- */
    const agentRigMap = new Map<AgentId, AgentRig>();
    const clickableDesks: THREE.Object3D[] = [];

    function buildWorkstation(agent: AgentDefinition) {
      const isExecAssistant = agent.id === 'assistant';
      const root = new THREE.Group();
      root.position.set(agent.position[0], agent.position[1] || 0, agent.position[2]);
      root.rotation.y = agent.facingAngle;
      if (isExecAssistant) {
        root.scale.setScalar(0.78);
      }
      officeGroup.add(root);

      const shadowDisc = new THREE.Mesh(new THREE.CircleGeometry(2.1, 28), contactShadowMat);
      shadowDisc.rotation.x = -Math.PI / 2;
      shadowDisc.position.set(0, 0.015, 0.15);
      root.add(shadowDisc);

      const floorRingGroup = new THREE.Group();
      floorRingGroup.position.set(0, 0.025, 0.15);
      root.add(floorRingGroup);

      const ringMat = new THREE.MeshStandardMaterial({
        color: agent.colorInt,
        emissive: agent.colorInt,
        emissiveIntensity: 0.45,
        roughness: 0.28,
        transparent: true,
        opacity: 0.45,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      const floorRing = new THREE.Mesh(new THREE.RingGeometry(1.56, 1.66, 48), ringMat);
      floorRing.rotation.x = -Math.PI / 2;
      floorRingGroup.add(floorRing);

      const arcMat = new THREE.MeshBasicMaterial({
        color: agent.colorInt,
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
      });
      [0, Math.PI].forEach((startTheta) => {
        const segArc = new THREE.Mesh(
          new THREE.RingGeometry(1.4, 1.47, 20, 1, startTheta, Math.PI * 0.65),
          arcMat
        );
        segArc.rotation.x = -Math.PI / 2;
        segArc.position.y = 0.004;
        floorRingGroup.add(segArc);
      });
      for (let t = 0; t < 4; t++) {
        const ang = (t * Math.PI) / 2;
        const tickMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.22), arcMat);
        tickMesh.rotation.x = -Math.PI / 2;
        tickMesh.rotation.z = -ang;
        tickMesh.position.set(Math.sin(ang) * 1.72, 0.005, Math.cos(ang) * 1.72);
        floorRingGroup.add(tickMesh);
      }

      const deskGroup = new THREE.Group();
      root.add(deskGroup);

      const deskTop = new THREE.Mesh(
        new THREE.BoxGeometry(2.35, 0.09, 1.1),
        isExecAssistant ? walnutWoodMat : deskWoodMat
      );
      deskTop.position.set(0, 0.82, -0.25);
      deskTop.castShadow = true;
      deskTop.receiveShadow = true;
      deskGroup.add(deskTop);

      const stripMat = new THREE.MeshStandardMaterial({
        color: agent.colorInt,
        emissive: agent.colorInt,
        emissiveIntensity: 0.55,
        roughness: 0.25,
      });
      const deskStrip = new THREE.Mesh(new THREE.BoxGeometry(2.37, 0.03, 0.03), stripMat);
      deskStrip.position.set(0, 0.82, 0.31);
      deskGroup.add(deskStrip);

      const legGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.8, 10);
      const legMat = isExecAssistant ? brushedGoldMat : brushedMetalMat;
      const legPositions: Array<[number, number, number]> = [
        [-1.06, 0.4, -0.72],
        [1.06, 0.4, -0.72],
        [-1.06, 0.4, 0.22],
        [1.06, 0.4, 0.22],
      ];
      legPositions.forEach(([lx, ly, lz]) => {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(lx, ly, lz);
        leg.castShadow = true;
        deskGroup.add(leg);
      });

      const monitorStand = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.26, 0.1), legMat);
      monitorStand.position.set(0, 0.99, -0.56);
      deskGroup.add(monitorStand);

      const monitorBezel = new THREE.Mesh(
        new THREE.BoxGeometry(1.18, 0.68, 0.05),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35, metalness: 0.6 })
      );
      monitorBezel.position.set(0, 1.34, -0.52);
      monitorBezel.castShadow = true;
      deskGroup.add(monitorBezel);

      const monTex = createMonitorTexture(agent);
      const monitorScreenMat = new THREE.MeshStandardMaterial({
        map: monTex,
        emissiveMap: monTex,
        emissive: 0xffffff,
        emissiveIntensity: 0.55,
        roughness: 0.18,
        metalness: 0.1,
      });
      const monitorScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.6), monitorScreenMat);
      monitorScreen.position.set(0, 1.34, -0.492);
      deskGroup.add(monitorScreen);

      const keyboard = new THREE.Mesh(
        new THREE.BoxGeometry(0.56, 0.025, 0.2),
        new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.4 })
      );
      keyboard.position.set(0, 0.88, -0.08);
      deskGroup.add(keyboard);

      const mug = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.048, 0.11, 12),
        new THREE.MeshStandardMaterial({ color: agent.colorInt, roughness: 0.35, metalness: 0.1 })
      );
      mug.position.set(0.76, 0.92, -0.1);
      deskGroup.add(mug);

      const chairGroup = new THREE.Group();
      chairGroup.position.set(0, 0, 0.62);
      root.add(chairGroup);

      const chairBase = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.05, 16), legMat);
      chairBase.position.y = 0.03;
      chairGroup.add(chairBase);

      const chairStem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.45, 10), legMat);
      chairStem.position.y = 0.26;
      chairGroup.add(chairStem);

      const chairSeat = new THREE.Mesh(
        new THREE.BoxGeometry(0.56, 0.09, 0.52),
        isExecAssistant ? execLeatherMat : chairFabricMat
      );
      chairSeat.position.y = 0.5;
      chairSeat.castShadow = true;
      chairGroup.add(chairSeat);

      const chairBack = new THREE.Mesh(
        new THREE.BoxGeometry(0.52, 0.62, 0.09),
        isExecAssistant ? execLeatherMat : chairFabricMat
      );
      chairBack.position.set(0, 0.82, 0.24);
      chairBack.castShadow = true;
      chairGroup.add(chairBack);

      const charGroup = new THREE.Group();
      charGroup.position.set(0, 0.55, 0.54);
      root.add(charGroup);

      const blazerMat = new THREE.MeshStandardMaterial({
        color: agent.colorInt,
        roughness: 0.48,
        metalness: 0.14,
      });
      const blazerTrimMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.55,
        metalness: 0.2,
      });
      const tieGlowMat = new THREE.MeshStandardMaterial({
        color: agent.colorInt,
        emissive: agent.colorInt,
        emissiveIntensity: 0.45,
        roughness: 0.25,
      });

      const hips = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.28), blazerTrimMat);
      hips.position.set(0, 0.04, -0.02);
      charGroup.add(hips);
      [-0.11, 0.11].forEach((lx) => {
        const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.2, 4, 8), blazerTrimMat);
        thigh.rotation.x = Math.PI / 2;
        thigh.position.set(lx, 0.04, -0.18);
        charGroup.add(thigh);
      });

      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.185, 0.48, 12), blazerMat);
      torso.scale.set(1.02, 1, 0.62);
      torso.position.y = 0.29;
      torso.castShadow = true;
      charGroup.add(torso);

      const shirtV = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.04, 0.24, 8), shirtWhiteMat);
      shirtV.scale.set(1, 1, 0.55);
      shirtV.position.set(0, 0.42, -0.105);
      charGroup.add(shirtV);

      const tie = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.22, 0.03), tieGlowMat);
      tie.position.set(0, 0.34, -0.138);
      charGroup.add(tie);

      [-0.23, 0.23].forEach((sx) => {
        const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.078, 10, 8), blazerMat);
        shoulder.position.set(sx, 0.47, -0.01);
        charGroup.add(shoulder);
      });
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.078, 0.1, 10), skinMat);
      neck.position.set(0, 0.56, 0);
      charGroup.add(neck);

      const headGroup = new THREE.Group();
      headGroup.position.set(0, 0.72, 0);
      charGroup.add(headGroup);

      const headMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.145, 0.085, 6, 12), skinMat);
      headMesh.scale.set(1.04, 1.0, 0.96);
      headMesh.castShadow = true;
      headGroup.add(headMesh);

      const hairCrown = new THREE.Mesh(
        new THREE.SphereGeometry(0.162, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.56),
        hairDarkMat
      );
      hairCrown.position.set(0, 0.045, 0.015);
      hairCrown.scale.set(1.04, 0.92, 1.02);
      hairCrown.castShadow = true;
      headGroup.add(hairCrown);

      if (agent.id === 'researcher' || agent.id === 'strategist') {
        const frontSweep = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.065, 0.12), hairDarkMat);
        frontSweep.position.set(0.02, 0.14, -0.075);
        frontSweep.rotation.z = agent.id === 'researcher' ? 0.14 : -0.14;
        headGroup.add(frontSweep);
      } else {
        const backCut = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.13, 0.1), hairDarkMat);
        backCut.position.set(0, 0.01, 0.11);
        headGroup.add(backCut);
      }

      const visorMat =
        agent.id === 'quant' || agent.id === 'critic' || isExecAssistant
          ? new THREE.MeshStandardMaterial({
              color: 0x0f172a,
              emissive: agent.colorInt,
              emissiveIntensity: 0.42,
              roughness: 0.15,
              metalness: 0.7,
            })
          : blazerTrimMat;
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.048, 0.035), visorMat);
      visor.position.set(0, 0.015, -0.152);
      headGroup.add(visor);

      const earpiece = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), tieGlowMat);
      earpiece.position.set(0.155, -0.01, 0);
      headGroup.add(earpiece);

      function createArticulatedArm(sideSign: number): THREE.Group {
        const armPivot = new THREE.Group();
        armPivot.position.set(sideSign * 0.255, 0.45, -0.01);
        const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.16, 4, 8), blazerMat);
        upper.position.set(0, -0.1, 0);
        upper.castShadow = true;
        armPivot.add(upper);

        const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.15, 4, 8), blazerMat);
        forearm.position.set(-sideSign * 0.02, -0.22, -0.075);
        forearm.rotation.x = Math.PI * 0.34;
        forearm.castShadow = true;
        armPivot.add(forearm);

        const hand = new THREE.Mesh(new THREE.SphereGeometry(0.044, 8, 8), skinMat);
        hand.position.set(-sideSign * 0.03, -0.25, -0.165);
        armPivot.add(hand);

        armPivot.rotation.x = Math.PI * 0.14;
        return armPivot;
      }
      const leftArm = createArticulatedArm(-1);
      const rightArm = createArticulatedArm(1);
      charGroup.add(leftArm);
      charGroup.add(rightArm);

      const holoGroup = new THREE.Group();
      holoGroup.position.set(0, 1.98, -0.45);
      holoGroup.visible = false;
      deskGroup.add(holoGroup);

      const holoFrameMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        wireframe: true,
        transparent: true,
        opacity: 0.85,
      });
      const holoFrame = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.42, 0.04), holoFrameMat);
      holoGroup.add(holoFrame);

      const holoCoreBarMat = new THREE.MeshBasicMaterial({
        color: agent.colorInt,
        transparent: true,
        opacity: 0.72,
      });
      for (let b = 0; b < 3; b++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.55 - b * 0.12, 0.045, 0.02), holoCoreBarMat);
        bar.position.set(-0.08, 0.09 - b * 0.09, 0.03);
        holoGroup.add(bar);
      }
      const holoNode = new THREE.Mesh(new THREE.OctahedronGeometry(0.085, 0), holoFrameMat);
      holoNode.position.set(0.3, 0.02, 0.04);
      holoGroup.add(holoNode);

      const doneBadgeGroup = new THREE.Group();
      doneBadgeGroup.position.set(0, 2.02, -0.35);
      doneBadgeGroup.visible = false;
      deskGroup.add(doneBadgeGroup);

      const emeraldGlowMat = new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x10b981,
        emissiveIntensity: 1.3,
        roughness: 0.2,
      });
      const doneRing = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.024, 10, 28), emeraldGlowMat);
      doneBadgeGroup.add(doneRing);
      const checkShort = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.038, 0.038), emeraldGlowMat);
      checkShort.position.set(-0.045, -0.025, 0);
      checkShort.rotation.z = -Math.PI * 0.25;
      doneBadgeGroup.add(checkShort);
      const checkLong = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.038, 0.038), emeraldGlowMat);
      checkLong.position.set(0.04, 0.01, 0);
      checkLong.rotation.z = Math.PI * 0.28;
      doneBadgeGroup.add(checkLong);

      const errorBadgeGroup = new THREE.Group();
      errorBadgeGroup.position.set(0, 2.02, -0.35);
      errorBadgeGroup.visible = false;
      deskGroup.add(errorBadgeGroup);

      const redAlertMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xef4444,
        emissiveIntensity: 1.4,
        roughness: 0.2,
      });
      const errRing = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.026, 8, 4), redAlertMat);
      errorBadgeGroup.add(errRing);
      const errBar = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.14, 0.04), redAlertMat);
      errBar.position.set(0, 0.025, 0);
      errorBadgeGroup.add(errBar);
      const errDot = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.04), redAlertMat);
      errDot.position.set(0, -0.09, 0);
      errorBadgeGroup.add(errDot);

      let deskLight: THREE.PointLight | null = null;
      if (!isExecAssistant) {
        deskLight = new THREE.PointLight(agent.colorInt, 0.35, 6.5, 1.8);
        deskLight.position.set(0, 1.9, -0.1);
        root.add(deskLight);
      }

      const hitBox = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 2.2, 2.2),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hitBox.position.set(0, 1.1, 0);
      hitBox.userData.agentId = agent.id;
      root.add(hitBox);
      clickableDesks.push(hitBox);

      const initRole = getAgentRoleForMode(liveStateRef.current.mode, agent.id);
      const labelEl = document.createElement('button');
      labelEl.type = 'button';
      labelEl.className = 'agent-label focus-visible:outline-none';
      labelEl.style.setProperty('--agent-color', agent.colorHex);
      labelEl.style.setProperty('--agent-rgb', agent.rgb);
      labelEl.setAttribute('aria-label', `${initRole.name} - ${initRole.titleVi}`);
      labelEl.innerHTML = `
        <div class="agent-progress-wrap hidden" aria-hidden="true">
          <span class="agent-progress-ring-box">
            <svg viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(148,163,184,0.22)" stroke-width="3.2"></circle>
              <circle
                class="agent-progress-arc"
                cx="18"
                cy="18"
                r="14"
                fill="none"
                stroke="${agent.colorHex}"
                stroke-width="3.2"
                stroke-linecap="round"
                stroke-dasharray="87.965"
                stroke-dashoffset="77.4"
              ></circle>
            </svg>
            <span class="agent-progress-pct absolute inset-0 flex items-center justify-center text-[8.5px] font-mono font-bold tabular-nums text-slate-50">12%</span>
          </span>
          <span class="agent-progress-stage text-[10px] font-mono font-medium text-slate-100 whitespace-nowrap">Khởi tạo</span>
        </div>
        <div class="agent-label-card w-max max-w-[280px] px-3 py-2 flex flex-col gap-1 text-left" data-status="idle">
          <div class="flex items-center justify-between gap-2.5 min-w-0">
            <span class="text-xs font-bold text-slate-50 flex items-center gap-1.5 min-w-0">
              <span class="inline-block w-2 h-2 rounded-sm shrink-0" style="background:${agent.colorHex}"></span>
              <span class="agent-name-slot truncate max-w-[148px]">${escapeHtmlText(initRole.name)}</span>
            </span>
            <span class="agent-badge-slot text-[11px] font-semibold text-indigo-300 shrink-0 whitespace-nowrap">Đang ngủ</span>
          </div>
          <div class="agent-subtitle-slot text-[10.5px] text-slate-400 truncate max-w-[252px]">Nhịp ${agent.beat} · ${escapeHtmlText(initRole.titleVi)}</div>
        </div>
      `;
      labelEl.addEventListener('click', () => {
        callbacksRef.current.onPlayClick();
        callbacksRef.current.onFocusAgentSection(agent.id);
      });

      const labelObj = new CSS2DObject(labelEl);
      labelObj.position.set(0, isExecAssistant ? 2.48 : 2.74, 0.2);
      root.add(labelObj);

      agentRigMap.set(agent.id, {
        agent,
        root,
        charGroup,
        headGroup,
        leftArm,
        rightArm,
        floorRingGroup,
        floorRing,
        ringMat,
        arcMat,
        stripMat,
        monitorScreenMat,
        deskLight,
        holoGroup,
        holoFrameMat,
        holoCoreBarMat,
        holoNode,
        doneBadgeGroup,
        errorBadgeGroup,
        labelEl,
        progressWrapEl: labelEl.querySelector('.agent-progress-wrap'),
        progressArcEl: labelEl.querySelector('.agent-progress-arc'),
        progressPctEl: labelEl.querySelector('.agent-progress-pct'),
        progressStageEl: labelEl.querySelector('.agent-progress-stage'),
        cardEl: labelEl.querySelector('.agent-label-card'),
        nameEl: labelEl.querySelector('.agent-name-slot'),
        subtitleEl: labelEl.querySelector('.agent-subtitle-slot'),
        badgeEl: labelEl.querySelector('.agent-badge-slot'),
      });
    }

    AGENTS.forEach(buildWorkstation);

    /* -----------------------------------------------------------------------
     * 3C-BIS. LUXURY EXECUTIVE SUITE — PHÒNG CEO PHÚC
     * ----------------------------------------------------------------------- */
    const execGroup = new THREE.Group();
    execGroup.position.set(0, 0.24, 0);
    officeGroup.add(execGroup);

    const execRugMat = new THREE.MeshStandardMaterial({
      map: createExecutiveRugTexture(),
      color: 0xffffff,
      roughness: 0.92,
      metalness: 0.02,
    });
    const execRug = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.025, 9.8), execRugMat);
    execRug.position.set(-11.35, 0.02, 0.45);
    execRug.receiveShadow = true;
    execGroup.add(execRug);

    const skyTopBar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 7.62), brushedGoldMat);
    skyTopBar.position.set(-14.64, 3.17, 0.4);
    execGroup.add(skyTopBar);
    const skyBottomBar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 7.62), brushedGoldMat);
    skyBottomBar.position.set(-14.64, 0.74, 0.4);
    execGroup.add(skyBottomBar);
    [-3.36, 4.16].forEach((jz) => {
      const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.52, 0.1), brushedGoldMat);
      jamb.position.set(-14.64, 1.95, jz);
      execGroup.add(jamb);
    });

    const westGlassBay = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.34, 7.42), curtainGlassMat);
    westGlassBay.position.set(-14.64, 1.95, 0.4);
    execGroup.add(westGlassBay);
    [-1.4, 0.4, 2.2].forEach((mz) => {
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.38, 0.06), brushedGoldMat);
      mullion.position.set(-14.64, 1.95, mz);
      execGroup.add(mullion);
    });

    for (let i = 0; i < 8; i++) {
      const wSlat = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.15, 0.08), walnutWoodMat);
      wSlat.position.set(-14.2 + i * 0.24, 1.65, -6.48);
      execGroup.add(wSlat);
    }

    const signFrame = new THREE.Mesh(new THREE.BoxGeometry(3.25, 1.02, 0.1), brushedGoldMat);
    signFrame.position.set(-11.2, 2.38, -6.46);
    execGroup.add(signFrame);

    const signTex = createExecutiveSignTexture();
    const signMat = new THREE.MeshStandardMaterial({
      map: signTex,
      emissiveMap: signTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.85,
      roughness: 0.2,
    });
    const signFace = new THREE.Mesh(new THREE.PlaneGeometry(3.08, 0.88), signMat);
    signFace.position.set(-11.2, 2.38, -6.4);
    execGroup.add(signFace);

    const credenza = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.88, 0.65), walnutWoodMat);
    credenza.position.set(-11.2, 0.44, -6.12);
    credenza.castShadow = true;
    credenza.receiveShadow = true;
    execGroup.add(credenza);

    const credenzaTop = new THREE.Mesh(new THREE.BoxGeometry(4.28, 0.05, 0.7), execMarbleMat);
    credenzaTop.position.set(-11.2, 0.9, -6.12);
    execGroup.add(credenzaTop);

    const globeBase = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.08, 16), brushedGoldMat);
    globeBase.position.set(-12.4, 0.96, -6.1);
    execGroup.add(globeBase);
    const globeSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xd97706,
        emissiveIntensity: 0.4,
        roughness: 0.15,
        metalness: 0.85,
      })
    );
    globeSphere.position.set(-12.4, 1.24, -6.1);
    execGroup.add(globeSphere);

    [-10.2, -9.6].forEach((tx, idx) => {
      const trophy = new THREE.Mesh(
        new THREE.ConeGeometry(0.11, 0.34 - idx * 0.05, 6),
        brushedGoldMat
      );
      trophy.position.set(tx, 1.12, -6.1);
      execGroup.add(trophy);
    });

    const directorRig = new THREE.Group();
    directorRig.position.set(-11.5, 0.03, -1.9);
    directorRig.rotation.y = -Math.PI * 0.72;
    execGroup.add(directorRig);

    const execDeskTop = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.11, 1.35), walnutWoodMat);
    execDeskTop.position.set(0, 0.84, -0.25);
    execDeskTop.castShadow = true;
    execDeskTop.receiveShadow = true;
    directorRig.add(execDeskTop);

    const execReturn = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.8, 1.85), walnutWoodMat);
    execReturn.position.set(-1.25, 0.4, 0.65);
    execReturn.castShadow = true;
    execReturn.receiveShadow = true;
    directorRig.add(execReturn);

    const execDeskGoldTrim = new THREE.Mesh(new THREE.BoxGeometry(3.24, 0.04, 1.39), brushedGoldMat);
    execDeskGoldTrim.position.set(0, 0.86, -0.25);
    directorRig.add(execDeskGoldTrim);

    const execFrontModesty = new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.72, 0.12), execMarbleMat);
    execFrontModesty.position.set(0.05, 0.38, -0.82);
    execFrontModesty.castShadow = true;
    directorRig.add(execFrontModesty);

    const execGlowStripMat = new THREE.MeshStandardMaterial({
      color: 0xfde68a,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.0,
      roughness: 0.2,
    });
    const execDeskLed = new THREE.Mesh(new THREE.BoxGeometry(2.75, 0.04, 0.04), execGlowStripMat);
    execDeskLed.position.set(0.05, 0.75, -0.9);
    directorRig.add(execDeskLed);

    const deskPad = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.015, 0.56), execLeatherMat);
    deskPad.position.set(0, 0.905, -0.05);
    directorRig.add(deskPad);

    const nameplateBlock = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.11, 0.12), brushedGoldMat);
    nameplateBlock.position.set(0.85, 0.95, -0.68);
    directorRig.add(nameplateBlock);

    const execTablet = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.02, 0.3),
      new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xd97706,
        emissiveIntensity: 0.45,
        roughness: 0.18,
      })
    );
    execTablet.position.set(0, 0.92, -0.1);
    execTablet.rotation.x = 0.08;
    directorRig.add(execTablet);

    const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.05, 16), brushedGoldMat);
    lampBase.position.set(1.22, 0.92, -0.42);
    directorRig.add(lampBase);
    const lampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.38, 8), brushedGoldMat);
    lampStem.position.set(1.22, 1.12, -0.42);
    directorRig.add(lampStem);
    const lampShade = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.12, 16),
      new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.9,
        roughness: 0.2,
      })
    );
    lampShade.position.set(1.14, 1.3, -0.36);
    directorRig.add(lampShade);

    const sideMonGroup = new THREE.Group();
    sideMonGroup.position.set(-1.26, 0.85, 0.15);
    sideMonGroup.rotation.y = Math.PI * 0.36;
    directorRig.add(sideMonGroup);

    const execMonStand = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.12), brushedGoldMat);
    execMonStand.position.set(0, 0.14, -0.1);
    sideMonGroup.add(execMonStand);

    const execMonBezel = new THREE.Mesh(
      new THREE.BoxGeometry(1.56, 0.68, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x0b0f19, roughness: 0.25, metalness: 0.7 })
    );
    execMonBezel.position.set(0, 0.52, -0.05);
    execMonBezel.castShadow = true;
    sideMonGroup.add(execMonBezel);

    const execDashTex = createExecutiveDashboardTexture();
    const execMonMat = new THREE.MeshStandardMaterial({
      map: execDashTex,
      emissiveMap: execDashTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.82,
      roughness: 0.16,
    });
    const execMonScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.48, 0.6), execMonMat);
    execMonScreen.position.set(0, 0.52, -0.018);
    sideMonGroup.add(execMonScreen);

    const execHoloRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.28, 0.018, 10, 32),
      execGlowStripMat
    );
    execHoloRing.position.set(-1.25, 1.18, 1.15);
    execHoloRing.rotation.x = Math.PI * 0.35;
    directorRig.add(execHoloRing);

    const execChairGroup = new THREE.Group();
    execChairGroup.position.set(0, 0, 0.7);
    directorRig.add(execChairGroup);

    const ecBase = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.4, 0.06, 16), brushedGoldMat);
    ecBase.position.y = 0.03;
    execChairGroup.add(ecBase);
    const ecStem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.48, 10), brushedGoldMat);
    ecStem.position.y = 0.28;
    execChairGroup.add(ecStem);
    const ecSeat = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.12, 0.62), execLeatherMat);
    ecSeat.position.y = 0.54;
    ecSeat.castShadow = true;
    execChairGroup.add(ecSeat);
    const ecBack = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.92, 0.12), execLeatherMat);
    ecBack.position.set(0, 1.0, 0.27);
    ecBack.castShadow = true;
    execChairGroup.add(ecBack);
    const ecHeadrest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.22, 0.14), execLeatherMat);
    ecHeadrest.position.set(0, 1.48, 0.24);
    execChairGroup.add(ecHeadrest);
    [-0.36, 0.36].forEach((ax) => {
      const armRest = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.44), brushedGoldMat);
      armRest.position.set(ax, 0.74, 0.05);
      execChairGroup.add(armRest);
    });

    const directorCharGroup = new THREE.Group();
    directorCharGroup.position.set(0, 0.6, 0.62);
    directorRig.add(directorCharGroup);

    const execSuitMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.42,
      metalness: 0.22,
    });

    const dirHips = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.3), execSuitMat);
    dirHips.position.set(0, 0.04, -0.02);
    directorCharGroup.add(dirHips);
    [-0.13, 0.13].forEach((lx) => {
      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.22, 4, 8), execSuitMat);
      thigh.rotation.x = Math.PI / 2;
      thigh.position.set(lx, 0.04, -0.19);
      directorCharGroup.add(thigh);
    });

    const dirTorso = new THREE.Mesh(new THREE.CylinderGeometry(0.265, 0.21, 0.52, 14), execSuitMat);
    dirTorso.scale.set(1.04, 1, 0.64);
    dirTorso.position.y = 0.32;
    dirTorso.castShadow = true;
    directorCharGroup.add(dirTorso);

    const dirShirt = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.045, 0.26, 8), shirtWhiteMat);
    dirShirt.scale.set(1, 1, 0.55);
    dirShirt.position.set(0, 0.46, -0.115);
    directorCharGroup.add(dirShirt);

    const dirGoldTie = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.24, 0.032), brushedGoldMat);
    dirGoldTie.position.set(0, 0.37, -0.15);
    directorCharGroup.add(dirGoldTie);

    const dirPocketSq = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.042, 0.03), brushedGoldMat);
    dirPocketSq.position.set(0.14, 0.45, -0.152);
    directorCharGroup.add(dirPocketSq);

    [-0.255, 0.255].forEach((sx) => {
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.088, 10, 8), execSuitMat);
      shoulder.position.set(sx, 0.51, -0.01);
      directorCharGroup.add(shoulder);
    });
    const dirNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.1, 10), skinMat);
    dirNeck.position.set(0, 0.6, 0);
    directorCharGroup.add(dirNeck);

    const directorHeadGroup = new THREE.Group();
    directorHeadGroup.position.set(0, 0.77, 0);
    directorCharGroup.add(directorHeadGroup);

    const dirHeadMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.155, 0.09, 6, 14), skinMat);
    dirHeadMesh.scale.set(1.04, 1, 0.96);
    dirHeadMesh.castShadow = true;
    directorHeadGroup.add(dirHeadMesh);

    const dirHairCrown = new THREE.Mesh(
      new THREE.SphereGeometry(0.172, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      hairDarkMat
    );
    dirHairCrown.position.set(0, 0.05, 0.015);
    dirHairCrown.scale.set(1.04, 0.94, 1.02);
    dirHairCrown.castShadow = true;
    directorHeadGroup.add(dirHairCrown);

    const dirHairQuiff = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.075, 0.13), hairDarkMat);
    dirHairQuiff.position.set(0, 0.165, -0.08);
    dirHairQuiff.rotation.x = -0.18;
    dirHairQuiff.castShadow = true;
    directorHeadGroup.add(dirHairQuiff);

    const dirGlasses = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.048, 0.036), brushedGoldMat);
    dirGlasses.position.set(0, 0.018, -0.162);
    directorHeadGroup.add(dirGlasses);

    function createExecArm(sideSign: number): THREE.Group {
      const pivot = new THREE.Group();
      pivot.position.set(sideSign * 0.285, 0.49, -0.01);
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.17, 4, 8), execSuitMat);
      upper.position.set(0, -0.11, 0);
      upper.castShadow = true;
      pivot.add(upper);

      const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.046, 0.16, 4, 8), execSuitMat);
      forearm.position.set(-sideSign * 0.02, -0.24, -0.08);
      forearm.rotation.x = Math.PI * 0.34;
      forearm.castShadow = true;
      pivot.add(forearm);

      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 8), skinMat);
      hand.position.set(-sideSign * 0.03, -0.27, -0.175);
      pivot.add(hand);
      pivot.rotation.x = Math.PI * 0.22;
      return pivot;
    }
    const dirLeftArm = createExecArm(-1);
    const dirRightArm = createExecArm(1);
    directorCharGroup.add(dirLeftArm);
    directorCharGroup.add(dirRightArm);

    const loungeGroup = new THREE.Group();
    loungeGroup.position.set(-11.7, 0.03, 3.65);
    execGroup.add(loungeGroup);

    const sofaBase = new THREE.Mesh(new THREE.BoxGeometry(2.75, 0.36, 0.95), execLeatherMat);
    sofaBase.position.set(0, 0.22, 0.65);
    sofaBase.castShadow = true;
    sofaBase.receiveShadow = true;
    loungeGroup.add(sofaBase);

    const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(2.75, 0.56, 0.22), execLeatherMat);
    sofaBack.position.set(0, 0.56, 1.02);
    sofaBack.castShadow = true;
    loungeGroup.add(sofaBack);

    [-1.26, 1.26].forEach((sx) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.44, 0.95), execLeatherMat);
      arm.position.set(sx, 0.42, 0.65);
      arm.castShadow = true;
      loungeGroup.add(arm);
    });

    [-0.85, 0.85].forEach((px) => {
      const pillow = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.3, 0.14),
        new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.75 })
      );
      pillow.position.set(px, 0.52, 0.82);
      pillow.rotation.z = px > 0 ? -0.15 : 0.15;
      loungeGroup.add(pillow);
    });

    const coffeeTableTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75, 0.75, 0.07, 28),
      execMarbleMat
    );
    coffeeTableTop.position.set(0, 0.42, -0.55);
    coffeeTableTop.castShadow = true;
    coffeeTableTop.receiveShadow = true;
    loungeGroup.add(coffeeTableTop);

    const coffeeTableRim = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.02, 10, 32), brushedGoldMat);
    coffeeTableRim.rotation.x = Math.PI / 2;
    coffeeTableRim.position.set(0, 0.42, -0.55);
    loungeGroup.add(coffeeTableRim);

    const coffeeTableLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 0.4, 16), brushedGoldMat);
    coffeeTableLeg.position.set(0, 0.2, -0.55);
    loungeGroup.add(coffeeTableLeg);

    const execWarmLight = new THREE.PointLight(0xfbbf24, 1.35, 11, 1.6);
    execWarmLight.position.set(-11.4, 3.2, -0.6);
    execGroup.add(execWarmLight);

    const directorHitBox = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 2.6, 3.8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    directorHitBox.position.set(0, 1.2, 0);
    directorHitBox.userData.isDirector = true;
    directorRig.add(directorHitBox);
    clickableDesks.push(directorHitBox);

    const directorLabelEl = document.createElement('button');
    directorLabelEl.type = 'button';
    directorLabelEl.className = 'agent-label focus-visible:outline-none';
    directorLabelEl.setAttribute('aria-label', 'Phòng CEO Phúc - Nhấn để phóng cận cảnh');
    directorLabelEl.innerHTML = `
      <div class="director-label-card text-left" data-status="idle">
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs font-bold text-amber-200 flex items-center gap-1.5">
            <span class="inline-block w-2 h-2 rounded-sm bg-amber-400"></span>
            CEO Phúc
          </span>
          <span class="director-badge-slot text-[10.5px] font-semibold text-amber-300">Điều hành</span>
        </div>
        <div class="text-[10.5px] text-slate-300 mt-0.5 truncate max-w-[195px]">Phòng CEO · Executive Suite</div>
      </div>
    `;
    directorLabelEl.addEventListener('click', () => {
      callbacksRef.current.onPlayClick();
      callbacksRef.current.onSelectCameraView('director');
    });

    const directorLabelObj = new CSS2DObject(directorLabelEl);
    directorLabelObj.position.set(0, 2.55, 0.2);
    directorRig.add(directorLabelObj);

    const directorCardEl = directorLabelEl.querySelector('.director-label-card') as HTMLElement | null;
    const directorBadgeEl = directorLabelEl.querySelector('.director-badge-slot') as HTMLElement | null;

    /* -----------------------------------------------------------------------
     * 3D. HYBRID 3-BEAT DATA BEAMS
     * ----------------------------------------------------------------------- */
    const assistantPos = new THREE.Vector3(
      ASSISTANT_AGENT.position[0],
      1.32,
      ASSISTANT_AGENT.position[2]
    );
    const getAgentPos = (id: AgentId): THREE.Vector3 => {
      const a = AGENTS.find((item) => item.id === id)!;
      return new THREE.Vector3(
        a.position[0],
        a.roleGroup === 'executive' ? 1.32 : 1.25,
        a.position[2]
      );
    };

    const CONNECTIONS = [
      {
        from: new THREE.Vector3(0, 1.25, 0),
        to: getAgentPos('researcher'),
        phase: 'beat1',
        sourceId: 'hub',
        targetId: 'researcher',
        color: AGENTS[0].colorInt,
      },
      {
        from: getAgentPos('researcher'),
        to: getAgentPos('quant'),
        phase: 'beat2',
        sourceId: 'researcher',
        targetId: 'quant',
        color: AGENTS[1].colorInt,
      },
      {
        from: getAgentPos('researcher'),
        to: getAgentPos('strategist'),
        phase: 'beat2',
        sourceId: 'researcher',
        targetId: 'strategist',
        color: AGENTS[2].colorInt,
      },
      ...(['researcher', 'quant', 'strategist'] as const).map((srcId) => {
        const srcAgent = AGENTS.find((a) => a.id === srcId)!;
        return {
          from: getAgentPos(srcId),
          to: getAgentPos('critic'),
          phase: 'beat3_critic',
          sourceId: srcId,
          targetId: 'critic',
          color: srcAgent.colorInt,
        };
      }),
      ...HALL_AGENTS.map((a) => ({
        from: getAgentPos(a.id),
        to: assistantPos.clone(),
        phase: 'synthesize',
        sourceId: a.id,
        targetId: 'assistant',
        color: a.colorInt,
      })),
      {
        from: assistantPos.clone(),
        to: new THREE.Vector3(-11.5, 1.55, -1.9),
        phase: 'director',
        sourceId: 'assistant',
        targetId: 'director',
        color: 0xf59e0b,
      },
    ];

    const beamLinks = CONNECTIONS.map((conn) => {
      const mid = conn.from.clone().lerp(conn.to, 0.5);
      const isDiagonal =
        (conn.sourceId === 'researcher' && conn.targetId === 'strategist') ||
        (conn.sourceId === 'quant' && conn.targetId === 'critic');
      mid.y +=
        conn.phase === 'synthesize'
          ? 2.25
          : conn.phase === 'director'
            ? 1.35
            : isDiagonal
              ? 2.15
              : 1.5;
      const curve = new THREE.CatmullRomCurve3([conn.from.clone(), mid, conn.to.clone()]);
      const tubeGeo = new THREE.TubeGeometry(curve, 36, 0.03, 8, false);
      const tubeMat = new THREE.MeshBasicMaterial({
        color: conn.color,
        transparent: true,
        opacity: 0.14,
      });
      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      scene.add(tubeMesh);

      const fromFloorY = conn.sourceId === 'assistant' ? 0.27 : 0.03;
      const toFloorY = conn.targetId === 'assistant' || conn.targetId === 'director' ? 0.27 : 0.03;
      const floorCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(conn.from.x, fromFloorY, conn.from.z),
        new THREE.Vector3(conn.to.x, toFloorY, conn.to.z),
      ]);
      const floorTubeGeo = new THREE.TubeGeometry(floorCurve, 8, 0.022, 6, false);
      const floorTubeMat = new THREE.MeshBasicMaterial({
        color: conn.color,
        transparent: true,
        opacity: 0.18,
      });
      const floorLine = new THREE.Mesh(floorTubeGeo, floorTubeMat);
      scene.add(floorLine);

      const particleGeo = new THREE.SphereGeometry(0.055, 10, 10);
      const particleMat = new THREE.MeshBasicMaterial({
        color: conn.phase === 'director' ? 0xfde047 : conn.color,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const particles: Array<{ mesh: THREE.Mesh; offset: number }> = [];
      for (let i = 0; i < 8; i++) {
        const p = new THREE.Mesh(particleGeo, particleMat);
        p.visible = false;
        scene.add(p);
        particles.push({ mesh: p, offset: i / 8 });
      }

      return { conn, curve, tubeMat, floorTubeMat, particles };
    });

    /* -----------------------------------------------------------------------
     * 3D-BIS. MOBILE 3D ELECTRIC SUPERHERO ("⚡ Siêu nhân Điện quang")
     * ----------------------------------------------------------------------- */
    const janitorGroup = new THREE.Group();
    janitorGroup.position.set(0, 0, 5.15);
    janitorGroup.rotation.y = Math.PI;
    officeGroup.add(janitorGroup);

    const janitorShadow = new THREE.Mesh(new THREE.CircleGeometry(0.48, 20), contactShadowMat);
    janitorShadow.rotation.x = -Math.PI / 2;
    janitorShadow.position.set(0, 0.015, 0);
    janitorGroup.add(janitorShadow);

    const heroSilverMat = new THREE.MeshStandardMaterial({
      color: 0xdbeafe,
      roughness: 0.34,
      metalness: 0.52,
    });
    const heroCrimsonMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      emissive: 0x991b1b,
      emissiveIntensity: 0.25,
      roughness: 0.42,
      metalness: 0.22,
    });
    const heroGoldMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xfde047,
      emissiveIntensity: 1.5,
      roughness: 0.18,
      metalness: 0.35,
    });
    const heroCoreMat = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x22d3ee,
      emissiveIntensity: 2.2,
      roughness: 0.15,
      metalness: 0.2,
    });
    const heroCapeMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0x7f1d1d,
      emissiveIntensity: 0.22,
      roughness: 0.62,
      metalness: 0.08,
      side: THREE.DoubleSide,
    });
    const batonHandleMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.55,
      metalness: 0.45,
    });
    const batonNeonMat = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x22d3ee,
      emissiveIntensity: 2.2,
      roughness: 0.15,
      metalness: 0.25,
    });

    function createJanitorLeg(sideSign: number): THREE.Group {
      const legPivot = new THREE.Group();
      legPivot.position.set(sideSign * 0.11, 0.72, 0);
      const legMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.42, 4, 8), heroSilverMat);
      legMesh.position.set(0, -0.34, 0);
      legMesh.castShadow = true;
      legPivot.add(legMesh);

      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.14, 0.24), heroCrimsonMat);
      boot.position.set(0, -0.65, 0.04);
      boot.castShadow = true;
      legPivot.add(boot);
      return legPivot;
    }
    const janitorLeftLeg = createJanitorLeg(-1);
    const janitorRightLeg = createJanitorLeg(1);
    janitorGroup.add(janitorLeftLeg);
    janitorGroup.add(janitorRightLeg);

    const janitorPelvis = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.15, 0.25), heroCrimsonMat);
    janitorPelvis.position.set(0, 0.75, 0);
    janitorGroup.add(janitorPelvis);

    const heroBeltBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.27), heroGoldMat);
    heroBeltBuckle.position.set(0, 0.82, 0.01);
    janitorGroup.add(heroBeltBuckle);

    const janitorTorso = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.175, 0.48, 12),
      heroSilverMat
    );
    janitorTorso.scale.set(1.06, 1, 0.66);
    janitorTorso.position.set(0, 1.05, 0);
    janitorTorso.castShadow = true;
    janitorGroup.add(janitorTorso);

    const heroChestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 0.29), heroCrimsonMat);
    heroChestPlate.position.set(0, 1.13, 0.01);
    heroChestPlate.castShadow = true;
    janitorGroup.add(heroChestPlate);

    const heroColorTimer = new THREE.Mesh(
      new THREE.CylinderGeometry(0.062, 0.062, 0.045, 16),
      heroCoreMat
    );
    heroColorTimer.rotation.x = Math.PI / 2;
    heroColorTimer.position.set(0, 1.12, 0.165);
    janitorGroup.add(heroColorTimer);

    const heroCapePivot = new THREE.Group();
    heroCapePivot.position.set(0, 1.25, -0.15);
    const heroCapeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.86, 0.03), heroCapeMat);
    heroCapeMesh.position.set(0, -0.42, -0.02);
    heroCapeMesh.castShadow = true;
    heroCapePivot.add(heroCapeMesh);
    heroCapePivot.rotation.x = 0.14;
    janitorGroup.add(heroCapePivot);

    const janitorNeck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.062, 0.074, 0.1, 10),
      heroSilverMat
    );
    janitorNeck.position.set(0, 1.31, 0);
    janitorGroup.add(janitorNeck);

    const janitorHeadGroup = new THREE.Group();
    janitorHeadGroup.position.set(0, 1.46, 0);
    janitorGroup.add(janitorHeadGroup);

    const heroHelmet = new THREE.Mesh(new THREE.CapsuleGeometry(0.145, 0.08, 8, 14), heroSilverMat);
    heroHelmet.castShadow = true;
    janitorHeadGroup.add(heroHelmet);

    const heroCrestFin = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.14, 0.25), heroCrimsonMat);
    heroCrestFin.position.set(0, 0.15, -0.01);
    heroCrestFin.castShadow = true;
    janitorHeadGroup.add(heroCrestFin);

    const heroCrestGlow = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.055, 0.05), heroCoreMat);
    heroCrestGlow.position.set(0, 0.13, 0.11);
    janitorHeadGroup.add(heroCrestGlow);

    [-0.058, 0.058].forEach((ex) => {
      const eyeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.044, 0.035), heroGoldMat);
      eyeMesh.position.set(ex, 0.02, 0.132);
      eyeMesh.rotation.z = ex < 0 ? -0.18 : 0.18;
      janitorHeadGroup.add(eyeMesh);
    });

    const janitorLeftArm = new THREE.Group();
    janitorLeftArm.position.set(-0.26, 1.23, 0);
    const jLeftSleeve = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.048, 0.28, 4, 8),
      heroSilverMat
    );
    jLeftSleeve.position.set(0, -0.16, 0);
    jLeftSleeve.castShadow = true;
    janitorLeftArm.add(jLeftSleeve);
    const jLeftHand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), heroCrimsonMat);
    jLeftHand.position.set(0, -0.34, 0.02);
    janitorLeftArm.add(jLeftHand);
    janitorGroup.add(janitorLeftArm);

    const janitorRightArm = new THREE.Group();
    janitorRightArm.position.set(0.26, 1.23, 0);
    const jRightSleeve = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.048, 0.28, 4, 8),
      heroSilverMat
    );
    jRightSleeve.position.set(0, -0.16, 0);
    jRightSleeve.castShadow = true;
    janitorRightArm.add(jRightSleeve);
    const jRightHand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), heroCrimsonMat);
    jRightHand.position.set(0, -0.34, 0.02);
    janitorRightArm.add(jRightHand);

    const batonGroup = new THREE.Group();
    batonGroup.position.set(0, -0.34, 0.06);
    batonGroup.rotation.x = Math.PI * 0.42;
    janitorRightArm.add(batonGroup);

    const batonHandle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.032, 0.2, 10),
      batonHandleMat
    );
    batonHandle.position.y = 0.06;
    batonGroup.add(batonHandle);

    const batonShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.026, 0.4, 10),
      heroSilverMat
    );
    batonShaft.position.y = 0.35;
    batonGroup.add(batonShaft);

    const batonGlowCore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.036, 0.18, 12),
      batonNeonMat
    );
    batonGlowCore.position.y = 0.58;
    batonGroup.add(batonGlowCore);

    [-0.026, 0.026].forEach((px) => {
      const prong = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.095, 0.015), heroGoldMat);
      prong.position.set(px, 0.69, 0);
      batonGroup.add(prong);
    });

    const batonTipMarker = new THREE.Object3D();
    batonTipMarker.position.set(0, 0.74, 0);
    batonGroup.add(batonTipMarker);

    janitorGroup.add(janitorRightArm);

    const janitorLabelEl = document.createElement('div');
    janitorLabelEl.className = 'janitor-label';
    janitorLabelEl.innerHTML = `<div class="janitor-label-card">⚡ Siêu nhân Điện quang</div>`;
    const janitorLabelObj = new CSS2DObject(janitorLabelEl);
    janitorLabelObj.position.set(0, 2.04, 0);
    janitorGroup.add(janitorLabelObj);

    const ARC_VERTEX_COUNT = 9;
    function createLightningBoltLine(colorHex: number): LightningBolt {
      const geo = new THREE.BufferGeometry();
      const arr = new Float32Array(ARC_VERTEX_COUNT * 3);
      const posAttr = new THREE.BufferAttribute(arr, 3);
      geo.setAttribute('position', posAttr);
      const mat = new THREE.LineBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.95,
      });
      const line = new THREE.Line(geo, mat);
      line.visible = false;
      line.frustumCulled = false;
      scene.add(line);
      return { line, arr, posAttr, mat };
    }
    const shockBoltCyan = createLightningBoltLine(0x22d3ee);
    const shockBoltYellow = createLightningBoltLine(0xfacc15);

    const sparkGeo = new THREE.SphereGeometry(0.036, 6, 6);
    const sparkMatCyan = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    const sparkMatYellow = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const shockSparks: THREE.Mesh[] = [];
    for (let s = 0; s < 8; s++) {
      const sp = new THREE.Mesh(sparkGeo, s % 2 === 0 ? sparkMatCyan : sparkMatYellow);
      sp.visible = false;
      scene.add(sp);
      shockSparks.push(sp);
    }

    const janitorPos = janitorGroup.position;
    const _janitorGoal = new THREE.Vector3(0, 0, 5.15);
    const _janitorTargetBehind = new THREE.Vector3();
    const _batonTipWorld = new THREE.Vector3();
    const _shockTargetWorld = new THREE.Vector3();
    let lastJanitorZapSoundMs = 0;
    let janitorAnimSpeed = 0;
    let janitorWalkPhase = 0;
    let janitorArrivedAtGoal = false;

    /* -----------------------------------------------------------------------
     * 3E. CSS2D NAMEPLATE & PROGRESS RING SYNCHRONIZER
     * ----------------------------------------------------------------------- */
    function updateActiveDeskProgressRings() {
      const s = liveStateRef.current;
      const nowEpoch = Date.now();
      AGENTS.forEach((agent) => {
        const rig = agentRigMap.get(agent.id);
        if (!rig || !rig.progressWrapEl) return;
        const status = s.statuses[agent.id];
        const retryMsg = s.retryStatus[agent.id];
        const prog = getAgentProgressState(status, retryMsg, s.agentStartedAt[agent.id], nowEpoch);
        if (prog.visible) {
          rig.progressWrapEl.classList.remove('hidden');
          rig.progressWrapEl.setAttribute('aria-hidden', 'false');
          const offset = RING_CIRCUMFERENCE * (1 - prog.percent / 100);
          if (rig.progressArcEl) rig.progressArcEl.style.strokeDashoffset = offset.toFixed(2);
          if (rig.progressPctEl) rig.progressPctEl.textContent = `${prog.percent}%`;
          if (rig.progressStageEl) rig.progressStageEl.textContent = prog.stageLabel;
        } else {
          rig.progressWrapEl.classList.add('hidden');
          rig.progressWrapEl.setAttribute('aria-hidden', 'true');
        }
      });
    }

    function sync3DNameplatesAndDirector() {
      const s = liveStateRef.current;
      let hallDoneCount = 0;
      const nowEpoch = Date.now();

      AGENTS.forEach((agent) => {
        const isAssistant = agent.id === 'assistant';
        const roleMeta = getAgentRoleForMode(s.mode, agent.id);
        const status = s.statuses[agent.id];
        const errorType = (s.errorTypes && s.errorTypes[agent.id]) || '';
        const errorLabel = (s.errorLabels && s.errorLabels[agent.id]) || '';
        const shortBadgeErr =
          errorType === 'timeout'
            ? 'Timeout >35s'
            : errorLabel
              ? errorLabel.split(':')[0]
              : 'Lỗi API';
        const retryMsg = s.retryStatus[agent.id];

        if (!isAssistant && status === 'done') hallDoneCount += 1;

        const rig = agentRigMap.get(agent.id);
        if (rig) {
          rig.labelEl.setAttribute('aria-label', `${roleMeta.name} - ${roleMeta.titleVi}`);
          if (rig.nameEl) rig.nameEl.textContent = roleMeta.name;
          if (rig.subtitleEl) rig.subtitleEl.textContent = `Nhịp ${agent.beat} · ${roleMeta.titleVi}`;
          if (rig.cardEl) rig.cardEl.setAttribute('data-status', status);

          if (rig.badgeEl) {
            if (status === 'active') {
              const label = escapeHtmlText(retryMsg || (isAssistant ? 'Đang tổng hợp' : 'Đang chạy'));
              rig.badgeEl.innerHTML = `<span class="inline-flex items-center gap-1 text-blue-300 shrink-0 whitespace-nowrap"><svg class="w-3 h-3 spin-icon shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>${label}</span>`;
            } else if (status === 'done') {
              rig.badgeEl.innerHTML = `<span class="inline-flex items-center gap-1 text-emerald-400 shrink-0 whitespace-nowrap" aria-label="Hoàn thành"><svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Xong</span>`;
            } else if (status === 'error') {
              const errBadgeText = errorType === 'timeout' ? 'Lỗi (Quá thời gian)' : escapeHtmlText(shortBadgeErr);
              rig.badgeEl.innerHTML = `<span class="text-red-400 shrink-0 whitespace-nowrap">${errBadgeText}</span>`;
            } else {
              rig.badgeEl.innerHTML = `<span class="inline-flex items-center gap-1 text-indigo-300 shrink-0 whitespace-nowrap">${SLEEP_MOON_SVG}Đang ngủ<span class="agent-sleep-zzz font-mono text-[9.5px] text-indigo-200/90 ml-0.5 whitespace-nowrap">Zzz</span></span>`;
            }
          }

          if (rig.progressWrapEl) {
            const prog = getAgentProgressState(status, retryMsg, s.agentStartedAt[agent.id], nowEpoch);
            if (prog.visible) {
              rig.progressWrapEl.classList.remove('hidden');
              rig.progressWrapEl.setAttribute('aria-hidden', 'false');
              if (rig.progressArcEl) {
                rig.progressArcEl.style.strokeDashoffset = (RING_CIRCUMFERENCE * (1 - prog.percent / 100)).toFixed(2);
              }
              if (rig.progressPctEl) rig.progressPctEl.textContent = `${prog.percent}%`;
              if (rig.progressStageEl) rig.progressStageEl.textContent = prog.stageLabel;
            } else {
              rig.progressWrapEl.classList.add('hidden');
              rig.progressWrapEl.setAttribute('aria-hidden', 'true');
            }
          }
        }
      });

      if (directorCardEl && directorBadgeEl) {
        const assistantStatus = s.statuses.assistant;
        if (s.isRunning || s.runningAgents.length > 0) {
          directorCardEl.setAttribute('data-status', 'reviewing');
          directorBadgeEl.innerHTML =
            assistantStatus === 'active'
              ? '<span class="text-amber-300">Đang nhận tổng hợp</span>'
              : '<span class="text-amber-300">Đang giám sát</span>';
        } else if (assistantStatus === 'done' && hallDoneCount === 4) {
          directorCardEl.setAttribute('data-status', 'approved');
          directorBadgeEl.innerHTML = '<span class="text-emerald-400">Đã trình CEO Phúc</span>';
        } else {
          directorCardEl.setAttribute('data-status', 'idle');
          directorBadgeEl.innerHTML = '<span class="text-amber-300">Điều hành</span>';
        }
      }
    }

    syncDomRef.current = sync3DNameplatesAndDirector;
    sync3DNameplatesAndDirector();

    /* -----------------------------------------------------------------------
     * 3F. RAYCASTING & RENDER LOOP (SOFTWARE-GL SAFE)
     * ----------------------------------------------------------------------- */
    const raycaster = new THREE.Raycaster();
    const pointerVec = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    const handlePointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointerVec.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerVec.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerVec, camera);
      const hits = raycaster.intersectObjects(clickableDesks, false);
      if (hits.length > 0) {
        callbacksRef.current.onPlayClick();
        const hitData = hits[0].object.userData as { isDirector?: boolean; agentId?: AgentId };
        if (hitData.isDirector) {
          callbacksRef.current.onSelectCameraView('director');
        } else if (hitData.agentId) {
          callbacksRef.current.onFocusAgentSection(hitData.agentId);
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);

    const _scratchPos = new THREE.Vector3();
    const _scratchOffset = new THREE.Vector3();
    const _scratchColor = new THREE.Color();
    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    let lastProgressDomSyncMs = 0;

    function tick() {
      if (disposed) return;
      const s = liveStateRef.current;
      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.1);
      const janitorDt = isSoftwareGl ? Math.min(Math.max(rawDt, 0.08), 0.38) : dt;
      const elapsed = clock.getElapsedTime();
      const nowMs = performance.now();

      if (cameraResetActive) {
        const preset = getTargetCameraPreset();
        const camDt = isSoftwareGl ? Math.max(dt, 0.16) : dt;
        const alpha = 1 - Math.exp(-8.5 * camDt);
        camera.position.lerp(preset.pos, alpha);
        controls.target.lerp(preset.target, alpha);
        if (
          camera.position.distanceTo(preset.pos) < 0.03 &&
          controls.target.distanceTo(preset.target) < 0.03
        ) {
          camera.position.copy(preset.pos);
          controls.target.copy(preset.target);
          cameraResetActive = false;
        }
      } else if (s.cinemaMode && !userDraggingOrbit) {
        const orbitDt = isSoftwareGl ? Math.max(dt, 0.08) : dt;
        _scratchOffset.copy(camera.position).sub(controls.target);
        const angle = orbitDt * 0.14;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const nx = _scratchOffset.x * cosA - _scratchOffset.z * sinA;
        const nz = _scratchOffset.x * sinA + _scratchOffset.z * cosA;
        _scratchOffset.x = nx;
        _scratchOffset.z = nz;
        camera.position.copy(controls.target).add(_scratchOffset);
      }
      controls.update();

      const holoSpeed = s.isRunning ? 1.8 : 0.45;
      holoCore.rotation.y += dt * holoSpeed;
      holoCore.position.y = 1.24 + Math.sin(elapsed * 2.0) * 0.04;
      holoRing.rotation.z -= dt * holoSpeed * 0.6;

      // Mobile 3D Electric Superhero ("⚡ Siêu nhân Điện quang")
      const janitorPlan = resolveJanitorTargetPlan(s.statuses, elapsed, AGENTS);
      let shockedAgentId: AgentId | null = null;
      let janitorSpeed = 0;
      let desiredFacing = janitorGroup.rotation.y;

      if (janitorPlan.mode === 'shock' && janitorPlan.targetAgentId) {
        const targetRig = agentRigMap.get(janitorPlan.targetAgentId);
        const targetAgent = targetRig?.agent;
        if (targetAgent && targetRig) {
          const distBehind = targetAgent.id === 'assistant' ? 1.08 : 1.38;
          _janitorTargetBehind.set(
            targetAgent.position[0] + Math.sin(targetAgent.facingAngle) * distBehind,
            targetAgent.position[1] || 0,
            targetAgent.position[2] + Math.cos(targetAgent.facingAngle) * distBehind
          );

          const crossingDoor =
            (janitorPos.x > -7.5 && _janitorTargetBehind.x < -8.0) ||
            (janitorPos.x < -8.0 && _janitorTargetBehind.x > -7.5);
          if (crossingDoor && Math.abs(janitorPos.z) > 1.35) {
            _janitorGoal.set(-7.55, 0.12, 0.9);
            janitorArrivedAtGoal = false;
          } else {
            _janitorGoal.copy(_janitorTargetBehind);
          }

          const dx = _janitorGoal.x - janitorPos.x;
          const dz = _janitorGoal.z - janitorPos.z;
          const distToGoal = Math.hypot(dx, dz);
          const distToBehind = Math.hypot(
            _janitorTargetBehind.x - janitorPos.x,
            _janitorTargetBehind.z - janitorPos.z
          );

          if (janitorArrivedAtGoal) {
            if (distToGoal > 0.34) janitorArrivedAtGoal = false;
          } else if (distToGoal <= 0.14) {
            janitorArrivedAtGoal = true;
          }

          if (!janitorArrivedAtGoal && distToGoal > 0.08) {
            const stepDist = Math.min(distToGoal, janitorDt * 6.2);
            janitorPos.x += (dx / distToGoal) * stepDist;
            janitorPos.z += (dz / distToGoal) * stepDist;
            janitorSpeed = Math.min(6.2, distToGoal * 8.0);
            desiredFacing = Math.atan2(dx, dz);
          } else {
            janitorPos.x = THREE.MathUtils.damp(janitorPos.x, _janitorGoal.x, 10, dt);
            janitorPos.z = THREE.MathUtils.damp(janitorPos.z, _janitorGoal.z, 10, dt);
            const fx = targetAgent.position[0] - janitorPos.x;
            const fz = targetAgent.position[2] - janitorPos.z;
            desiredFacing = Math.atan2(fx, fz);
          }

          if (distToBehind < 1.15) {
            shockedAgentId = targetAgent.id;
          }
        }
      } else {
        janitorArrivedAtGoal = false;
        const patrolFreq = 0.52;
        const patrolAmp = 1.65;
        const patrolX = Math.sin(elapsed * patrolFreq) * patrolAmp;
        const patrolVx = Math.cos(elapsed * patrolFreq) * patrolAmp * patrolFreq;
        const patrolZ = 5.15;
        const crossingOut = janitorPos.x < -7.75;

        if (crossingOut && Math.abs(janitorPos.z) > 1.35) {
          _janitorGoal.set(-7.55, 0.12, 0.9);
          const dx = _janitorGoal.x - janitorPos.x;
          const dz = _janitorGoal.z - janitorPos.z;
          const dist = Math.hypot(dx, dz);
          if (dist > 0.08) {
            const moveStep = Math.min(dist, janitorDt * 3.2);
            janitorPos.x += (dx / dist) * moveStep;
            janitorPos.z += (dz / dist) * moveStep;
            janitorSpeed = 3.2;
            desiredFacing = Math.atan2(dx, dz);
          }
        } else {
          const dxReturn = patrolX - janitorPos.x;
          const dzReturn = patrolZ - janitorPos.z;
          const distReturn = Math.hypot(dxReturn, dzReturn);
          if (distReturn > 0.45) {
            const moveStep = Math.min(distReturn, janitorDt * 2.8);
            janitorPos.x += (dxReturn / distReturn) * moveStep;
            janitorPos.z += (dzReturn / distReturn) * moveStep;
            janitorSpeed = Math.min(2.8, distReturn * 3.0);
            desiredFacing = Math.atan2(dxReturn, dzReturn);
          } else {
            janitorPos.x = THREE.MathUtils.damp(janitorPos.x, patrolX, 8, janitorDt);
            janitorPos.z = THREE.MathUtils.damp(janitorPos.z, patrolZ, 8, janitorDt);
            janitorSpeed = Math.abs(patrolVx);
            desiredFacing = Math.atan2(patrolVx, -0.45);
          }
        }
      }

      const targetFloorY = janitorPos.x < -7.75 ? 0.24 : janitorPos.x < -7.3 ? 0.12 : 0;
      janitorPos.y = THREE.MathUtils.damp(janitorPos.y, targetFloorY, 14, dt);

      let angleDiff = desiredFacing - janitorGroup.rotation.y;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      janitorGroup.rotation.y += angleDiff * (1 - Math.exp(-8.5 * dt));

      janitorAnimSpeed = THREE.MathUtils.damp(janitorAnimSpeed, janitorSpeed, 10, dt);
      janitorWalkPhase += janitorAnimSpeed * 3.1 * dt;
      const strideNorm = THREE.MathUtils.clamp(janitorAnimSpeed / 6.2, 0, 1);
      const walkBlend = THREE.MathUtils.clamp(janitorAnimSpeed / 0.45, 0, 1);
      const strideAmp = (0.18 + strideNorm * 0.46) * walkBlend;
      const swingSin = Math.sin(janitorWalkPhase);

      janitorLeftLeg.rotation.x = swingSin * strideAmp;
      janitorRightLeg.rotation.x = -swingSin * strideAmp;
      janitorLeftArm.rotation.x = -swingSin * strideAmp * 0.75;
      janitorRightArm.rotation.x = shockedAgentId
        ? THREE.MathUtils.damp(
            janitorRightArm.rotation.x,
            -Math.PI * 0.42 + Math.sin(elapsed * 7) * 0.04,
            12,
            dt
          )
        : THREE.MathUtils.damp(
            janitorRightArm.rotation.x,
            -0.18 + swingSin * strideAmp * 0.45,
            10,
            dt
          );
      heroCapePivot.rotation.x = THREE.MathUtils.damp(
        heroCapePivot.rotation.x,
        0.12 + strideNorm * 0.44 + (shockedAgentId ? 0.12 : 0) + Math.sin(elapsed * 2.8) * 0.04,
        8,
        dt
      );
      heroCoreMat.emissiveIntensity = shockedAgentId
        ? 3.2 + Math.sin(elapsed * 24) * 0.8
        : 1.9 + Math.sin(elapsed * 4) * 0.35;

      const shockedRig = shockedAgentId ? agentRigMap.get(shockedAgentId) : null;
      if (shockedRig) {
        janitorGroup.updateMatrixWorld(true);
        shockedRig.charGroup.updateMatrixWorld(true);
        batonTipMarker.getWorldPosition(_batonTipWorld);
        shockedRig.charGroup.getWorldPosition(_shockTargetWorld);
        _shockTargetWorld.y += 0.32;

        batonNeonMat.emissiveIntensity = 2.6 + Math.sin(elapsed * 42) * 0.9;

        const updateBolt = (boltObj: LightningBolt, phaseOffset: number, amp: number) => {
          boltObj.line.visible = true;
          boltObj.mat.opacity = 0.72 + 0.28 * Math.abs(Math.sin(elapsed * 38 + phaseOffset));
          for (let k = 0; k < ARC_VERTEX_COUNT; k++) {
            const t = k / (ARC_VERTEX_COUNT - 1);
            let px = THREE.MathUtils.lerp(_batonTipWorld.x, _shockTargetWorld.x, t);
            let py = THREE.MathUtils.lerp(_batonTipWorld.y, _shockTargetWorld.y, t);
            let pz = THREE.MathUtils.lerp(_batonTipWorld.z, _shockTargetWorld.z, t);
            if (k > 0 && k < ARC_VERTEX_COUNT - 1) {
              px += Math.sin(elapsed * 58 + k * 7.1 + phaseOffset) * amp;
              py += Math.cos(elapsed * 63 + k * 5.3 + phaseOffset) * (amp * 0.9);
              pz += Math.sin(elapsed * 51 + k * 9.7 + phaseOffset) * amp;
            }
            boltObj.arr[k * 3] = px;
            boltObj.arr[k * 3 + 1] = py;
            boltObj.arr[k * 3 + 2] = pz;
          }
          boltObj.posAttr.needsUpdate = true;
        };
        updateBolt(shockBoltCyan, 0, 0.18);
        updateBolt(shockBoltYellow, 2.1, 0.14);

        shockSparks.forEach((sp, sIdx) => {
          sp.visible = true;
          const ang = elapsed * 16 + sIdx * ((Math.PI * 2) / shockSparks.length);
          const rad = 0.12 + 0.14 * Math.abs(Math.sin(elapsed * 26 + sIdx));
          sp.position.set(
            _shockTargetWorld.x + Math.cos(ang) * rad,
            _shockTargetWorld.y + Math.sin(elapsed * 32 + sIdx * 1.9) * 0.16,
            _shockTargetWorld.z + Math.sin(ang) * rad
          );
        });

        if (nowMs - lastJanitorZapSoundMs >= 1150) {
          lastJanitorZapSoundMs = nowMs;
          callbacksRef.current.onElectricZap();
        }
      } else {
        batonNeonMat.emissiveIntensity = 1.45 + Math.sin(elapsed * 3) * 0.25;
        shockBoltCyan.line.visible = false;
        shockBoltYellow.line.visible = false;
        shockSparks.forEach((sp) => {
          sp.visible = false;
        });
      }

      const nextJanitorModeAttr = shockedAgentId
        ? 'shocking'
        : janitorPlan.mode === 'shock'
          ? 'running'
          : 'patrol';
      const nextJanitorTargetAttr = janitorPlan.targetAgentId || 'none';
      if (document.body.dataset.janitorMode !== nextJanitorModeAttr) {
        document.body.dataset.janitorMode = nextJanitorModeAttr;
      }
      if (document.body.dataset.janitorTarget !== nextJanitorTargetAttr) {
        document.body.dataset.janitorTarget = nextJanitorTargetAttr;
      }

      // Per-agent 3D status animations
      AGENTS.forEach((agent, idx) => {
        const rig = agentRigMap.get(agent.id);
        if (!rig) return;
        const status = s.statuses[agent.id];
        const isShocked = Boolean(shockedAgentId === agent.id && status === 'active');

        const targetColorHex =
          status === 'done' ? 0x10b981 : status === 'error' ? 0xef4444 : agent.colorInt;
        _scratchColor.setHex(targetColorHex);
        rig.stripMat.color.lerp(_scratchColor, Math.min(1, dt * 8));
        rig.stripMat.emissive.lerp(_scratchColor, Math.min(1, dt * 8));
        rig.ringMat.color.lerp(_scratchColor, Math.min(1, dt * 8));
        rig.ringMat.emissive.lerp(_scratchColor, Math.min(1, dt * 8));
        rig.arcMat.color.lerp(_scratchColor, Math.min(1, dt * 8));
        if (rig.deskLight) {
          rig.deskLight.color.lerp(_scratchColor, Math.min(1, dt * 8));
        }

        const errBlink =
          status === 'error' ? 0.2 + 0.8 * (0.5 + 0.5 * Math.sin(elapsed * 10 + idx)) : 1;
        const targetLight =
          status === 'active'
            ? 2.6
            : status === 'done'
              ? 1.45
              : status === 'error'
                ? 2.1 * errBlink
                : 0.08;
        const targetScreen =
          status === 'active'
            ? 1.25
            : status === 'done'
              ? 0.86
              : status === 'error'
                ? 0.7 * errBlink
                : 0.14;
        const targetStrip =
          status === 'active'
            ? 1.7
            : status === 'done'
              ? 1.35
              : status === 'error'
                ? 1.65 * errBlink
                : 0.12;

        if (rig.deskLight) {
          rig.deskLight.intensity = THREE.MathUtils.damp(rig.deskLight.intensity, targetLight, 8, dt);
        }
        rig.monitorScreenMat.emissiveIntensity = THREE.MathUtils.damp(
          rig.monitorScreenMat.emissiveIntensity,
          targetScreen,
          8,
          dt
        );
        rig.stripMat.emissiveIntensity = THREE.MathUtils.damp(
          rig.stripMat.emissiveIntensity,
          targetStrip,
          8,
          dt
        );

        if (status === 'active') {
          const wave = Math.sin(elapsed * (isShocked ? 24 : 10.5) + idx);
          const shockShakeX = isShocked ? Math.sin(elapsed * 78) * 0.045 : 0;
          const shockShakeZ = isShocked ? Math.cos(elapsed * 85) * 0.04 : 0;
          const typeFreq = isShocked ? 66 : 22;

          rig.charGroup.position.x = isShocked
            ? shockShakeX
            : THREE.MathUtils.damp(rig.charGroup.position.x, 0, 12, dt);
          rig.charGroup.position.z = isShocked
            ? 0.54 + shockShakeZ
            : THREE.MathUtils.damp(rig.charGroup.position.z, 0.54, 12, dt);
          rig.charGroup.position.y = 0.55 + Math.abs(wave) * (isShocked ? 0.14 : 0.08);
          rig.headGroup.rotation.y = isShocked
            ? Math.sin(elapsed * 42) * 0.22
            : Math.sin(elapsed * 3.8) * 0.15;
          rig.headGroup.rotation.x = isShocked
            ? Math.sin(elapsed * 52) * 0.14
            : Math.sin(elapsed * 6.2) * 0.09;
          rig.headGroup.rotation.z = isShocked
            ? Math.sin(elapsed * 64) * 0.15
            : THREE.MathUtils.damp(rig.headGroup.rotation.z, 0, 8, dt);
          rig.leftArm.rotation.x =
            Math.PI * 0.28 + Math.sin(elapsed * typeFreq) * (isShocked ? 0.24 : 0.17);
          rig.rightArm.rotation.x =
            Math.PI * 0.28 + Math.cos(elapsed * typeFreq) * (isShocked ? 0.24 : 0.17);

          rig.floorRingGroup.rotation.z += dt * (isShocked ? 2.8 : 1.45);
          const breath = 0.5 + 0.5 * Math.sin(elapsed * 5.2 + idx);
          rig.ringMat.opacity = 0.45 + breath * 0.4;
          rig.ringMat.emissiveIntensity = 1.1 + breath * 0.75;
          rig.arcMat.opacity = 0.65 + breath * 0.35;
          const ringScale = 1 + Math.sin(elapsed * 4.5 + idx) * 0.045;
          rig.floorRingGroup.scale.set(ringScale, ringScale, 1);

          rig.holoGroup.visible = true;
          rig.holoGroup.position.y = 1.98 + Math.sin(elapsed * 3.5 + idx) * 0.04;
          const flicker =
            0.52 + 0.48 * Math.abs(Math.sin(elapsed * 18 + idx * 1.7) * Math.cos(elapsed * 7));
          rig.holoFrameMat.opacity = flicker;
          rig.holoCoreBarMat.opacity = flicker * 0.85;
          rig.holoNode.rotation.y += dt * 2.4;
          rig.doneBadgeGroup.visible = false;
          rig.errorBadgeGroup.visible = false;
        } else if (status === 'done') {
          rig.charGroup.position.x = THREE.MathUtils.damp(rig.charGroup.position.x, 0, 8, dt);
          rig.charGroup.position.z = THREE.MathUtils.damp(rig.charGroup.position.z, 0.54, 8, dt);
          rig.charGroup.position.y = THREE.MathUtils.damp(
            rig.charGroup.position.y,
            0.55 + Math.sin(elapsed * 1.4 + idx) * 0.012,
            6,
            dt
          );
          rig.headGroup.rotation.y = THREE.MathUtils.damp(rig.headGroup.rotation.y, 0, 6, dt);
          rig.headGroup.rotation.x = THREE.MathUtils.damp(rig.headGroup.rotation.x, 0, 6, dt);
          rig.headGroup.rotation.z = THREE.MathUtils.damp(rig.headGroup.rotation.z, 0, 6, dt);
          rig.leftArm.rotation.x = THREE.MathUtils.damp(
            rig.leftArm.rotation.x,
            Math.PI * 0.28,
            6,
            dt
          );
          rig.rightArm.rotation.x = THREE.MathUtils.damp(
            rig.rightArm.rotation.x,
            Math.PI * 0.28,
            6,
            dt
          );

          rig.ringMat.opacity = THREE.MathUtils.damp(rig.ringMat.opacity, 0.75, 6, dt);
          rig.ringMat.emissiveIntensity = THREE.MathUtils.damp(
            rig.ringMat.emissiveIntensity,
            1.2,
            6,
            dt
          );
          rig.arcMat.opacity = THREE.MathUtils.damp(rig.arcMat.opacity, 0.85, 6, dt);
          rig.floorRingGroup.scale.set(1, 1, 1);

          rig.holoGroup.visible = false;
          rig.doneBadgeGroup.visible = true;
          rig.doneBadgeGroup.position.y = 2.02 + Math.sin(elapsed * 2.4 + idx) * 0.045;
          rig.doneBadgeGroup.rotation.y = Math.sin(elapsed * 1.2 + idx) * 0.35;
          rig.errorBadgeGroup.visible = false;
        } else if (status === 'error') {
          rig.charGroup.position.x = THREE.MathUtils.damp(rig.charGroup.position.x, 0, 8, dt);
          rig.charGroup.position.z = THREE.MathUtils.damp(rig.charGroup.position.z, 0.54, 8, dt);
          rig.charGroup.position.y = THREE.MathUtils.damp(rig.charGroup.position.y, 0.55, 6, dt);
          rig.headGroup.rotation.y = THREE.MathUtils.damp(rig.headGroup.rotation.y, 0, 6, dt);
          rig.headGroup.rotation.x = THREE.MathUtils.damp(rig.headGroup.rotation.x, 0, 6, dt);
          rig.headGroup.rotation.z = THREE.MathUtils.damp(rig.headGroup.rotation.z, 0, 6, dt);
          rig.leftArm.rotation.x = THREE.MathUtils.damp(
            rig.leftArm.rotation.x,
            Math.PI * 0.28,
            6,
            dt
          );
          rig.rightArm.rotation.x = THREE.MathUtils.damp(
            rig.rightArm.rotation.x,
            Math.PI * 0.28,
            6,
            dt
          );

          rig.ringMat.opacity = 0.25 + 0.65 * errBlink;
          rig.ringMat.emissiveIntensity = 0.4 + 1.3 * errBlink;
          rig.arcMat.opacity = 0.2 + 0.7 * errBlink;
          rig.floorRingGroup.scale.set(1, 1, 1);

          rig.holoGroup.visible = false;
          rig.doneBadgeGroup.visible = false;
          rig.errorBadgeGroup.visible = errBlink > 0.35;
          rig.errorBadgeGroup.position.y = 2.02 + Math.sin(elapsed * 4.5) * 0.03;
        } else {
          const sleepBreath = Math.sin(elapsed * 1.15 + idx * 0.8);
          rig.charGroup.position.x = THREE.MathUtils.damp(rig.charGroup.position.x, 0, 8, dt);
          rig.charGroup.position.z = THREE.MathUtils.damp(rig.charGroup.position.z, 0.54, 8, dt);
          rig.charGroup.position.y = THREE.MathUtils.damp(
            rig.charGroup.position.y,
            0.515 + sleepBreath * 0.01,
            6,
            dt
          );
          rig.headGroup.rotation.y = THREE.MathUtils.damp(rig.headGroup.rotation.y, 0, 5, dt);
          rig.headGroup.rotation.x = THREE.MathUtils.damp(
            rig.headGroup.rotation.x,
            -0.36 + sleepBreath * 0.03,
            5,
            dt
          );
          rig.headGroup.rotation.z = THREE.MathUtils.damp(
            rig.headGroup.rotation.z,
            idx % 2 === 0 ? 0.09 : -0.09,
            5,
            dt
          );
          rig.leftArm.rotation.x = THREE.MathUtils.damp(
            rig.leftArm.rotation.x,
            Math.PI * 0.14,
            5,
            dt
          );
          rig.rightArm.rotation.x = THREE.MathUtils.damp(
            rig.rightArm.rotation.x,
            Math.PI * 0.14,
            5,
            dt
          );
          rig.ringMat.opacity = THREE.MathUtils.damp(rig.ringMat.opacity, 0.14, 6, dt);
          rig.ringMat.emissiveIntensity = THREE.MathUtils.damp(
            rig.ringMat.emissiveIntensity,
            0.15,
            6,
            dt
          );
          rig.arcMat.opacity = THREE.MathUtils.damp(rig.arcMat.opacity, 0.2, 6, dt);
          rig.floorRingGroup.scale.set(1, 1, 1);

          rig.holoGroup.visible = false;
          rig.doneBadgeGroup.visible = false;
          rig.errorBadgeGroup.visible = false;
        }
      });

      execHoloRing.rotation.z += dt * (s.isRunning ? 1.5 : 0.55);
      directorCharGroup.position.y = THREE.MathUtils.damp(
        directorCharGroup.position.y,
        0.6 + Math.sin(elapsed * 1.3) * 0.014,
        6,
        dt
      );
      directorHeadGroup.rotation.y = s.isRunning
        ? Math.sin(elapsed * 1.8) * 0.14
        : THREE.MathUtils.damp(directorHeadGroup.rotation.y, Math.sin(elapsed * 0.6) * 0.06, 5, dt);
      execWarmLight.intensity = THREE.MathUtils.damp(
        execWarmLight.intensity,
        s.cameraView === 'director' ||
          s.statuses.assistant === 'active' ||
          s.statuses.assistant === 'done'
          ? 2.0
          : 1.5,
        5,
        dt
      );

      beamLinks.forEach((link, idx) => {
        const { isStreaming, isPassed, isBursting } = resolveBeamLinkState(
          link.conn,
          s.statuses,
          s.outputs,
          nowMs,
          s.burstTimers
        );

        const targetOpacity = isBursting ? 0.96 : isStreaming ? 0.88 : isPassed ? 0.48 : 0.12;
        link.tubeMat.opacity = THREE.MathUtils.damp(link.tubeMat.opacity, targetOpacity, 7, dt);
        link.floorTubeMat.opacity = THREE.MathUtils.damp(
          link.floorTubeMat.opacity,
          isBursting ? 0.92 : isStreaming ? 0.75 : isPassed ? 0.36 : 0.14,
          7,
          dt
        );

        const speedMult = isBursting ? 1.45 : 0.85;
        const pScale = isBursting ? 1.4 : 1.0;
        link.particles.forEach((p) => {
          if (isStreaming) {
            p.mesh.visible = true;
            p.mesh.scale.setScalar(pScale);
            const t = (elapsed * speedMult + p.offset + idx * 0.08) % 1;
            link.curve.getPointAt(t, _scratchPos);
            p.mesh.position.copy(_scratchPos);
          } else {
            p.mesh.visible = false;
          }
        });
      });

      if (nowMs - lastProgressDomSyncMs >= 160 && s.runningAgents.length > 0) {
        lastProgressDomSyncMs = nowMs;
        updateActiveDeskProgressRings();
      }

      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }
    tick();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      labelRenderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      disposed = true;
      if (isSoftwareGl) {
        window.clearTimeout(frameId);
      } else {
        cancelAnimationFrame(frameId);
      }
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      controls.dispose();
      envTarget.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === sceneContainer) {
        sceneContainer.removeChild(renderer.domElement);
      }
      if (labelRenderer.domElement.parentNode === labelsContainer) {
        labelsContainer.removeChild(labelRenderer.domElement);
      }
    };
  }, []);

  // Sync CSS2D nameplates & director card whenever relevant state changes
  useEffect(() => {
    syncDomRef.current?.();
  }, [mode, statuses, errorTypes, errorLabels, retryStatus, agentStartedAt, isRunning, runningAgents]);

  // Trigger camera reset animation when camera view, reset version, or desktop sidebar state changes
  useEffect(() => {
    if (!didMountCamRef.current) {
      didMountCamRef.current = true;
      return;
    }
    triggerCameraResetRef.current?.(true);
  }, [cameraView, cameraResetVersion, sidebarCollapsed]);

  // Disable automatic camera reset lerp when Cinema Mode activates so slow orbit works immediately
  useEffect(() => {
    if (cinemaMode) {
      triggerCameraResetRef.current?.(false);
    }
  }, [cinemaMode]);

  return (
    <>
      <div
        ref={sceneContainerRef}
        id="scene-container"
        data-testid="scene-container"
        aria-label="Không gian văn phòng AI 3D"
      />
      <div ref={labelsContainerRef} id="labels-container" aria-hidden="true" />
    </>
  );
}
