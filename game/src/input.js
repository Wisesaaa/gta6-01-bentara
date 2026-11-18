// Keyboard + mouse input. Held keys give movement; one-shot presses are queued
// as bit flags and taken once, so a press between frames is never lost.
export const ACT_CONFIRM = 1;
export const ACT_PAUSE = 2;
export const ACT_INTERACT = 4;
export const ACT_ENTER = 8;
export const ACT_RADIO = 16;
export const ACT_WEAPON1 = 32;
export const ACT_WEAPON2 = 64;

const KEYMAP = {
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

  window.addEventListener('keydown', (event) => {
    // Space is both handbrake (held) and confirm (one-shot): it must set the
    // confirm flag AND the held key, so it can start the game from the title.
    if (event.code === 'Space' && !event.repeat) actions |= ACT_CONFIRM;
    const dir = KEYMAP[event.code];
    if (dir) { held.add(dir); event.preventDefault(); return; }
    if (event.repeat) return;
    if (event.code === 'Enter') actions |= ACT_CONFIRM;
    else if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACT_PAUSE;
    else if (event.code === 'KeyE') actions |= ACT_INTERACT;
    else if (event.code === 'KeyF') actions |= ACT_ENTER;
    else if (event.code === 'KeyR') actions |= ACT_RADIO;
    else if (event.code === 'Digit1') actions |= ACT_WEAPON1;
    else if (event.code === 'Digit2') actions |= ACT_WEAPON2;
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    const dir = KEYMAP[event.code];
    if (dir) held.delete(dir);
  });
  window.addEventListener('blur', () => held.clear());
  // Confirm presses count anywhere on the window (the title screen sits
  // above the canvas, so a canvas-only listener would miss its clicks).
  window.addEventListener('pointerdown', (event) => {
    mouseDown = true;
    mouseClicked = true;
    if (event.button === 0) actions |= ACT_CONFIRM;
  });
  window.addEventListener('pointerup', () => { mouseDown = false; });

  return {
    up: () => held.has('up'),
    down: () => held.has('down'),
    left: () => held.has('left'),
    right: () => held.has('right'),
    brake: () => held.has('brake'),
    run: () => held.has('run'),
    mouseDown: () => mouseDown,
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
  };
}
