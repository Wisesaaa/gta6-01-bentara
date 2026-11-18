// HUD: every DOM panel, updated from the real game state — never by setting a
// string directly from a shot script. The bill panel is throttled to 10 Hz.
import { LOCATIONS } from './city.js';
import { WEAPONS, SHOTGUN_SHELLS_PRICE } from './config.js';
import { roadLines } from './city.js';

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
    policeBox: $('policeBox'), policeRows: $('policeRows'),
    billBox: $('billBox'), billRows: $('billRows'), billTotal: $('billTotal'),
    minimap: $('minimap'), locName: $('locName'),
    dialogue: $('dialogue'), dialogueLine: $('dialogueLine'), portrait: $('portrait'),
    toast: $('toast'), prompt: $('prompt'),
    speedNum: $('speedNum'), vehicleName: $('vehicleName'),
    condFill: $('condFill'), radioLine: $('radioLine'), weaponBox: $('weaponBox'),
    crosshair: $('crosshair'), screen: $('screen'), status: $('status'),
  };
  const mapCtx = els.minimap.getContext('2d');
  let billTimer = 0;
  let toastTimer = 0;
  let dialogueTimer = 0;
  let songIndex = 0;
  let songTimer = 24;

  function starsHtml(heat) {
    const full = Math.floor(heat);
    let html = '';
    for (let i = 0; i < 5; i += 1) {
      html += `<span class="${i < full ? '' : 'off'}">★</span>`;
    }
    return html;
  }

  function drawMinimap(G) {
    const s = 180 / 420;
    const px = (x) => 90 + x * s;
    const py = (z) => 90 - z * s;
    mapCtx.fillStyle = '#e8e4da';
    mapCtx.fillRect(0, 0, 180, 180);
    // Marina water along the south edge.
    mapCtx.fillStyle = '#1f6b74';
    mapCtx.fillRect(0, py(-194), 180, 180 - py(-194));
    mapCtx.fillStyle = '#cfc9bd';
    for (const c of roadLines()) {
      mapCtx.fillRect(0, py(c) - 4, 180, 8);
      mapCtx.fillRect(px(c) - 4, 0, 8, 180);
    }
    mapCtx.fillStyle = '#8a7a5c';
    for (const b of G.city.blocks) mapCtx.fillRect(px(b.x - 22), py(b.z + 22), 44 * s, 44 * s);
    const dot = (x, z, color, r = 3) => {
      mapCtx.fillStyle = color;
      mapCtx.beginPath();
      mapCtx.arc(px(x), py(z), r, 0, Math.PI * 2);
      mapCtx.fill();
    };
    dot(150, -60, '#2f8f4f', 4); // safehouse
    dot(-70, -140, '#2f5a8f', 4); // shop
    if (!G.missions.done) {
      const L = G.missionTarget();
      dot(L.x, L.z, '#ffd75e', 5);
    }
    for (const c of G.traffic.cars) dot(c.x, c.z, '#6b6b6b', 2);
    for (const u of G.policeUnits()) dot(u.x, u.z, '#c23b2e', 3);
    // Player arrow.
    mapCtx.save();
    mapCtx.translate(px(G.player.x), py(G.player.z));
    mapCtx.rotate(-G.player.heading);
    mapCtx.fillStyle = '#fff';
    mapCtx.beginPath();
    mapCtx.moveTo(0, -6);
    mapCtx.lineTo(4, 5);
    mapCtx.lineTo(-4, 5);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.restore();
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
    // Cash, stars, clock.
    els.cashText.textContent = `$${Math.round(S.cash).toLocaleString('en-US')}`;
    els.starsBox.innerHTML = starsHtml(S.heat);
    const mins = 16 * 60 + Math.floor(S.time * 0.5);
    els.clockText.textContent = `HARI ${S.day} · ${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')} · MUSIM KEMARAU`;
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
    // Drive box.
    if (P.onFoot) {
      els.speedNum.innerHTML = '0 <small>KM/H</small>';
      els.vehicleName.textContent = 'JALAN KAKI';
      els.condFill.style.width = `${Math.round(P.health)}%`;
    } else {
      els.speedNum.innerHTML = `${Math.round(P.speedKmh)} <small>KM/H</small>`;
      els.vehicleName.textContent = P.car ? P.car.name.toUpperCase() : 'CEMPAKA GT';
      els.condFill.style.width = `${Math.round(P.car ? P.car.health : 100)}%`;
    }
    songTimer -= dt;
    if (songTimer <= 0) { songTimer = 24; songIndex = (songIndex + 1) % SONGS.length; }
    els.radioLine.textContent = `RADIO KEMARAU 92.4 · ${SONGS[songIndex]}`;
    const shotgun = P.hasShotgun
      ? `2 ${WEAPONS.shotgun.name} ${P.shells} peluru`
      : `2 ${WEAPONS.shotgun.name} — LOCKED ($${WEAPONS.shotgun.price} di Ruko)`;
    els.weaponBox.innerHTML = `1 ${WEAPONS.pistol.name} ∞ &nbsp;·&nbsp; ${shotgun}`;
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
  function dialogue(who, line, initials = 'PW', seconds = 6) {
    els.portrait.textContent = initials;
    els.dialogueLine.textContent = line;
    els.dialogue.querySelector('b').textContent = `${who}`;
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

  return { update, toast, dialogue, prompt, announce, showScreen, hideScreen, els };
}
