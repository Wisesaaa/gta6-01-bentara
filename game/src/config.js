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
  sky: 0xdfe8ea,
  haze: 0xe8e2cf,
  ground: 0xc9bfa4,
  road: 0x8f8a80,
  roadLine: 0xe8e2cf,
  sidewalk: 0xb5ab90,
  building: [0xd8cdb2, 0xc4b89a, 0xbfae8e, 0xd0c4a8, 0xcfc0a0, 0xb8a98a],
  buildingTrim: [0x7a6a4f, 0x5f6b62, 0x8a7a5c, 0x6b5f4a],
  glass: 0x9fb4b8,
  water: 0x5e8f96,
  car: [0xb8442f, 0x3f5a78, 0xd8cdb2, 0x4a4a42, 0x7a2f2f, 0x2f6b4f],
  cop: 0x1d2a3a,
  beacon: 0xffd75e,
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
