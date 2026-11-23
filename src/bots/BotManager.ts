import * as THREE from 'three';
import type { BotZone, MapData } from '../map/MapData';
import type { CollisionWorld } from '../physics/CollisionWorld';
import type { Vec3 } from '../physics/aabb';
import { Bot, type HitZone } from './Bot';
import { botBlocked, type BotBehavior, StaticBehavior, StrafeBehavior } from './BotBehaviors';

export interface SpawnRequest {
  zoneTags: string[];
  /** If set, the spawn must be visible from this eye position. */
  losFrom?: Vec3;
  /** Optional angular/distance constraints relative to losFrom. */
  facingYaw?: number;
  maxAngleDeg?: number;
  minDist?: number;
  maxDist?: number;
}

export interface BotRayHit { bot: Bot; zone: HitZone; t: number; normal: Vec3 }

export class BotManager {
  bots: Bot[] = [];
  readonly group = new THREE.Group();
  private zonesById = new Map<string, BotZone>();

  constructor(private map: MapData, private world: CollisionWorld, private rng: () => number) {
    for (const z of map.botZones) this.zonesById.set(z.id, z);
  }

  clear(): void {
    for (const b of this.bots) b.dispose();
    this.bots = [];
  }

  add(hp: number, behavior: BotBehavior): Bot {
    const b = new Bot(hp, behavior);
    this.bots.push(b);
    this.group.add(b.mesh);
    return b;
  }

  makeBehavior(kind: 'strafe' | 'static', speed: number): BotBehavior {
    if (kind === 'static' || speed <= 0) return new StaticBehavior();
    return new StrafeBehavior({ speed, accel: 30, minRun: 0.35, maxRun: 1.1, stopChance: 0.35, minStop: 0.25, maxStop: 0.9 });
  }

  /** Picks a random valid spawn point. Returns null if none found. */
  findSpawn(req: SpawnRequest): { x: number; y: number; z: number; zone: BotZone } | null {
    const zones = this.map.botZones.filter((z) => z.tags.some((t) => req.zoneTags.includes(t)));
    if (!zones.length) return null;
    const area = zones.map((z) => (z.max[0] - z.min[0]) * (z.max[1] - z.min[1]));
    const total = area.reduce((a, b) => a + b, 0);
    for (let attempt = 0; attempt < 80; attempt++) {
      let r = this.rng() * total, zi = 0;
      while (r > area[zi] && zi < zones.length - 1) r -= area[zi++];
      const z = zones[zi];
      const x = z.min[0] + this.rng() * (z.max[0] - z.min[0]);
      const zz = z.min[1] + this.rng() * (z.max[1] - z.min[1]);
      if (botBlocked(this.world, x, z.y, zz)) continue;
      if (this.bots.some((b) => b.alive && Math.hypot(b.pos.x - x, b.pos.z - zz) < 1.5)) continue;
      if (req.losFrom) {
        const o = req.losFrom;
        const dx = x - o.x, dz = zz - o.z;
        const dist = Math.hypot(dx, dz);
        if (req.minDist !== undefined && dist < req.minDist) continue;
        if (req.maxDist !== undefined && dist > req.maxDist) continue;
        if (req.facingYaw !== undefined && req.maxAngleDeg !== undefined) {
          const ang = Math.atan2(-dx, -dz);
          let diff = ang - req.facingYaw;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          if (Math.abs(diff) > (req.maxAngleDeg * Math.PI) / 180) continue;
        }
        // head and chest must both be visible
        if (!this.visible(o, x, z.y + 1.62, zz) || !this.visible(o, x, z.y + 1.1, zz)) continue;
      }
      return { x, y: z.y, z: zz, zone: z };
    }
    return null;
  }

  private visible(o: Vec3, x: number, y: number, z: number): boolean {
    const d = { x: x - o.x, y: y - o.y, z: z - o.z };
    const len = Math.hypot(d.x, d.y, d.z);
    d.x /= len; d.y /= len; d.z /= len;
    return !this.world.raycast(o, d, len - 0.2);
  }

  zoneBounds(id: string) {
    const z = this.zonesById.get(id);
    return z ? { minX: z.min[0], minZ: z.min[1], maxX: z.max[0], maxZ: z.max[1] } : undefined;
  }

  raycast(o: Vec3, d: Vec3, maxDist: number): BotRayHit | null {
    let best: BotRayHit | null = null;
    for (const b of this.bots) {
      const h = b.raycast(o, d, best ? best.t : maxDist);
      if (h) best = { bot: b, zone: h.zone, t: h.t, normal: h.normal };
    }
    return best;
  }

  aliveCount(): number { return this.bots.filter((b) => b.alive).length; }
}
