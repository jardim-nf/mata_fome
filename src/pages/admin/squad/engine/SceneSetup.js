import * as THREE from 'three';

export function setupScene(viewportRef) {
    viewportRef.current.innerHTML = '';
    let currentWidth = viewportRef.current.clientWidth || 500;
    let currentHeight = viewportRef.current.clientHeight || 500;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xf1f5f9, 0.012);

    const NORMAL_POSITIONS = {
      oscar: { x: 0.0, z: -1.4 }, 
      leo: { x: 1.3, z: -0.4 }, 
      afrodite: { x: 0.8, z: 1.1 }, 
      thor: { x: -0.8, z: 1.1 }, 
      sabotagem: { x: -1.3, z: -0.4 } 
    };

    const isSittingNormal = {
      oscar: false,
      leo: false,
      afrodite: false,
      thor: false,
      sabotagem: false
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
  return { scene, camera, renderer, spotlight, speakerLight, speakerLightTarget, seatMat, accentLight };
}
