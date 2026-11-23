import type { Bot } from '../bots/Bot';
import type { ModeHost, PracticeMode } from './PracticeMode';

/** Free roam: N bots spread across the map, respawning after being killed. */
export class FreePractice implements PracticeMode {
  readonly id = 'free' as const;
  readonly label = 'フリープラクティス';
  timeLeft: number | null = null;
  private respawnDelay = 1.0;

  start(host: ModeHost): void {
    const s = host.settings;
    host.bots.clear();
    host.spawnPlayer('default');
    for (let i = 0; i < s.botCount; i++) {
      const kind = s.botBehavior === 'mixed' ? (i % 2 === 0 ? 'strafe' : 'static') : s.botBehavior;
      const b = host.bots.add(s.botHp, host.bots.makeBehavior(kind, s.botSpeed));
      this.respawn(b, host);
    }
  }

  private respawn(b: Bot, host: ModeHost): void {
    const sp = host.bots.findSpawn({ zoneTags: ['free'] });
    if (sp) b.spawn(sp.x, sp.y, sp.z, host.now, sp.zone.id);
    else b.respawnAt = host.now + 0.5;
  }

  tick(_dt: number, host: ModeHost): void {
    for (const b of host.bots.bots) if (!b.alive && b.respawnAt >= 0 && host.now >= b.respawnAt) this.respawn(b, host);
  }

  onKill(bot: Bot, host: ModeHost): void {
    bot.respawnAt = host.now + this.respawnDelay;
  }

  onShot(): void {}
  hud(): string { return ''; }
}
