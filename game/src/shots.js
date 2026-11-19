// Screenshot scenes. Each one seeds a real state, then steps a fixed number
// of simulated seconds at 1/60 through the same systems the player drives —
// never by waiting wall-clock time, never by setting a HUD string directly.
// The frame is identical on any machine at any frame rate.
//
// v3 (suplemen top-6–10): the cover chase runs EAST down the z=111 arterial
// toward the low sun, so the sun disc + halo sit at the end of the avenue
// and 5+ long shadows cross the road toward the camera. The drive shot
// stages 3 cruisers staggered behind at 151 km/h with a MENABRAK pill and
// the dispatch ticker. The foot shot is outside WARUNG SARI (emissive sign
// + tarp awning, 8–12 fleeing peds, MILIK KAMU sign, owned car nearby).
// The story shot is the Marina handoff with PAK ASKA, letterbox bars, and
// a real mission ledger from a mission completed live in the staging.
//
// 1-heat (cover): the chase. 4.2 stars, 3 cruisers, helicopter + spotlight,
//   6 props really broken, bill reading a true number — plus Pak Wira's
//   portrait + dialogue, a taxi passenger waiting on the sidewalk, a gold
//   collectible by the road, and a real NGEPOT ×2 popup earned by a
//   handbrake slide in the last second.
// 2-drive: arterial at 42 m/s (151 km/h), 22 traffic cars, 3 stars, mission
//   HUD live — plus a taxi passenger and a collectible by the road.
// 3-foot: on foot at WARUNG SARI, SMG out, peds fleeing real shots — plus a
//   collectible staged in the player's path, really collected, so the
//   counter reads KOLEKSI 1/24 and a real collect popup floats.
// 4-story: marina, Pak Aska facing the player, his line live with his
//   painted portrait — and the ledger of mission 1, completed for real.
import { STEP } from './config.js';
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

// Eastbound twin of driveStraight: hold a z-lane while heading east.
// Steering left from east turns toward -z, so the correction is mirrored.
function driveEast(game, dt, laneZ, targetSpeed) {
  const car = game.player.car;
  if (!car) return;
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
    G.state.cash = 18400;
    G.state.rep = 1250;
    G.player.enterCar(G.parked[0]);
    G.player.car.x = 37;
    G.player.car.z = -120;
    G.player.car.heading = 0;
    G.player.car.speed = 42; // 151 km/h on the dial
    G.addHeat(3); // 3 cruisers + 2 foot cops + roadblock; heli stays away
    const arterial = [
      { lane: 41.5, z: -75, dir: 1 }, { lane: 41.5, z: -50, dir: 1 },
      { lane: 41.5, z: -25, dir: 1 }, { lane: 41.5, z: 0, dir: 1 },
      { lane: 32.5, z: -20, dir: -1 }, { lane: 32.5, z: 5, dir: -1 },
      { lane: 32.5, z: 30, dir: -1 }, { lane: 32.5, z: 55, dir: -1 },
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
      c.repaint(TRAFFIC_PAINT[k % TRAFFIC_PAINT.length]);
    });
    const pedSpots = [[26, -42], [48, -35], [26, -12], [48, -5]];
    G.peds.peds.slice(0, pedSpots.length).forEach((p, k) => {
      p.setPos(pedSpots[k][0], pedSpots[k][1]);
      p.target = { x: pedSpots[k][0], z: pedSpots[k][1] + (k % 2 === 0 ? 40 : -40) };
    });
    stageTaxi(G, 'northRowStall', 48, -18);
    stageCollectible(G, 28, -25);
    G.hud.toast('', 0.01);
    G.setShotInput({ active: true, up: true, down: false, left: false, right: false, brake: false, run: false, mouse: false });
    G.draw();
    for (let i = 0; i < steps; i += 1) {
      driveStraight(G, STEP, 37, 42);
      G.step(STEP);
      // Stage the convoy on the second-to-last step: two cruisers tight
      // BEHIND the player (8 m and 11 m back, flanking left/right) so
      // they read in the pull-back camera with lightbars flashing — both
      // within MENABRAK range — one ahead as escort, and the roadblock
      // sideways across the road ahead. (Closer to the camera than this,
      // the near cruiser slides under the bottom edge of the frame.)
      if (i === steps - 2) {
        const offsets = [[-4, -8], [4, -11], [0, 25]];
        G.police.cruisers.forEach((c, k) => {
          const off = offsets[k % offsets.length];
          c.x = G.player.x + off[0];
          c.z = G.player.z + off[1];
          c.heading = G.player.heading;
          c.speed = 42;
          c.sync();
        });
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
    G.setShotInput({ active: false });
    // Pin the dial to 151 km/h for the frozen frame: the throttle-hold
    // oscillates 40.3–42 m/s, so nudge the speed to 41.7 and run one
    // throttle step — the gauge reads the live speed, 151.
    G.player.car.speed = 41.7;
    G.setShotInput({ active: true, up: true, down: false, left: false, right: false, brake: false, run: false, mouse: false });
    G.step(STEP);
    G.setShotInput({ active: false });
    // Pull-back camera: 22 m behind and 5.5 m up, so the two cruisers
    // staged tight behind the player read in frame flanking the CEMPAKA
    // GT, lightbars flashing — the pursuit is visible, not just a panel
    // + minimap. G.draw() would reset to the 5 m chase cam (which puts
    // anything behind the player behind the camera), so render directly.
    const cam = G.view.camera;
    cam.position.set(G.player.x, 5.5, G.player.z - 22);
    cam.lookAt(G.player.x, 1.5, G.player.z + 28);
    // Re-show the mission card (stinger) and the dispatch ticker for the
    // frozen frame: both are live HUD, not posed text.
    G.hud.showStinger(G);
    G.hud.ticker('POLISI: Semua unit — kejar sedan merah di Kawasan Industri!', 60);
    // Hide the dialogue box for the frozen frame: the mission-intro line
    // (Letkol Rahmat, fired by setIndex) sits bottom-centre and covers
    // the left cruiser. Dialogue is still proven in the foot/story shots.
    document.getElementById('dialogue').style.display = 'none';
    G.view.render();
    window.__shotReady = true;
    return { name, seconds, steps };
  } else if (name === 'heat') {
    // Mission 3 RAMPOKAN KECIL: its objective is "Pergi ke Kawasan
    // Industri", so the mission card matches the district in frame, and a
    // robbery at 4.2 stars is the chase the cover is supposed to show.
    G.missions.setIndex(2);
    G.state.cash = 18250;
    G.state.rep = 1250;
    G.player.enterCar(G.parked[0]);
    // HERO frame: the chase runs EAST down the z=111 arterial, from
    // x = -60 toward the industrial junction at x = 111 — straight into
    // the low sun, so the sun disc + halo sit at the end of the avenue,
    // the long shadows stretch back across the road toward the camera,
    // and the mural (west face of the tallest tower south of the
    // arterial, x ~49) reads left-of-centre ahead, clear of the HUD.
    // The camera sits centred over the road, so no single facade fills a
    // third of the frame.
    G.player.car.x = -60;
    G.player.car.z = 106.5;
    G.player.car.heading = Math.PI / 2;
    G.player.car.speed = 30;
    // Six props really broken along the chase path, so the bill is true.
    const alongPath = G.props.props.filter((p) => Math.abs(p.z - 106.5) < 16 && p.x > -60 && p.x < 35);
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
    // Traffic on the same arterial: eastbound cars ahead of the player,
    // westbound cars in the far lane.
    const arterial = [
      { lane: 106.5, x: 30, dir: 1 }, { lane: 106.5, x: 55, dir: 1 },
      { lane: 115.5, x: 40, dir: -1 }, { lane: 115.5, x: 65, dir: -1 },
    ];
    G.traffic.cars.slice(0, arterial.length).forEach((c, k) => {
      const a = arterial[k];
      c.axis = 'x';
      c.lane = a.lane;
      c.dir = a.dir;
      c.x = a.x;
      c.z = a.lane;
      c.heading = a.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      c.cruise = 10 + (k % 2) * 2;
      c.speed = c.cruise;
      c.sync();
      c.repaint(TRAFFIC_PAINT[k % TRAFFIC_PAINT.length]);
    });
    // Pedestrians on the sidewalks beside the chase, scattering as the
    // sirens pass — the frame proves the city has people in it.
    const pedSpots = [[-10, 99.5], [-5, 122.5], [15, 99.5], [25, 122.5], [35, 99.5]];
    G.peds.peds.slice(0, pedSpots.length).forEach((p, k) => {
      p.setPos(pedSpots[k][0], pedSpots[k][1]);
      p.fleeTimer = 0;
    });
    // Side systems in frame, staged ahead of the player's end position
    // (x ≈ 0 after the chase): a taxi passenger waiting on the south
    // sidewalk and a gold wayang idol on the north one — both live, both
    // collectible / hailable, neither in the driving line.
    stageTaxi(G, 'industrialYard', 28, 122);
    stageCollectible(G, 22, 99);
    // No dialogue on the cover: the Pak Wira box sits bottom-centre and
    // covers the hero car. The boss still talks in the drive, foot and
    // story shots — the cover's job is the car and the chase.
    G.hud.toast('', 0.01);
    G.setShotInput({ active: true, up: true, down: false, left: false, right: false, brake: false, run: false, mouse: false });
    G.draw();
    for (let i = 0; i < steps; i += 1) {
      // Drift window (0.75 s): handbrake + steer RIGHT + throttle, one
      // way — a proper slide that ends with the car angled mid-drift. The
      // handbrake is a slide (car.js), so speed stays above 10 m/s and the
      // drift timer reaches its 0.6 s payout on slide end — a genuine
      // NGEPOT popup floats when the frame freezes. The last 0.7 s drives
      // straight again so the car recovers speed.
      if (i >= steps - 87 && i < steps - 42) {
        G.setShotInput({ active: true, up: true, down: false, left: false, right: true, brake: true, run: false, mouse: false });
      } else {
        driveEast(G, STEP, 106.5, 30);
      }
      G.step(STEP);
      if (i === 60) G.peds.fleeFrom(G.player.x, G.player.z, 120);
      // Stage the convoy on the second-to-last step, so one more step runs
      // after the move (HUD distances read the staged spots) and the final
      // frame holds the formation: two cruisers ahead of the player, one
      // alongside behind, and the roadblock sideways across the road ahead.
      if (i === steps - 2) {
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
          rb.heading = Math.PI;
          rb.speed = 0;
          rb.sync();
        }
      }
    }
    // Helicopter staging: pull it in close and low over the road, ahead
    // of the player, nose on the player — big in the upper third, its
    // spotlight cone slanting down to the player and the ground pool
    // under the car, so it reads as a HELICOPTER, not a pale block.
    // (At +45 m / 22 m up it was a small smudge against the sky.)
    const heli = G.police.heli;
    if (heli) {
      heli.group.position.set(G.player.x + 26, 15, G.player.z - 9);
      heli.group.lookAt(G.player.x, 0, G.player.z);
    }
    // Hero camera: 12.5 m back, 5.4 m up — the car is the hero now,
    // bottom-centre at a quarter to a third of the frame. The look target
    // swings east (x+40) and down (y 1.5) so the sun disc at ~11°
    // elevation sits in the upper third, the mural stays ahead-right,
    // and the car lifts off the bottom edge instead of sliding under
    // the dialogue box. Render directly: G.draw() would reset the
    // camera to the chase cam.
    G.setShotInput({ active: false });
    const cam = G.view.camera;
    cam.position.set(G.player.x - 12.5, 5.4, G.player.z + 1.5);
    cam.lookAt(G.player.x + 40, 1.5, G.player.z + 6);
    // Re-show the mission stinger for the frozen frame, and the drift
    // popup the chase really earned (cash 18250 -> 18295, 0.8 s slide)
    // with a 60 s lifetime: popups fade on wall-clock time, and one slow
    // SwiftShader frame outlives the 2.6 s default, so the frozen frame
    // would lose the popup the cover is supposed to prove. Same values,
    // same call the game itself makes when a drift pays — the combo logic
    // makes this re-show read NGEPOT ×2.
    G.hud.showStinger(G);
    G.hud.popups.drift(45, 0.8, 60);
    // Hide the dialogue box for the frozen frame: the mission-intro line
    // (Sari, fired by setIndex) sits bottom-centre and covers the hero
    // car. Dialogue is still proven in the drive, foot and story shots.
    document.getElementById('dialogue').style.display = 'none';
    G.view.render();
    window.__shotReady = true;
    return { name, seconds, steps };
  } else if (name === 'foot') {
    // Mission 2 ANTAR PAKET, survive step at WARUNG SARI (northRowStall):
    // attackers spawn, the player holds the stall with the SMG out.
    G.missions.setIndex(1, 1);
    G.state.cash = 19600;
    G.state.rep = 1960;
    G.state.heat = 0;
    const L = loc('northRowStall');
    // Start 10 m east of the stall (52, 102) so the 2 s walk ends at
    // (39, 102): the WARUNG KOPI sign on the stall's west face sits
    // 5 m ahead of the player at capture, big and readable, instead of
    // right beside him.
    G.player.setPos(L.x + 10, L.z + 6, -Math.PI / 2);
    // Buy the warung for real — the sign swaps to MILIK KAMU — and the
    // SMG + shotgun, so the weapon rail shows two owned slots and two
    // LOCKED ones (the depth advert). The owned CEMPAKA GT parks just
    // west of the stall, in frame.
    const bought = G.usaha.buy('warung', G.state.cash, G.state.rep);
    if (bought.ok) G.state.cash -= bought.price;
    G.player.hasShotgun = true;
    G.player.shells = 12;
    G.player.hasSmg = true;
    G.player.smgAmmo = 30;
    G.player.weapon = 'smg';
    G.parked[0].x = 30;
    G.parked[0].z = 96;
    G.parked[0].heading = 1.2;
    G.parked[0].sync();
    // Clear through-traffic from the frame: a teal Kijang on the x=32.5
    // lane drove right past the warung and stopped (in screen space)
    // exactly over the red CEMPAKA GT, hiding it. Teleport any traffic
    // car near the stall far down its own lane — 60 m radius, so no car
    // can drive back into the frame during the 2 s sim.
    for (const c of G.traffic.cars) {
      if (Math.hypot(c.x - L.x, c.z - L.z) < 60) {
        if (c.axis === 'x') c.x = c.x > L.x ? 170 : -170;
        else c.z = c.z > L.z ? 170 : -170;
        c.sync();
      }
    }
    // Glowing drops in frame: a cash bundle and an ammo crate, live.
    G.drops.spawnCash(L.x - 2, L.z + 10, 35);
    G.drops.spawnAmmo(L.x + 3, L.z + 12, 1);
    // 8–12 pedestrians around the warung, fleeing once the shots ring out.
    // They are staged BEFORE the sim (so the flee is real) and RE-staged
    // after it: two seconds of fleeing scatters them out of the frame,
    // and the shot needs the crowd visible around the stall.
    const pedSpots = [
      [38, 104], [46, 104], [34, 92], [50, 96], [40, 90], [48, 90],
      [36, 106], [52, 100], [42, 108], [44, 88],
    ];
    G.peds.peds.slice(0, pedSpots.length).forEach((p, k) => {
      p.setPos(pedSpots[k][0], pedSpots[k][1]);
      p.fleeTimer = 0;
    });
    G.peds.fleeFrom(G.player.x, G.player.z);
    // A gold idol staged on the player's walking line (he walks -x from
    // (52, 102) toward the warung): he walks over it during the sim, so
    // the collect is real — popup, cash, and the counter reads KOLEKSI 1/24.
    stageCollectible(G, 42, 102);
    // Two real shots downrange so the peds are really fleeing.
    G.setShotInput({ active: true, up: true, down: false, left: false, right: false, brake: false, run: false, mouse: true });
    G.draw();
    for (let i = 0; i < steps; i += 1) {
      G.step(STEP);
      if (i > 70) G.setShotInput({ active: true, up: true, mouse: false });
    }
    // Re-stage the crowd around the warung for the frozen frame — same
    // spots, mid-flee (fleeTimer 3), so the street reads populated.
    G.peds.peds.slice(0, pedSpots.length).forEach((p, k) => {
      p.setPos(pedSpots[k][0], pedSpots[k][1]);
      p.fleeTimer = 3;
    });
    // Re-show the idol popup the walk really earned (counter 1/24, +$60)
    // with a 60 s lifetime, for the same slow-capture reason as the
    // cover's drift popup. The interaction pill is the live prompt text
    // for the mission's package step. Render directly and freeze.
    G.hud.popups.collect(60, 'idol', 60);
    G.hud.prompt('E — Antar paket +$120');
    G.draw();
    window.__shotReady = true;
    return { name, seconds, steps };
  } else {
    // story: the Marina handoff. Mission 8 (PANAS TERAKHIR, the finale)
    // is completed FOR REAL in the staging so the ledger shows the
    // biggest true numbers — gross $1,000, bill $0, BERSIH +$1,000,
    // REP +600. (Mission 1's +$150 ledger understated the game.) Then
    // the mission resets to 8 (BABAK III, red dusk) and Pak Aska
    // delivers the handoff line. Letterbox bars frame the shot.
    G.missions.setIndex(7);
    G.state.cash = 250;
    G.state.rep = 0;
    G.state.heat = 0;
    // Start at Plaza Menara: the goto step is already satisfied there.
    G.player.setPos(0, 0, Math.PI);
    G.draw();
    // Step a few frames for the goto to advance to the survive step.
    for (let i = 0; i < 5; i += 1) G.step(STEP);
    // Survive 30 s for real: 5 attackers spawn and shoot, so boost health
    // to 9999 first (they deal ~1.75 dps each in range — ~260 over the
    // full 30 s would kill a 100-HP player). Restore it after.
    G.player.health = 9999;
    for (let i = 0; i < 1800; i += 1) G.step(STEP);
    G.player.health = 100;
    // Deliver: teleport to the marina (4 m from the beacon, inside its
    // 7 m radius) and step a few frames for the deliver to complete.
    G.player.setPos(-6, -166, Math.PI);
    for (let i = 0; i < 10; i += 1) G.step(STEP);
    // Mission 8 is done (index advanced past the last mission); reset to
    // 8 (BABAK III · MISI 8/8) so the stinger shows the finale. Re-show
    // the stinger explicitly: no more steps run after this, so hud.update
    // never gets the chance to notice the mission changed.
    G.missions.setIndex(7);
    G.hud.showStinger(G);
    G.hud.dialogue('PAK ASKA · PENERIMA MARINA', 'Barang sampai, uang jalan. Marina tidak pernah tidur.', 'aska', 600);
    // The ledger of the mission just completed, re-shown with a 600 s
    // lifetime so the frozen frame keeps it.
    G.hud.reshowLedger(600);
    document.body.classList.add('letterbox');
    stageTaxi(G, 'marina', -2, -158);
    // Foreground fill: pull props and pedestrians into the near band —
    // but to the SIDES of the camera-to-Aska corridor, never in it.
    const fgProps = [[-26, -162], [-24, -168], [2, -158], [4, -165], [-30, -160], [-28, -167], [8, -158], [10, -164], [-2, -174], [4, -176]];
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
    ];
    G.peds.peds.slice(0, fgPeds.length).forEach((p, k) => {
      const s = fgPeds[k];
      p.setPos(s[0], s[1]);
      p.target = { x: s[2], z: s[3] };
    });
    // Two parked cars at the pier's edges: the promenade's near band was
    // bare tan. They sit clear of the camera-to-Aska corridor.
    [G.parked[1], G.parked[2]].forEach((c, k) => {
      if (!c) return;
      c.x = k === 0 ? 16 : -32;
      c.z = k === 0 ? -156 : -162;
      c.heading = k === 0 ? -1.2 : 1.2;
      c.sync();
    });
    // Close, low camera from further west: the player fills the foreground
    // with his back to us, Aska stands just beyond him, and the MARINA
    // sign, the water, the boats and the windowed skyline sit behind them.
    // Aimed east of the sign (lookAt x +2) so the sign slides left of
    // the mission stinger instead of hiding behind it — the sign stands
    // on the same sightline as Aska, so centring on Aska centres the
    // sign behind the card.
    // The crosshair sits at screen centre — dead on top of the ledger
    // card ("+" over the Tagihan row). Hide it for the frozen frame;
    // normal play is untouched (the flag defaults to visible on foot).
    G.hud.setCrosshairVisible(false);
    const cam = G.view.camera;
    cam.position.set(-24, 3.4, -154);
    cam.lookAt(2, 1.0, -172);
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
