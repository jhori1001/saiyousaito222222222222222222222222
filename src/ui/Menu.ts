import type { Game } from '../core/Game';
import { cmPer360, DEFAULT_SETTINGS, eDPI, type ModeId, sanitize, type Settings } from '../core/Settings';
import { REFERENCE } from '../config/reference';
import { WEAPONS } from '../config/weapons';

type Tab = 'play' | 'mouse' | 'crosshair' | 'bots' | 'video' | 'results' | 'about';

const MODES: { id: ModeId; name: string; desc: string }[] = [
  { id: 'free', name: 'フリープラクティス', desc: 'マップを自由に移動し、配置されたBOTを撃つ。撃破後は自動リスポーン。' },
  { id: 'flick', name: 'フリック練習', desc: 'ランダムな位置に出現するBOTを素早く撃破。制限時間 30/60 秒。' },
  { id: 'stopping', name: 'ストッピング練習', desc: '左右に動きながら停止→射撃。速度・射撃誤差・移動中/停止中の命中率を表示。' },
];

/** ESC menu: mode selection, settings (auto-saved to localStorage) and results. */
export class Menu {
  readonly root: HTMLDivElement;
  private tab: Tab = 'play';
  private body: HTMLDivElement;
  private s: Settings;
  private lockError: HTMLDivElement;

  constructor(parent: HTMLElement, private game: Game) {
    this.s = structuredClone(game.settings);
    this.root = document.createElement('div');
    this.root.className = 'menu';
    this.root.innerHTML = `
      <div class="menu-panel">
        <header>
          <div class="brand">AIM<span>PROTOCOL</span><small>prototype</small></div>
          <nav></nav>
        </header>
        <div class="menu-body"></div>
        <footer>
          <div class="lock-error"></div>
          <button class="btn primary start">クリックして開始 / 再開</button>
        </footer>
      </div>`;
    parent.appendChild(this.root);
    this.body = this.root.querySelector('.menu-body')!;
    this.lockError = this.root.querySelector('.lock-error')!;
    const nav = this.root.querySelector('nav')!;
    const tabs: [Tab, string][] = [
      ['play', '練習モード'], ['mouse', 'マウス/操作'], ['crosshair', 'クロスヘア'],
      ['bots', 'BOT/武器'], ['video', '画質/音'], ['results', '結果'], ['about', '操作説明'],
    ];
    for (const [id, label] of tabs) {
      const b = document.createElement('button');
      b.textContent = label;
      b.dataset.tab = id;
      b.onclick = () => this.show(id);
      nav.appendChild(b);
    }
    this.root.querySelector<HTMLButtonElement>('.start')!.onclick = () => this.start();
    this.show('play');
  }

  async start(): Promise<void> {
    this.lockError.textContent = '';
    this.game.sound.unlock();
    if (this.game.finished) this.game.restart();
    try {
      if (this.s.keyboardLock && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen().catch(() => undefined);
        const kb = (navigator as Navigator & { keyboard?: { lock(keys?: string[]): Promise<void> } }).keyboard;
        await kb?.lock(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'KeyC', 'KeyT', 'KeyN', 'KeyQ', 'KeyE', 'Space',
          'ControlLeft', 'ControlRight', 'ShiftLeft', 'Tab', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6']).catch(() => undefined);
      }
      await this.game.input.lock(this.s.rawInput);
    } catch {
      this.lockError.textContent = 'マウスロックに失敗しました。ESCで抜けた直後はブラウザの制限で約1秒待つ必要があります。もう一度クリックしてください。';
    }
  }

  setVisible(v: boolean): void {
    this.root.style.display = v ? '' : 'none';
    if (v) {
      this.s = structuredClone(this.game.settings);
      this.show(this.game.finished ? 'results' : this.tab);
    }
  }

  private commit(rerender = false): void {
    this.s = sanitize(this.s);
    this.game.applySettings(structuredClone(this.s));
    if (rerender) this.show(this.tab);
    else this.refreshDerived();
  }

  private refreshDerived(): void {
    const d = this.body.querySelector('.derived');
    if (d) d.innerHTML = this.derivedHtml();
  }

  private derivedHtml(): string {
    const s = this.s;
    const raw = this.game.input.rawSupported;
    return `eDPI <b>${eDPI(s).toFixed(0)}</b> ・ 振り向き(360°) <b>${cmPer360(s).toFixed(1)} cm</b> ・
      ${REFERENCE.yawDegPerCount.value}°/count × 感度 ・ Raw入力: <b>${raw === null ? '未確認' : raw ? '有効' : '非対応(OS加速の影響あり)'}</b>`;
  }

  show(tab: Tab): void {
    this.tab = tab;
    this.root.querySelectorAll<HTMLButtonElement>('nav button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    this.body.innerHTML = '';
    const s = this.s;
    const sec = (title: string) => {
      const d = document.createElement('section');
      d.innerHTML = `<h3>${title}</h3>`;
      this.body.appendChild(d);
      return d;
    };
    switch (tab) {
      case 'play': {
        const d = sec('練習モード');
        const grid = document.createElement('div');
        grid.className = 'mode-grid';
        for (const m of MODES) {
          const c = document.createElement('button');
          c.className = `mode-card ${s.mode === m.id ? 'active' : ''}`;
          c.innerHTML = `<b>${m.name}</b><span>${m.desc}</span>`;
          c.onclick = () => {
            s.mode = m.id;
            this.commit(true);
            this.game.setMode(m.id);
          };
          grid.appendChild(c);
        }
        d.appendChild(grid);
        const o = sec('オプション');
        this.select(o, '練習時間 (フリック)', String(s.practiceDuration), [['30', '30秒'], ['60', '60秒']], (v) => { s.practiceDuration = Number(v) as 30 | 60; this.commit(); });
        this.check(o, '弾薬無限', s.infiniteAmmo, (v) => { s.infiniteAmmo = v; this.commit(); });
        this.check(o, '速度メーター表示', s.showSpeedometer, (v) => { s.showSpeedometer = v; this.commit(); });
        const r = document.createElement('button');
        r.className = 'btn';
        r.textContent = 'モードをリスタート';
        r.onclick = () => { this.game.restart(); this.show('play'); };
        o.appendChild(r);
        break;
      }
      case 'mouse': {
        const d = sec('マウス感度 (リファレンスゲームの感度と同じ値を入力)');
        this.number(d, 'ゲーム内感度', s.sensitivity, 0.01, 10, 0.001, (v) => { s.sensitivity = v; this.commit(); });
        this.number(d, 'マウスDPI', s.dpi, 50, 32000, 50, (v) => { s.dpi = v; this.commit(); });
        this.number(d, 'スコープ感度倍率', s.scopedMultiplier, 0.01, 5, 0.01, (v) => { s.scopedMultiplier = v; this.commit(); });
        const der = document.createElement('div');
        der.className = 'derived';
        der.innerHTML = this.derivedHtml();
        d.appendChild(der);
        this.check(d, 'Raw入力 (OSのマウス加速を無効化 / Chrome・Edge)', s.rawInput, (v) => { s.rawInput = v; this.commit(); });
        this.check(d, '上下反転', s.invertY, (v) => { s.invertY = v; this.commit(); });
        this.select(d, 'ADS', s.adsMode, [['hold', 'ホールド'], ['toggle', 'トグル']], (v) => { s.adsMode = v as 'hold' | 'toggle'; this.commit(); });
        this.check(d, 'フルスクリーン + キーボードロック (Ctrl+W等でタブが閉じるのを防止)', s.keyboardLock, (v) => { s.keyboardLock = v; this.commit(); });
        const n = document.createElement('p');
        n.className = 'note';
        n.textContent = '視野角は水平103°固定（リファレンスゲーム準拠）。マウス加速・スムージングは一切かけていません。視点はフレームレートに依存しません。';
        d.appendChild(n);
        break;
      }
      case 'crosshair': {
        const c = s.crosshair;
        const d = sec('クロスヘア');
        const prev = document.createElement('div');
        prev.className = 'ch-preview';
        d.appendChild(prev);
        this.color(d, '色', c.color, (v) => { c.color = v; this.commit(); });
        this.number(d, '線の長さ', c.length, 0, 30, 1, (v) => { c.length = v; this.commit(); });
        this.number(d, '線の太さ', c.thickness, 1, 10, 1, (v) => { c.thickness = v; this.commit(); });
        this.number(d, 'ギャップ (中心からの距離)', c.gap, 0, 30, 1, (v) => { c.gap = v; this.commit(); });
        this.number(d, '不透明度', c.opacity, 0.1, 1, 0.05, (v) => { c.opacity = v; this.commit(); });
        this.check(d, 'アウトライン', c.outline, (v) => { c.outline = v; this.commit(); });
        this.number(d, 'アウトライン不透明度', c.outlineOpacity, 0, 1, 0.05, (v) => { c.outlineOpacity = v; this.commit(); });
        this.check(d, 'センタードット', c.centerDot, (v) => { c.centerDot = v; this.commit(); });
        this.check(d, '射撃誤差を表示 (移動・連射で開く)', c.showFiringError, (v) => { c.showFiringError = v; this.commit(); });
        const reset = document.createElement('button');
        reset.className = 'btn';
        reset.textContent = 'クロスヘアを初期化';
        reset.onclick = () => { s.crosshair = { ...DEFAULT_SETTINGS.crosshair }; this.commit(true); };
        d.appendChild(reset);
        break;
      }
      case 'bots': {
        const w = sec('武器 (数字キー1〜6でも切替)');
        this.select(w, '武器', s.weaponId, WEAPONS.map((x) => [x.id, `${x.slotKey.replace('Digit', '')}: ${x.name}（${x.referenceName}相当）`]), (v) => { s.weaponId = v; this.commit(); });
        const b = sec('BOT (変更はモード再開始時に反映)');
        this.number(b, 'BOT数 (フリー)', s.botCount, 1, 20, 1, (v) => { s.botCount = v; this.commit(); });
        this.number(b, 'BOT移動速度 (m/s)', s.botSpeed, 0, 6.75, 0.25, (v) => { s.botSpeed = v; this.commit(); });
        this.number(b, 'BOT HP', s.botHp, 1, 1000, 1, (v) => { s.botHp = v; this.commit(); });
        this.select(b, 'BOTの動き', s.botBehavior, [['mixed', '混合 (ストレイフ+静止)'], ['strafe', 'ストレイフ'], ['static', '静止']], (v) => { s.botBehavior = v as Settings['botBehavior']; this.commit(); });
        const r = document.createElement('button');
        r.className = 'btn';
        r.textContent = 'BOT設定を適用してリスタート';
        r.onclick = () => this.game.restart();
        b.appendChild(r);
        break;
      }
      case 'video': {
        const d = sec('描画品質');
        this.select(d, '品質', s.quality, [['low', '低 (最大FPS)'], ['medium', '中'], ['high', '高 (影あり)']], (v) => { s.quality = v as Settings['quality']; this.commit(); });
        const n = document.createElement('p');
        n.className = 'note';
        n.textContent = 'アンチエイリアスの切替はページ再読み込み後に反映されます。Chromeはモニターのリフレッシュレートで描画します。';
        d.appendChild(n);
        const a = sec('サウンド');
        this.number(a, '音量', s.volume, 0, 1, 0.05, (v) => { s.volume = v; this.commit(); });
        break;
      }
      case 'results': this.results(sec('練習結果')); break;
      case 'about': {
        const d = sec('操作');
        d.innerHTML += `<table class="keys">
          <tr><td>マウス</td><td>視点</td></tr><tr><td>左クリック</td><td>射撃</td></tr><tr><td>右クリック</td><td>ADS / スコープ</td></tr>
          <tr><td>W A S D</td><td>移動</td></tr><tr><td>Shift</td><td>歩き</td></tr><tr><td>Ctrl / C</td><td>しゃがみ</td></tr>
          <tr><td>Space</td><td>ジャンプ</td></tr><tr><td>R</td><td>リロード</td></tr><tr><td>1〜6</td><td>武器切替</td></tr><tr><td>ESC</td><td>メニュー</td></tr></table>
          <p class="note">本作はオリジナル素材のみで構成された非公式の練習ツールです。武器・移動の数値には「公開値」と「推定値」があり、推定値は実機での検証・調整が必要です（docs/VALUES.md 参照）。</p>`;
        break;
      }
    }
  }

  private results(d: HTMLElement): void {
    const st = this.game.stats;
    const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
    const kps = st.elapsed > 0 ? st.kills / st.elapsed : 0;
    const split = st.movingSplit();
    d.innerHTML += `
      <div class="results">
        <div><small>モード</small><b>${this.game.mode.label}</b></div>
        <div><small>撃破数</small><b>${st.kills}</b></div>
        <div><small>命中率</small><b>${pct(st.accuracy)}</b></div>
        <div><small>HS率</small><b>${pct(st.hsRate)}</b></div>
        <div><small>発射数</small><b>${st.shots}</b></div>
        <div><small>命中 (頭/胴/脚)</small><b>${st.head}/${st.body}/${st.leg}</b></div>
        <div><small>平均撃破時間</small><b>${st.avgKillTime.toFixed(3)}s</b></div>
        <div><small>撃破/秒</small><b>${kps.toFixed(2)}</b></div>
        <div><small>練習時間</small><b>${st.elapsed.toFixed(1)}s</b></div>
        <div><small>停止中の命中率</small><b>${pct(split.stillAcc)} (${split.stillShots})</b></div>
        <div><small>移動中の命中率</small><b>${pct(split.movingAcc)} (${split.movingShots})</b></div>
        <div><small>総ダメージ</small><b>${st.damage}</b></div>
      </div>`;
    const r = document.createElement('button');
    r.className = 'btn';
    r.textContent = 'もう一度';
    r.onclick = () => { this.game.restart(); void this.start(); };
    d.appendChild(r);
  }

  // ---- control helpers
  private row(parent: HTMLElement, label: string): HTMLLabelElement {
    const l = document.createElement('label');
    l.className = 'row';
    l.innerHTML = `<span>${label}</span>`;
    parent.appendChild(l);
    return l;
  }

  private number(p: HTMLElement, label: string, val: number, min: number, max: number, step: number, set: (v: number) => void): void {
    const l = this.row(p, label);
    const r = document.createElement('input');
    r.type = 'range'; r.min = String(min); r.max = String(max); r.step = String(step); r.value = String(val);
    const n = document.createElement('input');
    n.type = 'number'; n.min = String(min); n.max = String(max); n.step = String(step); n.value = String(val);
    r.oninput = () => { n.value = r.value; set(Number(r.value)); };
    n.onchange = () => { const v = Number(n.value); if (Number.isFinite(v)) { r.value = String(v); set(v); } };
    l.append(r, n);
  }

  private check(p: HTMLElement, label: string, val: boolean, set: (v: boolean) => void): void {
    const l = this.row(p, label);
    const c = document.createElement('input');
    c.type = 'checkbox'; c.checked = val;
    c.onchange = () => set(c.checked);
    l.append(c);
  }

  private select(p: HTMLElement, label: string, val: string, opts: [string, string][], set: (v: string) => void): void {
    const l = this.row(p, label);
    const sel = document.createElement('select');
    for (const [v, t] of opts) {
      const o = document.createElement('option');
      o.value = v; o.textContent = t; o.selected = v === val;
      sel.appendChild(o);
    }
    sel.onchange = () => set(sel.value);
    l.append(sel);
  }

  private color(p: HTMLElement, label: string, val: string, set: (v: string) => void): void {
    const l = this.row(p, label);
    const c = document.createElement('input');
    c.type = 'color'; c.value = val;
    c.oninput = () => set(c.value);
    const presets = document.createElement('span');
    presets.className = 'presets';
    for (const col of ['#00ff9c', '#ffffff', '#ffff00', '#00ffff', '#ff00ff', '#ff3b3b']) {
      const b = document.createElement('button');
      b.type = 'button';
      b.style.background = col;
      b.onclick = (e) => { e.preventDefault(); c.value = col; set(col); };
      presets.appendChild(b);
    }
    l.append(c, presets);
  }
}
