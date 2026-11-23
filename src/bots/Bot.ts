import * as THREE from 'three';
import { type AABB, rayAABB, type Vec3 } from '../physics/aabb';
import type { BotBehavior } from './BotBehaviors';

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
  private mats: THREE.MeshStandardMaterial[] = [];

  constructor(public maxHp: number, public behavior: BotBehavior) {
    this.hp = maxHp;
    this.mesh = Bot.buildMesh(this.mats);
    this.mesh.visible = false;
  }

  private static buildMesh(mats: THREE.MeshStandardMaterial[]): THREE.Group {
    const g = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.7 });
    const suit = new THREE.MeshStandardMaterial({ color: 0xd2453a, roughness: 0.6 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x3b3f46, roughness: 0.8 });
    const visor = new THREE.MeshStandardMaterial({ color: 0x1b1d22, roughness: 0.3, metalness: 0.4 });
    mats.push(skin, suit, pants, visor);
    const add = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      g.add(mesh);
      return mesh;
    };
    // head (exactly the head hitbox)
    add(0.26, 0.28, 0.26, 0, 1.62, 0, skin);
    add(0.2, 0.06, 0.02, 0, 1.64, -0.135, visor);
    // torso + arms (inside body hitbox)
    add(0.42, 0.62, 0.3, 0, 1.17, 0, suit);
    add(0.06, 0.56, 0.12, -0.24, 1.18, 0, suit);
    add(0.06, 0.56, 0.12, 0.24, 1.18, 0, suit);
    // legs (inside leg hitbox)
    add(0.18, 0.86, 0.22, -0.11, 0.43, 0, pants);
    add(0.18, 0.86, 0.22, 0.11, 0.43, 0, pants);
    return g;
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
    for (const m of this.mats) m.emissive.setRGB(f, f * 0.9, f * 0.9);
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
    this.mesh.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
    this.mats.forEach((m) => m.dispose());
    this.mesh.removeFromParent();
  }
}
