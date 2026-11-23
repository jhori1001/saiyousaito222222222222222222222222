import { v, type Sourced } from './provenance';

/**
 * Weapon definitions — single source of truth for all weapon numbers.
 *
 * Names are ORIGINAL placeholder names. `referenceName` records which weapon of the
 * reference game the definition is modelled on (for benchmarking only) so that
 * licensed names can be swapped in later without touching gameplay code.
 *
 * Angles are in DEGREES. Recoil pattern: [yaw, pitch] offsets per shot index
 * (pitch positive = up, yaw positive = right), cumulative from the aim point.
 */

export type FireMode = 'auto' | 'semi';

export interface DamageRange {
  /** Upper bound of this range in metres (inclusive). */
  maxDist: number;
  head: number;
  body: number;
  leg: number;
}

export interface WeaponDef {
  id: string;
  name: string;
  referenceName: string;
  slotKey: string; // KeyboardEvent.code that equips it
  fireMode: FireMode;
  fireRate: Sourced<number>; // rounds per second
  magSize: Sourced<number>;
  reloadTime: Sourced<number>; // seconds
  equipTime: Sourced<number>; // seconds
  damage: Sourced<DamageRange[]>;
  moveSpeedMult: Sourced<number>;

  spread: {
    firstShot: Sourced<number>; // deg, standing still, hip-fire
    perShot: Sourced<number>; // deg added per spray shot after grace
    graceShots: Sourced<number>; // spray shots before spread starts growing
    max: Sourced<number>; // deg, max spray spread
    run: Sourced<number>; // deg added at full run speed
    walk: Sourced<number>; // deg added at walk speed
    accurateSpeedFrac: Sourced<number>; // fraction of run speed under which there is no movement error
    air: Sourced<number>; // deg added while airborne
    crouchMult: Sourced<number>; // multiplier on total spread while crouched & still
  };

  recoil: {
    pattern: Sourced<[number, number][]>;
    /** Fraction of the bullet recoil offset that is also applied to the camera. */
    viewKick: Sourced<number>;
    /** After the pattern ends: max random yaw sway (deg) per shot and yaw bound. */
    swayStep: Sourced<number>;
    swayBound: Sourced<number>;
    /** Delay (s) after a shot before recovery begins. */
    recoveryDelay: Sourced<number>;
    /** Spray "heat" recovery: heat -= (heat*exp + lin) * dt. */
    recoveryExp: Sourced<number>;
    recoveryLin: Sourced<number>;
    crouchMult: Sourced<number>;
  };

  ads: null | {
    zoom: Sourced<number>;
    spreadMult: Sourced<number>;
    recoilMult: Sourced<number>;
    moveMult: Sourced<number>;
    scopeOverlay: boolean;
    /** Spread used when NOT scoped (sniper hip-fire). */
    unscopedSpread?: Sourced<number>;
  };

  view: { bodyColor: number; accentColor: number; length: number };
}

const RIFLE_SWAY = { swayStep: v(0.55, 'estimate'), swayBound: v(1.6, 'estimate') };

export const WEAPONS: WeaponDef[] = [
  {
    id: 'rifle_v',
    name: 'VR-9 Vanguard',
    referenceName: 'Vandal',
    slotKey: 'Digit1',
    fireMode: 'auto',
    fireRate: v(9.75, 'official'),
    magSize: v(25, 'official'),
    reloadTime: v(2.5, 'official'),
    equipTime: v(1.0, 'official'),
    damage: v([{ maxDist: Infinity, head: 160, body: 40, leg: 34 }], 'official', 'No damage fall-off.'),
    moveSpeedMult: v(1.0, 'estimate', 'Rifles assumed to keep base run speed — verify.'),
    spread: {
      firstShot: v(0.25, 'official', 'In-game first shot spread stat.'),
      perShot: v(0.32, 'estimate'),
      graceShots: v(3, 'estimate'),
      max: v(2.6, 'estimate'),
      run: v(6.0, 'estimate'),
      walk: v(2.6, 'estimate'),
      accurateSpeedFrac: v(0.3, 'estimate', 'Key stopping parameter — must be measured in the real game.'),
      air: v(9.0, 'estimate'),
      crouchMult: v(0.85, 'estimate'),
    },
    recoil: {
      pattern: v(
        [
          [0, 0], [0, 0.12], [0.02, 0.32], [0.05, 0.65], [-0.04, 1.05], [0.08, 1.5],
          [0.14, 1.95], [0.06, 2.4], [-0.1, 2.8], [-0.32, 3.1], [-0.62, 3.3],
          [-0.88, 3.42], [-0.7, 3.5], [-0.3, 3.55], [0.2, 3.58], [0.62, 3.62],
        ],
        'estimate',
        'Shape only: vertical climb then horizontal sway. Must be traced from the real game.',
      ),
      viewKick: v(0.45, 'estimate'),
      ...RIFLE_SWAY,
      recoveryDelay: v(0.1, 'estimate'),
      recoveryExp: v(3.5, 'estimate'),
      recoveryLin: v(6.0, 'estimate'),
      crouchMult: v(0.85, 'estimate'),
    },
    ads: {
      zoom: v(1.25, 'official'),
      spreadMult: v(0.85, 'estimate'),
      recoilMult: v(0.9, 'estimate'),
      moveMult: v(0.76, 'estimate'),
      scopeOverlay: false,
    },
    view: { bodyColor: 0x2b2f36, accentColor: 0xd9a441, length: 0.62 },
  },
  {
    id: 'rifle_p',
    name: 'PX-4 Phalanx',
    referenceName: 'Phantom',
    slotKey: 'Digit2',
    fireMode: 'auto',
    fireRate: v(11, 'official'),
    magSize: v(30, 'official'),
    reloadTime: v(2.5, 'official'),
    equipTime: v(1.0, 'official'),
    damage: v(
      [
        { maxDist: 15, head: 156, body: 39, leg: 33 },
        { maxDist: 30, head: 140, body: 35, leg: 29 },
        { maxDist: Infinity, head: 124, body: 31, leg: 26 },
      ],
      'official',
    ),
    moveSpeedMult: v(1.0, 'estimate'),
    spread: {
      firstShot: v(0.2, 'official'),
      perShot: v(0.26, 'estimate'),
      graceShots: v(3, 'estimate'),
      max: v(2.2, 'estimate'),
      run: v(6.0, 'estimate'),
      walk: v(2.4, 'estimate'),
      accurateSpeedFrac: v(0.3, 'estimate'),
      air: v(9.0, 'estimate'),
      crouchMult: v(0.85, 'estimate'),
    },
    recoil: {
      pattern: v(
        [
          [0, 0], [0, 0.1], [0, 0.26], [0.04, 0.52], [-0.03, 0.85], [0.06, 1.2],
          [0.1, 1.55], [0.02, 1.9], [-0.12, 2.2], [-0.35, 2.45], [-0.55, 2.6],
          [-0.42, 2.7], [-0.1, 2.76], [0.25, 2.8], [0.5, 2.84],
        ],
        'estimate',
      ),
      viewKick: v(0.45, 'estimate'),
      swayStep: v(0.45, 'estimate'),
      swayBound: v(1.3, 'estimate'),
      recoveryDelay: v(0.09, 'estimate'),
      recoveryExp: v(3.5, 'estimate'),
      recoveryLin: v(7.0, 'estimate'),
      crouchMult: v(0.85, 'estimate'),
    },
    ads: {
      zoom: v(1.25, 'official'),
      spreadMult: v(0.85, 'estimate'),
      recoilMult: v(0.9, 'estimate'),
      moveMult: v(0.76, 'estimate'),
      scopeOverlay: false,
    },
    view: { bodyColor: 0x30343a, accentColor: 0x56b4d3, length: 0.6 },
  },
  {
    id: 'pistol_s',
    name: 'SR-6 Marshal',
    referenceName: 'Sheriff',
    slotKey: 'Digit3',
    fireMode: 'semi',
    fireRate: v(4, 'official'),
    magSize: v(6, 'official'),
    reloadTime: v(2.25, 'official'),
    equipTime: v(0.75, 'official'),
    damage: v(
      [
        { maxDist: 30, head: 159, body: 55, leg: 46 },
        { maxDist: Infinity, head: 145, body: 50, leg: 42 },
      ],
      'official',
    ),
    moveSpeedMult: v(1.0, 'estimate'),
    spread: {
      firstShot: v(0.25, 'official'),
      perShot: v(0.9, 'estimate'),
      graceShots: v(1, 'estimate'),
      max: v(3.5, 'estimate'),
      run: v(3.0, 'estimate'),
      walk: v(1.6, 'estimate'),
      accurateSpeedFrac: v(0.3, 'estimate'),
      air: v(6.0, 'estimate'),
      crouchMult: v(0.85, 'estimate'),
    },
    recoil: {
      pattern: v([[0, 0], [0.1, 1.4], [-0.15, 2.6], [0.2, 3.6], [-0.1, 4.4], [0.1, 5.0]], 'estimate'),
      viewKick: v(0.6, 'estimate'),
      swayStep: v(0.5, 'estimate'),
      swayBound: v(1.2, 'estimate'),
      recoveryDelay: v(0.12, 'estimate'),
      recoveryExp: v(2.5, 'estimate'),
      recoveryLin: v(3.0, 'estimate'),
      crouchMult: v(0.85, 'estimate'),
    },
    ads: {
      zoom: v(1.25, 'official'),
      spreadMult: v(0.85, 'estimate'),
      recoilMult: v(0.9, 'estimate'),
      moveMult: v(0.76, 'estimate'),
      scopeOverlay: false,
    },
    view: { bodyColor: 0x3a3330, accentColor: 0xb06a3b, length: 0.34 },
  },
  {
    id: 'pistol_g',
    name: 'GS-15 Wisp',
    referenceName: 'Ghost',
    slotKey: 'Digit4',
    fireMode: 'semi',
    fireRate: v(6.75, 'official'),
    magSize: v(15, 'official', 'Verify against current patch.'),
    reloadTime: v(1.5, 'official'),
    equipTime: v(0.75, 'official'),
    damage: v(
      [
        { maxDist: 30, head: 105, body: 30, leg: 25 },
        { maxDist: Infinity, head: 87, body: 25, leg: 21 },
      ],
      'official',
    ),
    moveSpeedMult: v(1.0, 'estimate'),
    spread: {
      firstShot: v(0.3, 'official'),
      perShot: v(0.35, 'estimate'),
      graceShots: v(2, 'estimate'),
      max: v(2.4, 'estimate'),
      run: v(2.2, 'estimate'),
      walk: v(1.2, 'estimate'),
      accurateSpeedFrac: v(0.3, 'estimate'),
      air: v(5.0, 'estimate'),
      crouchMult: v(0.85, 'estimate'),
    },
    recoil: {
      pattern: v([[0, 0], [0.05, 0.6], [-0.08, 1.15], [0.1, 1.6], [-0.05, 2.0], [0.08, 2.3]], 'estimate'),
      viewKick: v(0.5, 'estimate'),
      swayStep: v(0.4, 'estimate'),
      swayBound: v(1.0, 'estimate'),
      recoveryDelay: v(0.1, 'estimate'),
      recoveryExp: v(3.0, 'estimate'),
      recoveryLin: v(5.0, 'estimate'),
      crouchMult: v(0.85, 'estimate'),
    },
    ads: null,
    view: { bodyColor: 0x26292e, accentColor: 0x7fd38a, length: 0.36 },
  },
  {
    id: 'rifle_gd',
    name: 'GD-12 Sentinel',
    referenceName: 'Guardian',
    slotKey: 'Digit5',
    fireMode: 'semi',
    fireRate: v(5.25, 'estimate', 'Has changed across patches — verify.'),
    magSize: v(12, 'official'),
    reloadTime: v(2.5, 'official'),
    equipTime: v(1.0, 'official'),
    damage: v([{ maxDist: Infinity, head: 195, body: 65, leg: 48 }], 'official'),
    moveSpeedMult: v(1.0, 'estimate'),
    spread: {
      firstShot: v(0.1, 'official'),
      perShot: v(0.6, 'estimate'),
      graceShots: v(1, 'estimate'),
      max: v(3.0, 'estimate'),
      run: v(6.0, 'estimate'),
      walk: v(2.8, 'estimate'),
      accurateSpeedFrac: v(0.3, 'estimate'),
      air: v(9.0, 'estimate'),
      crouchMult: v(0.85, 'estimate'),
    },
    recoil: {
      pattern: v([[0, 0], [0.05, 1.0], [-0.08, 1.9], [0.1, 2.7], [-0.05, 3.3]], 'estimate'),
      viewKick: v(0.55, 'estimate'),
      swayStep: v(0.4, 'estimate'),
      swayBound: v(1.0, 'estimate'),
      recoveryDelay: v(0.12, 'estimate'),
      recoveryExp: v(3.0, 'estimate'),
      recoveryLin: v(4.0, 'estimate'),
      crouchMult: v(0.85, 'estimate'),
    },
    ads: {
      zoom: v(1.5, 'official'),
      spreadMult: v(0.8, 'estimate'),
      recoilMult: v(0.85, 'estimate'),
      moveMult: v(0.76, 'estimate'),
      scopeOverlay: false,
    },
    view: { bodyColor: 0x2e3238, accentColor: 0xe0e0e0, length: 0.72 },
  },
  {
    id: 'sniper_o',
    name: 'OP-5 Longbow',
    referenceName: 'Operator',
    slotKey: 'Digit6',
    fireMode: 'semi',
    fireRate: v(0.6, 'official'),
    magSize: v(5, 'official'),
    reloadTime: v(3.7, 'official'),
    equipTime: v(1.5, 'official'),
    damage: v([{ maxDist: Infinity, head: 255, body: 150, leg: 127 }], 'official'),
    moveSpeedMult: v(0.76, 'estimate', 'Heavy weapon move penalty.'),
    spread: {
      firstShot: v(0.0, 'estimate', 'Scoped, standing still.'),
      perShot: v(0.0, 'estimate'),
      graceShots: v(1, 'estimate'),
      max: v(0.0, 'estimate'),
      run: v(10.0, 'estimate'),
      walk: v(5.0, 'estimate'),
      accurateSpeedFrac: v(0.25, 'estimate'),
      air: v(15.0, 'estimate'),
      crouchMult: v(1.0, 'estimate'),
    },
    recoil: {
      pattern: v([[0, 0], [0, 2.5]], 'estimate'),
      viewKick: v(0.8, 'estimate'),
      swayStep: v(0, 'estimate'),
      swayBound: v(0, 'estimate'),
      recoveryDelay: v(0.2, 'estimate'),
      recoveryExp: v(2.0, 'estimate'),
      recoveryLin: v(2.0, 'estimate'),
      crouchMult: v(1, 'estimate'),
    },
    ads: {
      zoom: v(2.5, 'official', 'First zoom level only (second level not implemented).'),
      spreadMult: v(1.0, 'estimate'),
      recoilMult: v(1.0, 'estimate'),
      moveMult: v(0.6, 'estimate'),
      scopeOverlay: true,
      unscopedSpread: v(5.0, 'estimate'),
    },
    view: { bodyColor: 0x2a2d33, accentColor: 0x9b7bd9, length: 0.9 },
  },
];

export const WEAPON_BY_ID: Record<string, WeaponDef> = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));

export function damageAt(def: WeaponDef, dist: number, zone: 'head' | 'body' | 'leg'): number {
  const ranges = def.damage.value;
  for (const r of ranges) if (dist <= r.maxDist) return r[zone];
  return ranges[ranges.length - 1][zone];
}
