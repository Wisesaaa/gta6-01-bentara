// Every tuning number in one place. BENTARA is a bleached-concrete dry-season
// city at 4pm: pale sky, low warm sun, no palms, no sunset bay.
export const STEP = 1 / 60;
export const SAVE_KEY = 'bentara.save.v1';

// City: 5x5 blocks of 56 m, roads 18 m wide, 388 m across.
export const CITY = {
  blocks: 5,
  block: 56,
  road: 18,
  pitch: 74,
  half: 194,
};

export const SUN = { x: 70, y: 120, z: 40 };

export const PLAYER = {
  walkSpeed: 6.5,
  runSpeed: 10,
  height: 1.8,
  radius: 0.45,
  health: 100,
};

export const CAR = {
  length: 4.3,
  width: 1.9,
  accel: 22,
  brake: 34,
  reverse: 10,
  maxSpeed: 42,
  maxReverse: 12,
  steer: 1.9,
  grip: 6,
  health: 100,
};

export const HEAT = {
  max: 5,
  decaySeconds: 11,
  cruiserCap: 3,
  footCopFrom: 2,
  heliFrom: 4,
};

export const TRAFFIC_COUNT = 14;
export const PED_COUNT = 20;

export const WEAPONS = {
  pistol: { name: 'Pistol', damage: 34, rate: 0.22, range: 60, spread: 0.012, auto: false },
  shotgun: { name: 'Shotgun', damage: 22, pellets: 5, rate: 0.9, range: 26, spread: 0.09, auto: false, price: 120 },
};
export const SHOTGUN_SHELLS_PRICE = 40;

export const PALETTE = {
  sky: 0xc9dde3,
  haze: 0xcfdce2,
  ground: 0xe8e4da,
  road: 0x7a7e83,
  roadLine: 0xf5f2e8,
  sidewalk: 0xcfc9bd,
  building: [0xe8e4da, 0xd8cdb2, 0xc4b89a, 0xd0c4a8, 0xcfc0a0, 0xb8a98a],
  buildingTrim: [0x7a6a4f, 0x5f6b62, 0x8a7a5c, 0x6b5f4a],
  glass: 0x2f4a55,
  glassAlt: [0x4a5a63, 0x42586a, 0x5d6d75],
  water: 0x1f6b74,
  car: [0xc0392b, 0x2f6b8a, 0xe8e4da, 0x3a3a38, 0x7a2f2f, 0x2f6b4f, 0xd8a13a, 0x4a7a3a],
  cop: 0x1d2a3a,
  beacon: 0xffd75e,
  signRed: 0xc0392b,
  skyline: 0x8d9aa0,
  treeTrunk: 0x6b4a2f,
  treeCrown: [0xa08c46, 0xb09855, 0x8a7c40],
  awning: [0xc0392b, 0x1f6b74, 0xd8a13a],
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
