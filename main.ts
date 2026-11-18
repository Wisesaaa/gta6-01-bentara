// BENTARA: DRY SEASON — a three.js open-world crime game for the gta6-01
// "Make GTA 6" bounty. The game is this directory's game/ folder, plain
// static files a desktop browser loads offline (game/index.html and its ES
// modules, three.js vendored under game/vendor/, no network request), and
// the program hands it in: it copies game/ and screenshots/ from beside
// this file to /output and writes /output/dossier.json, the summary the
// judge reads, with the vendored make.fun library.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');

// Preflight: refuse to build an entry the scorer would refuse — no game
// folder, no screenshots, the wrong number of them, or one over 256 KiB.
// The first screenshot by name is the cover.
if (!existsSync(gameDir)) {
  throw new Error(`game/ folder missing at ${gameDir}`);
}
if (!existsSync(join(gameDir, 'index.html'))) {
  throw new Error('game/index.html missing — the entry has no entrypoint');
}
if (!existsSync(shotsDir)) {
  throw new Error(`screenshots/ folder missing at ${shotsDir}`);
}
const shotFiles = readdirSync(shotsDir).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort();
if (shotFiles.length < 3 || shotFiles.length > 4) {
  throw new Error(`expected 3–4 screenshots, found ${shotFiles.length}: ${shotFiles.join(', ')}`);
}
for (const f of shotFiles) {
  const size = statSync(join(shotsDir, f)).size;
  if (size > 262144) {
    throw new Error(`screenshot ${f} is ${size} bytes, over the 256 KiB cap`);
  }
}
console.log(`BENTARA preflight ok — cover ${shotFiles[0]}, ${shotFiles.length} screenshots`);

mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
console.log(`BENTARA dossier written to ${join(out, 'dossier.json')}`);
