import * as THREE from 'three';
import { NORMAL_POSITIONS, BREAK_POSITIONS } from '../constants/positions';

export function createAnimationLoop(deps) {
  const { 
    camera, scene, renderer,
    hologramModelRef, speakerLightTarget, speakerLight, accentLight, spotlight,
    avatarObjects, stateRef, AGENTS, isSittingNormal,
    viewportRef, bubblesRefs, hudRefs, hologram, speechTextRef
  } = deps;
  
  let reqId;
  let zoomVal = 4.5;
  let cameraAngleY = -0.8;
  let cameraAngleX = 0;
  let targetAngle = -0.6;
  const currentLookAt = new THREE.Vector3();
  const tempV = new THREE.Vector3();
  const agentsArray = Object.keys(AGENTS);

    const animate = () => {
      reqId = requestAnimationFrame(animate);

      if (hologram) {
        hologram.rotation.y += 0.006;
        const pulse = 1.0 + Math.sin(Date.now() * 0.004) * 0.04;
        hologram.scale.set(pulse, 1, pulse);
      }
      
      const hologramModelGroup = hologramModelRef.current;
      if (hologramModelGroup) {
        hologramModelGroup.rotation.y += 0.012;
        const s1 = hologramModelGroup.getObjectByName("satGroup1");
        if (s1) s1.rotation.y += 0.025;
        const s2 = hologramModelGroup.getObjectByName("satGroup2");
        if (s2) s2.rotation.y -= 0.018;
      }


      let targetHoloColor = 0xffa500; // Orange (Warm for fire)
      let targetSpotColor = 0xffffff;
      let targetBgColor = 0x0f172a; // Slate 900 (Brighter than black)
      let targetAmbient = 1.0; // Brighter ambient light
      let targetHemi = 1.0;
      accentLight.color.setHex(0xffa500);
      accentLight.intensity = 1.0;

      scene.fog.density = 0.012; 
      scene.fog.color.setHex(targetBgColor);
      scene.background = new THREE.Color(targetBgColor);
      
      const activeHoloColor = stateRef.current.hologramColor || targetHoloColor;
      if (accentLight) {
        accentLight.color.setHex(activeHoloColor);
      }
      if (spotlight) {
        spotlight.color.setHex(targetSpotColor);
      }
      renderer.setClearColor(targetBgColor);


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
        const bubbleEl = bubblesRefs && bubblesRefs[id]?.current;
        const hudEl = hudRefs && hudRefs[id]?.current;

        if (bubbleEl || hudEl) {
          const av = avatarObjects[id];
          av.group.getWorldPosition(tempV);
          tempV.y += 0.55; // Posicionamento do HUD/Bubble acima da cabeça
          
          tempV.project(camera);

          if (tempV.z > 1.0) {
            if (bubbleEl) bubbleEl.style.display = 'none';
            if (hudEl) hudEl.style.display = 'none';
          } else {
            const x = (tempV.x * 0.5 + 0.5) * viewportRef.current.clientWidth;
            const y = (-(tempV.y * 0.5) + 0.5) * viewportRef.current.clientHeight;
            
            // HUD Update (Sempre visível)
            if (hudEl) {
              hudEl.style.display = 'block';
              hudEl.style.transform = `translate(-50%, -100%) translate(${x}px, ${y - 45}px)`;
            }

            // Bubble Update (Apenas quando falando)
            if (bubbleEl) {
              if (id === active && speechTextRef && speechTextRef.current) {
                bubbleEl.style.display = 'block';
                bubbleEl.style.transform = `translate(-50%, -100%) translate(${x}px, ${y}px)`;
              } else {
                bubbleEl.style.display = 'none';
              }
            }
          }
        }
      });

      renderer.render(scene, camera);
    };

  return { animate, stop: () => cancelAnimationFrame(reqId) };
}
