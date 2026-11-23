export interface Vec3 { x: number; y: number; z: number }

export interface AABB {
  minX: number; minY: number; minZ: number;
  maxX: number; maxY: number; maxZ: number;
}

export const aabb = (minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): AABB =>
  ({ minX, minY, minZ, maxX, maxY, maxZ });

export function overlaps(a: AABB, b: AABB, eps = 0): boolean {
  return a.minX < b.maxX - eps && a.maxX > b.minX + eps &&
         a.minY < b.maxY - eps && a.maxY > b.minY + eps &&
         a.minZ < b.maxZ - eps && a.maxZ > b.minZ + eps;
}

export interface RayHit { t: number; nx: number; ny: number; nz: number }

/**
 * Slab-test ray vs AABB. `d` need not be normalised; t is in units of d.
 * Returns null when there is no hit in [0, maxT].
 */
export function rayAABB(o: Vec3, d: Vec3, b: AABB, maxT = Infinity): RayHit | null {
  let tmin = 0;
  let tmax = maxT;
  let nx = 0, ny = 0, nz = 0;
  // X
  if (Math.abs(d.x) < 1e-12) {
    if (o.x < b.minX || o.x > b.maxX) return null;
  } else {
    const inv = 1 / d.x;
    let t1 = (b.minX - o.x) * inv, t2 = (b.maxX - o.x) * inv;
    let n = -1;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; n = 1; }
    if (t1 > tmin) { tmin = t1; nx = n; ny = 0; nz = 0; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  // Y
  if (Math.abs(d.y) < 1e-12) {
    if (o.y < b.minY || o.y > b.maxY) return null;
  } else {
    const inv = 1 / d.y;
    let t1 = (b.minY - o.y) * inv, t2 = (b.maxY - o.y) * inv;
    let n = -1;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; n = 1; }
    if (t1 > tmin) { tmin = t1; nx = 0; ny = n; nz = 0; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  // Z
  if (Math.abs(d.z) < 1e-12) {
    if (o.z < b.minZ || o.z > b.maxZ) return null;
  } else {
    const inv = 1 / d.z;
    let t1 = (b.minZ - o.z) * inv, t2 = (b.maxZ - o.z) * inv;
    let n = -1;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; n = 1; }
    if (t1 > tmin) { tmin = t1; nx = 0; ny = 0; nz = n; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  return { t: tmin, nx, ny, nz };
}
