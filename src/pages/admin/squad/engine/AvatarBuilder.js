import * as THREE from 'three';

export function buildAvatar(agentId, AGENTS) {
      // HABBO-STYLE BLOCKY CHARACTER (Pixel Art 3D)
      // ───────────────────────────────────────────────────────────
      const robotBody = new THREE.Group();
      robotBody.position.set(0, 0, -0.05);
      robotBody.scale.set(1.4, 1.4, 1.4);

      // Skin tones per agent
      // Skin tones per agent
      let skinColor = 0xffe0bd;
      if (agentId === 'oscar') skinColor = 0xffe0bd; // Sheldon
      if (agentId === 'leo') skinColor = 0xffe0bd; // Leonard
      if (agentId === 'afrodite') skinColor = 0xfddcb9; // Penny
      if (agentId === 'thor') skinColor = 0xffe0bd; // Howard
      if (agentId === 'sabotagem') skinColor = 0x8d5524; // Raj

      const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.9, metalness: 0.0 });
      let shirtColor = AGENTS[agentId].color;
      if (agentId === 'oscar') shirtColor = 0xef4444; // Sheldon: Red Flash shirt
      if (agentId === 'leo') shirtColor = 0x556b2f; // Leonard: Olive Green jacket
      if (agentId === 'afrodite') shirtColor = 0xff69b4; // Penny: Hot pink sweater
      if (agentId === 'thor') shirtColor = 0x800080; // Howard: Purple shirt
      if (agentId === 'sabotagem') shirtColor = 0x8b4513; // Raj: Brown sweater vest
      const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.95, metalness: 0.0 });

      let armUpperMat = shirtMat;
      let armForeMat = skinMat;

      if (agentId === 'oscar') {
        const undershirtMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.95 }); // yellow undershirt
        armUpperMat = shirtMat; 
        armForeMat = undershirtMat; // long yellow sleeves
      } else if (agentId === 'leo') {
        armUpperMat = shirtMat; // olive jacket
        armForeMat = shirtMat;
      } else if (agentId === 'afrodite') {
        armUpperMat = shirtMat; 
        armForeMat = skinMat; // short sleeves
      } else if (agentId === 'thor') {
        const turtleneckMat = new THREE.MeshStandardMaterial({ color: 0x111827 });
        armUpperMat = shirtMat; 
        armForeMat = turtleneckMat; // black turtleneck underneath
      } else if (agentId === 'sabotagem') {
        const undershirtMat = new THREE.MeshStandardMaterial({ color: 0x800080 }); // purple shirt under vest
        armUpperMat = undershirtMat; 
        armForeMat = undershirtMat; 
      }

      let pantsColor = 0x1d4ed8;
      if (agentId === 'oscar') pantsColor = 0x5c4033; // Brown pants
      if (agentId === 'leo') pantsColor = 0x1d4ed8; // Blue jeans
      if (agentId === 'afrodite') pantsColor = 0x4f46e5; // Indigo yoga pants/jeans
      if (agentId === 'thor') pantsColor = 0x800000; // Maroon tight pants
      if (agentId === 'sabotagem') pantsColor = 0x556b2f; // Cargo pants
      const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.95, metalness: 0.0 });
      const shoesMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });

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

      if (agentId === 'oscar') {
        // Sheldon's Flash logo
        const logoGroup = new THREE.Group();
        logoGroup.position.set(0, 0.09, 0.051); 
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
        flash1.rotation.z = -0.3;
        logoGroup.add(flash1);

        const flash2 = new THREE.Mesh(
          new THREE.BoxGeometry(0.01, 0.03, 0.004),
          new THREE.MeshBasicMaterial({ color: 0xfacc15 })
        );
        flash2.position.set(-0.015, 0.01, 0);
        flash2.rotation.z = 0.5;
        logoGroup.add(flash2);
      }

      if (agentId === 'leo') {
        // Leonard's hoodie under jacket (grey hood showing on back)
        const hood = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.12, 0.04),
          new THREE.MeshStandardMaterial({ color: 0x6b7280 })
        );
        hood.position.set(0, 0.1, -0.06); 
        robotBody.add(hood);
      }

      if (agentId === 'thor') {
        // Howard's Giant Belt Buckle (Alien head or something shiny)
        const buckle = new THREE.Mesh(
          new THREE.BoxGeometry(0.06, 0.04, 0.01),
          new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 1.0, roughness: 0.1 })
        );
        buckle.position.set(0, 0.01, 0.051); 
        robotBody.add(buckle);
        
        // Turtleneck collar
        const tNeck = new THREE.Mesh(
          new THREE.BoxGeometry(0.06, 0.04, 0.06),
          new THREE.MeshStandardMaterial({ color: 0x111827 })
        );
        tNeck.position.set(0, 0.2, 0);
        robotBody.add(tNeck);
      }

      if (agentId === 'sabotagem') {
        // Raj's sweater vest V-neck pattern (purple triangle over chest)
        const vNeck = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.08, 0.005),
          new THREE.MeshStandardMaterial({ color: 0x800080 })
        );
        vNeck.position.set(0, 0.14, 0.051);
        vNeck.rotation.z = Math.PI / 4;
        robotBody.add(vNeck);
      }

      // Collar stripe (except for Howard's turtleneck)
      if (agentId !== 'thor') {
        const collar = new THREE.Mesh(
          new THREE.BoxGeometry(chestW + 0.01, 0.02, chestD + 0.005),
          shirtMat
        );
        collar.position.y = 0.19;
        robotBody.add(collar);
      }

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

      // Accessory in hand (Wine for Penny, Coffee for Leonard, Takeout for Raj)
      const prop = new THREE.Mesh(
        new THREE.BoxGeometry(0.025, 0.03, 0.025),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 })
      );
      prop.position.set(0, -0.01, 0.015);
      
      if (agentId === 'afrodite') { // Penny's Wine Glass
        prop.geometry = new THREE.CylinderGeometry(0.015, 0.005, 0.04);
        prop.material.color.setHex(0x722f37); 
      } else if (agentId === 'leo') { // Leonard's Coffee
        prop.material.color.setHex(0xd2b48c);
      } else if (agentId === 'sabotagem') { // Raj's Takeout box
        prop.geometry = new THREE.CylinderGeometry(0.02, 0.015, 0.04, 4);
      } else {
        prop.scale.set(0, 0, 0); // Hide for others
      }
      handR.add(prop);
      extraRefs.coffeeCup = prop; // Keeps compatibility with animation loop

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
      // HAIR & ACCESSORIES (The Big Bang Theory cast)
      // ───────────────────────────────────────────────────────────
      if (agentId === 'oscar') {
        // Sheldon: Neat short brown hair
        const hairMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.95 }); 
        
        const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.14), hairMat);
        hairTop.position.set(0, 0.08, -0.005);
        head.add(hairTop);

        const hairSideL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.13), hairMat);
        hairSideL.position.set(-0.085, 0.04, -0.005);
        head.add(hairSideL);

        const hairSideR = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.13), hairMat);
        hairSideR.position.set(0.085, 0.04, -0.005);
        head.add(hairSideR);

        const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.02), hairMat);
        hairBack.position.set(0, 0.03, -0.075);
        head.add(hairBack);

      } else if (agentId === 'leo') {
        // Leonard: Messy brown hair + Thick black glasses
        const hairMat = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.95 });
        const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.14), hairMat);
        hairTop.position.set(0, 0.085, -0.005);
        head.add(hairTop);
        const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.02), hairMat);
        hairBack.position.set(0, 0.03, -0.075);
        head.add(hairBack);

        // Pixel glasses (thick frame)
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5 });
        const lensL = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.03, 0.005), frameMat);
        lensL.position.set(-0.035, 0.01, 0.068);
        head.add(lensL);
        const lensR = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.03, 0.005), frameMat);
        lensR.position.set(0.035, 0.01, 0.068);
        head.add(lensR);
        const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.005, 0.005), frameMat);
        bridge.position.set(0, 0.01, 0.068);
        head.add(bridge);

      } else if (agentId === 'afrodite') {
        // Penny: Blonde hair, shoulder length
        const hairMat = new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.9 });
        
        const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.04, 0.15), hairMat);
        hairTop.position.set(0, 0.09, -0.005);
        head.add(hairTop);

        const hairL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.15, 0.10), hairMat);
        hairL.position.set(-0.085, 0, -0.03);
        head.add(hairL);

        const hairR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.15, 0.10), hairMat);
        hairR.position.set(0.085, 0, -0.03);
        head.add(hairR);

        const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.15, 0.04), hairMat);
        hairBack.position.set(0, 0, -0.07);
        head.add(hairBack);

      } else if (agentId === 'thor') {
        // Howard: Beatles bowl cut hair
        const hairMat = new THREE.MeshStandardMaterial({ color: 0x27170a, roughness: 0.95 });
        
        const bowl = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.06, 0.15), hairMat);
        bowl.position.set(0, 0.08, -0.005);
        head.add(bowl);
        
        const bangs = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.04, 0.02), hairMat);
        bangs.position.set(0, 0.05, 0.07);
        head.add(bangs);
        
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.06, 0.04), hairMat);
        back.position.set(0, 0.04, -0.07);
        head.add(back);

      } else {
        // Raj: Dark curly hair, slightly messy on top
        const hairMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.95 });
        
        const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.14), hairMat);
        hairTop.position.set(0, 0.09, -0.005);
        head.add(hairTop);
        
        const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.02), hairMat);
        hairBack.position.set(0, 0.04, -0.075);
        head.add(hairBack);
      }
  return { 
    robotBody, 
    head,
    extraRefs
  };
}
