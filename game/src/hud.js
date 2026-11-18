// HUD: every DOM panel, updated from the real game state — never by setting a
// string directly from a shot script. The bill panel is throttled to 10 Hz.
//
// This pass rebuilds the two things the top-10 study called placeholders:
// the minimap is now a dark circular radar (road graph, player arrow,
// objective marker, police blips, search ring, N compass) and the speed bar
// is a circular gauge (needle, gear, condition arc). A 3-slot weapon strip,
// a collectible counter, a taxi meter line, score popups and a "DI PANDANG"
// flash sit beside them.
import { LOCATIONS } from './city.js';
import { WEAPONS, SHOTGUN_SHELLS_PRICE, DJ_LINES, CHARACTERS } from './config.js';
import { roadLines } from './city.js';
import { drawPortrait } from './dialogue.js';
import { createPopups } from './popups.js';

const REP_TITLES = ['ANAK BARU', 'RUNNER', 'BENTARA', 'RAJA KEMARAU', 'LEGENDA', 'DEWA MARINA'];
const REP_STEPS = [0, 400, 1000, 2000, 3500, 6000];
const SONGS = [
  'Musim Kering — Senja Bentara',
  'Debu Arteri — Kijang Liar',
  'Angin Timur — Ruko Blues',
  'Plaza 16:00 — Matahari Retak',
];

export function repLevel(rep) {
  let level = 1;
  for (let i = 0; i < REP_STEPS.length; i += 1) if (rep >= REP_STEPS[i]) level = i + 1;
  return level;
}
export function repTitle(rep) { return REP_TITLES[repLevel(rep) - 1]; }

function districtName(x, z) {
  let best = null;
  let bestD = 55 * 55;
  for (const L of Object.values(LOCATIONS)) {
    const dx = L.x - x;
    const dz = L.z - z;
    const d = dx * dx + dz * dz;
    if (d < bestD) { bestD = d; best = L.label; }
  }
  if (best) return best.toUpperCase();
  if (z < -120) return 'MARINA BENTARA';
  if (x > 100) return 'KAWASAN INDUSTRI';
  if (z > 100) return 'BARIS UTARA';
  if (Math.abs(x) < 40 && Math.abs(z) < 40) return 'PLAZA MENARA';
  if (x < -100) return 'DERET RUKO';
  return 'BENTARA TENGAH';
}

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const els = {
    missionTitle: $('missionTitle'), missionObj: $('missionObj'),
    missionStageFill: $('missionStageFill'), missionNext: $('missionNext'),
    repText: $('repText'), repFill: $('repFill'),
    cashText: $('cashText'), clockText: $('clockText'), starsBox: $('starsBox'),
    seenFlash: $('seenFlash'),
    policeBox: $('policeBox'), policeRows: $('policeRows'),
    billBox: $('billBox'), billRows: $('billRows'), billTotal: $('billTotal'),
    minimap: $('minimap'), locName: $('locName'),
    dialogue: $('dialogue'), dialogueLine: $('dialogueLine'), portraitCanvas: $('portraitCanvas'),
    toast: $('toast'), prompt: $('prompt'), popups: $('popups'),
    gauge: $('gauge'), vehicleName: $('vehicleName'),
    radioLine: $('radioLine'), weaponBox: $('weaponBox'),
    collectText: $('collectText'), taxiText: $('taxiText'),
    crosshair: $('crosshair'), screen: $('screen'), status: $('status'),
  };
  const mapCtx = els.minimap.getContext('2d');
  const gaugeCtx = els.gauge.getContext('2d');
  const popups = createPopups(els.popups);
  let billTimer = 0;
  let toastTimer = 0;
  let dialogueTimer = 0;
  let songIndex = 0;
  let songTimer = 24;
  let djIndex = 0;

  function starsHtml(heat) {
    const full = Math.floor(heat);
    let html = '';
    for (let i = 0; i < 5; i += 1) {
      html += `<span class="${i < full ? '' : 'off'}">★</span>`;
    }
    return html;
  }

  // Circular radar: dark disc, road graph, blocks, water, then the live
  // layer — objective, police, collectibles, taxi, player arrow, search
  // ring and the N compass on the rim.
  function drawMinimap(G) {
    const W = 200;
    const R = 98;
    const s = (R * 2) / 420;
    const px = (x) => 100 + x * s;
    const py = (z) => 100 - z * s;
    mapCtx.clearRect(0, 0, W, W);
    mapCtx.save();
    mapCtx.beginPath();
    mapCtx.arc(100, 100, R, 0, Math.PI * 2);
    mapCtx.clip();
    mapCtx.fillStyle = '#10161d';
    mapCtx.fillRect(0, 0, W, W);
    // Marina water along the south edge.
    mapCtx.fillStyle = '#14424a';
    mapCtx.fillRect(0, py(-194), W, W - py(-194));
    // Road graph: light lines on the dark disc.
    mapCtx.strokeStyle = '#5a6a78';
    mapCtx.lineWidth = 5;
    for (const c of roadLines()) {
      mapCtx.beginPath(); mapCtx.moveTo(0, py(c)); mapCtx.lineTo(W, py(c)); mapCtx.stroke();
      mapCtx.beginPath(); mapCtx.moveTo(px(c), 0); mapCtx.lineTo(px(c), W); mapCtx.stroke();
    }
    mapCtx.fillStyle = '#1d2833';
    for (const b of G.city.blocks) mapCtx.fillRect(px(b.x - 22), py(b.z + 22), 44 * s, 44 * s);
    const dot = (x, z, color, r = 3) => {
      mapCtx.fillStyle = color;
      mapCtx.beginPath();
      mapCtx.arc(px(x), py(z), r, 0, Math.PI * 2);
      mapCtx.fill();
    };
    dot(150, -60, '#2fbf71', 4); // safehouse
    dot(-70, -140, '#4a90d9', 4); // shop
    // Collectibles: tiny gold dots, so the radar advertises the hunt.
    if (G.collectibles) {
      for (const item of G.collectibles.remaining()) dot(item.x, item.z, '#ffd75e', 1.8);
    }
    // Taxi: teal dot at the waiting passenger, teal ring at the destination.
    if (G.taxi) {
      if (G.taxi.state === 'waiting' && G.taxi.passenger) dot(G.taxi.passenger.x, G.taxi.passenger.z, '#2fd8c8', 4);
      if (G.taxi.state === 'riding' && G.taxi.destination) {
        mapCtx.strokeStyle = '#2fd8c8';
        mapCtx.lineWidth = 2;
        mapCtx.beginPath();
        mapCtx.arc(px(G.taxi.destination.x), py(G.taxi.destination.z), 6, 0, Math.PI * 2);
        mapCtx.stroke();
      }
    }
    // Race gate, when a race is running.
    if (G.race && G.race.active && G.race.nextGate) {
      mapCtx.strokeStyle = '#ffd75e';
      mapCtx.lineWidth = 2;
      mapCtx.beginPath();
      mapCtx.arc(px(G.race.nextGate.x), py(G.race.nextGate.z), 6, 0, Math.PI * 2);
      mapCtx.stroke();
    }
    // Objective: pulsing gold diamond.
    if (!G.missions.done) {
      const L = G.missionTarget();
      const pulse = 4 + Math.sin(performance.now() / 300) * 1.5;
      mapCtx.fillStyle = '#ffd75e';
      mapCtx.save();
      mapCtx.translate(px(L.x), py(L.z));
      mapCtx.rotate(Math.PI / 4);
      mapCtx.fillRect(-pulse / 2, -pulse / 2, pulse, pulse);
      mapCtx.restore();
    }
    // Police blips: red in pursuit, orange when searching.
    for (const u of G.policeUnits()) {
      dot(u.x, u.z, u.status === 'SEARCHING' ? '#ff9d5c' : '#ff3b2e', 3.5);
    }
    // Traffic: faint grey dots, so the radar shows the city is busy.
    for (const c of G.traffic.cars) dot(c.x, c.z, '#7a8a98', 1.6);
    // Search ring: a dashed red circle around the player while wanted.
    if (G.state.heat >= 1) {
      mapCtx.strokeStyle = 'rgba(255, 59, 46, 0.8)';
      mapCtx.lineWidth = 2;
      mapCtx.setLineDash([6, 5]);
      mapCtx.beginPath();
      mapCtx.arc(px(G.player.x), py(G.player.z), 26, 0, Math.PI * 2);
      mapCtx.stroke();
      mapCtx.setLineDash([]);
    }
    // Player arrow, rotated by heading.
    mapCtx.save();
    mapCtx.translate(px(G.player.x), py(G.player.z));
    mapCtx.rotate(-G.player.heading);
    mapCtx.fillStyle = '#ffffff';
    mapCtx.strokeStyle = '#10161d';
    mapCtx.lineWidth = 1.5;
    mapCtx.beginPath();
    mapCtx.moveTo(0, -8);
    mapCtx.lineTo(5.5, 6);
    mapCtx.lineTo(-5.5, 6);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.stroke();
    mapCtx.restore();
    mapCtx.restore();
    // Rim: dark ring + N compass at the top.
    mapCtx.strokeStyle = 'rgba(255,255,255,0.5)';
    mapCtx.lineWidth = 2;
    mapCtx.beginPath();
    mapCtx.arc(100, 100, R, 0, Math.PI * 2);
    mapCtx.stroke();
    mapCtx.fillStyle = '#ffd75e';
    mapCtx.font = 'bold 13px system-ui, sans-serif';
    mapCtx.textAlign = 'center';
    mapCtx.fillText('N', 100, 16);
  }

  // Circular speed gauge: a 240° dial, needle, km/h readout, gear letter
  // and a condition arc that turns red as the car breaks down.
  function drawGauge(P) {
    const W = 150;
    const H = 150;
    const cx = W / 2;
    const cy = H / 2 + 6;
    gaugeCtx.clearRect(0, 0, W, H);
    const startAngle = Math.PI * 0.75;
    const sweep = Math.PI * 1.5;
    const maxKmh = 160;
    const frac = P.onFoot ? 0 : Math.min(1, P.speedKmh / maxKmh);
    // Dial track.
    gaugeCtx.strokeStyle = 'rgba(255,255,255,0.25)';
    gaugeCtx.lineWidth = 9;
    gaugeCtx.beginPath();
    gaugeCtx.arc(cx, cy, 58, startAngle, startAngle + sweep);
    gaugeCtx.stroke();
    // Speed arc.
    gaugeCtx.strokeStyle = '#ffd75e';
    gaugeCtx.beginPath();
    gaugeCtx.arc(cx, cy, 58, startAngle, startAngle + sweep * frac);
    gaugeCtx.stroke();
    // Condition arc (inner): green to red.
    const cond = P.onFoot ? P.health / 100 : (P.car ? P.car.health / 100 : 1);
    gaugeCtx.strokeStyle = cond > 0.5 ? '#7dd87d' : cond > 0.25 ? '#ffb14d' : '#ff3b2e';
    gaugeCtx.lineWidth = 5;
    gaugeCtx.beginPath();
    gaugeCtx.arc(cx, cy, 46, startAngle, startAngle + sweep * cond);
    gaugeCtx.stroke();
    // Needle.
    const needleAngle = startAngle + sweep * frac;
    gaugeCtx.strokeStyle = '#ffffff';
    gaugeCtx.lineWidth = 3;
    gaugeCtx.beginPath();
    gaugeCtx.moveTo(cx, cy);
    gaugeCtx.lineTo(cx + Math.cos(needleAngle) * 50, cy + Math.sin(needleAngle) * 50);
    gaugeCtx.stroke();
    // Readout.
    gaugeCtx.fillStyle = '#ffffff';
    gaugeCtx.font = 'bold 26px system-ui, sans-serif';
    gaugeCtx.textAlign = 'center';
    gaugeCtx.fillText(P.onFoot ? '0' : String(Math.round(P.speedKmh)), cx, cy + 8);
    gaugeCtx.font = '11px system-ui, sans-serif';
    gaugeCtx.fillStyle = 'rgba(255,255,255,0.75)';
    gaugeCtx.fillText(P.onFoot ? 'JALAN KAKI' : 'KM/H', cx, cy + 26);
    const gear = P.onFoot ? 'N' : P.speedKmh > 1 ? 'D' : 'N';
    gaugeCtx.font = 'bold 13px system-ui, sans-serif';
    gaugeCtx.fillStyle = '#ffd75e';
    gaugeCtx.fillText(gear, cx, cy + 44);
  }

  function update(G, dt) {
    const S = G.state;
    const P = G.player;
    // Mission panel.
    els.missionTitle.textContent = G.missions.done
      ? 'SEMUA MISI SELESAI'
      : `MISSION ${G.missions.index + 1}/8: ${G.missions.current().title}`;
    els.missionObj.textContent = G.missions.objectiveText();
    els.missionStageFill.style.width = `${Math.round(G.missions.stageFrac() * 100)}%`;
    els.missionNext.textContent = G.missions.nextText();
    const level = repLevel(S.rep);
    const base = REP_STEPS[level - 1];
    const next = REP_STEPS[level] ?? REP_STEPS[level - 1] + 1000;
    els.repText.textContent = `REP ${level} · ${REP_TITLES[level - 1]} (${Math.round(S.rep - base)}/${next - base})`;
    els.repFill.style.width = `${Math.round(((S.rep - base) / (next - base)) * 100)}%`;
    // Cash, stars, clock, "DI PANDANG".
    els.cashText.textContent = `$${Math.round(S.cash).toLocaleString('en-US')}`;
    els.starsBox.innerHTML = starsHtml(S.heat);
    const mins = 16 * 60 + Math.floor(S.time * 0.5);
    els.clockText.textContent = `HARI ${S.day} · ${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')} · MUSIM KEMARAU`;
    if (els.seenFlash) {
      const seen = S.heat >= 1 && G.police && G.police.anyoneSees(P.x, P.z);
      els.seenFlash.style.display = seen ? 'block' : 'none';
    }
    // Collectibles + taxi lines.
    if (els.collectText && G.collectibles) {
      els.collectText.textContent = `KOLEKSI ${G.collectibles.collected}/${G.collectibles.total} · +$${G.collectibles.earned}`;
    }
    if (els.taxiText && G.taxi) {
      if (G.taxi.state === 'waiting' && G.taxi.passenger) els.taxiText.textContent = `TAKSI: ${G.taxi.passenger.name} menunggu — jemput (E)`;
      else if (G.taxi.state === 'riding' && G.taxi.destination) els.taxiText.textContent = `TAKSI: antar ke ${G.taxi.destination.label} — $${G.taxi.fare}`;
      else if (G.race && G.race.active) els.taxiText.textContent = `BALAPAN: gate ${G.race.gateIndex + 1}/${G.race.gateCount} — ${Math.round(G.race.timer)} dtk`;
      else els.taxiText.textContent = `TAKSI: ${G.taxi.trips} trip · +$${G.taxi.earned}`;
    }
    // Police response list.
    const units = G.policeUnits();
    if (S.heat >= 1 && units.length > 0) {
      els.policeBox.style.display = 'block';
      els.policeRows.innerHTML = units.map((u) =>
        `<div class="unit"><b>${u.name}</b><span>${u.dist} m</span><span class="st">${u.status}</span></div>`).join('');
    } else {
      els.policeBox.style.display = 'none';
    }
    // Bill panel, throttled to 10 Hz.
    billTimer -= dt;
    if (billTimer <= 0) {
      billTimer = 0.1;
      const total = G.bill.total();
      if (total > 0) {
        els.billBox.style.display = 'block';
        els.billRows.innerHTML = G.bill.lines.map((l) =>
          `<div class="row"><span>${l.label}</span><span>$${l.amount}</span></div>`).join('');
        els.billTotal.textContent = `$${total}`;
      } else {
        els.billBox.style.display = 'none';
      }
    }
    // Drive box: gauge + vehicle name + radio + weapon strip.
    drawGauge(P);
    els.vehicleName.textContent = P.onFoot ? 'JALAN KAKI' : (P.car ? P.car.name.toUpperCase() : 'CEMPAKA GT');
    songTimer -= dt;
    if (songTimer <= 0) {
      songTimer = 24;
      songIndex = (songIndex + 1) % SONGS.length;
      if (songIndex % 2 === 1) {
        djIndex = (djIndex + 1) % DJ_LINES.length;
        els.radioLine.textContent = `RADIO KEMARAU 92.4 · ${DJ_LINES[djIndex]}`;
      } else {
        els.radioLine.textContent = `RADIO KEMARAU 92.4 · ${SONGS[songIndex]}`;
      }
    }
    const shotgun = P.hasShotgun
      ? `<span class="slot">2 ${WEAPONS.shotgun.name} · ${P.shells}</span>`
      : `<span class="slot locked">2 ${WEAPONS.shotgun.name} · LOCKED $${WEAPONS.shotgun.price}</span>`;
    const smg = `<span class="slot locked">3 ${WEAPONS.smg.name} · LOCKED $${WEAPONS.smg.price}</span>`;
    els.weaponBox.innerHTML = `<span class="slot${P.weapon === 'pistol' ? ' active' : ''}">1 ${WEAPONS.pistol.name} · ∞</span>${shotgun}${smg}`;
    els.crosshair.style.display = P.onFoot ? 'block' : 'none';
    els.locName.textContent = districtName(P.x, P.z);
    drawMinimap(G);
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) els.toast.textContent = '';
    }
    if (dialogueTimer > 0) {
      dialogueTimer -= dt;
      if (dialogueTimer <= 0) els.dialogue.style.display = 'none';
    }
  }

  function toast(text, seconds = 4) {
    els.toast.textContent = text;
    toastTimer = seconds;
  }

  // who: display name line; portraitKey: a CHARACTERS key ('wira', 'sari',
  // 'ijal', 'rahmat', 'ocid') or old-style initials for compatibility.
  function dialogue(who, line, portraitKey = 'wira', seconds = 6) {
    if (els.portraitCanvas && CHARACTERS[portraitKey]) {
      drawPortrait(els.portraitCanvas, portraitKey);
    } else if (els.portraitCanvas) {
      const g = els.portraitCanvas.getContext('2d');
      g.clearRect(0, 0, 64, 64);
      g.fillStyle = '#7a5c2e';
      g.beginPath(); g.arc(32, 32, 32, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff';
      g.font = 'bold 20px system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(portraitKey).slice(0, 2), 32, 34);
    }
    els.dialogueLine.textContent = line;
    els.dialogue.querySelector('b').textContent = who;
    els.dialogue.style.display = 'flex';
    dialogueTimer = seconds;
  }
  function prompt(text) {
    els.prompt.style.display = text ? 'block' : 'none';
    if (text) els.prompt.textContent = text;
  }
  function announce(text) { els.status.textContent = text; }

  function showScreen(html) {
    els.screen.innerHTML = html;
    els.screen.classList.remove('hidden');
  }
  function hideScreen() {
    els.screen.classList.add('hidden');
    els.screen.innerHTML = '';
  }

  return { update, toast, dialogue, prompt, announce, showScreen, hideScreen, popups, els };
}
