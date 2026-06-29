// Agent positions in the 3D room

// Normal desk positions (sitting/working)
export const NORMAL_POSITIONS = {
  oscar:     { x: -1.0, z: -2.0 }, // Sheldon (Sofá - O "Seu Lugar" à esquerda)
  afrodite:  { x:  0.0, z: -2.0 }, // Penny (Sofá - Meio)
  leo:       { x:  1.0, z: -2.0 }, // Leonard (Sofá - Direita)
  thor:      { x: -2.5, z: -1.0 }, // Howard (Poltrona à esquerda)
  sabotagem: { x:  2.0, z: -0.5 }  // Raj (Puff no tapete à direita)
};

// Coffee break positions (around the coffee corner)
export const BREAK_POSITIONS = {
  oscar:     { x: -4.2, z: -4.2 },
  leo:       { x: -3.0, z: -4.5 },
  afrodite:  { x: -4.5, z: -3.0 },
  thor:      { x: -3.5, z: -3.0 },
  sabotagem: { x: -3.0, z: -3.8 }
};

// Which agents are sitting (vs standing) at normal positions
export const IS_SITTING_NORMAL = {
  oscar: true,
  leo: true,
  afrodite: true,
  thor: true,
  sabotagem: true,
};
