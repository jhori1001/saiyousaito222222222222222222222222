import type { Bot } from '../bots/Bot';
import type { ShotRecord } from '../stats/Stats';
import type { ModeHost, PracticeMode } from './PracticeMode';

/**
 * Stopping drill: static targets at fixed range; the HUD shows live speed and spread
 * and splits accuracy into "moving" vs "stopped" shots.
 */
export class StoppingMode implements PracticeMode {
  readonly id = 'stopping' as const;
  readonly label = 'ストッピング練習';
  timeLeft: number | null = null;
  private last: ShotRecord[] = [];

  start(host: ModeHost): void {
    host.bots.clear();
    host.spawnPlayer('stopping');
    this.last = [];
    const targets = host.map.fixedTargets.stopping ?? [];
    for (const [x, y, z] of targets) {
      const b = host.bots.add(host.settings.botHp, host.bots.makeBehavior('static', 0));
      b.spawn(x, y, z, host.now, 'fixed');
      (b as Bot & { home: number[] }).home = [x, y, z];
    }
  }

  tick(_dt: number, host: ModeHost): void {
    for (const b of host.bots.bots) {
      if (!b.alive && b.respawnAt >= 0 && host.now >= b.respawnAt) {
        const [x, y, z] = (b as Bot & { home: number[] }).home;
        b.spawn(x, y, z, host.now, 'fixed');
      }
    }
  }

  onKill(bot: Bot, host: ModeHost): void { bot.respawnAt = host.now + 0.4; }

  onShot(rec: ShotRecord): void {
    this.last.unshift(rec);
    if (this.last.length > 8) this.last.pop();
  }

  hud(host: ModeHost, live: { speed: number; spread: number; accurate: boolean }): string {
    const sp = host.stats.movingSplit();
    const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
    const rows = this.last.map((r) =>
      `<tr class="${r.moving ? 'mv' : 'st'}"><td>${r.speed.toFixed(2)}</td><td>${r.spreadDeg.toFixed(2)}°</td><td>${r.moving ? '移動中' : '停止'}</td><td>${r.hit ? (r.hit === 'head' ? 'HEAD' : r.hit.toUpperCase()) : '—'}</td></tr>`).join('');
    return `
      <div class="stopping">
        <div class="live ${live.accurate ? 'ok' : 'ng'}">
          <div><small>速度</small><b>${live.speed.toFixed(2)}</b><small>m/s</small></div>
          <div><small>射撃誤差</small><b>${live.spread.toFixed(2)}</b><small>deg</small></div>
          <div class="state">${live.accurate ? '精度OK' : '移動誤差あり'}</div>
        </div>
        <div class="split">
          <span>停止: ${sp.stillShots}発 / 命中 ${pct(sp.stillAcc)}</span>
          <span>移動: ${sp.movingShots}発 / 命中 ${pct(sp.movingAcc)}</span>
        </div>
        <table><thead><tr><th>速度</th><th>誤差</th><th>状態</th><th>結果</th></tr></thead><tbody>${rows}</tbody></table>
      </div>`;
  }
}
