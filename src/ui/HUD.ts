/** Heads-up display. DOM writes are diffed so the HUD costs almost nothing per frame. */
export class HUD {
  readonly root: HTMLDivElement;
  private cache = new Map<string, string>();
  private els: Record<string, HTMLElement> = {};
  private hitTimer = 0;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="hud-tl"><span data-k="fps"></span><span data-k="ping"></span></div>
      <div class="hud-top"><div data-k="mode" class="hud-mode"></div><div data-k="timer" class="hud-timer"></div></div>
      <div class="hud-tr">
        <div><b data-k="kills">0</b><small>撃破</small></div>
        <div><b data-k="acc">0%</b><small>命中率</small></div>
        <div><b data-k="hs">0%</b><small>HS率</small></div>
      </div>
      <div class="hud-bl"><div class="hp"><b data-k="hp">100</b><small>HP</small></div></div>
      <div class="hud-br">
        <div data-k="weapon" class="wname"></div>
        <div class="ammo"><b data-k="ammo">0</b><span data-k="mag">/0</span></div>
        <div class="reload"><div data-k="reloadbar"></div></div>
        <div data-k="wstate" class="wstate"></div>
      </div>
      <div data-k="extra" class="hud-extra"></div>
      <div data-k="speedo" class="speedo"></div>
      <div data-k="hitmarker" class="hitmarker"><i></i><i></i><i></i><i></i></div>
      <div data-k="scope" class="scope-overlay"></div>
      <div data-k="toast" class="toast"></div>
    `;
    this.root.querySelectorAll<HTMLElement>('[data-k]').forEach((e) => (this.els[e.dataset.k!] = e));
    parent.appendChild(this.root);
  }

  set(key: string, text: string): void {
    if (this.cache.get(key) === text) return;
    this.cache.set(key, text);
    this.els[key].textContent = text;
  }

  html(key: string, html: string): void {
    if (this.cache.get(key) === html) return;
    this.cache.set(key, html);
    this.els[key].innerHTML = html;
  }

  style(key: string, prop: string, value: string): void {
    const ck = `${key}.${prop}`;
    if (this.cache.get(ck) === value) return;
    this.cache.set(ck, value);
    this.els[key].style.setProperty(prop, value);
  }

  hit(kind: 'body' | 'head' | 'kill'): void {
    const el = this.els.hitmarker;
    el.className = `hitmarker show ${kind}`;
    this.hitTimer = kind === 'kill' ? 0.25 : 0.12;
  }

  toast(text: string, seconds = 1.6): void {
    const el = this.els.toast;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout((el as unknown as { _t: number })._t);
    (el as unknown as { _t: number })._t = window.setTimeout(() => el.classList.remove('show'), seconds * 1000);
  }

  update(dt: number): void {
    if (this.hitTimer > 0) {
      this.hitTimer -= dt;
      if (this.hitTimer <= 0) this.els.hitmarker.className = 'hitmarker';
    }
  }
}
