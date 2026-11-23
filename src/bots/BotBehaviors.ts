import type { CollisionWorld } from '../physics/CollisionWorld';
import { BOT_HEIGHT, BOT_RADIUS, type Bot } from './Bot';

export interface BotContext {
  world: CollisionWorld;
  playerPos: { x: number; y: number; z: number };
  rng: () => number;
  now: number;
  /** Zone bounds the bot must stay within. */
  bounds?: { minX: number; minZ: number; maxX: number; maxZ: number };
}

/**
 * Strategy interface for bot movement/AI. Future behaviours (peeking, counter-strafe
 * and shoot back, difficulty tiers, scripted duels) implement this same interface.
 */
export interface BotBehavior {
  readonly id: string;
  reset(bot: Bot): void;
  update(bot: Bot, dt: number, ctx: BotContext): void;
}

export function botBlocked(world: CollisionWorld, x: number, y: number, z: number): boolean {
  const r = BOT_RADIUS;
  return world.overlapsAny({ minX: x - r, minY: y + 0.05, minZ: z - r, maxX: x + r, maxY: y + BOT_HEIGHT, maxZ: z + r });
}

/** Stands still, always facing the player. */
export class StaticBehavior implements BotBehavior {
  readonly id = 'static';
  reset(): void {}
  update(bot: Bot, _dt: number, ctx: BotContext): void {
    bot.faceTowards(ctx.playerPos.x, ctx.playerPos.z);
  }
}

export interface StrafeOptions {
  speed: number; // m/s top speed
  accel: number; // m/s^2 (bots also accelerate/stop, like players)
  minRun: number; maxRun: number; // seconds per strafe
  stopChance: number; // chance to stop instead of reversing
  minStop: number; maxStop: number;
}

/**
 * A/D strafing perpendicular to the line to the player, with random direction changes
 * and random full stops (mimics a player counter-strafing to shoot).
 */
export class StrafeBehavior implements BotBehavior {
  readonly id = 'strafe';
  private dir = 1;
  private timer = 0;
  private stopped = false;
  private curSpeed = 0;

  constructor(public opts: StrafeOptions) {}

  reset(): void {
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.timer = 0.2 + Math.random() * 0.5;
    this.stopped = Math.random() < 0.3;
    this.curSpeed = 0;
  }

  update(bot: Bot, dt: number, ctx: BotContext): void {
    const o = this.opts;
    bot.faceTowards(ctx.playerPos.x, ctx.playerPos.z);
    this.timer -= dt;
    if (this.timer <= 0) {
      if (!this.stopped && ctx.rng() < o.stopChance) {
        this.stopped = true;
        this.timer = o.minStop + ctx.rng() * (o.maxStop - o.minStop);
      } else {
        this.stopped = false;
        if (ctx.rng() < 0.7) this.dir = -this.dir;
        this.timer = o.minRun + ctx.rng() * (o.maxRun - o.minRun);
      }
    }
    const target = this.stopped ? 0 : this.dir * o.speed;
    const delta = target - this.curSpeed;
    const maxD = o.accel * dt;
    this.curSpeed += Math.max(-maxD, Math.min(maxD, delta));

    // local right axis of the bot (perpendicular to facing)
    const rx = Math.cos(bot.yaw), rz = -Math.sin(bot.yaw);
    const nx = bot.pos.x + rx * this.curSpeed * dt;
    const nz = bot.pos.z + rz * this.curSpeed * dt;
    const b = ctx.bounds;
    const outside = b && (nx < b.minX || nx > b.maxX || nz < b.minZ || nz > b.maxZ);
    if (outside || botBlocked(ctx.world, nx, bot.pos.y, nz)) {
      this.dir = -this.dir;
      this.curSpeed = 0;
      return;
    }
    bot.vel.set(rx * this.curSpeed, 0, rz * this.curSpeed);
    bot.pos.x = nx;
    bot.pos.z = nz;
  }
}
