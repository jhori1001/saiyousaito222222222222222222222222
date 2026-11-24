import * as THREE from 'three';
import { type AABB, rayAABB, type Vec3 } from '../physics/aabb';
import type { BotBehavior } from './BotBehaviors';
import { animateRig, type BotRig, buildBotRig } from './BotModel';

export type HitZone = 'head' | 'body' | 'leg';

/** Hitboxes in bot-local space (feet at origin, facing -Z). Visual mesh matches exactly. */
export const HITBOXES: { zone: HitZone; box: AABB }[] = [
  { zone: 'head', box: { minX: -0.13, minY: 1.48, minZ: -0.13, maxX: 0.13, maxY: 1.76, maxZ: 0.13 } },
  { zone: 'body', box: { minX: -0.27, minY: 0.86, minZ: -0.16, maxX: 0.27, maxY: 1.48, maxZ: 0.16 } },
  { zone: 'leg', box: { minX: -0.22, minY: 0.0, minZ: -0.14, maxX: 0.22, maxY: 0.86, maxZ: 0.14 } },
];
export const BOT_RADIUS = 0.28;
export const BOT_HEIGHT = 1.76;

export interface BotHit { t: number; zone: HitZone; normal: Vec3 }

let nextId = 1;

export class Bot {
  readonly id = nextId++;
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  yaw = 0;
  hp: number;
  alive = false;
  spawnTime = 0;
  zoneId = '';
  respawnAt = -1;
  hitFlash = 0;
  readonly mesh: THREE.Group;
  private rig: BotRig;
  private animPhase = 0;

  constructor(public maxHp: number, public behavior: BotBehavior) {
    this.hp = maxHp;
    this.rig = buildBotRig(this.id);
    this.mesh = this.rig.root;
    this.mesh.visible = false;
  }

  spawn(x: number, y: number, z: number, now: number, zoneId: string): void {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    this.hp = this.maxHp;
    this.alive = true;
    this.spawnTime = now;
    this.zoneId = zoneId;
    this.respawnAt = -1;
    this.mesh.visible = true;
    this.behavior.reset(this);
    this.syncMesh();
  }

  kill(): void {
    this.alive = false;
    this.mesh.visible = false;
  }

  faceTowards(x: number, z: number): void {
    // three.js: rotation.y = yaw makes local -Z point toward (-sin, -cos)
    this.yaw = Math.atan2(-(x - this.pos.x), -(z - this.pos.z));
  }

  syncMesh(): void {
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.yaw;
    const f = this.hitFlash;
    for (const m of this.rig.materials) m.emissive.setRGB(f * 0.8, f * 0.25, f * 0.2);
  }

  /** Per-frame procedural animation driven by velocity. */
  animate(dt: number, time: number): void {
    // sideways component of velocity in the bot's local frame (+ = bot's right)
    const lateral = this.vel.x * Math.cos(this.yaw) - this.vel.z * Math.sin(this.yaw);
    this.animPhase += Math.abs(lateral) * dt * 4.2;
    if (Math.abs(lateral) < 0.05) this.animPhase += (Math.round(this.animPhase / Math.PI) * Math.PI - this.animPhase) * Math.min(1, dt * 10);
    animateRig(this.rig, this.animPhase, lateral, time + this.id);
  }

  /** Ray (world space, d normalised) vs rotated hitboxes. */
  raycast(o: Vec3, d: Vec3, maxDist: number): BotHit | null {
    if (!this.alive) return null;
    const c = Math.cos(-this.yaw), s = Math.sin(-this.yaw);
    // world -> local: translate then rotate by -yaw around Y
    const ox = o.x - this.pos.x, oz = o.z - this.pos.z;
    const lo = { x: ox * c + oz * s, y: o.y - this.pos.y, z: -ox * s + oz * c };
    const ld = { x: d.x * c + d.z * s, y: d.y, z: -d.x * s + d.z * c };
    let best: BotHit | null = null;
    let bestT = maxDist;
    for (const hb of HITBOXES) {
      const h = rayAABB(lo, ld, hb.box, bestT);
      if (h && h.t < bestT) {
        bestT = h.t;
        // local normal -> world normal (rotate by +yaw)
        const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
        best = { t: h.t, zone: hb.zone, normal: { x: h.nx * cy + h.nz * sy, y: h.ny, z: -h.nx * sy + h.nz * cy } };
      }
    }
    return best;
  }

  dispose(): void {
    // geometries are shared between bots; only materials are per bot
    this.rig.materials.forEach((m) => m.dispose());
    this.mesh.removeFromParent();
  }
}
