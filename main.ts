// BENTARA: DRY SEASON — a three.js open-world crime game for the gta6-01
// "Make GTA 6" bounty. The game is this directory's game/ folder, plain
// static files a desktop browser loads offline (game/index.html and its ES
// modules, three.js vendored under game/vendor/, no network request), and
// this program hands it in: it copies game/ and screenshots/ from beside
// this file to /output and writes /output/dossier.json, the summary the
// judge reads, with the vendored make.fun library.
//
// The entrypoint is deliberately dumb: every check below is a refusal to
// hand in an entry the scorer would refuse, so a bad build fails loudly
// here instead of silently on the leaderboard.
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

// --- Preflight, in three refusals -------------------------------------------
// 1. The game folder and its entrypoint must exist.
function checkGame() {
  if (!existsSync(gameDir)) throw new Error(`game/ folder missing at ${gameDir}`);
  if (!existsSync(join(gameDir, 'index.html'))) {
    throw new Error('game/index.html missing — the entry has no entrypoint');
  }
  // The vendor three.js must be present: the game loads offline, no CDN.
  if (!existsSync(join(gameDir, 'vendor', 'three.module.min.js'))) {
    throw new Error('game/vendor/three.module.min.js missing — the game cannot load offline');
  }
}

// 2. Screenshots: 3–4, each ≤256 KiB, first by name is the cover.
function checkScreenshots() {
  if (!existsSync(shotsDir)) throw new Error(`screenshots/ folder missing at ${shotsDir}`);
  const files = readdirSync(shotsDir).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort();
  if (files.length < 3 || files.length > 4) {
    throw new Error(`expected 3–4 screenshots, found ${files.length}: ${files.join(', ')}`);
  }
  const oversize = files.filter((f) => statSync(join(shotsDir, f)).size > 262144);
  if (oversize.length > 0) {
    throw new Error(`screenshots over the 256 KiB cap: ${oversize.join(', ')}`);
  }
  return files;
}

// 3. The game tree must fit the scorer's caps (993 files, 48 MiB, paths
// ≤1000 bytes) — counted here so the dossier never has to refuse it.
function countGameFiles(dir, depth = 0) {
  let files = 0;
  let bytes = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (p.length > 1000) throw new Error(`game path over 1000 bytes: ${p}`);
    if (entry.isDirectory()) {
      const sub = countGameFiles(p, depth + 1);
      files += sub.files;
      bytes += sub.bytes;
    } else {
      files += 1;
      bytes += statSync(p).size;
    }
  }
  return { files, bytes };
}

checkGame();
const shotFiles = checkScreenshots();
const gameCount = countGameFiles(gameDir);
if (gameCount.files > 993) throw new Error(`game/ has ${gameCount.files} files, over the 993 cap`);
if (gameCount.bytes > 50331648) throw new Error(`game/ is ${gameCount.bytes} bytes, over the 48 MiB cap`);
console.log(`BENTARA preflight ok — cover ${shotFiles[0]}, ${shotFiles.length} screenshots, game ${gameCount.files} files / ${(gameCount.bytes / 1024).toFixed(0)} KiB`);

// --- Copy -------------------------------------------------------------------
mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// --- Dossier ----------------------------------------------------------------
// Caps from the scorer's own gate.json: text_max_bytes shapes the bytes;
// the rest refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB
// of game files, in all, or a path under game/ over 1000 bytes).
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);
console.log(`BENTARA dossier written to ${join(out, 'dossier.json')}`);
