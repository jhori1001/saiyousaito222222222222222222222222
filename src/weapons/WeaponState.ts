import type { WeaponDef } from '../config/weapons';

export interface FireContext {
  /** Horizontal speed / base run speed of the equipped weapon (0..~1). */
  speedFrac: number;
  /** Walk speed as fraction of run speed (used for movement error interpolation). */
  walkFrac: number;
  onGround: boolean;
  crouched: boolean;
  ads: boolean;
  infiniteAmmo: boolean;
  rng: () => number;
}

export interface ShotEvent {
  /** Total angular offset from the aim direction, degrees (yaw right+, pitch up+). */
  yawDeg: number;
  pitchDeg: number;
  /** Spread cone half-angle used for this shot (deg) — for HUD / stopping analysis. */
  spreadDeg: number;
  sprayIndex: number;
}

/** Runtime state for one weapon. Simulated in fixed ticks. */
export class WeaponState {
  ammo: number;
  reloadLeft = 0;
  equipLeft = 0;
  cooldown = 0;
  heat = 0; // shots in current spray (float, recovers over time)
  sinceShot = 99;
  private extPattern: [number, number][] = [];

  constructor(public def: WeaponDef) {
    this.ammo = def.magSize.value;
  }

  get reloading(): boolean { return this.reloadLeft > 0; }
  get reloadProgress(): number { return this.reloading ? 1 - this.reloadLeft / this.def.reloadTime.value : 0; }
  get equipping(): boolean { return this.equipLeft > 0; }

  equip(): void {
    this.equipLeft = this.def.equipTime.value;
    this.reloadLeft = 0;
    this.heat = 0;
    this.cooldown = 0;
  }

  startReload(): boolean {
    if (this.reloading || this.ammo >= this.def.magSize.value) return false;
    this.reloadLeft = this.def.reloadTime.value;
    return true;
  }

  /** Recoil offset for a (fractional) spray index, degrees [yaw, pitch]. */
  patternAt(index: number): [number, number] {
    const p = this.def.recoil.pattern.value;
    const all = this.extPattern.length ? this.extPattern : p;
    if (index <= 0) return [all[0][0], all[0][1]];
    const i = Math.min(Math.floor(index), all.length - 1);
    const j = Math.min(i + 1, all.length - 1);
    const f = Math.min(1, index - i);
    return [all[i][0] + (all[j][0] - all[i][0]) * f, all[i][1] + (all[j][1] - all[i][1]) * f];
  }

  /** Current recoil offset (what the next bullet would get), degrees. */
  currentRecoil(crouched: boolean, ads: boolean): [number, number] {
    const [y, p] = this.patternAt(this.heat);
    const m = this.recoilMult(crouched, ads);
    return [y * m, p * m];
  }

  private recoilMult(crouched: boolean, ads: boolean): number {
    let m = 1;
    if (crouched) m *= this.def.recoil.crouchMult.value;
    if (ads && this.def.ads) m *= this.def.ads.recoilMult.value;
    return m;
  }

  /** Builds the random continuation of the pattern at the start of a new spray. */
  private regenerateExtension(rng: () => number): void {
    const base = this.def.recoil.pattern.value;
    const ext: [number, number][] = base.map((v) => [v[0], v[1]]);
    const step = this.def.recoil.swayStep.value, bound = this.def.recoil.swayBound.value;
    let [yaw, pitch] = ext[ext.length - 1];
    let dir = rng() < 0.5 ? -1 : 1;
    for (let i = 0; i < 64; i++) {
      yaw += dir * step * (0.5 + rng());
      if (Math.abs(yaw) > bound) { yaw = Math.sign(yaw) * bound; dir = -dir; }
      if (rng() < 0.15) dir = -dir;
      pitch += (rng() - 0.5) * 0.1;
      ext.push([yaw, pitch]);
    }
    this.extPattern = ext;
  }

  /** Movement-induced error in degrees. */
  movementError(ctx: FireContext): number {
    const s = this.def.spread;
    if (!ctx.onGround) return s.air.value;
    const f = ctx.speedFrac;
    const a = s.accurateSpeedFrac.value;
    if (f <= a) return 0;
    const w = Math.max(a + 1e-3, ctx.walkFrac);
    if (f <= w) return s.walk.value * ((f - a) / (w - a));
    return s.walk.value + (s.run.value - s.walk.value) * Math.min(1, (f - w) / (1 - w));
  }

  /** Total spread cone half-angle (deg) if a shot were fired now. */
  currentSpread(ctx: FireContext): number {
    const s = this.def.spread;
    let base = s.firstShot.value;
    const ads = this.def.ads;
    if (ads?.unscopedSpread && !ctx.ads) base = ads.unscopedSpread.value;
    const spray = Math.min(s.max.value, s.perShot.value * Math.max(0, this.heat - s.graceShots.value + 1));
    let total = base + spray + this.movementError(ctx);
    if (ctx.crouched && ctx.onGround && ctx.speedFrac <= s.accurateSpeedFrac.value) total *= s.crouchMult.value;
    if (ctx.ads && ads) total *= ads.spreadMult.value;
    return total;
  }

  canFire(): boolean {
    return !this.reloading && !this.equipping && this.ammo > 0 && this.cooldown <= 0;
  }

  /**
   * Advance one fixed tick. `trigger` = button held, `pressed` = pressed this tick.
   * Returns the shots fired during this tick.
   */
  tick(dt: number, trigger: boolean, pressed: boolean, ctx: FireContext): ShotEvent[] {
    const shots: ShotEvent[] = [];
    if (this.equipLeft > 0) this.equipLeft = Math.max(0, this.equipLeft - dt);
    if (this.reloadLeft > 0) {
      this.reloadLeft -= dt;
      if (this.reloadLeft <= 0) { this.reloadLeft = 0; this.ammo = this.def.magSize.value; }
    }
    this.cooldown -= dt;

    const wants = this.def.fireMode === 'auto' ? trigger : pressed;
    if (wants && this.ammo <= 0 && !this.reloading && this.cooldown <= 0) this.startReload();

    while (wants && this.canFire()) {
      if (this.heat < 0.5) { this.heat = 0; this.regenerateExtension(ctx.rng); }
      const spread = this.currentSpread(ctx);
      const [ry, rp] = this.currentRecoil(ctx.crouched, ctx.ads);
      // Uniform sample inside the spread disc.
      const r = spread * Math.sqrt(ctx.rng());
      const th = ctx.rng() * Math.PI * 2;
      shots.push({ yawDeg: ry + r * Math.cos(th), pitchDeg: rp + r * Math.sin(th), spreadDeg: spread, sprayIndex: Math.round(this.heat) });
      if (!ctx.infiniteAmmo) this.ammo--;
      this.heat += 1;
      this.sinceShot = 0;
      this.cooldown += 1 / this.def.fireRate.value;
      if (this.def.fireMode === 'semi') break;
    }
    if (this.cooldown < 0) this.cooldown = 0;

    if (shots.length === 0) {
      this.sinceShot += dt;
      if (this.sinceShot > this.def.recoil.recoveryDelay.value && this.heat > 0) {
        this.heat -= (this.heat * this.def.recoil.recoveryExp.value + this.def.recoil.recoveryLin.value) * dt;
        if (this.heat < 0) this.heat = 0;
      }
    }
    if (this.ammo <= 0 && !this.reloading && !ctx.infiniteAmmo && this.cooldown <= 0 && !trigger) this.startReload();
    return shots;
  }
}
