// render3d/fallback2d.js — the 2D fallback renderer.
//
// When the WebGL context cannot be created (old hardware, blocked GPU,
// no SwiftShader), the game still opens instead of a black page: a real
// top-down 2D canvas of the SAME city — road grid, marina water,
// blocks, the 8 numbered mission spots, the gold M8 route, the player
// arrow, owned-property $ blips — beside the live state from the save
// (cash, REP, mission, KEMAJUAN). It reads the same city data
// (city.js buildCity + roadLines) and the same save (save.js) as the 3D
// game, so it is a fallback OF the game, not a placeholder image. The
// mission-target ring pulses on the clock, so the loop is visibly alive.
//
// Wiring (main.js): try createGame(); on WebGL failure — or with
// ?fallback2d=1 for QA — mount this on the same #view canvas instead.
// QA forces it and asserts a frame renders (pixels + ready flag).
import { LOCATIONS, roadLines, buildCity } from '../city.js';
import { routeWaypoints } from '../gpsRoute.js';
import { loadGame } from '../save.js';
import { MISSIONS } from '../missions.js';
import { missionProgress } from '../progress.js';
import { mulberry32 } from '../rng.js';

// The 8 numbered spots, in first-visit order (same table as
// mapScreen.js — the numbers ARE the mission map).
const MARKERS = [
  ['marina', 1], ['northRowStall', 2], ['industrialYard', 3],
  ['eastSafehouse', 4], ['shophouseRow', 5], ['towerConcourse', 6],
  ['hospital', 7], ['arterialJunction', 8],
];

const USAHA_SPOTS = {
  warung: { x: 42, z: 96 },
  kakiLima: { x: 0, z: 0 },
  slip: { x: -6, z: -170 },
};

export function createFallback2d(canvas, { seed = 7 } = {}) {
  const ctx = canvas.getContext('2d');
  const city = buildCity(mulberry32(seed));
  const save = loadGame() || {};
  const state = {
    cash: save.cash ?? 250,
    rep: save.rep ?? 0,
    missionIndex: save.missionIndex ?? 0,
    collected: save.collected ?? 0,
    raceBest: save.raceBest ?? null,
    usahaOwned: (save.usaha && save.usaha.owned) || [],
    garageOwned: (save.garage && save.garage.owned) || [],
  };
  const missions = {
    index: Math.min(state.missionIndex, MISSIONS.length - 1),
    done: state.missionIndex >= MISSIONS.length,
  };
  const mp = missionProgress(missions);
  const current = MISSIONS[missions.index] || MISSIONS[0];
  const targetKey = MARKERS[Math.min(missions.index, MARKERS.length - 1)][0];
  const target = LOCATIONS[targetKey];

  let raf = 0;
  let ready = false;
  let frames = 0;
  let lastT = 0;

  function resize() {
    const w = window.innerWidth || 1280;
    const h = window.innerHeight || 720;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function drawMap(x0, y0, size, t) {
    const s = size / 440;
    const ox = x0 + size / 2;
    const oy = y0 + size / 2;
    const px = (x) => ox + x * s;
    const py = (z) => oy - z * s;
    ctx.fillStyle = '#10161d';
    ctx.fillRect(x0, y0, size, size);
    // Marina water along the south edge.
    ctx.fillStyle = '#14424a';
    ctx.fillRect(x0, py(-194), size, y0 + size - py(-194));
    // Road grid.
    ctx.strokeStyle = '#8a9aa8';
    ctx.lineWidth = 5;
    for (const c of roadLines()) {
      ctx.beginPath(); ctx.moveTo(x0, py(c)); ctx.lineTo(x0 + size, py(c)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px(c), y0); ctx.lineTo(px(c), y0 + size); ctx.stroke();
    }
    // Blocks.
    ctx.fillStyle = '#0d1218';
    for (const b of city.blocks) ctx.fillRect(px(b.x - 22), py(b.z + 22), 44 * s, 44 * s);
    // Tower landmark at the plaza.
    ctx.fillStyle = '#cfc0a0';
    ctx.fillRect(px(-9), py(9), 18 * s, 18 * s);
    // M8 gold route: Plaza Menara -> Marina.
    const route = routeWaypoints({ x: 0, z: 0 }, { x: -6, z: -170 });
    ctx.strokeStyle = 'rgba(255, 215, 94, 0.95)';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(px(route[0].x), py(route[0].z));
    for (let i = 1; i < route.length; i += 1) ctx.lineTo(px(route[i].x), py(route[i].z));
    ctx.stroke();
    // Safehouse / shop / garage dots.
    const dot = (x, z, color, r = 5) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px(x), py(z), r, 0, Math.PI * 2);
      ctx.fill();
    };
    dot(150, -60, '#2fbf71', 6);
    dot(-70, -140, '#4a90d9', 6);
    dot(120, 74, '#c0392b', 6);
    // Owned properties: gold $ blips (from the real save).
    for (const id of state.usahaOwned) {
      const spot = USAHA_SPOTS[id];
      if (!spot) continue;
      ctx.fillStyle = '#ffd75e';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', px(spot.x), py(spot.z) + 6);
    }
    // Mission markers: numbered gold circles.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const [key, n] of MARKERS) {
      const L = LOCATIONS[key];
      ctx.fillStyle = '#ffd75e';
      ctx.beginPath();
      ctx.arc(px(L.x), py(L.z), 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#140a08';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillText(String(n), px(L.x), py(L.z) + 1);
    }
    // Pulsing ring on the current mission target — the loop is alive.
    const pulse = 16 + Math.sin(t * 2.4) * 4;
    ctx.strokeStyle = 'rgba(255, 215, 94, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(px(target.x), py(target.z), pulse, 0, Math.PI * 2);
    ctx.stroke();
    // Player arrow at the current mission spot.
    ctx.save();
    ctx.translate(px(target.x), py(target.z));
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#10161d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(7, 8);
    ctx.lineTo(-7, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // N compass.
    ctx.fillStyle = '#ffd75e';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText('N', x0 + size - 24, y0 + 22);
    // Legend, top-left.
    const legend = [
      ['●', '#ffd75e', '1–8 MISI'], ['─', '#ffd75e', 'RUTE M8'],
      ['●', '#2fbf71', 'SAFEHOUSE'], ['●', '#4a90d9', 'TOKO SENJATA'],
      ['●', '#c0392b', 'BENGKEL'], ['$', '#ffd75e', 'PROPERTI'],
      ['➤', '#ffffff', 'KAMU'],
    ];
    ctx.fillStyle = 'rgba(10,15,20,0.85)';
    ctx.fillRect(x0 + 10, y0 + 10, 195, 80);
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    const colX = [x0 + 22, x0 + 122];
    legend.forEach(([sym, color, label], i) => {
      const col = i < 4 ? 0 : 1;
      const row = i % 4;
      const y = y0 + 28 + row * 17;
      ctx.fillStyle = color;
      ctx.fillText(sym, colX[col], y);
      ctx.fillStyle = '#f3e6c8';
      ctx.fillText(label, colX[col] + 14, y);
    });
  }

  function render(now) {
    resize();
    const w = canvas.width;
    const h = canvas.height;
    const t = (now || performance.now()) / 1000;
    lastT = t;
    ctx.fillStyle = '#0d1218';
    ctx.fillRect(0, 0, w, h);
    const mapSize = Math.min(h - 40, 680);
    drawMap(20, (h - mapSize) / 2, mapSize, t);
    // Right panel: title + live state from the save.
    const x = 20 + mapSize + 28;
    const pw = w - x - 20;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#ffd75e';
    ctx.font = '800 30px system-ui, sans-serif';
    ctx.fillText('BENTARA', x, 90);
    ctx.fillStyle = '#f3e6c8';
    ctx.font = '400 15px system-ui, sans-serif';
    ctx.fillText('DRY SEASON — MODE 2D', x, 116);
    ctx.font = '400 13px system-ui, sans-serif';
    ctx.fillStyle = '#ffb14d';
    ctx.fillText('WebGL tidak tersedia — peta 2D dari kota yang sama.', x, 142);
    const rows = [
      ['KAS', `$${Math.round(state.cash).toLocaleString('en-US')}`],
      ['REP', `${Math.round(state.rep)}`],
      ['MISI', missions.done ? '8/8 — SELESAI' : `${missions.index + 1}/8 — ${current.title}`],
      ['KEMAJUAN', `${mp.pct}% (${mp.done}/8 misi)`],
      ['KOLEKSI', `${state.collected}/24`],
      ['ASET', `${state.usahaOwned.length}/3 properti · ${state.garageOwned.length} mobil`],
      ['BALAPAN', state.raceBest !== null && state.raceBest !== undefined ? `TERBAIK ${Number(state.raceBest).toFixed(1)} dtk` : 'belum ada catatan'],
    ];
    ctx.font = '400 15px system-ui, sans-serif';
    let y = 190;
    for (const [k, v] of rows) {
      ctx.fillStyle = '#8a9aa8';
      ctx.fillText(k, x, y);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(v, x + 110, y);
      y += 30;
    }
    ctx.fillStyle = '#8a9aa8';
    ctx.font = 'italic 13px system-ui, sans-serif';
    ctx.fillText('Buka di perangkat dengan WebGL untuk mode 3D penuh.', x, y + 16);
    frames += 1;
    ready = true;
  }

  function loop(now) {
    render(now);
    raf = requestAnimationFrame(loop);
  }

  return {
    get ready() { return ready; },
    get frames() { return frames; },
    get state() { return state; },
    render(now) { render(now); },
    start() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    },
    stop() { cancelAnimationFrame(raf); },
  };
}
