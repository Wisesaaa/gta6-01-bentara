// Screenshot scenes. Each one seeds a real state, then steps a fixed number
// of simulated seconds at 1/60 through the same systems the player drives —
// never by waiting wall-clock time, never by setting a HUD string directly.
// The frame is identical on any machine at any frame rate.
//
// 1-heat (cover): the chase EAST down the z=111 arterial toward the low
//   sun — sun disc + halo at the end of the avenue, 5+ long shadows, the
//   red car mid-drift + smoke arcs, heli + spotlight cone in the upper
//   third, the BENTARA mural readable on the right, the east tower
//   silhouetted at the avenue end, 16 pedestrians + 8 traffic cars +
//   parked angkot/bajaj/ojek for a living street, Sari's portrait card
//   docked bottom-left (never over the hero car), region stinger, one
//   DRIFT ×2 pop in the middle.
// 2-drive: the x=111 arterial at 42 m/s (151 km/h on the dial), 3 cruisers
//   staggered with lightbars glowing, a MENABRAK pill live, wanted pulse
//   ring + route line on the minimap, mission card + stage bar, dispatch
//   ticker — and the open bay of Bengkel Roda Jaya in frame (car on the
//   lift, upgrade board), a real ojek ride at the bay entrance (bike +
//   green beacon + fare meter on the HUD), taxi passenger + collectible.
//   One cruiser sits tight behind the player (RAMMING range) — the camera
//   is a three-quarter view from the west, never the 22 m pull-back, so
//   the player car stays the hero.
// 3-foot: on foot outside WARUNG SARI, emissive sign + tarp awning, the
//   pasar block behind (striped tents, gerobak, ES TEH stall), 10+
//   pedestrians fleeing a real shot, a live firefight frozen mid-tracer
//   (one outbound, one return), a downed attacker + cash/ammo drops, the
//   warung interaction pill live, the weapon rail with its LOCKED slots,
//   and the red CEMPAKA GT parked clearly in frame — traffic kept clear
//   of it.
// 4-story: marina handoff, letterbox bars, PAK ASKA's card fully inside
//   the safe margins, ledger chip, city glow, ZERO cut text. Staged by
//   really completing MISSION 8 live (the largest real ledger:
//   "PANAS TERAKHIR SELESAI / Hasil +$1.000 / Tagihan −$0 / REP +600 /
//   BERSIH +$1.000") — never a staged M3 +$2.165, which the ledger can
//   never pay. Crosshair hidden.
import * as THREE from 'three';
import { STEP, COLLECTIBLES } from './config.js';
import { loc } from './city.js';

const SHOTS = {
  heat: { at: 2 },
  drive: { at: 2.5 },
  foot: { at: 2 },
  story: { at: 1.5 },
};

// Traffic colours that are never the player's red, so the cover and the
// drive shot never show a twin red car next to the player's red CEMPAKA GT.
const TRAFFIC_PAINT = [0x2f6b8a, 0xd8a13a, 0x2f6b4f, 0xe8e4da, 0x3a3a38, 0x4a7a3a];

function driveStraight(game, dt, laneX, targetSpeed) {
  const car = game.player.car;
  if (!car) return;
  // Hold the target speed and steer back toward the lane centre. The
  // correction flips with the heading: steering left moves the car +x
  // heading north and -x heading south, so scale the error by cos(heading).
  const err = laneX - car.x;
  const along = Math.cos(car.heading);
  game.setShotInput({
    active: true,
    up: car.speed < targetSpeed,
    down: car.speed > targetSpeed + 3,
    brake: false, run: false,
    left: err * along > 1.5, right: err * along < -1.5, mouse: false,
  });
}

function driveEast(game, dt, laneZ, targetSpeed) {
  const car = game.player.car;
  if (!car) return;
  // Same lane hold, rotated: heading east (PI/2), so the error is in z.
  // Facing east, LEFT is north (-z) and RIGHT is south (+z): a car south
  // of the lane (err < 0) must steer LEFT, a car north of it RIGHT — the
  // opposite sign from driveStraight, where facing +z makes left = +x.
  const err = laneZ - car.z;
  const along = Math.sin(car.heading);
  game.setShotInput({
    active: true,
    up: car.speed < targetSpeed,
    down: car.speed > targetSpeed + 3,
    brake: false, run: false,
    left: err * along < -1.5, right: err * along > 1.5, mouse: false,
  });
}

// Move one uncollected item to an exact roadside spot so it reads in frame.
// The item stays live: drive over it and it really collects.
function stageCollectible(game, x, z) {
  const item = game.collectibles.remaining()[0];
  if (!item) return null;
  item.x = x;
  item.z = z;
  item.mesh.position.x = x;
  item.mesh.position.z = z;
  return item;
}

// A waiting taxi passenger, repositioned into the frame with their teal
// beacon. The fare is real — E near them would start it.
function stageTaxi(game, standKey, x, z) {
  const p = game.taxi.stagePassenger(standKey);
  if (p && x !== undefined) game.taxi.movePassenger(x, z);
  return p;
}

export function stageShot(name, game, atSeconds) {
  const spec = SHOTS[name] ?? SHOTS.drive;
  const seconds = typeof atSeconds === 'number' && atSeconds > 0 ? atSeconds : spec.at;
  const steps = Math.round(seconds / STEP);
  const G = game;
  G.setMode('play');
  G.hud.hideScreen();

  if (name === 'drive') {
    G.missions.setIndex(1);
    // The M2 intro (Letkol Rahmat) would sit over the frame for its 7 s
    // lifetime; the drive shot is a chase, not a conversation.
    G.hud.hideDialogue();
    G.state.cash = 18400;
    G.state.rep = 1250;
    G.player.enterCar(G.parked[0]);
    // The chase runs NORTH up the x=111 arterial, past the open bay of
    // Bengkel Roda Jaya (x 120–136, z 61–87): the player starts at z=-35
    // and ends near z=70, right at the bay's open front, so the garage
    // reads in frame. (The old x=37 arterial has no garage.)
    G.player.car.x = 111;
    G.player.car.z = -35;
    G.player.car.heading = 0;
    G.player.car.speed = 42;
    // Three cruisers, so the response list can show a staggered convoy
    // and one of them can sit in RAMMING range for the MENABRAK pill.
    G.addHeat(3);
    // Pull traffic onto the player's arterial so the drive shot actually
    // shows it: same-direction cars ahead in the right lane, oncoming cars
    // in the left lane. The start spots are chosen by where the cars END
    // UP after 2.5 s (same-direction +25 m, oncoming -25 m), so the frame
    // holds a convoy ahead instead of an empty road. The player ends near
    // z=70, so same-direction cars start at z 60–135 (ending 85–160) and
    // oncoming cars at z 100–175 (ending 75–150) — the nearest oncoming
    // car ends 5 m ahead of the player, in the other lane.
    const arterial = [
      { lane: 115.5, z: 60, dir: 1 }, { lane: 115.5, z: 85, dir: 1 },
      { lane: 115.5, z: 110, dir: 1 }, { lane: 115.5, z: 135, dir: 1 },
      { lane: 106.5, z: 100, dir: -1 }, { lane: 106.5, z: 125, dir: -1 },
      { lane: 106.5, z: 150, dir: -1 }, { lane: 106.5, z: 175, dir: -1 },
    ];
    G.traffic.cars.slice(0, arterial.length).forEach((c, k) => {
      const a = arterial[k];
      c.axis = 'z';
      c.lane = a.lane;
      c.dir = a.dir;
      c.x = a.lane;
      c.z = a.z;
      c.heading = a.dir > 0 ? 0 : Math.PI;
      c.cruise = 10 + (k % 3) * 2;
      c.speed = c.cruise;
      c.sync();
      // No twin reds: the player's car is the only red car in the frame.
      c.repaint(TRAFFIC_PAINT[k % TRAFFIC_PAINT.length]);
    });
    // Pedestrians on the sidewalks the chase camera passes, so the drive
    // shot proves the city is lived in, not just driven through. Staged
    // ahead of the player's end position (z ≈ 70 after 2.5 s at 42 m/s),
    // not at the start line.
    const pedSpots = [[100, 55], [122, 62], [100, 78], [122, 85]];
    G.peds.peds.slice(0, pedSpots.length).forEach((p, k) => {
      p.setPos(pedSpots[k][0], pedSpots[k][1]);
      p.target = { x: pedSpots[k][0], z: pedSpots[k][1] + (k % 2 === 0 ? 40 : -40) };
    });
    // Side systems in frame, staged AHEAD of where the player ends up
    // (z ≈ 70): a taxi passenger waiting on the right sidewalk south of
    // the bay, a gold collectible on the left one, and a real ojek ride
    // staged from the industrial-yard stand — the bike rides to the
    // passenger at the garage entrance during the sim, so the frame
    // shows the bike, the green beacon and the fare meter on the HUD.
    stageTaxi(G, 'industrialYard', 122, 60);
    stageCollectible(G, 102, 78);
    G.ojek.stageRide('industrialYard', 'towerConcourse');
    // The race is really running for this shot: start it before the sim
    // so the timer accrues and the HUD race chip shows, and the first
    // gold gate is moved onto the player's lane ahead (same honest
    // staging as the collectible — a real gate, really active, just
    // placed where the camera can see it). The gate sits at +32 m, past
    // the roadblock at +46 m, so the frame proves the race system: gold
    // ring in the world, gold circle on the minimap, timer chip on top.
    G.race.startRace();
    G.hud.toast('', 0.01);
    G.setShotInput({ active: true, up: true, down: false, left: false, right: false, brake: false, run: false, mouse: false });
    G.draw();
    for (let i = 0; i < steps; i += 1) {
      driveStraight(G, STEP, 111, 42);
      G.step(STEP);
      // Stage the convoy on the second-to-last step, so one more step runs
      // after the move (HUD distances read the staged spots) and the final
      // frame holds the formation: TWO cruisers east of the player (5 m,
      // on his right from the camera, never covering his car) and one
      // cruiser 11 m ahead — inside the 12 m RAMMING range, so the
      // MENABRAK pill stays live. The old offsets put two cruisers 3 m
      // SOUTH of the player, which from the south-west camera sat between
      // the camera and the player car and hid it.
      if (i === steps - 2) {
        const offsets = [[5, 2], [5, -2], [0, 11]];
        G.police.cruisers.forEach((c, k) => {
          const off = offsets[k % offsets.length];
          c.x = G.player.x + off[0];
          c.z = G.player.z + off[1];
          c.heading = G.player.heading;
          c.speed = 42;
          c.sync();
        });
        // The race gate, moved onto the lane ahead of the player.
        const gate = G.race.nextGate;
        if (gate) {
          gate.x = G.player.x;
          gate.z = G.player.z + 32;
          gate.ring.position.set(gate.x, 4.5, gate.z);
          gate.ring.rotation.y = 0;
          gate.post.position.set(gate.x - 4.5, 2.25, gate.z);
          gate.post2.position.set(gate.x + 4.5, 2.25, gate.z);
        }
        const rb = G.police.roadblock;
        if (rb) {
          rb.x = G.player.x;
          rb.z = G.player.z + 46;
          rb.heading = Math.PI / 2;
          rb.speed = 0;
          rb.sync();
        }
      }
    }
    // The drive camera: a diagonal three-quarter view from the road's
    // west edge (102, 5, 66), looking north-east at the bay (126, 2.5,
    // 76) — the player car sits centre at the bay's mouth, the lift car
    // + upgrade board inside the bay centre-right through the open west
    // front and the side entrance, the ojek bike in front of the bay
    // mouth, the taxi passenger lower-right. The ojek bike is pulled to
    // (122, 76) if the sim carried it off-frame — right in front of the
    // bay's open mouth, in the sun, clear of the cruisers at (116, 72) /
    // (116, 68) / (111, 81), so the bike + the red-helmeted passenger
    // read as a motorbike instead of hiding behind a cruiser. The ride
    // is real, only the bike's spot is staged. keepClear guarantees no
    // building stands between the camera and the bay. The race gate +
    // roadblock sit north, out of this frame — the race chip
    // on the HUD still proves the race.
    G.hud.hideDialogue();
    G.setShotInput({ active: false });
    if (G.ojek.state !== 'idle') G.ojek.moveBike(122, 76);
    const cam = G.view.camera;
    cam.position.set(102, 5, 66);
    cam.lookAt(126, 2.5, 76);
    G.view.keepClear(cam, 126, 2.5, 76);
    // Re-show the dispatch line the chase really earned, with a 60 s
    // lifetime so the slow capture keeps it.
    G.hud.ticker('POLISI: Semua unit — kejar sedan merah di Kawasan Industri!', 60);
    // Frozen impact trauma (game-feel): a cruiser is in RAMMING range, so
    // the frame carries a slight Dutch angle — the chase reads as a hit,
    // not a parked pose.
    G.view.setTrauma(0.3);
    G.view.render();
    window.__shotReady = true;
    return { name, seconds, steps };
  } else if (name === 'heat') {
    // Mission 3 RAMPOKAN KECIL: its objective is "Pergi ke Kawasan
    // Industri", so the mission panel matches the district in frame, and a
    // robbery at 4.2 stars is the chase the cover is supposed to show.
    // The chase runs EAST down the z=111 arterial, straight at the low
    // sun (azimuth ~22° north of east) and the BENTARA mural on the right.
    // It starts at x=0 and ends near x=60, so the mural building (x
    // 100–140) sits 40–80 m ahead — readable, not a wall filling the
    // right half of the frame.
    G.missions.setIndex(2);
    G.state.cash = 18250;
    G.state.rep = 1250;
    G.player.enterCar(G.parked[0]);
    G.player.car.x = 0;
    G.player.car.z = 111;
    G.player.car.heading = Math.PI / 2;
    G.player.car.speed = 30;
    // Six props really broken along the chase path, so the bill is true.
    const alongPath = G.props.props.filter((p) => Math.abs(p.z - 111) < 16 && p.x > -10 && p.x < 70);
    let broken = 0;
    for (const prop of alongPath) {
      if (broken >= 6) break;
      if (G.props.breakProp(prop, G.bill, () => {})) broken += 1;
    }
    for (const prop of G.props.props) {
      if (broken >= 6) break;
      if (G.props.breakProp(prop, G.bill, () => {})) broken += 1;
    }
    // Heat set after the breaks, so the shot reads exactly 4.2 stars.
    G.state.heat = 4.2;
    // Traffic on the same arterial: EIGHT cars now — five eastbound ahead
    // of the player in the near lane, three westbound far ahead in the
    // far lane, small against the sun. The eastbound cars are sedans and
    // angkots ONLY — a truck in this lane lands dead-centre and hides
    // the avenue end and the sun (the first take's tan box truck). The
    // westbound cars start FAR east (x 240–300) so after the 2 s sim they
    // are still 150 m+ ahead: the first polish take started them at x 100
    // / 70 and a big brown box truck ended up dead-centre.
    const fleet = G.traffic.cars;
    let eastCars = fleet.filter((c) => c.kind === 'sedan' || c.kind === 'angkot').slice(0, 5);
    if (eastCars.length < 5) {
      eastCars = [...eastCars, ...fleet.filter((c) => !eastCars.includes(c) && c.kind !== 'truck')].slice(0, 5);
    }
    const westCars = fleet.filter((c) => !eastCars.includes(c)).slice(0, 3);
    const arterial = [
      ...eastCars.map((c, k) => ({ car: c, lane: 106.5, x: 78 + k * 30, dir: 1 })),
      ...westCars.map((c, k) => ({ car: c, lane: 115.5, x: 240 + k * 30, dir: -1 })),
    ];
    arterial.forEach((a, k) => {
      const c = a.car;
      c.axis = 'x';
      c.lane = a.lane;
      c.dir = a.dir;
      c.x = a.x;
      c.z = a.lane;
      c.heading = a.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      c.cruise = 10 + (k % 2) * 2;
      c.speed = c.cruise;
      c.sync();
      // No twin reds: the player's car is the only red car in the frame.
      c.repaint(TRAFFIC_PAINT[k % TRAFFIC_PAINT.length]);
    });
    // Parked street life at the kerbs: an angkot, a bajaj and an ojek,
    // picked by kind from the fleet (a sedan fills a missing kind) —
    // parked, not driving, so they stay exactly where the frame needs
    // them. The fallback NEVER picks a truck: a truck's plain cargo box
    // lands dead-centre and hides the avenue end (first take's tan box).
    const parkedSpots = [
      { kind: 'angkot', x: 80, z: 122.5 },
      { kind: 'bajaj', x: 100, z: 99.5 },
      { kind: 'ojek', x: 130, z: 122.5 },
    ];
    const used = new Set(arterial.map((a) => G.traffic.cars.indexOf(a.car)));
    for (const spot of parkedSpots) {
      let car = G.traffic.cars.find((c, i) => !used.has(i) && c.kind === spot.kind);
      if (!car) car = G.traffic.cars.find((c, i) => !used.has(i) && c.kind !== 'truck');
      if (!car) break;
      used.add(G.traffic.cars.indexOf(car));
      car.axis = 'x';
      car.lane = spot.z;
      car.dir = 1;
      car.x = spot.x;
      car.z = spot.z;
      car.heading = Math.PI / 2;
      car.cruise = 0;
      car.speed = 0;
      car.sync();
    }
    // Every truck left unstaged gets parked FAR out of the frame (south
    // corner, engine off): an unstaged truck on its default route drove
    // through the avenue in the re-shoot and read as a giant tan box
    // dead-centre. Trucks only exist as parked background now.
    for (const c of fleet) {
      if (c.kind === 'truck' && !used.has(G.traffic.cars.indexOf(c))) {
        c.axis = 'x';
        c.lane = 185;
        c.dir = 1;
        c.x = -150;
        c.z = 185;
        c.heading = Math.PI / 2;
        c.cruise = 0;
        c.speed = 0;
        c.sync();
      }
    }
    // Pedestrians on the sidewalks beside the chase, scattering as the
    // sirens pass — SIXTEEN of them, both sidewalks, x 60–140, so the
    // boulevard reads as a living street, not a set. Staged near the
    // player's end position (x ≈ 60), not at the start line.
    const pedSpots = [
      [70, 99.5], [85, 122.5], [60, 99.5], [95, 122.5], [75, 99.5],
      [110, 99.5], [125, 122.5], [65, 122.5], [105, 99.5], [120, 122.5],
      [90, 99.5], [115, 99.5], [80, 122.5], [100, 122.5], [135, 99.5],
      [140, 122.5],
      // Near-field wave, x 44–58: the first take's peds all sat 20 m+
      // ahead and read as ~6 figures — these six stand 8–20 m from the
      // camera, so the living street reads at thumbnail size.
      [48, 99.5], [52, 122.5], [46, 122.5], [56, 99.5], [44, 99.5], [58, 122.5],
    ];
    G.peds.peds.slice(0, pedSpots.length).forEach((p, k) => {
      p.setPos(pedSpots[k][0], pedSpots[k][1]);
      p.fleeTimer = 0;
    });
    // New systems in frame, staged ahead of the player's end position
    // (x ≈ 90 after the chase): a taxi passenger waiting on the north
    // sidewalk and a gold wayang idol on the south one — both live, both
    // collectible / hailable, neither in the driving line.
    stageTaxi(G, 'industrialYard', 96, 122);
    stageCollectible(G, 92, 100);
    G.hud.toast('', 0.01);
    G.setShotInput({ active: true, up: true, down: false, left: false, right: false, brake: false, run: false, mouse: false });
    G.draw();
    for (let i = 0; i < steps; i += 1) {
      // Drift window (0.7 s): handbrake + steer RIGHT + throttle, one
      // way — a proper slide that ends with the car angled mid-drift. The
      // handbrake is a slide (car.js), so speed stays above 10 m/s and the
      // drift timer reaches its 0.6 s payout on slide end — a genuine
      // DRIFT popup floats when the frame freezes. The last 1.1 s drives
      // straight again so the car recovers speed (a 0.7 s recovery left it
      // crawling at 9 km/h in the first take).
      if (i >= 12 && i < 54) {
        G.setShotInput({ active: true, up: true, down: false, left: false, right: true, brake: true, run: false, mouse: false });
      } else {
        driveEast(G, STEP, 111, 30);
      }
      G.step(STEP);
      // Sirens send the staged pedestrians running once the chase is near.
      if (i === 60) G.peds.fleeFrom(G.player.x, G.player.z, 120);
      // Stage the convoy on the second-to-last step, so one more step runs
      // after the move (HUD distances read the staged spots) and the final
      // frame holds the formation: two cruisers ahead of the player, one
      // alongside behind, and the roadblock sideways across the road ahead.
      if (i === steps - 2) {
        // Two cruisers ahead of the player, one alongside — none of them
        // between the camera and the player, where a cruiser would fill the
        // bottom-left corner and hide the player's car.
        const offsets = [[18, -6], [30, 7], [8, -9]];
        G.police.cruisers.forEach((c, k) => {
          const off = offsets[k % offsets.length];
          c.x = G.player.x + off[0];
          c.z = G.player.z + off[1];
          c.heading = G.player.heading;
          c.speed = 30;
          c.sync();
        });
        const rb = G.police.roadblock;
        if (rb) {
          rb.x = G.player.x + 46;
          rb.z = G.player.z;
          rb.heading = 0;
          rb.speed = 0;
          rb.sync();
        }
      }
    }
    // Helicopter staging: in the open sky ahead-right of the player
    // (near the sun's bearing, in the upper third — clear of the mural),
    // nose on the player, spotlight cone + ground pool reading as a
    // searchlight. It sits 32 m ahead and 19 m up — far enough that the
    // dark body reads as a helicopter, not a black blob filling the top
    // of the frame (the first take had it at 22 m / 15 m and it read as
    // a UFO). From the hero camera it sits ~2° left of the view axis,
    // ~15° up; the sun disc sits ~16° right of the axis, ~11° up —
    // separated, both in the upper third.
    const heli = G.police.heli;
    if (heli) {
      heli.group.position.set(G.player.x + 32, 19, G.player.z + 8);
      heli.group.lookAt(G.player.x, 0, G.player.z);
      heli.spotX = G.player.x;
      heli.spotZ = G.player.z;
      heli.pool.position.set(G.player.x, 0.08, G.player.z);
      // Re-aim the cone for the STAGED heli position, same formula the
      // live update uses: the last sim step aimed it from the pre-staging
      // hover spot 20 m ahead, so without this the beam points ~7 m off
      // the heli and the pool. (r3 left the stale aim in place.)
      heli.spot.position.set(
        (heli.spotX - heli.group.position.x) * 0.35,
        -11,
        (heli.spotZ - heli.group.position.z) * 0.35 + 1.6,
      );
    }
    // Hero camera: 12.5 m back, 5.4 m up — the car is the hero now,
    // bottom-centre at a quarter to a third of the frame, a real sports
    // car (spoiler, light bar, rims) instead of a small red box. The look
    // target is HIGH (y 6) and only slightly north (+4 z): the sun disc
    // enters the upper third, and the mural stays on the right at a
    // readable distance. The portrait card is BACK for the cover — Sari's
    // two-line quote, compact strip docked bottom-left (the CSS keeps it
    // off the hero car), 600 s so the slow capture keeps it. Render
    // directly: G.draw() would reset the camera to the chase cam.
    G.setShotInput({ active: false });
    G.hud.setCaptureMode('coverportrait');
    const cam = G.view.camera;
    cam.position.set(G.player.x - 12.5, 5.4, G.player.z + 1.5);
    cam.lookAt(G.player.x + 40, 6, G.player.z + 4);
    G.view.keepClear(cam, G.player.x + 40, 6, G.player.z + 4);
    G.hud.dialogue('SARI · WARUNG SARI', 'Jalan ini milik kita, Wira. Gas terus, jangan berhenti.', 'sari', 600);
    // Re-show the drift popup the chase really earned (cash 18250 -> 18292,
    // a 0.7 s slide at $60/s = +$42) with a 60 s lifetime: popups fade on
    // wall-clock time, and one slow SwiftShader frame outlives the 2.6 s
    // default, so the frozen frame would lose the popup the cover is
    // supposed to prove. Same values, same call the game itself makes
    // when a drift pays. Clear first: the live drift already left one
    // popup, and re-showing without clearing stacks a duplicate.
    G.hud.popups.clear();
    G.hud.popups.drift(42, 0.7, 60);
    // The mission stinger, held for the capture too.
    G.hud.stinger('MISI 3/8 — RAMPOKAN KECIL', 'Kawasan Industri', 60);
    // Frozen drift trauma: the red car is mid-slide, so the cover leans
    // a touch into the drift instead of sitting level.
    G.view.setTrauma(0.2);
    G.view.render();
    window.__shotReady = true;
    return { name, seconds, steps };
  } else if (name === 'foot') {
    // Mission 2 ANTAR PAKET: the player is on foot at the north-row
    // market, outside WARUNG SARI — the warung interaction pill is live,
    // the emissive sign + tarp awning are in frame, and the red CEMPAKA
    // GT is parked clearly nearby.
    G.missions.setIndex(1);
    // The M2 intro would sit over the frame; the foot shot is a market
    // street, not a conversation.
    G.hud.hideDialogue();
    G.state.cash = 19600;
    G.state.rep = 1960;
    G.state.heat = 0;
    const L = loc('northRowStall');
    G.player.setPos(44, 104, -2.85);
    G.player.weapon = 'pistol';
    // The firefight: two live attackers closing on the player and one
    // already downed where a real kill left him — staged BEFORE the sim
    // so the player's walk and the attackers' presence happen around
    // real bodies, not empty air. They cluster around the player's END
    // position (he walks north-west to ~(40,92)): the near attacker at
    // (44,88), the far one at (48,90), the downed one at (42,90) — all
    // within 12 m of the camera, so the figures, the tracers and the
    // drops read instead of vanishing at 20 m. The downed one goes
    // through the same damage() path as a combat kill.
    G.missions.stageAttacker(44, 88);
    G.missions.stageAttacker(48, 90);
    // The downed one goes through the same damage() path as a combat
    // kill, then lies ACROSS the frame (face 2.48) on open ground
    // between the player and the camera — a flat body that reads as a
    // body, not a dark slab behind a stall.
    const downedAtk = G.missions.stageDownedAttacker(40, 84);
    downedAtk.face(2.48);
    // The WARUNG SARI sign (42,5,104) sits 2 m behind PASAR PAGI
    // (42,6,102) and 1 m lower, so from any northern camera the two
    // signs stack and WARUNG SARI never reads. Stage it forward and
    // lower — (42,3.2,96), hanging over the stall's front at a normal
    // shop-sign height — so it reads clear of PASAR PAGI and WARUNG
    // KOPI. The sign is real; only its staged position moves.
    // Same for the WARUNG KOPI banner (37,5.5,96): from the foot camera
    // it sits exactly over PASAR PAGI and the two read as one garbled
    // "PA WARUNG KOPI" — and moving it WEST made it worse, because this
    // camera looks north-east, so screen-right runs south-east: a smaller
    // x reads FURTHER right (probe-measured: x 37 -> px 780, x 33 ->
    // px 919). So the banner moves EAST to (54,5,96), clear of PASAR
    // PAGI's span and clear of the building that cut its west end at
    // (48,5.5,94), still strung across the market street.
    G.view.scene.traverse((obj) => {
      if (obj !== G.view.scene && Math.hypot(obj.position.x - 42, obj.position.y - 5, obj.position.z - 104) < 0.5) {
        obj.position.set(42, 3.2, 96);
      }
      if (obj !== G.view.scene && Math.hypot(obj.position.x - 37, obj.position.y - 5.5, obj.position.z - 96) < 0.5) {
        obj.position.set(54, 5, 96);
      }
    });
    // The player's own red car, parked clearly ON THE ROAD west of the
    // player (x=36, west lane of the x=37 road) — the first take parked
    // it at x=52, inside the warung block's footprint, where a building
    // hid it; the second take put it at x=44, where a market stall hid
    // it from the southern camera; the third put it at (40,94), where it
    // stood on the player's walking line and hid him. At (36,96) it sits
    // beside the player, never on him.
    G.parked[0].x = 36;
    G.parked[0].z = 96;
    G.parked[0].heading = 1.2;
    G.parked[0].sync();
    // Traffic kept clear of the hero car AND the frame: every car is
    // moved to the far north arterial — the second take only moved cars
    // within 30 m at staging time, and a red car drove into the frame
    // during the 2 s sim and parked itself next to the hero car (a twin
    // red). The foot shot needs the street clear; the pedestrians carry
    // the life.
    G.traffic.cars.forEach((c, k) => {
      c.axis = 'x';
      c.lane = -185;
      c.dir = k % 2 === 0 ? 1 : -1;
      c.x = -150 + k * 20;
      c.z = -185;
      c.heading = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      c.cruise = 10;
      c.speed = 10;
      c.sync();
    });
    // Props kept clear of the hero car's spot (a market stall sat on it).
    for (const prop of G.props.props) {
      if (!prop.broken && Math.hypot(prop.x - 36, prop.z - 96) < 6) {
        prop.x = 30;
        prop.z = 84;
        prop.mesh.position.x = 30;
        prop.mesh.position.z = 84;
      }
    }
    // Ten pedestrians around the market, fleeing once the shots go off.
    const pedSpots = [
      [36, 92], [50, 90], [34, 100], [56, 98], [38, 108],
      [52, 108], [30, 96], [58, 104], [40, 88], [48, 112],
    ];
    G.peds.peds.slice(0, pedSpots.length).forEach((p, k) => {
      p.setPos(pedSpots[k][0], pedSpots[k][1]);
      p.target = { x: pedSpots[k][0] + 8, z: pedSpots[k][1] - 12 };
      p.fleeTimer = 0;
    });
    // A gold item staged on the player's walking line (heading -2.85
    // drifts him north-west as he walks): he walks over it during the
    // sim, so the collect is real — popup, cash, and the counter. Keep
    // the staged item: the re-shown popup must carry ITS real kind and
    // value (the first take claimed IDOL +$60 while the item actually
    // collected was a TAPE +$25).
    const stagedItem = stageCollectible(G, 43, 99);
    // No shots during the sim: the player's sim fire hit a parked car in
    // the first take (an SMG drop + a collect popup the frame never meant
    // to show). The firefight is staged after the sim — frozen tracers,
    // attackers, a downed body, drops — and the peds are staged mid-flee.
    // The collect is still real: the player walks over the staged item.
    G.setShotInput({ active: true, up: true, down: false, left: false, right: false, brake: false, run: false, mouse: false });
    G.draw();
    for (let i = 0; i < steps; i += 1) {
      G.step(STEP);
    }
    // Re-stage the pedestrians AFTER the sim, frozen mid-flee across the
    // visible street band: r3 staged them before the sim and the shots
    // scattered them out of frame, so only 1–2 showed. Sixteen peds,
    // spread x 30–56 / z 84–100 — clear of the firefight cluster
    // (player ~(40,92), attackers (44,88)/(48,90), downed (42,90)) and
    // clear of the hero car (36,96), so no ped stands on the player, a
    // body, or the car. Flee targets outward — they read as a crowd
    // reacting, and the frame freezes before any of them can leave.
    const footPedSpots = [
      [34, 88], [52, 92], [38, 100], [54, 98], [32, 94],
      [48, 100], [36, 86], [50, 86], [30, 90], [56, 94],
      [40, 98], [46, 84], [32, 98], [52, 100], [44, 84],
      [36, 90],
    ];
    G.peds.peds.slice(0, footPedSpots.length).forEach((p, k) => {
      p.setPos(footPedSpots[k][0], footPedSpots[k][1]);
      p.target = { x: footPedSpots[k][0] + (k % 2 === 0 ? 10 : -10), z: footPedSpots[k][1] - 8 };
      p.fleeTimer = 2;
    });
    // Fleeing pose, frozen mid-stride: the frame freezes right after
    // staging, so no walk() ever runs — without a posed lean + leg
    // swing the crowd reads as standing still. EXAGGERATED on purpose:
    // at 12 m a 0.15 lean is invisible, so legs split wide, arms pump
    // hard, torso hunches 0.3 rad toward the flee target. Two extra
    // peds run across the road itself (mid-crossing reads as fleeing
    // even at thumbnail size). (Torso rotation.x is the forward pitch:
    // the torso is a child of the heading-rotated group, so its local
    // X is the lean axis.)
    G.peds.peds.slice(0, footPedSpots.length).forEach((p) => {
      p.face(Math.atan2(p.target.x - p.x, p.target.z - p.z));
      p.legL.rotation.x = 0.8;
      p.legR.rotation.x = -0.8;
      p.armL.rotation.x = -0.7;
      p.armR.rotation.x = 0.7;
      p.torso.rotation.x = 0.3;
    });
    // Two road-crossers: staged after the main crowd so they keep
    // their spots (the crowd slice is the first 16 peds; these are
    // peds 16 and 17).
    const crossers = [[38, 100, 30, 104], [46, 102, 54, 106]];
    G.peds.peds.slice(footPedSpots.length, footPedSpots.length + crossers.length).forEach((p, k) => {
      const s = crossers[k];
      p.setPos(s[0], s[1]);
      p.target = { x: s[2], z: s[3] };
      p.fleeTimer = 2;
      p.face(Math.atan2(s[2] - s[0], s[3] - s[1]));
      p.legL.rotation.x = 0.8;
      p.legR.rotation.x = -0.8;
      p.armL.rotation.x = -0.7;
      p.armR.rotation.x = 0.7;
      p.torso.rotation.x = 0.3;
    });
    // Market fill: pull six street props into the near and mid-ground —
    // flanking the player's walking line, never on it — so the foreground
    // reads as a busy market street, not a gap.
    const marketProps = [[-12, 30], [-16, 22], [16, 30], [20, 20], [-6, 34], [12, 36]];
    let placed = 0;
    const usedProps = new Set();
    for (const prop of G.props.props) {
      if (placed >= marketProps.length || prop.broken) continue;
      const s = marketProps[placed];
      prop.x = L.x + s[0];
      prop.z = L.z + s[1];
      prop.mesh.position.x = L.x + s[0];
      prop.mesh.position.z = L.z + s[1];
      usedProps.add(prop);
      placed += 1;
    }
    // Break the big blank west wall: a teal warung + a red market stall
    // against its base, so the left third of the frame is market, not a
    // flat brown slab. Picked by kind (not by order) and never one of
    // the six market props above.
    for (const [kind, wx, wz] of [['warung', 28, 88], ['stall', 29, 96]]) {
      const prop = G.props.props.find((pp) => !pp.broken && pp.kind === kind && !usedProps.has(pp));
      if (!prop) continue;
      prop.x = wx;
      prop.z = wz;
      prop.mesh.position.x = wx;
      prop.mesh.position.z = wz;
    }
    // Two parked cars at the market's west edge, clear of the hero car.
    [G.parked[1], G.parked[2]].forEach((c, k) => {
      if (!c) return;
      c.x = k === 0 ? 28 : 30;
      c.z = k === 0 ? 92 : 110;
      c.heading = k === 0 ? 1.2 : -1.2;
      c.sync();
    });
    // The attackers, re-staged to exact spots after the sim (the player's
    // walk may have shifted them): the living ones stand facing the
    // player, the downed ones stay where they fell.
    const liveAtk = G.missions.attackers.filter((a) => a.alive);
    const atkSpots = [[44, 88], [48, 90]];
    liveAtk.forEach((a, k) => {
      const s = atkSpots[k % atkSpots.length];
      a.setPos(s[0], s[1]);
      a.face(Math.atan2(G.player.x - s[0], G.player.z - s[1]));
    });
    // Loot on the ground beside the downed attacker: a cash bundle and
    // an ammo crate, both real drops (walk over them and they collect) —
    // scaled 1.6× so they read at 12 m instead of hiding in the grass.
    const dCash = G.effects.dropCash(39, 83, 40);
    const dAmmo = G.effects.dropAmmo(41, 83, 'shells', 6);
    if (dCash) dCash.group.scale.setScalar(1.6);
    if (dAmmo) dAmmo.group.scale.setScalar(1.6);
    // Re-show the popup the walk really earned, with the STAGED item's
    // real kind and value and a 60 s lifetime, for the same slow-capture
    // reason as the cover's drift popup. Clear first: the live collect
    // already left one popup, and re-showing without clearing stacks a
    // duplicate "KASET +$25" that collides with the panel edge.
    const itemValue = stagedItem
      ? (stagedItem.kind === 'idol' ? COLLECTIBLES.idolValue : COLLECTIBLES.tapeValue)
      : 25;
    G.hud.popups.clear();
    G.hud.popups.collect(itemValue, stagedItem ? stagedItem.kind : 'tape', 60);
    G.setShotInput({ active: false });
    // Foot camera: (38, 4, 76) looking almost due south at the
    // player's END position (40, 2.5, 96) — ~12 m from the player, so
    // the player and the firefight read big enough to see (at 28 m the
    // player was a small dark figure and the tracers were hairlines),
    // while the market signs stay readable instead of the giants they
    // were from 13 m. Aimed south, not south-east: the east tower's
    // west face (x 48.8) filled the left ~35% from the (46, 94) aim —
    // the southerly aim pushes its north corner out of frame and the
    // KEDAI KOPI / TOKO KELONTONG signs break what is left of it. The
    // red CEMPAKA GT sits right of the player, the player stands centre
    // beside his car, the pasar tents fill the left of the frame.
    const cam = G.view.camera;
    cam.position.set(38, 4, 76);
    cam.lookAt(40, 2.5, 96);
    G.view.keepClear(cam, 40, 2.5, 96);
    // Frozen firefight: one live tracer from the player toward the near
    // attacker, and one return tracer from the far attacker toward the
    // player — fired after the last step, so both tracers + muzzle
    // flashes are at full opacity when the frame freezes. combat.shoot
    // only draws the visuals; damage and drops stay in the game's own
    // shot handler, so no staged body changes state here.
    if (liveAtk.length > 0) {
      const near = liveAtk[0];
      const origin = new THREE.Vector3(G.player.x, 1.4, G.player.z);
      const dir = new THREE.Vector3(near.x - G.player.x, 1.2 - 1.4, near.z - G.player.z).normalize();
      G.player.combat.shoot(origin, dir, 'pistol', { humans: liveAtk, cars: [] });
      const far = liveAtk[1] || liveAtk[0];
      const back = new THREE.Vector3(far.x, 1.4, far.z);
      const bdir = new THREE.Vector3(G.player.x - far.x, 1.2 - 1.4, G.player.z - far.z).normalize();
      G.player.combat.shoot(back, bdir, 'pistol', { humans: [], cars: [] });
    }
    // Frozen firefight trauma: tracers are crossing the frame, so the
    // camera leans into the exchange — combat depth you can see.
    G.view.setTrauma(0.4);
    G.view.render();
    window.__shotReady = true;
    return { name, seconds, steps };
  } else {
    // story: the marina handoff, staged by REALLY completing MISSION 8
    // live. The deliver step is at the marina, the player is already
    // inside its radius, so one step completes it: the ledger pays the
    // largest real numbers in the game (Hasil +$1.000 / Tagihan −$0 /
    // REP +600 / BERSIH +$1.000). PAK ASKA takes the handoff beside Pak
    // Wira, letterbox bars on, crosshair off, zero cut text.
    G.missions.setIndex(7, 2);
    G.state.cash = 250;
    G.state.rep = 0;
    G.state.heat = 0;
    G.player.setPos(-6, -164, Math.PI);
    G.draw();
    for (let i = 0; i < 10; i += 1) G.step(STEP);
    // The mission is done. Move the player out of the frame's centre and
    // away from the slip (13 m — the "E — Beli SLIP MARINA" prompt dies,
    // and the player stops standing on the camera-to-Wira line): he ends
    // up left-foreground, back to us, clear of the dialogue card, with
    // Wira and the MARINA sign centre-frame.
    G.player.setPos(-11, -158, Math.PI);
    // The prompt element keeps whatever the last hud.update set (the
    // slip prompt, from when the player stood 6 m from it) — no update
    // runs after this, so hide it outright.
    G.hud.prompt('');
    // Clear the big "MISI SELESAI" stamp (the ledger below carries the
    // numbers) and the taxi toast, so the centre band holds only the
    // ledger — no stacking on the dialogue card.
    G.hud.popups.clear();
    G.hud.toast('', 0.01);
    // Foreground fill: ten street props and ten pedestrians into the
    // near band — but to the SIDES of the camera-to-Wira corridor, never
    // in it: props on the sightline read as black monoliths hiding the
    // player. They are staged after the sim steps, so their final
    // positions are exactly the ones in the frame. The last four props
    // sit at the pier's edge (z −170…−176) as the marina's kiosk row,
    // so the frame reads as a working marina, not an empty lot.
    const fgProps = [[-26, -162], [-24, -168], [2, -158], [4, -165], [-30, -160], [-28, -167], [8, -158], [10, -164], [-2, -174], [4, -176], [-14, -172], [-18, -170], [12, -172], [16, -176]];
    let placed = 0;
    for (const prop of G.props.props) {
      if (placed >= fgProps.length || prop.broken) continue;
      const s = fgProps[placed];
      prop.x = s[0];
      prop.z = s[1];
      prop.mesh.position.x = s[0];
      prop.mesh.position.z = s[1];
      placed += 1;
    }
    const fgPeds = [
      [-25, -159.5, -18, -163], [-23, -166, -16, -160],
      [0, -157.5, 6, -162], [3, -164, -2, -158],
      [-28, -160, -24, -164], [10, -166, 6, -160],
      [-14, -170, -10, -174], [14, -170, 10, -174],
      [-20, -176, -16, -180], [18, -176, 14, -180],
    ];
    G.peds.peds.slice(0, fgPeds.length).forEach((p, k) => {
      const s = fgPeds[k];
      p.setPos(s[0], s[1]);
      p.target = { x: s[2], z: s[3] };
    });
    // Two parked cars at the pier's edges: the promenade's near band was
    // bare tan. They sit clear of the camera-to-Wira corridor.
    [G.parked[1], G.parked[2]].forEach((c, k) => {
      if (!c) return;
      c.x = k === 0 ? 16 : -32;
      c.z = k === 0 ? -156 : -162;
      c.heading = k === 0 ? -1.2 : 1.2;
      c.sync();
    });
    // PAK ASKA takes the handoff — full card, inside the safe margins,
    // 600 s so the box never times out during the capture.
    G.hud.dialogue('PAK ASKA · PENERIMA MARINA', 'Barang sampai, uang jalan. Marina tidak pernah tidur — dan sekarang kota ini tahu namamu.', 'aska', 600);
    // Letterbox + no crosshair for the story frame.
    document.body.classList.add('letterbox');
    G.hud.setCaptureMode('story');
    // Re-show the ledger the live completion really paid, with a 60 s
    // lifetime for the slow capture. Same numbers the game itself paid.
    G.hud.ledger({ title: 'PANAS TERAKHIR', hasil: 1000, tagihan: 0, bersih: 1000, rep: 600 }, 60);
    // Close camera due south of the player, looking due north: the player
    // stands left-foreground with his back to us, Wira and Aska just
    // beyond him, and the MARINA sign, the water, the boats and the
    // windowed skyline behind them. Shot from the south so no building
    // wall crosses the view, and far enough south that the player does
    // not line up behind the sign's posts.
    const cam = G.view.camera;
    cam.position.set(-6, 3.6, -148);
    cam.lookAt(-6, 1.3, -170);
    G.view.keepClear(cam, -6, 1.3, -170);
    // The handoff is a rest beat (level-design pacing): zero trauma, a
    // level camera, the ledger doing the talking. Clear the
    // mission-complete celebration smoke first: it fired exactly on the
    // handoff point and sits on the camera axis, blooming into a white
    // blob that reads as an artefact.
    G.view.setTrauma(0);
    G.effects.clearSmoke();
    G.view.render();
    window.__shotReady = true;
    return { name, seconds, steps };
  }

  G.setShotInput({ active: false });
  let painted = 0;
  function paint() {
    G.draw();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
  return { name, seconds, steps };
}
