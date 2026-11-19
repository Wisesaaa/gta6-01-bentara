// HUD: four corner clusters + a centre band, no text walls.
// TOP-CENTER: mission stinger (2 s full, then a mini-pill with the
// objective + distance), segmented stage bar, NEXT chip, act pips.
// LEFT-MID: police response list, max 5 rows + "+N unit lagi", status
// pills (KEJAR / MENABRAK / IKAT JALAN / SOROT / MENCARI).
// TOP-RIGHT: green cash, stars, day/time, one-line bill pill.
// BOTTOM-LEFT: circular radar minimap + GPS route + region plate + REP
// row + chip row (KOLEKSI / ASET / KEMAJUAN %).
// BOTTOM-RIGHT: vehicle card (gauge, fuel, nitro, armor) + 5-slot weapon
// rail with 2 LOCKED slots. CENTRE: tiered feedback + dispatch ticker.
// RIGHT EDGE: progress rail (owned cars). The bill list collapses to one
// pill and only expands on the pause screen. Everything reads from the
// real game state — never a string set by a shot script.
import { LOCATIONS, roadLines } from './city.js';
import { WEAPONS, WEAPON_SLOTS, DJ_LINES, CHARACTERS } from './config.js';
import { drawPortrait } from './dialogue.js';
import { createPopups } from './popups.js';
import { repLevel, repTitle, repProgress, nextUnlock, actForMission, actNameForMission, missionProgress } from './progress.js';

export { repLevel, repTitle };

const SONGS = [
  'Musim Kering — Senja Bentara',
  'Senja di Aspal',
  'Debu Arteri — Kijang Liar',
  'Debu Kota',
  'Angin Timur — Ruko Blues',
  'Plaza 16:00 — Matahari Retak',
];

// Status -> [pill text, css class].
const STATUS_PILL = {
  PURSUIT: ['KEJAR', 'pill-kejar'],
  RAMMING: ['MENABRAK', 'pill-tabrak'],
  ROADBLOCK: ['IKAT JALAN', 'pill-blokade'],
  SPOTLIGHT: ['SOROT', 'pill-sorot'],
  SEARCHING: ['MENCARI', 'pill-cari'],
};

// Where the three buyable properties stand, for the gold $ blips on the
// minimap (only the owned ones show).
const USAHA_SPOTS = {
  warung: { x: 42, z: 96 },
  kakiLima: { x: 0, z: 0 },
  slip: { x: -6, z: -170 },
};

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
    missionStinger: $('missionStinger'), stingerBig: $('stingerBig'), stingerMini: $('stingerMini'),
    actChip: $('actChip'), actPips: $('actPips'),
    missionStageFill: $('missionStageFill'), missionNext: $('missionNext'),
    repText: $('repText'), repFill: $('repFill'), nextUnlock: $('nextUnlock'),
    chipRow: $('chipRow'),
    cashText: $('cashText'), clockText: $('clockText'), starsBox: $('starsBox'),
    seenFlash: $('seenFlash'), billPill: $('billPill'),
    policeBox: $('policeBox'), policeHead: $('policeHead'), policeRows: $('policeRows'),
    minimap: $('minimap'), locName: $('locName'),
    dialogue: $('dialogue'), dialogueLine: $('dialogueLine'), portraitCanvas: $('portraitCanvas'),
    dialogueName: $('dialogueName'), dialogueRole: $('dialogueRole'),
    toast: $('toast'), prompt: $('prompt'), popups: $('popups'), centerFx: $('centerFx'),
    ticker: $('ticker'), raceChip: $('raceChip'),
    gauge: $('gauge'), vehicleName: $('vehicleName'), vehiclePlate: $('vehiclePlate'),
    vehicleCond: $('vehicleCond'), ojekMeter: $('ojekMeter'),
    fuelBar: $('fuelBar'), fuelFill: $('fuelFill'), nitroBar: $('nitroBar'), nitroFill: $('nitroFill'),
    armorBar: $('armorBar'), armorFill: $('armorFill'),
    radioLine: $('radioLine'), eqBars: $('eqBars'), weaponBox: $('weaponBox'),
    progressRail: $('progressRail'),
    ledgerCard: $('ledgerCard'),
    garagePanel: $('garagePanel'), usahaPanel: $('usahaPanel'), shopPanel: $('shopPanel'),
    crosshair: $('crosshair'), screen: $('screen'), status: $('status'),
    pauseStats: $('pauseStats'),
  };
  const mapCtx = els.minimap.getContext('2d');
  const gaugeCtx = els.gauge.getContext('2d');
  const popups = createPopups(els.popups, els.centerFx);
  let billTimer = 0;
  let toastTimer = 0;
  let dialogueTimer = 0;
  let songIndex = 0;
  let songTimer = 24;
  let djIndex = 0;
  let stingerTimer = 0;
  let stingerKey = '';
  let ledgerTimer = 0;
  let tickerTimer = 0;
  let captureMode = null;
  let shopKind = null;

  function starsHtml(heat) {
    const full = Math.floor(heat);
    let html = '';
    for (let i = 0; i < 5; i += 1) {
      html += `<span class="${i < full ? '' : 'off'}">★</span>`;
    }
    return html;
  }

  // Circular radar: dark disc, road graph, blocks, water, then the live
  // layer — objective, GPS route, police, collectibles, taxi, owned
  // properties (gold $), player arrow, search ring and the N compass.
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
    // Road graph: bright lines on the dark disc, wide enough to read at
    // thumbnail size — the old thin grey lines read as a grid, not roads.
    mapCtx.strokeStyle = '#8a9aa8';
    mapCtx.lineWidth = 7;
    for (const c of roadLines()) {
      mapCtx.beginPath(); mapCtx.moveTo(0, py(c)); mapCtx.lineTo(W, py(c)); mapCtx.stroke();
      mapCtx.beginPath(); mapCtx.moveTo(px(c), 0); mapCtx.lineTo(px(c), W); mapCtx.stroke();
    }
    mapCtx.fillStyle = '#0d1218';
    for (const b of G.city.blocks) mapCtx.fillRect(px(b.x - 22), py(b.z + 22), 44 * s, 44 * s);
    const dot = (x, z, color, r = 3) => {
      mapCtx.fillStyle = color;
      mapCtx.beginPath();
      mapCtx.arc(px(x), py(z), r, 0, Math.PI * 2);
      mapCtx.fill();
    };
    dot(150, -60, '#2fbf71', 4); // safehouse
    dot(-70, -140, '#4a90d9', 4); // shop
    dot(120, 74, '#c0392b', 4); // garage — Bengkel Roda Jaya
    // Collectibles: tiny gold dots, so the radar advertises the hunt.
    if (G.collectibles) {
      for (const item of G.collectibles.remaining()) dot(item.x, item.z, '#ffd75e', 1.8);
    }
    // Owned properties: gold $ blips.
    if (G.usaha) {
      for (const item of G.usaha.ownedList()) {
        const spot = USAHA_SPOTS[item.id];
        if (!spot) continue;
        mapCtx.fillStyle = '#ffd75e';
        mapCtx.font = 'bold 11px system-ui, sans-serif';
        mapCtx.textAlign = 'center';
        mapCtx.fillText('$', px(spot.x), py(spot.z) + 4);
      }
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
    // GPS route: thick solid gold line from the player to the objective —
    // the dashed hairline never read at thumbnail size.
    if (!G.missions.done) {
      const L = G.missionTarget();
      mapCtx.strokeStyle = 'rgba(255, 215, 94, 0.95)';
      mapCtx.lineWidth = 4;
      mapCtx.beginPath();
      mapCtx.moveTo(px(G.player.x), py(G.player.z));
      mapCtx.lineTo(px(L.x), py(L.z));
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
    // Search ring: while the player is unseen with heat on, a dashed red
    // circle around the LAST-SEEN spot (the zone the police are sweeping),
    // labelled ZONA — while seen, a pulsing ring around the player.
    if (G.state.heat >= 1) {
      const searching = G.police && G.police.searching;
      const cx = searching && G.police.lastSeen ? G.police.lastSeen.x : G.player.x;
      const cz = searching && G.police.lastSeen ? G.police.lastSeen.z : G.player.z;
      mapCtx.strokeStyle = searching ? 'rgba(255, 106, 90, 0.95)' : 'rgba(255, 59, 46, 0.8)';
      mapCtx.lineWidth = searching ? 3 : 2;
      mapCtx.setLineDash([6, 5]);
      mapCtx.beginPath();
      mapCtx.arc(px(cx), py(cz), searching ? 34 : 26, 0, Math.PI * 2);
      mapCtx.stroke();
      mapCtx.setLineDash([]);
      if (searching) {
        mapCtx.fillStyle = '#ff6a5a';
        mapCtx.font = 'bold 9px system-ui, sans-serif';
        mapCtx.textAlign = 'center';
        mapCtx.fillText('ZONA', px(cx), py(cz) - 38);
      }
    }
    // Ojek bike: bright green dot + ring, so the fare run reads on radar.
    if (G.ojek && G.ojek.state !== 'idle' && G.ojek.bike) {
      dot(G.ojek.bike.x, G.ojek.bike.z, '#37d67a', 4);
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

  function missionDistance(G) {
    if (G.missions.done) return 0;
    const L = G.missionTarget();
    return Math.round(Math.hypot(L.x - G.player.x, L.z - G.player.z));
  }

  function update(G, dt) {
    const S = G.state;
    const P = G.player;
    // --- TOP-CENTER stinger: full card for 2 s on a stage change, then
    // a mini-pill with the live objective + distance.
    const key = G.missions.done ? 'done' : `${G.missions.index}/${G.missions.stepIndex}`;
    if (key !== stingerKey) {
      stingerKey = key;
      if (!G.missions.done) {
        els.stingerBig.textContent = `MISI ${G.missions.index + 1}/8 — ${G.missions.current().title}`;
        els.missionStinger.classList.remove('mini');
        els.missionStinger.classList.add('show');
        stingerTimer = 2;
      } else {
        els.stingerBig.textContent = 'SEMUA MISI SELESAI — BENTARA MILIKMU';
        els.missionStinger.classList.remove('mini');
        els.missionStinger.classList.add('show');
        stingerTimer = 3;
      }
    }
    if (stingerTimer > 0) {
      stingerTimer -= dt;
      if (stingerTimer <= 0) els.missionStinger.classList.add('mini');
    }
    els.stingerMini.textContent = G.missions.done
      ? 'BENTARA MILIKMU'
      : `${G.missions.objectiveText()} · ${missionDistance(G)} m`;
    // Race chip: only while a checkpoint race is running — gate count +
    // live timer, so the race system is visible in the HUD, not just as
    // a gold ring in the world.
    if (G.race && G.race.active && G.race.nextGate) {
      els.raceChip.style.display = 'block';
      els.raceChip.textContent = `BALAPAN · GATE ${G.race.gateIndex + 1}/${G.race.gateCount} · ${G.race.timer.toFixed(1)} dtk`;
    } else {
      els.raceChip.style.display = 'none';
    }
    // Act chip + pips (top-left).
    const act = actForMission(G.missions.done ? 7 : G.missions.index);
    els.actChip.textContent = actNameForMission(G.missions.done ? 7 : G.missions.index);
    els.actPips.innerHTML = [1, 2, 3].map((a) =>
      `<span class="pip${a === act ? ' on' : ''}${a < act ? ' done' : ''}"></span>`).join('');
    // Stage bar + NEXT chip.
    els.missionStageFill.style.width = `${Math.round(G.missions.stageFrac() * 100)}%`;
    els.missionNext.textContent = G.missions.done ? 'NEXT: —' : `NEXT▸ ${G.missions.nextText().replace(/^NEXT:\s*/, '')}`;
    // REP row + next unlock.
    const rp = repProgress(S.rep);
    els.repText.textContent = `REP ${rp.level} · ${rp.title} ${Math.round(rp.into)}/${rp.need || '—'}`;
    els.repFill.style.width = `${Math.round(rp.frac * 100)}%`;
    const nu = nextUnlock(S.rep);
    els.nextUnlock.textContent = nu ? `BERIKUTNYA di REP ${nu.level}: ${nu.label}` : 'SEMUA UNLOCK TERBUKA';
    // Chip row: collection, assets, completion.
    const mp = missionProgress(G.missions);
    const assets = G.usaha ? G.usaha.assetChip() : 'ASET 0/3';
    els.chipRow.textContent = `KOLEKSI ${G.collectibles ? G.collectibles.collected : 0}/${G.collectibles ? G.collectibles.total : 24} · ${assets} · KEMAJUAN ${mp.pct}%`;
    // Cash, stars, clock, "DI PANDANG", bill pill.
    els.cashText.textContent = `$${Math.round(S.cash).toLocaleString('en-US')}`;
    els.starsBox.innerHTML = starsHtml(S.heat);
    const mins = 16 * 60 + Math.floor(S.time * 0.5);
    els.clockText.textContent = `HARI ${S.day} · ${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')} · MUSIM KEMARAU`;
    // LOS chip: two states, always visible while wanted — TERLIHAT (red,
    // blinking, the search zone follows the player) or HILANG (amber, the
    // police are sweeping the last-seen zone).
    if (els.seenFlash) {
      if (S.heat >= 1 && G.police) {
        const seen = G.police.anyoneSees(P.x, P.z);
        els.seenFlash.style.display = 'block';
        els.seenFlash.textContent = seen ? '● TERLIHAT — ZONA MENGIKUTIMU' : '○ HILANG — ZONA PENCARIAN';
        els.seenFlash.classList.toggle('lost', !seen);
      } else {
        els.seenFlash.style.display = 'none';
      }
    }
    billTimer -= dt;
    if (billTimer <= 0) {
      billTimer = 0.1;
      const total = G.bill.total();
      els.billPill.style.display = total > 0 ? 'block' : 'none';
      if (total > 0) els.billPill.textContent = `TAGIHAN −$${total}`;
    }
    // Police response list: header + max 5 rows + "+N unit lagi".
    const units = G.policeUnits();
    if (S.heat >= 1 && units.length > 0) {
      els.policeBox.style.display = 'block';
      els.policeHead.textContent = `RESPON POLISI — ${units.length} UNIT · KODE ${Math.floor(S.heat)}`;
      const shown = units.slice(0, 5);
      let html = shown.map((u) => {
        const pill = STATUS_PILL[u.status] || [u.status, 'pill-cari'];
        return `<div class="unit"><b>${u.name}</b><span class="cond">${u.cond || ''}</span><span>${u.dist} m</span><span class="pill ${pill[1]}">${pill[0]}</span></div>`;
      }).join('');
      if (units.length > 5) html += `<div class="more">+${units.length - 5} unit lagi</div>`;
      els.policeRows.innerHTML = html;
    } else {
      els.policeBox.style.display = 'none';
    }
    // Drive box: gauge + vehicle card + fuel/nitro/armor + radio + rail.
    drawGauge(P);
    els.vehicleName.textContent = P.onFoot ? 'JALAN KAKI' : (P.car ? P.car.name.toUpperCase() : 'CEMPAKA GT');
    els.vehiclePlate.textContent = P.onFoot ? '' : (P.car && P.car.plate ? `PLAT ${P.car.plate}` : 'PLAT B 4821 KLM');
    // Vehicle condition: the number Karimbu shows ("62% DENTED") — the
    // body smoke already exists in car.js below 40% health.
    if (els.vehicleCond) {
      if (P.car) {
        const hp = Math.round(P.car.health);
        const label = hp >= 90 ? 'PRIMA' : hp >= 75 ? '' : hp >= 40 ? 'DENTED' : 'RUSAK';
        els.vehicleCond.textContent = `KONDISI ${hp}%${label ? ` · ${label}` : ''}`;
        els.vehicleCond.className = hp < 40 ? 'bad' : hp < 75 ? 'hurt' : '';
        els.vehicleCond.style.display = 'block';
      } else {
        els.vehicleCond.style.display = 'none';
      }
    }
    // Ojek fare meter beside the speedo, live while a ride is running.
    if (els.ojekMeter) {
      if (G.ojek && G.ojek.state !== 'idle' && typeof G.ojek.meterText === 'function') {
        els.ojekMeter.textContent = G.ojek.meterText();
        els.ojekMeter.style.display = 'block';
      } else {
        els.ojekMeter.style.display = 'none';
      }
    }
    if (P.car) {
      els.fuelBar.style.display = 'block';
      els.fuelFill.style.width = `${Math.round(P.car.fuel)}%`;
      els.nitroBar.style.display = 'block';
      els.nitroFill.style.width = `${Math.round((P.car.boost || 0) * 100)}%`;
      els.nitroBar.classList.toggle('locked', !(P.car.turboLevel > 0));
    } else {
      els.fuelBar.style.display = 'none';
      els.nitroBar.style.display = 'none';
    }
    if (P.armor > 0) {
      els.armorBar.style.display = 'block';
      els.armorFill.style.width = `${Math.round(P.armor)}%`;
    } else {
      els.armorBar.style.display = 'none';
    }
    // Radio: a song every 24 s, a DJ line in between, EQ bars pulsing.
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
    // Weapon rail: 5 slots, mag/reserve counts, LOCKED pads for depth.
    const slots = WEAPON_SLOTS.map((id, i) => {
      const w = WEAPONS[id];
      const hasKey = { shotgun: 'hasShotgun', smg: 'hasSmg', bedil: 'hasBedil', pelontar: 'hasPelontar' }[id];
      const magKey = { shotgun: 'shellMag', smg: 'smgMag', bedil: 'bedilMag', pelontar: 'pelontarMag' }[id];
      const resKey = w.reserveField;
      const owned = id === 'pistol' || (hasKey && P[hasKey]);
      if (!owned) {
        // Rail stays compact: name + padlock only. The price / REP
        // requirement lives in the shop panel — the rail only advertises
        // that the slot exists. (r3 showed "$120"/"REP 4" blowing the
        // rail to ~640 px wide.)
        return `<span class="slot locked">${i + 1} ${w.name} · 🔒</span>`;
      }
      const ammo = id === 'pistol' ? '∞' : `${P[magKey] ?? 0}/${P[resKey] ?? 0}`;
      return `<span class="slot${P.weapon === id ? ' active' : ''}">${i + 1} ${w.name} · ${ammo}</span>`;
    }).join('');
    els.weaponBox.innerHTML = slots;
    // Progress rail (right edge): owned cars, current one highlighted.
    if (G.garage) {
      const owned = G.garage.ownedList();
      const current = P.car ? P.car.name : null;
      els.progressRail.innerHTML = `<div class="rail-title">GARASI · RESPRAY + UPGRADE</div>` + (owned.length === 0
        ? `<div class="rail-car">CEMPAKA GT</div><div class="rail-note">Beli di Bengkel Roda Jaya</div>`
        : owned.map((c) => `<div class="rail-car${current === c.name ? ' current' : ''}">${c.name}</div>`).join(''));
    }
    // Crosshair: on foot only, never in capture mode.
    els.crosshair.style.display = (P.onFoot && !captureMode) ? 'block' : 'none';
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
    if (ledgerTimer > 0) {
      ledgerTimer -= dt;
      if (ledgerTimer <= 0) els.ledgerCard.style.display = 'none';
    }
    if (tickerTimer > 0) {
      tickerTimer -= dt;
      if (tickerTimer <= 0) els.ticker.style.display = 'none';
    }
    // Pause screen stats (filled live while paused).
    if (S.mode === 'paused' && els.pauseStats) {
      const billLines = G.bill.lines.length > 0
        ? G.bill.lines.map((l) => `${l.label} ×${l.count} — $${l.amount}`).join('<br>')
        : 'Tidak ada tagihan.';
      els.pauseStats.innerHTML = `KEMAJUAN ${mp.pct}% (${mp.done}/8 misi) · ${repTitle(S.rep)}<br>`
        + `TAGIHAN:<br>${billLines}<br>`
        + `${assets} · KOLEKSI ${G.collectibles ? G.collectibles.collected : 0}/${G.collectibles ? G.collectibles.total : 24}`;
    }
  }

  function toast(text, seconds = 4) {
    els.toast.textContent = text;
    toastTimer = seconds;
  }

  // who: "PAK ASKA · PENERIMA MARINA" — the name goes bold, the role
  // becomes a teal chip, the line clamps to 2 lines and shrinks to fit
  // inside the 24 px safe margins. No cut text, ever.
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
    const parts = String(who).split('·');
    els.dialogueName.textContent = (parts[0] || who).trim();
    els.dialogueRole.textContent = parts[1] ? parts[1].trim() : '';
    els.dialogueRole.style.display = parts[1] ? 'inline-block' : 'none';
    els.dialogueLine.textContent = line;
    // Auto-fit: a long line shrinks instead of overflowing the panel.
    els.dialogueLine.style.fontSize = line.length > 110 ? '12px' : line.length > 80 ? '13px' : '14px';
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

  // Mission stinger on demand (a stage change already triggers it).
  // `seconds` is the on-screen lifetime: live play uses 2 s; a shot
  // stage may pass a longer one so the card survives the slow capture.
  function stinger(text, sub, seconds = 2) {
    els.stingerBig.textContent = text;
    els.missionStinger.classList.remove('mini');
    els.missionStinger.classList.add('show');
    stingerTimer = seconds;
  }

  // One-way dispatch ticker above the centre feedback layer.
  function ticker(text, seconds = 6) {
    els.ticker.textContent = text;
    els.ticker.style.display = 'block';
    tickerTimer = seconds;
  }

  // End-of-mission ledger card: Hasil / Tagihan / BERSIH / REP.
  function ledger(data, seconds = 6) {
    els.ledgerCard.innerHTML = `<h3>${data.title} SELESAI</h3>`
      + `<div class="row"><span>Hasil</span><span>+$${data.hasil.toLocaleString('en-US')}</span></div>`
      + `<div class="row"><span>Tagihan</span><span>−$${data.tagihan.toLocaleString('en-US')}</span></div>`
      + `<div class="row total"><span>BERSIH</span><span>$${data.bersih.toLocaleString('en-US')}</span></div>`
      + `<div class="row"><span>REP</span><span>+${data.rep}</span></div>`;
    els.ledgerCard.style.display = 'block';
    ledgerTimer = seconds;
  }

  // Capture mode: 'cover' hides the dialogue box (the hero car must own
  // the frame), 'coverportrait' keeps a compact portrait card (the cover
  // needs a face, but the card is small and bottom-edge), 'story' hides
  // only the crosshair. null restores all. Both cover modes add the
  // body.cover-shot class, so the compact strip docks bottom-LEFT —
  // without it the card falls back to the centred 560 px box and covers
  // the hero car.
  function setCaptureMode(mode) {
    captureMode = mode;
    document.body.classList.toggle('cover-shot', mode === 'cover' || mode === 'coverportrait');
    if (mode === 'cover') els.dialogue.style.display = 'none';
    else if (mode === 'coverportrait') els.dialogue.style.display = 'flex';
    else els.dialogue.style.display = els.dialogue.style.display;
    els.crosshair.style.display = 'none';
    if (mode === null) els.crosshair.style.display = 'block';
  }

  // Hide the dialogue box outright (a shot stage kills a mission intro
  // that would otherwise sit over the frame for its 7 s lifetime).
  function hideDialogue() {
    els.dialogue.style.display = 'none';
    dialogueTimer = 0;
  }

  // --- Shop panels (clickable; E or the ✕ button closes) -----------------
  function closeShop() {
    if (els.garagePanel) els.garagePanel.style.display = 'none';
    if (els.usahaPanel) els.usahaPanel.style.display = 'none';
    if (els.shopPanel) els.shopPanel.style.display = 'none';
    const kind = shopKind;
    shopKind = null;
    return kind;
  }
  function isShopOpen() { return shopKind !== null; }

  function showGarage(garage, state, onClose) {
    const panel = els.garagePanel;
    shopKind = 'garage';
    const fmt = (n) => `$${n.toLocaleString('en-US')}`;
    const rep = state.rep;
    const rows = garage.catalog().map((c) => {
      const owned = garage.isOwned(c.id);
      return `<div class="shop-row"><div><b>${c.name}</b><span>${c.desc}</span></div>`
        + (owned
          ? `<button disabled>DIMILIKI</button>`
          : `<button data-buy="${c.id}">${fmt(c.priceNow)}</button>`) + `</div>`;
    }).join('');
    const owned = garage.ownedList();
    const upRows = owned.map((e) => {
      const info = garage.upgradeInfo(e.id);
      if (!info) return '';
      const btns = ['mesin', 'ban', 'turbo'].map((part) => {
        const inf = info[part];
        const locked = part === 'turbo' && repLevel(rep) < 2;
        if (inf.level >= 3) return `<button disabled>${part.toUpperCase()} MAX</button>`;
        if (locked) return `<button disabled>TURBO 🔒 REP 2</button>`;
        return `<button data-up="${e.id}:${part}">${part.toUpperCase()} ${inf.level}→${inf.level + 1} · ${fmt(inf.nextPrice)}</button>`;
      }).join('');
      const colors = ['Merah Bara|0xc0392b', 'Biru Marina|0x2f6b8a', 'Kuning Senja|0xd8a13a'].map((c) => {
        const [name, hex] = c.split('|');
        return `<button data-spray="${e.id}:${hex}">${name}</button>`;
      }).join('');
      return `<div class="shop-row"><div><b>${e.name}</b><span>${e.plate} · MESIN ${info.mesin.level} · BAN ${info.ban.level} · TURBO ${info.turbo.level}</span></div><div class="btns">${btns}${colors}</div></div>`;
    }).join('');
    panel.innerHTML = `<h3>BENGKEL RODA JAYA</h3><div class="shop-sub">Beli mobil · upgrade · respray $150 · diskon 20% di REP 4</div>`
      + rows + (upRows ? `<div class="shop-sec">GARASIMU</div>${upRows}` : '')
      + `<button class="shop-close" data-close="1">TUTUP [E]</button>`;
    panel.style.display = 'block';
    panel.onclick = (ev) => {
      const b = ev.target.closest('button');
      if (!b) return;
      if (b.dataset.close) { closeShop(); if (onClose) onClose(); return; }
      if (b.dataset.buy) {
        const r = garage.buy(b.dataset.buy);
        if (!r.ok) toast(r.reason, 4);
        showGarage(garage, state, onClose);
        return;
      }
      if (b.dataset.up) {
        const [id, part] = b.dataset.up.split(':');
        const r = garage.upgrade(id, part);
        if (!r.ok) toast(r.reason, 4);
        showGarage(garage, state, onClose);
        return;
      }
      if (b.dataset.spray) {
        const [id, hex] = b.dataset.spray.split(':');
        const r = garage.respray(id, parseInt(hex, 16));
        if (!r.ok) toast(r.reason, 4);
        showGarage(garage, state, onClose);
      }
    };
  }

  function showUsaha(usaha, state, onClose) {
    const panel = els.usahaPanel;
    shopKind = 'usaha';
    const fmt = (n) => `$${n.toLocaleString('en-US')}`;
    const rows = usaha.catalog().map((c) => {
      const owned = usaha.isOwned(c.id);
      return `<div class="shop-row"><div><b>${c.name}</b><span>${c.desc} · +${fmt(c.incomePerDay)}/hari</span></div>`
        + (owned
          ? `<button disabled>DIMILIKI</button>`
          : `<button data-buy="${c.id}">${fmt(c.priceNow)}</button>`) + `</div>`;
    }).join('');
    panel.innerHTML = `<h3>USAHA — PROPERTI</h3><div class="shop-sub">${usaha.assetChip()} · pemasukan +${fmt(usaha.dailyRate())}/hari · pot $${Math.round(usaha.pot).toLocaleString('en-US')} — cairkan dengan tidur di safehouse</div>`
      + rows + `<button class="shop-close" data-close="1">TUTUP [E]</button>`;
    panel.style.display = 'block';
    panel.onclick = (ev) => {
      const b = ev.target.closest('button');
      if (!b) return;
      if (b.dataset.close) { closeShop(); if (onClose) onClose(); return; }
      if (b.dataset.buy) {
        const r = usaha.buy(b.dataset.buy);
        if (!r.ok) toast(r.reason, 4);
        showUsaha(usaha, state, onClose);
      }
    };
  }

  function showWeaponShop(shop, state, onClose) {
    const panel = els.shopPanel;
    shopKind = 'weapon';
    const fmt = (n) => `$${n.toLocaleString('en-US')}`;
    const rows = shop.catalog().map((r) => {
      const btn = r.owned
        ? `<button disabled>DIMILIKI</button>`
        : r.disabled
          ? `<button disabled>🔒 ${r.disabledReason || ''}</button>`
          : `<button data-buy="${r.id}">${fmt(r.price)}</button>`;
      return `<div class="shop-row"><div><b>${r.name}</b><span>${r.sub}</span></div>${btn}</div>`;
    }).join('');
    panel.innerHTML = `<h3>${shop.title}</h3><div class="shop-sub">${shop.sub()}</div>`
      + rows + `<button class="shop-close" data-close="1">TUTUP [E]</button>`;
    panel.style.display = 'block';
    panel.onclick = (ev) => {
      const b = ev.target.closest('button');
      if (!b) return;
      if (b.dataset.close) { closeShop(); if (onClose) onClose(); return; }
      if (b.dataset.buy) {
        const r = shop.buy(b.dataset.buy);
        if (!r.ok) toast(r.reason, 4);
        showWeaponShop(shop, state, onClose);
      }
    };
  }

  return {
    update, toast, dialogue, prompt, announce, showScreen, hideScreen,
    popups, els, stinger, ticker, ledger, setCaptureMode, hideDialogue,
    showGarage, showUsaha, showWeaponShop, closeShop, isShopOpen,
  };
}
