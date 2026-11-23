import * as THREE from 'three';
import type { WeaponDef } from '../config/weapons';

/**
 * First-person weapon model. Rendered in its own scene/camera after the world
 * with a cleared depth buffer, so it never clips into walls and its FOV is
 * independent of the gameplay FOV.
 */
export class ViewModel {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.01, 10);
  private root = new THREE.Group();
  private gun = new THREE.Group();
  private flash: THREE.Mesh;
  private flashLight: THREE.PointLight;
  private flashTime = 0;
  private kick = 0;
  private bobT = 0;
  private swayX = 0;
  private swayY = 0;
  private adsT = 0;
  private def: WeaponDef | null = null;
  private muzzleZ = -0.6;
  hidden = false;

  constructor() {
    this.scene.add(new THREE.HemisphereLight(0xe8eef5, 0x404048, 1.6));
    const dl = new THREE.DirectionalLight(0xffffff, 1.4);
    dl.position.set(1, 2, 1);
    this.scene.add(dl);
    this.scene.add(this.root);
    this.root.add(this.gun);
    this.gun.scale.setScalar(0.75);
    const flashTex = ViewModel.flashTexture();
    this.flash = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.22),
      new THREE.MeshBasicMaterial({ map: flashTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.flash.visible = false;
    this.root.add(this.flash);
    this.flashLight = new THREE.PointLight(0xffc870, 0, 3);
    this.root.add(this.flashLight);
  }

  private static flashTexture(): THREE.Texture {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,230,1)');
    grd.addColorStop(0.3, 'rgba(255,200,90,0.9)');
    grd.addColorStop(1, 'rgba(255,120,20,0)');
    g.fillStyle = grd;
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2, r = i % 2 ? 12 : 32;
      g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
    }
    g.fill();
    return new THREE.CanvasTexture(c);
  }

  setWeapon(def: WeaponDef): void {
    this.def = def;
    this.gun.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } });
    this.gun.clear();
    const body = new THREE.MeshStandardMaterial({ color: def.view.bodyColor, roughness: 0.5, metalness: 0.3 });
    const accent = new THREE.MeshStandardMaterial({ color: def.view.accentColor, roughness: 0.4, metalness: 0.4 });
    const L = def.view.length;
    const add = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, z);
      this.gun.add(mesh);
    };
    const pistol = L < 0.4;
    // receiver
    add(0.06, 0.08, L * 0.55, 0, 0, -L * 0.25, body);
    // barrel
    add(0.025, 0.025, L * 0.45, 0, 0.012, -L * 0.72, body);
    // top accent rail
    add(0.03, 0.015, L * 0.4, 0, 0.05, -L * 0.25, accent);
    // grip
    add(0.045, 0.11, 0.05, 0, -0.08, pistol ? -0.02 : -0.02, body);
    if (!pistol) {
      add(0.04, 0.13, 0.06, 0, -0.09, -L * 0.36, accent); // magazine
      add(0.05, 0.07, 0.2, 0, -0.015, 0.12, body); // stock
    }
    if (def.ads?.scopeOverlay) add(0.05, 0.05, 0.22, 0, 0.075, -L * 0.3, accent); // scope
    this.muzzleZ = -L * 0.95;
    this.flash.position.set(0, 0.009, this.muzzleZ * 0.75);
    this.flashLight.position.set(0, 0.03, this.muzzleZ * 0.75);
  }

  fire(): void {
    this.kick = 1;
    this.flashTime = 0.035;
    this.flash.rotation.z = Math.random() * Math.PI;
  }

  /**
   * @param speedFrac horizontal speed / run speed
   * @param lookDx mouse delta this frame (counts), for weapon sway
   */
  update(dt: number, p: {
    speedFrac: number; onGround: boolean; lookDx: number; lookDy: number;
    ads: boolean; reloadProgress: number; equipProgress: number; aspect: number;
  }): void {
    this.camera.aspect = p.aspect;
    this.camera.updateProjectionMatrix();
    const def = this.def;
    this.adsT += ((p.ads ? 1 : 0) - this.adsT) * Math.min(1, dt * 18);
    const scopeHide = def?.ads?.scopeOverlay && this.adsT > 0.6;
    this.root.visible = !this.hidden && !scopeHide;

    this.bobT += dt * (p.onGround ? 1 : 0) * (6 + 6 * p.speedFrac) * Math.min(1, p.speedFrac * 2);
    const bobAmt = Math.min(1, p.speedFrac) * (1 - this.adsT * 0.8);
    const bobX = Math.sin(this.bobT) * 0.012 * bobAmt;
    const bobY = Math.abs(Math.cos(this.bobT)) * 0.012 * bobAmt;
    this.swayX += (-p.lookDx * 0.00025 - this.swayX) * Math.min(1, dt * 10);
    this.swayY += (p.lookDy * 0.00025 - this.swayY) * Math.min(1, dt * 10);
    this.swayX = Math.max(-0.03, Math.min(0.03, this.swayX));
    this.swayY = Math.max(-0.03, Math.min(0.03, this.swayY));

    this.kick = Math.max(0, this.kick - dt * 14);
    const hip = new THREE.Vector3(0.15, -0.15, -0.46);
    const aim = new THREE.Vector3(0, -0.075, -0.36);
    const base = hip.lerp(aim, this.adsT);
    const reload = p.reloadProgress > 0 ? Math.sin(Math.min(1, p.reloadProgress) * Math.PI) : 0;
    const equip = 1 - p.equipProgress;
    this.root.position.set(
      base.x + bobX + this.swayX,
      base.y - bobY + this.swayY - reload * 0.12 - equip * 0.3,
      base.z + this.kick * 0.045,
    );
    this.root.rotation.set(this.kick * 0.08 - reload * 0.6 + equip * 0.5, this.swayX * 2, reload * 0.4);

    if (this.flashTime > 0) {
      this.flashTime -= dt;
      this.flash.visible = true;
      this.flashLight.intensity = 6;
    } else {
      this.flash.visible = false;
      this.flashLight.intensity = 0;
    }
  }
}
