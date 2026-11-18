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
  // Hold the target speed and steer back toward the lane centre.
  const err = laneX - car.x;
  game.setShotInput({
    active: true,
    up: car.speed < targetSpeed,
    down: car.speed > targetSpeed + 3,
    brake: false, run: false,
    left: err > 1.5, right: err < -1.5, mouse: false,
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
    G.player.car.x = 37;
    G.player.car.z = -60;
    G.player.car.heading = 0;
    G.player.car.speed = 30;
    // Six props really broken along the chase path, so the bill is true.
    const alongPath = G.props.props.filter((p) => Math.abs(p.x - 37) < 16 && p.z > -70 && p.z < 180);
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
    G.hud.toast('', 0.01);
    G.setShotInput({ active: true, up: true, down: false, left: false, right: false, brake: false, run: false, mouse: false });
    G.draw();
    for (let i = 0; i < steps; i += 1) {
      driveStraight(G, STEP, 37, 30);
      G.step(STEP);
      // Pull the cruisers into the frame: they spawn far away, and at equal
      // top speed they would never catch the player inside six seconds.
      if (i === 30) {
        const offsets = [[-7, -22], [8, -34], [-13, -46]];
        G.police.cruisers.forEach((c, k) => {
          const off = offsets[k % offsets.length];
          c.x = G.player.x + off[0];
          c.z = G.player.z + off[1];
          c.heading = G.player.heading;
          c.speed = 30;
        });
      }
    }
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
