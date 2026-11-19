// Usaha Bentara — beli properti, pendapatan pasif per hari game, kumpul saat tidur.
//
// API (ES module, gaya sama seperti sistem lain di src/):
//   import { Usaha } from './usaha.js';
//   const usaha = new Usaha({ state, hud, audio });
//   usaha.wire(game); // menempelkan game.usaha = usaha (dipanggil dari game.js)
//
// Aturan:
// - 3 properti: WARUNG SARI $2.500 (+$30/hari), KOSONG KAKI LIMA $9.500
//   (+$80/hari), SLIP MARINA $22.000 (+$180/hari). Semua label pakai "/hari".
// - Diskon REP: level 4 LEGENDA BENTARA (rep >= 2500) = 20% untuk pembelian
//   properti — helper repDiscount() dipakai dari garage.js (single source
//   of truth, supaya garasi + usaha + senjata selalu sama).
// - Pendapatan masuk ke pot (this.pot), BUKAN langsung ke cash. Pot hanya
//   cair lewat collect() / sleep() — tidur di safehouse.
// - Jam game: 1 jam game = 60 detik waktu main (SECONDS_PER_GAME_HOUR).
//   update(dt) dipanggil koordinator dari step() game.js tiap frame.
// - Tidur semalam = 8 jam game (SLEEP_HOURS): sleep() menambah accrual
//   semalam, lalu mencairkan seluruh pot ke cash dan menaikkan state.day + 1.
//   CATATAN: base v2.1 belum punya mekanisme tidur / pergantian hari
//   (safehouse hanya perbaiki + simpan, state.day tidak pernah naik) —
//   koordinator yang menambahkan interaksi tidur di safehouse dan
//   memanggil usaha.sleep() di sana.
//
// Save: serialize()/restore(data) mengikuti pola save.js (plain object).
// Bump schema TIDAK dilakukan di sini — koordinator yang tangani di save.js.
import { repDiscount, discountedPrice } from './garage.js';

export const SECONDS_PER_GAME_HOUR = 60; // 1 menit waktu main = 1 jam game
export const SLEEP_HOURS = 8; // tidur semalam

export const USAHA_CATALOG = [
  { id: 'warung', name: 'WARUNG SARI', price: 2500, incomePerDay: 30, desc: 'Warung kopi di Deret Ruko — receh tapi stabil, pelanggan tetap tiap hari.' },
  { id: 'kakiLima', name: 'KOSONG KAKI LIMA', price: 9500, incomePerDay: 80, desc: 'Kios kaki lima di Baris Utara — ramai siang malam, untung lumayan.' },
  { id: 'slip', name: 'SLIP MARINA', price: 22000, incomePerDay: 180, desc: 'Slip kapal di Marina Bentara — sewa kapal pesiar, pemasukan terbesar.' },
];

export class Usaha {
  // deps: { state, hud, audio } — diambil dari local game.js; boleh juga
  // menerima objek game utuh.
  constructor(deps = {}) {
    this.state = deps.state || deps.game?.state || null;
    this.hud = deps.hud || deps.game?.hud || null;
    this.audio = deps.audio || deps.game?.audio || null;
    this.game = deps.game || null;
    this.owned = []; // array id properti, urutan beli
    this.pot = 0; // pendapatan yang terkumpul, belum dicairkan ($)
  }

  // Tempelkan instance ke objek game TANPA mengubah file lain. Dipanggil
  // dari game.js setelah objek game terbentuk.
  wire(game) {
    this.game = game;
    if (game.state) this.state = game.state;
    if (game.hud) this.hud = game.hud;
    if (game.audio) this.audio = game.audio;
    game.usaha = this;
    return this;
  }

  toast(msg, secs) {
    if (this.hud && typeof this.hud.toast === 'function') this.hud.toast(msg, secs);
  }

  // -- Katalog & harga -------------------------------------------------------
  catalog() {
    const rep = this.state ? this.state.rep : 0;
    return USAHA_CATALOG.map((c) => ({
      ...c,
      priceNow: discountedPrice(c.price, rep),
      owned: this.isOwned(c.id),
    }));
  }

  priceFor(id) {
    const item = USAHA_CATALOG.find((c) => c.id === id);
    if (!item) return null;
    return discountedPrice(item.price, this.state ? this.state.rep : 0);
  }

  // -- Daftar aset -----------------------------------------------------------
  ownedList() {
    return this.owned.map((id) => {
      const item = USAHA_CATALOG.find((c) => c.id === id);
      return item ? { ...item } : { id };
    });
  }

  ownedCount() { return this.owned.length; }
  isOwned(id) { return this.owned.includes(id); }

  // Chip untuk HUD: "ASET n/3".
  assetChip() {
    return `ASET ${this.owned.length}/3`;
  }

  // -- Pendapatan ------------------------------------------------------------
  dailyRate() {
    return this.owned.reduce((sum, id) => {
      const item = USAHA_CATALOG.find((c) => c.id === id);
      return sum + (item ? item.incomePerDay : 0);
    }, 0);
  }

  hourlyRate() {
    return this.dailyRate() / 24;
  }

  // -- Beli ------------------------------------------------------------------
  // return { ok, reason?, entry? } — reason Bahasa Indonesia.
  buy(id) {
    const item = USAHA_CATALOG.find((c) => c.id === id);
    if (!item) return { ok: false, reason: 'Properti tidak dikenal.' };
    if (this.isOwned(id)) return { ok: false, reason: `${item.name} sudah jadi milikmu.` };
    if (!this.state) return { ok: false, reason: 'Usaha belum terhubung ke state game.' };
    const price = discountedPrice(item.price, this.state.rep);
    if (this.state.cash < price) {
      return { ok: false, reason: `Uang tidak cukup — ${item.name} $${price.toLocaleString('en-US')}, kamu punya $${Math.round(this.state.cash).toLocaleString('en-US')}.` };
    }
    this.state.cash -= price;
    this.owned.push(id);
    if (this.audio && typeof this.audio.pickup === 'function') this.audio.pickup();
    this.toast(`${item.name} dibeli — $${price.toLocaleString('en-US')} · pemasukan +$${item.incomePerDay}/hari. Cairkan dengan tidur di safehouse.`, 5);
    return { ok: true, entry: { ...item } };
  }

  // -- Accrual ---------------------------------------------------------------
  // Tambah pemasukan untuk sejumlah jam game (dipakai update() + sleep()).
  accrueHours(hours) {
    if (hours <= 0) return 0;
    const gained = this.hourlyRate() * hours;
    this.pot += gained;
    return gained;
  }

  // Dipanggil koordinator dari step() game.js tiap frame saat mode play.
  // dt dalam detik waktu main; 60 detik = 1 jam game.
  update(dt) {
    if (!this.owned.length || !dt || dt <= 0) return;
    this.accrueHours(dt / SECONDS_PER_GAME_HOUR);
  }

  // Cairkan seluruh pot ke cash, lalu nol-kan pot. return { amount }.
  collect() {
    const amount = Math.round(this.pot);
    this.pot = 0;
    if (amount > 0 && this.state) this.state.cash += amount;
    return { amount };
  }

  // Tidur di safehouse: accrual semalam (8 jam game) + cairkan seluruh pot
  // + hari bertambah 1. return { collected, day }.
  // Dipanggil koordinator dari interaksi tidur safehouse (belum ada di base).
  sleep() {
    this.accrueHours(SLEEP_HOURS);
    const { amount } = this.collect();
    if (this.state) this.state.day = (this.state.day || 1) + 1;
    if (this.audio && typeof this.audio.pickup === 'function') this.audio.pickup();
    this.toast(
      amount > 0
        ? `Bangun pagi — hari ${this.state ? this.state.day : '?'} · usaha setor $${amount.toLocaleString('en-US')}.`
        : `Bangun pagi — hari ${this.state ? this.state.day : '?'} · belum ada usaha yang setor.`,
      5,
    );
    return { collected: amount, day: this.state ? this.state.day : null };
  }

  // -- Save / load -----------------------------------------------------------
  // Plain object untuk snapshot() game.js (koordinator menambahkan field
  // `usaha` ke buildSnapshot/applySave di save.js + game.js).
  serialize() {
    return {
      owned: [...this.owned],
      pot: Math.round(this.pot * 100) / 100,
    };
  }

  restore(data) {
    if (!data) return { restored: 0 };
    if (Array.isArray(data.owned)) {
      this.owned = data.owned.filter((id) => USAHA_CATALOG.some((c) => c.id === id));
    }
    if (typeof data.pot === 'number') this.pot = Math.max(0, data.pot);
    return { restored: this.owned.length };
  }
}

// Re-export helper diskon supaya pemanggil usaha tidak perlu import garage.js
// langsung (tetap satu implementasi di garage.js).
export { repDiscount };
