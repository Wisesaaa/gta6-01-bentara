// HUD v3 — four corner clusters + one center band (suplemen top-6–10).
// TOP-CENTER mission stinger (big, 2 s) that shrinks to a mini-pill with a
// live distance; TOP-RIGHT green $ / stars / HARI / TAGIHAN pill / income;
// LEFT-MID police panel (≤5 rows + overflow, Bahasa status pills);
// BOTTOM-LEFT minimap + GPS route + REP row + chips; BOTTOM-RIGHT vehicle
// card + weapon rail + armor; CENTER feedback + dispatch ticker + mission
// ledger. No text wall anywhere: the permanent debug lists are gone, the
// TAGIHAN list collapses to one pill (itemised only in pause).
import { LOCATIONS, roadLines } from './city.js';
import { WEAPONS, DJ_LINES, CHARACTERS } from './config.js';
import { drawPortrait } from './dialogue.js';
import { createPopups } from './popups.js';
import { rankFor, nextUnlock } from './progress.js';

const SONGS = [
  'Senja di Aspal',
  'Debu Kota',
  'Angin Timur — Ruko Blues',
  'Plaza 16:00 — Matahari Retak',
  'Kijang Liar — Debu Arteri',
];

export function repLevel(rep) { return rankFor(rep).level; }
export function repTitle(rep) { return rankFor(rep).title; }

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
    missionStinger: $('missionStinger'), stingerAct: $('stingerAct'), stingerTitle: $('stingerTitle'),
    stingerObj: $('stingerObj'), stingerPips: $('stingerPips'), stingerNext: $('stingerNext'),
    missionPill: $('missionPill'), pillObj: $('pillObj'), pillDist: $('pillDist'), pillFill: $('pillFill'),
    cashText: $('cashText'), clockText: $('clockText'), starsBox: $('starsBox'),
    seenFlash: $('seenFlash'), billPill: $('billPill'), incomeLine: $('incomeLine'),
    policeBox: $('policeBox'), policeHeader: $('policeHeader'), policeRows: $('policeRows'), policeMore: $('policeMore'),
    minimap: $('minimap'), locName: $('locName'),
    repText: $('repText'), repFill: $('repFill'),
    chipKoleksi: $('chipKoleksi'), chipAset: $('chipAset'), chipNext: $('chipNext'),
    carRail: $('carRail'), carRailRows: $('carRailRows'),
    ticker: $('ticker'), feedRows: $('feedRows'),
    ledger: $('ledger'), ledgerTitle: $('ledgerTitle'), ledgerGross: $('ledgerGross'),
    ledgerBill: $('ledgerBill'), ledgerRep: $('ledgerRep'), ledgerNet: $('ledgerNet'),
    dialogue: $('dialogue'), dialogueName: $('dialogueName'), dialogueRole: $('dialogueRole'),
    dialogueLine: $('dialogueLine'), portraitCanvas: $('portraitCanvas'),
    toast: $('toast'), prompt: $('prompt'),
    gauge: $('gauge'), vehicleName: $('vehicleName'),
    fuelFill: $('fuelFill'), nitroFill: $('nitroFill'), condFill: $('condFill'),
    radioText: $('radioText'), weaponBox: $('weaponBox'),
    armorFill: $('armorFill'),
    crosshair: $('crosshair'), screen: $('screen'), status: $('status'),
    damageVignette: $('damageVignette'),
  };
  const mapCtx = els.minimap.getContext('2d');
  const gaugeCtx = els.gauge.getContext('2d');
  const popups = createPopups(els.feedRows);
  let toastTimer = 0;
  let dialogueTimer = 0;
  let songIndex = 0;
  let songTimer = 24;
  let djIndex = 0;
  let stingerTimer = 0;
  let tickerTimer = 0;
  let ledgerTimer = 0;
  // Staging-only crosshair hide (story shot): the crosshair sits at
  // screen centre, dead on top of the mission ledger. Normal play
  // always shows it again on foot — update() re-applies this flag.
  let crosshairHidden = false;
  let lastLedger = null;
  let lastMissionKey = '';
  let lastStepKey = '';

  function starsHtml(heat) {
    const full = Math.floor(heat);
    let html = '';
    for (let i = 0; i < 5; i += 1) {
      html += `<span class="${i < full ? '' : 'off'}">★</span>`;
    }
    return html;
  }

  function pipsHtml(filled, total) {
    let s = '';
    for (let i = 0; i < total; i += 1) s += i < filled ? '●' : '○';
    return s;
  }

  // Circular radar: dark disc, road graph, blocks, water, then the live
  // layer — GPS route (dashed red polyline to the objective), objective,
  // police, collectibles, owned-property gold $ blips, taxi, player arrow,
  // search ring and the N compass on the rim.
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
    mapCtx.fillStyle = '#14424a';
    mapCtx.fillRect(0, py(-194), W, W - py(-194));
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
    if (G.collectibles) {
      for (const item of G.collectibles.remaining()) dot(item.x, item.z, '#ffd75e', 1.8);
    }
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
    if (G.race && G.race.active && G.race.nextGate) {
      mapCtx.strokeStyle = '#ffd75e';
      mapCtx.lineWidth = 2;
      mapCtx.beginPath();
      mapCtx.arc(px(G.race.nextGate.x), py(G.race.nextGate.z), 6, 0, Math.PI * 2);
      mapCtx.stroke();
    }
    // GPS route: dashed red L along the road grid, player → objective.
    if (!G.missions.done) {
      const L = G.missionTarget();
      mapCtx.strokeStyle = '#ff3b2e';
      mapCtx.lineWidth = 2.5;
      mapCtx.setLineDash([7, 5]);
      mapCtx.beginPath();
      mapCtx.moveTo(px(G.player.x), py(G.player.z));
      mapCtx.lineTo(px(L.x), py(G.player.z));
      mapCtx.lineTo(px(L.x), py(L.z));
      mapCtx.stroke();
      mapCtx.setLineDash([]);
      const pulse = 4 + Math.sin(performance.now() / 300) * 1.5;
      mapCtx.fillStyle = '#ffd75e';
      mapCtx.save();
      mapCtx.translate(px(L.x), py(L.z));
      mapCtx.rotate(Math.PI / 4);
      mapCtx.fillRect(-pulse / 2, -pulse / 2, pulse, pulse);
      mapCtx.restore();
    }
    for (const u of G.policeUnits()) {
      dot(u.x, u.z, u.status === 'MENCARI' ? '#ff9d5c' : '#ff3b2e', 3.5);
    }
    for (const c of G.traffic.cars) dot(c.x, c.z, '#7a8a98', 1.6);
    // Search ring: the police's last-known area, dashed red, on the radar.
    const ring = G.police && G.police.searchRing ? G.police.searchRing : null;
    if (ring) {
      mapCtx.strokeStyle = 'rgba(255, 59, 46, 0.9)';
      mapCtx.lineWidth = 2;
      mapCtx.setLineDash([6, 5]);
      mapCtx.beginPath();
      mapCtx.arc(px(ring.x), py(ring.z), ring.r * s, 0, Math.PI * 2);
      mapCtx.stroke();
      mapCtx.setLineDash([]);
    } else if (G.state.heat >= 1) {
      mapCtx.strokeStyle = 'rgba(255, 59, 46, 0.8)';
      mapCtx.lineWidth = 2;
      mapCtx.setLineDash([6, 5]);
      mapCtx.beginPath();
      mapCtx.arc(px(G.player.x), py(G.player.z), 26, 0, Math.PI * 2);
      mapCtx.stroke();
      mapCtx.setLineDash([]);
    }
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

  // Circular speed gauge: 240° dial, needle, km/h readout, gear letter
  // and a condition arc. Max 200 km/h — the drive shot's 151 reads here.
  function drawGauge(P) {
    const W = 150;
    const H = 150;
    const cx = W / 2;
    const cy = H / 2 + 6;
    gaugeCtx.clearRect(0, 0, W, H);
    const startAngle = Math.PI * 0.75;
    const sweep = Math.PI * 1.5;
    const maxKmh = 200;
    const frac = P.onFoot ? 0 : Math.min(1, P.speedKmh / maxKmh);
    gaugeCtx.strokeStyle = 'rgba(255,255,255,0.25)';
    gaugeCtx.lineWidth = 9;
    gaugeCtx.beginPath();
    gaugeCtx.arc(cx, cy, 58, startAngle, startAngle + sweep);
    gaugeCtx.stroke();
    gaugeCtx.strokeStyle = '#ffd75e';
    gaugeCtx.beginPath();
    gaugeCtx.arc(cx, cy, 58, startAngle, startAngle + sweep * frac);
    gaugeCtx.stroke();
    const cond = P.onFoot ? P.health / 100 : (P.car ? P.car.health / 100 : 1);
    gaugeCtx.strokeStyle = cond > 0.5 ? '#7dd87d' : cond > 0.25 ? '#ffb14d' : '#ff3b2e';
    gaugeCtx.lineWidth = 5;
    gaugeCtx.beginPath();
    gaugeCtx.arc(cx, cy, 46, startAngle, startAngle + sweep * cond);
    gaugeCtx.stroke();
    const needleAngle = startAngle + sweep * frac;
    gaugeCtx.strokeStyle = '#ffffff';
    gaugeCtx.lineWidth = 3;
    gaugeCtx.beginPath();
    gaugeCtx.moveTo(cx, cy);
    gaugeCtx.lineTo(cx + Math.cos(needleAngle) * 50, cy + Math.sin(needleAngle) * 50);
    gaugeCtx.stroke();
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

  function showStinger(G) {
    const ch = G.missions.chapter();
    const pips = G.missions.stagePips();
    els.stingerAct.textContent = `${ch.name} · MISI ${ch.missionNumber}/${ch.missionTotal}`;
    els.stingerTitle.textContent = ch.title;
    els.stingerObj.textContent = G.missions.objectiveText();
    els.stingerPips.textContent = pipsHtml(pips.filled, pips.total);
    els.stingerNext.textContent = G.missions.nextText();
    els.missionStinger.style.display = 'block';
    els.missionPill.style.display = 'none';
    stingerTimer = 2;
  }

  function update(G, dt) {
    const S = G.state;
    const P = G.player;
    // Mission stinger on mission/step change, then the mini-pill.
    const missionKey = `${G.missions.index}`;
    const stepKey = `${G.missions.index}:${G.missions.stepIndex ?? 0}`;
    if (missionKey !== lastMissionKey || stepKey !== lastStepKey) {
      lastMissionKey = missionKey;
      lastStepKey = stepKey;
      if (!G.missions.done) showStinger(G);
    }
    if (stingerTimer > 0) {
      stingerTimer -= dt;
      if (stingerTimer <= 0) {
        els.missionStinger.style.display = 'none';
        els.missionPill.style.display = 'flex';
      }
    }
    if (els.missionPill.style.display !== 'none' && stingerTimer <= 0 && !G.missions.done) {
      const L = G.missionTarget();
      const d = Math.round(Math.hypot(L.x - P.x, L.z - P.z));
      const timer = G.missions.surviveTimer();
      els.pillObj.textContent = G.missions.objectiveText().slice(0, 30);
      els.pillDist.textContent = timer !== null ? `· ${timer} dtk` : `· ${d} m`;
      els.pillFill.style.width = `${Math.round(G.missions.stageFrac() * 100)}%`;
      const ch = G.missions.chapter();
      els.missionPill.querySelector('.pill-title').textContent = `MISI ${ch.missionNumber}/${ch.missionTotal}`;
    }
    // REP row + chips.
    const rank = rankFor(S.rep);
    const base = [0, 400, 1000, 2000][rank.level - 1];
    const next = rank.nextAt ?? base + 1000;
    els.repText.textContent = `REP ${rank.level} · ${rank.title} (${Math.round(S.rep - base)}/${next - base})`;
    els.repFill.style.width = `${Math.round(((S.rep - base) / (next - base)) * 100)}%`;
    const unlock = nextUnlock(S.rep);
    els.chipNext.textContent = unlock ? `BERIKUTNYA di REP ${unlock.rep}: ${unlock.label}` : 'SEMUA UNLOCK TERBUKA';
    if (els.chipKoleksi && G.collectibles) {
      els.chipKoleksi.textContent = `KOLEKSI ${G.collectibles.collected}/${G.collectibles.total}`;
    }
    if (els.chipAset && G.usaha) {
      els.chipAset.textContent = `ASET ${G.usaha.count}/${G.usaha.total}`;
    }
    // Cash, stars, clock, TAGIHAN pill, income line, "DI PANDANG".
    els.cashText.textContent = `$${Math.round(S.cash).toLocaleString('en-US')}`;
    els.starsBox.innerHTML = starsHtml(S.heat);
    const mins = 16 * 60 + Math.floor(S.time * 0.5);
    els.clockText.textContent = `HARI ${S.day} · ${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')} · MUSIM KEMARAU`;
    const billTotal = G.bill ? G.bill.total() : 0;
    els.billPill.textContent = billTotal > 0 ? `TAGIHAN −$${billTotal}` : '';
    els.incomeLine.textContent = G.usaha && G.usaha.incomePerDay() > 0
      ? `+$${G.usaha.incomePerDay()}/hari · ASET ${G.usaha.count}/${G.usaha.total}`
      : '';
    if (els.seenFlash) {
      const seen = S.heat >= 1 && G.police && G.police.anyoneSees(P.x, P.z);
      els.seenFlash.style.display = seen ? 'block' : 'none';
    }
    // Police panel: only while wanted, ≤5 rows + overflow line.
    const units = G.policeUnits();
    if (S.heat >= 1 && units.length > 0) {
      els.policeBox.style.display = 'block';
      els.policeHeader.textContent = `RESPON POLISI — ${units.length} UNIT · KODE ${Math.ceil(S.heat)}`;
      const shown = units.slice(0, 5);
      els.policeRows.innerHTML = shown.map((u) => {
        const pillClass = u.status === 'MENABRAK' ? 'pill-MENABRAK'
          : u.status === 'IKAT JALAN' ? 'pill-IKAT'
            : u.status === 'SOROT' ? 'pill-SOROT'
              : u.status === 'MENCARI' ? 'pill-MENCARI' : 'pill-KEJAR';
        return `<div class="unit"><b>${u.name}</b><span class="dist">${u.dist} m</span><span class="pill ${pillClass}">${u.status}</span></div>`;
      }).join('');
      els.policeMore.textContent = units.length > 5 ? `+${units.length - 5} unit lagi` : '';
    } else {
      els.policeBox.style.display = 'none';
    }
    // Right-edge vehicle rail: the owned garage, stacked.
    if (G.garage) {
      const owned = G.garage.ownedList();
      if (owned.length > 1) {
        els.carRail.style.display = 'flex';
        els.carRailRows.innerHTML = owned.map((d) => {
          const u = G.garage.upgrades[d.id] || { engine: 0, grip: 0, turbo: 0 };
          const pips = '●'.repeat(u.engine + u.grip + u.turbo) + '○'.repeat(Math.max(0, 9 - (u.engine + u.grip + u.turbo)));
          return `<div class="rail-car"><b>${d.name}</b><span class="pips">${pips}</span></div>`;
        }).join('');
      } else {
        els.carRail.style.display = 'none';
      }
    }
    // Drive box: gauge + meters + radio + weapon rail + armor.
    drawGauge(P);
    els.vehicleName.textContent = P.onFoot ? 'JALAN KAKI' : (P.car ? P.car.name.toUpperCase() : 'CEMPAKA GT');
    if (els.fuelFill) els.fuelFill.style.width = `${Math.round(P.fuel)}%`;
    if (els.nitroFill) els.nitroFill.style.width = `${Math.round(P.boost * 100)}%`;
    if (els.condFill) {
      const cond = P.onFoot ? P.health : (P.car ? P.car.health : 100);
      els.condFill.style.width = `${Math.round(cond)}%`;
    }
    if (els.armorFill) els.armorFill.style.width = `${Math.round(P.armor || 0)}%`;
    songTimer -= dt;
    if (songTimer <= 0) {
      songTimer = 24;
      songIndex = (songIndex + 1) % SONGS.length;
      if (songIndex % 2 === 1) {
        djIndex = (djIndex + 1) % DJ_LINES.length;
        els.radioText.textContent = `RADIO KEMARAU 92.4 · ${DJ_LINES[djIndex]}`;
      } else {
        els.radioText.textContent = `RADIO KEMARAU 92.4 · ${SONGS[songIndex]}`;
      }
    }
    // Weapon rail: 5 slots, ammo counts, 2 LOCKED with a padlock — the
    // depth advert. Never hide an unowned weapon behind a fake label.
    const slot = (n, name, owned, ammoText, active) => {
      if (!owned) return `<span class="slot locked">${n} 🔒 ${name}</span>`;
      return `<span class="slot${active ? ' active' : ''}">${n} ${name} · <span class="ammo">${ammoText}</span></span>`;
    };
    const magText = (w) => {
      if (w === 'pistol') return '∞';
      const mag = P.mag[w];
      if (P.reloading && P.weapon === w) return 'ISI ULANG…';
      return `${mag === Infinity ? '∞' : mag}/${w === 'shotgun' ? P.shells : w === 'smg' ? P.smgAmmo : w === 'rifle' ? P.rifleAmmo : P.launcherAmmo}`;
    };
    els.weaponBox.innerHTML =
      slot(1, WEAPONS.pistol.name, true, magText('pistol'), P.weapon === 'pistol')
      + slot(2, WEAPONS.shotgun.name, P.hasShotgun, magText('shotgun'), P.weapon === 'shotgun')
      + slot(3, WEAPONS.smg.name, P.hasSmg, magText('smg'), P.weapon === 'smg')
      + slot(4, WEAPONS.rifle.name, P.hasRifle, magText('rifle'), P.weapon === 'rifle')
      + slot(5, WEAPONS.launcher.name, P.hasLauncher, magText('launcher'), P.weapon === 'launcher');
    els.crosshair.style.display = (!crosshairHidden && P.onFoot) ? 'block' : 'none';
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
    if (tickerTimer > 0) {
      tickerTimer -= dt;
      if (tickerTimer <= 0) els.ticker.style.display = 'none';
    }
    if (ledgerTimer > 0) {
      ledgerTimer -= dt;
      if (ledgerTimer <= 0) els.ledger.style.display = 'none';
    }
    // Pause screen: itemised bill + KEMAJUAN, only here (the HUD shows
    // one pill and one chip row).
    const pauseBill = document.getElementById('pauseBill');
    if (pauseBill && G.bill && !els.screen.classList.contains('hidden')) {
      const lines = G.bill.lines || [];
      pauseBill.innerHTML = lines.length
        ? `<div style="margin-top:10px;font-size:13px">TAGIHAN: ${lines.map((l) => `${l.label} −$${l.amount}`).join(' · ')} — total −$${G.bill.total()}</div>`
        : '';
    }
    const pauseKema = document.getElementById('pauseKema');
    if (pauseKema && G.progress && !els.screen.classList.contains('hidden')) {
      const rk = rankFor(S.rep);
      pauseKema.innerHTML = `KEMAJUAN <b>${G.progress.percent}%</b> · ${rk.title} · Misi ${G.missions.done ? 8 : G.missions.index}/8 · Koleksi ${G.collectibles ? G.collectibles.collected : 0}/24 · Aset ${G.usaha ? G.usaha.count : 0}/3`;
    }
  }

  function toast(text, seconds = 4) {
    els.toast.textContent = text;
    toastTimer = seconds;
  }

  // Dispatch ticker: one-way police radio lines at the top of the center
  // band, e.g. "POLISI: Semua unit — kejar sedan merah di Kawasan Industri!"
  function ticker(text, seconds = 5) {
    els.ticker.textContent = text;
    els.ticker.style.display = 'block';
    tickerTimer = seconds;
  }

  // Mission ledger: the end-of-mission settlement card.
  function showLedger(data, seconds = 6) {
    lastLedger = data;
    els.ledgerTitle.textContent = `${data.title} SELESAI`;
    els.ledgerGross.textContent = `+$${data.gross.toLocaleString('en-US')}`;
    els.ledgerBill.textContent = `−$${data.bill.toLocaleString('en-US')}`;
    els.ledgerRep.textContent = `+${data.rep}`;
    els.ledgerNet.textContent = `+$${data.net.toLocaleString('en-US')}`;
    els.ledger.style.display = 'block';
    ledgerTimer = seconds;
  }
  function reshowLedger(seconds = 600) {
    if (lastLedger) showLedger(lastLedger, seconds);
  }

  function damageFlash() {
    if (!els.damageVignette) return;
    els.damageVignette.style.opacity = '1';
    setTimeout(() => { els.damageVignette.style.opacity = '0'; }, 260);
  }

  function setPhotoMode(on) {
    document.body.classList.toggle('photo', !!on);
  }

  // Hide / show the crosshair. Used by the story shot only: the
  // crosshair is centred on screen, exactly where the mission ledger
  // card sits, so it prints a "+" over the ledger. update() keeps the
  // hide in force every frame while the flag is set; normal play never
  // calls this, so the crosshair is always there on foot.
  function setCrosshairVisible(visible) {
    crosshairHidden = !visible;
    els.crosshair.style.display = visible ? 'block' : 'none';
  }

  // who: display name; portraitKey: a CHARACTERS key ('wira', 'aska', ...).
  // The role chip is teal; the line clamps to 2, inside 24px safe margins.
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
    const role = CHARACTERS[portraitKey] ? CHARACTERS[portraitKey].role : '';
    els.dialogueName.textContent = who;
    els.dialogueRole.textContent = role;
    els.dialogueRole.style.display = role ? 'inline-block' : 'none';
    els.dialogueLine.textContent = line;
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

  return {
    update, toast, ticker, dialogue, prompt, announce, showScreen, hideScreen,
    popups, els, showLedger, reshowLedger, damageFlash, setPhotoMode, showStinger,
    setCrosshairVisible,
  };
}
