// Screenshot scenes. Each one seeds a real state, then steps a fixed number
// of simulated seconds at 1/60 through the same systems the player drives —
// never by waiting wall-clock time, never by setting a HUD string directly.
// The frame is identical on any machine at any frame rate.
//
// 1-heat (cover): the chase. 4.2 stars, 3 cruisers, helicopter + spotlight,
//   6 props really broken, bill reading a true number — plus the new pass:
//   Pak Wira's portrait + dialogue in the dialogue box, a taxi passenger
//   waiting on the sidewalk, a gold collectible by the road, and a real
//   DRIFT popup earned by a handbrake slide in the last second.
//   Staged AT the Kawasan Industri intersection (x = 111 arterial, z = 111):
//   the chase runs SOUTH down the arterial and ends on the junction, camera
//   centred over the road so no single facade can fill a third of the frame.
//   The mural (tallest building, west face) is in frame on the right.
// 2-drive: arterial at 26 m/s, 22 traffic cars, 1 star, mission HUD live —
//   plus a taxi passenger waiting on the sidewalk and a collectible by the
//   road, so the drive shot proves the side systems exist.
// 3-foot: on foot at Plaza Menara, pistol out, peds fleeing a real shot —
//   plus a collectible staged in the player's path, really collected, so
//   the counter reads KOLEKSI 1/24 and a real collect popup floats.
// 4-story: marina, Pak Wira facing the player, his line in the dialogue
//   box WITH his painted portrait, a taxi passenger waiting by the pier.
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
    G.player.car.speed = 26;
    G.addHeat(1);
    // Pull traffic onto the player's arterial so the drive shot actually
    // shows it: same-direction cars ahead in the right lane, oncoming cars
    // in the left lane. The start spots are chosen by where the cars END
    // UP after 2.5 s (same-direction +30 m, oncoming -30 m), so the frame
    // holds a convoy 10–85 m ahead instead of an empty road. The other
    // cars stay scattered on the grid.
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
      // No twin reds: the player's car is the only red car in the frame.
      c.repaint(TRAFFIC_PAINT[k % TRAFFIC_PAINT.length]);
    });
    // Pedestrians on the sidewalks the chase camera passes, so the drive
    // shot proves the city is lived in, not just driven through. Staged
    // ahead of the player's end position (z ≈ -55), not at the start line.
    const pedSpots = [[26, -42], [48, -35], [26, -12], [48, -5]];
    G.peds.peds.slice(0, pedSpots.length).forEach((p, k) => {
      p.setPos(pedSpots[k][0], pedSpots[k][1]);
      p.target = { x: pedSpots[k][0], z: pedSpots[k][1] + (k % 2 === 0 ? 40 : -40) };
    });
    // Side systems in frame, staged AHEAD of where the player ends up
    // (z ≈ -55 after 2.5 s at 26 m/s): a taxi passenger waiting on the
    // right sidewalk and a gold collectible on the left one. Staging them
    // at the start line put them behind the camera.
    stageTaxi(G, 'northRowStall', 48, -18);
    stageCollectible(G, 28, -25);
    G.hud.toast('', 0.01);
    G.setShotInput({ active: true, up: true, down: false, left: false, right: false, brake: false, run: false, mouse: false });
    G.draw();
    for (let i = 0; i < steps; i += 1) {
      driveStraight(G, STEP, 37, 26);
      G.step(STEP);
    }
  } else if (name === 'heat') {
    // Mission 3 RAMPOKAN KECIL: its objective is "Pergi ke Kawasan
    // Industri", so the mission panel matches the district in frame, and a
    // robbery at 4.2 stars is the chase the cover is supposed to show.
    G.missions.setIndex(2);
    G.state.cash = 18250;
    G.state.rep = 1250;
    G.player.enterCar(G.parked[0]);
    // HERO frame: the chase runs SOUTH down the east arterial (x = 111),
    // from z = 190 to z = 130, ending on the approach to the Kawasan
    // Industri intersection at z = 111, so one frame holds the player car,
    // the convoy, the helicopter, the junction (zebra, lane arrows, STOP
    // signs) and the industrial blocks — and the camera sits centred over
    // the road, so no single facade fills a third of the frame the way the
    // Plaza wall did in v1.3. The run ends north of the intersection's
    // corner trees: ending on the junction itself put a tree crown dead on
    // the sightline and hid the player car (v1.4 takes 1-2).
    G.player.car.x = 106.5;
    G.player.car.z = 190;
    G.player.car.heading = Math.PI;
    G.player.car.speed = 30;
    // Six props really broken along the chase path, so the bill is true.
    const alongPath = G.props.props.filter((p) => Math.abs(p.x - 106.5) < 16 && p.z > 125 && p.z < 195);
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
    // Traffic on the same arterial: southbound cars ahead of the player,
    // oncoming cars in the far lane.
    const arterial = [
      { lane: 106.5, z: 70, dir: -1 }, { lane: 106.5, z: 30, dir: -1 },
      { lane: 115.5, z: 80, dir: 1 }, { lane: 115.5, z: 40, dir: 1 },
    ];
    G.traffic.cars.slice(0, arterial.length).forEach((c, k) => {
      const a = arterial[k];
      c.axis = 'z';
      c.lane = a.lane;
      c.dir = a.dir;
      c.x = a.lane;
      c.z = a.z;
      c.heading = a.dir > 0 ? 0 : Math.PI;
      c.cruise = 10 + (k % 2) * 2;
      c.speed = c.cruise;
      c.sync();
      // No twin reds: the player's car is the only red car in the frame.
      c.repaint(TRAFFIC_PAINT[k % TRAFFIC_PAINT.length]);
    });
    // Pedestrians on the sidewalks beside the chase, scattering as the
    // sirens pass — the frame proves the city has people in it.
    const pedSpots = [[99.5, 130], [122.5, 120], [99.5, 100], [122.5, 90], [99.5, 80]];
    G.peds.peds.slice(0, pedSpots.length).forEach((p, k) => {
      p.setPos(pedSpots[k][0], pedSpots[k][1]);
      p.fleeTimer = 0;
    });
    // New systems in frame, staged ahead of the player's end position
    // (z ≈ 116 after the chase): a taxi passenger waiting on the east
    // sidewalk and a gold wayang idol on the west one — both live, both
    // collectible / hailable, neither in the driving line.
    stageTaxi(G, 'industrialYard', 121, 118);
    stageCollectible(G, 99, 122);
    // Pak Wira on the radio, portrait and all: the cover shows the boss
    // talking while the chase runs. 600 s so the box never times out.
    G.hud.dialogue('PAK WIRA · BOS MARINA', 'Jangan berhenti. Polisi itu cuma angin — kamu yang punya jalan.', 'wira', 600);
    G.hud.toast('', 0.01);
    G.setShotInput({ active: true, up: true, down: false, left: false, right: false, brake: false, run: false, mouse: false });
    G.draw();
    for (let i = 0; i < steps; i += 1) {
      // Drift window (0.75 s): handbrake + steer RIGHT + throttle, one
      // way — a proper slide that ends with the car angled mid-drift. (A
      // two-way wag overcorrected west to the road edge; a one-way slide
      // from the west lane ends near the centreline.) The handbrake is a
      // slide (car.js), so speed stays above 10 m/s and the drift timer
      // reaches its 0.6 s payout on slide end — a genuine DRIFT popup
      // floats when the frame freezes. The last 0.7 s drives straight
      // again so the car recovers speed.
      if (i >= steps - 87 && i < steps - 42) {
        G.setShotInput({ active: true, up: true, down: false, left: false, right: true, brake: true, run: false, mouse: false });
      } else {
        driveStraight(G, STEP, 106.5, 30);
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
        const offsets = [[-6, -18], [7, -30], [-9, -8]];
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
          rb.x = G.player.x;
          rb.z = G.player.z - 46;
          rb.heading = Math.PI / 2;
          rb.speed = 0;
          rb.sync();
        }
      }
    }
    // Helicopter staging (v1.5): the live hover sits ahead-left of the
    // player, so from the chase camera it lands against the west facades
    // as a dark blob, not a helicopter. Pull it over the road itself,
    // closer and lower, nose on the player, so it reads as a helicopter
    // with its spotlight beam on the player — big, lit, and in the open
    // sky above the road instead of half-hidden against a building.
    const heli = G.police.heli;
    if (heli) {
      heli.group.position.set(G.player.x + 8, 13, G.player.z - 16);
      heli.group.lookAt(G.player.x, 0, G.player.z);
    }
    // Hero camera (v2): 18 m back, 8 m up — far enough that the mural on
    // the east building (z ≈ 134) sits ahead of the camera instead of
    // behind it, close enough that the car still reads at ~20% of the
    // frame. The look target swings east (x+24) to keep the car left of
    // the dialogue box and the mural upper-right. Render directly: G.draw()
    // would reset the camera to the chase cam.
    G.setShotInput({ active: false });
    const cam = G.view.camera;
    cam.position.set(G.player.x + 2, 8, G.player.z + 18);
    cam.lookAt(G.player.x + 24, 2, G.player.z - 50);
    G.view.render();
    window.__shotReady = true;
    return { name, seconds, steps };
  } else if (name === 'foot') {
    G.missions.setIndex(4, 1);
    G.state.cash = 19600;
    G.state.rep = 1960;
    G.state.heat = 0;
    const L = loc('towerConcourse');
    G.player.setPos(L.x + 4, L.z + 12, 0.38);
    G.player.weapon = 'pistol';
    // Three peds right in front of the player, so the fleeing is in frame.
    const pedSpots = [[8, 26], [2, 30], [12, 24]];
    G.peds.peds.slice(0, 3).forEach((p, k) => {
      p.setPos(L.x + pedSpots[k][0], L.z + pedSpots[k][1]);
      p.fleeTimer = 0;
    });
    G.peds.fleeFrom(G.player.x, G.player.z);
    // A gold idol staged on the player's walking line (heading 0.38 drifts
    // him +x as he walks +z): he walks over it during the sim, so the
    // collect is real — popup, cash, and the counter reads KOLEKSI 1/24.
    stageCollectible(G, L.x + 5, L.z + 16);
    // Two real shots downrange so the peds are really fleeing.
    G.setShotInput({ active: true, up: true, down: false, left: false, right: false, brake: false, run: false, mouse: true });
    G.draw();
    for (let i = 0; i < steps; i += 1) {
      G.step(STEP);
      if (i > 70) G.setShotInput({ active: true, up: true, mouse: false });
    }
  } else {
    // story: wide marina shot, Pak Wira facing the player, his line live
    // with his painted portrait in the dialogue box — and a taxi passenger
    // waiting by the pier, so the marina reads as a working place.
    G.missions.setIndex(0);
    G.state.cash = 250;
    G.state.rep = 0;
    G.state.heat = 0;
    G.player.setPos(-6, -164, Math.PI);
    G.hud.dialogue('PAK WIRA · BOS MARINA', 'Selamat datang di Bentara. Musim kemarau ini, kota ini milik yang berani.', 'wira', 600);
    G.hud.toast('BENTARA: DRY SEASON — 8 misi, 3 babak. Temui Pak Wira.', 600);
    stageTaxi(G, 'marina', -2, -158);
    G.draw();
    for (let i = 0; i < steps; i += 1) G.step(STEP);
    // Foreground fill (v2): the wide angle left the bottom half as bare
    // beige promenade. Pull four street props and four pedestrians into the
    // near band — but to the SIDES of the camera-to-Wira corridor, never
    // in it: v1.5 put them on the sightline and they read as black
    // monoliths hiding the player. They are staged after the sim steps,
    // so their final positions are exactly the ones in the frame.
    const fgProps = [[-26, -162], [-24, -168], [2, -158], [4, -165]];
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
    ];
    G.peds.peds.slice(0, fgPeds.length).forEach((p, k) => {
      const s = fgPeds[k];
      p.setPos(s[0], s[1]);
      p.target = { x: s[2], z: s[3] };
    });
    // Close, low camera from further west: the player fills the foreground
    // with his back to us, Wira stands just beyond him, and the MARINA
    // sign, the water, the boats and the windowed skyline sit behind them.
    // Shot from the west so no building wall crosses the view, and far
    // enough west that the player does not line up behind the sign's east
    // post. (A closer camera clipped the MARINA sign out of the top of
    // the frame, so the camera stays here.)
    const cam = G.view.camera;
    cam.position.set(-20, 3.6, -156);
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
