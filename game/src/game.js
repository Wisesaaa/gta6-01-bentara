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
import { createInput, ACT_CONFIRM, ACT_PAUSE, ACT_INTERACT, ACT_ENTER, ACT_RADIO, ACT_WEAPON1, ACT_WEAPON2, ACT_WEAPON3, ACT_WEAPON4, ACT_WEAPON5, ACT_RELOAD, ACT_BRIBE, ACT_SLEEP } from './input.js';
import { createPlayer } from './player.js';
import { createTraffic } from './actors/traffic.js';
import { createPeds } from './actors/peds.js';
import { createPolice } from './actors/police.js';
import { createProps } from './props.js';
import { createBill } from './bill.js';
import { createMissions } from './missions.js';
import { createCollectibles } from './collectibles.js';
import { createTaxi } from './taxi.js';
import { createOjek, formatRp } from './ojek.js';
import { createRace } from './race.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { saveGame, loadGame } from './save.js';
import { Car } from './actors/car.js';
import { Human } from './actors/human.js';
import { dist } from './mathx.js';
import { missionIntro, randomTaunt } from './dialogue.js';
import { Garage, discountedPrice } from './garage.js';
import { Usaha } from './usaha.js';
import { createEffects } from './effects.js';
import { createGpsRoute } from './gpsRoute.js';
import { applyLitBody } from './litPass.js';
import { actForMission, repLevel, hasUnlock } from './progress.js';

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
    interactPressed: false, tauntTimer: 0, shopOpen: false, esTehTimer: 0,
  };
  // The lighting grade follows the act; 1 until the first mission starts.
  let currentAct = 1;

  // Game-feel hit-stop (game-feel skill): a real-time freeze owned by the
  // newest call only — overlapping hits never let an old timer restore
  // time mid-freeze. timeScale() is read by the main loop's fixed step;
  // the trauma decay in the view uses real time for the same reason.
  let hitStopId = 0;
  let hitStopUntil = 0;
  function hitStop(seconds) {
    hitStopId += 1;
    const myId = hitStopId;
    hitStopUntil = performance.now() + seconds * 1000;
    setTimeout(() => { if (myId === hitStopId) hitStopUntil = 0; }, seconds * 1000);
  }
  function timeScale() {
    return hitStopUntil && performance.now() < hitStopUntil ? 0.05 : 1;
  }
  // One feedback bundle per event (game-feel tiers in effects.js): the
  // particles spawn here, the trauma goes to the camera, the hit-stop to
  // the loop. Small = pickup, medium = hit, large = kill / mission done.
  function fireFeedback(tier, x, z) {
    const fb = effects.feedback(tier, x, z);
    view.addTrauma(fb.trauma);
    if (fb.hitStop > 0) hitStop(fb.hitStop);
  }

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
  // PAK ASKA, the marina receiver, stands beside Pak Wira at the pier —
  // he takes the handoff in the story shot and in Mission 8.
  const aska = addNpc('PAK ASKA', 'PA', 'marina', 0x1f6b74);
  aska.setPos(-2, -166);
  addNpc('SARI', 'SR', 'shophouseRow', 0x8a4a6b);
  addNpc('BANG IJAL', 'BI', 'eastSafehouse', 0x4a6b8a);
  addNpc('DEDI', 'DD', 'industrialYard', 0x4a6b8a);

  // Parked cars, including the player's own CEMPAKA GT on the marina road,
  // nose east so driving away needs no three-point turn past the ruko walls.
  const parked = [];
  const playerCar = new Car(view.scene, rng, { name: 'CEMPAKA GT', kind: 'sport', x: 10, z: -180.5, heading: Math.PI / 2, color: 0xb8442f });
  // Custom lit pass on the hero car only (litPass.js): sun-warmed
  // Lambert + warm Fresnel rim, so the red body reads as lit, not flat.
  applyLitBody(playerCar);
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
        // A downed cop or attacker drops loot: cash, sometimes ammo.
        if (killed && (h.role === 'cop' || h.role === 'attacker')) {
          audio.pickup();
          effects.dropCash(h.x, h.z, 20 + Math.floor(rng() * 40));
          if (rng() < 0.5) effects.dropAmmo(h.x + 1, h.z, 'shells', 6);
        }
      } else if (result.hit === 'car') {
        const dead = result.car.damage(WEAPONS[weapon].damage * (weapon === 'shotgun' ? 3 : 1));
        if (dead) {
          addHeat(1);
          hud.toast('Mobil target hancur.');
          effects.dropCash(result.car.x, result.car.z, 30 + Math.floor(rng() * 50));
          effects.dropAmmo(result.car.x + 1, result.car.z, 'smg', 30);
        } else addHeat(0.1);
      }
      // Juice on the shot itself: a kill is a large bundle (shake +
      // hit-stop + burst), a plain hit medium, a miss just the small
      // muzzle kick. The frame shows the burst, not a static pose.
      if (result) {
        // A building hit ('solid') has no human/car — the impact point
        // is the feedback position for every hit type.
        const t = result.human || result.car || result.at;
        const big = (result.hit === 'human' && result.human.health <= 0)
          || (result.hit === 'car' && result.car.health <= 0);
        fireFeedback(big ? 'large' : 'medium', t.x, t.z);
      } else {
        fireFeedback('small', player.x, player.z);
      }
    },
    onEnterCar: (car) => {
      hud.toast(`${car.name} — milikmu sekarang.`);
      audio.pickup();
      // Steal-unlock: a cruiser becomes the PANTHERA, the mission target
      // car becomes the gang PREMAN — registered when the player gets
      // OUT, so the car is never teleported away mid-mission.
      if (car.isCop && police.cruisers.includes(car)) {
        police.stealCruiser(car);
        car.stolenFor = 'panthera';
        hud.toast('Cruiser polisi dicuri — bawa pulang ke garasi untuk jadi milikmu.');
      } else if (car.missionTarget === 'steal') {
        car.stolenFor = 'preman';
        hud.toast('Mobil curian — antar ke tujuan, lalu bawa pulang ke garasi.');
      }
    },
    onExitCar: (car) => {
      if (car.stolenFor) {
        const id = car.stolenFor;
        car.stolenFor = null;
        garage.unlockSteal(id, car);
      }
    },
    onCarBrush: (car) => {
      const prop = props.nearestUnbroken(car.x, car.z, 3.2);
      if (prop) props.breakProp(prop, bill, (h) => addHeat(h));
    },
    onDrift: (secondsHeld, amount) => {
      state.cash += amount;
      state.rep += 2;
      hud.popups.drift(amount, secondsHeld);
      hud.xpTick(2, 'DRIFT');
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
      // A tape's popup names the real track it carries — the collectible
      // is a physical copy of a song the radio plays.
      hud.popups.collect(value, item.kind, 2.6, item.track);
      audio.collect();
      fireFeedback('small', player.x, player.z);
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
  // Ojek penumpang: motor datang ke pemain, penumpang berhelm membonceng,
  // argo Rp dibayar sebagai $ game (Rp 50 = $1, setara argo taksi).
  const ojek = createOjek(view.scene, city, rng, {
    onCalled: (p, dest, fare) => {
      hud.toast(`Ojek dipesan — motor meluncur. Tujuan ${dest.label}, argo ${formatRp(fare)}.`, 4);
    },
    onArrived: (p) => { hud.toast(`Ojek sampai — ${p.name} jalan ke motor.`); audio.taxiDing(); },
    onBoarded: (p, dest) => {
      hud.toast(`${p.name} naik — antar ke ${dest.label}. Tanpa goresan = TIP ×2.`);
    },
    onFarePaid: (done) => {
      const paid = Math.max(30, Math.round(done.paid / 50));
      state.cash += paid;
      state.rep += 10;
      hud.popups.fare(paid, done.name);
      hud.toast(`Ojek selesai: +$${paid} (${done.distance} m${done.tip ? ', TIP ×2' : ', tanpa tip — ada goresan'}).`);
      audio.missionDone();
    },
    onScratched: () => { hud.toast('Goresan! Tip ojek hilang — argo tetap dibayar saat sampai.', 4); },
    onCancelled: () => { hud.toast('Ojek dibatalkan.'); },
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

  // Depth systems: world effects (skids, smoke, sparks, cop drops), the
  // garage economy and the property economy.
  const effects = createEffects(view.scene, rng);
  // Live GPS route (gpsRoute.js): in-world gold chevron ribbon + pulsing
  // ring on the objective. Rebuilt only when the player moved 3 m+ or
  // the objective changed — the strip rebuild is cheap, not every-frame.
  const gpsRoute = createGpsRoute(view.scene);
  let lastGpsKey = '';
  let lastGpsFrom = null;
  const garage = new Garage({ state, scene: view.scene, rng, parked, hud, audio, player });
  const usaha = new Usaha({ state, hud, audio });

  const missions = createMissions(view.scene, city, rng, {
    onMissionComplete: (m) => {
      const paid = bill.settle(state.cash);
      state.cash = Math.max(0, state.cash - paid);
      state.cash += m.reward;
      state.rep += m.rep;
      audio.missionDone();
      // Mission done is the biggest juice moment in the game: large
      // bundle + big stamp + ledger, all from the same event.
      fireFeedback('large', player.x, player.z);
      // End-of-mission ledger card + a BIG centre stamp, both from the
      // real numbers: reward, bill paid, net, REP.
      hud.ledger({
        title: m.title,
        hasil: m.reward,
        tagihan: paid,
        bersih: m.reward - paid,
        rep: m.rep,
      });
      hud.popups.big(`MISI SELESAI +$${m.reward.toLocaleString('en-US')}`, m.title);
      hud.dialogue('PAK WIRA · BOS MARINA', m.doneLine, 'wira', 7);
      hud.toast(paid > 0
        ? `Misi selesai: +$${m.reward} — tagihan kerusakan $${paid} dipotong.`
        : `Misi selesai: +$${m.reward}.`, 6);
      hud.announce(`Misi selesai. Hadiah $${m.reward}.`);
    },
    onTalk: (line, who) => {
      // "PAK ASKA" -> 'aska', "LETKOL RAHMAT" -> 'rahmat', "PAK WIRA" ->
      // 'wira', "BANG IJAL" -> 'ijal', "SARI" -> 'sari'. The role chip
      // comes from the character table.
      const key = String(who).split(' ').pop().toLowerCase();
      const c = CHARACTERS[key];
      hud.dialogue(`${who} · ${c ? c.role : 'KONTAK'}`, line, c ? key : 'wira', 7);
    },
    onSpawnAttacker: () => { addHeat(0.4); },
    onAttackerShoot: (a) => { attackerShoot(a); },
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

  // An attacker fires back: a real tracer from the attacker's gun toward
  // the player (combat.shoot handles the wall test), and a hit only lands
  // on a clear line inside 40 m — the firefight reads, and it is fair.
  function attackerShoot(a) {
    const origin = new THREE.Vector3(a.x, 1.4, a.z);
    const dir = new THREE.Vector3(
      player.x + rr(rng, -1.5, 1.5) - a.x,
      1.2 - 1.4,
      player.z + rr(rng, -1.5, 1.5) - a.z,
    ).normalize();
    const result = player.combat.shoot(origin, dir, 'pistol', { humans: [], cars: [] });
    const d = dist(a.x, a.z, player.x, player.z);
    if (!result && d < 40 && rng() < 0.35) damagePlayer(rr(rng, 3, 6));
  }

  function damagePlayer(amount) {
    if (state.down || state.mode !== 'play') return;
    // Armor absorbs damage first, 1:1, until it is gone.
    if (player.armor > 0) {
      const absorbed = Math.min(player.armor, amount);
      player.armor -= absorbed;
      amount -= absorbed;
      if (amount <= 0) return;
    }
    player.health = Math.max(0, player.health - amount);
    // Being hit shakes the camera — medium tier, so a cop's shot reads.
    fireFeedback('medium', player.x, player.z);
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

  // Interactions: talk targets FIRST (a mission talk must never lose to
  // a shop behind it), then garage, properties, weapon shop, safehouse,
  // taxi pickup, race start. The M1 rule lives here: E at the marina
  // talks to Pak Wira — it never buys SLIP MARINA before the talk runs.
  // (missions.update consumes the talk on the same press.)
  function handleInteract() {
    if (missions.nearTalkTarget(player.x, player.z)) return;
    // Taxi first (after talk): the passenger is time-sensitive (maxWait)
    // and the pickup needs the player in a car, so it never steals an
    // on-foot E press from the garage or a property — but a player in a
    // car near a property AND a waiting passenger picks the passenger
    // up instead of accidentally buying the property.
    if (!player.onFoot && taxi.nearPassenger(player.x, player.z)) {
      if (taxi.startFare(player.x, player.z)) return;
    }
    // Ojek: on foot only, and only when no shop/property is in range —
    // E in open space calls a bike; E at a stall still buys the stall.
    if (player.onFoot && ojek.state === 'idle') {
      const S = loc('shophouseRow');
      const G = loc('industrialYard');
      const N = loc('northRowStall');
      const T = loc('towerConcourse');
      const M = loc('marina');
      const E = loc('eastSafehouse');
      const nearAny = dist(player.x, player.z, G.x, G.z) < 10
        || dist(player.x, player.z, N.x, N.z) < 9
        || dist(player.x, player.z, T.x, T.z) < 6
        || dist(player.x, player.z, M.x, M.z) < 9
        || dist(player.x, player.z, S.x, S.z) < 9
        || dist(player.x, player.z, E.x, E.z) < 9
        || race.nearStart(player.x, player.z);
      if (!nearAny && ojek.callOjek(player.x, player.z)) return;
    }
    const S = loc('shophouseRow');
    const E = loc('eastSafehouse');
    const G = loc('industrialYard'); // Bengkel Roda Jaya
    const N = loc('northRowStall'); // Warung Sari
    const T = loc('towerConcourse'); // Kios Kaki Lima
    const M = loc('marina'); // Slip Marina
    // Es teh di blok pasar: $5, tahan panas 60 detik (heat turun 2x
    // lebih cepat). Stall-nya di (50,102) — di luar radius warung (9 m),
    // jadi tidak pernah berebut E dengan Warung Sari.
    if (dist(player.x, player.z, 50, 102) < 3.5) {
      if (state.cash < 5) { hud.toast('Es teh $5 — uang tidak cukup.', 4); return; }
      state.cash -= 5;
      state.esTehTimer = 60;
      hud.toast('ES TEH — tahan panas 60 detik, polisi lebih lambat melihatmu.', 4);
      audio.pickup();
      return;
    }
    if (dist(player.x, player.z, G.x, G.z) < 10) {
      state.shopOpen = true;
      hud.showGarage(garage, state, () => { state.shopOpen = false; });
      return;
    }
    if (dist(player.x, player.z, N.x, N.z) < 9) {
      if (usaha.isOwned('warung')) {
        state.shopOpen = true;
        hud.showUsaha(usaha, state, () => { state.shopOpen = false; });
      } else {
        const r = usaha.buy('warung');
        if (!r.ok) hud.toast(r.reason, 4);
      }
      return;
    }
    // Kios Kaki Lima is a small stall: a 6 m radius, not 9. The race
    // starts at the same plaza (towerConcourse, 10 m radius), so a 9 m
    // property radius swallowed the race start whole — E at the plaza
    // bought a $9.500 stall instead of starting the race. With 6 m the
    // plaza has a clear ring: <6 m buys the stall, 6–10 m starts the race.
    if (dist(player.x, player.z, T.x, T.z) < 6) {
      if (usaha.isOwned('kakiLima')) {
        state.shopOpen = true;
        hud.showUsaha(usaha, state, () => { state.shopOpen = false; });
      } else {
        const r = usaha.buy('kakiLima');
        if (!r.ok) hud.toast(r.reason, 4);
      }
      return;
    }
    if (dist(player.x, player.z, M.x, M.z) < 9) {
      if (usaha.isOwned('slip')) {
        state.shopOpen = true;
        hud.showUsaha(usaha, state, () => { state.shopOpen = false; });
      } else {
        const r = usaha.buy('slip');
        if (!r.ok) hud.toast(r.reason, 4);
      }
      return;
    }
    if (dist(player.x, player.z, S.x, S.z) < 9) {
      state.shopOpen = true;
      hud.showWeaponShop(weaponShop, state, () => { state.shopOpen = false; });
      return;
    }
    if (dist(player.x, player.z, E.x, E.z) < 9) {
      if (player.car) player.car.health = 100;
      player.health = 100;
      if (player.car) player.car.fuel = 100;
      saveGame(snapshot());
      hud.toast('SAFEHOUSE TIMUR — mobil diperbaiki, bensin penuh, luka sembuh, game tersimpan.');
      audio.pickup();
    }
    if (race.nearStart(player.x, player.z)) {
      if (race.startRace()) return;
    }
  }

  // Weapon shop (Deret Ruko): the full rack, ammo packs and armor. All
  // prices honour the REP 4 discount; bedil needs REP 3, pelontar REP 4.
  const weaponShop = {
    title: 'TOKO SENJATA — DERET RUKO',
    sub: () => 'Diskon 20% di REP 4 (LEGENDA BENTARA) · Q isi ulang magasin · 1–5 ganti senjata',
    catalog() {
      const rep = state.rep;
      const rows = [];
      const guns = [
        { id: 'shotgun', name: 'Shotgun', sub: '5 peluru sekali tembak, dekat mematikan', price: WEAPONS.shotgun.price, owned: player.hasShotgun, ammo: { id: 'ammo-shotgun', label: 'Amunisi Shotgun +12', price: SHOTGUN_SHELLS_PRICE } },
        { id: 'smg', name: 'SMG', sub: 'Otomatis, 30 peluru per magasin', price: WEAPONS.smg.price, owned: player.hasSmg, ammo: { id: 'ammo-smg', label: 'Amunisi SMG +60', price: 60 } },
        { id: 'bedil', name: 'Bedil', sub: 'Laras panjang, jangkauan 80 m', price: WEAPONS.bedil.price, owned: player.hasBedil, repNeeded: 3, ammo: { id: 'ammo-bedil', label: 'Amunisi Bedil +10', price: 100 } },
        { id: 'pelontar', name: 'Pelontar', sub: 'Satu tembakan, satu mobil', price: WEAPONS.pelontar.price, owned: player.hasPelontar, repNeeded: 4, ammo: { id: 'ammo-pelontar', label: 'Amunisi Pelontar +2', price: 150 } },
      ];
      for (const g of guns) {
        const lockedByRep = g.repNeeded && repLevel(rep) < g.repNeeded;
        rows.push({
          id: g.id, name: g.name, sub: g.sub,
          price: discountedPrice(g.price, rep), owned: g.owned,
          disabled: lockedByRep, disabledReason: lockedByRep ? `REP ${g.repNeeded}` : null,
        });
        if (g.owned) {
          rows.push({
            id: g.ammo.id, name: g.ammo.label, sub: 'Stok cadangan',
            price: discountedPrice(g.ammo.price, rep), owned: false,
          });
        }
      }
      rows.push({
        id: 'armor', name: 'Armor +50', sub: `Pelindung badan (sekarang ${Math.round(player.armor)}/100)`,
        price: discountedPrice(200, rep), owned: player.armor >= 100,
      });
      return rows;
    },
    buy(id) {
      const price = (n) => discountedPrice(n, state.rep);
      const pay = (n) => {
        if (state.cash < n) return { ok: false, reason: `Uang tidak cukup — $${n.toLocaleString('en-US')}, kamu punya $${Math.round(state.cash).toLocaleString('en-US')}.` };
        state.cash -= n;
        return { ok: true };
      };
      const done = (msg) => { audio.pickup(); hud.toast(msg, 4); return { ok: true }; };
      switch (id) {
        case 'shotgun': {
          if (player.hasShotgun) return { ok: false, reason: 'Shotgun sudah dibeli.' };
          const r = pay(price(WEAPONS.shotgun.price)); if (!r.ok) return r;
          player.hasShotgun = true; player.shells += 12; player.shellMag = WEAPONS.shotgun.magSize; player.weapon = 'shotgun';
          return done('Shotgun dibeli — $120 + 12 peluru. Tekan 2 untuk pakai.');
        }
        case 'smg': {
          if (player.hasSmg) return { ok: false, reason: 'SMG sudah dibeli.' };
          const r = pay(price(WEAPONS.smg.price)); if (!r.ok) return r;
          player.hasSmg = true; player.smgAmmo += 60; player.smgMag = WEAPONS.smg.magSize; player.weapon = 'smg';
          return done('SMG dibeli — $450 + 60 peluru. Tekan 3 untuk pakai.');
        }
        case 'bedil': {
          if (repLevel(state.rep) < 3) return { ok: false, reason: 'Bedil butuh REP 3 (RAJA JALANAN).' };
          if (player.hasBedil) return { ok: false, reason: 'Bedil sudah dibeli.' };
          const r = pay(price(WEAPONS.bedil.price)); if (!r.ok) return r;
          player.hasBedil = true; player.bedilAmmo += 10; player.bedilMag = WEAPONS.bedil.magSize; player.weapon = 'bedil';
          return done('Bedil dibeli — $900 + 10 peluru. Tekan 4 untuk pakai.');
        }
        case 'pelontar': {
          if (repLevel(state.rep) < 4) return { ok: false, reason: 'Pelontar butuh REP 4 (LEGENDA BENTARA).' };
          if (player.hasPelontar) return { ok: false, reason: 'Pelontar sudah dibeli.' };
          const r = pay(price(WEAPONS.pelontar.price)); if (!r.ok) return r;
          player.hasPelontar = true; player.pelontarAmmo += 2; player.pelontarMag = WEAPONS.pelontar.magSize; player.weapon = 'pelontar';
          return done('Pelontar dibeli — $1.800 + 2 peluru. Tekan 5 untuk pakai.');
        }
        case 'ammo-shotgun': {
          const r = pay(price(SHOTGUN_SHELLS_PRICE)); if (!r.ok) return r;
          player.shells += 12; return done('Amunisi shotgun +12.');
        }
        case 'ammo-smg': {
          const r = pay(price(60)); if (!r.ok) return r;
          player.smgAmmo += 60; return done('Amunisi SMG +60.');
        }
        case 'ammo-bedil': {
          const r = pay(price(100)); if (!r.ok) return r;
          player.bedilAmmo += 10; return done('Amunisi bedil +10.');
        }
        case 'ammo-pelontar': {
          const r = pay(price(150)); if (!r.ok) return r;
          player.pelontarAmmo += 2; return done('Amunisi pelontar +2.');
        }
        case 'armor': {
          if (player.armor >= 100) return { ok: false, reason: 'Armor sudah penuh.' };
          const r = pay(price(200)); if (!r.ok) return r;
          player.armor = Math.min(100, player.armor + 50);
          return done('Armor +50.');
        }
        default: return { ok: false, reason: 'Barang tidak dikenal.' };
      }
    },
  };

  function promptText() {
    const S = loc('shophouseRow');
    const E = loc('eastSafehouse');
    const G = loc('industrialYard');
    const N = loc('northRowStall');
    const T = loc('towerConcourse');
    const M = loc('marina');
    if (missions.nearTalkTarget(player.x, player.z)) return 'E — Bicara';
    if (!player.onFoot && taxi.nearPassenger(player.x, player.z)) return taxi.prompt();
    if (dist(player.x, player.z, G.x, G.z) < 10) return 'E — Bengkel Roda Jaya: beli / upgrade mobil';
    if (dist(player.x, player.z, N.x, N.z) < 9) {
      return usaha.isOwned('warung') ? 'E — Warung Sari (milikmu)' : `E — Beli WARUNG SARI $${usaha.priceFor('warung').toLocaleString('en-US')} (+$30/hari)`;
    }
    if (dist(player.x, player.z, T.x, T.z) < 6) {
      return usaha.isOwned('kakiLima') ? 'E — Kios Kaki Lima (milikmu)' : `E — Beli KIOS KAKI LIMA $${usaha.priceFor('kakiLima').toLocaleString('en-US')} (+$80/hari)`;
    }
    if (dist(player.x, player.z, M.x, M.z) < 9) {
      return usaha.isOwned('slip') ? 'E — Slip Marina (milikmu)' : `E — Beli SLIP MARINA $${usaha.priceFor('slip').toLocaleString('en-US')} (+$180/hari)`;
    }
    if (dist(player.x, player.z, S.x, S.z) < 9) return 'E — Toko Senjata Ruko';
    if (dist(player.x, player.z, E.x, E.z) < 9) return `E — Safehouse: perbaiki + simpan · T — Tidur (usaha +$${Math.round(usaha.pot).toLocaleString('en-US')})`;
    if (race.nearStart(player.x, player.z)) return 'E — Mulai balapan (5 gate)';
    if (dist(player.x, player.z, 50, 102) < 3.5) return 'E — Beli ES TEH $5 (tahan panas)';
    if (ojek.state !== 'idle') return ojek.prompt();
    if (player.onFoot) {
      const car = player.nearestCar([...traffic.cars, ...parked, missions.targetCar].filter(Boolean));
      if (car) return car.missionTarget === 'steal' ? 'F — Curi mobil ini' : `F — Masuk ${car.name}`;
      return ojek.prompt();
    }
    return null;
  }

  function snapshot() {
    return {
      cash: state.cash, rep: state.rep, day: state.day,
      missionIndex: missions.index,
      hasShotgun: player.hasShotgun, shells: player.shells,
      hasSmg: player.hasSmg, smgAmmo: player.smgAmmo,
      hasBedil: player.hasBedil, bedilAmmo: player.bedilAmmo,
      hasPelontar: player.hasPelontar, pelontarAmmo: player.pelontarAmmo,
      armor: player.armor,
      collected: collectibles.collected, taxiTrips: taxi.trips, raceBest: race.best, raceRecords: race.records,
      garage: garage.serialize(), usaha: usaha.serialize(),
    };
  }

  function applySave(data) {
    state.cash = data.cash;
    state.rep = data.rep;
    state.day = data.day || 1;
    player.hasShotgun = !!data.hasShotgun;
    player.shells = data.shells ?? 0;
    player.shellMag = WEAPONS.shotgun.magSize;
    player.hasSmg = !!data.hasSmg;
    player.smgAmmo = data.smgAmmo ?? 0;
    player.smgMag = player.hasSmg ? WEAPONS.smg.magSize : 0;
    player.hasBedil = !!data.hasBedil;
    player.bedilAmmo = data.bedilAmmo ?? 0;
    player.bedilMag = player.hasBedil ? WEAPONS.bedil.magSize : 0;
    player.hasPelontar = !!data.hasPelontar;
    player.pelontarAmmo = data.pelontarAmmo ?? 0;
    player.pelontarMag = player.hasPelontar ? WEAPONS.pelontar.magSize : 0;
    player.armor = data.armor ?? 0;
    if (player.hasShotgun) player.weapon = 'shotgun';
    else if (player.hasSmg) player.weapon = 'smg';
    // Race standings: restore the top-3 lap times (old saves carry only
    // raceBest, which becomes a one-row table).
    if (data.raceRecords) race.setRecords(data.raceRecords);
    else if (typeof data.raceBest === 'number') race.setRecords([data.raceBest]);
    if (data.garage) garage.restore(data.garage);
    if (data.usaha) usaha.restore(data.usaha);
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
          hud.xpTick(3, 'NEAR MISS');
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
      // Weapon slots 1–5; a locked slot explains itself instead of
      // silently doing nothing.
      if (actions & ACT_WEAPON1) player.weapon = 'pistol';
      if (actions & ACT_WEAPON2) {
        if (player.hasShotgun) player.weapon = 'shotgun';
        else hud.toast('Shotgun belum dibeli — $120 di Deret Ruko.');
      }
      if (actions & ACT_WEAPON3) {
        if (player.hasSmg) player.weapon = 'smg';
        else hud.toast('SMG belum dibeli — $450 di Deret Ruko.');
      }
      if (actions & ACT_WEAPON4) {
        if (player.hasBedil) player.weapon = 'bedil';
        else hud.toast('Bedil butuh REP 3 — $900 di Deret Ruko.');
      }
      if (actions & ACT_WEAPON5) {
        if (player.hasPelontar) player.weapon = 'pelontar';
        else hud.toast('Pelontar butuh REP 4 — $1.800 di Deret Ruko.');
      }
      if (actions & ACT_RELOAD) {
        if (!player.reload()) hud.toast('Magasin penuh atau tidak ada cadangan — beli amunisi di Deret Ruko.');
        else hud.toast('Isi ulang.');
      }
      // Bribe (B): $250 per star, REP 3+. Clears the whole heat.
      if (actions & ACT_BRIBE) {
        const stars = Math.ceil(state.heat);
        if (state.heat <= 0) hud.toast('Tidak ada polisi yang mengejarmu.');
        else if (!hasUnlock(state.rep, 'bribe')) hud.toast('Sogok polisi butuh REP 3 (RAJA JALANAN).');
        else if (state.cash < 250 * stars) hud.toast(`Sogok butuh $${250 * stars} — kamu punya $${Math.round(state.cash)}.`);
        else {
          state.cash -= 250 * stars;
          state.heat = 0;
          hud.toast(`Polisi disogok $${250 * stars} — heat bersih.`);
          audio.pickup();
        }
      }
      // Sleep (T) at the safehouse: usaha income lands, next day, heal.
      if (actions & ACT_SLEEP) {
        const E = loc('eastSafehouse');
        if (dist(player.x, player.z, E.x, E.z) < 9) {
          const slept = usaha.sleep();
          player.health = 100;
          if (player.car) { player.car.health = 100; player.car.fuel = 100; }
          saveGame(snapshot());
          hud.toast(slept.collected > 0
            ? `TIDUR — akumulasi +$${slept.collected.toLocaleString('en-US')} · hari ${slept.day}.`
            : `TIDUR — hari ${slept.day}. Belum ada usaha yang setor.`, 5);
        } else hud.toast('Tidur cuma bisa di Safehouse Timur.');
      }
      if (actions & ACT_ENTER && player.onFoot) {
        const car = player.nearestCar([...traffic.cars, ...parked, missions.targetCar].filter(Boolean));
        if (car) player.enterCar(car);
      } else if (actions & ACT_ENTER && !player.onFoot) {
        player.exitCar();
      }
      if (state.interactPressed) {
        // E closes an open shop panel; otherwise it interacts.
        if (state.shopOpen) { hud.closeShop(); state.shopOpen = false; }
        else handleInteract();
      }
      state.time += dt;
      // The player freezes while a shop panel is open; the world does not.
      if (!state.down && !state.shopOpen) player.step(dt);
      traffic.step(dt, player.car);
      peds.step(dt);
      police.step(dt, {
        px: player.x, pz: player.z, heading: player.heading,
        playerInCar: !player.onFoot, playerCar: player.car,
        heat: state.heat, t: state.time, damagePlayer, onCopShot: () => {},
        onDispatch: (text) => hud.ticker(text),
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
      ojek.update(dt, {
        px: player.x, pz: player.z,
        playerCarHealth: player.car ? player.car.health : null,
        scratched: player.car ? player.car.scraped : false,
      });
      race.update(dt, { px: player.x, pz: player.z });
      collectibles.update(dt, state.time, player.x, player.z);
      usaha.update(dt);
      checkNearMiss(dt);
      props.step(dt);
      effects.update(dt, state.time);
      // Drift trails + scrape sparks, from the real car state.
      if (player.car && !player.onFoot) {
        if (player.drifting) {
          effects.skidPair(player.x, player.z, player.heading, dt);
          effects.smoke(player.x - Math.sin(player.heading) * 1.6, player.z - Math.cos(player.heading) * 1.6);
        }
        if (player.car.scraped) effects.sparks(player.x, player.z);
      }
      // Walk over a drop to take it.
      for (const d of effects.collectDrops(player.x, player.z)) {
        if (d.kind === 'cash') {
          state.cash += d.amount;
          state.rep += 1;
          hud.popups.pulse(d.amount);
        } else if (d.kind === 'shells') { player.shells += d.amount; hud.toast(`Amunisi shotgun +${d.amount}.`); }
        else if (d.kind === 'smg') { player.smgAmmo += d.amount; hud.toast(`Amunisi SMG +${d.amount}.`); }
        else if (d.kind === 'bedil') { player.bedilAmmo += d.amount; hud.toast(`Amunisi bedil +${d.amount}.`); }
        else if (d.kind === 'pelontar') { player.pelontarAmmo += d.amount; hud.toast(`Amunisi pelontar +${d.amount}.`); }
      }
      // Act grade: snap the lighting preset when the act changes, and
      // switch the headlight cones on for Act 3 dusk.
      const act = actForMission(missions.done ? 7 : missions.index);
      if (act !== currentAct) {
        currentAct = act;
        if (view.golden) view.golden.applyAct(act);
        const lightsOn = act === 3;
        for (const c of [...traffic.cars, ...parked, ...police.cruisers]) c.setHeadlights(lightsOn);
        if (police.roadblock) police.roadblock.setHeadlights(lightsOn);
        if (act === 3) hud.toast('Angin mendorong dinding asap melintasi jalan tol — hati-hati.', 5);
      }
      // Smoke wall: in Act 3 the wind pushes a smoke wall across the
      // z=111 arterial; the rest of the time the sky stays clear.
      if (effects.setSmokeWall) effects.setSmokeWall(act === 3);
      // Es teh buff ticks down; while it lasts, heat decays twice as fast.
      if (state.esTehTimer > 0) state.esTehTimer -= dt;
      if (view.golden) view.golden.update(dt, state.time);
      // Live GPS route: rebuild on a 3 m move or an objective change,
      // hide once every mission is done. The ribbon + ring are the
      // in-world half of gpsRoute.js; the minimap polyline is its other.
      if (gpsRoute) {
        // No route when done, or when the objective is under 8 m away:
        // a ribbon to a target the player is standing on loops around
        // his feet (the foot shot's 5 m objective drew a loop in frame).
        const tgt0 = missions.done ? null : missionTarget();
        const near = tgt0 && Math.hypot(player.x - tgt0.x, player.z - tgt0.z) < 8;
        if (missions.done || near) {
          if (lastGpsKey !== 'done') { gpsRoute.setRoute(null, null); lastGpsKey = 'done'; }
        } else {
          const tgt = missionTarget();
          const k = `${tgt.x | 0},${tgt.z | 0}`;
          const moved = !lastGpsFrom || Math.hypot(player.x - lastGpsFrom.x, player.z - lastGpsFrom.z) > 3;
          if (k !== lastGpsKey || moved) {
            lastGpsKey = k;
            lastGpsFrom = { x: player.x, z: player.z };
            gpsRoute.setRoute({ x: player.x, z: player.z }, { x: tgt.x, z: tgt.z });
          }
        }
        gpsRoute.update(dt, state.time);
      }
      // Heat decay: 11 s with no police line of sight drops one star
      // (5.5 s with the es teh buff).
      if (state.heat > 0) {
        if (police.anyoneSees(player.x, player.z)) state.seenTimer = 0;
        else {
          state.seenTimer += dt;
          if (state.seenTimer >= (state.esTehTimer > 0 ? 5.5 : 11)) {
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
      hud.update({ state, player, city, traffic, missions, bill, collectibles, taxi, ojek, race, police, policeUnits, missionTarget, garage, usaha, effects, audio }, dt);
    } else {
      // Title / paused / over: the city idles behind the screen.
      traffic.step(dt, null);
      peds.step(dt);
      props.step(dt);
      if (view.golden) view.golden.update(dt, state.time);
      hud.update({ state, player, city, traffic, missions, bill, collectibles, taxi, ojek, race, police, policeUnits, missionTarget, garage, usaha, effects, audio }, dt);
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
    // Speed lines + steer roll (r11): the view reads the live speed and
    // the player's current steer every frame.
    if (view.setSpeed) view.setSpeed(player.speedKmh || 0, player.onFoot ? 0 : (player.steer || 0));
    view.render();
  }

  function audit() {
    draw();
    const info = view.renderer.info.render;
    return { ok: info.triangles < 150000, triangles: info.triangles, calls: info.calls };
  }

  const game = {
    state, city, view, player, traffic, peds, police, missions, bill, props,
    collectibles, taxi, ojek, race, garage, usaha, effects,
    hud, audio, input: inputFacade, shotKeys, npcs, parked, rng,
    step, draw, audit, addHeat, damagePlayer, applySave, missionTarget, policeUnits, timeScale,
    loadSave: loadGame,
    setMode(mode) { state.mode = mode; },
    setShotInput(keys) { Object.assign(shotKeys, keys); },
  };
  garage.wire(game);
  usaha.wire(game);
  return game;
}

export { STEP };
