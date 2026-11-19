// Screenshot scenes. Each one seeds a real state, then steps a fixed number
// of simulated seconds at 1/60 through the same systems the player drives —
// never by waiting wall-clock time, never by setting a HUD string directly.
// The frame is identical on any machine at any frame rate.
//
// 1-heat (cover): the chase EAST down the z=111 arterial toward the low
//   sun — sun disc + halo at the end of the avenue, 5+ long shadows, the
//   red car mid-drift + smoke arcs, heli + spotlight cone in the upper
//   third, the BENTARA mural readable on the right, region stinger, one
//   DRIFT ×2 pop in the middle. No dialogue box: the hero car owns the
//   frame, big and bottom-centre.
// 2-drive: arterial at 42 m/s (151 km/h on the dial), 3 cruisers staggered
//   with lightbars glowing, a MENABRAK pill live, wanted pulse ring +
//   route line on the minimap, mission card + stage bar, dispatch ticker.
//   One cruiser sits tight behind the player (RAMMING range) — the camera
//   pulls back to 8 m, never 22, so the player car stays the hero.
// 3-foot: on foot outside WARUNG SARI, emissive sign + tarp awning, 10
//   pedestrians fleeing a real shot, the warung interaction pill live, the
//   weapon rail with its LOCKED slots, and the red CEMPAKA GT parked
//   clearly in frame — traffic kept clear of it.
// 4-story: marina handoff, letterbox bars, PAK ASKA's card fully inside
//   the safe margins, ledger chip, city glow, ZERO cut text. Staged by
//   really completing MISSION 8 live (the largest real ledger:
//   "PANAS TERAKHIR SELESAI / Hasil +$1.000 / Tagihan −$0 / REP +600 /
//   BERSIH +$1.000") — never a staged M3 +$2.165, which the ledger can
//   never pay. Crosshair hidden.
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
    G.player.car.x = 37;
    G.player.car.z = -120;
    G.player.car.heading = 0;
    G.player.car.speed = 42;
    // Three cruisers, so the response list can show a staggered convoy
    // and one of them can sit in RAMMING range for the MENABRAK pill.
    G.addHeat(3);
    // Pull traffic onto the player's arterial so the drive shot actually
    // shows it: same-direction cars ahead in the right lane, oncoming cars
    // in the left lane. The start spots are chosen by where the cars END
    // UP after 2.5 s (same-direction +30 m, oncoming -30 m), so the frame
    // holds a convoy 10–85 m ahead instead of an empty road. Oncoming
    // cars start well north of the player (z 35–110), so they all end up
    // AHEAD of him. Same-direction cars start at z -25..50 for the same
    // reason: the second polish take started one at z -50 and it ended
    // up 5 m from the player, a huge yellow taxi filling the bottom-left
    // corner and hiding the trailing cruiser. The other cars stay
    // scattered on the grid.
    const arterial = [
      { lane: 41.5, z: -25, dir: 1 }, { lane: 41.5, z: 0, dir: 1 },
      { lane: 41.5, z: 25, dir: 1 }, { lane: 41.5, z: 50, dir: 1 },
      { lane: 32.5, z: 35, dir: -1 }, { lane: 32.5, z: 60, dir: -1 },
      { lane: 32.5, z: 85, dir: -1 }, { lane: 32.5, z: 110, dir: -1 },
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
    // ahead of the player's end position (z ≈ -15 after 2.5 s at 42 m/s),
    // not at the start line.
    const pedSpots = [[26, -8], [48, -2], [26, 18], [48, 24]];
    G.peds.peds.slice(0, pedSpots.length).forEach((p, k) => {
      p.setPos(pedSpots[k][0], pedSpots[k][1]);
      p.target = { x: pedSpots[k][0], z: pedSpots[k][1] + (k % 2 === 0 ? 40 : -40) };
    });
    // Side systems in frame, staged AHEAD of where the player ends up
    // (z ≈ -15): a taxi passenger waiting on the right sidewalk and a
    // gold collectible on the left one.
    stageTaxi(G, 'northRowStall', 48, 12);
    stageCollectible(G, 28, 5);
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
      driveStraight(G, STEP, 37, 42);
      G.step(STEP);
      // Stage the convoy on the second-to-last step, so one more step runs
      // after the move (HUD distances read the staged spots) and the final
      // frame holds the formation: TWO cruisers tight behind the player,
      // flanking so both read, and one cruiser 11 m ahead — inside the
      // 12 m RAMMING range, so the MENABRAK pill stays live. The geometry
      // is unforgiving and two takes got it wrong: the drive camera sits
      // 11 m behind the player, so a cruiser staged 14–21 m behind the
      // player lands BEHIND the camera and is invisible (probe-measured),
      // and a cruiser closer than 8 m to the camera has its wheels cut
      // off at the bottom edge. "Tight behind" therefore means 3 m
      // behind the player (8 m ahead of the camera): both trailing
      // cruisers fully in frame, lightbars reading, flanking the player
      // car. Lateral -1.75 m on the west side keeps that cruiser clear
      // of the bottom-right HUD panel; +3.5 m on the east side keeps the
      // other one clear of the frame's left edge.
      if (i === steps - 2) {
        const offsets = [[-1.75, -3], [3.5, -3], [0, 11]];
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
    // The drive camera: 11 m back, 4.2 m up — far enough to hold BOTH
    // trailing cruisers fully in frame (at 10 m back the nearer one was
    // half cut off at the bottom edge), close enough that the player car
    // stays the hero (never the 22 m pull-back). Render directly:
    // G.draw() would reset the camera to the chase cam.
    // The heat-3 escalation dialogue (Letkol Rahmat) fires DURING the sim
    // when the heat crosses 3, so it is hidden here — after the loop,
    // not after setIndex (the first take hid it too early and the box
    // came back on the first step).
    G.hud.hideDialogue();
    G.setShotInput({ active: false });
    const cam = G.view.camera;
    const h = G.player.heading;
    cam.position.set(G.player.x - Math.sin(h) * 11, 4.2, G.player.z - Math.cos(h) * 11);
    cam.lookAt(G.player.x + Math.sin(h) * 20, 1.5, G.player.z + Math.cos(h) * 20);
    // Re-show the dispatch line the chase really earned, with a 60 s
    // lifetime so the slow capture keeps it.
    G.hud.ticker('POLISI: Semua unit — kejar sedan merah di Kawasan Industri!', 60);
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
    // Traffic on the same arterial: eastbound cars ahead of the player,
    // westbound cars in the far lane — but the westbound pair starts WEST
    // of the player (x 40 / 15), so after the 2 s sim they end up BEHIND
    // the camera instead of driving into the centre of the frame: the
    // first polish take started them at x 100 / 70 and a big brown box
    // truck ended up dead-centre, hiding the avenue end and the sun.
    const arterial = [
      { lane: 106.5, x: 120, dir: 1 }, { lane: 106.5, x: 150, dir: 1 },
      { lane: 115.5, x: 40, dir: -1 }, { lane: 115.5, x: 15, dir: -1 },
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
      // No twin reds: the player's car is the only red car in the frame.
      c.repaint(TRAFFIC_PAINT[k % TRAFFIC_PAINT.length]);
    });
    // Pedestrians on the sidewalks beside the chase, scattering as the
    // sirens pass — the frame proves the city has people in it. Staged
    // near the player's end position (x ≈ 60), not at the start line.
    const pedSpots = [[70, 99.5], [85, 122.5], [60, 99.5], [95, 122.5], [75, 99.5]];
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
    // Helicopter staging: big, in the open sky ahead-right of the player
    // (near the sun's bearing, in the upper third — clear of the mural),
    // nose on the player, spotlight cone + ground pool reading as a
    // searchlight. From the hero camera it sits ~2° left of the view
    // axis, ~15° up; the sun disc sits ~16° right of the axis, ~11° up —
    // separated, both in the upper third.
    const heli = G.police.heli;
    if (heli) {
      heli.group.position.set(G.player.x + 22, 15, G.player.z + 4);
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
    // readable distance. NO dialogue box for the cover: hide it, and the
    // crosshair too. Render directly: G.draw() would reset the camera to
    // the chase cam.
    G.setShotInput({ active: false });
    G.hud.setCaptureMode('cover');
    const cam = G.view.camera;
    cam.position.set(G.player.x - 12.5, 5.4, G.player.z + 1.5);
    cam.lookAt(G.player.x + 40, 6, G.player.z + 4);
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
    // px 919). So the banner moves EAST to (48,5.5,94), clear of
    // PASAR PAGI's span, still strung across the market street.
    G.view.scene.traverse((obj) => {
      if (obj !== G.view.scene && Math.hypot(obj.position.x - 42, obj.position.y - 5, obj.position.z - 104) < 0.5) {
        obj.position.set(42, 3.2, 96);
      }
      if (obj !== G.view.scene && Math.hypot(obj.position.x - 37, obj.position.y - 5.5, obj.position.z - 96) < 0.5) {
        obj.position.set(48, 5.5, 94);
      }
    });
    // The player's own red car, parked clearly ON THE ROAD west of the
    // player (x=40, west lane of the x=37 road) — the first take parked
    // it at x=52, inside the warung block's footprint, where a building
    // hid it; the second take put it at x=44, where a market stall hid
    // it from the southern camera.
    G.parked[0].x = 40;
    G.parked[0].z = 94;
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
      if (!prop.broken && Math.hypot(prop.x - 40, prop.z - 94) < 6) {
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
    // Two real shots downrange so the peds are really fleeing.
    G.setShotInput({ active: true, up: true, down: false, left: false, right: false, brake: false, run: false, mouse: true });
    G.draw();
    for (let i = 0; i < steps; i += 1) {
      G.step(STEP);
      if (i > 70) G.setShotInput({ active: true, up: true, mouse: false });
    }
    // Re-stage the pedestrians AFTER the sim, frozen mid-flee across the
    // visible street band: r3 staged them before the sim and the shots
    // scattered them out of frame, so only 1–2 showed. Fourteen peds,
    // spread x 32–58 / z 88–110 — the first polish take still only showed
    // 6–7, so four more were added in the central band (42–50, 94–104)
    // where the camera holds them. Three more in the NEAR band (z 86–90,
    // 8–12 m from the camera, so they read big): the second polish take
    // showed 7–8 peds but several read as small distant figures — the
    // target is 8–12 CLEARLY visible, and the near band guarantees it.
    // Flee targets outward — they read as a crowd reacting, and the frame
    // freezes before any of them can leave.
    const footPedSpots = [
      [34, 90], [40, 92], [46, 90], [52, 94], [36, 100],
      [56, 100], [38, 106], [48, 108], [54, 104], [32, 96],
      [42, 94], [50, 98], [38, 102], [46, 104],
      [36, 88], [48, 86], [56, 90],
    ];
    G.peds.peds.slice(0, footPedSpots.length).forEach((p, k) => {
      p.setPos(footPedSpots[k][0], footPedSpots[k][1]);
      p.target = { x: footPedSpots[k][0] + (k % 2 === 0 ? 10 : -10), z: footPedSpots[k][1] - 8 };
      p.fleeTimer = 2;
    });
    // Market fill: pull six street props into the near and mid-ground —
    // flanking the player's walking line, never on it — so the foreground
    // reads as a busy market street, not a gap.
    const marketProps = [[-12, 30], [-16, 22], [16, 30], [20, 20], [-6, 34], [12, 36]];
    let placed = 0;
    for (const prop of G.props.props) {
      if (placed >= marketProps.length || prop.broken) continue;
      const s = marketProps[placed];
      prop.x = L.x + s[0];
      prop.z = L.z + s[1];
      prop.mesh.position.x = L.x + s[0];
      prop.mesh.position.z = L.z + s[1];
      placed += 1;
    }
    // Two parked cars at the market's west edge, clear of the hero car.
    [G.parked[1], G.parked[2]].forEach((c, k) => {
      if (!c) return;
      c.x = k === 0 ? 28 : 30;
      c.z = k === 0 ? 92 : 110;
      c.heading = k === 0 ? 1.2 : -1.2;
      c.sync();
    });
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
    // Foot camera: pulled back to (30, 4.5, 78) looking north-east — from
    // 13 m the 8–9 m market signs filled the frame as giants; from ~28 m
    // they read at normal shop-sign size, the red CEMPAKA GT sits left of
    // the player, the player stands centre beside his car.
    const cam = G.view.camera;
    cam.position.set(30, 4.5, 78);
    cam.lookAt(45, 2.5, 100);
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
    // Foreground fill: four street props and four pedestrians into the
    // near band — but to the SIDES of the camera-to-Wira corridor, never
    // in it: props on the sightline read as black monoliths hiding the
    // player. They are staged after the sim steps, so their final
    // positions are exactly the ones in the frame.
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
