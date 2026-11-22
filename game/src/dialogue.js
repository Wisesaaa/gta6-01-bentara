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
  { who: 'wira', line: 'Jemputan darurat di Rumah Sakit. Mereka yang menyerang tidak sabar menunggu.' },
  { who: 'ijal', line: 'Ada CEMPAKA GT curian di Kawasan Industri. Bawa pulang ke Marina — mulus.' },
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

// ---------------------------------------------------------------------------
// Dialogue graph (R19 D3 — dialogue-systems skill).
// The cover frame's Sari line is a STORY line with a choice, not a radio
// call: the police radio stays the separate #ticker, and Sari speaks
// from the bottom-centre dialogue card with a 96 px portrait. The graph
// contract: every node has a stable lineId (so a verdict can cite the
// line), choices live on transitions (not on nodes), effects write into
// a var store, and the graph validates before it runs.
//
// Cover node (DLG_SARI_001): "Bang Ijal sudah di Kios Baris — ambil
// kasetnya atau kejar Garuda-1?" — a real fork in the mission (the
// kaset is mission 7's objective; Garuda-1 is the heli above the car).
// The two branches are one line each, both in Sari's voice, both true
// to the mission state.
export const SARI_COVER_GRAPH = {
  start: 'sari_cover',
  vars: { kaset: false, kejar: false },
  nodes: {
    sari_cover: {
      speaker: 'sari',
      lineId: 'DLG_SARI_001',
      line: 'Bang Ijal sudah di Kios Baris — ambil kasetnya atau kejar Garuda-1?',
      choices: [
        { label: 'Ambil kasetnya', to: 'sari_kaset', set: { kaset: true } },
        { label: 'Kejar Garuda-1', to: 'sari_kejar', set: { kejar: true } },
      ],
    },
    sari_kaset: {
      speaker: 'sari',
      lineId: 'DLG_SARI_002',
      line: 'Kasetnya di kios nomor tiga. Jangan sampai polisi ikut.',
      next: 'end',
    },
    sari_kejar: {
      speaker: 'sari',
      lineId: 'DLG_SARI_003',
      line: 'Hati-hati — Garuda-1 sudah di atasmu. Belok tajam, jangan berhenti.',
      next: 'end',
    },
    end: { end: true },
  },
};

// Validate a graph before it runs: every referenced node exists, every
// choice target exists, every set() key is declared in vars, the start
// node exists, and every node is reachable from the start. Returns the
// list of problems (empty = valid).
export function validateDialogueGraph(graph) {
  const problems = [];
  if (!graph || !graph.nodes) return ['graph has no nodes'];
  if (!graph.nodes[graph.start]) problems.push(`start node "${graph.start}" does not exist`);
  const seen = new Set();
  const queue = graph.start && graph.nodes[graph.start] ? [graph.start] : [];
  while (queue.length > 0) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    const node = graph.nodes[id];
    if (!node) { problems.push(`node "${id}" does not exist`); continue; }
    if (node.end) continue;
    if (!node.line) problems.push(`node "${id}" has no line`);
    if (node.choices) {
      for (const c of node.choices) {
        if (!graph.nodes[c.to]) problems.push(`node "${id}" choice "${c.label}" points at missing node "${c.to}"`);
        else queue.push(c.to);
        if (c.set) {
          for (const k of Object.keys(c.set)) {
            if (!graph.vars || !(k in graph.vars)) problems.push(`node "${id}" choice "${c.label}" sets undeclared var "${k}"`);
          }
        }
      }
    } else if (node.next) {
      if (!graph.nodes[node.next]) problems.push(`node "${id}" next points at missing node "${node.next}"`);
      else queue.push(node.next);
    } else {
      problems.push(`node "${id}" has neither choices nor next nor end`);
    }
  }
  for (const id of Object.keys(graph.nodes)) {
    if (!seen.has(id)) problems.push(`node "${id}" is unreachable from start`);
  }
  return problems;
}

// Walk a graph along a list of choice indexes (0-based per node).
// Returns the visited lineIds + the final vars, for QA.
export function walkDialogueGraph(graph, picks = []) {
  const vars = { ...(graph.vars || {}) };
  const lines = [];
  let id = graph.start;
  let pick = 0;
  while (id && graph.nodes[id] && !graph.nodes[id].end) {
    const node = graph.nodes[id];
    if (node.lineId) lines.push(node.lineId);
    if (node.choices && node.choices.length > 0) {
      const choice = node.choices[picks[pick] || 0] || node.choices[0];
      pick += 1;
      if (choice.set) Object.assign(vars, choice.set);
      id = choice.to;
    } else {
      id = node.next;
    }
  }
  return { lines, vars, ended: !!(id && graph.nodes[id] && graph.nodes[id].end) };
}

// Runner: holds the current node + vars, renders through hud.dialogue().
// choose(i) applies the choice's set() and moves to its target node.
// current() returns { speaker, lineId, line, choices } for the node.
export function createDialogueRunner(graph, render) {
  const problems = validateDialogueGraph(graph);
  if (problems.length > 0) throw new Error(`dialogue graph invalid: ${problems.join('; ')}`);
  const vars = { ...(graph.vars || {}) };
  let id = graph.start;
  function current() {
    const node = graph.nodes[id];
    if (!node || node.end) return null;
    return {
      speaker: node.speaker,
      lineId: node.lineId,
      line: node.line,
      choices: (node.choices || []).map((c, i) => ({
        text: c.label,
        selected: i === 0,
        onPick: () => choose(i),
      })),
    };
  }
  function show() {
    const cur = current();
    if (cur && render) render(cur);
    return cur;
  }
  function choose(i) {
    const node = graph.nodes[id];
    if (!node || !node.choices || !node.choices[i]) return null;
    const choice = node.choices[i];
    if (choice.set) Object.assign(vars, choice.set);
    id = choice.to;
    return show();
  }
  return { current, show, choose, vars: () => ({ ...vars }), node: () => id };
}
