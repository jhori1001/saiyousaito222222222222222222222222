import * as THREE from 'three';
import { aabb } from '../physics/aabb';
import { CollisionWorld } from '../physics/CollisionWorld';
import type { MapBox, MapData, SurfaceKind } from './MapData';

export interface LoadedMap {
  data: MapData;
  world: CollisionWorld;
  group: THREE.Group;
  /** Meshes that receive bullet decals (same order as world.boxes). */
  meshes: THREE.Mesh[];
  dispose(): void;
}

const PALETTE: Record<SurfaceKind, { color: number; line: number; tile: number }> = {
  floor: { color: 0x8c8f93, line: 0x6e7175, tile: 2 },
  wall: { color: 0xc9c2b4, line: 0xa9a294, tile: 2 },
  outer: { color: 0x9aa3ad, line: 0x7f8892, tile: 4 },
  crate: { color: 0xb88a52, line: 0x8b6436, tile: 1 },
  crateDark: { color: 0x5d6a72, line: 0x45515a, tile: 1 },
  platform: { color: 0xa8b3a0, line: 0x87927f, tile: 1 },
  trim: { color: 0x707a86, line: 0x56606b, tile: 1 },
  stair: { color: 0xb3ae9f, line: 0x8e897b, tile: 0.6 },
};

function gridTexture(base: number, line: number, renderer: THREE.WebGLRenderer): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = `#${base.toString(16).padStart(6, '0')}`;
  g.fillRect(0, 0, 128, 128);
  // subtle noise for depth perception
  for (let i = 0; i < 300; i++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  g.strokeStyle = `#${line.toString(16).padStart(6, '0')}`;
  g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, 125, 125);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t;
}

/** BoxGeometry whose UVs are in world metres / tile so textures don't stretch. */
function worldUVBox(w: number, h: number, d: number, tile: number): THREE.BoxGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  // faces: +x, -x, +y, -y, +z, -z (4 verts each)
  const dims: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [su, sv] = dims[f];
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, (uv.getX(i) * su) / tile, (uv.getY(i) * sv) / tile);
    }
  }
  uv.needsUpdate = true;
  return g;
}

export function loadMap(data: MapData, renderer: THREE.WebGLRenderer, shadows: boolean): LoadedMap {
  const group = new THREE.Group();
  group.name = `map:${data.id}`;
  const world = new CollisionWorld();
  const meshes: THREE.Mesh[] = [];
  const mats = new Map<SurfaceKind, THREE.MeshStandardMaterial>();
  const disposables: { dispose(): void }[] = [];

  const matFor = (k: SurfaceKind) => {
    let m = mats.get(k);
    if (!m) {
      const p = PALETTE[k];
      const tex = gridTexture(p.color, p.line, renderer);
      m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.0 });
      mats.set(k, m);
      disposables.push(m, tex);
    }
    return m;
  };

  data.boxes.forEach((b: MapBox) => {
    const [x1, y1, z1] = b.min, [x2, y2, z2] = b.max;
    world.add(aabb(x1, y1, z1, x2, y2, z2));
    const w = x2 - x1, h = y2 - y1, d = z2 - z1;
    const geo = worldUVBox(w, h, d, PALETTE[b.kind].tile);
    disposables.push(geo);
    const mesh = new THREE.Mesh(geo, matFor(b.kind));
    mesh.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    mesh.castShadow = shadows && b.kind !== 'floor';
    mesh.receiveShadow = shadows;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    group.add(mesh);
    meshes.push(mesh);
  });

  return {
    data, world, group, meshes,
    dispose() { disposables.forEach((d) => d.dispose()); group.removeFromParent(); },
  };
}
