// src/components/ThreeDProjectViewer.jsx
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// --- PROCEDURAL TEXTURE GENERATORS ---

const createMarbleTexture = (stoneName) => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const name = String(stoneName || '').toLowerCase();

  let bg = '#e2e8f0';
  let flecks = [];
  let veins = [];

  if (name.includes('carrara')) {
    bg = '#f8fafc';
    veins = [
      { color: '#94a3b8', width: 2.5, opacity: 0.55 },
      { color: '#cbd5e1', width: 1.5, opacity: 0.45 },
      { color: '#64748b', width: 0.8, opacity: 0.25 }
    ];
  } else if (name.includes('gabriel') || name.includes('preto')) {
    bg = '#090d16';
    flecks = [
      { color: '#1e293b', size: 2, count: 5000 },
      { color: '#475569', size: 1.5, count: 3000 },
      { color: '#94a3b8', size: 1, count: 1000 }
    ];
  } else if (name.includes('ubatuba') || name.includes('verde')) {
    bg = '#022c22';
    flecks = [
      { color: '#064e3b', size: 2.5, count: 4000 },
      { color: '#0f766e', size: 1.5, count: 2500 },
      { color: '#78350f', size: 1.2, count: 800 },
      { color: '#111827', size: 3, count: 2000 }
    ];
  } else if (name.includes('travertino')) {
    bg = '#f3efe2';
    veins = [
      { color: '#e0d4b9', width: 8, opacity: 0.6, horizontal: true },
      { color: '#d1c09b', width: 5, opacity: 0.45, horizontal: true },
      { color: '#ffffff', width: 3, opacity: 0.7, horizontal: true }
    ];
  } else if (name.includes('estelar') || name.includes('branco')) {
    bg = '#ffffff';
    flecks = [
      { color: '#e2e8f0', size: 1.5, count: 3000 },
      { color: '#cbd5e1', size: 1.0, count: 1500 }
    ];
  } else if (name.includes('corumbá') || name.includes('cinza')) {
    bg = '#64748b';
    flecks = [
      { color: '#334155', size: 2.2, count: 4000 },
      { color: '#94a3b8', size: 1.8, count: 3000 },
      { color: '#cbd5e1', size: 1.2, count: 2000 },
      { color: '#0f172a', size: 2.8, count: 1000 }
    ];
  } else {
    bg = '#94a3b8';
    flecks = [
      { color: '#475569', size: 2, count: 3000 },
      { color: '#cbd5e1', size: 1.5, count: 2000 }
    ];
  }

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 512);

  if (flecks.length > 0) {
    flecks.forEach(f => {
      ctx.fillStyle = f.color;
      for (let i = 0; i < f.count; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        ctx.beginPath();
        ctx.arc(x, y, f.size * (0.6 + Math.random() * 0.8), 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  if (veins.length > 0) {
    veins.forEach(v => {
      ctx.strokeStyle = v.color;
      ctx.lineWidth = v.width;
      ctx.globalAlpha = v.opacity;

      for (let j = 0; j < (v.horizontal ? 8 : 4); j++) {
        ctx.beginPath();
        let x = v.horizontal ? 0 : Math.random() * 512;
        let y = v.horizontal ? Math.random() * 512 : 0;
        ctx.moveTo(x, y);

        const steps = 10;
        for (let k = 1; k <= steps; k++) {
          if (v.horizontal) {
            x = (k / steps) * 512;
            y += (Math.random() - 0.5) * 45;
          } else {
            y = (k / steps) * 512;
            x += (Math.random() - 0.5) * 45;
          }
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;
    });
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.5, 1.5);
  return texture;
};

// Generate procedural tile floor texture
const createTileFloorTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Base tile color (warm porcelain)
  ctx.fillStyle = '#d6cfc5';
  ctx.fillRect(0, 0, 512, 512);

  const tileSize = 128;
  const groutWidth = 4;

  // Draw tiles with subtle variation
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const x = col * tileSize;
      const y = row * tileSize;
      
      // Warm cream-beige variation per tile
      const brightness = 215 + Math.floor(Math.random() * 25);
      const warmth = 5 + Math.floor(Math.random() * 10);
      ctx.fillStyle = `rgb(${brightness + warmth}, ${brightness + warmth - 3}, ${brightness - 2})`;
      ctx.fillRect(x + groutWidth, y + groutWidth, tileSize - groutWidth * 2, tileSize - groutWidth * 2);

      // Subtle glossy highlight on each tile
      ctx.globalAlpha = 0.06;
      const grad = ctx.createLinearGradient(x, y, x + tileSize, y + tileSize);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.5, 'transparent');
      grad.addColorStop(1, '#000000');
      ctx.fillStyle = grad;
      ctx.fillRect(x + groutWidth, y + groutWidth, tileSize - groutWidth * 2, tileSize - groutWidth * 2);
      ctx.globalAlpha = 1.0;
    }
  }

  // Draw grout lines (darker for more contrast)
  ctx.fillStyle = '#9e9589';
  for (let i = 0; i <= 4; i++) {
    ctx.fillRect(0, i * tileSize - groutWidth / 2, 512, groutWidth);
    ctx.fillRect(i * tileSize - groutWidth / 2, 0, groutWidth, 512);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  return texture;
};

// Generate procedural wall tile texture (bathroom style)
const createWallTileTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Base warm white
  ctx.fillStyle = '#eae4dc';
  ctx.fillRect(0, 0, 512, 512);

  const tileW = 128;
  const tileH = 64;
  const grout = 3;

  for (let row = 0; row < 8; row++) {
    const offset = (row % 2) * (tileW / 2); // Brick pattern offset
    for (let col = -1; col < 5; col++) {
      const x = col * tileW + offset;
      const y = row * tileH;

      // Warm white variations
      const b = 232 + Math.floor(Math.random() * 15);
      ctx.fillStyle = `rgb(${b + 5}, ${b + 3}, ${b})`;
      ctx.fillRect(x + grout, y + grout, tileW - grout * 2, tileH - grout * 2);

      // Subtle glossy highlight per tile
      ctx.globalAlpha = 0.06;
      const grad = ctx.createLinearGradient(x, y, x, y + tileH);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.4, 'transparent');
      grad.addColorStop(1, 'rgba(0,0,0,0.05)');
      ctx.fillStyle = grad;
      ctx.fillRect(x + grout, y + grout, tileW - grout * 2, tileH - grout * 2);
      ctx.globalAlpha = 1.0;
    }
  }

  // Grout lines (visible beige)
  ctx.fillStyle = '#b8ad9e';
  for (let i = 0; i <= 8; i++) {
    ctx.fillRect(0, i * tileH - grout / 2, 512, grout);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 3);
  return texture;
};

// Generate procedural brick wall texture
const createBrickWallTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = '#b2533e';
  ctx.fillRect(0, 0, 512, 512);

  const brickW = 64;
  const brickH = 32;
  const grout = 3;

  for (let row = 0; row < 16; row++) {
    const offset = (row % 2) * (brickW / 2);
    for (let col = -1; col < 9; col++) {
      const x = col * brickW + offset;
      const y = row * brickH;

      const r = 150 + Math.floor(Math.random() * 40);
      const g = 65 + Math.floor(Math.random() * 20);
      const b = 45 + Math.floor(Math.random() * 20);
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(x + grout, y + grout, brickW - grout * 2, brickH - grout * 2);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      for (let n = 0; n < 20; n++) {
        const nx = x + Math.random() * brickW;
        const ny = y + Math.random() * brickH;
        ctx.fillRect(nx, ny, 1.5, 1.5);
      }
    }
  }

  ctx.fillStyle = '#cbd5e1';
  for (let i = 0; i <= 16; i++) {
    ctx.fillRect(0, i * brickH - grout / 2, 512, grout);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
};

// Generate procedural wood floor texture
const createWoodFloorTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = '#8b5a2b';
  ctx.fillRect(0, 0, 512, 512);

  const plankW = 256;
  const plankH = 64;
  const joint = 2;

  for (let row = 0; row < 8; row++) {
    const offset = (row % 2) * (plankW / 2);
    for (let col = -1; col < 3; col++) {
      const x = col * plankW + offset;
      const y = row * plankH;

      const brightness = 110 + Math.floor(Math.random() * 25);
      const warmth = 60 + Math.floor(Math.random() * 15);
      ctx.fillStyle = `rgb(${brightness + warmth}, ${brightness}, ${brightness - 30})`;
      ctx.fillRect(x + joint, y + joint, plankW - joint * 2, plankH - joint * 2);

      ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
      ctx.lineWidth = 1;
      for (let g = 0; g < 4; g++) {
        ctx.beginPath();
        let gy = y + 10 + Math.random() * (plankH - 20);
        ctx.moveTo(x, gy);
        ctx.bezierCurveTo(
          x + plankW * 0.3, gy + (Math.random() - 0.5) * 10,
          x + plankW * 0.6, gy + (Math.random() - 0.5) * 10,
          x + plankW, gy
        );
        ctx.stroke();
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  return texture;
};

// Generate procedural concrete texture
const createConcreteWallTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 5; i++) {
    const grad = ctx.createRadialGradient(
      Math.random() * 512, Math.random() * 512, 40,
      Math.random() * 512, Math.random() * 512, 180
    );
    const colorVal = 135 + Math.floor(Math.random() * 35);
    grad.addColorStop(0, `rgba(${colorVal}, ${colorVal}, ${colorVal}, 0.22)`);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);
  }

  ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
  for (let h = 0; h < 15; h++) {
    ctx.beginPath();
    ctx.arc(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
};

// Generate procedural dark stone tile wall texture
const createDarkTileWallTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = '#18181b';
  ctx.fillRect(0, 0, 512, 512);

  const tileW = 64;
  const tileH = 64;
  const grout = 2;

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const x = col * tileW;
      const y = row * tileH;

      const b = 35 + Math.floor(Math.random() * 15);
      ctx.fillStyle = `rgb(${b}, ${b + 2}, ${b + 4})`;
      ctx.fillRect(x + grout, y + grout, tileW - grout * 2, tileH - grout * 2);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
      for (let n = 0; n < 8; n++) {
        ctx.fillRect(x + Math.random() * tileW, y + Math.random() * tileH, 1, 1);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  return texture;
};


// Generate procedural environment map (studio-like HDR)
const createProceduralEnvMap = (renderer) => {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  const scene = new THREE.Scene();
  
  // Create a gradient sky dome
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  
  // Studio environment gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#f1f5f9');     // Top - soft light
  grad.addColorStop(0.2, '#e2e8f0');   // Upper
  grad.addColorStop(0.4, '#f8fafc');   // Bright band (main light)
  grad.addColorStop(0.5, '#ffffff');    // Horizon highlight
  grad.addColorStop(0.6, '#f8fafc');
  grad.addColorStop(0.8, '#e2e8f0');   
  grad.addColorStop(1, '#cbd5e1');     // Bottom floor bounce

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);

  // Add bright spots to simulate studio lights
  ctx.globalAlpha = 0.15;
  
  // Key light (right)
  const radGrad1 = ctx.createRadialGradient(750, 150, 0, 750, 150, 120);
  radGrad1.addColorStop(0, '#ffffff');
  radGrad1.addColorStop(1, 'transparent');
  ctx.fillStyle = radGrad1;
  ctx.fillRect(0, 0, 1024, 512);

  // Fill light (left)
  const radGrad2 = ctx.createRadialGradient(250, 200, 0, 250, 200, 100);
  radGrad2.addColorStop(0, '#e0f2fe');
  radGrad2.addColorStop(1, 'transparent');
  ctx.fillStyle = radGrad2;
  ctx.fillRect(0, 0, 1024, 512);

  // Rim light (back)
  const radGrad3 = ctx.createRadialGradient(512, 100, 0, 512, 100, 80);
  radGrad3.addColorStop(0, '#fef9c3');
  radGrad3.addColorStop(1, 'transparent');
  ctx.fillStyle = radGrad3;
  ctx.fillRect(0, 0, 1024, 512);

  ctx.globalAlpha = 1.0;

  const envTexture = new THREE.CanvasTexture(canvas);
  envTexture.mapping = THREE.EquirectangularReflectionMapping;
  
  const envMap = pmremGenerator.fromEquirectangular(envTexture).texture;
  envTexture.dispose();
  pmremGenerator.dispose();
  
  return envMap;
};

const getAlumHexColor = (colorName) => {
  const name = String(colorName || '').toLowerCase();
  if (name.includes('branco')) return 0xffffff;
  if (name.includes('preto')) return 0x111827;
  if (name.includes('bronze')) return 0x3b2314;
  if (name.includes('dourado') || name.includes('gold')) return 0xb8860b;
  if (name.includes('rose')) return 0xc4848a;
  if (name.includes('champagne')) return 0xc4ab86;
  if (name.includes('grafite')) return 0x374151;
  if (name.includes('inox')) return 0x9ca3af;
  if (name.includes('corten')) return 0x8b4513;
  if (name.includes('amadeirado')) return 0x6b3a1f;
  if (name.includes('brilhante') || name.includes('cromado')) return 0xe2e8f0;
  return 0x788896; // Fosco Natural
};

const getGlassHexColor = (colorName) => {
  const name = String(colorName || '').toLowerCase();
  if (name.includes('fumê escuro') || name.includes('fume escuro')) return 0x111418;
  if (name.includes('fumê') || name.includes('fume') || name.includes('cinza')) return 0x22252a;
  if (name.includes('bronze')) return 0xd97706;
  if (name.includes('verde')) return 0x059669;
  if (name.includes('extra clear') || name.includes('baixo ferro')) return 0xf0f8ff;
  if (name.includes('acidato') || name.includes('fosco')) return 0xd4dbe4;
  if (name.includes('boreal') || name.includes('canelado')) return 0xc8dce8;
  if (name.includes('refletivo prata')) return 0xc0c8d0;
  if (name.includes('refletivo bronze')) return 0xb8976a;
  if (name.includes('serigrafado branco')) return 0xf0f0f0;
  if (name.includes('serigrafado preto')) return 0x1a1a2e;
  return 0xb3e5fc; // Incolor (blue tint)
};

const getMetalColorHex = (aluminio) => {
  const name = String(aluminio || '').toLowerCase();
  if (name.includes('preto')) return 0x1e293b;
  if (name.includes('branco')) return 0xf8fafc;
  if (name.includes('bronze')) return 0x451a03;
  if (name.includes('cinza') || name.includes('grafite')) return 0x475569;
  if (name.includes('galvanizado') || name.includes('zincado')) return 0x94a3b8;
  return 0x64748b;
};

export default function ThreeDProjectViewer({
  tipo = 'vidracaria',
  modeloType = 'box',
  modeloNome = '',
  w = 1200,
  h = 1900,
  profundidade = 600,
  lado = 'esquerda',
  sentido = 'dentro',
  puxador = 'padrao',
  aluminio = 'fosco',
  corGlass = 'Incolor',
  qtdeFolhas = 1,
  slope = 10,
  isOpen = false,
  pedraTexture = '',
  saiaAtiva = true,
  alturaSaia = 40,
  rodopiaAtivo = true,
  alturaRodopia = 100,
  acabamento = 'Reto Lapidado',
  wVao = 1200,
  hVao = 1900,
  cenarioFundo = 'banheiro_premium',
  formatoBancada = 'reto',
  servicosSelecionados = [],
  tipoCuba = 'inox',
  gabineteArmario = 'charcoal',
  tipoTorneira = 'gourmet',
  temCooktop = false,
  comprimentoL = 800,
  posicaoCuba = 'centro',
  posicaoCooktop = 'direita',
  corCooktop = 'preto',
  onChangeDimensions
}) {
  const containerRef = useRef(null);
  const controlsRef = useRef(null);
  const [controlsInfo, setControlsInfo] = useState('Arraste para rotacionar • Scroll/Pinch para zoom');
  const [autoRotate, setAutoRotate] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous canvas
    containerRef.current.innerHTML = '';
    const width = containerRef.current.clientWidth || 300;
    const height = containerRef.current.clientHeight || 260;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe8ecf1);

    // Renderer (create early so we can generate env map)
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    containerRef.current.appendChild(renderer.domElement);

    // Generate procedural environment map
    const envMap = createProceduralEnvMap(renderer);
    scene.environment = envMap;

    // Camera
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    
    // OrbitControls — smooth, mobile-friendly, pinch-zoom
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1.2;
    controls.maxDistance = 8.0;
    controls.maxPolarAngle = Math.PI / 2.05; // Don't go below floor
    controls.minPolarAngle = 0.1;
    controls.enablePan = false;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.4;
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY
    };
    controlsRef.current = controls;

    // --- PREMIUM LIGHTING SETUP (3-point + ambient) ---

    // Ambient (soft fill)
    const ambientLight = new THREE.AmbientLight(0xfff8ef, 0.6);
    scene.add(ambientLight);

    // Hemisphere light (sky/ground bounce)
    const hemiLight = new THREE.HemisphereLight(0xf0f4f8, 0xd4c8b8, 0.5);
    hemiLight.position.set(0, 10, 0);
    scene.add(hemiLight);

    // Key light (main - warm white from top-right)
    const keyLight = new THREE.DirectionalLight(0xfff8ef, 1.3);
    keyLight.position.set(4, 8, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.1;
    keyLight.shadow.camera.far = 20;
    keyLight.shadow.camera.left = -5;
    keyLight.shadow.camera.right = 5;
    keyLight.shadow.camera.top = 5;
    keyLight.shadow.camera.bottom = -5;
    keyLight.shadow.bias = -0.001;
    keyLight.shadow.normalBias = 0.02;
    keyLight.shadow.radius = 4;
    scene.add(keyLight);

    // Fill light (soft - from left, cool tone)
    const fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.6);
    fillLight.position.set(-4, 4, 3);
    scene.add(fillLight);

    // Rim/back light (warm highlight from behind)
    const rimLight = new THREE.DirectionalLight(0xfef3c7, 0.8);
    rimLight.position.set(0, 3, -5);
    scene.add(rimLight);

    // Subtle spot for glass sparkle
    const spotLight = new THREE.SpotLight(0xffffff, 0.6, 12, Math.PI / 6, 0.8);
    spotLight.position.set(2, 6, 2);
    scene.add(spotLight);

    // Build Project Group
    const projectGroup = new THREE.Group();
    scene.add(projectGroup);

    // Normalizing dimensions to 3D space: 1000mm = 1.0 unit
    const dimW = (Number(w) || 1200) / 1000;
    const dimH = (Number(h) || 1900) / 1000;
    const dimD = (Number(profundidade) || 600) / 1000;

    let animatedObjects = [];

    // --- MATERIALS ---
    const alumHex = getAlumHexColor(aluminio);
    const glassHex = getGlassHexColor(corGlass);
    const isAlumShiny = String(aluminio).toLowerCase().includes('brilhante') || String(aluminio).toLowerCase().includes('cromado');

    const alumMaterial = new THREE.MeshStandardMaterial({
      color: alumHex,
      metalness: isAlumShiny ? 0.95 : 0.55,
      roughness: isAlumShiny ? 0.05 : 0.28,
      envMap: envMap,
      envMapIntensity: isAlumShiny ? 1.5 : 0.8
    });

    const hardwareMaterial = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      metalness: 0.95,
      roughness: 0.03,
      envMap: envMap,
      envMapIntensity: 1.8
    });

    const siliconeMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.45,
      roughness: 0.4,
      transmission: 0.85,
      side: THREE.DoubleSide
    });

    const normalizePuxador = (pux) => {
      const p = String(pux || '').toLowerCase();
      if (p.includes('h_simples') || p.includes('simples')) return 'h_simples';
      if (p.includes('barra_45') || p.includes('45')) return 'barra_45';
      if (p.includes('barra') || p.includes('tubular')) return 'barra';
      if (p.includes('knob') || p.includes('botao') || p.includes('botão') || p.includes('redondo')) return 'knob';
      if (p.includes('concha')) return 'concha';
      if (p.includes('furo') || p.includes('furação') || p.includes('furacao')) return 'furo';
      if (p.includes('sem')) return 'sem';
      return 'padrao';
    };

    const createPuxadorGroup = (rawTipo, material) => {
      const group = new THREE.Group();
      const tipo = normalizePuxador(rawTipo);

      if (tipo === 'sem') return group;

      if (tipo === 'knob') {
        const baseGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.006, 16);
        const knobGeo = new THREE.CylinderGeometry(0.02, 0.016, 0.016, 16);
        
        const outerBase = new THREE.Mesh(baseGeo, material);
        outerBase.rotation.x = Math.PI / 2;
        outerBase.position.set(0, 0, 0.003);
        outerBase.castShadow = true;
        group.add(outerBase);

        const outerKnob = new THREE.Mesh(knobGeo, material);
        outerKnob.rotation.x = Math.PI / 2;
        outerKnob.position.set(0, 0, 0.012);
        outerKnob.castShadow = true;
        group.add(outerKnob);
        
        const innerBase = new THREE.Mesh(baseGeo, material);
        innerBase.rotation.x = Math.PI / 2;
        innerBase.position.set(0, 0, -0.003);
        innerBase.castShadow = true;
        group.add(innerBase);

        const innerKnob = new THREE.Mesh(knobGeo, material);
        innerKnob.rotation.x = Math.PI / 2;
        innerKnob.position.set(0, 0, -0.012);
        innerKnob.castShadow = true;
        group.add(innerKnob);

      } else if (tipo === 'concha') {
        const conchaGeo = new THREE.BoxGeometry(0.035, 0.12, 0.003);
        const insetGeo = new THREE.BoxGeometry(0.022, 0.09, 0.001);
        const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });

        const outerConcha = new THREE.Mesh(conchaGeo, material);
        outerConcha.position.set(0, 0, 0.0015);
        outerConcha.castShadow = true;
        group.add(outerConcha);

        const outerInset = new THREE.Mesh(insetGeo, darkMaterial);
        outerInset.position.set(0, 0, 0.003);
        group.add(outerInset);
        
        const innerConcha = new THREE.Mesh(conchaGeo, material);
        innerConcha.position.set(0, 0, -0.0015);
        innerConcha.castShadow = true;
        group.add(innerConcha);

        const innerInset = new THREE.Mesh(insetGeo, darkMaterial);
        innerInset.position.set(0, 0, -0.003);
        group.add(innerInset);

      } else if (tipo === 'furo') {
        const torusGeo = new THREE.TorusGeometry(0.016, 0.003, 8, 24);
        const outerRing = new THREE.Mesh(torusGeo, material);
        outerRing.position.set(0, 0, 0.003);
        group.add(outerRing);
        
        const innerRing = new THREE.Mesh(torusGeo, material);
        innerRing.position.set(0, 0, -0.003);
        group.add(innerRing);

      } else if (tipo === 'h_simples') {
        const hVal = 0.4;
        const squareBarGeo = new THREE.BoxGeometry(0.014, hVal, 0.014);
        const pinGeo = new THREE.BoxGeometry(0.008, 0.008, 0.035);

        const barOuter = new THREE.Mesh(squareBarGeo, material);
        barOuter.position.set(0, 0, 0.0175);
        barOuter.castShadow = true;
        group.add(barOuter);

        const barInner = new THREE.Mesh(squareBarGeo, material);
        barInner.position.set(0, 0, -0.0175);
        barInner.castShadow = true;
        group.add(barInner);

        const pin1 = new THREE.Mesh(pinGeo, material);
        pin1.position.set(0, hVal * 0.28, 0);
        group.add(pin1);

        const pin2 = new THREE.Mesh(pinGeo, material);
        pin2.position.set(0, -hVal * 0.28, 0);
        group.add(pin2);

      } else if (tipo === 'barra') {
        const hVal = 0.6;
        const mainBarGeo = new THREE.CylinderGeometry(0.01, 0.01, hVal - 0.02, 16);
        const bentLegGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.04, 16);

        const barOuter = new THREE.Mesh(mainBarGeo, material);
        barOuter.position.set(0, 0, 0.04);
        barOuter.castShadow = true;
        group.add(barOuter);

        const legOuterTop = new THREE.Mesh(bentLegGeo, material);
        legOuterTop.rotation.x = Math.PI / 2;
        legOuterTop.position.set(0, hVal / 2 - 0.01, 0.02);
        group.add(legOuterTop);

        const legOuterBottom = new THREE.Mesh(bentLegGeo, material);
        legOuterBottom.rotation.x = Math.PI / 2;
        legOuterBottom.position.set(0, -hVal / 2 + 0.01, 0.02);
        group.add(legOuterBottom);

        const barInner = new THREE.Mesh(mainBarGeo, material);
        barInner.position.set(0, 0, -0.04);
        barInner.castShadow = true;
        group.add(barInner);

        const legInnerTop = new THREE.Mesh(bentLegGeo, material);
        legInnerTop.rotation.x = Math.PI / 2;
        legInnerTop.position.set(0, hVal / 2 - 0.01, -0.02);
        group.add(legInnerTop);

        const legInnerBottom = new THREE.Mesh(bentLegGeo, material);
        legInnerBottom.rotation.x = Math.PI / 2;
        legInnerBottom.position.set(0, -hVal / 2 + 0.01, -0.02);
        group.add(legInnerBottom);

      } else if (tipo === 'barra_45') {
        const hVal = 0.8;
        const mainBarGeo = new THREE.CylinderGeometry(0.01, 0.01, hVal, 16);
        const pinGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.05, 12);

        const barOuter = new THREE.Mesh(mainBarGeo, material);
        barOuter.position.set(0.035, 0, 0.025);
        barOuter.castShadow = true;
        group.add(barOuter);

        const p1Outer = new THREE.Mesh(pinGeo, material);
        p1Outer.position.set(0.0175, hVal * 0.28, 0.0125);
        p1Outer.rotation.z = Math.PI / 4;
        p1Outer.rotation.x = Math.PI / 2;
        group.add(p1Outer);

        const p2Outer = new THREE.Mesh(pinGeo, material);
        p2Outer.position.set(0.0175, -hVal * 0.28, 0.0125);
        p2Outer.rotation.z = -Math.PI / 4;
        p2Outer.rotation.x = Math.PI / 2;
        group.add(p2Outer);

        const barInner = new THREE.Mesh(mainBarGeo, material);
        barInner.position.set(0.035, 0, -0.025);
        barInner.castShadow = true;
        group.add(barInner);

        const p1Inner = new THREE.Mesh(pinGeo, material);
        p1Inner.position.set(0.0175, hVal * 0.28, -0.0125);
        p1Inner.rotation.z = Math.PI / 4;
        p1Inner.rotation.x = Math.PI / 2;
        group.add(p1Inner);

        const p2Inner = new THREE.Mesh(pinGeo, material);
        p2Inner.position.set(0.0175, -hVal * 0.28, -0.0125);
        p2Inner.rotation.z = -Math.PI / 4;
        p2Inner.rotation.x = Math.PI / 2;
        group.add(p2Inner);

      } else {
        const hVal = 0.3;
        const barOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, hVal, 16), material);
        barOuter.position.set(0, 0, 0.015);
        barOuter.castShadow = true;
        group.add(barOuter);
        
        const barInner = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, hVal, 16), material);
        barInner.position.set(0, 0, -0.015);
        barInner.castShadow = true;
        group.add(barInner);
        
        const pinGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.03, 8);
        const pin1 = new THREE.Mesh(pinGeo, material);
        pin1.rotation.x = Math.PI / 2;
        pin1.position.set(0, hVal * 0.28, 0);
        group.add(pin1);
        
        const pin2 = pin1.clone();
        pin2.position.set(0, -hVal * 0.28, 0);
        group.add(pin2);
      }
      return group;
    };

    // Detect special glass types for texture variation
    const glassNameLower = String(corGlass).toLowerCase();
    const isAcidato = glassNameLower.includes('acidato') || glassNameLower.includes('jateado') || glassNameLower.includes('fosqueado');
    const isRefletivo = glassNameLower.includes('refletivo') || glassNameLower.includes('espelhado') || glassNameLower.includes('reflectivo');
    const isSerigrafado = glassNameLower.includes('serigraf') || glassNameLower.includes('pontilhado');
    const isBoreal = glassNameLower.includes('boreal') || glassNameLower.includes('canelado') || glassNameLower.includes('fantasia');

    // Premium physically-based glass — adapts to special types
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: glassHex,
      transparent: true,
      opacity: isAcidato ? 0.7 : isRefletivo ? 0.25 : isSerigrafado ? 0.55 : isBoreal ? 0.6 : 0.35,
      transmission: isAcidato ? 0.3 : isRefletivo ? 0.4 : isSerigrafado ? 0.5 : isBoreal ? 0.45 : 0.92,
      roughness: isAcidato ? 0.85 : isRefletivo ? 0.0 : isSerigrafado ? 0.5 : isBoreal ? 0.65 : 0.02,
      ior: 1.52,
      thickness: isAcidato ? 0.2 : 0.12,
      metalness: isRefletivo ? 0.6 : 0.0,
      clearcoat: isAcidato ? 0.2 : 1.0,
      clearcoatRoughness: isAcidato ? 0.7 : 0.0,
      reflectivity: isRefletivo ? 2.0 : 1.0,
      envMap: envMap,
      envMapIntensity: isRefletivo ? 3.0 : isAcidato ? 0.3 : 1.8,
      side: THREE.DoubleSide,
      depthWrite: false,
      attenuationColor: isRefletivo ? new THREE.Color(0x9999cc) : new THREE.Color(0x88ccee),
      attenuationDistance: isAcidato ? 0.08 : 0.3,
      specularIntensity: isRefletivo ? 2.0 : 1.0,
      specularColor: new THREE.Color(0xffffff)
    });

    // Helper to resolve scenario textures
    const getScenarioTextures = (scenario) => {
      const name = String(scenario || '').toLowerCase();
      if (name === 'banheiro_rustico') {
        return {
          wall: createDarkTileWallTexture(),
          floor: createWoodFloorTexture(),
          wallRoughness: 0.7,
          floorRoughness: 0.4
        };
      } else if (name === 'sala_tijolo') {
        return {
          wall: createBrickWallTexture(),
          floor: createWoodFloorTexture(),
          wallRoughness: 0.9,
          floorRoughness: 0.35
        };
      } else if (name === 'escritorio_concreto') {
        const concrete = createConcreteWallTexture();
        return {
          wall: concrete,
          floor: concrete,
          wallRoughness: 0.8,
          floorRoughness: 0.6
        };
      }
      // default: banheiro_premium
      return {
        wall: createWallTileTexture(),
        floor: createTileFloorTexture(),
        wallRoughness: 0.3,
        floorRoughness: 0.25
      };
    };

    // --- ROOM ENVIRONMENT (only for vidracaria) ---
    if (tipo === 'vidracaria') {
      const textures = getScenarioTextures(cenarioFundo);

      // Floor with tile/wood/concrete texture
      const floorMaterial = new THREE.MeshStandardMaterial({
        map: textures.floor,
        roughness: textures.floorRoughness,
        metalness: 0.05,
        envMap: envMap,
        envMapIntensity: 0.25
      });
      const floorGeo = new THREE.PlaneGeometry(12, 12);
      const floor = new THREE.Mesh(floorGeo, floorMaterial);
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = 0;
      floor.receiveShadow = true;
      scene.add(floor);

      // Walls Setup
      const wallMaterial = new THREE.MeshStandardMaterial({
        map: textures.wall,
        roughness: textures.wallRoughness,
        metalness: 0.02,
        envMap: envMap,
        envMapIntensity: 0.2
      });

      // Left Side Wall (renders a nice room corner)
      const sideWallGeo = new THREE.PlaneGeometry(4.0, 4.0);
      const sideWall = new THREE.Mesh(sideWallGeo, wallMaterial);
      sideWall.position.set(-dimW / 2 - 0.05, 2.0, 2.0);
      sideWall.rotation.y = Math.PI / 2;
      sideWall.receiveShadow = true;
      scene.add(sideWall);

      // Back Wall (renders cutout for doors/windows, solid for box/mirror)
      if (modeloType === 'janela' || modeloType === 'porta') {
        // Wall Left Segment
        const wallLeftW = 2.5 - dimW / 2;
        if (wallLeftW > 0.05) {
          const wallLeftGeo = new THREE.PlaneGeometry(wallLeftW, 4.0);
          const wallLeft = new THREE.Mesh(wallLeftGeo, wallMaterial);
          wallLeft.position.set(-dimW / 2 - wallLeftW / 2, 2.0, -0.05);
          wallLeft.receiveShadow = true;
          scene.add(wallLeft);
        }

        // Wall Right Segment
        const wallRightW = 2.5 - dimW / 2;
        if (wallRightW > 0.05) {
          const wallRightGeo = new THREE.PlaneGeometry(wallRightW, 4.0);
          const wallRight = new THREE.Mesh(wallRightGeo, wallMaterial);
          wallRight.position.set(dimW / 2 + wallRightW / 2, 2.0, -0.05);
          wallRight.receiveShadow = true;
          scene.add(wallRight);
        }

        // Wall Top Segment
        const wallTopH = 4.0 - dimH;
        if (wallTopH > 0.05) {
          const wallTopGeo = new THREE.PlaneGeometry(dimW, wallTopH);
          const wallTop = new THREE.Mesh(wallTopGeo, wallMaterial);
          wallTop.position.set(0, dimH + wallTopH / 2, -0.05);
          wallTop.receiveShadow = true;
          scene.add(wallTop);
        }
      } else {
        // Solid Back Wall
        const backWallGeo = new THREE.PlaneGeometry(5.0, 4.0);
        const backWall = new THREE.Mesh(backWallGeo, wallMaterial);
        backWall.position.set(0, 2.0, -0.05);
        backWall.receiveShadow = true;
        scene.add(backWall);
      }

      // Add realistic shower to Box projects
      if (modeloType === 'box') {
        const showerGroup = new THREE.Group();
        showerGroup.position.set(-dimW / 2 + 0.15, dimH + 0.1, 0.4);
        
        const pipeGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.35, 8);
        const pipe = new THREE.Mesh(pipeGeo, hardwareMaterial);
        pipe.rotation.x = Math.PI / 2;
        pipe.position.set(0, 0, -0.175);
        showerGroup.add(pipe);
        
        const headGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.015, 16);
        const head = new THREE.Mesh(headGeo, hardwareMaterial);
        head.position.set(0, -0.05, 0);
        showerGroup.add(head);
        
        const waterGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8);
        const waterMat = new THREE.MeshBasicMaterial({
          color: 0x93c5fd,
          transparent: true,
          opacity: 0.12
        });
        const water = new THREE.Mesh(waterGeo, waterMat);
        water.position.set(0, -0.65, 0);
        showerGroup.add(water);
        
        projectGroup.add(showerGroup);
      }

      // Contact shadow (soft dark circle under the project)
      const shadowCanvas = document.createElement('canvas');
      shadowCanvas.width = 256;
      shadowCanvas.height = 256;
      const shadowCtx = shadowCanvas.getContext('2d');
      const shadowGrad = shadowCtx.createRadialGradient(128, 128, 0, 128, 128, 128);
      shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.15)');
      shadowGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.06)');
      shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      shadowCtx.fillStyle = shadowGrad;
      shadowCtx.fillRect(0, 0, 256, 256);
      const contactShadowTex = new THREE.CanvasTexture(shadowCanvas);
      const contactShadowGeo = new THREE.PlaneGeometry(dimW * 1.8, 0.8);
      const contactShadowMat = new THREE.MeshBasicMaterial({
        map: contactShadowTex,
        transparent: true,
        depthWrite: false
      });
      const contactShadow = new THREE.Mesh(contactShadowGeo, contactShadowMat);
      contactShadow.rotation.x = -Math.PI / 2;
      contactShadow.position.set(0, 0.002, 0.15);
      scene.add(contactShadow);

      // --- BUILD GLASS PROJECT ---
      projectGroup.position.set(-dimW / 2, 0, 0);

      // Bottom Track
      const trackHeight = 0.05;
      const trackThickness = 0.03;
      const trackGeo = new THREE.BoxGeometry(dimW, trackHeight, trackThickness);
      const bottomTrack = new THREE.Mesh(trackGeo, alumMaterial);
      bottomTrack.position.set(dimW / 2, trackHeight / 2, 0);
      bottomTrack.castShadow = true;
      bottomTrack.receiveShadow = true;
      projectGroup.add(bottomTrack);

      // Top Track (not for espelho)
      if (modeloType !== 'espelho' && modeloType !== 'outros') {
        const isElegance = String(modeloNome).toLowerCase().includes('elegance');
        if (isElegance) {
          const barGeo = new THREE.CylinderGeometry(0.015, 0.015, dimW, 16);
          const topTrack = new THREE.Mesh(barGeo, hardwareMaterial);
          topTrack.rotation.z = Math.PI / 2;
          topTrack.position.set(dimW / 2, dimH - 0.08, 0);
          topTrack.castShadow = true;
          projectGroup.add(topTrack);
        } else {
          const topTrack = new THREE.Mesh(trackGeo, alumMaterial);
          topTrack.position.set(dimW / 2, dimH - trackHeight / 2, 0);
          topTrack.castShadow = true;
          projectGroup.add(topTrack);
        }

        // Side Profiles
        const sideGeo = new THREE.BoxGeometry(trackThickness, dimH, trackThickness);
        const leftProfile = new THREE.Mesh(sideGeo, alumMaterial);
        leftProfile.position.set(trackThickness / 2, dimH / 2, 0);
        leftProfile.castShadow = true;
        projectGroup.add(leftProfile);

        const rightProfile = new THREE.Mesh(sideGeo, alumMaterial);
        rightProfile.position.set(dimW - trackThickness / 2, dimH / 2, 0);
        rightProfile.castShadow = true;
        projectGroup.add(rightProfile);
      }

      // Drawing Panels
      if (modeloType === 'box' || modeloType === 'janela' || modeloType === 'porta') {
        const isSwing = String(modeloNome).toLowerCase().includes('abrir') || String(modeloNome).toLowerCase().includes('giro') || String(modeloNome).toLowerCase().includes('pivotante');
        const isFlex = String(modeloNome).toLowerCase().includes('flex');
        const panelThickness = 0.01;
        const innerH = dimH - trackHeight * 2;

        if (isSwing) {
          const hingeLeft = lado === 'esquerda';
          
          // Fixed Panel
          const fixedW = dimW * 0.4;
          const fixedGeo = new THREE.BoxGeometry(fixedW, innerH, panelThickness);
          const fixedMesh = new THREE.Mesh(fixedGeo, glassMaterial);
          fixedMesh.position.set(hingeLeft ? (dimW - fixedW / 2) : (fixedW / 2), dimH / 2, 0);
          fixedMesh.castShadow = true;
          projectGroup.add(fixedMesh);

          // Hinge profile (on the wall side)
          const hingeBarGeo = new THREE.CylinderGeometry(0.01, 0.01, innerH, 8);
          const hingeBar = new THREE.Mesh(hingeBarGeo, alumMaterial);
          hingeBar.position.set(hingeLeft ? 0 : dimW, dimH / 2, 0);
          projectGroup.add(hingeBar);

          // Moving door panel (hinges on the wall side)
          const doorW = dimW - fixedW;
          const isPivot = String(modeloNome || '').toLowerCase().includes('pivotante');
          const pivotOffset = isPivot ? doorW * 0.15 : 0.0;

          const doorGroup = new THREE.Group();
          doorGroup.position.set(hingeLeft ? (pivotOffset) : (dimW - pivotOffset), dimH / 2, 0);
          projectGroup.add(doorGroup);

          const doorGeo = new THREE.BoxGeometry(doorW, innerH, panelThickness);
          const doorMesh = new THREE.Mesh(doorGeo, glassMaterial);
          doorMesh.position.set(hingeLeft ? (doorW / 2 - pivotOffset) : -(doorW / 2 - pivotOffset), 0, 0);
          doorMesh.castShadow = true;
          doorGroup.add(doorMesh);

          // Realistic Hinges / Pivot Pins
          if (isPivot) {
            // Draw top and bottom pivot pins/clamps at x = 0 in local coordinates
            const pivotPinGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.04, 16);
            const clampGeo = new THREE.BoxGeometry(0.04, 0.025, 0.024);

            const topHinge = new THREE.Group();
            topHinge.position.set(0, innerH / 2 - 0.02, 0);
            const pinTop = new THREE.Mesh(pivotPinGeo, hardwareMaterial);
            pinTop.position.set(0, 0.02, 0);
            topHinge.add(pinTop);
            const clampTop = new THREE.Mesh(clampGeo, hardwareMaterial);
            clampTop.position.set(hingeLeft ? 0.015 : -0.015, 0, 0);
            topHinge.add(clampTop);
            doorGroup.add(topHinge);

            const bottomHinge = new THREE.Group();
            bottomHinge.position.set(0, -innerH / 2 + 0.02, 0);
            const pinBottom = new THREE.Mesh(pivotPinGeo, hardwareMaterial);
            pinBottom.position.set(0, -0.02, 0);
            bottomHinge.add(pinBottom);
            const clampBottom = new THREE.Mesh(clampGeo, hardwareMaterial);
            clampBottom.position.set(hingeLeft ? 0.015 : -0.015, 0, 0);
            bottomHinge.add(clampBottom);
            doorGroup.add(bottomHinge);
          } else {
            // Draw normal hinges
            const hingeGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.07, 16);
            const hingeClampGeo = new THREE.BoxGeometry(0.04, 0.03, 0.024);

            const h1 = new THREE.Group();
            h1.position.set(0, innerH / 3, 0);
            h1.add(new THREE.Mesh(hingeGeo, hardwareMaterial));
            const h1Clamp = new THREE.Mesh(hingeClampGeo, hardwareMaterial);
            h1Clamp.position.set(hingeLeft ? 0.015 : -0.015, 0, 0);
            h1.add(h1Clamp);
            doorGroup.add(h1);

            const h2 = new THREE.Group();
            h2.position.set(0, -innerH / 3, 0);
            h2.add(new THREE.Mesh(hingeGeo, hardwareMaterial));
            const h2Clamp = new THREE.Mesh(hingeClampGeo, hardwareMaterial);
            h2Clamp.position.set(hingeLeft ? 0.015 : -0.015, 0, 0);
            h2.add(h2Clamp);
            doorGroup.add(h2);
          }

          // Silicone seal (in the middle, between fixed and door panels)
          const fixedSealGeo = new THREE.BoxGeometry(0.005, innerH, 0.012);
          const fixedSeal = new THREE.Mesh(fixedSealGeo, siliconeMaterial);
          fixedSeal.position.set(hingeLeft ? -fixedW / 2 + 0.0025 : fixedW / 2 - 0.0025, 0, 0);
          fixedMesh.add(fixedSeal);

          // Handle
          if (puxador !== 'sem') {
            const handleMesh = createPuxadorGroup(puxador, alumMaterial);
            handleMesh.position.set(
              hingeLeft ? (doorW - pivotOffset - 0.05) : (-doorW + pivotOffset + 0.05),
              0,
              0
            );
            doorGroup.add(handleMesh);
          }

          const senseMult = sentido === 'dentro' ? 1 : -1;
          animatedObjects.push({
            type: 'swing',
            group: doorGroup,
            direction: (hingeLeft ? 1 : -1) * senseMult,
            targetVal: 0
          });

        } else if (isFlex) {
          const panelW = dimW / 2;
          const foldLeft = lado === 'esquerda';

          const flexGroup = new THREE.Group();
          flexGroup.position.set(foldLeft ? 0 : dimW, dimH / 2, 0);
          projectGroup.add(flexGroup);

          const panel1Geo = new THREE.BoxGeometry(panelW, innerH, panelThickness);
          const panel1Mesh = new THREE.Mesh(panel1Geo, glassMaterial);
          panel1Mesh.position.set(foldLeft ? (panelW / 2) : (-panelW / 2), 0, 0);
          panel1Mesh.castShadow = true;
          
          const panel1Group = new THREE.Group();
          panel1Group.add(panel1Mesh);
          flexGroup.add(panel1Group);

          const panel2Group = new THREE.Group();
          panel2Group.position.set(foldLeft ? panelW : -panelW, 0, 0);
          panel1Group.add(panel2Group);

          const panel2Mesh = new THREE.Mesh(panel1Geo, glassMaterial);
          panel2Mesh.position.set(foldLeft ? (panelW / 2) : (-panelW / 2), 0, 0);
          panel2Mesh.castShadow = true;
          panel2Group.add(panel2Mesh);

          const flexHingeGeo = new THREE.CylinderGeometry(0.007, 0.007, innerH, 8);
          const flexHinge = new THREE.Mesh(flexHingeGeo, alumMaterial);
          panel2Group.add(flexHinge);

          animatedObjects.push({
            type: 'flex',
            group1: panel1Group,
            group2: panel2Group,
            direction: foldLeft ? 1 : -1,
            targetVal: 0
          });

        } else {
          // Slider panels (standard)
          const isLeftOpen = lado === 'esquerda';
          const fixedW = dimW / 2;
          const movingW = dimW / 2 + 0.02;

          const fixedGeo = new THREE.BoxGeometry(fixedW, innerH, panelThickness);
          const fixedMesh = new THREE.Mesh(fixedGeo, glassMaterial);
          fixedMesh.position.set(isLeftOpen ? (dimW - fixedW / 2) : (fixedW / 2), dimH / 2, -0.015);
          fixedMesh.castShadow = true;
          projectGroup.add(fixedMesh);

          const sliderGeo = new THREE.BoxGeometry(movingW, innerH, panelThickness);
          const sliderMesh = new THREE.Mesh(sliderGeo, glassMaterial);
          sliderMesh.position.set(isLeftOpen ? (movingW / 2) : (dimW - movingW / 2), dimH / 2, 0.015);
          sliderMesh.castShadow = true;
          projectGroup.add(sliderMesh);

          // Roldanas for Elegance
          const isElegance = String(modeloNome).toLowerCase().includes('elegance');
          if (isElegance) {
            const wheelGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.012, 16);
            const clampGeo = new THREE.BoxGeometry(0.015, 0.05, 0.02);

            const w1Group = new THREE.Group();
            w1Group.position.set(isLeftOpen ? -movingW / 2 + 0.12 : -movingW / 2 + 0.12, innerH / 2 + 0.04, -0.015);
            const w1Wheel = new THREE.Mesh(wheelGeo, hardwareMaterial);
            w1Wheel.rotation.x = Math.PI / 2;
            w1Group.add(w1Wheel);
            const w1Clamp = new THREE.Mesh(clampGeo, hardwareMaterial);
            w1Clamp.position.set(0, -0.025, 0.008);
            w1Group.add(w1Clamp);
            sliderMesh.add(w1Group);

            const w2Group = new THREE.Group();
            w2Group.position.set(isLeftOpen ? movingW / 2 - 0.12 : movingW / 2 - 0.12, innerH / 2 + 0.04, -0.015);
            const w2Wheel = new THREE.Mesh(wheelGeo, hardwareMaterial);
            w2Wheel.rotation.x = Math.PI / 2;
            w2Group.add(w2Wheel);
            const w2Clamp = new THREE.Mesh(clampGeo, hardwareMaterial);
            w2Clamp.position.set(0, -0.025, 0.008);
            w2Group.add(w2Clamp);
            sliderMesh.add(w2Group);
          }

          // Silicone seal
          const sealGeo = new THREE.BoxGeometry(0.006, innerH, 0.015);
          const sealMesh = new THREE.Mesh(sealGeo, siliconeMaterial);
          sealMesh.position.set(isLeftOpen ? -movingW / 2 : movingW / 2, 0, 0);
          sliderMesh.add(sealMesh);

          // Handle
          let handleMesh = null;
          if (puxador !== 'sem') {
            handleMesh = createPuxadorGroup(puxador, alumMaterial);
            handleMesh.position.set(isLeftOpen ? (movingW - 0.06) : (dimW - movingW + 0.06), dimH / 2, 0.015);
            projectGroup.add(handleMesh);
          }

          animatedObjects.push({
            type: 'slide',
            mesh: sliderMesh,
            handle: handleMesh,
            direction: isLeftOpen ? 1 : -1,
            baseX: isLeftOpen ? (movingW / 2) : (dimW - movingW / 2),
            handleBaseX: isLeftOpen ? (movingW - 0.06) : (dimW - movingW + 0.06),
            travel: fixedW - 0.05,
            targetVal: 0
          });
        }
      } else if (modeloType === 'espelho') {
        const benchY = 0.85; // height of bench
        const mirrorGeo = new THREE.BoxGeometry(dimW, dimH, 0.008);
        const mirrorMat = new THREE.MeshPhysicalMaterial({
          color: 0xd4e4f0,
          metalness: 0.98,
          roughness: 0.02,
          envMap: envMap,
          envMapIntensity: 2.0,
          clearcoat: 1.0,
          clearcoatRoughness: 0.0,
          reflectivity: 1.0
        });
        const mirrorMesh = new THREE.Mesh(mirrorGeo, mirrorMat);
        mirrorMesh.position.set(dimW / 2, benchY + dimH / 2 + 0.02, 0.004);
        mirrorMesh.castShadow = true;
        projectGroup.add(mirrorMesh);

        const backingGeo = new THREE.BoxGeometry(dimW + 0.02, dimH + 0.02, 0.015);
        const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8 });
        const backingMesh = new THREE.Mesh(backingGeo, woodMaterial);
        backingMesh.position.set(dimW / 2, benchY + dimH / 2 + 0.02, -0.006);
        projectGroup.add(backingMesh);

        // Bench under mirror
        const benchW = dimW + 0.4;
        const benchH = 0.04;
        const benchD = 0.5;
        const benchGeo = new THREE.BoxGeometry(benchW, benchH, benchD);
        const stoneTex = createMarbleTexture('carrara');
        const benchMat = new THREE.MeshStandardMaterial({
          map: stoneTex,
          roughness: 0.1,
          metalness: 0.1,
          envMap: envMap,
          envMapIntensity: 0.5
        });
        const bench = new THREE.Mesh(benchGeo, benchMat);
        bench.position.set(dimW / 2, benchY - benchH / 2, benchD / 2 - 0.05);
        bench.castShadow = true;
        bench.receiveShadow = true;
        projectGroup.add(bench);
      } else {
        const panelGeo = new THREE.BoxGeometry(dimW, dimH, 0.01);
        const panelMesh = new THREE.Mesh(panelGeo, glassMaterial);
        panelMesh.position.set(dimW / 2, dimH / 2, 0);
        panelMesh.castShadow = true;
        projectGroup.add(panelMesh);
      }

      // Camera default position for vidracaria — closer, dramatic angle
      const camDist = 2.8;
      if (modeloType === 'espelho') {
        controls.target.set(0, 0.85 + dimH * 0.4, 0);
        camera.position.set(0, 0.85 + dimH * 0.6, 2.0); // centered eye-level
      } else {
        camera.position.set(camDist * 0.85, dimH * 0.45, camDist * 0.95);
        controls.target.set(0, dimH * 0.4, 0);
      }

    } else if (tipo === 'serralheria') {
      // --- SERRALHERIA 3D RENDER ---
      const textures = getScenarioTextures(cenarioFundo);

      // Floor (simple concrete)
      const floorMaterial = new THREE.MeshStandardMaterial({
        map: textures.floor,
        roughness: 0.5,
        metalness: 0.1,
        envMap: envMap,
        envMapIntensity: 0.3
      });
      const floorGeo = new THREE.PlaneGeometry(12, 12);
      const floor = new THREE.Mesh(floorGeo, floorMaterial);
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = 0;
      floor.receiveShadow = true;
      scene.add(floor);

      const metalMat = new THREE.MeshStandardMaterial({
        color: getMetalColorHex(aluminio),
        metalness: 0.85,
        roughness: 0.3,
        envMap: envMap,
        envMapIntensity: 0.9
      });

      // Group to hold the project meshes
      const projectGroup = new THREE.Group();
      scene.add(projectGroup);

      const isClosed = String(modeloNome || '').toLowerCase().includes('lambril') || String(modeloNome || '').toLowerCase().includes('fechado') || String(modeloNome || '').toLowerCase().includes('chapa');

      if (modeloType === 'portao') {
        // Draw Gate
        const numLeaves = Number(qtdeFolhas || 1);
        const leafW = dimW / numLeaves;
        const profileThick = 0.04; // 40mm
        const borderW = 0.05; // 50mm

        // 1. Fixed outer posts (columns)
        const postGeo = new THREE.BoxGeometry(0.06, dimH + 0.1, 0.06);
        const leftPost = new THREE.Mesh(postGeo, metalMat);
        leftPost.position.set(-dimW / 2 - 0.03, (dimH + 0.1) / 2, 0);
        leftPost.castShadow = true;
        leftPost.receiveShadow = true;
        projectGroup.add(leftPost);

        const rightPost = new THREE.Mesh(postGeo, metalMat);
        rightPost.position.set(dimW / 2 + 0.03, (dimH + 0.1) / 2, 0);
        rightPost.castShadow = true;
        rightPost.receiveShadow = true;
        projectGroup.add(rightPost);

        // Top track
        const trackGeo = new THREE.BoxGeometry(dimW + 0.12, 0.04, 0.04);
        const topTrack = new THREE.Mesh(trackGeo, metalMat);
        topTrack.position.set(0, dimH + 0.08, 0);
        topTrack.castShadow = true;
        projectGroup.add(topTrack);

        // Ground track
        const railGeo = new THREE.CylinderGeometry(0.008, 0.008, dimW + 0.2, 8);
        const rail = new THREE.Mesh(railGeo, metalMat);
        rail.rotation.z = Math.PI / 2;
        rail.position.set(0, 0.008, 0);
        projectGroup.add(rail);

        // 2. Draw Leaves
        for (let idx = 0; idx < numLeaves; idx++) {
          const lX = -dimW / 2 + idx * leafW + leafW / 2;
          const leafGroup = new THREE.Group();
          leafGroup.position.set(lX, dimH / 2, 0);
          
          // Leaf Frame borders
          // Left border
          const sideGeo = new THREE.BoxGeometry(borderW, dimH - 0.02, profileThick);
          const leftB = new THREE.Mesh(sideGeo, metalMat);
          leftB.position.set(-leafW / 2 + borderW / 2, 0, 0);
          leftB.castShadow = true;
          leafGroup.add(leftB);

          // Right border
          const rightB = new THREE.Mesh(sideGeo, metalMat);
          rightB.position.set(leafW / 2 - borderW / 2, 0, 0);
          rightB.castShadow = true;
          leafGroup.add(rightB);

          // Top border
          const horizGeo = new THREE.BoxGeometry(leafW, borderW, profileThick);
          const topB = new THREE.Mesh(horizGeo, metalMat);
          topB.position.set(0, dimH / 2 - borderW / 2, 0);
          topB.castShadow = true;
          leafGroup.add(topB);

          // Bottom border
          const bottomB = new THREE.Mesh(horizGeo, metalMat);
          bottomB.position.set(0, -dimH / 2 + borderW / 2, 0);
          bottomB.castShadow = true;
          leafGroup.add(bottomB);

          // Central horizontal support bar
          const centerB = new THREE.Mesh(new THREE.BoxGeometry(leafW, 0.04, profileThick * 0.8), metalMat);
          centerB.position.set(0, 0, 0);
          centerB.castShadow = true;
          leafGroup.add(centerB);

          // Inner slats or bars
          if (isClosed) {
            // Horizontal slats (lambril)
            const slatsCount = Math.floor((dimH - borderW * 2) / 0.12);
            const slatH = 0.10;
            const slatW = leafW - borderW * 2 - 0.002;
            const slatGeo = new THREE.BoxGeometry(slatW, slatH, 0.008);
            
            for (let j = 0; j < slatsCount; j++) {
              const slatY = -dimH / 2 + borderW + 0.06 + j * 0.12;
              if (Math.abs(slatY) > (dimH / 2 - borderW - 0.04)) continue;
              const slat = new THREE.Mesh(slatGeo, metalMat);
              slat.position.set(0, slatY, 0);
              slat.castShadow = true;
              leafGroup.add(slat);
            }
          } else {
            // Vertical bars
            const barS = 0.12; // Spacing
            const barW = 0.015;
            const barCount = Math.floor((leafW - borderW * 2) / barS);
            const barGeo = new THREE.CylinderGeometry(barW / 2, barW / 2, dimH - borderW * 2, 8);

            for (let j = 1; j <= barCount; j++) {
              const barX = -leafW / 2 + borderW + j * barS;
              if (barX > (leafW / 2 - borderW - 0.02)) continue;
              const bar = new THREE.Mesh(barGeo, metalMat);
              bar.position.set(barX, 0, 0);
              bar.castShadow = true;
              leafGroup.add(bar);
            }
          }

          // Roldana wheels on bottom
          const wheelGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.012, 12);
          wheelGeo.rotateX(Math.PI / 2);
          const w1 = new THREE.Mesh(wheelGeo, metalMat);
          w1.position.set(-leafW / 3, -dimH / 2 - 0.015, 0);
          leafGroup.add(w1);

          const w2 = new THREE.Mesh(wheelGeo, metalMat);
          w2.position.set(leafW / 3, -dimH / 2 - 0.015, 0);
          leafGroup.add(w2);

          // Handle (on the first leaf only)
          if (puxador !== 'sem' && idx === 0) {
            const pullGeo = new THREE.BoxGeometry(0.015, 0.3, 0.03);
            const handle = new THREE.Mesh(pullGeo, metalMat);
            const handleSide = lado === 'esquerda' ? (-leafW / 2 + borderW + 0.04) : (leafW / 2 - borderW - 0.04);
            handle.position.set(handleSide, 0, 0.035);
            handle.castShadow = true;
            leafGroup.add(handle);
          }

          projectGroup.add(leafGroup);
        }

        camera.position.set(dimW * 0.9, dimH * 0.7, 2.2);
        controls.target.set(0, dimH / 2, 0);

      } else if (modeloType === 'grade') {
        // Draw Railing / Grille
        const borderW = 0.03;
        const frameGeo = new THREE.BoxGeometry(dimW, borderW, borderW);
        
        // Top rail
        const topRail = new THREE.Mesh(frameGeo, metalMat);
        topRail.position.set(0, dimH - borderW / 2, 0);
        topRail.castShadow = true;
        projectGroup.add(topRail);

        // Bottom rail
        const bottomRail = new THREE.Mesh(frameGeo, metalMat);
        bottomRail.position.set(0, borderW / 2, 0);
        bottomRail.castShadow = true;
        projectGroup.add(bottomRail);

        // Side Columns
        const colGeo = new THREE.BoxGeometry(0.04, dimH + 0.2, 0.04);
        const leftCol = new THREE.Mesh(colGeo, metalMat);
        leftCol.position.set(-dimW / 2 - 0.02, dimH / 2, 0);
        leftCol.castShadow = true;
        projectGroup.add(leftCol);

        const rightCol = new THREE.Mesh(colGeo, metalMat);
        rightCol.position.set(dimW / 2 + 0.02, dimH / 2, 0);
        rightCol.castShadow = true;
        projectGroup.add(rightCol);

        // Vertical bars with decorative spears on top
        const barS = 0.12;
        const barRad = 0.008;
        const barCount = Math.floor((dimW - 0.08) / barS);
        const barGeo = new THREE.CylinderGeometry(barRad, barRad, dimH - borderW, 12);
        const spearGeo = new THREE.ConeGeometry(0.015, 0.04, 8);

        for (let j = 1; j <= barCount; j++) {
          const barX = -dimW / 2 + 0.04 + j * barS;
          if (barX > (dimW / 2 - 0.04)) continue;

          // Bar mesh
          const bar = new THREE.Mesh(barGeo, metalMat);
          bar.position.set(barX, dimH / 2, 0);
          bar.castShadow = true;
          projectGroup.add(bar);

          // Spear cap
          const spear = new THREE.Mesh(spearGeo, metalMat);
          spear.position.set(barX, dimH + 0.015, 0);
          spear.castShadow = true;
          projectGroup.add(spear);
        }

        camera.position.set(dimW * 0.8, dimH * 0.6, 2.0);
        controls.target.set(0, dimH / 2, 0);

      } else if (modeloType === 'telhado') {
        const numAguas = Number(qtdeFolhas || 1);
        const sl = Number(slope) || 10;
        const projectionM = dimH;
        const slopeAngle = Math.atan(sl / 100);
        const slopeFactor = Math.sqrt(1 + Math.pow(sl / 100, 2));
        
        // Material da cobertura
        const glassColorHex = getGlassHexColor(corGlass || 'Incolor');
        const sheetMat = new THREE.MeshPhysicalMaterial({
          color: glassColorHex,
          transparent: true,
          opacity: 0.65,
          roughness: 0.15,
          metalness: 0.1,
          transmission: 0.85,
          envMap: envMap,
          envMapIntensity: 1.0,
          clearcoat: 1.0
        });

        // 1. Paredes/Colunas de Apoio de acordo com o caimento
        if (numAguas === 1) {
          // 1 Água (Monopitch / Meia-Água)
          const backWallGeo = new THREE.BoxGeometry(dimW + 0.4, 3.0, 0.1);
          const backWallMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.7 });
          const backWall = new THREE.Mesh(backWallGeo, backWallMat);
          backWall.position.set(0, 1.5, -0.05);
          backWall.receiveShadow = true;
          projectGroup.add(backWall);

          const pillarGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.0, 8);
          const leftPillar = new THREE.Mesh(pillarGeo, metalMat);
          leftPillar.position.set(-dimW / 2 + 0.05, 1.0, projectionM - 0.05);
          leftPillar.castShadow = true;
          projectGroup.add(leftPillar);

          const rightPillar = new THREE.Mesh(pillarGeo, metalMat);
          rightPillar.position.set(dimW / 2 - 0.05, 1.0, projectionM - 0.05);
          rightPillar.castShadow = true;
          projectGroup.add(rightPillar);

          // Estrutura inclinada (1 água)
          const slopedLength = Math.sqrt(Math.pow(projectionM, 2) + Math.pow(projectionM * (sl / 100), 2));
          const rafterPitchGroup = new THREE.Group();
          rafterPitchGroup.position.set(0, 2.0, 0);
          rafterPitchGroup.rotation.x = slopeAngle;

          const raftersCount = Math.ceil(dimW / 1.5) + 1;
          const rafterGeo = new THREE.BoxGeometry(0.04, 0.06, slopedLength);
          for (let j = 0; j < raftersCount; j++) {
            const rX = -dimW / 2 + (j * (dimW / (raftersCount - 1)));
            const rafter = new THREE.Mesh(rafterGeo, metalMat);
            rafter.position.set(rX, -0.03, slopedLength / 2);
            rafter.castShadow = true;
            rafterPitchGroup.add(rafter);
          }

          const purlinS = 0.8;
          const purlinsCount = Math.ceil(slopedLength / purlinS) + 1;
          const purlinGeo = new THREE.BoxGeometry(dimW, 0.03, 0.03);
          for (let j = 0; j < purlinsCount; j++) {
            const pZ = (j * (slopedLength / (purlinsCount - 1)));
            const purlin = new THREE.Mesh(purlinGeo, metalMat);
            purlin.position.set(0, 0.015, pZ);
            purlin.castShadow = true;
            rafterPitchGroup.add(purlin);
          }

          const sheetGeo = new THREE.BoxGeometry(dimW + 0.1, 0.008, slopedLength + 0.1);
          const coverSheet = new THREE.Mesh(sheetGeo, sheetMat);
          coverSheet.position.set(0, 0.03, slopedLength / 2);
          coverSheet.castShadow = true;
          rafterPitchGroup.add(coverSheet);

          projectGroup.add(rafterPitchGroup);
        }
        else if (numAguas === 2) {
          // 2 Águas (Gable Roof)
          // Colunas nas 4 pontas
          const pillarGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.6, 8);
          
          const pPositions = [
            [-dimW/2 + 0.05, 0.8, 0.05],
            [dimW/2 - 0.05, 0.8, 0.05],
            [-dimW/2 + 0.05, 0.8, projectionM - 0.05],
            [dimW/2 - 0.05, 0.8, projectionM - 0.05]
          ];
          pPositions.forEach(([x, y, z]) => {
            const pillar = new THREE.Mesh(pillarGeo, metalMat);
            pillar.position.set(x, y, z);
            pillar.castShadow = true;
            projectGroup.add(pillar);
          });

          // Suportes centrais para cumeira (front e back)
          const ridgePillarGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.0, 8);
          const leftRidgePillar = new THREE.Mesh(ridgePillarGeo, metalMat);
          leftRidgePillar.position.set(-dimW/2 + 0.05, 1.0, projectionM/2);
          projectGroup.add(leftRidgePillar);
          const rightRidgePillar = new THREE.Mesh(ridgePillarGeo, metalMat);
          rightRidgePillar.position.set(dimW/2 - 0.05, 1.0, projectionM/2);
          projectGroup.add(rightRidgePillar);

          // Cumeira Central Horizontal
          const ridgeGeo = new THREE.BoxGeometry(dimW + 0.1, 0.06, 0.06);
          const ridge = new THREE.Mesh(ridgeGeo, metalMat);
          ridge.position.set(0, 2.0, projectionM / 2);
          projectGroup.add(ridge);

          // Caimentos (2 vertentes)
          const slopedLengthHalf = (projectionM / 2) * slopeFactor;
          const rafterGeo = new THREE.BoxGeometry(0.04, 0.06, slopedLengthHalf);
          const raftersCount = Math.ceil(dimW / 1.5) + 1;
          const purlinGeo = new THREE.BoxGeometry(dimW, 0.03, 0.03);
          const purlinsCount = Math.ceil(slopedLengthHalf / 0.8) + 1;
          const sheetGeo = new THREE.BoxGeometry(dimW + 0.08, 0.008, slopedLengthHalf);

          // Vertente Traseira (slopes from center Z = projectionM/2 to Z = 0)
          const slopeBack = new THREE.Group();
          slopeBack.position.set(0, 2.0, projectionM / 2);
          slopeBack.rotation.x = -slopeAngle;
          for (let j = 0; j < raftersCount; j++) {
            const rX = -dimW / 2 + (j * (dimW / (raftersCount - 1)));
            const rafter = new THREE.Mesh(rafterGeo, metalMat);
            rafter.position.set(rX, -0.03, slopedLengthHalf / 2);
            slopeBack.add(rafter);
          }
          for (let j = 0; j < purlinsCount; j++) {
            const pZ = (j * (slopedLengthHalf / (purlinsCount - 1)));
            const purlin = new THREE.Mesh(purlinGeo, metalMat);
            purlin.position.set(0, 0.015, pZ);
            slopeBack.add(purlin);
          }
          const sheetBack = new THREE.Mesh(sheetGeo, sheetMat);
          sheetBack.position.set(0, 0.03, slopedLengthHalf / 2);
          slopeBack.add(sheetBack);
          projectGroup.add(slopeBack);

          // Vertente Dianteira (slopes from center Z = projectionM/2 to Z = projectionM)
          const slopeFront = new THREE.Group();
          slopeFront.position.set(0, 2.0, projectionM / 2);
          slopeFront.rotation.x = slopeAngle;
          for (let j = 0; j < raftersCount; j++) {
            const rX = -dimW / 2 + (j * (dimW / (raftersCount - 1)));
            const rafter = new THREE.Mesh(rafterGeo, metalMat);
            rafter.position.set(rX, -0.03, slopedLengthHalf / 2);
            slopeFront.add(rafter);
          }
          for (let j = 0; j < purlinsCount; j++) {
            const pZ = (j * (slopedLengthHalf / (purlinsCount - 1)));
            const purlin = new THREE.Mesh(purlinGeo, metalMat);
            purlin.position.set(0, 0.015, pZ);
            slopeFront.add(purlin);
          }
          const sheetFront = new THREE.Mesh(sheetGeo, sheetMat);
          sheetFront.position.set(0, 0.03, slopedLengthHalf / 2);
          slopeFront.add(sheetFront);
          projectGroup.add(slopeFront);
        }
        else {
          // 3 ou 4 Águas (Hip / Pyramidal Roof)
          // Colunas nas 4 pontas
          const pillarGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.5, 8);
          const pPositions = [
            [-dimW/2 + 0.05, 0.75, 0.05],
            [dimW/2 - 0.05, 0.75, 0.05],
            [-dimW/2 + 0.05, 0.75, projectionM - 0.05],
            [dimW/2 - 0.05, 0.75, projectionM - 0.05]
          ];
          pPositions.forEach(([x, y, z]) => {
            const pillar = new THREE.Mesh(pillarGeo, metalMat);
            pillar.position.set(x, y, z);
            pillar.castShadow = true;
            projectGroup.add(pillar);
          });

          // Moldura de base retangular horizontal
          const baseFrameGeo1 = new THREE.BoxGeometry(dimW, 0.05, 0.05);
          const base1 = new THREE.Mesh(baseFrameGeo1, metalMat);
          base1.position.set(0, 1.5, 0.025);
          projectGroup.add(base1);
          const base2 = new THREE.Mesh(baseFrameGeo1, metalMat);
          base2.position.set(0, 1.5, projectionM - 0.025);
          projectGroup.add(base2);
          
          const baseFrameGeo2 = new THREE.BoxGeometry(0.05, 0.05, projectionM);
          const base3 = new THREE.Mesh(baseFrameGeo2, metalMat);
          base3.position.set(-dimW/2 + 0.025, 1.5, projectionM/2);
          projectGroup.add(base3);
          const base4 = new THREE.Mesh(baseFrameGeo2, metalMat);
          base4.position.set(dimW/2 - 0.025, 1.5, projectionM/2);
          projectGroup.add(base4);

          // Cumeira Central Horizontal (se W > H)
          const ridgeW = Math.max(0.1, dimW - projectionM);
          const ridgeGeo = new THREE.BoxGeometry(ridgeW, 0.05, 0.05);
          const ridge = new THREE.Mesh(ridgeGeo, metalMat);
          ridge.position.set(0, 2.0, projectionM / 2);
          projectGroup.add(ridge);

          // Espigões inclinados dos cantos
          const leftRidgeX = -ridgeW / 2;
          const rightRidgeX = ridgeW / 2;
          
          const hipCoords = [
            [-dimW/2, 0, leftRidgeX, projectionM/2],
            [-dimW/2, projectionM, leftRidgeX, projectionM/2],
            [dimW/2, 0, rightRidgeX, projectionM/2],
            [dimW/2, projectionM, rightRidgeX, projectionM/2]
          ];

          hipCoords.forEach(([xS, zS, xE, zE], idx) => {
            if (numAguas === 3 && idx >= 2) return; // se 3 águas, desenha apenas um lado com caimento triangular
            const startVec = new THREE.Vector3(xS, 1.5, zS);
            const endVec = new THREE.Vector3(xE, 2.0, zE);
            
            const distance = startVec.distanceTo(endVec);
            const hipGeo = new THREE.CylinderGeometry(0.025, 0.025, distance, 8);
            const hipMesh = new THREE.Mesh(hipGeo, metalMat);
            
            // Posicionar no ponto médio
            const midPoint = new THREE.Vector3().addVectors(startVec, endVec).multiplyScalar(0.5);
            hipMesh.position.copy(midPoint);
            
            // Rotacionar para apontar do início ao fim
            const direction = new THREE.Vector3().subVectors(endVec, startVec).normalize();
            const up = new THREE.Vector3(0, 1, 0);
            hipMesh.quaternion.setFromUnitVectors(up, direction);
            hipMesh.castShadow = true;
            projectGroup.add(hipMesh);
          });

          // Renderizar as vertentes de cobertura inclinadas convergentes
          const slopedLengthHalf = (projectionM / 2) * slopeFactor;
          const sheetGeoFrontBack = new THREE.BoxGeometry(dimW - 0.2, 0.008, slopedLengthHalf);
          
          // Traseira
          const sheetBack = new THREE.Mesh(sheetGeoFrontBack, sheetMat);
          sheetBack.position.set(0, 2.0, projectionM/2);
          sheetBack.rotation.x = -slopeAngle;
          sheetBack.position.z -= slopedLengthHalf / 2;
          sheetBack.position.y -= (slopedLengthHalf / 2) * Math.sin(slopeAngle);
          projectGroup.add(sheetBack);

          // Dianteira
          const sheetFront = new THREE.Mesh(sheetGeoFrontBack, sheetMat);
          sheetFront.position.set(0, 2.0, projectionM/2);
          sheetFront.rotation.x = slopeAngle;
          sheetFront.position.z += slopedLengthHalf / 2;
          sheetFront.position.y -= (slopedLengthHalf / 2) * Math.sin(slopeAngle);
          projectGroup.add(sheetFront);

          // Laterais (Esquerda e Direita)
          const slopedLengthHalfLeft = (dimW / 2) * slopeFactor;
          const sheetGeoLeftRight = new THREE.BoxGeometry(slopedLengthHalfLeft, 0.008, projectionM - 0.2);

          const sheetLeft = new THREE.Mesh(sheetGeoLeftRight, sheetMat);
          sheetLeft.position.set(-dimW/2, 2.0, projectionM/2);
          sheetLeft.rotation.z = slopeAngle;
          sheetLeft.position.x += slopedLengthHalfLeft / 2;
          sheetLeft.position.y -= (slopedLengthHalfLeft / 2) * Math.sin(slopeAngle);
          projectGroup.add(sheetLeft);

          if (numAguas === 4) {
            const sheetRight = new THREE.Mesh(sheetGeoLeftRight, sheetMat);
            sheetRight.position.set(dimW/2, 2.0, projectionM/2);
            sheetRight.rotation.z = -slopeAngle;
            sheetRight.position.x -= slopedLengthHalfLeft / 2;
            sheetRight.position.y -= (slopedLengthHalfLeft / 2) * Math.sin(slopeAngle);
            projectGroup.add(sheetRight);
          }
        }

        camera.position.set(dimW * 0.9, 2.5, projectionM * 2.2);
        controls.target.set(0, 1.2, projectionM / 2);

      } else if (modeloType === 'movel') {
        // Draw Table / Furniture
        const legH = dimH - 0.03;
        const depth = 0.6; // 600mm depth
        const legGeo = new THREE.BoxGeometry(0.04, legH, 0.04);
        
        // 4 Legs
        const l1 = new THREE.Mesh(legGeo, metalMat);
        l1.position.set(-dimW / 2 + 0.02, legH / 2, -depth / 2 + 0.02);
        l1.castShadow = true;
        projectGroup.add(l1);

        const l2 = new THREE.Mesh(legGeo, metalMat);
        l2.position.set(dimW / 2 - 0.02, legH / 2, -depth / 2 + 0.02);
        l2.castShadow = true;
        projectGroup.add(l2);

        const l3 = new THREE.Mesh(legGeo, metalMat);
        l3.position.set(-dimW / 2 + 0.02, legH / 2, depth / 2 - 0.02);
        l3.castShadow = true;
        projectGroup.add(l3);

        const l4 = new THREE.Mesh(legGeo, metalMat);
        l4.position.set(dimW / 2 - 0.02, legH / 2, depth / 2 - 0.02);
        l4.castShadow = true;
        projectGroup.add(l4);

        // Top structural frames connecting legs
        const railLongGeo = new THREE.BoxGeometry(dimW, 0.04, 0.04);
        const railShortGeo = new THREE.BoxGeometry(0.04, 0.04, depth - 0.08);

        const top1 = new THREE.Mesh(railLongGeo, metalMat);
        top1.position.set(0, legH - 0.02, -depth / 2 + 0.02);
        top1.castShadow = true;
        projectGroup.add(top1);

        const top2 = new THREE.Mesh(railLongGeo, metalMat);
        top2.position.set(0, legH - 0.02, depth / 2 - 0.02);
        top2.castShadow = true;
        projectGroup.add(top2);

        const top3 = new THREE.Mesh(railShortGeo, metalMat);
        top3.position.set(-dimW / 2 + 0.02, legH - 0.02, 0);
        top3.castShadow = true;
        projectGroup.add(top3);

        const top4 = new THREE.Mesh(railShortGeo, metalMat);
        top4.position.set(dimW / 2 - 0.02, legH - 0.02, 0);
        top4.castShadow = true;
        projectGroup.add(top4);

        // Bottom H-support rails
        const botRail = new THREE.Mesh(railLongGeo, metalMat);
        botRail.position.set(0, 0.15, 0);
        botRail.castShadow = true;
        projectGroup.add(botRail);

        const botSide1 = new THREE.Mesh(railShortGeo, metalMat);
        botSide1.position.set(-dimW / 2 + 0.02, 0.15, 0);
        botSide1.castShadow = true;
        projectGroup.add(botSide1);

        const botSide2 = new THREE.Mesh(railShortGeo, metalMat);
        botSide2.position.set(dimW / 2 - 0.02, 0.15, 0);
        botSide2.castShadow = true;
        projectGroup.add(botSide2);

        // Table Top slab (proc wood/oak texture or simple wood color)
        const topSlabGeo = new THREE.BoxGeometry(dimW + 0.04, 0.03, depth + 0.04);
        const woodMat = new THREE.MeshStandardMaterial({
          color: 0xa16207, // Oak brown
          roughness: 0.45,
          metalness: 0.02,
          envMap: envMap,
          envMapIntensity: 0.4
        });
        const topSlab = new THREE.Mesh(topSlabGeo, woodMat);
        topSlab.position.set(0, legH + 0.015, 0);
        topSlab.castShadow = true;
        projectGroup.add(topSlab);

        camera.position.set(dimW * 0.8, dimH * 1.3, depth * 2.2);
        controls.target.set(0, dimH / 2, 0);
      }

    } else {
      // --- MARMORARIA 3D RENDER ---
      const textures = getScenarioTextures(cenarioFundo);

      // Floor with tile/wood/concrete texture
      const floorMaterial = new THREE.MeshStandardMaterial({
        map: textures.floor,
        roughness: textures.floorRoughness,
        metalness: 0.05,
        envMap: envMap,
        envMapIntensity: 0.25
      });
      const floorGeo = new THREE.PlaneGeometry(12, 12);
      const floor = new THREE.Mesh(floorGeo, floorMaterial);
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = 0;
      floor.receiveShadow = true;
      scene.add(floor);

      // Wall Material
      const wallMaterial = new THREE.MeshStandardMaterial({
        map: textures.wall,
        roughness: textures.wallRoughness,
        metalness: 0.02,
        envMap: envMap,
        envMapIntensity: 0.2
      });

      const isL_Esq = formatoBancada === 'L-esq' || formatoBancada === 'L';
      const isL_Dir = formatoBancada === 'L-dir';
      const isU = formatoBancada === 'U';

      const extD = (Number(comprimentoL) || 800) / 1000; // extension in meters
      const startX = isL_Esq || isU ? dimD : 0;
      const endX = isL_Dir || isU ? dimW - dimD : dimW;
      const usableW = endX - startX;
      const slabThick = 0.02;

      // Back Wall
      const backWallGeo = new THREE.PlaneGeometry(5.0, 4.0);
      const backWall = new THREE.Mesh(backWallGeo, wallMaterial);
      backWall.position.set(0, 2.0, -dimD / 2 - 0.01);
      backWall.receiveShadow = true;
      scene.add(backWall);

      // Left Side Wall
      const sideWallGeo = new THREE.PlaneGeometry(4.0, 4.0);
      const sideWall = new THREE.Mesh(sideWallGeo, wallMaterial);
      sideWall.position.set(-dimW / 2 - 0.01, 2.0, 2.0 - dimD / 2);
      sideWall.rotation.y = Math.PI / 2;
      sideWall.receiveShadow = true;
      scene.add(sideWall);

      // Right Side Wall
      if (isU || isL_Dir) {
        const rightWallGeo = new THREE.PlaneGeometry(4.0, 4.0);
        const rightWall = new THREE.Mesh(rightWallGeo, wallMaterial);
        rightWall.position.set(dimW / 2 + 0.01, 2.0, 2.0 - dimD / 2);
        rightWall.rotation.y = -Math.PI / 2;
        rightWall.receiveShadow = true;
        scene.add(rightWall);
      }

      const isSill = modeloType === 'soleira';
      const isPeit = modeloType === 'peitoril';
      const benchY = isSill ? 0.05 : (isPeit ? 0.90 : 0.85);

      projectGroup.position.set(-dimW / 2, benchY, -dimD / 2);

      const stoneTex = createMarbleTexture(pedraTexture);
      const stoneMaterial = new THREE.MeshStandardMaterial({
        map: stoneTex,
        roughness: 0.12,
        metalness: 0.05,
        envMap: envMap,
        envMapIntensity: 0.4
      });

      // Render Tampo (Slab)
      const tampoGeo = new THREE.BoxGeometry(dimW, slabThick, dimD);
      const tampoMesh = new THREE.Mesh(tampoGeo, stoneMaterial);
      tampoMesh.position.set(dimW / 2, -slabThick / 2, dimD / 2);
      tampoMesh.receiveShadow = true;
      tampoMesh.castShadow = true;
      projectGroup.add(tampoMesh);

      if (isL_Esq || isU) {
        // Left Extension
        const tampoExtGeo = new THREE.BoxGeometry(dimD, slabThick, extD);
        const tampoExtMesh = new THREE.Mesh(tampoExtGeo, stoneMaterial);
        tampoExtMesh.position.set(dimD / 2, -slabThick / 2, dimD + extD / 2);
        tampoExtMesh.receiveShadow = true;
        tampoExtMesh.castShadow = true;
        projectGroup.add(tampoExtMesh);
      }

      if (isL_Dir || isU) {
        // Right Extension
        const tampoExtGeo = new THREE.BoxGeometry(dimD, slabThick, extD);
        const tampoExtMesh = new THREE.Mesh(tampoExtGeo, stoneMaterial);
        tampoExtMesh.position.set(dimW - dimD / 2, -slabThick / 2, dimD + extD / 2);
        tampoExtMesh.receiveShadow = true;
        tampoExtMesh.castShadow = true;
        projectGroup.add(tampoExtMesh);
      }

      // Render Cabinet (if applicable)
      const renderCabinet = !isSill && !isPeit && gabineteArmario !== 'nenhum';
      if (renderCabinet) {
        let cabinetColor = 0xffffff;
        let cabinetMap = null;

        if (gabineteArmario === 'branco') {
          cabinetColor = 0xf8fafc;
        } else if (gabineteArmario === 'madeira') {
          cabinetColor = 0xffffff;
          cabinetMap = createWoodFloorTexture();
        } else if (gabineteArmario === 'charcoal') {
          cabinetColor = 0x1e293b;
        }

        const cabinetMaterial = new THREE.MeshStandardMaterial({
          color: cabinetColor,
          map: cabinetMap,
          roughness: 0.4,
          metalness: 0.05,
          envMap: envMap,
          envMapIntensity: 0.2
        });

        const cabH = benchY - slabThick;
        const doorLineMat = new THREE.MeshStandardMaterial({ color: 0x0a0f18, roughness: 0.9 });
        const handleMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.95, roughness: 0.1 });

        let cabMainW = dimW - 0.04;
        let cabMainX = dimW / 2;
        let cabMainD = dimD - 0.03;

        if (isL_Esq) {
          cabMainW = Math.max(0.1, dimW - dimD - 0.02);
          cabMainX = dimD + cabMainW / 2;
        } else if (isL_Dir) {
          cabMainW = Math.max(0.1, dimW - dimD - 0.02);
          cabMainX = cabMainW / 2 + 0.02;
        } else if (isU) {
          cabMainW = Math.max(0.1, dimW - 2 * dimD - 0.02);
          cabMainX = dimD + cabMainW / 2;
        }

        if (cabMainW > 0.1 && cabH > 0.1 && cabMainD > 0.1) {
          const cabinetGeo = new THREE.BoxGeometry(cabMainW, cabH, cabMainD);
          const cabinetMesh = new THREE.Mesh(cabinetGeo, cabinetMaterial);
          cabinetMesh.position.set(cabMainX, -slabThick - cabH / 2, cabMainD / 2);
          cabinetMesh.castShadow = true;
          cabinetMesh.receiveShadow = true;
          projectGroup.add(cabinetMesh);

          const divisionCount = cabMainW > 1.2 ? 3 : (cabMainW > 0.6 ? 2 : 1);
          for (let i = 1; i < divisionCount; i++) {
            const divisionX = (cabMainW / divisionCount) * i - cabMainW / 2;
            const lineGeo = new THREE.BoxGeometry(0.003, cabH - 0.02, 0.002);
            const lineMesh = new THREE.Mesh(lineGeo, doorLineMat);
            lineMesh.position.set(cabMainX + divisionX, -slabThick - cabH / 2, cabMainD + 0.001);
            projectGroup.add(lineMesh);
          }
          for (let i = 0; i < divisionCount; i++) {
            const sectionW = cabMainW / divisionCount;
            const sectionX = -cabMainW / 2 + sectionW * i + sectionW / 2;
            const handleGeo = new THREE.BoxGeometry(0.01, 0.12, 0.015);
            const handleMesh = new THREE.Mesh(handleGeo, handleMat);
            handleMesh.position.set(cabMainX + sectionX, -slabThick - 0.2, cabMainD + 0.01);
            projectGroup.add(handleMesh);
          }
        }

        // Left Extension Cabinet (for L-esq and U)
        if (isL_Esq || isU) {
          const cabExtW = dimD - 0.03;
          const cabExtD = extD;
          if (cabExtW > 0.1 && cabExtD > 0.1) {
            const cabExtGeo = new THREE.BoxGeometry(cabExtW, cabH, cabExtD);
            const cabExtMesh = new THREE.Mesh(cabExtGeo, cabinetMaterial);
            cabExtMesh.position.set(cabExtW / 2, -slabThick - cabH / 2, dimD + cabExtD / 2);
            cabExtMesh.castShadow = true;
            cabExtMesh.receiveShadow = true;
            projectGroup.add(cabExtMesh);

            const divisionCount = cabExtD > 0.8 ? 2 : 1;
            for (let i = 1; i < divisionCount; i++) {
              const divisionZ = (cabExtD / divisionCount) * i - cabExtD / 2;
              const lineGeo = new THREE.BoxGeometry(0.002, cabH - 0.02, 0.003);
              const lineMesh = new THREE.Mesh(lineGeo, doorLineMat);
              lineMesh.position.set(cabExtW + 0.001, -slabThick - cabH / 2, dimD + cabExtD / 2 + divisionZ);
              projectGroup.add(lineMesh);
            }
            for (let i = 0; i < divisionCount; i++) {
              const sectionD = cabExtD / divisionCount;
              const sectionZ = -cabExtD / 2 + sectionD * i + sectionD / 2;
              const handleGeo = new THREE.BoxGeometry(0.015, 0.12, 0.01);
              const handleMesh = new THREE.Mesh(handleGeo, handleMat);
              handleMesh.position.set(cabExtW + 0.01, -slabThick - 0.2, dimD + cabExtD / 2 + sectionZ);
              projectGroup.add(handleMesh);
            }
          }
        }

        // Right Extension Cabinet (for L-dir and U)
        if (isL_Dir || isU) {
          const cabExtW = dimD - 0.03;
          const cabExtD = extD;
          if (cabExtW > 0.1 && cabExtD > 0.1) {
            const cabExtGeo = new THREE.BoxGeometry(cabExtW, cabH, cabExtD);
            const cabExtMesh = new THREE.Mesh(cabExtGeo, cabinetMaterial);
            cabExtMesh.position.set(dimW - cabExtW / 2, -slabThick - cabH / 2, dimD + cabExtD / 2);
            cabExtMesh.castShadow = true;
            cabExtMesh.receiveShadow = true;
            projectGroup.add(cabExtMesh);

            const divisionCount = cabExtD > 0.8 ? 2 : 1;
            for (let i = 1; i < divisionCount; i++) {
              const divisionZ = (cabExtD / divisionCount) * i - cabExtD / 2;
              const lineGeo = new THREE.BoxGeometry(0.002, cabH - 0.02, 0.003);
              const lineMesh = new THREE.Mesh(lineGeo, doorLineMat);
              lineMesh.position.set(dimW - cabExtW - 0.001, -slabThick - cabH / 2, dimD + cabExtD / 2 + divisionZ);
              projectGroup.add(lineMesh);
            }
            for (let i = 0; i < divisionCount; i++) {
              const sectionD = cabExtD / divisionCount;
              const sectionZ = -cabExtD / 2 + sectionD * i + sectionD / 2;
              const handleGeo = new THREE.BoxGeometry(0.015, 0.12, 0.01);
              const handleMesh = new THREE.Mesh(handleGeo, handleMat);
              handleMesh.position.set(dimW - cabExtW - 0.01, -slabThick - 0.2, dimD + cabExtD / 2 + sectionZ);
              projectGroup.add(handleMesh);
            }
          }
        }
      }

      // Render Windowsill Window Frame
      if (isPeit) {
        const frameGroup = new THREE.Group();
        frameGroup.position.set(0, 0.90, -dimD / 2 + 0.01);
        scene.add(frameGroup);

        const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 });
        const vertGeo = new THREE.BoxGeometry(0.04, 1.2, 0.04);
        const leftFrame = new THREE.Mesh(vertGeo, frameMat);
        leftFrame.position.set(-dimW / 2 + 0.02, 0.6, 0);
        frameGroup.add(leftFrame);

        const rightFrame = new THREE.Mesh(vertGeo, frameMat);
        rightFrame.position.set(dimW / 2 - 0.02, 0.6, 0);
        frameGroup.add(rightFrame);

        const horizGeo = new THREE.BoxGeometry(dimW, 0.04, 0.04);
        const bottomFrame = new THREE.Mesh(horizGeo, frameMat);
        bottomFrame.position.set(0, 0.02, 0);
        frameGroup.add(bottomFrame);

        const topFrame = new THREE.Mesh(horizGeo, frameMat);
        topFrame.position.set(0, 1.18, 0);
        frameGroup.add(topFrame);

        const glassGeo = new THREE.PlaneGeometry(dimW - 0.08, 1.12);
        const windowGlassMat = new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.25,
          roughness: 0.1,
          transmission: 0.9,
          ior: 1.5
        });
        const glassMesh = new THREE.Mesh(glassGeo, windowGlassMat);
        glassMesh.position.set(0, 0.6, 0);
        frameGroup.add(glassMesh);
      }

      // Render Rodopia (Splashback)
      if (rodopiaAtivo) {
        const hRod = (Number(alturaRodopia) || 100) / 1000;
        
        let rodW = dimW;
        let rodX = dimW / 2;
        if (isL_Esq) {
          rodW = dimW - slabThick;
          rodX = slabThick + rodW / 2;
        } else if (isL_Dir) {
          rodW = dimW - slabThick;
          rodX = rodW / 2;
        } else if (isU) {
          rodW = dimW - 2 * slabThick;
          rodX = slabThick + rodW / 2;
        }

        if (rodW > 0.01) {
          const rodGeo = new THREE.BoxGeometry(rodW, hRod, slabThick);
          const rodMesh = new THREE.Mesh(rodGeo, stoneMaterial);
          rodMesh.position.set(rodX, hRod / 2, slabThick / 2);
          rodMesh.castShadow = true;
          projectGroup.add(rodMesh);
        }

        if (isL_Esq || isU) {
          const rodExtGeo = new THREE.BoxGeometry(slabThick, hRod, dimD + extD);
          const rodExtMesh = new THREE.Mesh(rodExtGeo, stoneMaterial);
          rodExtMesh.position.set(slabThick / 2, hRod / 2, (dimD + extD) / 2);
          rodExtMesh.castShadow = true;
          projectGroup.add(rodExtMesh);
        }

        if (isL_Dir || isU) {
          const rodExtGeo = new THREE.BoxGeometry(slabThick, hRod, dimD + extD);
          const rodExtMesh = new THREE.Mesh(rodExtGeo, stoneMaterial);
          rodExtMesh.position.set(dimW - slabThick / 2, hRod / 2, (dimD + extD) / 2);
          rodExtMesh.castShadow = true;
          projectGroup.add(rodExtMesh);
        }
      }

      // Render Saia (Front Skirt)
      if (saiaAtiva) {
        const hSaia = (Number(alturaSaia) || 40) / 1000;

        let saiaW = dimW;
        let saiaX = dimW / 2;
        if (isL_Esq) {
          saiaW = Math.max(0.1, dimW - dimD);
          saiaX = dimD + saiaW / 2;
        } else if (isL_Dir) {
          saiaW = Math.max(0.1, dimW - dimD);
          saiaX = saiaW / 2;
        } else if (isU) {
          saiaW = Math.max(0.1, dimW - 2 * dimD);
          saiaX = dimD + saiaW / 2;
        }

        if (saiaW > 0.01) {
          const saiaGeo = new THREE.BoxGeometry(saiaW, hSaia, slabThick);
          const saiaMesh = new THREE.Mesh(saiaGeo, stoneMaterial);
          saiaMesh.position.set(saiaX, -slabThick - hSaia / 2, dimD - slabThick / 2);
          saiaMesh.castShadow = true;
          projectGroup.add(saiaMesh);
        }

        if (isL_Esq || isU) {
          const saiaExtFrontGeo = new THREE.BoxGeometry(dimD, hSaia, slabThick);
          const saiaExtFrontMesh = new THREE.Mesh(saiaExtFrontGeo, stoneMaterial);
          saiaExtFrontMesh.position.set(dimD / 2, -slabThick - hSaia / 2, dimD + extD - slabThick / 2);
          saiaExtFrontMesh.castShadow = true;
          projectGroup.add(saiaExtFrontMesh);

          const saiaExtSideGeo = new THREE.BoxGeometry(slabThick, hSaia, extD);
          const saiaExtSideMesh = new THREE.Mesh(saiaExtSideGeo, stoneMaterial);
          saiaExtSideMesh.position.set(dimD - slabThick / 2, -slabThick - hSaia / 2, dimD + extD / 2);
          saiaExtSideMesh.castShadow = true;
          projectGroup.add(saiaExtSideMesh);
        }

        if (isL_Dir || isU) {
          const saiaExtFrontGeo = new THREE.BoxGeometry(dimD, hSaia, slabThick);
          const saiaExtFrontMesh = new THREE.Mesh(saiaExtFrontGeo, stoneMaterial);
          saiaExtFrontMesh.position.set(dimW - dimD / 2, -slabThick - hSaia / 2, dimD + extD - slabThick / 2);
          saiaExtFrontMesh.castShadow = true;
          projectGroup.add(saiaExtFrontMesh);

          const saiaExtSideGeo = new THREE.BoxGeometry(slabThick, hSaia, extD);
          const saiaExtSideMesh = new THREE.Mesh(saiaExtSideGeo, stoneMaterial);
          saiaExtSideMesh.position.set(dimW - dimD + slabThick / 2, -slabThick - hSaia / 2, dimD + extD / 2);
          saiaExtSideMesh.castShadow = true;
          projectGroup.add(saiaExtSideMesh);
        }
      }

      const isCozi = modeloType === 'cozinha' || modeloType === 'ilha';
      const isBanh = modeloType === 'banheiro';

      const sinkW = isCozi ? 0.55 : 0.4;
      let sinkX = startX + usableW * 0.5;
      if (posicaoCuba === 'esquerda') {
        sinkX = startX + Math.max(sinkW / 2 + 0.05, usableW * 0.25);
      } else if (posicaoCuba === 'direita') {
        sinkX = startX + Math.min(usableW - (sinkW / 2 + 0.05), usableW * 0.75);
      }

      // If both are in the center, split them symmetrically
      if (tipoCuba !== 'nenhuma' && temCooktop && posicaoCuba === 'centro' && posicaoCooktop === 'centro') {
        sinkX = startX + usableW * 0.5 - 0.3;
      }

      // Render Sink and Faucet
      if ((isCozi || isBanh) && tipoCuba !== 'nenhuma') {
        const sinkD = isCozi ? 0.4 : 0.3;
        const sinkH = 0.18;

        let sinkMaterial = new THREE.MeshStandardMaterial({
          color: 0xcbd5e1,
          metalness: 0.9,
          roughness: 0.15,
          envMap: envMap,
          envMapIntensity: 1.2
        });

        if (tipoCuba === 'louca') {
          sinkMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            roughness: 0.05,
            clearcoat: 1.0,
            clearcoatRoughness: 0.0,
            envMap: envMap,
            envMapIntensity: 0.3
          });
        } else if (tipoCuba === 'esculpida') {
          sinkMaterial = stoneMaterial;
        }

        const sinkOuterGeo = new THREE.BoxGeometry(sinkW, sinkH, sinkD);
        const sinkMesh = new THREE.Mesh(sinkOuterGeo, sinkMaterial);

        sinkMesh.position.set(sinkX, -sinkH / 2 - 0.01, dimD / 2);
        sinkMesh.castShadow = true;
        sinkMesh.receiveShadow = true;
        projectGroup.add(sinkMesh);

        // Torneira
        if (tipoTorneira !== 'nenhuma') {
          const faucetGroup = new THREE.Group();
          faucetGroup.position.set(sinkX, 0.01, dimD / 2 - sinkD / 2 - 0.03);
          projectGroup.add(faucetGroup);

          let faucetColorVal = 0x94a3b8;
          let faucetMetalness = 0.95;
          let faucetRoughness = 0.05;

          if (tipoTorneira === 'dourada') {
            faucetColorVal = 0xd4af37;
          } else if (tipoTorneira === 'preta') {
            faucetColorVal = 0x111827;
            faucetMetalness = 0.2;
            faucetRoughness = 0.8;
          }

          const faucetMat = new THREE.MeshStandardMaterial({
            color: faucetColorVal,
            metalness: faucetMetalness,
            roughness: faucetRoughness,
            envMap: envMap,
            envMapIntensity: 1.5
          });

          // Gourmet Arched Faucet
          const tapBaseGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.05, 12);
          const tapBase = new THREE.Mesh(tapBaseGeo, faucetMat);
          tapBase.position.set(0, 0.025, 0);
          faucetGroup.add(tapBase);

          const tapNeckGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.24, 12);
          const tapNeck = new THREE.Mesh(tapNeckGeo, faucetMat);
          tapNeck.position.set(0, 0.145, 0);
          faucetGroup.add(tapNeck);

          const tapHorizGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.10, 12);
          const tapHoriz = new THREE.Mesh(tapHorizGeo, faucetMat);
          tapHoriz.position.set(0, 0.26, 0.05);
          tapHoriz.rotation.x = Math.PI / 2;
          faucetGroup.add(tapHoriz);

          const tapSpoutGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.04, 12);
          const tapSpout = new THREE.Mesh(tapSpoutGeo, faucetMat);
          tapSpout.position.set(0, 0.24, 0.10);
          faucetGroup.add(tapSpout);

          const handleLeverGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.04, 8);
          const handleLever = new THREE.Mesh(handleLeverGeo, faucetMat);
          handleLever.position.set(0.015, 0.035, 0);
          handleLever.rotation.z = Math.PI / 3;
          faucetGroup.add(handleLever);
        }
      }

      // Render Cooktop
      if (temCooktop) {
        const cooktopGroup = new THREE.Group();

        let cookX = startX + usableW * 0.75;
        if (posicaoCooktop === 'esquerda') {
          cookX = startX + Math.max(0.3, usableW * 0.25);
        } else if (posicaoCooktop === 'centro') {
          cookX = startX + usableW * 0.5;
        } else if (posicaoCooktop === 'direita') {
          cookX = startX + Math.min(usableW - 0.3, usableW * 0.75);
        }

        // If both are in the center, split them symmetrically
        if (tipoCuba !== 'nenhuma' && posicaoCuba === 'centro' && posicaoCooktop === 'centro') {
          cookX = startX + usableW * 0.5 + 0.3;
        } else {
          // Auto-adjust for general overlap (minimum distance of 0.58m)
          if (tipoCuba !== 'nenhuma' && Math.abs(cookX - sinkX) < 0.58) {
            if (cookX >= sinkX) {
              cookX = Math.min(endX - 0.3, sinkX + 0.58);
            } else {
              cookX = Math.max(startX + 0.3, sinkX - 0.58);
            }
          }
        }

        cooktopGroup.position.set(cookX, 0.001, dimD / 2);
        projectGroup.add(cooktopGroup);

          let cookColor = 0x111827; // default preto
          let cookMetal = 0.8;
          let cookRough = 0.1;
          
          if (corCooktop === 'inox') {
            cookColor = 0x94a3b8;
            cookMetal = 0.95;
            cookRough = 0.15;
          } else if (corCooktop === 'branco') {
            cookColor = 0xf8fafc;
            cookMetal = 0.1;
            cookRough = 0.05;
          }

          const glassMat = new THREE.MeshStandardMaterial({
            color: cookColor,
            roughness: cookRough,
            metalness: cookMetal
          });
          const plateGeo = new THREE.BoxGeometry(0.58, 0.004, 0.48);
          const plate = new THREE.Mesh(plateGeo, glassMat);
          cooktopGroup.add(plate);

          const burnerMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
          const capMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.2 });
          const positions = [
            { x: -0.15, z: -0.1 },
            { x: -0.15, z: 0.1 },
            { x: 0.15, z: -0.1 },
            { x: 0.15, z: 0.1 }
          ];

          positions.forEach(pos => {
            const ringGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.006, 12);
            const ring = new THREE.Mesh(ringGeo, burnerMat);
            ring.position.set(pos.x, 0.003, pos.z);
            cooktopGroup.add(ring);

            const capGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.008, 12);
            const cap = new THREE.Mesh(capGeo, capMat);
            cap.position.set(pos.x, 0.004, pos.z);
            cooktopGroup.add(cap);
          });
      }

      // Camera for marmoraria
      if (isSill) {
        camera.position.set(1.2, 0.8, 1.6);
        controls.target.set(0, 0.05, 0);
      } else {
        camera.position.set(1.5, 1.6, 2.0);
        controls.target.set(0, 0.75, 0);
      }
    }

    controls.update();

    // Animation loop
    const animState = { currentVal: 0 };
    let reqId;
    const animate = () => {
      reqId = requestAnimationFrame(animate);

      // Smooth interpolation for door open/close animation
      const targetVal = isOpen ? 1.0 : 0.0;
      animState.currentVal += (targetVal - animState.currentVal) * 0.08;

      animatedObjects.forEach(obj => {
        if (obj.type === 'slide') {
          const shift = obj.travel * animState.currentVal;
          obj.mesh.position.x = obj.baseX + (obj.direction * shift);
          if (obj.handle) {
            obj.handle.position.x = obj.handleBaseX + (obj.direction * shift);
          }
        } else if (obj.type === 'swing') {
          const angle = (Math.PI / 2.1) * animState.currentVal * obj.direction;
          obj.group.rotation.y = angle;
        } else if (obj.type === 'flex') {
          const angle1 = (Math.PI / 2.5) * animState.currentVal * obj.direction;
          const angle2 = -(Math.PI / 1.25) * animState.currentVal * obj.direction;
          obj.group1.rotation.y = angle1;
          obj.group2.rotation.y = angle2;
        }
      });

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // Resize handler
    const handleResize = () => {
      if (!containerRef.current) return;
      const wRes = containerRef.current.clientWidth;
      const hRes = containerRef.current.clientHeight;
      camera.aspect = wRes / hRes;
      camera.updateProjectionMatrix();
      renderer.setSize(wRes, hRes);
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(containerRef.current);

    // Cleanup
    return () => {
      cancelAnimationFrame(reqId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      envMap.dispose();
    };
  }, [
    tipo, modeloType, modeloNome, w, h, profundidade, lado, sentido,
    puxador, aluminio, corGlass, isOpen, pedraTexture, saiaAtiva,
    alturaSaia, rodopiaAtivo, alturaRodopia, acabamento, cenarioFundo,
    formatoBancada, servicosSelecionados, tipoCuba, gabineteArmario,
    tipoTorneira, temCooktop, comprimentoL, posicaoCuba, posicaoCooktop, corCooktop,
    autoRotate
  ]);

  return (
    <div className="relative w-full h-full bg-slate-50 rounded-2xl border border-slate-200 shadow-inner flex flex-col overflow-hidden">
      {/* Premium badge */}
      <div className="absolute top-3 left-3 z-10 bg-gradient-to-r from-slate-900 to-slate-800 text-white text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg shadow-lg pointer-events-none flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Visualização 3D Interativa
      </div>

      {/* Controls Container */}
      <div className="absolute top-3 right-3 z-10 flex gap-1.5">
        {/* Auto-Rotate button */}
        <button
          type="button"
          onClick={() => setAutoRotate(prev => !prev)}
          className={`bg-white/90 hover:bg-white border text-slate-700 hover:text-slate-900 text-xs font-bold px-2 py-1.5 rounded-lg shadow-md transition-all hover:scale-105 flex items-center gap-1.5 ${
            autoRotate ? 'border-indigo-500 bg-indigo-50 text-indigo-600 hover:bg-indigo-100/50' : 'border-slate-200'
          }`}
          title={autoRotate ? "Pausar rotação automática" : "Rotacionar automaticamente"}
        >
          <span>{autoRotate ? '⏸️' : '🔄'}</span>
          <span className="text-[9px] hidden sm:inline">{autoRotate ? 'Pausar' : 'Rotacionar'}</span>
        </button>

        {/* Screenshot button */}
        <button
          type="button"
          onClick={() => {
            const canvas = containerRef.current?.querySelector('canvas');
            if (!canvas) return;
            const link = document.createElement('a');
            link.download = `projeto_3d_${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
          }}
          className="bg-white/90 hover:bg-white border border-slate-200 text-slate-700 hover:text-slate-900 text-xs font-bold px-2 py-1.5 rounded-lg shadow-md transition-all hover:scale-105 flex items-center gap-1"
          title="Capturar imagem do 3D"
        >
          📷 <span className="text-[9px] hidden sm:inline">Capturar</span>
        </button>
      </div>

      {/* 3D Canvas Container */}
      <div ref={containerRef} className="w-full flex-grow min-h-[220px]" />

      {/* Dimension Sliders - below canvas */}
      {onChangeDimensions && (
        <div className="flex flex-col gap-1.5 bg-slate-950 p-3 border-t border-white/10 text-white select-none">
          <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider">
            <span>Ajuste Rápido de Dimensões</span>
            <span className="text-cyan-400 font-mono">Vão de Obra</span>
          </div>
          
          <div className="grid grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <div className="flex justify-between text-[8px] font-extrabold text-slate-400">
                <span>LARGURA</span>
                <span className="text-white font-mono">{wVao || 1200} mm</span>
              </div>
              <input 
                type="range" 
                min="400" 
                max="3000" 
                step="10"
                value={wVao || 1200} 
                onChange={e => onChangeDimensions(parseInt(e.target.value), undefined)}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[8px] font-extrabold text-slate-400">
                <span>ALTURA</span>
                <span className="text-white font-mono">{hVao || 1900} mm</span>
              </div>
              <input 
                type="range" 
                min="500" 
                max="2800" 
                step="10"
                value={hVao || 1900} 
                onChange={e => onChangeDimensions(undefined, parseInt(e.target.value))}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>
          </div>
        </div>
      )}

      {/* Info bar */}
      <div className="bg-gradient-to-r from-slate-50 to-white border-t border-slate-100 py-1.5 px-3 flex justify-between items-center text-[9px] text-slate-500 font-extrabold select-none">
        <span className="flex items-center gap-1">
          <span>🖱️</span>
          {controlsInfo}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          WebGL • Three.js
        </span>
      </div>
    </div>
  );
}
