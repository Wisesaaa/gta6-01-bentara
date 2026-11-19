// Characters on screen: procedural portraits + dialogue lines. Every rival
// shows a named face mid-chase; BENTARA used to keep its cast in text only.
// Portraits are drawn on a 2D canvas (skin, hat, shirt, eyes) so they read
// at thumbnail size without any image asset.
import { CHARACTERS, DJ_LINES } from './config.js';
import { pick } from './rng.js';

// Mission intros: one line per mission, spoken by the contact who gives it.
export const MISSION_INTROS = [
  { who: 'wira', line: 'Selamat datang di Bentara. Musim kemarau ini, kota ini milik yang berani.' },
  { who: 'wira', line: 'Ada paket buat diantar ke Baris Utara. Jangan sampai telat — dan jangan hancurkan kios.' },
  { who: 'sari', line: 'Mobil itu sudah lama mengganggu kawasan industri. Hilangkan. Saya yang bayar.' },
  { who: 'sari', line: 'Paket ruko sudah siap. Ambil di Deret Ruko, antar ke Plaza Menara.' },
  { who: 'ijal', line: 'Plaza butuh orang yang bisa dipegang. Tahan di sana sampai saya bilang aman.' },
  { who: 'ijal', line: 'Jemputan darurat di Rumah Sakit. Mereka yang menyerang tidak sabar menunggu.' },
  { who: 'dedi', line: 'Ada CEMPAKA GT curian di Kawasan Industri. Bawa pulang ke Marina — mulus.' },
  { who: 'rahmat', line: 'Ini Letkol Rahmat. Seluruh Bentara sudah tahu namamu. Panas terakhir, nak.' },
];

export const RAHMAT_TAUNTS = [
  'Letkol Rahmat: Tiga bintang. Kamu pikir bisa lari dari seluruh Polres Bentara?',
  'Letkol Rahmat: Helikopter sudah di atas kamu. Menyerah, atau saya yang jemput.',
  'Letkol Rahmat: Jalanan ini saya yang jaga. Kamu cuma tamu yang tidak diundang.',
];

export const SARI_BANTER = [
  'Sari: Barang sampai, uang jalan. Jangan bawa polisi ke ruko saya.',
  'Sari: Kamu cepat. Saya suka orang cepat — dan orang yang tidak banyak tanya.',
];

export const IJAL_BANTER = [
  'Bang Ijal: Mesin bunyi begitu, remuk dikit. Bawa ke bengkel, saya yang urus.',
  'Bang Ijal: Mobil kamu itu nyawanya sembilan. Jangan boros-boros amat.',
];

export const ASKA_BANTER = [
  'Pak Aska: Barang sampai, uang jalan. Marina tidak pernah tidur.',
  'Pak Aska: Kamu yang bawa paket itu? Cepat. Saya suka orang cepat.',
];

export const RINI_BANTER = [
  'Mbak Rini: Warung ini bisa jadi milikmu. Dua ribu lima ratus, untung tiap hari.',
  'Mbak Rini: Kopi tetap saya yang seduh. Untungnya yang jadi milikmu.',
];

function hexCss(hex) {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

function drawFace(g, c, skin) {
  g.fillStyle = skin;
  g.beginPath();
  g.arc(32, 34, 17, 0, Math.PI * 2);
  g.fill();
  // Eyes.
  g.fillStyle = '#1a1a1a';
  g.beginPath(); g.arc(26, 32, 2.2, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(38, 32, 2.2, 0, Math.PI * 2); g.fill();
  // Smile.
  g.strokeStyle = '#1a1a1a';
  g.lineWidth = 1.6;
  g.beginPath(); g.arc(32, 38, 6, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
}

function drawHat(g, c) {
  if (c.hat === 'peci') {
    g.fillStyle = '#1d2a3a';
    g.beginPath();
    g.ellipse(32, 19, 16, 7, 0, 0, Math.PI * 2);
    g.fill();
    g.fillRect(16, 12, 32, 8);
  } else if (c.hat === 'cap') {
    g.fillStyle = hexCss(c.shirt);
    g.beginPath();
    g.arc(32, 20, 15, Math.PI, 0);
    g.fill();
    g.fillRect(32, 16, 20, 5);
  } else if (c.hat === 'police') {
    g.fillStyle = '#1d2a3a';
    g.beginPath();
    g.arc(32, 20, 15, Math.PI, 0);
    g.fill();
    g.fillStyle = '#ffd75e';
    g.fillRect(16, 17, 32, 3);
    g.fillStyle = '#c0392b';
    g.beginPath(); g.arc(32, 12, 3, 0, Math.PI * 2); g.fill();
  } else {
    // hair
    g.fillStyle = '#1a1a1a';
    g.beginPath();
    g.arc(32, 24, 16, Math.PI * 1.05, Math.PI * 1.95);
    g.fill();
  }
}

function drawShoulders(g, c) {
  g.fillStyle = hexCss(c.shirt);
  g.beginPath();
  g.moveTo(8, 64);
  g.quadraticCurveTo(32, 42, 56, 64);
  g.closePath();
  g.fill();
  // Collar / badge.
  if (c.hat === 'police') {
    g.fillStyle = '#ffd75e';
    g.beginPath(); g.arc(32, 56, 3.5, 0, Math.PI * 2); g.fill();
  } else {
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(29, 48, 6, 16);
  }
}

// Draw a character's portrait onto a square canvas (64x64 by default).
export function drawPortrait(canvas, who) {
  const c = CHARACTERS[who] || CHARACTERS.wira;
  const g = canvas.getContext('2d');
  const size = canvas.width;
  const scale = size / 64;
  g.save();
  g.scale(scale, scale);
  g.clearRect(0, 0, 64, 64);
  // Warm backdrop circle.
  const bg = g.createRadialGradient(32, 28, 4, 32, 32, 34);
  bg.addColorStop(0, '#ffe9b0');
  bg.addColorStop(1, '#c98a4a');
  g.fillStyle = bg;
  g.beginPath(); g.arc(32, 32, 32, 0, Math.PI * 2); g.fill();
  drawShoulders(g, c);
  drawFace(g, c, hexCss(c.skin));
  drawHat(g, c);
  g.restore();
  return c;
}

export function characterLine(who, rng) {
  const c = CHARACTERS[who];
  return c ? c.line : '';
}

export function randomTaunt(rng) {
  return pick(rng, RAHMAT_TAUNTS);
}

export function randomDjLine(rng) {
  return pick(rng, DJ_LINES);
}

export function missionIntro(index) {
  return MISSION_INTROS[Math.min(index, MISSION_INTROS.length - 1)];
}
