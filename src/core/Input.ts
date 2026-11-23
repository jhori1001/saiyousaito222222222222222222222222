/**
 * Keyboard / mouse state. Mouse deltas are delivered straight to a callback on every
 * event (no smoothing, no acceleration, frame-rate independent).
 */
export class Input {
  private down = new Set<string>();
  private pressedQueue = new Set<string>();
  mouseLeft = false;
  mouseRight = false;
  private leftPressed = false;
  private rightPressed = false;
  locked = false;
  onLook: (dx: number, dy: number) => void = () => {};
  onLockChange: (locked: boolean) => void = () => {};
  /** Spikes above this many counts in one event are discarded (known browser bug). */
  spikeFilter = 2000;
  rawSupported: boolean | null = null;

  constructor(private target: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (!this.locked) return;
      // Block browser shortcuts (Ctrl+S, Ctrl+D, Space scroll...). Ctrl+W can only be
      // blocked in fullscreen with the Keyboard Lock API.
      if (e.code !== 'Escape' && e.code !== 'F11' && e.code !== 'F12') e.preventDefault();
      if (!e.repeat) this.pressedQueue.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
      if (this.locked) e.preventDefault();
    });
    window.addEventListener('blur', () => this.releaseAll());
    target.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      e.preventDefault();
      if (e.button === 0) { this.mouseLeft = true; this.leftPressed = true; }
      if (e.button === 2) { this.mouseRight = true; this.rightPressed = true; }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseLeft = false;
      if (e.button === 2) this.mouseRight = false;
    });
    target.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      const dx = e.movementX, dy = e.movementY;
      if (Math.abs(dx) > this.spikeFilter || Math.abs(dy) > this.spikeFilter) return;
      this.onLook(dx, dy);
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.target;
      if (!this.locked) this.releaseAll();
      this.onLockChange(this.locked);
    });
  }

  async lock(raw: boolean): Promise<void> {
    const el = this.target as HTMLElement & {
      requestPointerLock(opts?: { unadjustedMovement?: boolean }): Promise<void> | void;
    };
    if (raw) {
      try {
        await el.requestPointerLock({ unadjustedMovement: true });
        this.rawSupported = true;
        return;
      } catch (err) {
        if ((err as DOMException)?.name === 'NotSupportedError') this.rawSupported = false;
        else throw err;
      }
    }
    await el.requestPointerLock();
  }

  unlock(): void {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  releaseAll(): void {
    this.down.clear();
    this.pressedQueue.clear();
    this.mouseLeft = this.mouseRight = false;
    this.leftPressed = this.rightPressed = false;
  }

  isDown(code: string): boolean { return this.down.has(code); }

  /** Returns true once per physical key press. */
  consumePress(code: string): boolean {
    if (this.pressedQueue.has(code)) { this.pressedQueue.delete(code); return true; }
    return false;
  }
  consumeLeftPress(): boolean { const p = this.leftPressed; this.leftPressed = false; return p; }
  consumeRightPress(): boolean { const p = this.rightPressed; this.rightPressed = false; return p; }
  clearPresses(): void { this.pressedQueue.clear(); }

  /** Test hook: inject synthetic state. */
  debugSet(code: string, isDown: boolean): void {
    if (isDown) { if (!this.down.has(code)) this.pressedQueue.add(code); this.down.add(code); }
    else this.down.delete(code);
  }
  debugMouse(left: boolean): void {
    if (left && !this.mouseLeft) this.leftPressed = true;
    this.mouseLeft = left;
  }
}
