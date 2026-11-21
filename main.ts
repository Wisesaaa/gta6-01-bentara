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

function runPreflight(): string[] {
  requireFolder(gameSource, 'game folder');
  requireFile(join(gameSource, 'index.html'), 'game entrypoint');
  requireFolder(shotsSource, 'screenshots folder');

  const shots = collectShots(shotsSource);
  if (shots.length < MIN_SHOTS || shots.length > MAX_SHOTS) {
    abort(
      `need ${MIN_SHOTS}-${MAX_SHOTS} screenshots, got ${shots.length} (${shots.join(', ')})`,
    );
  }

  for (const name of shots) {
    const bytes = statSync(join(shotsSource, name)).size;
    if (bytes > MAX_SHOT_BYTES) {
      abort(`screenshot ${name} is ${bytes} bytes, above the ${MAX_SHOT_BYTES} byte limit`);
    }
  }

  return shots;
}

function copyTree(source: string, target: string): void {
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true });
}

const shotList = runPreflight();
const coverName = shotList[0];
console.log(`preflight passed: cover is ${coverName}, ${shotList.length} screenshots ready`);

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
