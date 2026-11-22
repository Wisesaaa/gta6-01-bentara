// Entry point for the BENTARA: DRY SEASON submission.
//
// What this script does, end to end: it takes the playable game that lives
// next to this file (the game/ directory, static files only) plus the
// screenshots/ renders, checks them against the bounty limits, copies both
// directories into the output directory, and finally asks the vendored
// make.fun helper to describe the finished entry in dossier.json.
//
// Run it locally like this:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// The grader runs the same file with MAKEFUN_OUTPUT_DIR pointing at /output.

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const rootDir = fileURLToPath(new URL('./', import.meta.url));
const destination = process.env.MAKEFUN_OUTPUT_DIR || '/output';
const gameSource = join(rootDir, 'game');
const shotsSource = join(rootDir, 'screenshots');

const MAX_SHOT_BYTES = 262144;
const MIN_SHOTS = 3;
const MAX_SHOTS = 4;
// REVISED — the dossier is a 4-frame sheet (cover + 3 small). A folder
// with any 3 images would pass the count check but ship a frame short,
// so the four expected names are asserted exactly: no missing frame,
// no stray fifth image.
const EXPECTED_SHOTS = ['1-heat.jpg', '2-drive.jpg', '3-foot.jpg', '4-story.jpg'];

function abort(reason: string): never {
  throw new Error(reason);
}

function requireFolder(path: string, label: string): void {
  if (existsSync(path) === false) {
    abort(`${label} not found: ${path}`);
  }
}

function requireFile(path: string, label: string): void {
  if (existsSync(path) === false) {
    abort(`${label} not found: ${path}`);
  }
}

function collectShots(folder: string): string[] {
  const entries = readdirSync(folder);
  const images = entries.filter((name) => {
    return /\.(png|jpg|jpeg)$/i.test(name);
  });
  images.sort();
  return images;
}

// DRAFT — a screenshot with the right extension but the wrong bytes
// (a truncated write, a mislabelled PNG) would pass the size check and
// fail later in the grader. The magic bytes are the cheap proof the
// file really is the image its name claims: JPEG starts FF D8, PNG
// starts 89 50 4E 47 0D 0A 1A 0A.
function requireImageMagic(path: string, name: string): void {
  const head = readFileSync(path).subarray(0, 8);
  const isJpeg = /\.jpe?g$/i.test(name);
  if (isJpeg) {
    if (head[0] !== 0xff || head[1] !== 0xd8) {
      abort(`screenshot ${name} is not a JPEG (magic bytes ${head[0]?.toString(16)} ${head[1]?.toString(16)})`);
    }
    return;
  }
  const pngMagic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (pngMagic.some((b, i) => head[i] !== b)) {
    abort(`screenshot ${name} is not a PNG (magic bytes do not match)`);
  }
}

// REVISED — preflight returns each shot with its byte size, so the
// console line below lists the dossier's real bytes per frame instead
// of only a count. A frame that silently shrank (bad encode, empty
// render) is visible here before the copy happens.
function runPreflight(): Array<{ name: string; bytes: number }> {
  requireFolder(gameSource, 'game folder');
  requireFile(join(gameSource, 'index.html'), 'game entrypoint');
  requireFolder(shotsSource, 'screenshots folder');

  const shots = collectShots(shotsSource);
  if (shots.length < MIN_SHOTS || shots.length > MAX_SHOTS) {
    abort(
      `need ${MIN_SHOTS}-${MAX_SHOTS} screenshots, got ${shots.length} (${shots.join(', ')})`,
    );
  }
  const missing = EXPECTED_SHOTS.filter((name) => shots.includes(name) === false);
  if (missing.length > 0) {
    abort(`missing expected screenshot(s): ${missing.join(', ')} (have ${shots.join(', ')})`);
  }
  const extra = shots.filter((name) => EXPECTED_SHOTS.includes(name) === false);
  if (extra.length > 0) {
    abort(`unexpected extra screenshot(s): ${extra.join(', ')} (expected only ${EXPECTED_SHOTS.join(', ')})`);
  }

  const sized: Array<{ name: string; bytes: number }> = [];
  for (const name of shots) {
    const bytes = statSync(join(shotsSource, name)).size;
    if (bytes > MAX_SHOT_BYTES) {
      abort(`screenshot ${name} is ${bytes} bytes, above the ${MAX_SHOT_BYTES} byte limit`);
    }
    requireImageMagic(join(shotsSource, name), name);
    sized.push({ name, bytes });
  }

  return sized;
}

function copyTree(source: string, target: string): void {
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true });
}

const shotList = runPreflight();
const coverName = shotList[0].name;
const shotSizes = shotList.map((s) => `${s.name} (${(s.bytes / 1024).toFixed(1)} KiB)`).join(', ');
console.log(`preflight passed: cover is ${coverName}, ${shotList.length} screenshots ready — ${shotSizes}`);

copyTree(gameSource, join(destination, 'game'));
copyTree(shotsSource, join(destination, 'screenshots'));

const limits = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const dossierPath = join(destination, 'dossier.json');
writeFileSync(dossierPath, buildDossier(destination, limits));
console.log(`dossier written: ${dossierPath}`);
