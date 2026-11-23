import type { CrosshairSettings } from '../core/Settings';

/** Pixel-snapped DOM crosshair (crisp at any DPR, zero GPU cost). */
export class Crosshair {
  readonly el: HTMLDivElement;
  private arms: HTMLDivElement[] = [];
  private dot: HTMLDivElement;
  private s!: CrosshairSettings;
  private lastGap = -1;
  private hidden = false;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'crosshair';
    for (let i = 0; i < 4; i++) {
      const a = document.createElement('div');
      a.className = 'ch-part';
      this.arms.push(a);
      this.el.appendChild(a);
    }
    this.dot = document.createElement('div');
    this.dot.className = 'ch-part';
    this.el.appendChild(this.dot);
    parent.appendChild(this.el);
  }

  apply(s: CrosshairSettings): void {
    this.s = { ...s };
    this.lastGap = -1;
    const outline = s.outline ? `0 0 0 1px rgba(0,0,0,${s.outlineOpacity})` : 'none';
    for (const p of [...this.arms, this.dot]) {
      p.style.background = s.color;
      p.style.boxShadow = outline;
      p.style.opacity = String(s.opacity);
    }
    this.layout(0);
  }

  setHidden(h: boolean): void {
    if (h === this.hidden) return;
    this.hidden = h;
    this.el.style.display = h ? 'none' : '';
  }

  /** @param extraGap additional gap in px (dynamic firing error). */
  layout(extraGap: number): void {
    const s = this.s;
    const gap = Math.round(s.gap + (s.showFiringError ? extraGap : 0));
    if (gap === this.lastGap) return;
    this.lastGap = gap;
    const t = Math.round(s.thickness), L = Math.round(s.length);
    // Centre is the top-left pixel of the 2x2 centre for even sizes; we offset by thickness/2.
    const half = Math.floor(t / 2);
    const show = L > 0 ? '' : 'none';
    const [up, down, left, right] = this.arms;
    const set = (el: HTMLDivElement, x: number, y: number, w: number, h: number) => {
      el.style.display = show;
      el.style.transform = `translate(${x}px, ${y}px)`;
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
    };
    set(up, -half, -gap - L - half, t, L);
    set(down, -half, gap + (t - half), t, L);
    set(left, -gap - L - half, -half, L, t);
    set(right, gap + (t - half), -half, L, t);
    this.dot.style.display = s.centerDot ? '' : 'none';
    this.dot.style.transform = `translate(${-half}px, ${-half}px)`;
    this.dot.style.width = this.dot.style.height = `${t}px`;
  }
}
