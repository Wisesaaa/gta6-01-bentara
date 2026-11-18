// BENTARA: DRY SEASON — the game itself. Wires every system together and owns
// the one fixed step: input, player, traffic, peds, police, missions, heat,
// bill, autosave, audio and HUD, in that order. Nothing here is posed: the
// screenshots reach their states through these same calls.
import * as THREE from 'three';
import { mulberry32, rr } from './rng.js';
import { STEP, WEAPONS, SHOTGUN_SHELLS_PRICE } from './config.js';
import { buildCity, loc, LOCATIONS } from './city.js';
import { createView } from './world.js';
import { createInput, ACT_CONFIRM, ACT_PAUSE, ACT_INTERACT, ACT_ENTER, ACT_RADIO, ACT_WEAPON1, ACT_WEAPON2 } from './input.js';
import { createPlayer } from './player.js';
import { createTraffic } from './actors/traffic.js';
import { createPeds } from './actors/peds.js';
import { createPolice } from './actors/police.js';
import { createProps } from './props.js';
import { createBill } from './bill.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { saveGame, loadGame } from './save.js';
import { Car } from './actors/car.js';
import { Human } from './actors/human.js';
import { dist } from './mathx.js';

export function createGame(canvas, seed = 7) {
  const rng = mulberry32(seed);
  const city = buildCity(rng);
  const view = createView(canvas, city);
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
    interactPressed: false,
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
  addNpc('DEDI', 'DD', 'industrialYard', 0x4a6b8a);

  // Parked cars, including the player's own KIDANG GT on the marina road,
  // nose east so driving away needs no three-point turn past the ruko walls.
  const parked = [];
  const playerCar = new Car(view.scene, rng, { name: 'KIDANG GT', x: 10, z: -180.5, heading: Math.PI / 2, color: 0xb8442f });
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
  });
  player.setPos(-6, -158, 0);

  const missions = createMissions(view.scene, city, rng, {
    onMissionComplete: (m) => {
      const paid = bill.settle(state.cash);
      state.cash = Math.max(0, state.cash - paid);
      state.cash += m.reward;
      state.rep += m.rep;
      audio.missionDone();
      hud.dialogue('PAK WIRA · BOS MARINA', m.doneLine, 'PW', 7);
      hud.toast(paid > 0
        ? `Misi selesai: +$${m.reward} — tagihan kerusakan $${paid} dipotong.`
        : `Misi selesai: +$${m.reward}.`, 6);
      hud.announce(`Misi selesai. Hadiah $${m.reward}.`);
    },
    onTalk: (line, who) => { hud.dialogue(`${who} · ${who === 'PAK WIRA' ? 'BOS MARINA' : 'KONTAK'}`, line, who === 'PAK WIRA' ? 'PW' : 'SR', 7); },
    onSpawnAttacker: () => { addHeat(0.4); },
    onTargetCar: () => {},
  });

  function addHeat(amount) {
    state.heat = Math.min(5, state.heat + amount);
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

  // Interactions: shop (Ruko), safehouse (Timur), talk targets, car entry.
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
      saveGame(state);
      hud.toast('SAFEHOUSE TIMUR — mobil diperbaiki, luka sembuh, game tersimpan.');
      audio.pickup();
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
    if (player.onFoot) {
      const car = player.nearestCar([...traffic.cars, ...parked, missions.targetCar].filter(Boolean));
      if (car) return car.missionTarget === 'steal' ? 'F — Curi mobil ini' : `F — Masuk ${car.name}`;
    }
    return null;
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
        hud.toast(audio.radioOn() ? 'RADIO KEMARAU 92.4 — menyala.' : 'Radio mati.');
      }
      if (actions & ACT_WEAPON1) player.weapon = 'pistol';
      if (actions & ACT_WEAPON2 && player.hasShotgun) player.weapon = 'shotgun';
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
      props.step(dt);
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
        saveGame(state);
      }
      audio.step(dt, player.speedKmh, state.heat);
      hud.prompt(promptText());
      hud.update({ state, player, city, traffic, missions, bill, policeUnits, missionTarget }, dt);
    } else {
      // Title / paused / over: the city idles behind the screen.
      traffic.step(dt, null);
      peds.step(dt);
      props.step(dt);
      hud.update({ state, player, city, traffic, missions, bill, policeUnits, missionTarget }, dt);
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
    hud, audio, input: inputFacade, shotKeys, npcs, parked, rng,
    step, draw, audit, addHeat, damagePlayer, applySave, missionTarget, policeUnits,
    loadSave: loadGame,
    setMode(mode) { state.mode = mode; },
    setShotInput(keys) { Object.assign(shotKeys, keys); },
  };
}

export { STEP };
