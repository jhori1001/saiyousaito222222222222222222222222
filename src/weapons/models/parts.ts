import * as THREE from 'three';

/**
 * Helpers for procedural first-person weapon models.
 * Convention: weapon forward is -Z, up is +Y, origin at the top of the pistol grip.
 */

/** Extrudes a side-view profile (u = z, v = y) to a given width along X, centred, with bevel. */
export function sideProfile(points: [number, number][], width: number, bevel = 0.004): THREE.BufferGeometry {
  const s = new THREE.Shape();
  points.forEach(([u, v], i) => (i === 0 ? s.moveTo(u, v) : s.lineTo(u, v)));
  s.closePath();
  return extrudeSide(s, width, bevel);
}

export function extrudeSide(shape: THREE.Shape, width: number, bevel = 0.004): THREE.BufferGeometry {
  const depth = Math.max(0.001, width - bevel * 2);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 12,
  });
  // shape XY -> (z, y); extrusion Z -> X
  g.rotateY(-Math.PI / 2);
  g.translate(depth / 2, 0, 0);
  g.computeVertexNormals();
  return g;
}

/** Cylinder between two points. */
export function tube(a: THREE.Vector3, b: THREE.Vector3, r1: number, r2 = r1, seg = 16): THREE.BufferGeometry {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r2, r1, len, seg, 1);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  g.applyQuaternion(q);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  g.translate(mid.x, mid.y, mid.z);
  return g;
}

/** Tapered capsule between two points (for limbs). */
export function limbMeshes(a: THREE.Vector3, b: THREE.Vector3, r1: number, r2: number, mat: THREE.Material): THREE.Mesh[] {
  const out = [new THREE.Mesh(tube(a, b, r1, r2, 18), mat)];
  const s1 = new THREE.Mesh(new THREE.SphereGeometry(r1, 16, 10), mat);
  s1.position.copy(a);
  const s2 = new THREE.Mesh(new THREE.SphereGeometry(r2, 16, 10), mat);
  s2.position.copy(b);
  out.push(s1, s2);
  return out;
}

let woodTex: THREE.Texture | null = null;
/** Procedural wood grain (warm orange-brown, like laminated rifle furniture). */
export function woodTexture(): THREE.Texture {
  if (woodTex) return woodTex;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#8a4a1f');
  grd.addColorStop(0.5, '#a45a26');
  grd.addColorStop(1, '#7c3f18');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) {
    const y = Math.random() * 256;
    const amp = 2 + Math.random() * 6, freq = 0.01 + Math.random() * 0.03, ph = Math.random() * 6;
    g.strokeStyle = `rgba(${Math.random() < 0.5 ? '60,25,8' : '190,110,55'},${0.15 + Math.random() * 0.25})`;
    g.lineWidth = 0.5 + Math.random() * 1.8;
    g.beginPath();
    for (let x = 0; x <= 256; x += 8) g.lineTo(x, y + Math.sin(x * freq + ph) * amp);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  t.colorSpace = THREE.SRGBColorSpace;
  woodTex = t;
  return t;
}

let metalTex: THREE.Texture | null = null;
/** Subtle brushed / worn dark metal. */
export function metalTexture(): THREE.Texture {
  if (metalTex) return metalTex;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#3a3c40';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.06})`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 10, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 6);
  t.colorSpace = THREE.SRGBColorSpace;
  metalTex = t;
  return t;
}
