import * as THREE from 'three';
import type { WeaponDef } from '../config/weapons';
import { buildArms } from './models/arms';
import { buildRifleAK, type WeaponModel } from './models/rifleAK';

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
  private magazine: THREE.Object3D | null = null;
  private magazineRest: THREE.Vector3 | null = null;
  private sightY = 0.05;
  private frontZ = -0.5;
  hidden = false;

  constructor() {
    this.scene.add(new THREE.HemisphereLight(0xe8eef5, 0x505058, 2.2));
    const dl = new THREE.DirectionalLight(0xffffff, 1.4);
    dl.position.set(1, 2, 1);
    this.scene.add(dl);
    this.scene.add(this.root);
    this.root.add(this.gun);
    this.gun.scale.setScalar(0.62);
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
    const model = def.id === 'rifle_v' ? buildRifleAK() : ViewModel.blockModel(def);
    this.gun.add(model.group);
    this.gun.add(buildArms(model.rightHand, model.leftHand, def.view.length < 0.4));
    this.magazine = model.magazine ?? null;
    this.magazineRest = this.magazine ? this.magazine.position.clone() : null;
    this.sightY = model.sightY;
    this.frontZ = model.frontZ;
    const s = this.gun.scale.x;
    this.flash.position.copy(model.muzzle).multiplyScalar(s);
    this.flashLight.position.copy(model.muzzle).multiplyScalar(s);
  }

  /** Simple placeholder model for weapons that don't have a detailed one yet. */
  private static blockModel(def: WeaponDef): WeaponModel {
    const group = new THREE.Group();
    const body = new THREE.MeshStandardMaterial({ color: def.view.bodyColor, roughness: 0.5, metalness: 0.3 });
    const accent = new THREE.MeshStandardMaterial({ color: def.view.accentColor, roughness: 0.4, metalness: 0.4 });
    const L = def.view.length;
    const add = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, z);
      group.add(mesh);
      return mesh;
    };
    const pistol = L < 0.4;
    add(0.05, 0.06, L * 0.55, 0, 0.0, -L * 0.22, body);
    add(0.022, 0.022, L * 0.45, 0, 0.012, -L * 0.68, body);
    add(0.028, 0.012, L * 0.4, 0, 0.036, -L * 0.25, accent);
    add(0.04, 0.11, 0.05, 0, -0.08, 0.03, body).rotation.x = -0.25;
    let mag: THREE.Mesh | undefined;
    if (!pistol) {
      mag = add(0.035, 0.13, 0.06, 0, -0.09, -L * 0.3, accent);
      add(0.045, 0.07, 0.22, 0, -0.015, 0.16, body);
    }
    if (def.ads?.scopeOverlay) add(0.045, 0.045, 0.22, 0, 0.065, -L * 0.25, accent);
    return {
      group,
      muzzle: new THREE.Vector3(0, 0.012, -L * 0.92),
      rightHand: new THREE.Vector3(0, -0.04, 0.04),
      leftHand: pistol ? new THREE.Vector3(-0.01, -0.09, 0.02) : new THREE.Vector3(0, -0.02, -L * 0.55),
      sightY: def.ads?.scopeOverlay ? 0.065 : 0.045,
      frontZ: -L * 0.68,
      magazine: mag,
    };
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
    const sc = this.gun.scale.x;
    const hip = new THREE.Vector3(0.12, -0.125, -0.37);
    // ADS: muzzle tilted up slightly (cheek weld) so the stock drops out of view;
    // the front sight is placed exactly on the screen centre line.
    const adsTilt = 0.1;
    const fy = this.sightY * sc, fz = this.frontZ * sc;
    const aim = new THREE.Vector3(0, -(fy * Math.cos(adsTilt) - fz * Math.sin(adsTilt)) - 0.004, -0.36);
    const base = hip.lerp(aim, this.adsT);
    const reload = p.reloadProgress > 0 ? Math.sin(Math.min(1, p.reloadProgress) * Math.PI) : 0;
    const equip = 1 - p.equipProgress;
    this.root.position.set(
      base.x + bobX + this.swayX,
      base.y - bobY + this.swayY - reload * 0.04 - equip * 0.3,
      base.z + this.kick * 0.045,
    );
    this.root.rotation.set(this.kick * 0.08 + adsTilt * this.adsT - reload * 0.22 + equip * 0.5, this.swayX * 2 + 0.04 * (1 - this.adsT), reload * 0.45);
    // magazine drops out and comes back during reload
    if (this.magazine && this.magazineRest) {
      const r = p.reloadProgress;
      const out = r <= 0 ? 0 : r < 0.25 ? r / 0.25 : r < 0.6 ? 1 : r < 0.85 ? 1 - (r - 0.6) / 0.25 : 0;
      this.magazine.position.set(this.magazineRest.x, this.magazineRest.y - out * 0.25, this.magazineRest.z + out * 0.05);
      this.magazine.visible = out < 0.95;
    }

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
