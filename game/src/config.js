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

// Golden-hour sun: low from the west (high x), ~11° elevation, so the
// arterials throw long shadows east across the road and the facades catch
// a warm edge. Suplemen top-6–10: sun #ffb367, hemisphere #ffd2a1/#5a2a1a,
// fog Exp2 #e0925a 0.011, sky bottom #ff9a4e → #e0563a → top #40203e.
export const SUN = { x: 250, y: 52, z: 95 };
export const SUN_COLOR = 0xffb367;
export const SUN_INTENSITY = 3.4;
export const SKY_TOP = 0x40203e;
export const SKY_HORIZON = 0xff9a4e;
export const HAZE_COLOR = 0xe0925a;
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
  pistol: { name: 'Pistol', damage: 34, rate: 0.22, range: 60, spread: 0.012, auto: false, mag: Infinity },
  shotgun: { name: 'Shotgun', damage: 22, pellets: 5, rate: 0.9, range: 26, spread: 0.09, auto: false, price: 120, mag: 6, reloadSeconds: 0.9 },
  smg: { name: 'SMG', damage: 16, rate: 0.09, range: 45, spread: 0.03, auto: true, price: 450, mag: 30, reloadSeconds: 1.1 },
  rifle: { name: 'Senapan', damage: 55, rate: 0.7, range: 90, spread: 0.004, auto: false, price: 1200, mag: 10, reloadSeconds: 1.4 },
  launcher: { name: 'Pelontar', damage: 120, rate: 1.6, range: 70, spread: 0.02, auto: false, price: 2500, mag: 4, reloadSeconds: 1.8 },
};
export const SHOTGUN_SHELLS_PRICE = 40;
export const SMG_AMMO_PRICE = 60; // +30 peluru SMG
export const SMG_AMMO_PACK = 30;
export const SHOTGUN_SHELLS_PACK = 12;
export const RIFLE_AMMO_PRICE = 90; // +10 peluru senapan
export const RIFLE_AMMO_PACK = 10;
export const LAUNCHER_AMMO_PRICE = 150; // +4 peluru pelontar
export const LAUNCHER_AMMO_PACK = 4;

// Bengkel Roda Jaya: 5 mobil beli + CEMPAKA GT milik pemain sejak awal
// (hadiah Pak Wira) + 2 steal-unlock (curi mobil polisi PANTHERA, dan
// mobil geng KANCIL lewat misi curi mobil). topSpeed/grip adalah pengali
// terhadap handling dasar mobil.
export const GARAGE_CARS = [
  { id: 'murai', name: 'MURAI 110', kind: 'sedan', color: 0xd8a13a, price: 1200, topSpeed: 0.78, grip: 1.1, desc: 'Starter. Kecil, irit, lincah di gang.' },
  { id: 'gajah', name: 'GAJAH PUTIH', kind: 'truck', color: 0xe8e4da, price: 4500, topSpeed: 0.82, grip: 1.15, desc: 'Pickup bak terbuka. Berat, tapi tidak gampang oleng.' },
  { id: 'komodo', name: 'KOMODO GT', kind: 'sport', color: 0x2f6b4f, price: 14000, topSpeed: 1.12, grip: 0.9, desc: 'Muscle car. Kencang, liar, suka ngepot.' },
  { id: 'naga', name: 'NAGA R', kind: 'sport', color: 0x8a1f1f, price: 28000, topSpeed: 1.3, grip: 0.85, desc: 'Sport murni. Buat yang sudah tidak takut tilang.' },
  { id: 'sriwijaya', name: 'SRIWIJAYA LIMO', kind: 'sedan', color: 0x1d2a3a, price: 40000, topSpeed: 0.95, grip: 1.05, desc: 'Limo panjang. Datang pelan, semua orang menoleh.' },
  { id: 'cempaka', name: 'CEMPAKA GT', kind: 'sport', color: 0xb8442f, price: null, owned: true, topSpeed: 1.25, grip: 1.0, desc: 'Sport andalan. Hadiah Pak Wira — jangan dihancurkan.' },
  { id: 'panthera', name: 'PANTHERA', kind: 'sedan', color: 0x1d2a3a, price: null, steal: 'polisi', topSpeed: 1.15, grip: 1.0, desc: 'Cruiser polisi curian. Sirene ikut kebawa.' },
  { id: 'kancil', name: 'KANCIL', kind: 'sedan', color: 0x6b1f1f, price: null, steal: 'geng', topSpeed: 1.0, grip: 1.0, desc: 'Mobil geng curian. Platnya sudah tidak ada yang cari.' },
];

// Upgrade per mobil, 3 tingkat. MESIN naikkan top speed, BAN naikkan grip,
// TURBO isi meter boost (Shift saat mengemudi = NOS). Respray ganti warna +
// bersihkan bintang wanted (cat baru, polisi bingung). TURBO baru bisa
// dibeli di REP 2 (NITRO terbuka).
export const GARAGE_UPGRADES = {
  engine: { name: 'MESIN', prices: [300, 600, 1000], effect: '+8% top speed / tingkat' },
  grip: { name: 'BAN', prices: [200, 400, 700], effect: '+10% grip / tingkat' },
  turbo: { name: 'TURBO', prices: [500, 900, 1400], effect: '+boost, isi lebih cepat', needsRep: 2 },
};
export const RESPRAY_PRICE = 150;
export const BOOST = { drainPerSecond: 0.5, refillPerSecond: 0.12, accelBonus: 14 };
// Bensin: habis pelan saat mengemudi, isi penuh di safehouse / bengkel.
// Di bawah 15% top speed dibatasi setengah — tidak pernah mogok total.
export const FUEL = { drainPerSecond: 0.12, lowAt: 15, lowSpeedFactor: 0.5 };

// Usaha yang bisa dibeli: pasif $ per HARI game. Uang masuk ke pot,
// diambil dengan TIDUR di Safehouse Timur (hari +1, pot diklaim).
export const USAHA = [
  { id: 'warung', name: 'WARUNG SARI', loc: 'northRowStall', price: 2500, incomePerDay: 30, label: 'Warung Sari' },
  { id: 'kosong', name: 'KOSONG KAKI LIMA', loc: 'arterialJunction', price: 9500, incomePerDay: 80, label: 'Kosong Kaki Lima' },
  { id: 'slip', name: 'SLIP MARINA', loc: 'marina', price: 22000, incomePerDay: 180, label: 'Slip Marina' },
];

// KEMAJUAN: bobot misi 40, balapan 10, taksi 10, koleksi 15, usaha 15,
// upgrade 10. Rank dalam Bahasa — naik saat persen naik.
export const PROGRESS_WEIGHTS = { missions: 40, race: 10, taxi: 10, collectibles: 15, usaha: 15, upgrades: 10 };
export const RANKS = [
  { min: 0, title: 'KUTIL' },
  { min: 20, title: 'BOS KECIL' },
  { min: 40, title: 'RAJA JALANAN' },
  { min: 60, title: 'LEGENDA BENTARA' },
];
// Unlock REP: NITRO (TURBO) di REP 2, PELEPASAN (suap $250/bintang) di
// REP 3, diskon toko 20% di REP 4.
export const REP_UNLOCKS = [
  { rep: 2, label: 'NITRO' },
  { rep: 3, label: 'PELEPASAN $250/bintang' },
  { rep: 4, label: 'DISKON TOKO 20%' },
];
export const BRIBE_PER_STAR = 250;
export const SHOP_DISCOUNT_REP = 4;
export const SHOP_DISCOUNT = 0.2;

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
  glassLit: 0xffb96b,
  water: 0x1f6b74,
  car: [0xc0392b, 0x2f6b8a, 0xe8e4da, 0x3a3a38, 0x7a2f2f, 0x2f6b4f, 0xd8a13a, 0x4a7a3a],
  cop: 0x1d2a3a,
  copWhite: 0xe8e4da,
  beacon: 0xffd75e,
  signRed: 0xc0392b,
  skyline: 0x8d7a6a,
  treeTrunk: 0x6b4a2f,
  treeCrown: [0x8a6a2f, 0x9a7a35, 0x7a5c28], // browned dry-season crowns, never green palms
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
  dedi: { name: 'DEDI', role: 'PENJAGA PLAZA', initials: 'DD', skin: 0x8a5a3b, shirt: 0x6b4a2f, hat: 'cap', line: 'Plaza aman selama saya di sini. Mobil curian itu mulus — satu kerjaan terakhir.' },
  rini: { name: 'MBAK RINI', role: 'WARUNG KOPI', initials: 'MR', skin: 0xe0b184, shirt: 0x2f6b4f, hat: 'hair', line: 'Warung ini bisa jadi milikmu — dua ribu lima ratus, untung tiap hari.' },
  aska: { name: 'PAK ASKA', role: 'PENERIMA MARINA', initials: 'PA', skin: 0xc89b6d, shirt: 0x2f4a55, hat: 'peci', line: 'Barang sampai, uang jalan. Marina tidak pernah tidur.' },
};

export const DJ_LINES = [
  'Bang Ocid: panas begini, polisi juga malas ngejar — gas!',
  'Bang Ocid: lagu ini buat yang baru curi mobil. Jangan sebut nama.',
  'Bang Ocid: kemarau panjang, bensin mahal, tapi jalanan milik kita.',
  'Bang Ocid: buat pendengar di Marina — Wira kirim salam.',
  'Bang Ocid: kalau lihat helikopter, itu bukan pesawat lewat. Lari.',
];

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
