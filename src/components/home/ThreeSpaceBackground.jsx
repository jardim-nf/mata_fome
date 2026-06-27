// src/components/home/ThreeSpaceBackground.jsx
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const ThreeSpaceBackground = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 100;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      alpha: true,
      antialias: true,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // 2. Space Starfield (Nebula Stars)
    const starCount = 300;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 600;
      starPositions[i * 3 + 1] = (Math.random() - 0.5) * 600;
      starPositions[i * 3 + 2] = (Math.random() - 0.5) * 600;
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.8,
      transparent: true,
      opacity: 0.4,
    });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // 3. Floating Network Nodes
    const nodeCount = 60;
    const nodeGeo = new THREE.BufferGeometry();
    const nodePositions = new Float32Array(nodeCount * 3);
    const nodeVelocities = [];

    const bounds = 250;
    for (let i = 0; i < nodeCount; i++) {
      nodePositions[i * 3] = (Math.random() - 0.5) * bounds;
      nodePositions[i * 3 + 1] = (Math.random() - 0.5) * bounds;
      nodePositions[i * 3 + 2] = (Math.random() - 0.5) * bounds;

      nodeVelocities.push({
        x: (Math.random() - 0.5) * 0.08,
        y: (Math.random() - 0.5) * 0.08,
        z: (Math.random() - 0.5) * 0.08,
      });
    }

    nodeGeo.setAttribute('position', new THREE.BufferAttribute(nodePositions, 3));
    const nodeMat = new THREE.PointsMaterial({
      color: 0xf97316, // Orange neon
      size: 2.2,
      transparent: true,
      opacity: 0.65,
    });
    const nodeField = new THREE.Points(nodeGeo, nodeMat);
    scene.add(nodeField);

    // Connections
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xef4444, // Red-orange
      transparent: true,
      opacity: 0.06,
    });
    const lineGeo = new THREE.BufferGeometry();
    const connectionLines = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(connectionLines);

    // 4. Parallax state
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;
    let scrollY = 0;
    let targetScrollY = 0;

    const handleMouseMove = (event) => {
      mouseX = (event.clientX / window.innerWidth) * 2 - 1;
      mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    };

    const handleScroll = () => {
      scrollY = window.scrollY;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('scroll', handleScroll, { passive: true });

    // 5. Animation loop
    let animationFrameId;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      // Rotate starfield slowly
      starField.rotation.y += 0.015 * delta;

      // Update nodes positions
      const posAttr = nodeGeo.attributes.position;
      const posArray = posAttr.array;

      for (let i = 0; i < nodeCount; i++) {
        posArray[i * 3] += nodeVelocities[i].x;
        posArray[i * 3 + 1] += nodeVelocities[i].y;
        posArray[i * 3 + 2] += nodeVelocities[i].z;

        const halfBound = bounds / 2;
        if (Math.abs(posArray[i * 3]) > halfBound) nodeVelocities[i].x *= -1;
        if (Math.abs(posArray[i * 3 + 1]) > halfBound) nodeVelocities[i].y *= -1;
        if (Math.abs(posArray[i * 3 + 2]) > halfBound) nodeVelocities[i].z *= -1;
      }
      posAttr.needsUpdate = true;

      // Draw lines between close nodes
      const linePositions = [];
      const maxDistance = 45.0;

      for (let i = 0; i < nodeCount; i++) {
        const x1 = posArray[i * 3];
        const y1 = posArray[i * 3 + 1];
        const z1 = posArray[i * 3 + 2];

        for (let j = i + 1; j < nodeCount; j++) {
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

      // Smooth lerped parallax and scroll tracking
      targetX = mouseX * 25;
      targetY = mouseY * 25;
      targetScrollY = scrollY * 0.15; // Travel speed down

      camera.position.x += (targetX - camera.position.x) * 0.05;
      camera.position.y += (-targetY - camera.position.y) * 0.05;
      
      // Scroll Y moves camera Z and Y
      camera.position.z = 100 + targetScrollY * 0.2;
      camera.position.y += (-targetScrollY - camera.position.y) * 0.05;
      
      camera.lookAt(scene.position);

      renderer.render(scene, camera);
    };

    animate();

    // Resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);

      starGeo.dispose();
      starMat.dispose();
      nodeGeo.dispose();
      nodeMat.dispose();
      lineGeo.dispose();
      lineMat.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0 bg-[#02040a]"
    />
  );
};

export default ThreeSpaceBackground;
