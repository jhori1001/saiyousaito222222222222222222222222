import * as THREE from 'three';

/**
 * Original humanoid target character ("Rookie"): casual street outfit — cap,
 * headphones, short-sleeve shirt with tie, pleated skirt, sneakers.
 * Built procedurally from primitives; proportions are fitted to the gameplay
 * hitboxes in Bot.ts (head 1.48–1.76 m, body 0.86–1.48 m, legs 0–0.86 m).
 *
 * Geometries are shared between all bots; materials are per bot (hit flash).
 */

const geoCache = new Map<string, THREE.BufferGeometry>();
function geo<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geoCache.get(key);
  if (!g) { g = make(); geoCache.set(key, g); }
  return g as T;
}

export interface BotPalette {
  skin: number; hair: number; cap: number; capBrim: number; shirt: number; trim: number;
  tie: number; skirt: number; sock: number; shoe: number; sole: number; phones: number; phonePad: number;
}

export const PALETTES: BotPalette[] = [
  { skin: 0xf2c9ad, hair: 0x3d2a22, cap: 0x2a9d8f, capBrim: 0x1f7a6f, shirt: 0xf4f4f1, trim: 0x1f3a5f, tie: 0x1f3a5f, skirt: 0x23345a, sock: 0xf5f5f5, shoe: 0x37404c, sole: 0xeeeeee, phones: 0xd5d7da, phonePad: 0x2b2d31 },
  { skin: 0xe8b896, hair: 0x1f1a18, cap: 0x3d5a80, capBrim: 0x2c4361, shirt: 0xf0efe9, trim: 0x8c2f39, tie: 0x3d5a80, skirt: 0x3c3f46, sock: 0xffffff, shoe: 0x2f5d50, sole: 0xf2f2f2, phones: 0x2b2d31, phonePad: 0x111111 },
  { skin: 0xf5d2ba, hair: 0x6b4430, cap: 0xd9a441, capBrim: 0xb3842f, shirt: 0xfafafa, trim: 0x2f6f4e, tie: 0x2f6f4e, skirt: 0x2f4f3e, sock: 0xf0f0f0, shoe: 0x2e2e2e, sole: 0xdddddd, phones: 0xe8e8e8, phonePad: 0x3a3a3a },
];

export interface BotRig {
  root: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
  hipL: THREE.Group; hipR: THREE.Group;
  kneeL: THREE.Group; kneeR: THREE.Group;
  shoulderL: THREE.Group; shoulderR: THREE.Group;
  elbowL: THREE.Group; elbowR: THREE.Group;
  upper: THREE.Group; // torso + head (bobs/breathes)
  skirt: THREE.Mesh;
}

/** Cone with pleats: alternating radius bumps around the circumference. */
function pleatedSkirt(): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(0.165, 0.255, 0.25, 40, 3, true);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = p.getY(i);
    const a = Math.atan2(z, x);
    const lower = (0.125 - y) / 0.25; // 0 at top .. 1 at hem
    const bump = 1 + (Math.round((a / (Math.PI * 2)) * 40) % 2 === 0 ? 0.045 : -0.02) * (0.3 + lower);
    p.setXYZ(i, x * bump, y, z * bump * 0.82);
  }
  g.computeVertexNormals();
  return g;
}

/** Torso shell via lathe profile, flattened front-to-back. */
function torsoShell(): THREE.BufferGeometry {
  const pts = [
    [0.0, 0.0], [0.145, 0.0], [0.15, 0.05], [0.158, 0.14], [0.178, 0.25], [0.198, 0.34],
    [0.2, 0.39], [0.175, 0.445], [0.1, 0.47], [0.05, 0.475],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pts, 32);
  g.scale(1, 1, 0.64);
  return g;
}

function limb(len: number, r1: number, r2: number): THREE.BufferGeometry {
  // tapered capsule hanging down from origin
  const g = new THREE.CylinderGeometry(r1, r2, len, 14, 1);
  g.translate(0, -len / 2, 0);
  const cap1 = new THREE.SphereGeometry(r1, 14, 8);
  const cap2 = new THREE.SphereGeometry(r2, 14, 8);
  cap2.translate(0, -len, 0);
  return mergeSimple([g, cap1, cap2]);
}

/** Minimal geometry merge (positions + normals + uvs) without extra deps. */
function mergeSimple(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const parts = list.map((g) => (g.index ? g.toNonIndexed() : g));
  const total = parts.reduce((n, g) => n + g.attributes.position.count, 0);
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2);
  let o = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array as Float32Array, o * 3);
    nor.set(g.attributes.normal.array as Float32Array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array as Float32Array, o * 2);
    o += g.attributes.position.count;
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  m.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  m.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return m;
}

export { mergeSimple };

export function buildBotRig(paletteIndex = 0): BotRig {
  const pal = PALETTES[paletteIndex % PALETTES.length];
  const materials: THREE.MeshStandardMaterial[] = [];
  const mat = (color: number, rough = 0.75, metal = 0) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
    materials.push(m);
    return m;
  };
  const skin = mat(pal.skin, 0.6);
  const hair = mat(pal.hair, 0.55);
  const cap = mat(pal.cap, 0.7);
  const capBrim = mat(pal.capBrim, 0.7);
  const shirt = mat(pal.shirt, 0.8);
  const trim = mat(pal.trim, 0.7);
  const tie = mat(pal.tie, 0.6);
  const skirtMat = mat(pal.skirt, 0.8);
  skirtMat.side = THREE.DoubleSide;
  hair.side = THREE.DoubleSide;
  const sock = mat(pal.sock, 0.9);
  const shoe = mat(pal.shoe, 0.6);
  const sole = mat(pal.sole, 0.8);
  const phones = mat(pal.phones, 0.35, 0.5);
  const pad = mat(pal.phonePad, 0.8);
  const dark = mat(0x161616, 0.4);
  const lip = mat(0xc97b74, 0.6);

  const root = new THREE.Group();
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
    const me = new THREE.Mesh(g, m);
    me.position.set(x, y, z);
    me.castShadow = true;
    parent.add(me);
    return me;
  };

  // ---------------- legs ----------------
  const makeLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.088, 0.84, 0);
    root.add(hip);
    mesh(geo('thigh', () => limb(0.38, 0.068, 0.05)), skin, hip);
    const knee = new THREE.Group();
    knee.position.set(0, -0.39, 0);
    hip.add(knee);
    mesh(geo('shin', () => limb(0.33, 0.05, 0.036)), skin, knee);
    mesh(geo('sock', () => new THREE.CylinderGeometry(0.043, 0.04, 0.09, 14)), sock, knee, 0, -0.3, 0);
    // sneaker
    const foot = new THREE.Group();
    foot.position.set(0, -0.38, -0.025);
    knee.add(foot);
    const upperShoe = mesh(geo('shoe', () => { const g = new THREE.SphereGeometry(0.06, 16, 10); g.scale(0.85, 0.62, 1.75); return g; }), shoe, foot, 0, 0.012, 0);
    upperShoe.castShadow = true;
    mesh(geo('sole', () => { const g = new THREE.CylinderGeometry(0.055, 0.055, 0.02, 16); g.scale(0.95, 1, 1.9); return g; }), sole, foot, 0, -0.022, 0);
    mesh(geo('lace', () => new THREE.BoxGeometry(0.05, 0.012, 0.06)), sole, foot, 0, 0.045, -0.04);
    return { hip, knee };
  };
  const L = makeLeg(-1), R = makeLeg(1);

  // ---------------- skirt ----------------
  const skirt = mesh(geo('skirt', pleatedSkirt), skirtMat, root, 0, 0.88, 0);
  mesh(geo('belt', () => { const g = new THREE.TorusGeometry(0.155, 0.016, 8, 32); g.rotateX(Math.PI / 2); g.scale(1, 1, 0.72); return g; }), skirtMat, root, 0, 1.0, 0);

  // ---------------- upper body ----------------
  const upper = new THREE.Group();
  root.add(upper);
  const torso = mesh(geo('torso', torsoShell), shirt, upper, 0, 0.98, 0);
  torso.castShadow = true;
  // hem trim and pocket badge
  mesh(geo('hem', () => { const g = new THREE.TorusGeometry(0.15, 0.008, 6, 32); g.rotateX(Math.PI / 2); g.scale(1, 1, 0.64); return g; }), trim, upper, 0, 0.995, 0);
  mesh(geo('badge', () => new THREE.CircleGeometry(0.022, 16)), trim, upper, 0.075, 1.29, -0.123).rotation.y = Math.PI;
  // collar + tie
  const collar = mesh(geo('collar', () => { const g = new THREE.TorusGeometry(0.06, 0.017, 8, 20); g.rotateX(Math.PI / 2 - 0.25); return g; }), shirt, upper, 0, 1.44, -0.005);
  collar.castShadow = false;
  mesh(geo('tieKnot', () => new THREE.BoxGeometry(0.03, 0.03, 0.02)), tie, upper, 0, 1.415, -0.066);
  const tieBlade = mesh(geo('tie', () => {
    const s = new THREE.Shape();
    s.moveTo(-0.014, 0); s.lineTo(0.014, 0); s.lineTo(0.026, -0.2); s.lineTo(0, -0.225); s.lineTo(-0.026, -0.2); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.006, bevelEnabled: false });
    return g;
  }), tie, upper, 0, 1.4, -0.122);
  tieBlade.rotation.x = 0.12;
  mesh(geo('neck', () => new THREE.CylinderGeometry(0.043, 0.048, 0.1, 14)), skin, upper, 0, 1.47, 0);

  // ---------------- arms ----------------
  const makeArm = (side: -1 | 1) => {
    const sh = new THREE.Group();
    sh.position.set(side * 0.205, 1.38, 0);
    sh.rotation.z = side * 0.14;
    upper.add(sh);
    mesh(geo('shoulder', () => new THREE.SphereGeometry(0.062, 14, 10)), shirt, sh);
    mesh(geo('sleeve', () => { const g = new THREE.CylinderGeometry(0.06, 0.056, 0.14, 14, 1, true); g.translate(0, -0.07, 0); return g; }), shirt, sh).material = shirt;
    mesh(geo('sleeveTrim', () => { const g = new THREE.TorusGeometry(0.056, 0.008, 6, 18); g.rotateX(Math.PI / 2); return g; }), trim, sh, 0, -0.13, 0);
    mesh(geo('upperArm', () => limb(0.25, 0.043, 0.036)), skin, sh, 0, -0.02, 0);
    const el = new THREE.Group();
    el.position.set(0, -0.27, 0);
    el.rotation.x = -0.35;
    sh.add(el);
    mesh(geo('forearm', () => limb(0.21, 0.036, 0.029)), skin, el);
    mesh(geo('hand', () => { const g = new THREE.SphereGeometry(0.036, 12, 8); g.scale(0.75, 1.3, 1); return g; }), skin, el, 0, -0.25, 0);
    if (side === -1) mesh(geo('watch', () => new THREE.CylinderGeometry(0.033, 0.033, 0.025, 14)), dark, el, 0, -0.19, 0);
    return { sh, el };
  };
  const AL = makeArm(-1), AR = makeArm(1);

  // ---------------- head ----------------
  const head = new THREE.Group();
  head.position.set(0, 1.6, 0);
  upper.add(head);
  mesh(geo('head', () => { const g = new THREE.SphereGeometry(0.1, 24, 18); g.scale(0.95, 1.15, 1.02); return g; }), skin, head);
  // eyes / brows / mouth
  const eyeG = geo('eye', () => { const g = new THREE.SphereGeometry(0.013, 10, 8); g.scale(1, 1.2, 0.5); return g; });
  mesh(eyeG, dark, head, -0.035, 0.012, -0.093);
  mesh(eyeG, dark, head, 0.035, 0.012, -0.093);
  const browG = geo('brow', () => new THREE.BoxGeometry(0.03, 0.006, 0.006));
  mesh(browG, hair, head, -0.036, 0.042, -0.094).rotation.z = 0.12;
  mesh(browG, hair, head, 0.036, 0.042, -0.094).rotation.z = -0.12;
  mesh(geo('mouth', () => new THREE.BoxGeometry(0.03, 0.007, 0.006)), lip, head, 0, -0.055, -0.093);
  mesh(geo('nose', () => { const g = new THREE.ConeGeometry(0.012, 0.03, 8); g.rotateX(-Math.PI / 2 + 0.3); return g; }), skin, head, 0, -0.012, -0.1);
  // bob hair: open in front for the face
  const front = Math.PI * 1.5;
  mesh(geo('hairBack', () => { const g = new THREE.SphereGeometry(0.113, 28, 18, front + 0.95, Math.PI * 2 - 1.9, 0, Math.PI * 0.66); g.scale(1.02, 1.08, 1.06); return g; }), hair, head, 0, 0.01, 0.004);
  mesh(geo('fringe', () => { const g = new THREE.SphereGeometry(0.116, 24, 10, front - 1.05, 2.1, 0, Math.PI * 0.3); g.scale(1, 1.08, 1.04); return g; }), hair, head, 0, 0.01, 0);
  // cap
  mesh(geo('capCrown', () => { const g = new THREE.SphereGeometry(0.12, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1, 0.78, 1.06); return g; }), cap, head, 0, 0.05, 0.004);
  const brim = mesh(geo('capBrim', () => { const g = new THREE.CylinderGeometry(0.085, 0.085, 0.01, 24, 1, false, 0, Math.PI); g.rotateY(Math.PI / 2); g.scale(1, 1, 1.15); return g; }), capBrim, head, 0, 0.055, -0.1);
  brim.rotation.x = -0.12;
  mesh(geo('capButton', () => new THREE.SphereGeometry(0.012, 8, 6)), capBrim, head, 0, 0.145, 0.004);
  // headphones
  mesh(geo('band', () => new THREE.TorusGeometry(0.128, 0.011, 8, 28, Math.PI)), phones, head, 0, 0.02, 0.012);
  const cupG = geo('cup', () => { const g = new THREE.CylinderGeometry(0.045, 0.045, 0.036, 20); g.rotateZ(Math.PI / 2); return g; });
  const padG = geo('pad', () => { const g = new THREE.TorusGeometry(0.036, 0.01, 8, 18); g.rotateY(Math.PI / 2); return g; });
  for (const s of [-1, 1]) {
    mesh(cupG, phones, head, s * 0.128, 0.0, 0.01);
    mesh(padG, pad, head, s * 0.108, 0.0, 0.01);
  }

  return {
    root, materials, hipL: L.hip, hipR: R.hip, kneeL: L.knee, kneeR: R.knee,
    shoulderL: AL.sh, shoulderR: AR.sh, elbowL: AL.el, elbowR: AR.el, upper, skirt,
  };
}

/**
 * Procedural animation. `lateral` = signed sideways speed (m/s, + = bot's right),
 * `phase` accumulates with distance travelled.
 */
export function animateRig(rig: BotRig, phase: number, lateral: number, time: number): void {
  const k = Math.min(1, Math.abs(lateral) / 3.5);
  const step = Math.sin(phase);
  // side-step: legs open and close
  const spread = Math.abs(step) * 0.22 * k;
  rig.hipL.rotation.z = -spread - 0.03;
  rig.hipR.rotation.z = spread + 0.03;
  const lift = Math.max(0, step) * 0.35 * k, lift2 = Math.max(0, -step) * 0.35 * k;
  rig.hipL.rotation.x = -lift * 0.4;
  rig.kneeL.rotation.x = lift;
  rig.hipR.rotation.x = -lift2 * 0.4;
  rig.kneeR.rotation.x = lift2;
  // body bob + lean into the movement + idle breathing
  const breathe = Math.sin(time * 2.2) * 0.004;
  rig.upper.position.y = -Math.abs(Math.cos(phase)) * 0.025 * k + breathe;
  rig.upper.rotation.z = -Math.sign(lateral) * 0.05 * k;
  rig.skirt.rotation.z = -Math.sign(lateral) * 0.04 * k;
  // arms swing slightly
  rig.shoulderL.rotation.z = -0.14 - spread * 0.4;
  rig.shoulderR.rotation.z = 0.14 + spread * 0.4;
  rig.shoulderL.rotation.x = Math.sin(time * 2.2) * 0.02;
  rig.shoulderR.rotation.x = -Math.sin(time * 2.2) * 0.02;
}
