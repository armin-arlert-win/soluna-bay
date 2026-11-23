// SOLUNA BAY — keyboard and mouse. Actions are buffered one-shots: a quick
// tap is never missed, and a held key never fires twice.
export const ACTION = {
  MISSION: 1 << 0, // J — start / advance mission
  ENTER: 1 << 1, // E — enter/exit car, interact
  PAUSE: 1 << 2, // Escape / P — pause or map
  MAP: 1 << 3, // M — map overlay
  SHOOT: 1 << 4, // mouse click or F — fire weapon
  RELOAD: 1 << 5, // R — reload / cycle radio (with Shift)
  HORN: 1 << 6, // H — horn
  SAVE: 1 << 7, // F5 is browser-reserved; use Q to quick-save at a save point
  NITRO: 1 << 8, // Shift — nitro (held, not buffered)
  INTERACT: 1 << 9, // E is also the interact key; kept separate for clarity
  RADIO: 1 << 10, // T — next radio station
  ANY: 1 << 11, // any key at all (buffered, so a quick tap is never missed)
};

const KEY_ACTIONS = {
  KeyJ: ACTION.MISSION,
  KeyE: ACTION.ENTER,
  Escape: ACTION.PAUSE,
  KeyP: ACTION.PAUSE,
  KeyM: ACTION.MAP,
  KeyF: ACTION.SHOOT,
  KeyR: ACTION.RELOAD,
  KeyH: ACTION.HORN,
  KeyQ: ACTION.SAVE,
  KeyT: ACTION.RADIO,
};

export class Input {
  constructor() {
    this.down = new Set();
    this.pressed = 0; // buffered actions, consumed by takeActions()
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.dragDX = 0;
    this.dragDY = 0;
    this._dragging = false;
    this._lastX = 0;
    this._lastY = 0;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.down.add(e.code);
      this.pressed |= ACTION.ANY;
      const a = KEY_ACTIONS[e.code];
      if (a !== undefined) this.pressed |= a;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
    window.addEventListener('mousedown', (e) => {
      this.mouseDown = true;
      this.mouseClicked = true;
      this._dragging = true;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
    });
    window.addEventListener('mouseup', () => {
      this.mouseDown = false;
      this._dragging = false;
    });
    window.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      if (this._dragging) {
        this.dragDX += e.clientX - this._lastX;
        this.dragDY += e.clientY - this._lastY;
        this._lastX = e.clientX;
        this._lastY = e.clientY;
      }
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  isDown(code) {
    return this.down.has(code);
  }
  // Drive axes: -1..1, from WASD or arrows.
  axes() {
    let x = 0;
    let y = 0;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) y += 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) y -= 1;
    return { x, y };
  }
  takeActions() {
    const a = this.pressed | (this.mouseClicked ? ACTION.SHOOT : 0);
    this.pressed = 0;
    this.mouseClicked = false;
    return a;
  }
  takeDrag() {
    const d = { x: this.dragDX, y: this.dragDY };
    this.dragDX = 0;
    this.dragDY = 0;
    return d;
  }
  // Number keys 1-4 select a weapon slot.
  weaponSlot() {
    for (let i = 1; i <= 4; i += 1) {
      if (this.isDown(`Digit${i}`)) return i - 1;
    }
    return -1;
  }
}
