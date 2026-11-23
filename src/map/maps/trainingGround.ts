import type { MapBox, MapData, SurfaceKind } from '../MapData';

/**
 * "Proving Grounds" — an ORIGINAL training map (no reference-game geometry).
 * Layout (top view, -Z is north, player spawns south facing north):
 *
 *   z=-51 ┌──────────────── SITE (crates, raised NW platform) ────────────────┐
 *   z=-38 │ LONG lane │        MID (north wall w/ gap)        │ CQ building  │
 *         │ 16m wide  │  platform + stairs, big peek crates   │ corridors,   │
 *         │ low cover │  open southern court (range lane)     │ rooms, doors │
 *   z= 38 └────────────────────── SPAWN ─────────────────────────────────────┘
 */

const boxes: MapBox[] = [];
const B = (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, kind: SurfaceKind) =>
  boxes.push({ min: [Math.min(x1, x2), Math.min(y1, y2), Math.min(z1, z2)], max: [Math.max(x1, x2), Math.max(y1, y2), Math.max(z1, z2)], kind });

/** Stairs rising toward a direction. Each step is 0.4 high and `depth` deep. */
function stairs(x: number, z: number, width: number, steps: number, dir: 'x+' | 'x-' | 'z+' | 'z-', depth = 0.6, rise = 0.4) {
  for (let i = 0; i < steps; i++) {
    const h = (i + 1) * rise;
    const a = i * depth, b = (i + 1) * depth;
    switch (dir) {
      case 'x+': B(x + a, 0, z, x + b, h, z + width, 'stair'); break;
      case 'x-': B(x - a, 0, z, x - b, h, z + width, 'stair'); break;
      case 'z+': B(x, 0, z + a, x + width, h, z + b, 'stair'); break;
      case 'z-': B(x, 0, z - a, x + width, h, z - b, 'stair'); break;
    }
  }
}

// Floor & outer walls
B(-42, -1, -52, 42, 0, 52, 'floor');
B(-42, 0, -52, -41, 7, 52, 'outer');
B(41, 0, -52, 42, 7, 52, 'outer');
B(-42, 0, -52, 42, 7, -51, 'outer');
B(-42, 0, 51, 42, 7, 52, 'outer');

// Lane dividers (with connectors)
B(-25, 0, -38, -24, 6, 12, 'wall');
B(-25, 0, 18, -24, 6, 38, 'wall');
B(15, 0, -38, 16, 6, 0, 'wall');
B(15, 0, 6, 16, 6, 38, 'wall');

// ---------- LONG lane ----------
B(-38, 0, 8, -36, 2, 10, 'crate');
B(-33, 0, -6, -29, 1.0, -5, 'crateDark'); // head-height cover
B(-29, 0, -22, -26, 1.4, -19, 'crate');
B(-41, 0, 24, -37, 2.4, 27, 'crate');
B(-41, 0, -51, -33, 2.0, -44, 'platform'); // raised position
stairs(-30.6, -48, 2, 5, 'x-'); // rises toward -x onto the platform (top step at x -33)

// ---------- MID ----------
B(-21, 0, 21.4, -19.8, 6, 22.6, 'trim'); // pillars
B(10, 0, 21.4, 11.2, 6, 22.6, 'trim');
B(-8, 0, -14, 2, 1.2, -6, 'platform');
stairs(-4, -4.2, 3, 3, 'z-'); // south stairs rising north onto the platform
B(-18, 0, -4, -15, 2.2, -1, 'crate');
B(8, 0, -4, 11, 2.2, -1, 'crate');
B(-14, 0, 6, -12, 1.0, 8, 'crateDark');
B(6, 0, 6, 8, 1.4, 8, 'crateDark');
// north wall of mid with a 8m gap
B(-24, 0, -26, -10, 5, -25, 'wall');
B(-2, 0, -26, 15, 5, -25, 'wall');
B(-20, 0, -34, -17, 1.4, -31, 'crate');
B(9, 0, -36, 12, 2.0, -33, 'crate');

// ---------- CQ building ----------
B(16, 0, 20, 30, 4, 21, 'wall');
B(34, 0, 20, 41, 4, 21, 'wall');
B(28, 0, -38, 29, 4, -10, 'wall');
B(28, 0, -4, 29, 4, 20, 'wall');
B(16, 0, -16, 24, 4, -15, 'wall');
B(26, 0, -16, 28, 4, -15, 'wall');
B(29, 0, 0, 36, 4, 1, 'wall');
B(33, 0, -24, 41, 4, -23, 'wall');
B(31, 0, 8, 33, 1.4, 10, 'crate');
B(37, 0, -12, 39, 2, -10, 'crate');
B(19, 0, -30, 21, 1.0, -28, 'crateDark');
B(20, 0, 4, 22, 2.2, 6, 'crate');

// ---------- SITE ----------
B(-12, 0, -46, -9, 2.0, -43, 'crate');
B(-4, 0, -48, -1, 1.4, -46, 'crateDark');
B(4, 0, -44, 6, 1.0, -42, 'crateDark');
B(18, 0, -46, 21, 2.4, -43, 'crate');
B(30, 0, -48, 33, 1.2, -45, 'crate');

export const trainingGround: MapData = {
  id: 'proving_grounds',
  name: 'Proving Grounds (オリジナル)',
  license: { owner: 'project', status: 'original' },
  boxes,
  playerSpawns: {
    default: { pos: [-5, 0, 46], yawDeg: 0 },
    flick: { pos: [-5, 0, 30], yawDeg: 0 },
    stopping: { pos: [-5, 0, 34], yawDeg: 0 },
  },
  botZones: [
    { id: 'long_far', min: [-39, -36], max: [-27, -24], y: 0, tags: ['free'] },
    { id: 'long_mid', min: [-39, -16], max: [-27, 4], y: 0, tags: ['free'] },
    { id: 'long_platform', min: [-40, -50], max: [-34, -45], y: 2, tags: ['free'] },
    { id: 'mid_open', min: [-22, 0], max: [13, 20], y: 0, tags: ['free', 'flick'] },
    { id: 'mid_platform', min: [-7, -13], max: [1, -7], y: 1.2, tags: ['free', 'flick'] },
    { id: 'mid_north', min: [-22, -36], max: [13, -28], y: 0, tags: ['free'] },
    { id: 'site', min: [-38, -50], max: [38, -40], y: 0, tags: ['free'] },
    { id: 'cq_corridor', min: [17, -36], max: [27, 18], y: 0, tags: ['free'] },
    { id: 'cq_rooms', min: [30, -36], max: [40, 18], y: 0, tags: ['free'] },
  ],
  fixedTargets: {
    stopping: [[-9, 0, 14], [-5, 0, 14], [-1, 0, 14]],
  },
  sky: { top: 0x6f8fb3, bottom: 0xcfd8e0, fog: 0xb9c6d1, fogNear: 60, fogFar: 160 },
};
