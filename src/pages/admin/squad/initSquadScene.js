import * as THREE from 'three';
import { buildAvatar } from './engine/AvatarBuilder';
import { buildScenery } from './engine/SceneryBuilder';
import { setupScene } from './engine/SceneSetup';
import { createAnimationLoop } from './engine/AnimationLoop';
import { NORMAL_POSITIONS, IS_SITTING_NORMAL } from './constants/positions';

// Agent roster (matches SquadMeeting3D.jsx)
const AGENTS = {
  oscar: { id: 'oscar', nome: 'Sheldon Cooper', cargo: 'Físico Teórico / Analista', emoji: '🖖', color: 0xeab308, phase: 'architecture' }, 
  leo: { id: 'leo', nome: 'Leonard Hofstadter', cargo: 'Físico Experimental / Dev', emoji: '🤓', color: 0x3b82f6, phase: 'ui' }, 
  afrodite: { id: 'afrodite', nome: 'Penny', cargo: 'Relações Públicas / Vendas', emoji: '🍷', color: 0xf43f5e, phase: 'backend' }, 
  thor: { id: 'thor', nome: 'Howard Wolowitz', cargo: 'Engenheiro Espacial / Infra', emoji: '🚀', color: 0xa855f7, phase: 'qa' }, 
  sabotagem: { id: 'sabotagem', nome: 'Rajesh Koothrappali', cargo: 'Astrofísico / Dados', emoji: '🌌', color: 0x10b981, phase: 'marketing' }
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
 * @param {React.RefObject} refs.hudRefs - HUD canvas DOM refs
 * @param {Object} refs.callbacks - Object containing React state setter callbacks
 * @returns {Function} cleanup - Call on unmount to dispose resources
 */
export function initSquadScene({ viewportRef, stateRef, speechTextRef, hologramModelRef, bubblesRefs, hudRefs, callbacks }) {
  const { setActiveAgent, playSynthSound, addLog, toast, setIsCoffeeBreak } = callbacks || {};
    if (!viewportRef.current) return;


    const { scene, camera, renderer, spotlight, speakerLight, speakerLightTarget, seatMat, accentLight } = setupScene(viewportRef);

    const floorMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc }); 
    const floorMat2 = new THREE.MeshStandardMaterial({ color: 0xe2e8f0 }); 
    const floorRingMat = new THREE.MeshBasicMaterial({ color: 0x4f46e5 });
    
    // --- OLD SCENERY (APARTMENT) REMOVED ---
    // The apartment group and its children were removed to prevent overlapping with the NASA Command Center.

    // --- VARIÁVEIS VAZIAS DE COMPATIBILIDADE (THEME SWITCHER) ---
    const serverLeds = [];
    const tableGlowMat = new THREE.MeshBasicMaterial();
    const tableMat = new THREE.MeshBasicMaterial();
    const brassMat = new THREE.MeshBasicMaterial();
    const concreteFloorMat = new THREE.MeshBasicMaterial();

    const floorRings = [];
    const wallGroup = null;
    const standMat = new THREE.MeshStandardMaterial({ color: 0x020617, metalness: 0.9, roughness: 0.25 });


    // Extraido para SceneryBuilder
    const { coffeeTableGroup, hologram } = buildScenery(scene, hologramModelRef, standMat);

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
      const sitting = IS_SITTING_NORMAL[agentId];

      if (sitting) {
        const seatRingGeo = new THREE.RingGeometry(0.25, 0.27, 24);
        const seatRingMat = new THREE.MeshBasicMaterial({ color: agentColor, side: THREE.DoubleSide, transparent: true, opacity: 0.4 });
        const seatRing = new THREE.Mesh(seatRingGeo, seatRingMat);
        seatRing.rotation.x = Math.PI / 2;
        seatRing.position.set(startPos.x, 0.01, startPos.z);
        scene.add(seatRing);

        // As cadeiras foram removidas para dar espaço ao cenário do The Big Bang Theory construído no SceneryBuilder.js
      }

      // ───────────────────────────────────────────────────────────
      // Extraido para AvatarBuilder
      const avatarData = buildAvatar(agentId, AGENTS);
      group.add(avatarData.robotBody);
      
      const { 
        extraRefs, 
        hudCanvas, 
        hudCtx, 
        hudTexture, 
        hudSprite, 
        nameTagCanvas, 
        nameTagCtx, 
        nameTagTexture, 
        nameTagSprite, 
        avatarPivot,
        head
      } = avatarData;

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


    // Extraido para AnimationLoop
    const { animate, stop: stopAnimation } = createAnimationLoop({
      camera, scene, renderer,
      hologramModelRef, speakerLightTarget, speakerLight, accentLight, spotlight,
      avatarObjects, stateRef, AGENTS, isSittingNormal: IS_SITTING_NORMAL,
      viewportRef, bubblesRefs, hudRefs, speechTextRef
    });
    
    // Substituindo o cleanup function


    animate();

    const handleResize = () => {
      if (!viewportRef.current) return;
      const currentWidth = viewportRef.current.clientWidth;
      const currentHeight = viewportRef.current.clientHeight;
      camera.aspect = currentWidth / currentHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(currentWidth, currentHeight);
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(viewportRef.current);

  // Return cleanup function
  return () => {
    stopAnimation();
    resizeObserver.disconnect();
    
    // 1. Remove Events
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

    // 2. Dispose of Three.js objects (Memory Leak Fix)
    scene.traverse((object) => {
      if (!object.isMesh) return;
      if (object.geometry) {
        object.geometry.dispose();
      }
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(material => {
            if (material.map) material.map.dispose();
            material.dispose();
          });
        } else {
          if (object.material.map) object.material.map.dispose();
          object.material.dispose();
        }
      }
    });

    // 3. Dispose of Renderer and WebGL Context
    renderer.dispose();
    renderer.forceContextLoss();

    // 4. Remove Canvas from DOM
    if (viewportRef.current) {
      viewportRef.current.innerHTML = '';
    }
  };
}
