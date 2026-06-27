// src/components/home/ThreeHeroCanvas.jsx
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const ThreeHeroCanvas = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || 500;

    // 1. Scene setup
    const scene = new THREE.Scene();

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    camera.position.z = 25;

    // 3. Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // 4. Create central globe
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    // Outer wireframe sphere
    const sphereGeo = new THREE.SphereGeometry(8, 16, 16);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0xf97316, // Orange
      wireframe: true,
      transparent: true,
      opacity: 0.18,
    });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    globeGroup.add(sphere);

    // Inner wireframe sphere
    const innerSphereGeo = new THREE.SphereGeometry(5, 12, 12);
    const innerSphereMat = new THREE.MeshBasicMaterial({
      color: 0xef4444, // Red-orange
      wireframe: true,
      transparent: true,
      opacity: 0.1,
    });
    const innerSphere = new THREE.Mesh(innerSphereGeo, innerSphereMat);
    globeGroup.add(innerSphere);

    // 5. Create particle constellation
    const particleCount = 75;
    const particlesGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = [];

    const range = 24; // boundary for particles
    for (let i = 0; i < particleCount; i++) {
      // Random positions within range
      positions[i * 3] = (Math.random() - 0.5) * range;
      positions[i * 3 + 1] = (Math.random() - 0.5) * range;
      positions[i * 3 + 2] = (Math.random() - 0.5) * range;

      // Random velocities
      velocities.push({
        x: (Math.random() - 0.5) * 0.05,
        y: (Math.random() - 0.5) * 0.05,
        z: (Math.random() - 0.5) * 0.05,
      });
    }

    particlesGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Particle material (glowing points)
    const pointsMat = new THREE.PointsMaterial({
      color: 0xf97316,
      size: 0.45,
      transparent: true,
      opacity: 0.8,
    });

    const particleSystem = new THREE.Points(particlesGeo, pointsMat);
    scene.add(particleSystem);

    // Line segments connecting particles
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.08,
    });

    const lineGeo = new THREE.BufferGeometry();
    const lineMesh = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(lineMesh);

    // 6. Interactive Mouse setup
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = (event) => {
      // Normalize mouse coordinates from -1 to 1
      mouseX = (event.clientX / window.innerWidth) * 2 - 1;
      mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // 7. Animation Loop
    let animationFrameId;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const delta = clock.getDelta();

      // Rotate globe group slowly
      globeGroup.rotation.y += 0.15 * delta;
      globeGroup.rotation.x += 0.05 * delta;

      // Update particle positions
      const posAttr = particlesGeo.attributes.position;
      const posArray = posAttr.array;

      for (let i = 0; i < particleCount; i++) {
        // Move particles
        posArray[i * 3] += velocities[i].x;
        posArray[i * 3 + 1] += velocities[i].y;
        posArray[i * 3 + 2] += velocities[i].z;

        // Bounce off walls
        const halfRange = range / 2;
        if (Math.abs(posArray[i * 3]) > halfRange) velocities[i].x *= -1;
        if (Math.abs(posArray[i * 3 + 1]) > halfRange) velocities[i].y *= -1;
        if (Math.abs(posArray[i * 3 + 2]) > halfRange) velocities[i].z *= -1;
      }
      posAttr.needsUpdate = true;

      // Generate lines between close particles
      const linePositions = [];
      const maxDistance = 6.0;

      for (let i = 0; i < particleCount; i++) {
        const x1 = posArray[i * 3];
        const y1 = posArray[i * 3 + 1];
        const z1 = posArray[i * 3 + 2];

        for (let j = i + 1; j < particleCount; j++) {
          const x2 = posArray[j * 3];
          const y2 = posArray[j * 3 + 1];
          const z2 = posArray[j * 3 + 2];

          const dist = Math.sqrt(
            (x1 - x2) ** 2 + (y1 - y2) ** 2 + (z1 - z2) ** 2
          );

          if (dist < maxDistance) {
            linePositions.push(x1, y1, z1);
            linePositions.push(x2, y2, z2);
          }
        }
      }

      lineGeo.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(linePositions, 3)
      );

      // Smooth camera parallax
      targetX = mouseX * 4;
      targetY = mouseY * 4;

      camera.position.x += (targetX - camera.position.x) * 0.05;
      camera.position.y += (targetY - camera.position.y) * 0.05;
      camera.lookAt(scene.position);

      renderer.render(scene, camera);
    };

    animate();

    // 8. Window Resize handler
    const handleResize = () => {
      if (!containerRef.current) return;
      const newWidth = containerRef.current.clientWidth;
      const newHeight = containerRef.current.clientHeight;

      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();

      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    // 9. Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      // Dispose resources
      sphereGeo.dispose();
      sphereMat.dispose();
      innerSphereGeo.dispose();
      innerSphereMat.dispose();
      particlesGeo.dispose();
      pointsMat.dispose();
      lineGeo.dispose();
      lineMat.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
    />
  );
};

export default ThreeHeroCanvas;
