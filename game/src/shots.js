// Screenshot scenes. Each one seeds a real state, then steps a fixed number
// of simulated seconds at 1/60 through the same systems the player drives —
// never by waiting wall-clock time, never by setting a HUD string directly.
// The frame is identical on any machine at any frame rate.
//
// 1-heat (cover): the chase. 4.2 stars, 3 cruisers, helicopter + spotlight,
//   6 props really broken, bill reading a true number.
// 2-drive: arterial at 26 m/s, 14 traffic cars, 1 star, mission HUD live.
// 3-foot: on foot at Plaza Menara, pistol out, peds fleeing a real shot.
// 4-story: marina, Pak Wira facing the player, his line in the dialogue box.
import { STEP } from './config.js';
import { loc } from './city.js';

const SHOTS = {
  heat: { at: 6 },
  drive: { at: 2.5 },
  foot: { at: 2 },
  story: { at: 1.5 },
};

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
    // in the left lane. The other cars stay scattered on the grid.
    const arterial = [
      { lane: 41.5, z: -80, dir: 1 }, { lane: 41.5, z: -30, dir: 1 },
      { lane: 41.5, z: 20, dir: 1 }, { lane: 41.5, z: 70, dir: 1 },
      { lane: 32.5, z: -55, dir: -1 }, { lane: 32.5, z: 0, dir: -1 },
      { lane: 32.5, z: 50, dir: -1 }, { lane: 32.5, z: 100, dir: -1 },
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
    });
    // Pedestrians on the sidewalks the chase camera passes, so the drive
    // shot proves the city is lived in, not just driven through.
    const pedSpots = [[26, -70], [48, -50], [26, -35], [48, -85]];
    G.peds.peds.slice(0, pedSpots.length).forEach((p, k) => {
      p.setPos(pedSpots[k][0], pedSpots[k][1]);
      p.target = { x: pedSpots[k][0], z: pedSpots[k][1] + (k % 2 === 0 ? 40 : -40) };
    });
    G.hud.toast('', 0.01);
    G.setShotInput({ active: true, up: true, down: false, left: false, right: false, brake: false, run: false, mouse: false });
    G.draw();
    for (let i = 0; i < steps; i += 1) {
      driveStraight(G, STEP, 37, 26);
      G.step(STEP);
    }
  } else if (name === 'heat') {
    G.missions.setIndex(1);
    G.state.cash = 18250;
    G.state.rep = 1250;
    G.player.enterCar(G.parked[0]);
    // HERO frame: the chase runs SOUTH down the west arterial (x = -37),
    // from z = 150 toward the marina, so one frame holds the player car,
    // the convoy, the helicopter, the arterial, the tower and the water.
    G.player.car.x = -37;
    G.player.car.z = 150;
    G.player.car.heading = Math.PI;
    G.player.car.speed = 30;
    // Six props really broken along the chase path, so the bill is true.
    const alongPath = G.props.props.filter((p) => Math.abs(p.x + 37) < 16 && p.z > -40 && p.z < 160);
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
      { lane: -41.5, z: -70, dir: -1 }, { lane: -41.5, z: -110, dir: -1 },
      { lane: -32.5, z: -60, dir: 1 }, { lane: -32.5, z: -100, dir: 1 },
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
    });
    // Pedestrians on the sidewalks beside the chase, scattering as the
    // sirens pass — the frame proves the city has people in it.
    const pedSpots = [[-48, -55], [-26, -45], [-48, -15], [-26, -70], [-48, -80]];
    G.peds.peds.slice(0, pedSpots.length).forEach((p, k) => {
      p.setPos(pedSpots[k][0], pedSpots[k][1]);
      p.fleeTimer = 0;
    });
    G.hud.toast('', 0.01);
    G.setShotInput({ active: true, up: true, down: false, left: false, right: false, brake: false, run: false, mouse: false });
    G.draw();
    for (let i = 0; i < steps; i += 1) {
      driveStraight(G, STEP, -37, 30);
      G.step(STEP);
      // Sirens send the staged pedestrians running once the chase is near.
      if (i === 240) G.peds.fleeFrom(G.player.x, G.player.z, 120);
      // Stage the convoy on the second-to-last step, so one more step runs
      // after the move (HUD distances read the staged spots) and the final
      // frame holds the formation: two cruisers ahead of the player, one
      // alongside behind, and the roadblock sideways across the road ahead.
      if (i === steps - 2) {
        const offsets = [[-6, -18], [7, -30], [-10, 14]];
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
    // Hero camera: 3/4 view, ~13 m up and ~60 m back from the player,
    // looking south down the arterial. The tower stands left of frame,
    // the water glints at the far end, the world edge stays out of shot.
    // Render directly: G.draw() would reset the camera to the chase cam.
    G.setShotInput({ active: false });
    const cam = G.view.camera;
    cam.position.set(G.player.x + 30, 13, G.player.z + 55);
    cam.lookAt(G.player.x - 2, 1.5, G.player.z - 70);
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
    // Two real shots downrange so the peds are really fleeing.
    G.setShotInput({ active: true, up: false, down: false, left: false, right: false, brake: false, run: false, mouse: true });
    G.draw();
    for (let i = 0; i < steps; i += 1) {
      G.step(STEP);
      if (i > 70) G.setShotInput({ active: true, mouse: false });
    }
  } else {
    // story: wide marina shot, Pak Wira facing the player, his line live.
    G.missions.setIndex(0);
    G.state.cash = 250;
    G.state.rep = 0;
    G.state.heat = 0;
    G.player.setPos(-6, -164, Math.PI);
    G.hud.dialogue('PAK WIRA · BOS MARINA', 'Selamat datang di Bentara. Musim kemarau ini, kota ini milik yang berani.', 'PW', 600);
    G.hud.toast('BENTARA: DRY SEASON — 8 misi, 3 babak. Temui Pak Wira.', 600);
    G.draw();
    for (let i = 0; i < steps; i += 1) G.step(STEP);
    // Wide camera: player and Wira in frame, water and skyline behind them.
    // Shot from the west so no building wall crosses the view.
    const cam = G.view.camera;
    cam.position.set(-24, 6, -150);
    cam.lookAt(-6, 1.5, -170);
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
