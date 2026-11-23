import { MOVEMENT as M } from '../config/movement';
import { type AABB, overlaps } from '../physics/aabb';
import type { CollisionWorld } from '../physics/CollisionWorld';

export interface MoveInput {
  forward: number; // -1..1 (W = +1)
  right: number; // -1..1 (D = +1)
  walk: boolean;
  crouch: boolean;
  jump: boolean; // edge-triggered request (consumed when grounded)
  yaw: number; // radians, three.js convention (0 = looking -Z, + = turn left)
  speedMult: number; // weapon / ADS multiplier
}

const EPS = 1e-4;

/**
 * Pure kinematic character controller (no rendering dependencies so it is unit-testable).
 * Position is the centre of the feet. Collision shape is an axis-aligned box.
 */
export class PlayerController {
  pos = { x: 0, y: 0, z: 0 };
  vel = { x: 0, y: 0, z: 0 };
  onGround = false;
  crouchAmount = 0; // 0 standing .. 1 fully crouched
  /** Visual-only offset used to smooth camera when stepping up stairs. */
  stepSmoothY = 0;
  private jumpBuffer = 0;
  private tmp: AABB[] = [];

  constructor(private world: CollisionWorld) {}

  get height(): number {
    return M.standHeight.value + (M.crouchHeight.value - M.standHeight.value) * this.crouchAmount;
  }
  get eyeHeight(): number {
    return M.standEye.value + (M.crouchEye.value - M.standEye.value) * this.crouchAmount;
  }
  get horizontalSpeed(): number {
    return Math.hypot(this.vel.x, this.vel.z);
  }

  teleport(x: number, y: number, z: number): void {
    this.pos = { x, y, z };
    this.vel = { x: 0, y: 0, z: 0 };
    this.crouchAmount = 0;
    this.onGround = false;
    this.stepSmoothY = 0;
    this.groundCheck(0.1);
  }

  boxAt(x: number, y: number, z: number, h = this.height): AABB {
    const r = M.radius.value;
    return { minX: x - r, minY: y, minZ: z - r, maxX: x + r, maxY: y + h, maxZ: z + r };
  }

  private collides(b: AABB): AABB | null {
    this.tmp.length = 0;
    for (const o of this.world.query(b.minX, b.minZ, b.maxX, b.maxZ, this.tmp)) if (overlaps(b, o, 1e-6)) return o;
    return null;
  }

  /** Moves along one axis, stopping at the first obstacle. Returns true if clipped. */
  private moveAxis(axis: 'x' | 'y' | 'z', delta: number): boolean {
    if (delta === 0) return false;
    // Sub-step so fast movement can't tunnel through thin walls.
    const maxStep = 0.25;
    const steps = Math.max(1, Math.ceil(Math.abs(delta) / maxStep));
    const d = delta / steps;
    for (let i = 0; i < steps; i++) {
      this.pos[axis] += d;
      const hit = this.collides(this.boxAt(this.pos.x, this.pos.y, this.pos.z));
      if (hit) {
        const r = M.radius.value;
        if (axis === 'x') this.pos.x = d > 0 ? hit.minX - r - EPS : hit.maxX + r + EPS;
        else if (axis === 'z') this.pos.z = d > 0 ? hit.minZ - r - EPS : hit.maxZ + r + EPS;
        else this.pos.y = d > 0 ? hit.minY - this.height - EPS : hit.maxY;
        return true;
      }
    }
    return false;
  }

  /** Finds the highest floor surface within `maxSnap` below the feet and snaps onto it. */
  private groundCheck(maxSnap: number): void {
    const r = M.radius.value - 0.01;
    const { x, y, z } = this.pos;
    this.tmp.length = 0;
    let top = -Infinity;
    for (const o of this.world.query(x - r, z - r, x + r, z + r, this.tmp)) {
      if (x - r >= o.maxX || x + r <= o.minX || z - r >= o.maxZ || z + r <= o.minZ) continue;
      if (o.maxY <= y + 0.01 && o.maxY >= y - maxSnap) top = Math.max(top, o.maxY);
    }
    if (top > -Infinity) {
      this.onGround = true;
      const drop = y - top;
      this.pos.y = top;
      this.stepSmoothY += drop;
    } else {
      this.onGround = false;
    }
  }

  requestJump(): void {
    this.jumpBuffer = 0.1;
  }

  maxSpeed(input: MoveInput): number {
    let s = M.runSpeed.value * input.speedMult;
    let mult = 1;
    if (input.walk) mult = Math.min(mult, M.walkMultiplier.value);
    if (this.crouchAmount > 0.5) mult = Math.min(mult, M.crouchMultiplier.value);
    return s * mult;
  }

  step(dt: number, input: MoveInput): void {
    if (input.jump) this.requestJump();
    // --- Crouch ---
    const rate = dt / M.crouchTransitionTime.value;
    if (input.crouch) {
      const before = this.height;
      this.crouchAmount = Math.min(1, this.crouchAmount + rate);
      // In the air, crouching pulls the legs up (keeps the head where it is).
      if (!this.onGround) this.pos.y += before - this.height;
    } else if (this.crouchAmount > 0) {
      const next = Math.max(0, this.crouchAmount - rate);
      const h = M.standHeight.value + (M.crouchHeight.value - M.standHeight.value) * next;
      if (!this.collides(this.boxAt(this.pos.x, this.pos.y, this.pos.z, h))) this.crouchAmount = next;
    }

    // --- Wish direction ---
    let fx = input.forward, rx = input.right;
    const len = Math.hypot(fx, rx);
    if (len > 1) { fx /= len; rx /= len; }
    const sy = Math.sin(input.yaw), cy = Math.cos(input.yaw);
    // forward = (-sin, -cos), right = (cos, -sin)
    let wx = -sy * fx + cy * rx;
    let wz = -cy * fx - sy * rx;
    const wl = Math.hypot(wx, wz);
    const maxSpeed = this.maxSpeed(input);
    let wishSpeed = 0;
    if (wl > 1e-6) { wx /= wl; wz /= wl; wishSpeed = maxSpeed * Math.min(1, wl); }

    this.jumpBuffer -= dt;
    if (this.onGround && this.jumpBuffer > 0) {
      this.vel.y = M.jumpVelocity.value;
      this.onGround = false;
      this.jumpBuffer = 0;
    }

    if (this.onGround) {
      this.applyFriction(dt);
      this.accelerate(wx, wz, wishSpeed, M.groundAccel.value, dt);
      // Hard clamp so friction+accel never overshoots the cap.
      const hs = this.horizontalSpeed;
      if (hs > maxSpeed && wishSpeed > 0) {
        const k = maxSpeed / hs; this.vel.x *= k; this.vel.z *= k;
      }
      this.vel.y = 0;
    } else {
      this.accelerate(wx, wz, Math.min(wishSpeed, M.airWishSpeedCap.value), M.airAccel.value * (maxSpeed / M.airWishSpeedCap.value), dt);
      this.vel.y -= M.gravity.value * dt;
    }

    this.move(dt);
    this.stepSmoothY *= Math.exp(-dt * 18);
    if (Math.abs(this.stepSmoothY) < 1e-3) this.stepSmoothY = 0;
  }

  private applyFriction(dt: number): void {
    const speed = this.horizontalSpeed;
    if (speed < 1e-4) { this.vel.x = 0; this.vel.z = 0; return; }
    const control = Math.max(speed, M.stopSpeed.value);
    const drop = control * M.groundFriction.value * dt;
    const ns = Math.max(0, speed - drop) / speed;
    this.vel.x *= ns; this.vel.z *= ns;
  }

  private accelerate(wx: number, wz: number, wishSpeed: number, accel: number, dt: number): void {
    if (wishSpeed <= 0) return;
    const current = this.vel.x * wx + this.vel.z * wz;
    const add = wishSpeed - current;
    if (add <= 0) return;
    const a = Math.min(accel * wishSpeed * dt, add);
    this.vel.x += a * wx; this.vel.z += a * wz;
  }

  private move(dt: number): void {
    const dx = this.vel.x * dt, dz = this.vel.z * dt;
    const start = { ...this.pos };
    const wasGround = this.onGround;
    const bx = this.moveAxis('x', dx);
    const bz = this.moveAxis('z', dz);

    if ((bx || bz) && wasGround) {
      // Try stepping up: rise, move, fall back down.
      const flat = { ...this.pos };
      this.pos = { ...start };
      const step = M.stepHeight.value;
      this.moveAxis('y', step);
      const risen = this.pos.y - start.y;
      const sx = this.moveAxis('x', dx);
      const sz = this.moveAxis('z', dz);
      this.moveAxis('y', -risen - 0.01);
      const flatDist = Math.hypot(flat.x - start.x, flat.z - start.z);
      const stepDist = Math.hypot(this.pos.x - start.x, this.pos.z - start.z);
      if (stepDist > flatDist + 1e-4 && this.pos.y >= start.y - EPS) {
        this.stepSmoothY -= this.pos.y - start.y;
        if (sx) this.vel.x = 0;
        if (sz) this.vel.z = 0;
      } else {
        this.pos = flat;
        if (bx) this.vel.x = 0;
        if (bz) this.vel.z = 0;
      }
    } else {
      if (bx) this.vel.x = 0;
      if (bz) this.vel.z = 0;
    }

    // Vertical
    if (!this.onGround || this.vel.y > 0) {
      const hitY = this.moveAxis('y', this.vel.y * dt);
      if (hitY) {
        if (this.vel.y < 0) this.onGround = true;
        this.vel.y = 0;
      } else if (this.vel.y <= 0) {
        this.groundCheck(0.02);
      } else {
        this.onGround = false;
      }
    } else {
      // Grounded: stick to the floor when walking down steps.
      this.groundCheck(M.stepHeight.value + 0.05);
      if (!this.onGround) this.vel.y = 0;
    }
  }
}
