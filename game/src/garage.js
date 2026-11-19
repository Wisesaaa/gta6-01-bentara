// Garasi Bentara — beli mobil, upgrade, respray, parkir di forecourt Safehouse Timur.
//
// API (ES module, gaya sama seperti sistem lain di src/):
//   import { Garage, repDiscount, GARAGE_CATALOG } from './garage.js';
//   const garage = new Garage({ state, scene: view.scene, rng, parked, hud, audio, player });
//   garage.wire(game); // menempelkan game.garage = garage (dipanggil dari game.js)
//
// Aturan harga:
// - Diskon REP: level 4 LEGENDA BENTARA (rep >= 2500, ladder [0, 250, 1000, 2500])
//   = 20% untuk SEMUA pembelian di garasi (mobil, upgrade, respray). Helper
//   repDiscount(rep) mengembalikan 0.8 kalau rep >= 2500, else 1. Tidak ada
//   aturan diskon di base v2.1 (hud.js masih pakai ladder lama) — ladder baru
//   diimplementasikan koordinator di progress; file ini mengikuti ladder baru.
// - Upgrade (per level, harga level berikutnya): MESIN $800/$1.600/$3.200,
//   BAN $500/$1.000/$2.000, TURBO $1.200/$2.400/$4.800. Efeknya dipakai
//   Car.drive() (koordinator): MESIN +12% top speed/level, BAN grip,
//   TURBO boost saat Shift ditekan + drain meter boost.
// - Respray $150: ganti warna + bersihkan heat (state.heat = 0).
//
// Parkir: mobil owned diparkir di forecourt Safehouse Timur — 7 slot di bahu
// jalan timur (x = 176, z = -76..-28, menghadap timur), dihitung dari
// loc('eastSafehouse') (150, -60) di city.js. Base tidak mendefinisikan slot
// parkir safehouse, jadi slot ini didefinisikan di sini.
// Mobil awal pemain (CEMPAKA GT) TIDAK masuk katalog — tetap milik pemain
// dari base dan parkir di Marina seperti semula.
//
// Save: serialize()/restore(data) mengikuti pola save.js (plain object).
// Bump schema TIDAK dilakukan di sini — koordinator yang tangani di save.js.
import { Car } from './actors/car.js';
import { loc } from './city.js';

// ---------------------------------------------------------------------------
// Diskon REP (dipakai juga oleh usaha.js — single source of truth di sini)
// ---------------------------------------------------------------------------
export const REP_DISCOUNT_THRESHOLD = 2500; // LEGENDA BENTARA, level 4
export const REP_DISCOUNT_FACTOR = 0.8; // 20%

// Multiplier harga dari REP: 0.8 kalau rep >= 2500, else 1.
export function repDiscount(rep) {
  return (rep ?? 0) >= REP_DISCOUNT_THRESHOLD ? REP_DISCOUNT_FACTOR : 1;
}

// Harga setelah diskon REP (dibulatkan ke dolar).
export function discountedPrice(price, rep) {
  return Math.round(price * repDiscount(rep));
}

// ---------------------------------------------------------------------------
// Katalog
// ---------------------------------------------------------------------------
export const GARAGE_CATALOG = [
  { id: 'murai', name: 'MURAI 110', price: 1200, kind: 'sedan', color: 0xd8a13a, desc: 'Mobil kota lincah — murah, irit, gampang selip di gang sempit.' },
  { id: 'gajah', name: 'GAJAH PUTIH', price: 4500, kind: 'truck', color: 0xe8e4da, desc: 'Pickup bak terbuka — kuat nabrak, muat banyak, pelan tapi pasti.' },
  { id: 'komodo', name: 'KOMODO GT', price: 14000, kind: 'sport', color: 0xc0392b, desc: 'Sport dua pintu — galak di arteri, spoiler tegak, suara garang.' },
  { id: 'naga', name: 'NAGA R', price: 28000, kind: 'sport', color: 0x1d2a3a, desc: 'Sport kelas atas — top speed tinggi, handling tajam, mata semua orang.' },
  { id: 'sriwijaya', name: 'SRIWIJAYA LIMO', price: 40000, kind: 'sedan', color: 0x2f6b8a, desc: 'Limo panjang berkelas — mobilnya bos besar, pelan tapi berwibawa.' },
];

// Mobil yang hanya bisa didapat dengan mencuri (bukan dibeli). unlockSteal()
// dipanggil koordinator saat pemain berhasil mencuri mobilnya di dunia.
export const STEAL_CATALOG = [
  { id: 'panthera', name: 'PANTHERA', kind: 'sedan', isCop: true, color: 0x1d2a3a, desc: 'Mobil patroli polisi — curi dari cruiser, bawa pulang, jadi milikmu.' },
  { id: 'preman', name: 'PREMAN', kind: 'sedan', isCop: false, color: 0x3a3a38, desc: 'Mobil geng jalanan — gelap, tanpa plat resmi, didapat dengan cara kasar.' },
];

export const UPGRADE_PRICES = {
  mesin: [800, 1600, 3200],
  ban: [500, 1000, 2000],
  turbo: [1200, 2400, 4800],
};
export const UPGRADE_NAMES = { mesin: 'MESIN', ban: 'BAN', turbo: 'TURBO' };
// Field Car yang ditulis tiap upgrade (koordinator menambahkan field ini di car.js).
export const UPGRADE_FIELDS = { mesin: 'engineLevel', ban: 'tireLevel', turbo: 'turboLevel' };
export const MAX_UPGRADE_LEVEL = 3;

export const RESPRAY_PRICE = 150;

export const RESPRAY_COLORS = [
  { name: 'Merah Bara', hex: 0xc0392b },
  { name: 'Biru Marina', hex: 0x2f6b8a },
  { name: 'Putih Gading', hex: 0xe8e4da },
  { name: 'Hitam Arang', hex: 0x3a3a38 },
  { name: 'Kuning Senja', hex: 0xd8a13a },
  { name: 'Hijau Hutan', hex: 0x2f6b4f },
];

// Slot parkir forecourt Safehouse Timur: bahu jalan timur (x = 176, jalan di
// x = 185), berderet dari z = -76 sampai -28, menghadap timur (heading PI/2)
// supaya langsung jalan tanpa putar balik. 7 slot = 5 beli + 2 curi.
function forecourtSlots() {
  let base = { x: 150, z: -60 };
  try { const L = loc('eastSafehouse'); base = { x: L.x, z: L.z }; } catch { /* pakai fallback di atas */ }
  const slots = [];
  for (let i = 0; i < 7; i += 1) {
    slots.push({ x: base.x + 26, z: base.z - 16 + i * 8, heading: Math.PI / 2 });
  }
  return slots;
}
export const FORECOURT_SLOTS = forecourtSlots();

const PLATE_LETTERS = 'ABCDEFGHJKLMNPRSTUVWXYZ';

export class Garage {
  // deps: { state, scene, rng, parked, hud, audio, player } — semuanya
  // diambil dari local game.js; boleh juga menerima objek game utuh.
  constructor(deps = {}) {
    this.state = deps.state || deps.game?.state || null;
    this.scene = deps.scene || deps.view?.scene || deps.game?.view?.scene || null;
    this.rng = deps.rng || deps.game?.rng || Math.random;
    this.parked = deps.parked || deps.game?.parked || null; // array game.parked
    this.hud = deps.hud || deps.game?.hud || null;
    this.audio = deps.audio || deps.game?.audio || null;
    this.player = deps.player || deps.game?.player || null;
    this.game = deps.game || null;
    // Entri owned: { id, name, kind, color, plate, engineLevel, tireLevel,
    //   turboLevel, slot, source: 'beli' | 'curi', car }
    this.owned = [];
  }

  // Tempelkan instance ke objek game TANPA mengubah file lain. Dipanggil
  // dari game.js setelah objek game terbentuk; sekaligus menyegarkan semua
  // referensi dari game (state/scene/rng/parked/hud/audio/player).
  wire(game) {
    this.game = game;
    if (game.state) this.state = game.state;
    if (game.view && game.view.scene) this.scene = game.view.scene;
    if (game.rng) this.rng = game.rng;
    if (game.parked) this.parked = game.parked;
    if (game.hud) this.hud = game.hud;
    if (game.audio) this.audio = game.audio;
    if (game.player) this.player = game.player;
    game.garage = this;
    return this;
  }

  toast(msg, secs) {
    if (this.hud && typeof this.hud.toast === 'function') this.hud.toast(msg, secs);
  }

  // -- Katalog & harga -------------------------------------------------------
  catalog() {
    const rep = this.state ? this.state.rep : 0;
    return GARAGE_CATALOG.map((c) => ({
      ...c,
      priceNow: discountedPrice(c.price, rep),
      owned: this.isOwned(c.id),
    }));
  }

  stealCatalog() {
    return STEAL_CATALOG.map((c) => ({ ...c, owned: this.isOwned(c.id) }));
  }

  priceFor(id) {
    const item = GARAGE_CATALOG.find((c) => c.id === id);
    if (!item) return null;
    return discountedPrice(item.price, this.state ? this.state.rep : 0);
  }

  // -- Daftar mobil owned ----------------------------------------------------
  ownedList() {
    return this.owned.map((e) => ({
      id: e.id, name: e.name, kind: e.kind, color: e.color, plate: e.plate,
      engineLevel: e.engineLevel, tireLevel: e.tireLevel, turboLevel: e.turboLevel,
      slot: e.slot, source: e.source,
    }));
  }

  ownedCount() { return this.owned.length; }
  isOwned(id) { return this.owned.some((e) => e.id === id); }
  find(id) { return this.owned.find((e) => e.id === id) || null; }

  makePlate() {
    const num = 1000 + Math.floor(this.rng() * 9000);
    let letters = '';
    for (let i = 0; i < 3; i += 1) letters += PLATE_LETTERS[Math.floor(this.rng() * PLATE_LETTERS.length)];
    return `B ${num} ${letters}`;
  }

  freeSlot() {
    const taken = new Set(this.owned.map((e) => e.slot));
    for (let i = 0; i < FORECOURT_SLOTS.length; i += 1) {
      if (!taken.has(i)) return i;
    }
    return -1;
  }

  // Parkirkan Car milik pemain di slot forecourt yang kosong.
  park(car, slotIndex) {
    const slot = FORECOURT_SLOTS[slotIndex];
    if (!slot) return -1;
    car.x = slot.x;
    car.z = slot.z;
    car.heading = slot.heading;
    if (typeof car.sync === 'function') car.sync();
    return slotIndex;
  }

  // -- Beli ------------------------------------------------------------------
  // return { ok, reason?, entry? } — reason Bahasa Indonesia.
  buy(id) {
    const item = GARAGE_CATALOG.find((c) => c.id === id);
    if (!item) return { ok: false, reason: 'Mobil tidak dikenal.' };
    if (this.isOwned(id)) return { ok: false, reason: `${item.name} sudah jadi milikmu.` };
    if (!this.state) return { ok: false, reason: 'Garasi belum terhubung ke state game.' };
    if (!this.scene || !this.parked) return { ok: false, reason: 'Garasi belum terhubung ke scene.' };
    const price = discountedPrice(item.price, this.state.rep);
    if (this.state.cash < price) {
      return { ok: false, reason: `Uang tidak cukup — ${item.name} $${price.toLocaleString('en-US')}, kamu punya $${Math.round(this.state.cash).toLocaleString('en-US')}.` };
    }
    const slot = this.freeSlot();
    if (slot < 0) return { ok: false, reason: 'Forecourt Safehouse Timur penuh — tidak ada slot parkir kosong.' };
    this.state.cash -= price;
    const car = new Car(this.scene, this.rng, {
      name: item.name, kind: item.kind, x: 0, z: 0, heading: 0, color: item.color,
    });
    car.engineLevel = 0;
    car.tireLevel = 0;
    car.turboLevel = 0;
    car.boost = 0;
    car.plate = this.makePlate();
    this.park(car, slot);
    this.parked.push(car);
    const entry = {
      id: item.id, name: item.name, kind: item.kind, color: item.color,
      plate: car.plate, engineLevel: 0, tireLevel: 0, turboLevel: 0,
      slot, source: 'beli', car,
    };
    this.owned.push(entry);
    if (this.audio && typeof this.audio.pickup === 'function') this.audio.pickup();
    this.toast(`${item.name} dibeli — $${price.toLocaleString('en-US')} · plat ${car.plate} · parkir di Safehouse Timur.`, 5);
    return { ok: true, entry };
  }

  // -- Curi (unlock) ---------------------------------------------------------
  // Daftarkan mobil yang baru dicuri pemain sebagai miliknya. `car` WAJIB
  // diisi dengan instance Car yang dicuri (cruiser polisi / mobil target
  // misi) — koordinator memanggil ini dari onEnterCar / hook misi. File ini
  // hanya mendaftarkan + memarkir; melepas mobil dari police/traffic tetap
  // urusan koordinator di game.js.
  // return { ok, reason?, entry? }.
  unlockSteal(id, car) {
    const item = STEAL_CATALOG.find((c) => c.id === id);
    if (!item) return { ok: false, reason: 'Mobil curian tidak dikenal.' };
    if (this.isOwned(id)) return { ok: false, reason: `${item.name} sudah ada di garasimu.` };
    if (!car) return { ok: false, reason: 'Curi dulu mobilnya di jalan — belum ada mobil yang dibawa pulang.' };
    if (!this.parked) return { ok: false, reason: 'Garasi belum terhubung ke scene.' };
    const slot = this.freeSlot();
    if (slot < 0) return { ok: false, reason: 'Forecourt Safehouse Timur penuh — tidak ada slot parkir kosong.' };
    car.engineLevel = car.engineLevel ?? 0;
    car.tireLevel = car.tireLevel ?? 0;
    car.turboLevel = car.turboLevel ?? 0;
    car.boost = car.boost ?? 0;
    car.plate = car.plate || this.makePlate();
    this.park(car, slot);
    if (!this.parked.includes(car)) this.parked.push(car);
    const entry = {
      id: item.id, name: item.name, kind: item.kind, color: car.color ?? item.color,
      plate: car.plate, engineLevel: car.engineLevel, tireLevel: car.tireLevel,
      turboLevel: car.turboLevel, slot, source: 'curi', car,
    };
    this.owned.push(entry);
    if (this.audio && typeof this.audio.pickup === 'function') this.audio.pickup();
    this.toast(`${item.name} berhasil dicuri — plat ${car.plate} · parkir di Safehouse Timur.`, 5);
    return { ok: true, entry };
  }

  // -- Upgrade ---------------------------------------------------------------
  // part: 'mesin' | 'ban' | 'turbo'. Harga = harga level berikutnya (diskon
  // REP berlaku). Turbo yang dibeli mengisi penuh meter boost (car.boost = 1).
  // return { ok, reason?, level?, price? }.
  upgrade(carId, part) {
    const entry = this.find(carId);
    if (!entry) return { ok: false, reason: 'Mobil tidak ada di garasimu.' };
    const field = UPGRADE_FIELDS[part];
    const prices = UPGRADE_PRICES[part];
    if (!field || !prices) return { ok: false, reason: 'Upgrade tidak dikenal — pilih MESIN, BAN, atau TURBO.' };
    const level = entry[field];
    if (level >= MAX_UPGRADE_LEVEL) return { ok: false, reason: `${UPGRADE_NAMES[part]} ${entry.name} sudah level maks (${MAX_UPGRADE_LEVEL}).` };
    if (!this.state) return { ok: false, reason: 'Garasi belum terhubung ke state game.' };
    const price = discountedPrice(prices[level], this.state.rep);
    if (this.state.cash < price) {
      return { ok: false, reason: `Uang tidak cukup — ${UPGRADE_NAMES[part]} level ${level + 1} $${price.toLocaleString('en-US')}.` };
    }
    this.state.cash -= price;
    entry[field] = level + 1;
    if (entry.car) {
      entry.car[field] = level + 1;
      if (part === 'turbo') entry.car.boost = 1; // nitro diisi penuh
    }
    if (this.audio && typeof this.audio.pickup === 'function') this.audio.pickup();
    this.toast(`${UPGRADE_NAMES[part]} ${entry.name} naik ke level ${level + 1} — $${price.toLocaleString('en-US')}.`, 4);
    return { ok: true, level: level + 1, price };
  }

  // Info upgrade per mobil untuk HUD: { mesin: { level, nextPrice }, ... }.
  // nextPrice null kalau sudah level maks.
  upgradeInfo(carId) {
    const entry = this.find(carId);
    if (!entry) return null;
    const rep = this.state ? this.state.rep : 0;
    const info = {};
    for (const part of Object.keys(UPGRADE_PRICES)) {
      const level = entry[UPGRADE_FIELDS[part]];
      info[part] = {
        level,
        nextPrice: level >= MAX_UPGRADE_LEVEL ? null : discountedPrice(UPGRADE_PRICES[part][level], rep),
      };
    }
    return info;
  }

  // -- Respray ---------------------------------------------------------------
  // Ganti warna + bersihkan heat (state.heat = 0). Harga $150 (diskon REP).
  // return { ok, reason?, price? }.
  respray(carId, colorHex) {
    const entry = this.find(carId);
    if (!entry) return { ok: false, reason: 'Mobil tidak ada di garasimu.' };
    if (typeof colorHex !== 'number') return { ok: false, reason: 'Pilih warna dulu.' };
    if (!this.state) return { ok: false, reason: 'Garasi belum terhubung ke state game.' };
    const price = discountedPrice(RESPRAY_PRICE, this.state.rep);
    if (this.state.cash < price) return { ok: false, reason: `Uang tidak cukup — respray $${price}.` };
    this.state.cash -= price;
    entry.color = colorHex;
    if (entry.car && typeof entry.car.repaint === 'function') entry.car.repaint(colorHex);
    this.state.heat = 0;
    if (this.audio && typeof this.audio.pickup === 'function') this.audio.pickup();
    this.toast(`Respray ${entry.name} selesai — $${price} · heat bersih, polisi kehilangan jejak.`, 4);
    return { ok: true, price };
  }

  // -- Save / load -----------------------------------------------------------
  // Plain object untuk snapshot() game.js (koordinator menambahkan field
  // `garage` ke buildSnapshot/applySave di save.js + game.js).
  serialize() {
    return {
      owned: this.owned.map((e) => ({
        id: e.id, name: e.name, kind: e.kind, color: e.color, plate: e.plate,
        engineLevel: e.engineLevel, tireLevel: e.tireLevel, turboLevel: e.turboLevel,
        slot: e.slot, source: e.source,
      })),
    };
  }

  // Bangun ulang instance Car owned dari data save. Dipanggil koordinator
  // setelah game terbentuk (di applySave). Kalau scene belum ada, entri
  // disimpan tanpa Car dan restore mengembalikan jumlah yang tertunda.
  restore(data) {
    if (!data || !Array.isArray(data.owned)) return { restored: 0, pending: 0 };
    let restored = 0;
    let pending = 0;
    for (const saved of data.owned) {
      if (this.isOwned(saved.id)) continue;
      const entry = {
        id: saved.id, name: saved.name, kind: saved.kind, color: saved.color,
        plate: saved.plate, engineLevel: saved.engineLevel || 0,
        tireLevel: saved.tireLevel || 0, turboLevel: saved.turboLevel || 0,
        slot: saved.slot ?? -1, source: saved.source || 'beli', car: null,
      };
      if (this.scene && this.parked) {
        const car = new Car(this.scene, this.rng, {
          name: entry.name, kind: entry.kind, x: 0, z: 0, heading: 0, color: entry.color,
        });
        car.engineLevel = entry.engineLevel;
        car.tireLevel = entry.tireLevel;
        car.turboLevel = entry.turboLevel;
        car.boost = entry.turboLevel > 0 ? 1 : 0;
        car.plate = entry.plate;
        const slot = entry.slot >= 0 && entry.slot < FORECOURT_SLOTS.length ? entry.slot : this.freeSlot();
        if (slot >= 0) {
          entry.slot = this.park(car, slot);
          this.parked.push(car);
          entry.car = car;
          restored += 1;
        } else {
          pending += 1;
        }
      } else {
        pending += 1;
      }
      this.owned.push(entry);
    }
    return { restored, pending };
  }
}
