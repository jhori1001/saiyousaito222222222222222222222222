import { describe, expect, it } from 'vitest';
import { MOVEMENT } from '../src/config/movement';
import { WEAPON_BY_ID, damageAt } from '../src/config/weapons';
import { cmPer360, DEFAULT_SETTINGS, radPerCount, sanitize } from '../src/core/Settings';
import { trainingGround } from '../src/map/maps/trainingGround';
import { aabb, rayAABB } from '../src/physics/aabb';
import { CollisionWorld } from '../src/physics/CollisionWorld';
import { type MoveInput, PlayerController } from '../src/player/PlayerController';
import { WeaponState, type FireContext } from '../src/weapons/WeaponState';

const DT = 1 / 128;
const flat = () => new CollisionWorld([aabb(-100, -1, -100, 100, 0, 100)]);
const input = (o: Partial<MoveInput> = {}): MoveInput => ({ forward: 0, right: 0, walk: false, crouch: false, jump: false, yaw: 0, speedMult: 1, ...o });

function run(p: PlayerController, seconds: number, inp: MoveInput) {
  for (let t = 0; t < seconds; t += DT) p.step(DT, inp);
}
function ticksUntil(p: PlayerController, inp: MoveInput, cond: () => boolean, max = 512) {
  let n = 0;
  while (!cond() && n < max) { p.step(DT, inp); n++; }
  return n;
}

describe('sensitivity', () => {
  it('uses 0.07 deg/count * sens', () => {
    const s = { ...DEFAULT_SETTINGS, sensitivity: 1 };
    expect(radPerCount(s)).toBeCloseTo((0.07 * Math.PI) / 180, 10);
  });
  it('computes cm/360', () => {
    const s = { ...DEFAULT_SETTINGS, sensitivity: 0.4, dpi: 800 };
    // 360 / (0.07*0.4) = 12857 counts / 800 = 16.07 in = 40.8 cm
    expect(cmPer360(s)).toBeCloseTo(40.82, 1);
  });
  it('sanitizes bad stored settings', () => {
    const s = sanitize({ sensitivity: -5, dpi: NaN as unknown as number, crosshair: { color: 'red' } as never });
    expect(s.sensitivity).toBe(0.01);
    expect(s.dpi).toBe(DEFAULT_SETTINGS.dpi);
    expect(s.crosshair.color).toBe(DEFAULT_SETTINGS.crosshair.color);
  });
});

describe('movement', () => {
  it('reaches but never exceeds run speed', () => {
    const p = new PlayerController(flat());
    p.teleport(0, 0, 0);
    run(p, 1, input({ forward: 1 }));
    expect(p.horizontalSpeed).toBeCloseTo(MOVEMENT.runSpeed.value, 2);
    run(p, 1, input({ forward: 1, right: 1 }));
    expect(p.horizontalSpeed).toBeLessThanOrEqual(MOVEMENT.runSpeed.value + 1e-6);
  });

  it('walk and crouch reduce speed', () => {
    const p = new PlayerController(flat());
    p.teleport(0, 0, 0);
    run(p, 1, input({ right: 1, walk: true }));
    expect(p.horizontalSpeed).toBeCloseTo(MOVEMENT.runSpeed.value * MOVEMENT.walkMultiplier.value, 2);
    run(p, 1, input({ right: 1, crouch: true }));
    expect(p.horizontalSpeed).toBeCloseTo(MOVEMENT.runSpeed.value * MOVEMENT.crouchMultiplier.value, 2);
  });

  it('counter-strafing stops faster than releasing the key', () => {
    const accurate = MOVEMENT.runSpeed.value * WEAPON_BY_ID.rifle_v.spread.accurateSpeedFrac.value;
    const a = new PlayerController(flat()); a.teleport(0, 0, 0);
    run(a, 1, input({ right: 1 }));
    const release = ticksUntil(a, input(), () => a.horizontalSpeed <= accurate);
    const b = new PlayerController(flat()); b.teleport(0, 0, 0);
    run(b, 1, input({ right: 1 }));
    const counter = ticksUntil(b, input({ right: -1 }), () => b.horizontalSpeed <= accurate);
    expect(counter).toBeLessThan(release);
    // Both should be quick (snappy movement): under 250 ms
    expect(release * DT).toBeLessThan(0.25);
    console.log(`time to accurate speed: release ${(release * DT * 1000).toFixed(0)}ms, counter-strafe ${(counter * DT * 1000).toFixed(0)}ms`);
  });

  it('jumps and lands', () => {
    const p = new PlayerController(flat()); p.teleport(0, 0, 0);
    expect(p.onGround).toBe(true);
    p.step(DT, input({ jump: true }));
    expect(p.onGround).toBe(false);
    let apex = 0;
    let t = 0;
    while (!p.onGround && t < 3) { p.step(DT, input()); apex = Math.max(apex, p.pos.y); t += DT; }
    expect(p.onGround).toBe(true);
    expect(apex).toBeGreaterThan(0.7);
    expect(p.pos.y).toBeCloseTo(0, 5);
  });

  it('cannot pass through walls even at high speed', () => {
    const w = flat();
    w.add(aabb(2, 0, -5, 2.1, 3, 5)); // 10cm thin wall
    const p = new PlayerController(w); p.teleport(0, 0, 0);
    p.vel.x = 200; // absurd speed
    p.step(DT, input({ right: 1, yaw: 0 }));
    expect(p.pos.x).toBeLessThan(2);
    run(p, 2, input({ right: 1 }));
    expect(p.pos.x).toBeLessThan(2);
  });

  it('steps up stairs but not tall crates', () => {
    const w = flat();
    w.add(aabb(1, 0, -2, 2, 0.4, 2)); // step
    w.add(aabb(4, 0, -2, 5, 1.0, 2)); // crate
    const p = new PlayerController(w); p.teleport(0, 0, 0);
    run(p, 0.25, input({ right: 1 }));
    expect(p.pos.y).toBeCloseTo(0.4, 3);
    run(p, 2, input({ right: 1 }));
    expect(p.pos.x).toBeLessThan(4);
  });

  it('cannot stand up under a low ceiling', () => {
    const w = flat();
    w.add(aabb(-5, 1.4, -5, 5, 2, 5));
    const p = new PlayerController(w); p.teleport(0, 0, 0);
    // spawn standing collides; crouch first, then try to stand
    p.crouchAmount = 1;
    run(p, 0.5, input());
    expect(p.pos.y + p.height).toBeLessThanOrEqual(1.4);
    expect(p.crouchAmount).toBeGreaterThan(0.5);
  });

  it('map spawn points are valid and grounded', () => {
    const world = new CollisionWorld(trainingGround.boxes.map((b) => aabb(...b.min, ...b.max)));
    for (const sp of Object.values(trainingGround.playerSpawns)) {
      const p = new PlayerController(world);
      p.teleport(...sp.pos);
      expect(p.onGround).toBe(true);
      expect(world.overlapsAny(p.boxAt(p.pos.x, p.pos.y + 0.01, p.pos.z))).toBe(false);
    }
  });
});

describe('ray casting', () => {
  it('hits box with correct normal', () => {
    const h = rayAABB({ x: 0, y: 0.5, z: 0 }, { x: 0, y: 0, z: -1 }, aabb(-1, 0, -6, 1, 1, -5));
    expect(h?.t).toBeCloseTo(5);
    expect(h?.nz).toBe(1);
  });
  it('misses box behind origin', () => {
    expect(rayAABB({ x: 0, y: 0.5, z: 0 }, { x: 0, y: 0, z: 1 }, aabb(-1, 0, -6, 1, 1, -5))).toBeNull();
  });
});

describe('weapons', () => {
  const ctx = (o: Partial<FireContext> = {}): FireContext => ({
    speedFrac: 0, walkFrac: 0.6, onGround: true, crouched: false, ads: false, infiniteAmmo: false, rng: Math.random, ...o,
  });

  it('fires at exactly the configured rate', () => {
    const w = new WeaponState(WEAPON_BY_ID.rifle_v);
    let shots = 0;
    for (let i = 0; i < 128 * 2; i++) shots += w.tick(DT, true, i === 0, ctx({ infiniteAmmo: true })).length;
    expect(shots).toBeGreaterThanOrEqual(19);
    expect(shots).toBeLessThanOrEqual(20); // 9.75 rps * 2s = 19.5
  });

  it('first shot uses first-shot spread with no recoil offset', () => {
    const w = new WeaponState(WEAPON_BY_ID.rifle_v);
    const [s] = w.tick(DT, true, true, ctx());
    expect(s.spreadDeg).toBeCloseTo(0.25);
    expect(Math.hypot(s.yawDeg, s.pitchDeg)).toBeLessThanOrEqual(0.25 + 1e-9);
  });

  it('moving adds error, stopping removes it', () => {
    const w = new WeaponState(WEAPON_BY_ID.rifle_v);
    expect(w.currentSpread(ctx({ speedFrac: 1 }))).toBeGreaterThan(5);
    expect(w.currentSpread(ctx({ speedFrac: 0.2 }))).toBeCloseTo(0.25);
    expect(w.currentSpread(ctx({ onGround: false }))).toBeGreaterThan(8);
  });

  it('spray climbs and then recovers', () => {
    const w = new WeaponState(WEAPON_BY_ID.rifle_v);
    for (let i = 0; i < 128; i++) w.tick(DT, true, i === 0, ctx());
    const [, pitch] = w.currentRecoil(false, false);
    expect(pitch).toBeGreaterThan(2);
    for (let i = 0; i < 128; i++) w.tick(DT, false, false, ctx());
    expect(w.heat).toBe(0);
  });

  it('auto reloads after emptying the magazine', () => {
    const w = new WeaponState(WEAPON_BY_ID.rifle_v);
    for (let i = 0; i < 128 * 4; i++) w.tick(DT, true, i === 0, ctx());
    for (let i = 0; i < 128 * 3; i++) w.tick(DT, false, false, ctx());
    expect(w.ammo).toBe(25);
  });

  it('semi-auto fires once per click', () => {
    const w = new WeaponState(WEAPON_BY_ID.pistol_s);
    let shots = 0;
    for (let i = 0; i < 128; i++) shots += w.tick(DT, true, i === 0, ctx()).length;
    expect(shots).toBe(1);
  });

  it('damage values and falloff', () => {
    expect(damageAt(WEAPON_BY_ID.rifle_v, 49, 'head')).toBe(160);
    expect(damageAt(WEAPON_BY_ID.rifle_p, 10, 'head')).toBe(156);
    expect(damageAt(WEAPON_BY_ID.rifle_p, 40, 'head')).toBe(124);
  });
});
