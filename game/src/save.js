// Save / load through localStorage. Autosave runs on a timer in the game loop
// (every 20 s); the safehouse also saves immediately.
import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const data = {
      cash: Math.round(state.cash),
      rep: Math.round(state.rep),
      missionIndex: state.missionIndex,
      hasShotgun: state.player.hasShotgun,
      shells: state.player.shells,
      day: state.day,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}
