// Agent positions in the 3D room

// Normal desk positions (sitting/working)
export const NORMAL_POSITIONS = {
  oscar:     { x: -3.0, z: -3.0 },
  leo:       { x: 3.0,  z: -2.6 },
  afrodite:  { x: -3.0, z: 3.0 },
  thor:      { x: 0.0,  z: -4.0 },
  sabotagem: { x: 3.0,  z: 3.0 }
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
  oscar: false,
  leo: true,
  afrodite: true,
  thor: false,
  sabotagem: true,
};
