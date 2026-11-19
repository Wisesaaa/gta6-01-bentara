// Every tuning number in one place. BENTARA is a golden-hour dry-season
// city at 4pm: low warm sun, dusty orange haze, saturated bleached concrete
// — kemarau, not a sunset bay. The palette stays inside that identity:
// warm amber, brick red, deep teal, dusty olive. No palms, no neon coast.
export const STEP = 1 / 60;
export const SAVE_KEY = 'bentara.save.v2';

// City: 5x5 blocks of 56 m, roads 18 m wide, 388 m across.
export const CITY = {
  blocks: 5,
  block: 56,
  road: 18,
  pitch: 74,
  half: 194,
};

// Golden-hour sun: low from the west (high x), so the arterials throw long
// shadows east across the road and the facades catch a warm edge.
export const SUN = { x: 230, y: 46, z: 95 };
export const SUN_COLOR = 0xffb066;
export const SUN_INTENSITY = 3.4;
export const SKY_TOP = 0x5f97c4;
export const SKY_HORIZON = 0xff8a3d;
export const HAZE_COLOR = 0xdd8f4e;
export const HAZE_NEAR = 190;
export const HAZE_FAR = 470;

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
  smokeBelow: 40,
};

export const HEAT = {
  max: 5,
  decaySeconds: 11,
  cruiserCap: 3,
  footCopFrom: 2,
  heliFrom: 4,
};

// A lived-in city: 22 cars and 32 people on the grid at once, so the
// screenshots show traffic, crowds and police instead of empty roads.
export const TRAFFIC_COUNT = 22;
export const PED_COUNT = 32;

// Traffic kinds and their share of the fleet. Angkot, bajaj and ojek are the
// vehicles that make the city read as Indonesian at a glance.
export const TRAFFIC_KINDS = [
  { kind: 'sedan', weight: 0.34 },
  { kind: 'angkot', weight: 0.22 },
  { kind: 'bajaj', weight: 0.16 },
  { kind: 'ojek', weight: 0.14 },
  { kind: 'truck', weight: 0.14 },
];

export const WEAPONS = {
  // magSize = peluru per magasin; reserve = stok di kantong (Q = isi ulang).
  // Pistol tidak pernah habis; shotgun/SMG/bedil/pelontar memakai reserve.
  pistol: { name: 'Pistol', damage: 34, rate: 0.22, range: 60, spread: 0.012, auto: false, magSize: Infinity },
  shotgun: { name: 'Shotgun', damage: 22, pellets: 5, rate: 0.9, range: 26, spread: 0.09, auto: false, price: 120, magSize: 6, reserveField: 'shells' },
  smg: { name: 'SMG', damage: 16, rate: 0.09, range: 45, spread: 0.03, auto: true, price: 450, magSize: 30, reserveField: 'smgAmmo' },
  bedil: { name: 'Bedil', damage: 40, rate: 0.7, range: 80, spread: 0.006, auto: false, price: 900, magSize: 5, reserveField: 'bedilAmmo', repNeeded: 3 },
  pelontar: { name: 'Pelontar', damage: 90, pellets: 1, rate: 1.4, range: 40, spread: 0.02, auto: false, price: 1800, magSize: 1, reserveField: 'pelontarAmmo', repNeeded: 4 },
};
// Lima slot senjata di rail: pistol, shotgun, smg, bedil, pelontar.
export const WEAPON_SLOTS = ['pistol', 'shotgun', 'smg', 'bedil', 'pelontar'];
export const SHOTGUN_SHELLS_PRICE = 40;

// Collectibles: 24 idols and tapes scattered on the sidewalks. An idol pays
// more; a tape pays less but carries a radio-track name.
export const COLLECTIBLES = {
  count: 24,
  idolValue: 60,
  tapeValue: 25,
  repPer: 5,
  pickupRadius: 2.6,
};

// Taxi fares: pick up a waiting passenger, drive them to their destination,
// get paid by distance. The fare meter ticks while they ride.
export const TAXI = {
  baseFare: 30,
  perMetre: 0.35,
  maxWait: 90,
  pickupRadius: 4,
  dropoffRadius: 8,
};

// Checkpoint race: 5 gates around the grid, start at Plaza Menara.
export const RACE = {
  gates: 5,
  reward: 500,
  repReward: 120,
  parSeconds: 75,
};

// Stunt payouts feed straight into cash.
export const STUNTS = {
  driftPerSecond: 60,
  driftMinSeconds: 0.6, // Short slides pay too: a 0.6 s wiggle is a drift.
  nearMiss: 250,
  nearMissMinSpeed: 15,
  nearMissMaxGap: 2.4,
};

export const PALETTE = {
  sky: 0xf08a3c,
  haze: 0xdd8f4e,
  ground: 0xd0b184,
  road: 0x6e6a63,
  roadLine: 0xf5eeda,
  sidewalk: 0xbd9c72,
  // v2.1: warmer, more saturated facades — the old tans washed to pale
  // cream at distance. Ochre, terracotta and brick, still kemarau.
  building: [0xe3c78d, 0xcf9a55, 0xb87a48, 0xc98f5f, 0xbd7a4a, 0xa86a42],
  buildingTrim: [0x7a5a3f, 0x5f6b62, 0x8a6a4c, 0x6b4f3a],
  glass: 0x2f4a55,
  glassAlt: [0x4a5a63, 0x42586a, 0x5d6d75],
  glassLit: 0xffc46b,
  water: 0x1f6b74,
  car: [0xc0392b, 0x2f6b8a, 0xe8e4da, 0x3a3a38, 0x7a2f2f, 0x2f6b4f, 0xd8a13a, 0x4a7a3a],
  cop: 0x1d2a3a,
  copWhite: 0xe8e4da,
  beacon: 0xffd75e,
  signRed: 0xc0392b,
  skyline: 0x8d7a6a,
  treeTrunk: 0x6b4a2f,
  treeCrown: [0xa08c46, 0xb09855, 0x8a7c40],
  awning: [0xc0392b, 0x1f6b74, 0xd8a13a],
  muralRed: 0xa83226,
  muralGold: 0xffd75e,
  muralTeal: 0x1f6b74,
};

// The people of Bentara. Portraits are drawn procedurally (dialogue.js);
// initials + colours are the fallback the HUD used to show alone.
export const CHARACTERS = {
  wira: { name: 'PAK WIRA', role: 'BOS MARINA', initials: 'PW', skin: 0xc89b6d, shirt: 0x7a5c2e, hat: 'peci', line: 'Selamat datang di Bentara. Musim kemarau ini, kota ini milik yang berani.' },
  sari: { name: 'SARI', role: 'PENERIMA BARANG', initials: 'SR', skin: 0xe0b184, shirt: 0x8a4a6b, hat: 'hair', line: 'Barang sampai, uang jalan. Jangan bawa polisi ke ruko saya.' },
  ijal: { name: 'BANG IJAL', role: 'BENGKEL LAS', initials: 'BI', skin: 0x8a5a3b, shirt: 0x4a6b8a, hat: 'cap', line: 'Mesin bunyi begitu, remuk dikit. Bawa ke bengkel, saya yang urus.' },
  rahmat: { name: 'LETKOL RAHMAT', role: 'KAPOLRES BENTARA', initials: 'LR', skin: 0xc89b6d, shirt: 0x1d2a3a, hat: 'police', line: 'Menyerah sekarang, atau saya yang jemput kamu dari sel.' },
  ocid: { name: 'BANG OCID', role: 'RADIO KEMARAU 92.4', initials: 'BO', skin: 0x6b4423, shirt: 0xd8a13a, hat: 'cap', line: 'Ini Radio Kemarau — lagu buat yang kabur dari polisi.' },
  aska: { name: 'PAK ASKA', role: 'PENERIMA MARINA', initials: 'PA', skin: 0xb08a5e, shirt: 0x1f6b74, hat: 'peci', line: 'Barang sampai, uang jalan. Marina tidak pernah tidur.' },
};

export const DJ_LINES = [
  'Bang Ocid: panas begini, polisi juga malas ngejar — gas!',
  'Bang Ocid: lagu ini buat yang baru curi mobil. Jangan sebut nama.',
  'Bang Ocid: kemarau panjang, bensin mahal, tapi jalanan milik kita.',
  'Bang Ocid: buat pendengar di Marina — Wira kirim salam.',
  'Bang Ocid: kalau lihat helikopter, itu bukan pesawat lewat. Lari.',
];

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
