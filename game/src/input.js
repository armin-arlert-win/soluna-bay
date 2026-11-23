// Keyboard and mouse input for Soluna Bay. Keys are tracked by code so the
// layout does not matter; mouse movement steers the camera (pointer lock when
// the player clicks the canvas) and clicks fire weapons.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MAP = 4;
export const ACTION_ENTER_CAR = 8;
export const ACTION_STEAL = 16;
export const ACTION_RELOAD = 32;
export const ACTION_RADIO = 64;
export const ACTION_WEAPON_NEXT = 128;
export const ACTION_HANDBRAKE = 256;
export const ACTION_MISSION = 512;

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let mouseDX = 0;
  let mouseDY = 0;
  let mouseDown = false;
  let mouseClicked = false;
  let locked = false;

  function codeOf(event) {
    return event.code;
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(codeOf(event));
    pressed.add(codeOf(event));
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(codeOf(event));
  });
  window.addEventListener('blur', () => {
    keys.clear();
  });
  document.addEventListener('mousemove', (event) => {
    if (locked) {
      mouseDX += event.movementX || 0;
      mouseDY += event.movementY || 0;
    }
  });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      mouseDown = true;
      mouseClicked = true;
      if (!locked && document.pointerLockElement !== canvas) {
        try {
          canvas.requestPointerLock();
        } catch {
          // Pointer lock is a nicety; the game plays without it.
        }
      }
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouseDown = false;
  });

  const KEY_ACTIONS = {
    Enter: ACTION_CONFIRM,
    Space: ACTION_CONFIRM,
    Escape: ACTION_PAUSE,
    KeyM: ACTION_MAP,
    KeyE: ACTION_ENTER_CAR,
    KeyF: ACTION_STEAL,
    KeyR: ACTION_RELOAD,
    KeyQ: ACTION_RADIO,
    KeyC: ACTION_WEAPON_NEXT,
    KeyJ: ACTION_MISSION,
  };

  return {
    /** Held movement keys as {forward, back, left, right, run}. */
    move() {
      return {
        forward: keys.has('KeyW') || keys.has('ArrowUp'),
        back: keys.has('KeyS') || keys.has('ArrowDown'),
        left: keys.has('KeyA') || keys.has('ArrowLeft'),
        right: keys.has('KeyD') || keys.has('ArrowRight'),
        run: keys.has('ShiftLeft') || keys.has('ShiftRight'),
        brake: keys.has('Space'),
      };
    },
    /** One-shot actions pressed since the last call (consumed). */
    takeActions() {
      let actions = 0;
      for (const code of pressed) {
        const flag = KEY_ACTIONS[code];
        if (flag) actions |= flag;
      }
      pressed.clear();
      return actions;
    },
    /** Mouse look delta since the last call (consumed). */
    takeMouse() {
      const dx = mouseDX;
      const dy = mouseDY;
      mouseDX = 0;
      mouseDY = 0;
      return { dx, dy };
    },
    firing() {
      return mouseDown;
    },
    takeClick() {
      const clicked = mouseClicked;
      mouseClicked = false;
      return clicked;
    },
    isDown(code) {
      return keys.has(code);
    },
    anyKey() {
      return pressed.size > 0;
    },
    clearPressed() {
      pressed.clear();
    },
  };
}
