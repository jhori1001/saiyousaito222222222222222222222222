import { type AABB, type RayHit, type Vec3, overlaps, rayAABB } from './aabb';

export interface WorldRayHit extends RayHit { box: AABB; index: number }

/**
 * Static collision world made of axis-aligned boxes.
 * Uses a uniform XZ grid for broad-phase so queries stay cheap as maps grow.
 */
export class CollisionWorld {
  readonly boxes: AABB[] = [];
  private cell = 4;
  private grid = new Map<string, number[]>();

  constructor(boxes: AABB[] = []) {
    for (const b of boxes) this.add(b);
  }

  add(b: AABB): void {
    const idx = this.boxes.length;
    this.boxes.push(b);
    const c = this.cell;
    for (let x = Math.floor(b.minX / c); x <= Math.floor(b.maxX / c); x++)
      for (let z = Math.floor(b.minZ / c); z <= Math.floor(b.maxZ / c); z++) {
        const k = `${x},${z}`;
        let list = this.grid.get(k);
        if (!list) { list = []; this.grid.set(k, list); }
        list.push(idx);
      }
  }

  private seen = new Uint32Array(0);
  private stamp = 0;

  /** Collect boxes whose grid cells touch the given XZ range. */
  query(minX: number, minZ: number, maxX: number, maxZ: number, out: AABB[] = []): AABB[] {
    if (this.seen.length < this.boxes.length) this.seen = new Uint32Array(this.boxes.length);
    this.stamp++;
    const c = this.cell;
    for (let x = Math.floor(minX / c); x <= Math.floor(maxX / c); x++)
      for (let z = Math.floor(minZ / c); z <= Math.floor(maxZ / c); z++) {
        const list = this.grid.get(`${x},${z}`);
        if (!list) continue;
        for (const i of list) {
          if (this.seen[i] === this.stamp) continue;
          this.seen[i] = this.stamp;
          out.push(this.boxes[i]);
        }
      }
    return out;
  }

  overlapsAny(b: AABB): boolean {
    for (const o of this.query(b.minX, b.minZ, b.maxX, b.maxZ)) if (overlaps(b, o, 1e-6)) return true;
    return false;
  }

  /** Ray cast against all boxes. Direction should be normalised so t is metres. */
  raycast(o: Vec3, d: Vec3, maxDist: number): WorldRayHit | null {
    // Brute force is fine for a few hundred boxes and exact; grid traversal can be added later.
    let best: WorldRayHit | null = null;
    let bestT = maxDist;
    for (let i = 0; i < this.boxes.length; i++) {
      const h = rayAABB(o, d, this.boxes[i], bestT);
      if (h && h.t <= bestT) {
        // Ray starting inside a box (t=0, no normal) is ignored to avoid self-hits.
        if (h.t === 0 && h.nx === 0 && h.ny === 0 && h.nz === 0) continue;
        bestT = h.t;
        best = { ...h, box: this.boxes[i], index: i };
      }
    }
    return best;
  }
}
