import * as THREE from 'three';

export function buildScenery(scene, hologramModelRef, standMat) {
    const tbbtGroup = new THREE.Group();
    scene.add(tbbtGroup);

    // 1. O Tapete Listrado (Vintage Rug)
    const rugGeo = new THREE.BoxGeometry(6, 0.02, 4);
    const rugMat = new THREE.MeshStandardMaterial({ color: 0x8b3a3a, roughness: 0.9, metalness: 0.1 }); // Vermelho escuro/vinho
    const rug = new THREE.Mesh(rugGeo, rugMat);
    rug.position.set(0, 0.01, -1.0);
    rug.receiveShadow = true;
    tbbtGroup.add(rug);

    // Detalhe do tapete (listras)
    const stripeGeo = new THREE.BoxGeometry(5.8, 0.03, 0.2);
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xd2b48c, roughness: 0.9 }); // Bege
    for (let i = -1.5; i <= 1.5; i += 0.5) {
        const stripe = new THREE.Mesh(stripeGeo, stripeMat);
        stripe.position.set(0, 0.015, -1.0 + i);
        tbbtGroup.add(stripe);
    }

    // 2. O Sofá Marrom do Sheldon (Couch)
    const couchGroup = new THREE.Group();
    couchGroup.position.set(0, 0, -2.2);
    tbbtGroup.add(couchGroup);

    const leatherMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.7, metalness: 0.1 }); // Marrom couro
    const cushionMat = new THREE.MeshStandardMaterial({ color: 0x4a2e1a, roughness: 0.8 }); 

    // Base do sofá
    const couchBase = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.3, 1.2), leatherMat);
    couchBase.position.y = 0.15;
    couchBase.castShadow = true;
    couchBase.receiveShadow = true;
    couchGroup.add(couchBase);

    // Encosto do sofá
    const couchBack = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.2, 0.4), leatherMat);
    couchBack.position.set(0, 0.6, -0.4);
    couchBack.castShadow = true;
    couchGroup.add(couchBack);

    // Braços do sofá
    const armGeo = new THREE.BoxGeometry(0.4, 0.8, 1.2);
    const armL = new THREE.Mesh(armGeo, leatherMat);
    armL.position.set(-1.8, 0.4, 0);
    armL.castShadow = true;
    couchGroup.add(armL);

    const armR = new THREE.Mesh(armGeo, leatherMat);
    armR.position.set(1.8, 0.4, 0);
    armR.castShadow = true;
    couchGroup.add(armR);

    // Almofadas do assento (3 lugares)
    for (let i = -1; i <= 1; i++) {
        const cushion = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.15, 0.8), cushionMat);
        cushion.position.set(i * 1.1, 0.375, 0.1);
        couchGroup.add(cushion);
    }

    // 3. A Poltrona do Howard (Armchair)
    const armchairGroup = new THREE.Group();
    armchairGroup.position.set(-2.5, 0, -1.2);
    armchairGroup.rotation.y = Math.PI / 4; // Virada para o centro
    tbbtGroup.add(armchairGroup);

    const fabricMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 }); // Tecido cinza/azulado escuro
    
    const armchairBase = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 1.2), fabricMat);
    armchairBase.position.y = 0.15;
    armchairBase.castShadow = true;
    armchairGroup.add(armchairBase);

    const armchairBack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 0.3), fabricMat);
    armchairBack.position.set(0, 0.6, -0.45);
    armchairBack.castShadow = true;
    armchairGroup.add(armchairBack);

    const armL2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 1.2), fabricMat);
    armL2.position.set(-0.6, 0.35, 0);
    armchairGroup.add(armL2);

    const armR2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 1.2), fabricMat);
    armR2.position.set(0.6, 0.35, 0);
    armchairGroup.add(armR2);

    const armchairCushion = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.15, 0.9), cushionMat);
    armchairCushion.position.set(0, 0.375, 0);
    armchairGroup.add(armchairCushion);

    // 4. O Puff do Raj
    const pouf = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.4, 16), new THREE.MeshStandardMaterial({ color: 0x9d2449, roughness: 0.9 }));
    pouf.position.set(2.0, 0.2, -0.7);
    pouf.castShadow = true;
    tbbtGroup.add(pouf);

    // 5. O Quadro Branco do Sheldon (Whiteboard)
    const boardGroup = new THREE.Group();
    boardGroup.position.set(0, 0, -4.5);
    tbbtGroup.add(boardGroup);

    const boardFrameGeo = new THREE.BoxGeometry(4.2, 2.2, 0.1);
    const boardFrameMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8 });
    const boardFrame = new THREE.Mesh(boardFrameGeo, boardFrameMat);
    boardFrame.position.y = 1.5;
    boardGroup.add(boardFrame);

    const boardSurfaceGeo = new THREE.BoxGeometry(4.0, 2.0, 0.12);
    const boardSurfaceMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
    const boardSurface = new THREE.Mesh(boardSurfaceGeo, boardSurfaceMat);
    boardSurface.position.y = 1.5;
    boardGroup.add(boardSurface);

    // "Equações" no quadro (Pequenos blocos pretos simulando escrita)
    const markerMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    for(let i = 0; i < 15; i++) {
        const scribble = new THREE.Mesh(new THREE.BoxGeometry(0.2 + Math.random() * 0.3, 0.02, 0.13), markerMat);
        scribble.position.set(-1.5 + Math.random() * 3.0, 0.8 + Math.random() * 1.2, 0);
        boardGroup.add(scribble);
    }
    const redMarkerMat = new THREE.MeshBasicMaterial({ color: 0xdc2626 });
    for(let i = 0; i < 5; i++) {
        const scribble = new THREE.Mesh(new THREE.BoxGeometry(0.1 + Math.random() * 0.2, 0.02, 0.13), redMarkerMat);
        scribble.position.set(-1.5 + Math.random() * 3.0, 0.8 + Math.random() * 1.2, 0);
        boardGroup.add(scribble);
    }

    // 6. Mesa de Centro de Madeira (Coffee Table) e Comida Chinesa
    const coffeeTableGroup = new THREE.Group();
    coffeeTableGroup.position.set(0, 0, 0);
    tbbtGroup.add(coffeeTableGroup);

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 });
    const tableTop = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.05, 1.2), woodMat);
    tableTop.position.y = 0.4;
    tableTop.castShadow = true;
    coffeeTableGroup.add(tableTop);

    for (let lx = -1; lx <= 1; lx += 2) {
        for (let lz = -1; lz <= 1; lz += 2) {
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.08), woodMat);
            leg.position.set(lx * 0.9, 0.2, lz * 0.5);
            coffeeTableGroup.add(leg);
        }
    }

    // Caixinhas de comida chinesa (takeout boxes)
    const boxGeo = new THREE.BoxGeometry(0.12, 0.15, 0.12);
    const boxMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const redStripeMat = new THREE.MeshBasicMaterial({ color: 0xdc2626 });
    
    for (let i = 0; i < 4; i++) {
        const boxGroup = new THREE.Group();
        boxGroup.position.set(-0.5 + Math.random() * 1.0, 0.5, -0.3 + Math.random() * 0.6);
        boxGroup.rotation.y = Math.random() * Math.PI;
        
        const box = new THREE.Mesh(boxGeo, boxMat);
        boxGroup.add(box);

        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.121, 0.02, 0.121), redStripeMat);
        boxGroup.add(stripe);

        coffeeTableGroup.add(boxGroup);
    }

    // Central Hologram Volumetric Beam & Geodesic Core (Mantido)
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

    return { coffeeTableGroup, hologram };
}
