import * as THREE from 'three';

interface Timed { obj: THREE.Object3D; life: number; max: number; mat?: THREE.Material & { opacity: number } }

/** Bullet holes, impact puffs and tracers using fixed-size pools (no per-shot allocations). */
export class Effects {
  readonly group = new THREE.Group();
  private decals: THREE.Mesh[] = [];
  private decalIdx = 0;
  private puffs: Timed[] = [];
  private puffIdx = 0;
  private tracers: Timed[] = [];
  private tracerIdx = 0;
  private tmp = new THREE.Vector3();

  constructor(maxDecals = 160) {
    const holeTex = Effects.holeTexture();
    const decalMat = new THREE.MeshBasicMaterial({ map: holeTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    const decalGeo = new THREE.PlaneGeometry(0.07, 0.07);
    for (let i = 0; i < maxDecals; i++) {
      const m = new THREE.Mesh(decalGeo, decalMat);
      m.visible = false;
      m.matrixAutoUpdate = true;
      this.decals.push(m);
      this.group.add(m);
    }
    const puffGeo = new THREE.SphereGeometry(0.06, 6, 4);
    for (let i = 0; i < 32; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false });
      const m = new THREE.Mesh(puffGeo, mat);
      m.visible = false;
      this.puffs.push({ obj: m, life: 0, max: 0.12, mat });
      this.group.add(m);
    }
    for (let i = 0; i < 16; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const mat = new THREE.LineBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: 0.6 });
      const l = new THREE.Line(geo, mat);
      l.frustumCulled = false;
      l.visible = false;
      this.tracers.push({ obj: l, life: 0, max: 0.05, mat });
      this.group.add(l);
    }
  }

  private static holeTexture(): THREE.Texture {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(16, 16, 1, 16, 16, 16);
    grd.addColorStop(0, 'rgba(10,10,10,1)');
    grd.addColorStop(0.45, 'rgba(25,25,25,0.9)');
    grd.addColorStop(1, 'rgba(40,40,40,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  }

  decal(p: THREE.Vector3, n: THREE.Vector3): void {
    const m = this.decals[this.decalIdx];
    this.decalIdx = (this.decalIdx + 1) % this.decals.length;
    m.position.copy(p).addScaledVector(n, 0.004);
    m.lookAt(this.tmp.copy(m.position).add(n));
    m.rotateZ(Math.random() * Math.PI);
    m.visible = true;
  }

  puff(p: THREE.Vector3, color: number, size = 1): void {
    const e = this.puffs[this.puffIdx];
    this.puffIdx = (this.puffIdx + 1) % this.puffs.length;
    e.obj.position.copy(p);
    e.obj.scale.setScalar(size);
    (e.mat as THREE.MeshBasicMaterial).color.setHex(color);
    e.life = e.max;
    e.obj.visible = true;
  }

  tracer(a: THREE.Vector3, b: THREE.Vector3): void {
    const e = this.tracers[this.tracerIdx];
    this.tracerIdx = (this.tracerIdx + 1) % this.tracers.length;
    const pos = ((e.obj as THREE.Line).geometry.attributes.position as THREE.BufferAttribute);
    pos.setXYZ(0, a.x, a.y, a.z); pos.setXYZ(1, b.x, b.y, b.z); pos.needsUpdate = true;
    e.life = e.max; e.obj.visible = true;
  }

  clearDecals(): void { this.decals.forEach((d) => (d.visible = false)); }

  update(dt: number): void {
    for (const e of this.puffs) {
      if (e.life <= 0) continue;
      e.life -= dt;
      const k = Math.max(0, e.life / e.max);
      e.mat!.opacity = k;
      e.obj.scale.multiplyScalar(1 + dt * 8);
      if (e.life <= 0) e.obj.visible = false;
    }
    for (const e of this.tracers) {
      if (e.life <= 0) continue;
      e.life -= dt;
      e.mat!.opacity = 0.6 * Math.max(0, e.life / e.max);
      if (e.life <= 0) e.obj.visible = false;
    }
  }
}
