// Chase camera: follow + keepClear, one owner. The live game loop and the
// staged shots both run through here, so the camera that dodges buildings
// in play is the same camera the screenshots prove.
//
// keepClear rule (camera-systems skill): if a building stands between the
// camera and the player, pull the camera forward past the obstruction —
// the first clear sample after the blocked stretch — then re-aim. The
// chase camera never ends up inside a wall on a tight street, and a
// staged shot camera never hides the player behind a facade.
//
// The module is stateless: one instance per owner (world.js for the
// view API, player.js for the live follow), all pure functions over the
// city passed in.
import { hitsSolid } from './city.js';

export function createChaseCamera(city) {
  // Core follow: `behind` metres back, `up` high, looking `lookAhead`
  // metres ahead at 1.6 m height — then the keepClear pass.
  function place(camera, x, z, heading, behind, up, lookAhead = 8) {
    const bx = x - Math.sin(heading) * behind;
    const bz = z - Math.cos(heading) * behind;
    camera.position.set(bx, up, bz);
    camera.lookAt(x + Math.sin(heading) * lookAhead, 1.6, z + Math.cos(heading) * lookAhead);
    const dx = x - bx;
    const dz = z - bz;
    let blocked = false;
    for (let s = 0.05; s <= 1; s += 0.05) {
      const inSolid = !!hitsSolid(city, bx + dx * s, bz + dz * s, 1.5);
      if (inSolid) blocked = true;
      else if (blocked) {
        camera.position.set(bx + dx * s, up + (1.6 - up) * s, bz + dz * s);
        camera.lookAt(x + Math.sin(heading) * lookAhead, 1.6, z + Math.cos(heading) * lookAhead);
        break;
      }
    }
  }

  // Car follow: low and close — 5.0 m back, 1.9 m up, look 10 m ahead.
  // The car is the hero of the frame — bottom-centre, a quarter to a
  // third of the width — and the street ahead still reads over its roof.
  function followCar(camera, x, z, heading) {
    place(camera, x, z, heading, 5.0, 1.9, 10);
  }

  // On-foot follow: 4.2 m back (with a 0.8 m side offset so the player
  // never sits dead-centre), 2.4 m up, looking 6 m ahead at 1.4 m.
  // The same keepClear pass runs toward the player's head, so a market
  // stall or a wall never swallows the walker on a tight street.
  function followFoot(camera, x, z, camHeading, heading) {
    const behind = 4.2;
    const bx = x - Math.sin(camHeading) * behind + Math.cos(camHeading) * 0.8;
    const bz = z - Math.cos(camHeading) * behind - Math.sin(camHeading) * 0.8;
    camera.position.set(bx, 2.4, bz);
    camera.lookAt(x + Math.sin(heading) * 6, 1.4, z + Math.cos(heading) * 6);
    const dx = x - bx;
    const dz = z - bz;
    let blocked = false;
    for (let s = 0.05; s <= 1; s += 0.05) {
      const inSolid = !!hitsSolid(city, bx + dx * s, bz + dz * s, 1.5);
      if (inSolid) blocked = true;
      else if (blocked) {
        camera.position.set(bx + dx * s, 2.4 + (1.4 - 2.4) * s, bz + dz * s);
        camera.lookAt(x + Math.sin(heading) * 6, 1.4, z + Math.cos(heading) * 6);
        break;
      }
    }
  }

  // Staged-shot rule: move the camera toward its look target until the
  // segment is clear of buildings. Returns the camera.
  function keepClear(cam, tx, ty, tz) {
    const dx = tx - cam.position.x;
    const dy = ty - cam.position.y;
    const dz = tz - cam.position.z;
    let blocked = false;
    for (let s = 0.05; s <= 1; s += 0.05) {
      const inSolid = !!hitsSolid(city, cam.position.x + dx * s, cam.position.z + dz * s, 1.5);
      if (inSolid) blocked = true;
      else if (blocked) {
        cam.position.set(cam.position.x + dx * s, cam.position.y + dy * s, cam.position.z + dz * s);
        return cam;
      }
    }
    return cam;
  }

  return { place, followCar, followFoot, keepClear };
}
