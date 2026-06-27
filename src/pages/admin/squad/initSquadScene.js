import * as THREE from 'three';

// Agent roster (matches SquadMeeting3D.jsx)
const AGENTS = {
  oscar: { id: 'oscar', nome: 'Oscar Niemeyer', cargo: 'Arquiteto/Analista', emoji: '🔍', color: 0xe2e8f0, phase: 'architecture' }, 
  leo: { id: 'leo', nome: 'Sheldon', cargo: 'Front-end Sênior (Bazinga!)', emoji: '🎨', color: 0x38bdf8, phase: 'ui' }, 
  afrodite: { id: 'afrodite', nome: 'Nairobi', cargo: 'Líder de Banco & Dev Backend', emoji: '🌸', color: 0xf43f5e, phase: 'backend' }, 
  thor: { id: 'thor', nome: 'Ragnar', cargo: 'QA & Validador de Elite', emoji: '⚡', color: 0xeab308, phase: 'qa' }, 
  sabotagem: { id: 'sabotagem', nome: 'Sabotagem', cargo: 'Marketing & Copy', emoji: '🎤', color: 0x22c55e, phase: 'marketing' }
};

// Imported from SquadMeeting3D.jsx module scope
// Imported from SquadMeeting3D.jsx module scope  
// updateHudCanvas is passed as parameter instead of imported
/**
 * initSquadScene — Creates and manages the entire Three.js 3D hotel scene.
 * Extracted from SquadMeeting3D.jsx useEffect (was 2300+ lines inline).
 * 
 * @param {Object} refs - All refs from the parent component
 * @param {React.RefObject} refs.viewportRef - DOM element to mount the canvas
 * @param {React.RefObject} refs.stateRef - Shared state between React and Three.js
 * @param {React.RefObject} refs.speechTextRef - Current speech text
 * @param {React.RefObject} refs.hologramModelRef - Hologram 3D model reference
 * @param {Object} refs.bubblesRefs - Speech bubble DOM refs per agent
 * @returns {Function} cleanup - Call on unmount to dispose resources
 */
export function initSquadScene({ viewportRef, stateRef, speechTextRef, hologramModelRef, bubblesRefs, updateHudCanvas }) {
    if (!viewportRef.current) return;

    viewportRef.current.innerHTML = '';
    let currentWidth = viewportRef.current.clientWidth || 500;
    let currentHeight = viewportRef.current.clientHeight || 500;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xf1f5f9, 0.012);

    const NORMAL_POSITIONS = {
      oscar: { x: -3.0, z: -3.0 },
      leo: { x: 3.0, z: -2.6 },
      afrodite: { x: -3.0, z: 3.0 },
      thor: { x: 0.0, z: -4.0 },
      sabotagem: { x: 3.0, z: 3.0 }
    };

    const isSittingNormal = {
      oscar: false,
      leo: true,
      afrodite: true,
      thor: false,
      sabotagem: true
    };

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(currentWidth, currentHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    viewportRef.current.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(45, currentWidth / currentHeight, 0.1, 100);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xf1f5f9, 1.3);
    scene.add(hemiLight);

    const spotlight = new THREE.SpotLight(0xfff7ed, 3.2); // Luz direcional quente
    spotlight.position.set(0, 5, 0);
    spotlight.angle = Math.PI / 3.5;
    spotlight.penumbra = 0.5;
    spotlight.castShadow = true;
    scene.add(spotlight);

    const accentLight = new THREE.PointLight(0x4f46e5, 2.5, 12); // Luz de destaque indigo
    accentLight.position.set(0, 1.2, 0);
    scene.add(accentLight);

    // Active Agent speaking spotlight (holographic light beam)
    const speakerLight = new THREE.SpotLight(0xffffff, 0, 6, Math.PI / 8, 0.4, 0.8);
    speakerLight.position.set(0, 3.5, 0);
    scene.add(speakerLight);

    const speakerLightTarget = new THREE.Object3D();
    scene.add(speakerLightTarget);
    speakerLight.target = speakerLightTarget;

    // Scene materials (retained for theme switching compatibility)
    const panelBackMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.95 });
    const slatMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.55 });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, metalness: 0.9 });
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.8, metalness: 0.3 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe4e4e7, metalness: 0.95, roughness: 0.05 });
    const windowGlassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.07, roughness: 0.1, metalness: 0.9, side: THREE.DoubleSide });
    const telemetryGridMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true, transparent: true, opacity: 0.0, side: THREE.DoubleSide });
    const monitorMat = new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.5 });
    
    // Legacy floor variables to avoid crash on theme toggle
    const floorMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc }); 
    const floorMat2 = new THREE.MeshStandardMaterial({ color: 0xe2e8f0 }); 
    const floorRingMat = new THREE.MeshBasicMaterial({ color: 0x4f46e5 });
    const floorRings = [];

    // --- SCI-FI WAR ROOM ESTHETICS ---
    
    // Deep dark reflective void underneath
    const outerFloorGeo = new THREE.PlaneGeometry(60, 60);
    const outerFloorMat = new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.1, metalness: 0.9 }); 
    const outerFloor = new THREE.Mesh(outerFloorGeo, outerFloorMat);
    outerFloor.rotation.x = -Math.PI / 2;
    outerFloor.position.y = -0.05;
    outerFloor.receiveShadow = true;
    scene.add(outerFloor);

    // Floating Holographic Panels (Background)
    const wallGroup = new THREE.Group();
    scene.add(wallGroup);

    const glassMat = new THREE.MeshStandardMaterial({ 
      color: 0x38bdf8, 
      transparent: true, 
      opacity: 0.15, 
      roughness: 0.05, 
      metalness: 1.0,
      side: THREE.DoubleSide
    });

    // Create a curved holographic screen behind the squad (No blue borders)
    const screenGeo = new THREE.CylinderGeometry(8, 8, 3, 32, 1, true, -Math.PI/2 - 0.5, Math.PI + 1.0);
    const screen = new THREE.Mesh(screenGeo, glassMat);
    screen.position.set(0, 1.5, 0);
    wallGroup.add(screen);

    // --- SÃO JOÃO FESTIVAL (BRAZIL THEME) ---
    const festaGroup = new THREE.Group();
    scene.add(festaGroup);

    // 1. Fogueira (Bonfire)
    const fogueiraGroup = new THREE.Group();
    fogueiraGroup.position.set(4, 0, 4); // Canto da sala
    festaGroup.add(fogueiraGroup);

    const logGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.5, 8);
    const logMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
    for(let i=0; i<4; i++) {
      const log = new THREE.Mesh(logGeo, logMat);
      log.rotation.x = Math.PI / 2;
      log.rotation.z = (Math.PI / 4) * i;
      log.position.y = 0.1;
      fogueiraGroup.add(log);
    }
    const fireGeo = new THREE.ConeGeometry(0.4, 1.2, 8);
    const fireMat = new THREE.MeshStandardMaterial({ color: 0xff4500, emissive: 0xff8c00, emissiveIntensity: 1, transparent: true, opacity: 0.8 });
    const fireCone = new THREE.Mesh(fireGeo, fireMat);
    fireCone.position.y = 0.8;
    fogueiraGroup.add(fireCone);
    
    const fireLight = new THREE.PointLight(0xff6600, 4, 15);
    fireLight.position.set(0, 1, 0);
    fogueiraGroup.add(fireLight);

    // 2. Bandeirinhas (Brazil Colors)
    const coresBrasil = [0x009c3b, 0xffdf00, 0x002776];
    const flagGeo = new THREE.ConeGeometry(0.2, 0.4, 4);
    flagGeo.rotateX(Math.PI);
    
    for(let i=0; i<15; i++) {
      const t = i / 14;
      const x = -8 + t * 16;
      const z = -1 + Math.sin(t * Math.PI) * -3;
      const y = 5 - Math.sin(t * Math.PI) * 1.5;
      
      const flagMat = new THREE.MeshBasicMaterial({ color: coresBrasil[i % 3], side: THREE.DoubleSide });
      const flag = new THREE.Mesh(flagGeo, flagMat);
      flag.position.set(x, y, z);
      festaGroup.add(flag);
    }



    // Habbo Windows
    const windowFrameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const windowGlassSkyMat = new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.4,
      roughness: 0.1
    });

    // Left Window
    const leftWindowFrame = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 1.2), windowFrameMat);
    leftWindowFrame.position.set(-7.42, 3.2, -2.5);
    wallGroup.add(leftWindowFrame);

    const leftWindowGlass = new THREE.Mesh(new THREE.BoxGeometry(0.10, 1.0, 1.0), windowGlassSkyMat);
    leftWindowGlass.position.set(-7.41, 3.2, -2.5);
    wallGroup.add(leftWindowGlass);

    // Right Window
    const rightWindowFrame = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 0.12), windowFrameMat);
    rightWindowFrame.position.set(2.5, 3.2, -7.42);
    wallGroup.add(rightWindowFrame);

    const rightWindowGlass = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 0.10), windowGlassSkyMat);
    rightWindowGlass.position.set(2.5, 3.2, -7.41);
    wallGroup.add(rightWindowGlass);

    // Habbo Duck Poster / Painting
    const duckPainting = new THREE.Group();
    duckPainting.position.set(-7.42, 3.2, 2.5);
    duckPainting.rotation.y = Math.PI / 2;
    wallGroup.add(duckPainting);

    // Frame
    const framePaint = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 0.04), frameMat);
    duckPainting.add(framePaint);

    // Canvas background (classic Habbo green background)
    const canvasPaint = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.02), new THREE.MeshStandardMaterial({ color: 0x0f9f59, roughness: 0.9 }));
    canvasPaint.position.z = 0.02;
    duckPainting.add(canvasPaint);

    // Yellow Duck body (pixelated)
    const duckBody = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.12), new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.8 }));
    duckBody.position.set(-0.06, -0.08, 0.05);
    duckPainting.add(duckBody);

    const duckHead = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.12), new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.8 }));
    duckHead.position.set(0.08, 0.06, 0.05);
    duckPainting.add(duckHead);

    const duckBeak = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.10), new THREE.MeshStandardMaterial({ color: 0xf97316 }));
    duckBeak.position.set(0.18, 0.05, 0.05);
    duckPainting.add(duckBeak);

    const duckEye = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.02), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    duckEye.position.set(0.10, 0.09, 0.11);
    duckPainting.add(duckEye);

    // Empty servers/leds array for backwards compatibility
    const serverLeds = [];

    // Outer sky/stars bokeh group styled to look like simple window backdrop stars
    const bokehGroup = new THREE.Group();
    scene.add(bokehGroup);
    const starGeo = new THREE.SphereGeometry(0.04, 4, 4);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
    for (let j = 0; j < 30; j++) {
      const star = new THREE.Mesh(starGeo, starMat);
      star.position.set(
        -15.0 - Math.random() * 5.0,
        2.0 + Math.random() * 4.0,
        -15.0 - Math.random() * 5.0
      );
      bokehGroup.add(star);
    }

    // Scene Materials (retained for theme switching compatibility)
    const tableMat = new THREE.MeshStandardMaterial({
      color: 0x1b96d3,
      transparent: true,
      opacity: 0.5,
      roughness: 0.15,
      metalness: 0.8
    });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.18 });
    const standMat = new THREE.MeshStandardMaterial({ color: 0xc5a059, metalness: 0.9, roughness: 0.25 });
    const tableGlowMat = new THREE.MeshBasicMaterial({ color: 0x1b96d3, side: THREE.DoubleSide, transparent: true, opacity: 0.4 });

    // Rugs
    const rugMat1 = new THREE.MeshStandardMaterial({ color: 0x0369a1, roughness: 0.95 });
    const rug1 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.005, 1.2), rugMat1);
    rug1.position.set(2.4, 0.002, -2.4);
    rug1.rotation.y = Math.PI / 4;
    scene.add(rug1);

    const rugMat2 = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.95 });
    const rug2 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.002, 1.2), rugMat2);
    rug2.position.set(-3.0, 0.002, 3.0);
    rug2.rotation.y = Math.PI / 4;
    scene.add(rug2);

    // 1. Oscar's Architect Board (Easel)
    const oscarBoardGroup = new THREE.Group();
    oscarBoardGroup.position.set(-3.6, 0.45, -3.6);
    oscarBoardGroup.lookAt(0, 0.45, 0);
    scene.add(oscarBoardGroup);

    const boardStand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.6), standMat);
    boardStand.position.y = 0;
    oscarBoardGroup.add(boardStand);

    const drawingBoard = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.8, 0.9), frameMat);
    drawingBoard.position.set(0.05, 0.4, 0);
    drawingBoard.rotation.z = Math.PI / 6;
    oscarBoardGroup.add(drawingBoard);

    const blueprintPaperMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.9 });
    const blueprintPaper = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.6, 0.7), blueprintPaperMat);
    blueprintPaper.position.set(0.072, 0.4, 0);
    blueprintPaper.rotation.z = Math.PI / 6;
    oscarBoardGroup.add(blueprintPaper);

    // Oscar's Desk (Architect Office Desk)
    const oscarDeskGroup = new THREE.Group();
    oscarDeskGroup.position.set(-3.4, 0, -2.2);
    oscarDeskGroup.lookAt(-3.0, 0, -2.6);
    scene.add(oscarDeskGroup);

    const oscarTable = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.55), standMat);
    oscarTable.position.y = 0.5;
    oscarTable.castShadow = true;
    oscarTable.receiveShadow = true;
    oscarDeskGroup.add(oscarTable);

    // 4 legs for Oscar's desk
    for (let lx = -1; lx <= 1; lx += 2) {
      for (let lz = -1; lz <= 1; lz += 2) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.04), frameMat);
        leg.position.set(lx * 0.4, 0.25, lz * 0.23);
        leg.castShadow = true;
        oscarDeskGroup.add(leg);
      }
    }

    // Monitor for Oscar (Drafting display)
    const oscarMonBase = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.12), frameMat);
    oscarMonBase.position.set(0, 0.535, 0);
    oscarDeskGroup.add(oscarMonBase);

    const oscarMonStand = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.04), frameMat);
    oscarMonStand.position.set(0, 0.58, 0);
    oscarDeskGroup.add(oscarMonStand);

    const oscarMonScreen = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 0.05), frameMat);
    oscarMonScreen.position.set(0, 0.72, 0);
    oscarDeskGroup.add(oscarMonScreen);

    const oscarMonDisplay = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.18, 0.01), new THREE.MeshBasicMaterial({ color: 0x3b82f6 })); // Blue blueprint style display
    oscarMonDisplay.position.set(0, 0.72, 0.022);
    oscarDeskGroup.add(oscarMonDisplay);

    // Keyboard for Oscar
    const oscarKeyboard = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.01, 0.08), seatMat);
    oscarKeyboard.position.set(0, 0.53, 0.16);
    oscarDeskGroup.add(oscarKeyboard);

    // Oscar's CPU Tower
    const oscarCpu = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.2, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 })
    );
    oscarCpu.position.set(0.38, 0.63, 0.1);
    oscarDeskGroup.add(oscarCpu);

    const oscarCpuLed = new THREE.Mesh(
      new THREE.BoxGeometry(0.005, 0.16, 0.19),
      new THREE.MeshBasicMaterial({ color: 0x3b82f6 }) // blue/cyan glow
    );
    oscarCpuLed.position.set(0.052, 0, 0);
    oscarCpu.add(oscarCpuLed);

    // Nairobi's Backend/Database Server Setup
    const nairobiServerGroup = new THREE.Group();
    nairobiServerGroup.position.set(-4.0, 0, 4.0);
    nairobiServerGroup.lookAt(0, 0, 0);
    scene.add(nairobiServerGroup);

    // Server Cabinet Rack
    const rackFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 1.4, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6, metalness: 0.3 })
    );
    rackFrame.position.y = 0.7;
    nairobiServerGroup.add(rackFrame);

    // Glowing server slots (LEDs/Blades)
    for (let slot = 0; slot < 8; slot++) {
      const slotY = 0.15 + slot * 0.15;
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.52, 0.08, 0.52),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 })
      );
      blade.position.set(0, slotY, 0.02);
      nairobiServerGroup.add(blade);

      const ledGlow = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.02, 0.01),
        new THREE.MeshBasicMaterial({ color: slot % 2 === 0 ? 0x22c55e : 0xef4444 }) // green and red status LEDs
      );
      ledGlow.position.set(-0.18, slotY, 0.285);
      nairobiServerGroup.add(ledGlow);

      const ledGlow2 = ledGlow.clone();
      ledGlow2.position.x = -0.06;
      ledGlow2.material = new THREE.MeshBasicMaterial({ color: 0x3b82f6 }); // blue activity LED
      nairobiServerGroup.add(ledGlow2);
    }

    // 2. Sheldon's Developer Desk
    const sheldonDeskGroup = new THREE.Group();
    sheldonDeskGroup.position.set(2.4, 0, -2.4);
    sheldonDeskGroup.lookAt(3.0, 0, -2.6);
    scene.add(sheldonDeskGroup);

    const desktop = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.55), standMat);
    desktop.position.y = 0.5;
    sheldonDeskGroup.add(desktop);

    for (let lx = -1; lx <= 1; lx += 2) {
      for (let lz = -1; lz <= 1; lz += 2) {
        const dLeg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), frameMat);
        dLeg.position.set(lx * 0.4, 0.25, lz * 0.23);
        sheldonDeskGroup.add(dLeg);
      }
    }

    const monitorBase = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.12), frameMat);
    monitorBase.position.set(0, 0.535, 0);
    sheldonDeskGroup.add(monitorBase);

    const monitorStand = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.04), frameMat);
    monitorStand.position.set(0, 0.58, 0);
    sheldonDeskGroup.add(monitorStand);

    const monitorScreen = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 0.05), frameMat);
    monitorScreen.position.set(0, 0.72, 0);
    sheldonDeskGroup.add(monitorScreen);

    const monitorDisplay = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.18, 0.01), tableMat);
    monitorDisplay.position.set(0, 0.72, 0.022);
    sheldonDeskGroup.add(monitorDisplay);

    const keyboard = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.01, 0.08), seatMat);
    keyboard.position.set(0, 0.53, 0.16);
    sheldonDeskGroup.add(keyboard);

    // Sheldon's CPU Tower
    const sheldonCpu = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.2, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 })
    );
    sheldonCpu.position.set(0.38, 0.63, 0.1);
    sheldonDeskGroup.add(sheldonCpu);

    const sheldonCpuLed = new THREE.Mesh(
      new THREE.BoxGeometry(0.005, 0.16, 0.19),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 }) // cyan glow
    );
    sheldonCpuLed.position.set(0.052, 0, 0);
    sheldonCpu.add(sheldonCpuLed);

    // 3. Nairobi's Couch
    const couchGroup = new THREE.Group();
    couchGroup.position.set(-3.0, 0, 3.0);
    couchGroup.lookAt(0, 0, 0);
    scene.add(couchGroup);

    const couchBase = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.6), seatMat);
    couchBase.position.y = 0.09;
    couchGroup.add(couchBase);

    const cushionMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.8 });
    const couchSeat = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 0.48), cushionMat);
    couchSeat.position.set(0, 0.21, 0.04);
    couchGroup.add(couchSeat);

    const couchBack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.48, 0.12), seatMat);
    couchBack.position.set(0, 0.42, -0.24);
    couchGroup.add(couchBack);

    const couchArmL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.36, 0.6), seatMat);
    couchArmL.position.set(-0.54, 0.27, 0);
    couchGroup.add(couchArmL);
    const couchArmR = couchArmL.clone();
    couchArmR.position.x = 0.54;
    couchGroup.add(couchArmR);

    // Nairobi's Coffee Table & Laptop
    const coffeeTable = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.5), standMat);
    coffeeTable.position.set(-2.0, 0.125, 2.0);
    coffeeTable.lookAt(0, 0.125, 0);
    scene.add(coffeeTable);

    const laptopBase = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.01, 0.12), frameMat);
    laptopBase.position.set(0, 0.13, 0);
    coffeeTable.add(laptopBase);

    const laptopScreen = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 0.01), frameMat);
    laptopScreen.position.set(0, 0.18, -0.05);
    laptopScreen.rotation.x = 0.45; // open screen
    coffeeTable.add(laptopScreen);

    const laptopDisp = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.002), new THREE.MeshBasicMaterial({ color: 0xf43f5e })); // magenta display glow
    laptopDisp.position.set(0, 0, 0.006);
    laptopScreen.add(laptopDisp);

    // 4. Ragnar's Kanban Board
    const boardGroup = new THREE.Group();
    boardGroup.position.set(0, 0, -4.7);
    boardGroup.lookAt(0, 0, 0);
    scene.add(boardGroup);

    const boardFrame = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 0.05), frameMat);
    boardFrame.position.y = 1.1;
    boardGroup.add(boardFrame);

    const boardSurfaceMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.9 });
    const boardSurface = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.1, 0.01), boardSurfaceMat);
    boardSurface.position.set(0, 1.1, 0.022);
    boardGroup.add(boardSurface);

    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.1, 0.06), frameMat);
    legL.position.set(-0.8, 0.55, 0);
    boardGroup.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.8;
    boardGroup.add(legR);

    const postitColors = [0xef4444, 0xeab308, 0x3b82f6, 0x22c55e];
    for (let row = 0; row < 3; row++) {
      for (let col = -2; col <= 2; col++) {
        if (Math.random() > 0.3) {
          const pColor = postitColors[Math.floor(Math.random() * postitColors.length)];
          const pMat = new THREE.MeshBasicMaterial({ color: pColor });
          const postit = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.002), pMat);
          postit.position.set(col * 0.28 + (Math.random() - 0.5) * 0.03, 1.4 - row * 0.24, 0.024);
          boardGroup.add(postit);
        }
      }
    }

    // Ragnar's QA Desk & Multi-Monitor Setup
    const ragnarDeskGroup = new THREE.Group();
    ragnarDeskGroup.position.set(0.8, 0, -3.8);
    ragnarDeskGroup.lookAt(0.8, 0, 0);
    scene.add(ragnarDeskGroup);

    const rTable = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.55), standMat);
    rTable.position.y = 0.5;
    ragnarDeskGroup.add(rTable);

    for (let lx = -1; lx <= 1; lx += 2) {
      for (let lz = -1; lz <= 1; lz += 2) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), frameMat);
        leg.position.set(lx * 0.45, 0.25, lz * 0.23);
        ragnarDeskGroup.add(leg);
      }
    }


    // Left Monitor
    const rMon1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.03), monitorMat);
    rMon1.position.set(-0.16, 0.7, -0.05);
    rMon1.rotation.y = 0.35;
    ragnarDeskGroup.add(rMon1);

    const rDisp1 = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.005), new THREE.MeshBasicMaterial({ color: 0x10b981 })); // Green terminal display
    rDisp1.position.set(0, 0, 0.016);
    rMon1.add(rDisp1);

    // Right Monitor
    const rMon2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.03), monitorMat);
    rMon2.position.set(0.16, 0.7, -0.05);
    rMon2.rotation.y = -0.35;
    ragnarDeskGroup.add(rMon2);

    const rDisp2 = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.005), new THREE.MeshBasicMaterial({ color: 0xfacc15 })); // Yellow dashboard display
    rDisp2.position.set(0, 0, 0.016);
    rMon2.add(rDisp2);

    // Keyboard
    const rKeyb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.01, 0.07), seatMat);
    rKeyb.position.set(0, 0.53, 0.14);
    rKeyb.rotation.y = 0.05;
    ragnarDeskGroup.add(rKeyb);

    const rKeybLed = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.012, 0.08), new THREE.MeshBasicMaterial({ color: 0xa855f7 })); // Purple RGB glow
    rKeybLed.position.set(0, -0.002, 0);
    rKeyb.add(rKeybLed);

    // CPU Tower (RGB)
    const rCpu = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.2), monitorMat);
    rCpu.position.set(-0.38, 0.64, -0.05);
    ragnarDeskGroup.add(rCpu);

    const rCpuLed = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.18, 0.18), new THREE.MeshBasicMaterial({ color: 0xa855f7 })); // Purple RGB side
    rCpuLed.position.set(0.061, 0, 0);
    rCpu.add(rCpuLed);

    // 5. Sabotagem's Armchair
    const armchairGroup = new THREE.Group();
    armchairGroup.position.set(3.0, 0, 3.0);
    armchairGroup.lookAt(0, 0, 0);
    scene.add(armchairGroup);

    const chairBase = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.18, 0.6), seatMat);
    chairBase.position.y = 0.09;
    armchairGroup.add(chairBase);

    const seatCushionMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.8 });
    const chairSeat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 0.48), seatCushionMat);
    chairSeat.position.set(0, 0.21, 0.04);
    armchairGroup.add(chairSeat);

    const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.48, 0.12), seatMat);
    chairBack.position.set(0, 0.42, -0.24);
    armchairGroup.add(chairBack);

    const chairArmL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.36, 0.6), seatMat);
    chairArmL.position.set(-0.275, 0.27, 0);
    armchairGroup.add(chairArmL);
    const chairArmR = chairArmL.clone();
    chairArmR.position.x = 0.275;
    armchairGroup.add(chairArmR);

    // Sabotagem's Workdesk
    const sDeskGroup = new THREE.Group();
    sDeskGroup.position.set(2.0, 0, 2.0);
    sDeskGroup.lookAt(3.0, 0, 3.0);
    scene.add(sDeskGroup);

    const sTable = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.4), standMat);
    sTable.position.y = 0.25;
    sDeskGroup.add(sTable);

    // Laptop
    const sLaptop = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.01, 0.11), frameMat);
    sLaptop.position.set(0, 0.51, 0.05);
    sDeskGroup.add(sLaptop);

    const sScreen = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.01), frameMat);
    sScreen.position.set(0, 0.56, -0.02);
    sScreen.rotation.x = 0.4;
    sDeskGroup.add(sScreen);

    const sDisp = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, 0.002), new THREE.MeshBasicMaterial({ color: 0x22c55e })); // Green display glow
    sDisp.position.set(0, 0, 0.006);
    sScreen.add(sDisp);

    // Wall Neon Strips (Gamer Bedroom Lighting) - Deactivated for Daylight Studio
    const neonMatL = new THREE.MeshBasicMaterial({ color: 0x06b6d4, visible: false }); // Cyan neon
    const neonL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 15.0), neonMatL);
    neonL.position.set(-7.41, 2.0, 0);
    scene.add(neonL);

    const neonMatR = new THREE.MeshBasicMaterial({ color: 0xf43f5e, visible: false }); // Magenta neon
    const neonR = new THREE.Mesh(new THREE.BoxGeometry(15.0, 0.04, 0.04), neonMatR);
    neonR.position.set(0, 2.0, -7.41);
    scene.add(neonR);

    // Corner RGB LEDs (Vertical color bars) - Deactivated for Daylight Studio
    const cornerNeonGeo = new THREE.CylinderGeometry(0.015, 0.015, 4.5, 8);
    const cornerNeonMat = new THREE.MeshBasicMaterial({ color: 0xa855f7, visible: false }); // Purple RGB light
    const cornerNeon = new THREE.Mesh(cornerNeonGeo, cornerNeonMat);
    cornerNeon.position.set(-7.38, 2.25, -7.38); // right in the L corner
    scene.add(cornerNeon);

    // Voxel Potted Plants
    const plantGroup1 = new THREE.Group();
    plantGroup1.position.set(-5.0, 0, 0);
    scene.add(plantGroup1);

    const pot = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), standMat);
    pot.position.y = 0.2;
    plantGroup1.add(pot);

    const stemMat = new THREE.MeshStandardMaterial({ color: 0x5c3d2e, roughness: 0.9 });
    const stem = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.08), stemMat);
    stem.position.y = 0.7;
    plantGroup1.add(stem);

    const voxelLeafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.9 });
    for (let ly = 0; ly < 3; ly++) {
      const size = 0.35 - ly * 0.08;
      const leaves = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), voxelLeafMat);
      leaves.position.y = 0.9 + ly * 0.2;
      plantGroup1.add(leaves);
    }

    const plantGroup2 = plantGroup1.clone();
    plantGroup2.position.set(5.0, 0, 0);
    scene.add(plantGroup2);

    // ───────────────────────────────────────────────────────────
    // CANTINHO DE CAFÉ (Buffet de luxo, máquina expresso e prateleira)
    // ───────────────────────────────────────────────────────────
    const coffeeTableGroup = new THREE.Group();
    coffeeTableGroup.position.set(-3.5, 0, -3.5);
    coffeeTableGroup.rotation.y = Math.PI / 4; // Diagonal
    scene.add(coffeeTableGroup);

    // Buffet planejado (Gabinete com portas e puxadores dourados)
    const cabinetGeo = new THREE.BoxGeometry(1.4, 0.45, 0.55);
    const cabinetMat = new THREE.MeshStandardMaterial({ color: 0x272421, roughness: 0.6 }); 
    const cabinet = new THREE.Mesh(cabinetGeo, cabinetMat);
    cabinet.position.y = 0.225;
    cabinet.receiveShadow = true;
    cabinet.castShadow = true;
    coffeeTableGroup.add(cabinet);

    // Tampo do Buffet (Mármore claro polido)
    const buffetTopGeo = new THREE.BoxGeometry(1.42, 0.03, 0.57);
    const buffetTopMat = new THREE.MeshStandardMaterial({ color: 0xefede8, roughness: 0.15, metalness: 0.2 }); 
    const buffetTop = new THREE.Mesh(buffetTopGeo, buffetTopMat);
    buffetTop.position.y = 0.465;
    buffetTop.receiveShadow = true;
    coffeeTableGroup.add(buffetTop);

    // Puxadores de latão dourado
    const handleGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.08);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.1 });
    const handleL = new THREE.Mesh(handleGeo, handleMat);
    handleL.position.set(-0.25, 0.225, 0.28);
    handleL.rotation.z = Math.PI / 2;
    coffeeTableGroup.add(handleL);

    const handleR = handleL.clone();
    handleR.position.x = 0.25;
    coffeeTableGroup.add(handleR);

    // Máquina de Café Expresso Italiana Cromada
    const espressoGroup = new THREE.Group();
    espressoGroup.position.set(-0.35, 0.48, 0.05);
    coffeeTableGroup.add(espressoGroup);

    const espressoChromeMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.95, roughness: 0.05 });
    const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.18), espressoChromeMat);
    baseMesh.position.y = 0.08;
    baseMesh.castShadow = true;
    espressoGroup.add(baseMesh);

    const tankMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.4, roughness: 0.1 });
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.15, 10), tankMat);
    tank.position.set(0, 0.155, -0.04);
    espressoGroup.add(tank);

    const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.08), espressoChromeMat);
    lever.position.set(0, 0.08, 0.1);
    lever.rotation.x = Math.PI / 2;
    espressoGroup.add(lever);

    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.02), cabinetMat);
    grip.position.set(0, 0.08, 0.14);
    grip.rotation.x = Math.PI / 2;
    espressoGroup.add(grip);

    // Xícaras de café em porcelana branca sobre o buffet
    const cupColors = [0xffffff, 0xffffff, 0xffffff];
    cupColors.forEach((color, idx) => {
      const cupGeo = new THREE.CylinderGeometry(0.02, 0.015, 0.038, 8);
      const cupMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.2 });
      const cup = new THREE.Mesh(cupGeo, cupMat);
      cup.position.set(0.15 + idx * 0.12, 0.499, -0.05 + Math.sin(idx) * 0.03);
      cup.castShadow = true;
      coffeeTableGroup.add(cup);
    });

    // Prateleira de parede flutuante de madeira
    const shelfGeo = new THREE.BoxGeometry(1.2, 0.03, 0.22);
    const shelf = new THREE.Mesh(shelfGeo, cabinetMat);
    shelf.position.set(0, 1.25, -0.22);
    coffeeTableGroup.add(shelf);

    // Livros decorativos
    const bookColors = [0x1d4ed8, 0xb91c1c, 0xf59e0b];
    bookColors.forEach((color, bIdx) => {
      const bookGeo = new THREE.BoxGeometry(0.03, 0.12, 0.08);
      const bookMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.8 });
      const book = new THREE.Mesh(bookGeo, bookMat);
      book.position.set(-0.25 + bIdx * 0.04, 1.325, -0.2);
      book.rotation.y = 0.15;
      coffeeTableGroup.add(book);
    });

    // Vasinho de suculenta
    const smallPot = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.06), new THREE.MeshStandardMaterial({ color: 0xefede8 }));
    smallPot.position.set(0.3, 1.31, -0.2);
    coffeeTableGroup.add(smallPot);

    const smallLeafMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.9 });
    const smallLeaf = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), smallLeafMat);
    smallLeaf.position.set(0.3, 1.35, -0.2);
    smallLeaf.scale.set(1, 0.7, 1.4);
    coffeeTableGroup.add(smallLeaf);

    // Planta Costela-de-Adão de Luxo (Vaso de Chão)
    const plantGroup = new THREE.Group();
    plantGroup.position.set(-4.6, 0, -2.4);
    scene.add(plantGroup);

    const potMeshGeo = new THREE.CylinderGeometry(0.18, 0.13, 0.35, 12);
    const potMesh = new THREE.Mesh(potMeshGeo, new THREE.MeshStandardMaterial({ color: 0xefede8, roughness: 0.6 })); 
    potMesh.position.y = 0.175;
    potMesh.castShadow = true;
    plantGroup.add(potMesh);

    const leafMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.8 });
    for (let lIdx = 0; lIdx < 7; lIdx++) {
      const stemGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.4);
      const stemMat = new THREE.MeshStandardMaterial({ color: 0x166534 });
      const stem = new THREE.Mesh(stemGeo, stemMat);
      const sAngle = (lIdx / 7) * Math.PI * 2;
      stem.position.set(Math.sin(sAngle) * 0.1, 0.35, Math.cos(sAngle) * 0.1);
      stem.rotation.z = Math.sin(sAngle) * 0.4;
      stem.rotation.x = Math.cos(sAngle) * 0.4;
      plantGroup.add(stem);

      const leafGeo = new THREE.BoxGeometry(0.15, 0.005, 0.24);
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(Math.sin(sAngle) * 0.22, 0.52 + Math.random() * 0.06, Math.cos(sAngle) * 0.22);
      leaf.rotation.y = sAngle + Math.PI / 2;
      leaf.rotation.x = 0.4 + Math.random() * 0.2;
      leaf.rotation.z = 0.1;
      plantGroup.add(leaf);
    }

    // Central Hologram Volumetric Beam & Geodesic Core
    const holoGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.9, 32, 1, true);
    const holoMat = new THREE.MeshBasicMaterial({
      color: 0x6366f1,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      wireframe: true
    });
    const hologram = new THREE.Mesh(holoGeo, holoMat);
    hologram.position.set(0, 0.95, 0);
    hologram.visible = false;
    scene.add(hologram);

    const hologramModelGroup = new THREE.Group();
    hologramModelGroup.position.set(0, 0.95, 0);
    scene.add(hologramModelGroup);
    hologramModelRef.current = hologramModelGroup;

    // Central Meeting / Conference Table
    const centralTableGroup = new THREE.Group();
    centralTableGroup.position.set(0, 0, 0);
    scene.add(centralTableGroup);

    // Table Top (Glass/Wood design)
    const tableTopGeo = new THREE.CylinderGeometry(1.0, 1.0, 0.04, 32);
    const tableTopMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // Dark slate wood/acrylic look
      roughness: 0.2,
      metalness: 0.5,
      transparent: true,
      opacity: 0.9
    });
    const tableTop = new THREE.Mesh(tableTopGeo, tableTopMat);
    tableTop.position.y = 0.5;
    tableTop.castShadow = true;
    tableTop.receiveShadow = true;
    centralTableGroup.add(tableTop);

    // Table Top Glass Insert
    const glassInsertGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.01, 32);
    const glassInsertMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.4,
      roughness: 0.1,
      metalness: 0.9
    });
    const glassInsert = new THREE.Mesh(glassInsertGeo, glassInsertMat);
    glassInsert.position.y = 0.52;
    centralTableGroup.add(glassInsert);

    // Table Base (Central Metal Column)
    const tableBaseGeo = new THREE.CylinderGeometry(0.18, 0.32, 0.5, 16);
    const tableBaseMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.4,
      metalness: 0.8
    });
    const tableBase = new THREE.Mesh(tableBaseGeo, tableBaseMat);
    tableBase.position.y = 0.25;
    tableBase.castShadow = true;
    centralTableGroup.add(tableBase);

    // Taça da Copa do Mundo (Centerpiece)
    const tacaGroup = new THREE.Group();
    tacaGroup.position.set(0, 0.54, 0);
    centralTableGroup.add(tacaGroup);
    
    const tacaBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 0.04, 16),
      new THREE.MeshStandardMaterial({ color: 0x064e3b, roughness: 0.5 }) // Dark green base
    );
    tacaGroup.add(tacaBase);
    
    const tacaBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.06, 0.15, 16),
      new THREE.MeshStandardMaterial({ color: 0xffdf00, metalness: 1.0, roughness: 0.2 }) // Gold
    );
    tacaBody.position.y = 0.09;
    tacaGroup.add(tacaBody);

    const tacaTop = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xffdf00, metalness: 1.0, roughness: 0.2 }) // Gold sphere
    );
    tacaTop.position.y = 0.19;
    tacaGroup.add(tacaTop);

    // Floating Hologram Particles (Increased to 150)
    const particleCount = 150;
    const particlesGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSpeeds = [];

    for (let i = 0; i < particleCount; i++) {
      const pAngle = Math.random() * Math.PI * 2;
      const pRadius = Math.random() * 1.3;
      particlePositions[i * 3] = Math.sin(pAngle) * pRadius;
      particlePositions[i * 3 + 1] = 0.5 + Math.random() * 2.0; 
      particlePositions[i * 3 + 2] = Math.cos(pAngle) * pRadius;
      particleSpeeds.push(0.002 + Math.random() * 0.0035);
    }

    particlesGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particlesMat = new THREE.PointsMaterial({
      size: 0.038,
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending
    });
    const particleSystem = new THREE.Points(particlesGeo, particlesMat);
    // Removed to keep Habbo room clear of floating hologram particles
    // scene.add(particleSystem);

    // Orbiting Hologram Rings
    const orbitRingGeo1 = new THREE.RingGeometry(0.7, 0.715, 32);
    const orbitRingGeo2 = new THREE.RingGeometry(0.8, 0.815, 32);
    const orbitRingMat1 = new THREE.MeshBasicMaterial({ color: 0x6366f1, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
    const orbitRingMat2 = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
    
    const orbitRing1 = new THREE.Mesh(orbitRingGeo1, orbitRingMat1);
    const orbitRing2 = new THREE.Mesh(orbitRingGeo2, orbitRingMat2);
    orbitRing1.position.set(0, 0.95, 0);
    orbitRing2.position.set(0, 0.95, 0);
    // Removed to keep Habbo room clear of glowing orbiting rings
    // scene.add(orbitRing1);
    // scene.add(orbitRing2);

    // Generate 5 Avatar Groups at their scattered normal positions
    const agentsArray = Object.keys(AGENTS);
    const avatarObjects = {};

    agentsArray.forEach((agentId, idx) => {
      const agentAngle = (idx / agentsArray.length) * Math.PI * 2;
      const startPos = NORMAL_POSITIONS[agentId];
      const group = new THREE.Group();
      group.position.set(startPos.x, 0.5, startPos.z);
      group.lookAt(0, 0.5, 0);
      scene.add(group);

      // Seat pedestal indicator ring on floor (only for sitting agents)
      const agentColor = AGENTS[agentId].color;
      const sitting = isSittingNormal[agentId];

      if (sitting) {
        const seatRingGeo = new THREE.RingGeometry(0.25, 0.27, 24);
        const seatRingMat = new THREE.MeshBasicMaterial({ color: agentColor, side: THREE.DoubleSide, transparent: true, opacity: 0.4 });
        const seatRing = new THREE.Mesh(seatRingGeo, seatRingMat);
        seatRing.rotation.x = Math.PI / 2;
        seatRing.position.set(startPos.x, 0.01, startPos.z);
        scene.add(seatRing);

        // Habbo-style blocky chair
        const chairGroup = new THREE.Group();
        chairGroup.position.set(startPos.x, 0.45, startPos.z);
        chairGroup.lookAt(0, 0.45, 0);
        scene.add(chairGroup);

        // Seat (flat box)
        const seatBase = new THREE.Mesh(
          new THREE.BoxGeometry(0.4, 0.06, 0.4),
          seatMat
        );
        seatBase.position.y = 0.0;
        seatBase.receiveShadow = true;
        chairGroup.add(seatBase);

        // Backrest (agent colored block)
        const backRestMat = new THREE.MeshStandardMaterial({
          color: agentColor,
          roughness: 0.7,
          metalness: 0.1
        });
        const backRest = new THREE.Mesh(
          new THREE.BoxGeometry(0.4, 0.5, 0.06),
          backRestMat
        );
        backRest.position.set(0, 0.25, -0.18);
        backRest.castShadow = true;
        chairGroup.add(backRest);

        // 4 blocky legs
        const legMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8 });
        for (let lx = -1; lx <= 1; lx += 2) {
          for (let lz = -1; lz <= 1; lz += 2) {
            const leg = new THREE.Mesh(
              new THREE.BoxGeometry(0.04, 0.45, 0.04),
              legMat
            );
            leg.position.set(lx * 0.16, -0.25, lz * 0.16);
            chairGroup.add(leg);
          }
        }
      }

      // ───────────────────────────────────────────────────────────
      // HABBO-STYLE BLOCKY CHARACTER (Pixel Art 3D)
      // ───────────────────────────────────────────────────────────
      const robotBody = new THREE.Group();
      robotBody.position.set(0, 0, -0.05);
      robotBody.scale.set(1.4, 1.4, 1.4);
      group.add(robotBody);

      // Skin tones per agent
      let skinColor = 0xffe0bd;
      if (agentId === 'oscar') skinColor = 0xffe0bd; 
      if (agentId === 'leo') skinColor = 0xfddcb9; 
      if (agentId === 'afrodite') skinColor = 0x5c3d2e;
      if (agentId === 'thor') skinColor = 0xe0a98c;
      if (agentId === 'sabotagem') skinColor = 0xc68642;

      const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.9, metalness: 0.0 });
      let shirtColor = AGENTS[agentId].color;
      if (agentId === 'oscar') shirtColor = 0xffffff; // White suit blazer!
      if (agentId === 'leo') shirtColor = 0xef4444; // Bazinga Red shirt!
      if (agentId === 'afrodite') shirtColor = 0xb91c1c; // La Casa de Papel Jumpsuit Red!
      if (agentId === 'thor') shirtColor = 0x78350f; // Brown leather armor!
      if (agentId === 'sabotagem') shirtColor = 0x18181b; // Streetwear black jacket!
      const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.95, metalness: 0.0 });

      let armUpperMat = shirtMat;
      let armForeMat = skinMat;

      if (agentId === 'oscar') {
        armUpperMat = shirtMat; // white blazer sleeve
        armForeMat = shirtMat; // white blazer sleeve
      } else if (agentId === 'leo') {
        const greySleeveMat = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.95, metalness: 0.0 });
        armUpperMat = greySleeveMat; // grey long sleeve
        armForeMat = greySleeveMat; // grey long sleeve
      } else if (agentId === 'afrodite') {
        armUpperMat = shirtMat; // red jumpsuit sleeve
        armForeMat = shirtMat; // red jumpsuit sleeve
      } else if (agentId === 'thor') {
        const bracerMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.8, roughness: 0.2 });
        armUpperMat = shirtMat; // brown leather upper
        armForeMat = bracerMat; // steel arm bracers
      } else if (agentId === 'sabotagem') {
        armUpperMat = shirtMat; // black jacket sleeve
        armForeMat = shirtMat; // black jacket sleeve
      }

      let pantsColor = 0x1d4ed8;
      if (agentId === 'oscar') pantsColor = 0x334155; // Charcoal suit pants
      if (agentId === 'leo') pantsColor = 0x1d4ed8; // Blue jeans
      if (agentId === 'afrodite') pantsColor = 0xb91c1c; // Red jumpsuit pants!
      if (agentId === 'thor') pantsColor = 0x374151; // Dark pants
      if (agentId === 'sabotagem') pantsColor = 0x18181b; // Black pants
      const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.95, metalness: 0.0 });
      const shoesMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8 });

      // ── TORSO (blocky box) ──
      const isFemale = agentId === 'afrodite';
      const chestW = isFemale ? 0.14 : 0.18;
      const chestD = isFemale ? 0.08 : 0.10;

      const chest = new THREE.Mesh(
        new THREE.BoxGeometry(chestW, 0.18, chestD),
        shirtMat
      );
      chest.position.y = 0.09;
      robotBody.add(chest);

      if (agentId === 'leo') {
        // Sheldon's Bazinga logo on chest
        const logoGroup = new THREE.Group();
        logoGroup.position.set(0, 0.09, 0.051); // front of chest
        logoGroup.rotation.x = Math.PI / 2;
        robotBody.add(logoGroup);

        const logoBg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.042, 0.042, 0.002, 12),
          new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        logoGroup.add(logoBg);

        const flash1 = new THREE.Mesh(
          new THREE.BoxGeometry(0.015, 0.05, 0.003),
          new THREE.MeshBasicMaterial({ color: 0xfacc15 })
        );
        flash1.rotation.z = -0.3; // tilt lightning bolt
        logoGroup.add(flash1);

        const flash2 = new THREE.Mesh(
          new THREE.BoxGeometry(0.01, 0.03, 0.004),
          new THREE.MeshBasicMaterial({ color: 0xfacc15 })
        );
        flash2.position.set(-0.015, 0.01, 0);
        flash2.rotation.z = 0.5;
        logoGroup.add(flash2);
      }

      if (agentId === 'oscar') {
        // Architect's blueprint drawing tube (porta-projetos) on Oscar's back
        const tubeGroup = new THREE.Group();
        tubeGroup.position.set(-0.06, 0.08, -0.08);
        tubeGroup.rotation.z = 0.45; // diagonal on back
        tubeGroup.rotation.y = 0.25;
        robotBody.add(tubeGroup);

        const tubeBody = new THREE.Mesh(
          new THREE.CylinderGeometry(0.024, 0.024, 0.26, 8),
          new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.4 })
        );
        tubeGroup.add(tubeBody);

        const tubeCap = new THREE.Mesh(
          new THREE.CylinderGeometry(0.026, 0.026, 0.04, 8),
          new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 })
        );
        tubeCap.position.y = 0.13;
        tubeGroup.add(tubeCap);

        // Strap wrapping around shoulder
        const strap = new THREE.Mesh(
          new THREE.BoxGeometry(0.01, 0.32, 0.18),
          new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 })
        );
        strap.position.set(0.05, 0.02, 0.06);
        strap.rotation.x = -Math.PI / 4;
        tubeGroup.add(strap);
      }

      if (agentId === 'afrodite') {
        // La Casa de Papel Jumpsuit Zipper (Cremalheira)
        const zipper = new THREE.Mesh(
          new THREE.BoxGeometry(0.012, 0.14, 0.005),
          new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.5 }) // black zipper line
        );
        zipper.position.set(0, 0.09, 0.041); // center front of chest
        robotBody.add(zipper);

        const zipperPull = new THREE.Mesh(
          new THREE.BoxGeometry(0.016, 0.03, 0.008),
          new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.9, roughness: 0.1 }) // silver puller
        );
        zipperPull.position.set(0, 0.13, 0.043);
        robotBody.add(zipperPull);

        // Red Hood on back of the torso (hanging down)
        const hood = new THREE.Mesh(
          new THREE.BoxGeometry(0.10, 0.14, 0.04),
          shirtMat
        );
        hood.position.set(0, 0.08, -0.06); // back of torso
        robotBody.add(hood);

        // Black waist belt
        const belt = new THREE.Mesh(
          new THREE.BoxGeometry(0.15, 0.025, 0.09),
          new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 })
        );
        belt.position.y = -0.005; // slightly above pelvis/crotch
        robotBody.add(belt);

        // Shoulder strap harness (tactical look)
        const strapL = new THREE.Mesh(
          new THREE.BoxGeometry(0.02, 0.20, 0.09),
          new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 })
        );
        strapL.position.set(-0.045, 0.09, 0.005);
        strapL.rotation.y = 0.05;
        robotBody.add(strapL);

        const strapR = new THREE.Mesh(
          new THREE.BoxGeometry(0.02, 0.20, 0.09),
          new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 })
        );
        strapR.position.set(0.045, 0.09, 0.005);
        strapR.rotation.y = -0.05;
        robotBody.add(strapR);

        // Salvador Dalí Mask hanging on the side of her belt/hip
        const maskGroup = new THREE.Group();
        maskGroup.position.set(0.07, -0.02, 0.05); // side of pelvis/hip, slightly forward
        maskGroup.rotation.y = 0.3;
        maskGroup.rotation.z = -0.2;
        robotBody.add(maskGroup);

        const maskFace = new THREE.Mesh(
          new THREE.BoxGeometry(0.07, 0.09, 0.03),
          new THREE.MeshStandardMaterial({ color: 0xf3f4f6, roughness: 0.8 }) // white/light grey face
        );
        maskGroup.add(maskFace);

        // Mustache (Dalí's signature long mustache pointing up)
        const mustacheMat = new THREE.MeshBasicMaterial({ color: 0x111827 });
        const mustacheL = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.008, 0.005), mustacheMat);
        mustacheL.position.set(-0.015, -0.015, 0.016);
        mustacheL.rotation.z = 0.5; // curved up left
        maskGroup.add(mustacheL);

        const mustacheR = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.008, 0.005), mustacheMat);
        mustacheR.position.set(0.015, -0.015, 0.016);
        mustacheR.rotation.z = -0.5; // curved up right
        maskGroup.add(mustacheR);

        // Big stylized eyes and eyebrows
        const eyeBrowL = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.006, 0.005), mustacheMat);
        eyeBrowL.position.set(-0.016, 0.018, 0.016);
        eyeBrowL.rotation.z = -0.25;
        maskGroup.add(eyeBrowL);

        const eyeBrowR = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.006, 0.005), mustacheMat);
        eyeBrowR.position.set(0.016, 0.018, 0.016);
        eyeBrowR.rotation.z = 0.25;
        maskGroup.add(eyeBrowR);

        // Eyes
        const maskEyeL = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.004), mustacheMat);
        maskEyeL.position.set(-0.016, 0.008, 0.016);
        maskGroup.add(maskEyeL);

        const maskEyeR = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.004), mustacheMat);
        maskEyeR.position.set(0.016, 0.008, 0.016);
        maskGroup.add(maskEyeR);

        // Rosy cheeks (red circles/squares)
        const cheekMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
        const cheekL = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.002), cheekMat);
        cheekL.position.set(-0.022, -0.01, 0.016);
        maskGroup.add(cheekL);

        const cheekR = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.002), cheekMat);
        cheekR.position.set(0.022, -0.01, 0.016);
        maskGroup.add(cheekR);
      }

      // Collar stripe
      const collar = new THREE.Mesh(
        new THREE.BoxGeometry(chestW + 0.01, 0.02, chestD + 0.005),
        shirtMat
      );
      collar.position.y = 0.19;
      robotBody.add(collar);

      // ── NECK (small skin block) ──
      const neck = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.03, 0.05),
        skinMat
      );
      neck.position.y = 0.21;
      robotBody.add(neck);

      // ── ARMS (blocky rectangles) ──
      const shoulderOffsetX = isFemale ? 0.10 : 0.12;

      // Left arm (shirt/sleeve)
      const shoulderL = new THREE.Group();
      shoulderL.position.set(-shoulderOffsetX, 0.15, 0);
      robotBody.add(shoulderL);

      const armUpperL = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.10, 0.05),
        armUpperMat
      );
      armUpperL.position.set(0, -0.05, 0);
      shoulderL.add(armUpperL);

      const elbowL = new THREE.Group();
      elbowL.position.set(0, -0.10, 0);
      shoulderL.add(elbowL);

      const armForeL = new THREE.Mesh(
        new THREE.BoxGeometry(0.045, 0.10, 0.045),
        armForeMat
      );
      armForeL.position.set(0, -0.05, 0);
      elbowL.add(armForeL);

      const handL = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.04, 0.04),
        skinMat
      );
      handL.position.set(0, -0.10, 0);
      elbowL.add(handL);

      // Right arm
      const shoulderR = new THREE.Group();
      shoulderR.position.set(shoulderOffsetX, 0.15, 0);
      robotBody.add(shoulderR);

      const armUpperR = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.10, 0.05),
        armUpperMat
      );
      armUpperR.position.set(0, -0.05, 0);
      shoulderR.add(armUpperR);

      const elbowR = new THREE.Group();
      elbowR.position.set(0, -0.10, 0);
      shoulderR.add(elbowR);

      const armForeR = new THREE.Mesh(
        new THREE.BoxGeometry(0.045, 0.10, 0.045),
        armForeMat
      );
      armForeR.position.set(0, -0.05, 0);
      elbowR.add(armForeR);

      const handR = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.04, 0.04),
        skinMat
      );
      handR.position.set(0, -0.10, 0);
      elbowR.add(handR);

      // ── LEGS (blocky) ──
      const pelvisW = isFemale ? 0.13 : 0.16;
      const pelvisD = isFemale ? 0.07 : 0.08;
      const pelvis = new THREE.Mesh(
        new THREE.BoxGeometry(pelvisW, 0.04, pelvisD),
        pantsMat
      );
      pelvis.position.set(0, -0.02, 0);
      robotBody.add(pelvis);

      const hipOffsetX = isFemale ? 0.04 : 0.05;

      const hipL = new THREE.Group();
      hipL.position.set(-hipOffsetX, -0.02, 0);
      robotBody.add(hipL);

      const hipR = new THREE.Group();
      hipR.position.set(hipOffsetX, -0.02, 0);
      robotBody.add(hipR);

      const thighW = isFemale ? 0.045 : 0.055;
      const thighD = isFemale ? 0.045 : 0.055;

      const thighL = new THREE.Mesh(new THREE.BoxGeometry(thighW, 0.08, thighD), pantsMat);
      thighL.position.set(0, -0.04, 0);
      hipL.add(thighL);

      const thighR = new THREE.Mesh(new THREE.BoxGeometry(thighW, 0.08, thighD), pantsMat);
      thighR.position.set(0, -0.04, 0);
      hipR.add(thighR);

      const kneeL = new THREE.Group();
      kneeL.position.set(0, -0.08, 0);
      hipL.add(kneeL);

      const kneeR = new THREE.Group();
      kneeR.position.set(0, -0.08, 0);
      hipR.add(kneeR);

      const shinW = isFemale ? 0.04 : 0.05;
      const shinD = isFemale ? 0.04 : 0.05;

      const shinL = new THREE.Mesh(new THREE.BoxGeometry(shinW, 0.10, shinD), pantsMat);
      shinL.position.set(0, -0.05, 0);
      kneeL.add(shinL);

      const shinR = new THREE.Mesh(new THREE.BoxGeometry(shinW, 0.10, shinD), pantsMat);
      shinR.position.set(0, -0.05, 0);
      kneeR.add(shinR);

      const footW = isFemale ? 0.045 : 0.055;
      const footD = isFemale ? 0.06 : 0.07;

      const footL = new THREE.Mesh(new THREE.BoxGeometry(footW, 0.03, footD), shoesMat);
      footL.position.set(0, -0.10, 0.01);
      kneeL.add(footL);

      const footR = new THREE.Mesh(new THREE.BoxGeometry(footW, 0.03, footD), shoesMat);
      footR.position.set(0, -0.10, 0.01);
      kneeR.add(footR);

      // ── EXTRACTS for animation ──
      let extraRefs = {};
      extraRefs.pelvis = pelvis;
      extraRefs.hipL = hipL;
      extraRefs.hipR = hipR;
      extraRefs.thighL = thighL;
      extraRefs.thighR = thighR;
      extraRefs.kneeL = kneeL;
      extraRefs.kneeR = kneeR;
      extraRefs.shinL = shinL;
      extraRefs.shinR = shinR;
      extraRefs.footL = footL;
      extraRefs.footR = footR;
      extraRefs.shoulderL = shoulderL;
      extraRefs.shoulderR = shoulderR;
      extraRefs.elbowL = elbowL;
      extraRefs.elbowR = elbowR;
      extraRefs.armUpperL = armUpperL;
      extraRefs.armUpperR = armUpperR;
      extraRefs.armForeL = armForeL;
      extraRefs.armForeR = armForeR;
      extraRefs.handL = handL;
      extraRefs.handR = handR;

      // Coffee cup
      const coffeeCup = new THREE.Mesh(
        new THREE.BoxGeometry(0.025, 0.03, 0.025),
        new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.5 })
      );
      coffeeCup.position.set(0, -0.01, 0.015);
      coffeeCup.scale.set(0, 0, 0);
      handR.add(coffeeCup);
      extraRefs.coffeeCup = coffeeCup;

      // ───────────────────────────────────────────────────────────
      // HEAD — Big blocky Habbo head
      // ───────────────────────────────────────────────────────────
      const headGeo = new THREE.BoxGeometry(0.15, 0.14, 0.13);
      const head = new THREE.Mesh(headGeo, skinMat);
      head.position.set(0, 0.25, 0);
      robotBody.add(head);

      // Black pixel eyes (flat rectangles - Habbo style)
      const eyeMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.15 });
      
      const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.02, 0.005), eyeMat);
      eyeL.position.set(-0.03, 0.01, 0.066);
      head.add(eyeL);

      const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.02, 0.005), eyeMat);
      eyeR.position.set(0.03, 0.01, 0.066);
      head.add(eyeR);

      // White eye highlights (pixel sparkle)
      const highlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 0.002), highlightMat);
      hlL.position.set(0.005, 0.004, 0.001);
      eyeL.add(hlL);

      const hlR = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 0.002), highlightMat);
      hlR.position.set(0.005, 0.004, 0.001);
      eyeR.add(hlR);

      // Small pixel mouth
      const mouth = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.006, 0.005),
        new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.5 })
      );
      mouth.position.set(0, -0.025, 0.066);
      head.add(mouth);

      // ───────────────────────────────────────────────────────────
      // HABBO HAIR & ACCESSORIES (per agent)
      // ───────────────────────────────────────────────────────────
      if (agentId === 'oscar') {
        // Oscar: Balding white hair + glasses + black tie
        const hairMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.95 }); // white/grey hair
        
        // No top hair block (balding!)
        
        // Side hair blocks
        const hairSideL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, 0.13), hairMat);
        hairSideL.position.set(-0.085, 0.04, -0.005);
        head.add(hairSideL);

        const hairSideR = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, 0.13), hairMat);
        hairSideR.position.set(0.085, 0.04, -0.005);
        head.add(hairSideR);

        // Back hair
        const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.10, 0.02), hairMat);
        hairBack.position.set(0, 0.03, -0.075);
        head.add(hairBack);

        // Pixel glasses
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5 });
        const lensL = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.025, 0.005), frameMat);
        lensL.position.set(-0.03, 0.01, 0.068);
        head.add(lensL);

        const lensR = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.025, 0.005), frameMat);
        lensR.position.set(0.03, 0.01, 0.068);
        head.add(lensR);

        const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.005, 0.005), frameMat);
        bridge.position.set(0, 0.01, 0.068);
        head.add(bridge);

        // Black tie block
        const tieMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 }); // solid black tie
        const tie = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.10, 0.02), tieMat);
        tie.position.set(0, 0.08, 0.06);
        robotBody.add(tie);

        // Blueprint ring
        const blueprintRingGeo = new THREE.RingGeometry(0.2, 0.22, 4);
        const blueprintRingMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
        const blueprintRing = new THREE.Mesh(blueprintRingGeo, blueprintRingMat);
        blueprintRing.rotation.x = Math.PI / 2;
        blueprintRing.position.set(0, -0.04, 0);
        robotBody.add(blueprintRing);
        extraRefs.blueprintRing = blueprintRing;

      } else if (agentId === 'leo') {
        // Sheldon: Combed neat brown hair
        const hairMat = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.95 }); // brown

        const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.14), hairMat);
        hairTop.position.set(0, 0.085, -0.005);
        head.add(hairTop);

        // Neat combed side blocks (no black spikes)
        const hairSideL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.13), hairMat);
        hairSideL.position.set(-0.085, 0.05, -0.005);
        head.add(hairSideL);

        const hairSideR = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.13), hairMat);
        hairSideR.position.set(0.085, 0.05, -0.005);
        head.add(hairSideR);

        const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.02), hairMat);
        hairBack.position.set(0, 0.03, -0.075);
        head.add(hairBack);

        extraRefs.eyeL = eyeL;
        extraRefs.eyeR = eyeR;

      } else if (agentId === 'afrodite') {
        // Nairobi: Dark braids + gold necklace (no pink glasses)
        const hairMat = new THREE.MeshStandardMaterial({ color: 0x27170a, roughness: 0.95 });

        const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.04, 0.15), hairMat);
        hairTop.position.set(0, 0.09, -0.005);
        head.add(hairTop);

        // Braids (blocky vertical strips)
        const strands = [];
        for (let i = 0; i < 4; i++) {
          const strand = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.02), hairMat);
          const xOffset = -0.05 + i * 0.035;
          strand.position.set(xOffset, -0.03, -0.07);
          head.add(strand);
          strands.push(strand);
        }
        extraRefs.hairStrands = strands;

        // Gold necklace around collar area
        const necklaceMat = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.9, roughness: 0.1 });
        const necklace = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.015, 0.07), necklaceMat);
        necklace.position.set(0, 0.215, 0.01);
        robotBody.add(necklace);

      } else if (agentId === 'thor') {
        // Ragnar: Mohawk blond hair + back braid + cross leather straps + beard
        const hairMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.95 });

        // Mohawk top strip (no side hair blocks)
        const mohawk = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.16), hairMat);
        mohawk.position.set(0, 0.09, 0);
        head.add(mohawk);

        // Back braid
        const braid = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.03), hairMat);
        braid.position.set(0, -0.02, -0.075);
        head.add(braid);

        // Pixel beard
        const beard = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.05, 0.04), hairMat);
        beard.position.set(0, -0.055, 0.05);
        head.add(beard);

        // Cross leather straps on chest
        const strapMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
        const strap1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.22, 0.105), strapMat);
        strap1.position.set(0, 0.09, 0.002);
        strap1.rotation.z = 0.55;
        robotBody.add(strap1);

        const strap2 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.22, 0.105), strapMat);
        strap2.position.set(0, 0.09, 0.003);
        strap2.rotation.z = -0.55;
        robotBody.add(strap2);

        // Hammer in Thor's left hand
        const hammerGroup = new THREE.Group();
        hammerGroup.position.set(0, -0.04, 0.04);
        hammerGroup.rotation.x = Math.PI / 2;
        hammerGroup.rotation.y = 0.2;
        handL.add(hammerGroup);

        const block = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.08, 0.08),
          new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.3 })
        );
        hammerGroup.add(block);

        const handle = new THREE.Mesh(
          new THREE.BoxGeometry(0.025, 0.22, 0.025),
          new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 })
        );
        handle.position.y = -0.09;
        hammerGroup.add(handle);

      } else {
        // Sabotagem: Beanie cap (touca) over dreadlocks + gold chain + beard
        const hairMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.95 });

        // Black beanie cap (touca) covering the top
        const beanieMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8 });
        const beanieTop = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.06, 0.15), beanieMat);
        beanieTop.position.set(0, 0.09, -0.005);
        head.add(beanieTop);

        // Multiple pixel-art dreadlocks hanging down from under beanie
        const dreadPositions = [
          { x: -0.08, y: -0.02, z: -0.04 },
          { x: -0.08, y: -0.06, z: 0.01 },
          { x: 0.08, y: -0.02, z: -0.04 },
          { x: 0.08, y: -0.06, z: 0.01 },
          { x: -0.04, y: -0.05, z: -0.07 },
          { x: 0.04, y: -0.05, z: -0.07 },
          { x: 0.0, y: -0.08, z: -0.075 }
        ];

        dreadPositions.forEach((pos) => {
          const dread = new THREE.Mesh(
            new THREE.BoxGeometry(0.026, 0.14 + Math.random() * 0.06, 0.026),
            hairMat
          );
          dread.position.set(pos.x, pos.y, pos.z);
          head.add(dread);
        });

        // Pixel beard
        const beard = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.03), hairMat);
        beard.position.set(0, -0.05, 0.05);
        head.add(beard);

        // Gold chain around neck
        const chainMat = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.9, roughness: 0.1 });
        const chain = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.012, 0.08), chainMat);
        chain.position.set(0, 0.20, 0.01);
        robotBody.add(chain);
      }

      // Add a floating Holographic HUD screen monitor above every agent's head
      const hudCanvas = document.createElement('canvas');
      hudCanvas.width = 256;
      hudCanvas.height = 128;
      const hudCtx = hudCanvas.getContext('2d');
      const hudTexture = new THREE.CanvasTexture(hudCanvas);

      const hudGeo = new THREE.PlaneGeometry(0.35, 0.22);
      const hudMat = new THREE.MeshBasicMaterial({ 
        map: hudTexture,
        transparent: true, 
        opacity: 0.0, 
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const hudMesh = new THREE.Mesh(hudGeo, hudMat);
      hudMesh.position.set(0, 0.44, 0);
      group.add(hudMesh);

      // Initialize canvas content once
      updateHudCanvas(agentId, hudCanvas, hudCtx, hudTexture, 'idle', false, 0);

      // Holographic concentric rings on the HUD screen
      const hudRingGeo = new THREE.RingGeometry(0.07, 0.08, 24);
      const hudRingMat = new THREE.MeshBasicMaterial({ color: agentColor, transparent: true, opacity: 0.0 });
      const hudRing = new THREE.Mesh(hudRingGeo, hudRingMat);
      hudRing.position.set(0, 0, 0.005);
      hudMesh.add(hudRing);

      extraRefs.hudMesh = hudMesh;
      extraRefs.hudMat = hudMat;
      extraRefs.hudRingMat = hudRingMat;
      extraRefs.hudCanvas = hudCanvas;
      extraRefs.hudCtx = hudCtx;
      extraRefs.hudTexture = hudTexture;

      avatarObjects[agentId] = {
        group: group,
        head: head,
        baseY: 0.5,
        angle: agentAngle,
        extraRefs: extraRefs,
        wanderTargetX: startPos.x,
        wanderTargetZ: startPos.z,
        wanderTimer: Date.now() + Math.random() * 5000,
        isWandering: true
      };
    });

    let zoomVal = 4.5;
    let targetAngle = -0.6;
    let cameraAngleY = -0.6;
    let cameraAngleX = 0.25;

    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let previousTouchDistance = 0;

    const onMouseDown = (e) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      cameraAngleY += deltaX * 0.007;
      cameraAngleX += deltaY * 0.007;
      cameraAngleX = Math.max(0.1, Math.min(Math.PI / 2.2, cameraAngleX));

      stateRef.current.rotationY = cameraAngleY;
      stateRef.current.rotationX = cameraAngleX;

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => { isDragging = false; };
    const onWheel = (e) => {
      e.preventDefault();
      zoomVal += e.deltaY * 0.005;
      zoomVal = Math.max(2.0, Math.min(8.0, zoomVal));
      stateRef.current.zoomTarget = zoomVal;
    };

    // Touch Event Handlers for Mobile (Drag Rotation & Pinch Zoom)
    const onTouchStart = (e) => {
      if (e.touches.length === 1) {
        isDragging = true;
        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        isDragging = false;
        previousTouchDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    };

    const onTouchMove = (e) => {
      if (isDragging && e.touches.length === 1) {
        const deltaX = e.touches[0].clientX - previousMousePosition.x;
        const deltaY = e.touches[0].clientY - previousMousePosition.y;

        cameraAngleY += deltaX * 0.007;
        cameraAngleX += deltaY * 0.007;
        cameraAngleX = Math.max(0.1, Math.min(Math.PI / 2.2, cameraAngleX));

        stateRef.current.rotationY = cameraAngleY;
        stateRef.current.rotationX = cameraAngleX;

        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const delta = dist - previousTouchDistance;
        zoomVal -= delta * 0.01;
        zoomVal = Math.max(2.0, Math.min(8.0, zoomVal));
        stateRef.current.zoomTarget = zoomVal;
        previousTouchDistance = dist;
      }
    };

    const onTouchEnd = () => {
      isDragging = false;
    };

    const raycaster = new THREE.Raycaster();
    const mouseVector = new THREE.Vector2();

    const onMouseClick = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouseVector.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseVector.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouseVector, camera);

      // Check intersections with each agent's group first
      let clickedAgent = null;
      for (const agentId of agentsArray) {
        const av = avatarObjects[agentId];
        if (av && av.group) {
          const intersectsAgent = raycaster.intersectObject(av.group, true);
          if (intersectsAgent.length > 0) {
            clickedAgent = agentId;
            break;
          }
        }
      }

      if (clickedAgent) {
        setActiveAgent(clickedAgent);
        playSynthSound('click');
        addLog(`🎥 Foco alterado para ${AGENTS[clickedAgent].nome} (clique 3D)`);
        toast.info(`Câmera focada em: ${AGENTS[clickedAgent].nome}`);
        return;
      }

      const intersectsTable = raycaster.intersectObjects([hologram]);
      const intersectsCoffee = raycaster.intersectObject(coffeeTableGroup, true);

      if (intersectsTable.length > 0) {
        // Clicou na Mesa Principal -> Vai para a Reunião (isCoffeeBreak = false)
        if (stateRef.current.isCoffeeBreak) {
          stateRef.current.isCoffeeBreak = false;
          setIsCoffeeBreak(false);
          playSynthSound('success');
          addLog('🔔 [Reunião] Matheusjardim convocou o Squad para a mesa de discussão!');
          toast.info('Squad convocado para a mesa de discussão!');
        }
      } else if (intersectsCoffee.length > 0) {
        // Clicou no Cantinho de Café -> Vai para o Coffee Break (isCoffeeBreak = true)
        if (!stateRef.current.isCoffeeBreak) {
          stateRef.current.isCoffeeBreak = true;
          setIsCoffeeBreak(true);
          playSynthSound('click');
          addLog('☕ [Coffee Break] Matheusjardim liberou o time para um café!');
          toast.info('Squad liberado para o Coffee Break!');
        }
      }
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('mousedown', onMouseDown);
    domEl.addEventListener('click', onMouseClick);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    domEl.addEventListener('wheel', onWheel, { passive: false });
    domEl.addEventListener('touchstart', onTouchStart, { passive: true });
    domEl.addEventListener('touchmove', onTouchMove, { passive: true });
    domEl.addEventListener('touchend', onTouchEnd, { passive: true });

    const tempV = new THREE.Vector3();
    const currentLookAt = new THREE.Vector3(0, 0.8, 0);
    let reqId;

    const BREAK_POSITIONS = {
      oscar: { x: -2.6, z: -4.0 },
      leo: { x: -4.0, z: -2.6 },
      afrodite: { x: -2.5, z: -3.3 },
      thor: { x: -3.3, z: -2.5 },
      sabotagem: { x: -2.8, z: -2.8 }
    };

    const animate = () => {
      reqId = requestAnimationFrame(animate);

      hologram.rotation.y += 0.006;
      if (hologramModelGroup) {
        hologramModelGroup.rotation.y += 0.012;
        const s1 = hologramModelGroup.getObjectByName("satGroup1");
        if (s1) s1.rotation.y += 0.025;
        const s2 = hologramModelGroup.getObjectByName("satGroup2");
        if (s2) s2.rotation.y -= 0.018;
      }
      
      const pulse = 1.0 + Math.sin(Date.now() * 0.004) * 0.04;
      hologram.scale.set(pulse, 1, pulse);

      // Animate server LEDs randomly
      if (serverLeds.length > 0 && Math.random() < 0.4) {
        const randomLed = serverLeds[Math.floor(Math.random() * serverLeds.length)];
        if (randomLed) {
          randomLed.material.opacity = Math.random() > 0.5 ? 0.95 : 0.2;
          const colors = [0x10b981, 0xef4444, 0xf59e0b];
          randomLed.material.color.setHex(colors[Math.floor(Math.random() * colors.length)]);
        }
      }

      let targetHoloColor = 0xffa500; // Orange (Warm for fire)
      let targetSpotColor = 0xffffff;
      let targetBgColor = 0x0f172a; // Slate 900 (Brighter than black)
      let targetAmbient = 1.0; // Brighter ambient light
      let targetHemi = 1.0;
      accentLight.color.setHex(0xffa500);
      accentLight.intensity = 1.0;

      tableMat.color.setHex(0xffffff); // Frosted white glass table
      tableMat.opacity = 0.65;
      brassMat.color.setHex(0x94a3b8); // Chrome table border
      standMat.color.setHex(0xe2e8f0); // Chrome stand
      cabinetMat.color.setHex(0x0f172a); // Dark cabinet
      
      hemiLight.groundColor.setHex(0x020617); // Dark ground reflection
      telemetryGridMat.opacity = 0.0;
      outerFloorMat.color.setHex(0x020617); // Keep dark void
      scene.fog.density = 0.012; 

      ambientLight.intensity = targetAmbient;
      hemiLight.intensity = targetHemi;
      scene.fog.color.setHex(targetBgColor);
      scene.background = new THREE.Color(targetBgColor);
      
      const activeHoloColor = stateRef.current.hologramColor || targetHoloColor;
      holoMat.color.setHex(activeHoloColor);
      accentLight.color.setHex(activeHoloColor);
      
      spotlight.color.setHex(targetSpotColor);
      renderer.setClearColor(targetBgColor);
      if (bokehGroup) {
        bokehGroup.visible = false;
      }

      tableGlowMat.color.setHex(activeHoloColor);
      orbitRingMat1.color.setHex(activeHoloColor);
      orbitRingMat2.color.setHex(activeHoloColor);
      particlesMat.color.setHex(activeHoloColor);
      floorRingMat.color.setHex(activeHoloColor);

      orbitRing1.rotation.x += 0.01;
      orbitRing1.rotation.y += 0.015;
      orbitRing2.rotation.y -= 0.012;
      orbitRing2.rotation.z += 0.008;

      const posArr = particlesGeo.attributes.position.array;
      for (let i = 0; i < particleCount; i++) {
        posArr[i * 3 + 1] += particleSpeeds[i];
        if (posArr[i * 3 + 1] > 2.5) {
          posArr[i * 3 + 1] = 0.5;
        }
      }
      particlesGeo.attributes.position.needsUpdate = true;

      // Animate floor neon rings
      if (floorRings) {
        floorRings.forEach((ring, idx) => {
          ring.rotation.z += 0.003 * (idx % 2 === 0 ? 1 : -1);
          ring.material.opacity = 0.04 + Math.sin(Date.now() * 0.0015 + idx) * 0.02;
        });
      }

      // Animate São João Fire and Band
      if (typeof fireCone !== 'undefined' && fireCone) {
        fireCone.scale.y = 1.0 + Math.sin(Date.now() * 0.015) * 0.2;
        fireCone.scale.x = 1.0 + Math.sin(Date.now() * 0.02) * 0.1;
        fireCone.scale.z = 1.0 + Math.cos(Date.now() * 0.02) * 0.1;
      }
      if (typeof fireLight !== 'undefined' && fireLight) {
        fireLight.intensity = 4 + Math.sin(Date.now() * 0.02) * 1.5;
      }
      


      // Animate wall telemetry grids (loft windows)
      if (wallGroup) {
        wallGroup.children.forEach((wall, wIdx) => {
          wall.children.forEach(child => {
            if (child.material === telemetryGridMat) {
              child.scale.x = 1 + Math.sin(Date.now() * 0.002 + wIdx) * 0.015;
              child.scale.y = 1 + Math.cos(Date.now() * 0.0025 + wIdx) * 0.015;
            }
          });
        });
      }


      const active = stateRef.current.activeAgent;

      if (active && AGENTS[active]) {
        const av = avatarObjects[active];
        av.group.position.y = av.baseY + Math.sin(Date.now() * 0.012) * 0.05;
        av.group.scale.set(1.1, 1.1, 1.1);

        // Move speaking light directly above the agent
        speakerLight.position.set(av.group.position.x, 3.2, av.group.position.z);
        speakerLightTarget.position.set(av.group.position.x, 0.4, av.group.position.z);
        
        // Match spotlight color to the agent's color
        speakerLight.color.setHex(AGENTS[active].color);
        speakerLight.intensity = 6.0 + Math.sin(Date.now() * 0.015) * 2.0;

        const speakerAngle = av.angle;
        targetAngle = -speakerAngle + Math.PI;
      } else {
        speakerLight.intensity = 0;
      }

      if (active) {
        // Disabled auto-focus on speaker to keep manual view
        // Zoom slightly
        zoomVal += (3.5 - zoomVal) * 0.05;
      } else {
        zoomVal += (stateRef.current.zoomTarget - zoomVal) * 0.05;
      }
      
      // Let manual rotation override
      cameraAngleY = stateRef.current.rotationY;
      cameraAngleX = stateRef.current.rotationX;


      agentsArray.forEach(id => {
        if (id !== active) {
          const av = avatarObjects[id];
          av.group.position.y += (av.baseY - av.group.position.y) * 0.1;
          av.group.scale.set(1, 1, 1);
        }
      });
      
      // Animate agent individual pieces and walk behavior
      agentsArray.forEach(id => {
        const av = avatarObjects[id];
        
        // Update Canvas HUD Screen Textures periodically (throttled to save CPU)
        if (av.extraRefs.hudCanvas && av.extraRefs.hudCtx && av.extraRefs.hudTexture) {
          const isSpeaking = active === id;
          const tick = Math.floor(Date.now() * 0.05);
          
          if (isSpeaking || Math.random() < 0.04) {
            updateHudCanvas(
              id,
              av.extraRefs.hudCanvas,
              av.extraRefs.hudCtx,
              av.extraRefs.hudTexture,
              stateRef.current.currentPhase || 'idle',
              isSpeaking,
              tick
            );
          }
        }

        av.group.rotation.x = 0;
        av.group.rotation.z = 0;
        const isCoffee = stateRef.current.isCoffeeBreak;
        
        // 1. Calculate Target Positions (Meeting vs Coffee Break vs Wander)
        const isActive = (active === id);
        let targetX = NORMAL_POSITIONS[id].x;
        let targetZ = NORMAL_POSITIONS[id].z;

        if (isCoffee) {
          targetX = BREAK_POSITIONS[id].x;
          targetZ = BREAK_POSITIONS[id].z;
          av.isWandering = false;
        } else if (isActive || stateRef.current.running) {
          targetX = NORMAL_POSITIONS[id].x;
          targetZ = NORMAL_POSITIONS[id].z;
          av.isWandering = false;
        } else {
          // Wander behavior for idle agents
          if (!av.wanderTargetX || !av.wanderTimer) {
            av.wanderTargetX = NORMAL_POSITIONS[id].x;
            av.wanderTargetZ = NORMAL_POSITIONS[id].z;
            av.wanderTimer = Date.now() + 2000 + Math.random() * 3000;
          }

          const distToWanderTarget = Math.sqrt(
            Math.pow(av.wanderTargetX - av.group.position.x, 2) +
            Math.pow(av.wanderTargetZ - av.group.position.z, 2)
          );

          if (distToWanderTarget < 0.15 || Date.now() > av.wanderTimer) {
            // Decide new target: 30% chance to go back to desk, 70% to wander randomly
            if (Math.random() < 0.3) {
              av.wanderTargetX = NORMAL_POSITIONS[id].x;
              av.wanderTargetZ = NORMAL_POSITIONS[id].z;
            } else {
              const wAngle = Math.random() * Math.PI * 2;
              const wDist = 1.3 + Math.random() * 2.2; // Keep targets outside central table (radius 1.0)
              av.wanderTargetX = Math.sin(wAngle) * wDist;
              av.wanderTargetZ = Math.cos(wAngle) * wDist;
            }
            av.wanderTimer = Date.now() + 4000 + Math.random() * 5000;
          }

          targetX = av.wanderTargetX;
          targetZ = av.wanderTargetZ;
        }

        const dx = targetX - av.group.position.x;
        const dz = targetZ - av.group.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        // 2. Smoothly move group coordinates (reduced speed for natural look)
        if (distance > 0.02) {
          av.group.position.x += dx * 0.012;
          av.group.position.z += dz * 0.012;
        } else {
          av.group.position.x = targetX;
          av.group.position.z = targetZ;
        }

        // Avoid central table (radius ~1.0 + character thickness ~0.2)
        const distFromCenter = Math.sqrt(av.group.position.x * av.group.position.x + av.group.position.z * av.group.position.z);
        if (distFromCenter < 1.25 && !isCoffee) {
          const pushForce = 1.25 - distFromCenter;
          const pushX = (av.group.position.x / (distFromCenter || 0.01)) * pushForce;
          const pushZ = (av.group.position.z / (distFromCenter || 0.01)) * pushForce;
          av.group.position.x += pushX * 0.25;
          av.group.position.z += pushZ * 0.25;
        }
        
        // 4. Transition Factor (Sitting vs Standing)
        av.transitionFactor = av.transitionFactor ?? 0;
        const distToNormal = Math.sqrt(
          Math.pow(NORMAL_POSITIONS[id].x - av.group.position.x, 2) +
          Math.pow(NORMAL_POSITIONS[id].z - av.group.position.z, 2)
        );
        const isAtNormalPos = distToNormal < 0.2;

        // 3. Handle rotation/orienting of the character
        if (distance > 0.05) {
          const walkAngle = Math.atan2(dx, dz);
          let diff = walkAngle - av.group.rotation.y;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          av.group.rotation.y += diff * 0.10; // slightly smoother turning
        } else {
          let faceAngle = 0;
          if (isCoffee) {
            const coffeeDx = -3.5 - av.group.position.x;
            const coffeeDz = -3.5 - av.group.position.z;
            faceAngle = Math.atan2(coffeeDx, coffeeDz);
          } else {
            let targetLookX = 0;
            let targetLookZ = 0;

            // Face their own PC workstations if they are working at their desks
            if (stateRef.current.running && isAtNormalPos) {
              if (id === 'oscar') { targetLookX = -3.6; targetLookZ = -3.6; }
              else if (id === 'leo') { targetLookX = 2.4; targetLookZ = -2.4; }
              else if (id === 'afrodite') { targetLookX = -2.0; targetLookZ = 2.0; }
              else if (id === 'thor') { targetLookX = 0.8; targetLookZ = -3.8; }
              else if (id === 'sabotagem') { targetLookX = 2.0; targetLookZ = 2.0; }
            }

            const dxLook = targetLookX - av.group.position.x;
            const dzLook = targetLookZ - av.group.position.z;
            faceAngle = Math.atan2(dxLook, dzLook);
          }
          let diff = faceAngle - av.group.rotation.y;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          av.group.rotation.y += diff * 0.08;
        }

        if (isCoffee) {
          av.transitionFactor += (1 - av.transitionFactor) * 0.08;
        } else {
          // Sit only if at normal desk/chair position and not wandering away
          const sits = isSittingNormal[id] && isAtNormalPos && (targetX === NORMAL_POSITIONS[id].x);
          const targetT = sits ? 0 : 1;
          av.transitionFactor += (targetT - av.transitionFactor) * 0.08;
        }
        const t = av.transitionFactor;
        
        // 5. Walking leg/arm swing cycle (slowed down swing speed to match natural walking pace)
        av.walkFactor = av.walkFactor ?? 0;
        if (distance > 0.05) {
          av.walkFactor += (1 - av.walkFactor) * 0.15;
        } else {
          av.walkFactor += (0 - av.walkFactor) * 0.15;
        }
        const wSwing = Math.sin(Date.now() * 0.0045 + id.charCodeAt(0)) * 0.45 * av.walkFactor;
        
        // 6. Shift body position based on sitting vs standing
        const robotBody = av.extraRefs.robotBody;
        if (robotBody) {
          robotBody.position.z = -0.05 * (1 - t) + 0.10 * t;
          robotBody.position.y = 0.15 * t;
        }
        
        // 7. Interpolate & Swing legs
        const hipL = av.extraRefs.hipL;
        const hipR = av.extraRefs.hipR;
        const kneeL = av.extraRefs.kneeL;
        const kneeR = av.extraRefs.kneeR;
        
        if (hipL && hipR && kneeL && kneeR) {
          // Quando sentado (t = 0), hip gira para a frente (-Math.PI/2) e knee dobra para trás (+Math.PI/2)
          hipL.rotation.x = (-Math.PI / 2) * (1 - t) + wSwing * t;
          kneeL.rotation.x = (Math.PI / 2) * (1 - t) + (Math.max(0, -wSwing) * 0.5) * t;
          
          hipR.rotation.x = (-Math.PI / 2) * (1 - t) - wSwing * t;
          kneeR.rotation.x = (Math.PI / 2) * (1 - t) + (Math.max(0, wSwing) * 0.5) * t;
        }
        
        // 8. Interpolate & Swing Arms/Elbows
        const shoulderL = av.extraRefs.shoulderL;
        const shoulderR = av.extraRefs.shoulderR;
        const elbowL = av.extraRefs.elbowL;
        const elbowR = av.extraRefs.elbowR;
        
        if (shoulderL && shoulderR && elbowL && elbowR) {
          const isTyping = (1 - t) > 0.8 && !isCoffee && stateRef.current.running;
          const typingSpeed = Date.now() * 0.03 + id.charCodeAt(0) * 10;
          const typeSwingL = isTyping ? Math.sin(typingSpeed) * 0.06 : 0;
          const typeSwingR = isTyping ? Math.cos(typingSpeed * 1.1) * 0.06 : 0;

          // Left Arm (Mão apoia sobre a mesa em pose de trabalho / digitação, braço caido na caminhada)
          shoulderL.rotation.x = -0.4 * (1 - t) + (0.1 - wSwing * 0.3) * t + typeSwingL;
          shoulderL.rotation.z = 0.05 * (1 - t) + 0.08 * t;
          elbowL.rotation.x = 1.0 * (1 - t) + 0.25 * t + typeSwingL * 0.5;
          
          // Right Arm (holds coffee cup in coffee break, resting on table in meeting / digitação)
          shoulderR.rotation.x = -0.4 * (1 - t) - 0.5 * t + typeSwingR;
          shoulderR.rotation.y = 0 * (1 - t) - 0.3 * t;
          shoulderR.rotation.z = -0.05 * (1 - t) - 0.1 * t;
          elbowR.rotation.x = 1.0 * (1 - t) + 1.2 * t + typeSwingR * 0.5;
        }
        
        // 9. Show/Scale Coffee Cup
        if (av.extraRefs.coffeeCup) {
          av.extraRefs.coffeeCup.scale.set(t, t, t);
        }
        
        // 10. HUD Screen visibility
        if (av.extraRefs.hudMat && av.extraRefs.hudRingMat) {
          if (active === id) {
            av.extraRefs.hudMat.opacity += (0.6 - av.extraRefs.hudMat.opacity) * 0.1;
            av.extraRefs.hudRingMat.opacity += (0.8 - av.extraRefs.hudRingMat.opacity) * 0.1;
            av.extraRefs.hudMesh.rotation.y = Math.sin(Date.now() * 0.003) * 0.15;
            av.extraRefs.hudMesh.position.y = 0.44 + Math.sin(Date.now() * 0.006) * 0.02;
          } else {
            av.extraRefs.hudMat.opacity += (0.0 - av.extraRefs.hudMat.opacity) * 0.1;
            av.extraRefs.hudRingMat.opacity += (0.0 - av.extraRefs.hudRingMat.opacity) * 0.1;
          }
        }

        // 11. Human breathing animation (subtle)
        const breathe = Math.sin(Date.now() * 0.0025 + id.charCodeAt(0)) * 0.006;
        av.group.position.y = av.baseY + breathe;

        // 12. Individual accessory animations
        if (id === 'oscar') {
          if (av.extraRefs.blueprintRing) {
            av.extraRefs.blueprintRing.rotation.z += 0.006;
          }
        }
        if (id === 'leo') {
          // Olhos piscando (humano)
          const isBlinking = (Math.floor(Date.now() / 3500) % 3 === 0) && (Date.now() % 3500 < 120);
          if (av.extraRefs.eyeL && av.extraRefs.eyeR) {
            const targetEyeY = isBlinking ? 0.08 : 1.0;
            av.extraRefs.eyeL.scale.y += (targetEyeY - av.extraRefs.eyeL.scale.y) * 0.35;
            av.extraRefs.eyeR.scale.y += (targetEyeY - av.extraRefs.eyeR.scale.y) * 0.35;
          }
        }
        if (id === 'afrodite' && av.extraRefs.hairStrands) {
          // Tranças oscilando suavemente
          av.extraRefs.hairStrands.forEach((strand, idx) => {
            strand.rotation.z = Math.sin(Date.now() * 0.004 + idx) * 0.04;
          });
        }
        
        // 13. Active speaker talking expressions
        if (active === id) {
          av.head.rotation.y = Math.sin(Date.now() * 0.007) * 0.15; // Vira cabeça falando
          av.head.position.y = 0.23 + Math.sin(Date.now() * 0.014) * 0.004; // Cabeça balança
        } else {
          av.head.rotation.y += (0.0 - av.head.rotation.y) * 0.1;
          av.head.position.y += (0.23 - av.head.position.y) * 0.1;
        }
      });

      camera.position.x = zoomVal * Math.sin(cameraAngleY) * Math.cos(cameraAngleX);
      camera.position.z = zoomVal * Math.cos(cameraAngleY) * Math.cos(cameraAngleX);
      camera.position.y = zoomVal * Math.sin(cameraAngleX);
      
      const isCoffee = stateRef.current.isCoffeeBreak;
      const targetLookAtX = isCoffee ? -3.3 : 0;
      const targetLookAtY = isCoffee ? 0.65 : 0.8;
      const targetLookAtZ = isCoffee ? -3.3 : 0;
      
      currentLookAt.x += (targetLookAtX - currentLookAt.x) * 0.05;
      currentLookAt.y += (targetLookAtY - currentLookAt.y) * 0.05;
      currentLookAt.z += (targetLookAtZ - currentLookAt.z) * 0.05;
      
      camera.lookAt(currentLookAt);

      agentsArray.forEach(id => {
        const bubbleEl = bubblesRefs[id].current;
        if (bubbleEl) {
          const av = avatarObjects[id];
          av.group.getWorldPosition(tempV);
          tempV.y += 0.42;
          
          tempV.project(camera);

          if (tempV.z > 1.0) {
            bubbleEl.style.display = 'none';
          } else {
            const x2d = (tempV.x * 0.5 + 0.5) * currentWidth;
            const y2d = (tempV.y * -0.5 + 0.5) * currentHeight;

            bubbleEl.style.display = (active === id && speechTextRef.current) ? 'block' : 'none';
            bubbleEl.style.left = `${x2d}px`;
            bubbleEl.style.top = `${y2d}px`;
          }
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!viewportRef.current) return;
      currentWidth = viewportRef.current.clientWidth;
      currentHeight = viewportRef.current.clientHeight;
      camera.aspect = currentWidth / currentHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(currentWidth, currentHeight);
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(viewportRef.current);

  // Return cleanup function
  return () => {
    cancelAnimationFrame(reqId);
    resizeObserver.disconnect();
    if (domEl) {
      domEl.removeEventListener('mousedown', onMouseDown);
      domEl.removeEventListener('click', onMouseClick);
      domEl.removeEventListener('wheel', onWheel);
      domEl.removeEventListener('touchstart', onTouchStart);
      domEl.removeEventListener('touchmove', onTouchMove);
      domEl.removeEventListener('touchend', onTouchEnd);
    }
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };
}
