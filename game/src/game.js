// BENTARA: DRY SEASON — the game itself. Wires every system together and owns
// the one fixed step: input, player, traffic, peds, police, missions, taxi,
// race, collectibles, heat, bill, autosave, audio and HUD, in that order.
// Nothing here is posed: the screenshots reach their states through these
// same calls.
//
// v3 adds the depth systems on top of that contract, in the same order:
// garage (Bengkel Roda Jaya), usaha (3 buyable properties), combat economy
// (kill drops, ammo, bribe), KEMAJUAN %, per-act lighting presets, and the
// juice (tire smoke, skid marks, roadblock breaks, damage vignette).
// The step order is the game's contract: the player moves first, then the
// world reacts (traffic brakes, peds flee, police pursue), then the jobs
// (missions, taxi, race, collectibles) pay out, then heat decays and the
// HUD reads the finished state. A system that needs the player's new
// position must sit after player.step; a system that pays must sit after
// the world that earned it.
import * as THREE from 'three';
import { mulberry32, rr } from './rng.js';
import {
  STEP, WEAPONS, SHOTGUN_SHELLS_PRICE, SMG_AMMO_PRICE, RIFLE_AMMO_PRICE, LAUNCHER_AMMO_PRICE,
  STUNTS, COLLECTIBLES, CHARACTERS, GARAGE_CARS, GARAGE_UPGRADES, RESPRAY_PRICE,
  BRIBE_PER_STAR, SHOP_DISCOUNT_REP, SHOP_DISCOUNT,
} from './config.js';
import { buildCity, loc, LOCATIONS } from './city.js';
import { createView } from './world.js';
import {
  createInput, ACT_CONFIRM, ACT_PAUSE, ACT_INTERACT, ACT_ENTER, ACT_RADIO,
  ACT_WEAPON1, ACT_WEAPON2, ACT_WEAPON3, ACT_WEAPON4, ACT_WEAPON5,
  ACT_RELOAD, ACT_PHOTO, ACT_BRIBE,
} from './input.js';
import { createPlayer } from './player.js';
import { createTraffic } from './actors/traffic.js';
import { createPeds } from './actors/peds.js';
import { createPolice } from './actors/police.js';
import { createProps } from './props.js';
import { createBill } from './bill.js';
import { createMissions } from './missions.js';
import { createCollectibles } from './collectibles.js';
import { createTaxi } from './taxi.js';
import { createRace } from './race.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { saveGame, loadGame } from './save.js';
import { createGarage } from './garage.js';
import { createUsaha } from './usaha.js';
import { createProgress } from './progress.js';
import { createDrops } from './drops.js';
import { createFx } from './fx.js';
import { Car } from './actors/car.js';
import { Human } from './actors/human.js';
import { dist } from './mathx.js';
import { missionIntro, randomTaunt } from './dialogue.js';

export function createGame(canvas, seed = 7) {
  const rng = mulberry32(seed);
  const city = buildCity(rng);
  const view = createView(canvas, city, rng);
  const input = createInput(canvas);
  const hud = createHud();
  const audio = createAudio();
  const bill = createBill();
  const props = createProps(view.scene, city, rng);
  const traffic = createTraffic(view.scene, city, rng);
  const peds = createPeds(view.scene, city, rng);
  const police = createPolice(view.scene, city, rng);
  const fx = createFx(view.scene);
  // Act 1 starts in morning gold; the preset snaps again on every mission
  // intro (Act 2 high amber, Act 3 red dusk).
  if (view.golden) view.golden.setAct(1, view.renderer);

  const state = {
    seed, time: 0, cash: 250, rep: 0, heat: 0, day: 1,
    mode: 'title', // title | play | paused | over | caught | garage
    saveTimer: 0, seenTimer: 0, respawnTimer: 0, down: false,
    interactPressed: false, tauntTimer: 0,
    garageOpen: false, photoMode: false, driftFxTimer: 0,
    lastRoadblock: null, roadblockBroken: false,
  };

  // Shot scripts steer through this facade instead of the keyboard, so a
  // screenshot state is reached by the same code path as a player's input.
  const shotKeys = { active: false, up: false, down: false, left: false, right: false, brake: false, run: false, mouse: false };
  const inputFacade = {
    up: () => (shotKeys.active ? shotKeys.up : input.up()),
    down: () => (shotKeys.active ? shotKeys.down : input.down()),
    left: () => (shotKeys.active ? shotKeys.left : input.left()),
    right: () => (shotKeys.active ? shotKeys.right : input.right()),
    brake: () => (shotKeys.active ? shotKeys.brake : input.brake()),
    run: () => (shotKeys.active ? shotKeys.run : input.run()),
    mouseDown: () => (shotKeys.active ? shotKeys.mouse : input.mouseDown()),
    takeClick: () => input.takeClick(),
    takeActions: () => input.takeActions(),
  };

  // Named contacts standing in the world.
  const npcs = [];
  function addNpc(name, initials, locName, color, dx = 0, dz = 0) {
    const L = loc(locName);
    const h = new Human(view.scene, rng, 'npc');
    h.torso.material.color.setHex(color);
    h.setPos(L.x + dx, L.z + dz);
    h.face(Math.PI);
    npcs.push({ human: h, name, initials, locName });
    return h;
  }
  addNpc('PAK WIRA', 'PW', 'marina', 0x7a5c2e);
  addNpc('PAK ASKA', 'PA', 'marina', 0x2f4a55, 5, 3);
  addNpc('SARI', 'SR', 'shophouseRow', 0x8a4a6b);
  addNpc('BANG IJAL', 'BI', 'eastSafehouse', 0x4a6b8a);
  addNpc('DEDI', 'DD', 'industrialYard', 0x4a6b8a);
  addNpc('MBAK RINI', 'MR', 'northRowStall', 0x2f6b4f);

  // Parked cars, including the player's own CEMPAKA GT on the marina road,
  // nose east so driving away needs no three-point turn past the ruko walls.
  const parked = [];
  const playerCar = new Car(view.scene, rng, { name: 'CEMPAKA GT', kind: 'sport', x: 10, z: -180.5, heading: Math.PI / 2, color: 0xb8442f });
  playerCar.garageId = 'cempaka';
  playerCar.perf = { topSpeed: 1.25, grip: 1.0, turbo: 0 };
  parked.push(playerCar);
  parked.push(new Car(view.scene, rng, { name: 'Sedan Tua', x: 118, z: 66, heading: 1.2, color: 0x4a4a42 }));
  parked.push(new Car(view.scene, rng, { name: 'Pickup', x: 44, z: 88, heading: -0.6, color: 0x2f6b4f }));

  // Garage + usaha + drops + progress: the v3 depth systems.
  const garage = createGarage(view.scene, city, rng, {
    onBuy: (d, price) => { hud.toast(`${d.name} dibeli — $${price}. Parkir di Safehouse Timur.`); audio.missionDone(); },
    onUpgrade: (d, kind, level, price) => { hud.toast(`${d.name} — ${GARAGE_UPGRADES[kind].name} tingkat ${level} — $${price}.`); audio.pickup(); },
    onRespray: (d, price) => { state.heat = 0; hud.toast(`${d.name} dicat ulang — $${price}. Polisi tidak kenal lagi.`); audio.pickup(); },
    onStealUnlock: (d) => { hud.toast(`${d.name} dicuri — masuk garasi!`); hud.popups.big(`${d.name} DICURI`, 'mobil baru di garasi'); audio.missionDone(); },
  });
  garage.buildBoard();
  const usaha = createUsaha(view.scene, city, rng, {
    onBuy: (u, price) => { hud.toast(`${u.name} milikmu — $${price}. +$${u.incomePerDay}/hari, ambil dengan TIDUR di safehouse.`); audio.missionDone(); },
    onCollect: (amount) => { if (amount > 0) hud.toast(`Usaha setor +$${amount}.`); },
  });
  const progress = createProgress();
  const drops = createDrops(view.scene, rng, {
    onPickup: (it) => {
      if (it.kind === 'cash') {
        state.cash += it.value;
        hud.popups.collect(it.value, 'uang jatuh');
        audio.collect();
      } else if (it.kind === 'ammo') {
        player.shells += 12;
        player.smgAmmo += 30;
        hud.popups.collect(0, 'amunisi +12/+30');
        audio.pickup();
      } else if (it.kind === 'armor') {
        player.armor = Math.min(100, player.armor + 25);
        hud.toast('Armor +25.');
        audio.pickup();
      }
    },
  });

  const player = createPlayer({
    scene: view.scene, city, view, rng, input: inputFacade,
    targets: () => ({
      humans: [...peds.peds, ...police.cops, ...missions.attackers, ...npcs.map((n) => n.human)],
      cars: [...traffic.cars, ...police.cruisers, ...parked, ...garage.parkedOwned, missions.targetCar].filter(Boolean).filter((c) => c !== player.car),
    }),
    onShoot: (result, weapon) => {
      audio.gunshot();
      peds.fleeFrom(player.x, player.z);
      traffic.fleeFrom(player.x, player.z);
      if (!result) return;
      if (result.hit === 'human') {
        const h = result.human;
        const killed = h.damage(WEAPONS[weapon].damage);
        if (h.role === 'ped') addHeat(1);
        else addHeat(0.3);
        if (killed) {
          if (h.role === 'attacker') audio.pickup();
          // Combat economy: the fallen drop a glowing cash bundle, and
          // half the time an ammo crate too.
          drops.spawnCash(h.x, h.z, 35);
          if (rr(rng, 0, 1) < 0.5) drops.spawnAmmo(h.x + 1.5, h.z + 1, 1);
          hud.popups.kill(35);
        }
      } else if (result.hit === 'car') {
        const dead = result.car.damage(WEAPONS[weapon].damage * (weapon === 'shotgun' ? 3 : 1));
        if (dead) {
          addHeat(1);
          hud.toast('Mobil target hancur.');
          drops.spawnCash(result.car.x, result.car.z, 50);
          drops.spawnAmmo(result.car.x + 2, result.car.z, 1);
        } else addHeat(0.1);
      }
    },
    onEnterCar: (car) => {
      hud.toast(`${car.name} — milikmu sekarang.`);
      audio.pickup();
      // Steal-unlocks: a cruiser becomes PANTHERA, the mission target car
      // becomes KANCIL — both join the garage.
      if (car.isCop) garage.unlockSteal('polisi');
      if (car.missionTarget === 'steal') garage.unlockSteal('geng');
      if (car.garageId && garage.owned.has(car.garageId)) car.perf = garage.perfFor(car.garageId);
    },
    onExitCar: () => {},
    onCarBrush: (car) => {
      const prop = props.nearestUnbroken(car.x, car.z, 3.2);
      if (prop && props.breakProp(prop, bill, (h) => addHeat(h))) {
        hud.popups.bill(prop.price);
      }
    },
    onDrift: (secondsHeld, amount) => {
      state.cash += amount;
      state.rep += 2;
      hud.popups.drift(amount, secondsHeld);
      audio.drift();
    },
    onScrape: (car) => { fx.spark(car.x, 1, car.z); },
    onDryFire: () => { hud.toast('Mag kosong — tekan Q untuk isi ulang.'); },
  });
  player.setPos(-6, -158, 0);

  // Side activities: collectibles, taxi fares and the checkpoint race.
  // Each pays cash + REP through the same settle path as missions.
  const collectibles = createCollectibles(view.scene, city, rng, {
    onCollect: (item, value) => {
      state.cash += value;
      state.rep += COLLECTIBLES.repPer;
      hud.popups.collect(value, item.kind);
      audio.collect();
      if (collectibles.collected % 6 === 0) hud.toast(`Koleksi ${collectibles.collected}/${collectibles.total} — kota ini menyimpan banyak rahasia.`, 4);
    },
  });
  const taxi = createTaxi(view.scene, city, rng, {
    onPassenger: (p) => { hud.toast(`Taksi: ${p.name} menunggu di ${loc(p.stand).label} — jemput kalau sempat.`, 4); },
    onPickup: (p, dest) => {
      const key = /^(Pak|Bang)/.test(p.name) ? 'ijal' : 'sari';
      hud.dialogue(`${p.name.toUpperCase()} · PENUMPANG`, `Tolong antar saya ke ${dest.label}, ya. Saya bayar pakai argo.`, key, 5);
      hud.toast(`Penumpang naik — antar ke ${dest.label}.`);
      audio.taxiDing();
    },
    onFarePaid: (done) => {
      state.cash += done.paid;
      state.rep += 10;
      hud.popups.fare(done.paid, done.name);
      hud.toast(`Taksi selesai: +$${done.paid} (${done.distance} m).`);
      audio.missionDone();
    },
    onAbandoned: () => { hud.toast('Penumpang taksi turun — kamu tinggalkan mobil.'); },
  });
  const race = createRace(view.scene, city, rng, {
    onStart: (gate) => { hud.toast('BALAPAN: lewati 5 gate emas secepat mungkin!'); audio.taxiDing(); },
    onGate: (n, total, t) => { hud.popups.raceGate(n, total); audio.collect(); },
    onFinish: (done) => {
      state.cash += done.paid;
      state.rep += 120;
      hud.toast(done.beatPar
        ? `BALAPAN SELESAI ${done.time.toFixed(1)} dtk — di bawah par! +$${done.paid}.`
        : `BALAPAN SELESAI ${done.time.toFixed(1)} dtk — +$${done.paid}.`, 6);
      audio.missionDone();
    },
  });

  const missions = createMissions(view.scene, city, rng, {
    onMissionComplete: (m) => {
      const paid = bill.settle(state.cash);
      state.cash = Math.max(0, state.cash - paid);
      state.cash += m.reward;
      state.rep += m.rep;
      audio.missionDone();
      // The mission ledger: the settlement card, with the real numbers.
      hud.showLedger({ title: m.title, gross: m.reward, bill: paid, net: m.reward - paid, rep: m.rep }, 6);
      hud.dialogue('PAK WIRA · BOS MARINA', m.doneLine, 'wira', 7);
      hud.toast(paid > 0
        ? `Misi selesai: +$${m.reward} — tagihan kerusakan $${paid} dipotong.`
        : `Misi selesai: +$${m.reward}.`, 6);
      hud.announce(`Misi selesai. Hadiah $${m.reward}.`);
    },
    onTalk: (line, who) => {
      const key = who === 'PAK WIRA' ? 'wira' : who === 'SARI' ? 'sari' : who === 'PAK ASKA' ? 'aska' : who === 'DEDI' ? 'dedi' : 'wira';
      const c = CHARACTERS[key] || CHARACTERS.wira;
      hud.dialogue(`${who} · ${c.role}`, line, key, 7);
    },
    onSpawnAttacker: () => { addHeat(0.4); },
    onTargetCar: () => {},
    onIntro: (missionIndex) => {
      // Per-act lighting snap: 1 morning gold, 2 high amber, 3 red dusk.
      const act = missionIndex < 3 ? 1 : missionIndex < 6 ? 2 : 3;
      if (view.golden) view.golden.setAct(act, view.renderer);
      const intro = missionIntro(missionIndex);
      const c = CHARACTERS[intro.who];
      hud.dialogue(`${c.name} · ${c.role}`, intro.line, intro.who, 7);
    },
  });

  function shopPrice(amount) {
    const level = state.rep >= 2000 ? 4 : state.rep >= 1000 ? 3 : state.rep >= 400 ? 2 : 1;
    return level >= SHOP_DISCOUNT_REP ? Math.round(amount * (1 - SHOP_DISCOUNT)) : amount;
  }

  function addHeat(amount) {
    const before = state.heat;
    state.heat = Math.min(5, state.heat + amount);
    if (before < 1 && state.heat >= 1) {
      hud.ticker('POLISI: Semua unit — kejar sedan merah di Kawasan Industri!', 6);
    }
    // Crossing into 3 stars earns a taunt from the police captain.
    if (before < 3 && state.heat >= 3) {
      hud.dialogue('LETKOL RAHMAT · KAPOLRES BENTARA', randomTaunt(rng), 'rahmat', 7);
    }
  }

  function damagePlayer(amount) {
    if (state.down || state.mode !== 'play') return;
    // Armor absorbs half of incoming damage until it breaks.
    const absorbed = Math.min(player.armor, amount * 0.5);
    player.armor = Math.max(0, player.armor - absorbed);
    player.health = Math.max(0, player.health - (amount - absorbed));
    hud.damageFlash();
    if (player.health <= 0) {
      state.down = true;
      state.respawnTimer = 3;
      hud.toast('Kamu tumbang...', 3);
      hud.announce('Kamu tumbang.');
    }
  }

  function respawn() {
    const H = loc('hospital');
    player.health = 100;
    if (player.car) { player.exitCar(); }
    player.setPos(H.x + 4, H.z + 4, 0);
    state.cash = Math.max(0, state.cash - 25);
    state.heat = Math.max(0, state.heat - 1);
    state.down = false;
    hud.toast('Kamu bangun di Rumah Sakit. -$25 biaya berobat.', 5);
  }

  // The garage menu (DOM overlay): cars to buy/select, upgrades for the
  // current car, respray. Built fresh on open so prices and ownership are
  // always live.
  function openGarage() {
    state.garageOpen = true;
    state.mode = 'garage';
    const el = document.getElementById('garageOverlay');
    const body = document.getElementById('garageBody');
    const level = state.rep >= 2000 ? 4 : state.rep >= 1000 ? 3 : state.rep >= 400 ? 2 : 1;
    let html = `<h2>BENGKEL RODA JAYA</h2><div class="sub">Bang Ijal — uangmu $${Math.round(state.cash).toLocaleString('en-US')} · REP ${level}${level >= SHOP_DISCOUNT_REP ? ' · diskon toko 20%' : ''}</div>`;
    for (const d of GARAGE_CARS) {
      const owned = garage.owned.has(d.id);
      const price = d.price === null ? null : garage.priceFor(d.price, state.rep);
      const cur = garage.current === d.id;
      const action = d.price === null
        ? (owned ? (cur ? 'DIPAKAI' : `<button data-select="${d.id}">PILIH</button>`) : `<span style="opacity:.6">CURI UNTUK DAPATKAN</span>`)
        : owned
          ? (cur ? 'DIPAKAI' : `<button data-select="${d.id}">PILIH</button>`)
          : `<button data-buy="${d.id}" ${state.cash < price ? 'disabled' : ''}>BELI $${price.toLocaleString('en-US')}</button>`;
      html += `<div class="car-row"><div><b>${d.name}</b><span class="desc">${d.desc}</span></div><div>${action}</div></div>`;
    }
    const cur = garage.def(garage.current);
    const u = garage.upgrades[garage.current];
    html += `<div class="upgrades"><b>UPGRADE — ${cur.name}</b><br>`;
    for (const kind of ['engine', 'grip', 'turbo']) {
      const spec = GARAGE_UPGRADES[kind];
      const lvl = u[kind];
      const maxed = lvl >= spec.prices.length;
      const price = maxed ? 0 : garage.priceFor(spec.prices[lvl], state.rep);
      const locked = kind === 'turbo' && spec.needsRep && level < spec.needsRep;
      html += `<button data-upgrade="${kind}" ${maxed || locked || state.cash < price ? 'disabled' : ''}>${spec.name} ${'●'.repeat(lvl)}${'○'.repeat(spec.prices.length - lvl)}${maxed ? ' · MAKS' : ` · $${price}`}${locked ? ' · butuh REP 2' : ''}</button> `;
    }
    html += `<button data-respray="1" ${state.cash < garage.priceFor(RESPRAY_PRICE, state.rep) ? 'disabled' : ''}>CAT ULANG $${garage.priceFor(RESPRAY_PRICE, state.rep)} · bersihkan bintang</button></div>`;
    html += `<div style="margin-top:12px"><button data-close="1">TUTUP (Esc)</button></div>`;
    body.innerHTML = html;
    body.querySelectorAll('[data-buy]').forEach((b) => {
      b.addEventListener('click', () => {
        const r = garage.buy(b.dataset.buy, state.cash, state.rep);
        if (r.ok) { state.cash -= r.price; audio.pickup(); }
        else hud.toast(r.reason || 'Gagal membeli.');
        openGarage();
      });
    });
    body.querySelectorAll('[data-select]').forEach((b) => {
      b.addEventListener('click', () => {
        garage.current = b.dataset.select;
        const d = garage.def(garage.current);
        if (player.car) {
          player.car.repaint(garage.colors[d.id]);
          player.car.perf = garage.perfFor(d.id);
        }
        hud.toast(`${d.name} dipilih.`);
        openGarage();
      });
    });
    body.querySelectorAll('[data-upgrade]').forEach((b) => {
      b.addEventListener('click', () => {
        const r = garage.upgrade(garage.current, b.dataset.upgrade, state.cash, state.rep);
        if (r.ok) { state.cash -= r.price; }
        else hud.toast(r.reason || 'Gagal upgrade.');
        openGarage();
      });
    });
    body.querySelectorAll('[data-respray]').forEach((b) => {
      b.addEventListener('click', () => {
        const r = garage.respray(garage.current, state.cash, state.rep);
        if (r.ok) {
          state.cash -= r.price;
          if (player.car) player.car.repaint(r.color);
        } else hud.toast(r.reason || 'Gagal cat ulang.');
        openGarage();
      });
    });
    body.querySelectorAll('[data-close]').forEach((b) => {
      b.addEventListener('click', () => closeGarage());
    });
    el.style.display = 'flex';
  }
  function closeGarage() {
    state.garageOpen = false;
    state.mode = 'play';
    document.getElementById('garageOverlay').style.display = 'none';
  }

  // Interactions: garage (Bengkel), shop (Ruko), safehouse (Timur, sleep),
  // property purchase, talk targets, taxi pickup, race start, car entry.
  function handleInteract() {
    const S = loc('shophouseRow');
    const E = loc('eastSafehouse');
    const B = loc('industrialYard');
    if (dist(player.x, player.z, B.x, B.z) < 12) {
      openGarage();
      return;
    }
    const prop = usaha.nearestBuyable(player.x, player.z);
    // A talk step takes priority over a property purchase: pressing E at
    // the marina to talk to Wira must not also buy the SLIP MARINA
    // ($22,000) that stands on the same spot — the QA caught the
    // double-fire (mission 1's talk cost $17,600 after the REP discount
    // because the property bought itself on the same keypress). The talk
    // itself runs in missions.update, so returning here only skips the
    // purchase; the player can still buy the property with a later E
    // press once the talk step is done.
    if (prop && missions.nearTalkTarget(player.x, player.z)) return;
    if (prop) {
      const r = usaha.buy(prop.id, state.cash, state.rep);
      if (r.ok) { state.cash -= r.price; audio.missionDone(); }
      else hud.toast(r.reason || 'Gagal membeli usaha.');
      return;
    }
    if (dist(player.x, player.z, S.x, S.z) < 9) {
      // The Ruko shop, in priority order: shotgun → SMG → senapan →
      // pelontar, then ammo for the current weapon. REP 4 gets 20% off.
      const buy = (price, label, apply) => {
        const p = shopPrice(price);
        if (state.cash < p) { hud.toast(`Uang tidak cukup. ${label} $${p}.`); return true; }
        state.cash -= p;
        apply();
        hud.toast(`${label} dibeli — $${p}.`);
        audio.pickup();
        return true;
      };
      if (!player.hasShotgun) return buy(WEAPONS.shotgun.price, 'Shotgun', () => { player.hasShotgun = true; player.shells = 12; player.weapon = 'shotgun'; });
      if (!player.hasSmg) return buy(WEAPONS.smg.price, 'SMG', () => { player.hasSmg = true; player.smgAmmo = 30; player.weapon = 'smg'; });
      if (!player.hasRifle) return buy(WEAPONS.rifle.price, 'Senapan', () => { player.hasRifle = true; player.rifleAmmo = 10; player.weapon = 'rifle'; });
      if (!player.hasLauncher) return buy(WEAPONS.launcher.price, 'Pelontar', () => { player.hasLauncher = true; player.launcherAmmo = 4; player.weapon = 'launcher'; });
      if (player.weapon === 'shotgun') return buy(SHOTGUN_SHELLS_PRICE, 'Amunisi shotgun +12', () => { player.shells += 12; });
      if (player.weapon === 'smg') return buy(SMG_AMMO_PRICE, 'Amunisi SMG +30', () => { player.smgAmmo += 30; });
      if (player.weapon === 'rifle') return buy(RIFLE_AMMO_PRICE, 'Amunisi senapan +10', () => { player.rifleAmmo += 10; });
      if (player.weapon === 'launcher') return buy(LAUNCHER_AMMO_PRICE, 'Amunisi pelontar +4', () => { player.launcherAmmo += 4; });
      return buy(SHOTGUN_SHELLS_PRICE, 'Amunisi shotgun +12', () => { player.shells += 12; });
    }
    if (dist(player.x, player.z, E.x, E.z) < 9) {
      // TIDUR: repair + heal + refuel, collect the usaha pot, day +1, save.
      if (player.car) player.car.health = 100;
      player.health = 100;
      player.fuel = 100;
      const gained = usaha.collect();
      state.cash += gained;
      state.day += 1;
      saveGame(snapshot());
      hud.toast(gained > 0
        ? `TIDUR — akumulasi +$${gained} · hari ${state.day} · mobil diperbaiki, game tersimpan.`
        : `TIDUR — hari ${state.day} · mobil diperbaiki, game tersimpan.`, 5);
      audio.pickup();
    }
    if (!player.onFoot && taxi.nearPassenger(player.x, player.z)) {
      if (taxi.startFare(player.x, player.z)) return;
    }
    if (race.nearStart(player.x, player.z)) {
      if (race.startRace()) return;
    }
  }

  function promptText() {
    const S = loc('shophouseRow');
    const E = loc('eastSafehouse');
    const B = loc('industrialYard');
    if (missions.nearTalkTarget(player.x, player.z)) return 'E — Bicara';
    if (dist(player.x, player.z, B.x, B.z) < 12) return 'E — Bengkel Roda Jaya (beli mobil / upgrade)';
    const prop = usaha.nearestBuyable(player.x, player.z);
    if (prop) return `E — Beli ${prop.name} $${prop.price.toLocaleString('en-US')} (+$${prop.incomePerDay}/hari)`;
    if (dist(player.x, player.z, S.x, S.z) < 9) {
      if (!player.hasShotgun) return `E — Beli shotgun $${shopPrice(WEAPONS.shotgun.price)}`;
      if (!player.hasSmg) return `E — Beli SMG $${shopPrice(WEAPONS.smg.price)}`;
      if (!player.hasRifle) return `E — Beli senapan $${shopPrice(WEAPONS.rifle.price)}`;
      if (!player.hasLauncher) return `E — Beli pelontar $${shopPrice(WEAPONS.launcher.price)}`;
      return 'E — Beli amunisi';
    }
    if (dist(player.x, player.z, E.x, E.z) < 9) return usaha.pot > 0 ? `E — TIDUR · akumulasi +$${usaha.pot}` : 'E — TIDUR · perbaiki + simpan';
    if (!player.onFoot && taxi.nearPassenger(player.x, player.z)) return taxi.prompt();
    if (race.nearStart(player.x, player.z)) return 'E — Mulai balapan (5 gate)';
    if (player.onFoot) {
      const car = player.nearestCar([...traffic.cars, ...parked, ...garage.parkedOwned, missions.targetCar].filter(Boolean));
      if (car) return car.missionTarget === 'steal' ? 'F — Curi mobil ini' : `F — Masuk ${car.name}`;
    }
    return null;
  }

  function snapshot() {
    return {
      cash: state.cash, rep: state.rep, day: state.day,
      missionIndex: missions.index,
      hasShotgun: player.hasShotgun, shells: player.shells,
      hasSmg: player.hasSmg, smgAmmo: player.smgAmmo,
      hasRifle: player.hasRifle, rifleAmmo: player.rifleAmmo,
      hasLauncher: player.hasLauncher, launcherAmmo: player.launcherAmmo,
      collected: collectibles.collected, taxiTrips: taxi.trips, raceBest: race.best,
      garage: garage.serialize(), usaha: usaha.serialize(),
      fuel: player.fuel, boost: player.boost, armor: player.armor,
    };
  }

  function applySave(data) {
    state.cash = data.cash;
    state.rep = data.rep;
    state.day = data.day || 1;
    player.hasShotgun = !!data.hasShotgun;
    player.shells = data.shells ?? 0;
    player.hasSmg = !!data.hasSmg;
    player.smgAmmo = data.smgAmmo ?? 0;
    player.hasRifle = !!data.hasRifle;
    player.rifleAmmo = data.rifleAmmo ?? 0;
    player.hasLauncher = !!data.hasLauncher;
    player.launcherAmmo = data.launcherAmmo ?? 0;
    player.fuel = data.fuel ?? 100;
    player.boost = data.boost ?? 1;
    player.armor = data.armor ?? 0;
    if (data.garage) garage.applySave(data.garage);
    if (data.usaha) usaha.applySave(data.usaha);
    if (player.hasShotgun) player.weapon = 'shotgun';
    missions.setIndex(data.missionIndex || 0);
  }

  // Near-miss detection: a traffic car flashing past within 2.4 m while
  // the player is fast. One payout per car per 3 seconds.
  const nearMissCooldown = new Map();
  function checkNearMiss(dt) {
    if (player.onFoot || !player.car) return;
    if (Math.abs(player.car.speed) * 3.6 < STUNTS.nearMissMinSpeed) return;
    const px = player.x;
    const pz = player.z;
    const heading = player.heading;
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    for (const c of traffic.cars) {
      const dx = c.x - px;
      const dz = c.z - pz;
      const along = dx * fx + dz * fz;
      const lateral = Math.abs(dx * fz - dz * fx);
      if (along > -4 && along < 6 && lateral < STUNTS.nearMissMaxGap && lateral > 1.2) {
        const last = nearMissCooldown.get(c.id) || -10;
        if (state.time - last > 3) {
          nearMissCooldown.set(c.id, state.time);
          state.cash += STUNTS.nearMiss;
          state.rep += 3;
          hud.popups.nearMiss();
        }
      }
    }
  }

  function step(dt) {
    if (state.mode === 'play' && state.down) {
      state.respawnTimer -= dt;
      if (state.respawnTimer <= 0) respawn();
    }
    const actions = inputFacade.takeActions();
    state.interactPressed = !!(actions & ACT_INTERACT);
    if (state.mode === 'play') {
      if (actions & ACT_PAUSE) { state.mode = 'paused'; return; }
      if (actions & ACT_RADIO) {
        audio.setRadio(!audio.radioOn());
        hud.toast(audio.radioOn() ? 'RADIO KEMARAU 92.4 — Bang Ocid menyala.' : 'Radio mati.');
      }
      if (actions & ACT_RELOAD) {
        if (player.startReload()) hud.toast('Isi ulang…');
      }
      if (actions & ACT_PHOTO) {
        state.photoMode = !state.photoMode;
        hud.setPhotoMode(state.photoMode);
        hud.toast(state.photoMode ? 'Mode foto — HUD disembunyikan (H untuk kembali).' : 'Mode foto mati.');
      }
      if (actions & ACT_BRIBE) {
        const level = state.rep >= 2000 ? 4 : state.rep >= 1000 ? 3 : state.rep >= 400 ? 2 : 1;
        if (level < 3) {
          hud.toast('PELEPASAN butuh REP 3 — suap polisi belum kenal kamu.');
        } else if (state.heat <= 0) {
          hud.toast('Tidak ada bintang untuk dihapus.');
        } else {
          const cost = BRIBE_PER_STAR * Math.ceil(state.heat);
          if (state.cash < cost) hud.toast(`PELEPASAN butuh $${cost} — uang tidak cukup.`);
          else {
            state.cash -= cost;
            state.heat = 0;
            hud.toast(`PELEPASAN — polisi dibayar $${cost}. Bintang hilang.`);
            audio.pickup();
          }
        }
      }
      if (actions & ACT_WEAPON1) player.weapon = 'pistol';
      if (actions & ACT_WEAPON2 && player.hasShotgun) player.weapon = 'shotgun';
      if (actions & ACT_WEAPON3 && player.hasSmg) player.weapon = 'smg';
      if (actions & ACT_WEAPON4 && player.hasRifle) player.weapon = 'rifle';
      if (actions & ACT_WEAPON5 && player.hasLauncher) player.weapon = 'launcher';
      if (actions & ACT_ENTER && player.onFoot) {
        const car = player.nearestCar([...traffic.cars, ...parked, ...garage.parkedOwned, missions.targetCar].filter(Boolean));
        if (car) player.enterCar(car);
      } else if (actions & ACT_ENTER && !player.onFoot) {
        player.exitCar();
      }
      if (state.interactPressed) handleInteract();
      state.time += dt;
      if (!state.down) player.step(dt);
      traffic.step(dt, player.car);
      peds.step(dt);
      police.step(dt, {
        px: player.x, pz: player.z, heading: player.heading,
        playerInCar: !player.onFoot, playerCar: player.car,
        heat: state.heat, t: state.time, damagePlayer, onCopShot: () => {},
      });
      missions.update(dt, {
        px: player.x, pz: player.z,
        interactPressed: state.interactPressed,
        playerCar: player.car, damagePlayer,
      });
      taxi.update(dt, {
        px: player.x, pz: player.z,
        interactPressed: state.interactPressed,
        playerInCar: !player.onFoot,
      });
      race.update(dt, { px: player.x, pz: player.z });
      collectibles.update(dt, state.time, player.x, player.z);
      drops.update(dt, state.time, player.x, player.z);
      fx.step(dt);
      // Tire smoke + skid marks while the player drifts.
      if (player.drifting && player.car) {
        state.driftFxTimer -= dt;
        if (state.driftFxTimer <= 0) {
          state.driftFxTimer = 0.12;
          const bx = player.x - Math.sin(player.heading) * 2;
          const bz = player.z - Math.cos(player.heading) * 2;
          fx.burst(bx, bz, 2, 1.6);
          fx.skid(bx, bz, player.heading);
        }
      }
      checkNearMiss(dt);
      // Roadblock break-through: pass the barricade fast and it pays.
      if (police.roadblock !== state.lastRoadblock) {
        state.lastRoadblock = police.roadblock;
        state.roadblockBroken = false;
      }
      if (police.roadblock && !state.roadblockBroken && player.car
        && Math.abs(player.car.speed) > 15
        && dist(player.x, player.z, police.roadblock.x, police.roadblock.z) < 8) {
        state.roadblockBroken = true;
        state.cash += 300;
        state.rep += 10;
        hud.popups.roadblockBreak();
        hud.ticker('POLISI: Blokade ditembus — semua unit, kejar!', 5);
      }
      props.step(dt);
      if (view.golden) view.golden.update(dt, state.time);
      // Usaha income accrues every game-hour into the pot.
      usaha.update(dt, 16 * 60 + state.time * 0.5);
      // Heat decay: 11 s with no police line of sight drops one star.
      if (state.heat > 0) {
        if (police.anyoneSees(player.x, player.z)) state.seenTimer = 0;
        else {
          state.seenTimer += dt;
          if (state.seenTimer >= 11) {
            state.heat = Math.max(0, state.heat - 1);
            state.seenTimer = 0;
          }
        }
      }
      // KEMAJUAN: recomputed every step from the live systems.
      const upgradeCount = Object.values(garage.upgrades).reduce(
        (sum, u) => sum + u.engine + u.grip + u.turbo, 0,
      );
      progress.update({
        missionsDone: missions.done ? 8 : missions.index, raceWon: race.best !== null,
        taxiTrips: taxi.trips, collected: collectibles.collected,
        usahaOwned: usaha.count, upgradeCount,
      });
      // Autosave every 20 s (a timer, not an empty block).
      state.saveTimer += dt;
      if (state.saveTimer >= 20) {
        state.saveTimer = 0;
        saveGame(snapshot());
      }
      audio.step(dt, player.speedKmh, state.heat);
      hud.prompt(promptText());
      hud.update({ state, player, city, traffic, missions, bill, collectibles, taxi, race, police, garage, usaha, progress, policeUnits, missionTarget }, dt);
    } else if (state.mode === 'garage') {
      // Garage menu open: the city idles behind it; Esc closes.
      if (actions & ACT_PAUSE) { closeGarage(); return; }
      traffic.step(dt, null);
      peds.step(dt);
      props.step(dt);
      if (view.golden) view.golden.update(dt, state.time);
      hud.update({ state, player, city, traffic, missions, bill, collectibles, taxi, race, police, garage, usaha, progress, policeUnits, missionTarget }, dt);
    } else {
      // Title / paused / over: the city idles behind the screen.
      traffic.step(dt, null);
      peds.step(dt);
      props.step(dt);
      if (view.golden) view.golden.update(dt, state.time);
      hud.update({ state, player, city, traffic, missions, bill, collectibles, taxi, race, police, garage, usaha, progress, policeUnits, missionTarget }, dt);
    }
  }

  function missionTarget() {
    if (missions.done) return loc('marina');
    return loc(missions.step().loc);
  }

  function policeUnits() {
    return police.units(player.x, player.z);
  }

  function draw() {
    player.placeCamera();
    view.render();
  }

  function audit() {
    draw();
    const info = view.renderer.info.render;
    return { ok: info.triangles < 150000, triangles: info.triangles, calls: info.calls };
  }

  return {
    state, city, view, player, traffic, peds, police, missions, bill, props,
    collectibles, taxi, race, garage, usaha, progress, drops, fx,
    hud, audio, input: inputFacade, shotKeys, npcs, parked, rng,
    step, draw, audit, addHeat, damagePlayer, applySave, missionTarget, policeUnits,
    loadSave: loadGame,
    setMode(mode) { state.mode = mode; },
    setShotInput(keys) { Object.assign(shotKeys, keys); },
    openGarage, closeGarage,
  };
}

export { STEP };
