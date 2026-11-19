// Input: WASD + SPACE handbrake, mouse aim/fire, F enter/steal, E interact,
// R radio, P pause, 1/2/3 weapon slots, M mute. Everything the game loop
// needs arrives as pure queries (up/down/left/right/brake/run/mouseDown)
// or as one-shot bit flags taken exactly once per frame (takeActions /
// takeClick), so a held key never double-fires an action.
//
// Space is both handbrake (held) and confirm (one-shot): it sets the
// confirm flag AND the held key, so it can start the game from the title.
// Pointer-down confirms anywhere on the window — the title screen sits
// above the canvas, so a canvas-only listener would miss its clicks.
export const ACT_ENTER = 1;
export const ACT_INTERACT = 2;
export const ACT_RADIO = 4;
export const ACT_PAUSE = 8;
export const ACT_WEAPON1 = 16;
export const ACT_WEAPON2 = 32;
export const ACT_WEAPON3 = 64;
export const ACT_CONFIRM = 128;
export const ACT_WEAPON4 = 256;
export const ACT_WEAPON5 = 512;
export const ACT_RELOAD = 1024;
export const ACT_BRIBE = 2048;
export const ACT_SLEEP = 4096;

const KEY_ACTIONS = {
  KeyF: ACT_ENTER,
  KeyE: ACT_INTERACT,
  KeyR: ACT_RADIO,
  KeyP: ACT_PAUSE,
  Escape: ACT_PAUSE,
  Enter: ACT_CONFIRM,
  Space: ACT_CONFIRM,
  Digit1: ACT_WEAPON1,
  Digit2: ACT_WEAPON2,
  Digit3: ACT_WEAPON3,
  Digit4: ACT_WEAPON4,
  Digit5: ACT_WEAPON5,
  KeyQ: ACT_RELOAD,
  KeyB: ACT_BRIBE,
  KeyT: ACT_SLEEP,
};
const HELD_KEYS = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'brake',
  ShiftLeft: 'run', ShiftRight: 'run',
};

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouseDown = false;
  let mouseClicked = false;
  let muted = false;

  const down = (event) => {
    const dir = HELD_KEYS[event.code];
    if (dir) {
      held.add(dir);
      event.preventDefault();
    }
    if (event.repeat) return;
    const a = KEY_ACTIONS[event.code];
    if (a) {
      actions |= a;
      if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();
    }
    if (event.code === 'KeyM') muted = !muted;
  };
  const up = (event) => {
    const dir = HELD_KEYS[event.code];
    if (dir) held.delete(dir);
  };
  const blur = () => { held.clear(); mouseDown = false; };
  const pointerDown = (event) => {
    mouseDown = true;
    mouseClicked = true;
    if (event.button === 0) actions |= ACT_CONFIRM;
  };
  const pointerUp = () => { mouseDown = false; };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', blur);
  window.addEventListener('pointerdown', pointerDown);
  window.addEventListener('pointerup', pointerUp);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { held.clear(); mouseDown = false; }
  });

  return {
    up: () => held.has('up'),
    down: () => held.has('down'),
    left: () => held.has('left'),
    right: () => held.has('right'),
    brake: () => held.has('brake'),
    run: () => held.has('run'),
    mouseDown: () => mouseDown,
    isMuted: () => muted,
    // True once per click; consumed by the caller.
    takeClick() {
      const c = mouseClicked;
      mouseClicked = false;
      return c;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    dispose() {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      window.removeEventListener('pointerdown', pointerDown);
      window.removeEventListener('pointerup', pointerUp);
    },
  };
}
