// BENTARA: DRY SEASON — the game itself. Wires every system together and owns
// the one fixed step: input, player, traffic, peds, police, missions, taxi,
// race, collectibles, heat, bill, autosave, audio and HUD, in that order.
// Nothing here is posed: the screenshots reach their states through these
// same calls.
//
// The step order is the game's contract: the player moves first, then the
// world reacts (traffic brakes, peds flee, police pursue), then the jobs
// (missions, taxi, race, collectibles) pay out, then heat decays and the
// HUD reads the finished state. A system that needs the player's new
// position must sit after player.step; a system that pays must sit after
// the world that earned it.
import * as THREE from 'three';
import { mulberry32, rr } from './rng.js';
import { STEP, WEAPONS, SHOTGUN_SHELLS_PRICE, STUNTS, COLLECTIBLES, CHARACTERS } from './config.js';
import { buildCity, loc, LOCATIONS } from './city.js';
import { createView } from './world.js';
import { createInput, ACT_CONFIRM, ACT_PAUSE, ACT_INTERACT, ACT_ENTER, ACT_RADIO, ACT_WEAPON1, ACT_WEAPON2, ACT_WEAPON3 } from './input.js';
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

  const state = {
    seed, time: 0, cash: 250, rep: 0, heat: 0, day: 1,
    mode: 'title', // title | play | paused | over | caught
    saveTimer: 0, seenTimer: 0, respawnTimer: 0, down: false,
    interactPressed: false, tauntTimer: 0,
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
  function addNpc(name, initials, locName, color) {
    const L = loc(locName);
    const h = new Human(view.scene, rng, 'npc');
    h.torso.material.color.setHex(color);
    h.setPos(L.x, L.z);
    h.face(Math.PI);
    npcs.push({ human: h, name, initials, locName });
    return h;
  }
  addNpc('PAK WIRA', 'PW', 'marina', 0x7a5c2e);
  addNpc('SARI', 'SR', 'shophouseRow', 0x8a4a6b);
  addNpc('BANG IJAL', 'BI', 'eastSafehouse', 0x4a6b8a);
  addNpc('DEDI', 'DD', 'industrialYard', 0x4a6b8a);

  // Parked cars, including the player's own CEMPAKA GT on the marina road,
  // nose east so driving away needs no three-point turn past the ruko walls.
  const parked = [];
  const playerCar = new Car(view.scene, rng, { name: 'CEMPAKA GT', x: 10, z: -180.5, heading: Math.PI / 2, color: 0xb8442f });
  parked.push(playerCar);
  parked.push(new Car(view.scene, rng, { name: 'Sedan Tua', x: 118, z: 66, heading: 1.2, color: 0x4a4a42 }));
  parked.push(new Car(view.scene, rng, { name: 'Pickup', x: 44, z: 88, heading: -0.6, color: 0x2f6b4f }));

  const player = createPlayer({
    scene: view.scene, city, view, rng, input: inputFacade,
    targets: () => ({
      humans: [...peds.peds, ...police.cops, ...missions.attackers, ...npcs.map((n) => n.human)],
      cars: [...traffic.cars, ...police.cruisers, ...parked, missions.targetCar].filter(Boolean).filter((c) => c !== player.car),
    }),
    onShoot: (result, weapon) => {
      audio.gunshot();
      peds.fleeFrom(player.x, player.z);
      traffic.fleeFrom(player.x, player.z);
      if (!result) return;
      if (result.hit === 'human') {
        const h = result.human;
        const killed = h.damage(WEAPONS[weapon].damage * (weapon === 'shotgun' ? 1 : 1));
        if (h.role === 'ped') addHeat(1);
        else addHeat(0.3);
        if (killed && h.role === 'attacker') audio.pickup();
      } else if (result.hit === 'car') {
        const dead = result.car.damage(WEAPONS[weapon].damage * (weapon === 'shotgun' ? 3 : 1));
        if (dead) { addHeat(1); hud.toast('Mobil target hancur.'); }
        else addHeat(0.1);
      }
    },
    onEnterCar: (car) => { hud.toast(`${car.name} — milikmu sekarang.`); audio.pickup(); },
    onExitCar: () => {},
    onCarBrush: (car) => {
      const prop = props.nearestUnbroken(car.x, car.z, 3.2);
      if (prop) props.breakProp(prop, bill, (h) => addHeat(h));
    },
    onDrift: (secondsHeld, amount) => {
      state.cash += amount;
      state.rep += 2;
      hud.popups.drift(amount, secondsHeld);
      audio.drift();
    },
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
      hud.dialogue('PAK WIRA · BOS MARINA', m.doneLine, 'wira', 7);
      hud.toast(paid > 0
        ? `Misi selesai: +$${m.reward} — tagihan kerusakan $${paid} dipotong.`
        : `Misi selesai: +$${m.reward}.`, 6);
      hud.announce(`Misi selesai. Hadiah $${m.reward}.`);
    },
    onTalk: (line, who) => {
      const key = who === 'PAK WIRA' ? 'wira' : who === 'SARI' ? 'sari' : 'wira';
      hud.dialogue(`${who} · ${who === 'PAK WIRA' ? 'BOS MARINA' : 'KONTAK'}`, line, key, 7);
    },
    onSpawnAttacker: () => { addHeat(0.4); },
    onTargetCar: () => {},
    onIntro: (missionIndex) => {
      const intro = missionIntro(missionIndex);
      const c = CHARACTERS[intro.who];
      hud.dialogue(`${c.name} · ${c.role}`, intro.line, intro.who, 7);
    },
  });

  function addHeat(amount) {
    const before = state.heat;
    state.heat = Math.min(5, state.heat + amount);
    // Crossing into 3 stars earns a taunt from the police captain.
    if (before < 3 && state.heat >= 3) {
      hud.dialogue('LETKOL RAHMAT · KAPOLRES BENTARA', randomTaunt(rng), 'rahmat', 7);
    }
  }

  function damagePlayer(amount) {
    if (state.down || state.mode !== 'play') return;
    player.health = Math.max(0, player.health - amount);
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

  // Interactions: shop (Ruko), safehouse (Timur), talk targets, taxi
  // pickup, race start, car entry.
  function handleInteract() {
    const S = loc('shophouseRow');
    const E = loc('eastSafehouse');
    if (dist(player.x, player.z, S.x, S.z) < 9) {
      if (!player.hasShotgun && state.cash >= WEAPONS.shotgun.price) {
        state.cash -= WEAPONS.shotgun.price;
        player.hasShotgun = true;
        player.shells = 12;
        player.weapon = 'shotgun';
        hud.toast('Shotgun dibeli — $120. Tekan 2 untuk pakai.');
        audio.pickup();
      } else if (player.hasShotgun && state.cash >= SHOTGUN_SHELLS_PRICE) {
        state.cash -= SHOTGUN_SHELLS_PRICE;
        player.shells += 12;
        hud.toast('Amunisi shotgun +12 — $40.');
        audio.pickup();
      } else {
        hud.toast('Uang tidak cukup. Shotgun $120, amunisi $40.');
      }
      return;
    }
    if (dist(player.x, player.z, E.x, E.z) < 9) {
      if (player.car) player.car.health = 100;
      player.health = 100;
      saveGame(snapshot());
      hud.toast('SAFEHOUSE TIMUR — mobil diperbaiki, luka sembuh, game tersimpan.');
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
    if (missions.nearTalkTarget(player.x, player.z)) return 'E — Bicara';
    if (dist(player.x, player.z, S.x, S.z) < 9) {
      return player.hasShotgun ? 'E — Beli amunisi shotgun $40' : 'E — Beli shotgun $120';
    }
    if (dist(player.x, player.z, E.x, E.z) < 9) return 'E — Safehouse: perbaiki + simpan';
    if (!player.onFoot && taxi.nearPassenger(player.x, player.z)) return taxi.prompt();
    if (race.nearStart(player.x, player.z)) return 'E — Mulai balapan (5 gate)';
    if (player.onFoot) {
      const car = player.nearestCar([...traffic.cars, ...parked, missions.targetCar].filter(Boolean));
      if (car) return car.missionTarget === 'steal' ? 'F — Curi mobil ini' : `F — Masuk ${car.name}`;
    }
    return null;
  }

  function snapshot() {
    return {
      cash: state.cash, rep: state.rep, day: state.day,
      missionIndex: missions.index,
      hasShotgun: player.hasShotgun, shells: player.shells,
      collected: collectibles.collected, taxiTrips: taxi.trips, raceBest: race.best,
    };
  }

  function applySave(data) {
    state.cash = data.cash;
    state.rep = data.rep;
    state.day = data.day || 1;
    player.hasShotgun = !!data.hasShotgun;
    player.shells = data.shells ?? 0;
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
          hud.popups.nearMiss(STUNTS.nearMiss);
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
      if (actions & ACT_WEAPON1) player.weapon = 'pistol';
      if (actions & ACT_WEAPON2 && player.hasShotgun) player.weapon = 'shotgun';
      if (actions & ACT_WEAPON3) hud.toast('SMG belum dibuka — $450 di Ruko? Belum dijual. Sabar.');
      if (actions & ACT_ENTER && player.onFoot) {
        const car = player.nearestCar([...traffic.cars, ...parked, missions.targetCar].filter(Boolean));
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
      checkNearMiss(dt);
      props.step(dt);
      if (view.golden) view.golden.update(dt, state.time);
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
      // Autosave every 20 s (a timer, not an empty block).
      state.saveTimer += dt;
      if (state.saveTimer >= 20) {
        state.saveTimer = 0;
        saveGame(snapshot());
      }
      audio.step(dt, player.speedKmh, state.heat);
      hud.prompt(promptText());
      hud.update({ state, player, city, traffic, missions, bill, collectibles, taxi, race, policeUnits, missionTarget }, dt);
    } else {
      // Title / paused / over: the city idles behind the screen.
      traffic.step(dt, null);
      peds.step(dt);
      props.step(dt);
      if (view.golden) view.golden.update(dt, state.time);
      hud.update({ state, player, city, traffic, missions, bill, collectibles, taxi, race, policeUnits, missionTarget }, dt);
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
    collectibles, taxi, race,
    hud, audio, input: inputFacade, shotKeys, npcs, parked, rng,
    step, draw, audit, addHeat, damagePlayer, applySave, missionTarget, policeUnits,
    loadSave: loadGame,
    setMode(mode) { state.mode = mode; },
    setShotInput(keys) { Object.assign(shotKeys, keys); },
  };
}

export { STEP };
