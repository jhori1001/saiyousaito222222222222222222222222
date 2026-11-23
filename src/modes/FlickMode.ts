import type { Bot } from '../bots/Bot';
import type { ModeHost, PracticeMode } from './PracticeMode';

/** One target at a time at a random visible position; timed. */
export class FlickMode implements PracticeMode {
  readonly id = 'flick' as const;
  readonly label = 'フリック練習';
  timeLeft: number | null = 60;
  private bot: Bot | null = null;
  private done = false;

  start(host: ModeHost): void {
    const s = host.settings;
    this.timeLeft = s.practiceDuration;
    this.done = false;
    host.bots.clear();
    host.spawnPlayer('flick');
    const kind = s.botBehavior === 'strafe' ? 'strafe' : 'static';
    this.bot = host.bots.add(s.botHp, host.bots.makeBehavior(kind, s.botSpeed));
    this.next(host);
  }

  private next(host: ModeHost): void {
    if (!this.bot) return;
    const sp = host.bots.findSpawn({
      zoneTags: ['flick'], losFrom: host.eye(), facingYaw: host.yaw(), maxAngleDeg: 75, minDist: 5, maxDist: 32,
    }) ?? host.bots.findSpawn({ zoneTags: ['flick'], losFrom: host.eye(), minDist: 5, maxDist: 40 });
    if (sp) this.bot.spawn(sp.x, sp.y, sp.z, host.now, sp.zone.id);
    else this.bot.respawnAt = host.now + 0.1;
  }

  tick(dt: number, host: ModeHost): void {
    if (this.done || this.timeLeft === null) return;
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.bot && !this.bot.alive && this.bot.respawnAt >= 0 && host.now >= this.bot.respawnAt) this.next(host);
    if (this.timeLeft <= 0) {
      this.done = true;
      host.finish();
    }
  }

  onKill(_bot: Bot, host: ModeHost): void {
    this.bot!.respawnAt = host.now; // next target immediately
  }

  onShot(): void {}
  hud(): string { return ''; }
}
