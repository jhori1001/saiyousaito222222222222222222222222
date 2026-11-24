import * as THREE from 'three';
import { extrudeSide, metalTexture, sideProfile, tube, woodTexture } from './parts';

export interface WeaponModel {
  group: THREE.Group;
  /** Muzzle position in model space. */
  muzzle: THREE.Vector3;
  /** Where the hands go (model space). */
  rightHand: THREE.Vector3;
  leftHand: THREE.Vector3;
  /** Height of the iron-sight line above the origin (for ADS alignment). */
  sightY: number;
  /** Z of the front sight (ADS alignment). */
  frontZ: number;
  /** Detachable magazine (animated on reload), optional. */
  magazine?: THREE.Object3D;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/**
 * Classic Kalashnikov-pattern assault rifle silhouette (generic real-world layout):
 * stamped receiver, wooden stock / handguards / grip, curved steel magazine,
 * gas tube over the barrel, slanted muzzle brake. Modelled procedurally.
 */
export function buildRifleAK(): WeaponModel {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ map: woodTexture(), color: 0xffffff, roughness: 0.55, metalness: 0.0 });
  const metal = new THREE.MeshStandardMaterial({ map: metalTexture(), color: 0xb8bec6, roughness: 0.5, metalness: 0.2 });
  const blued = new THREE.MeshStandardMaterial({ color: 0x34373d, roughness: 0.4, metalness: 0.25 });
  const add = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D = group) => {
    const me = new THREE.Mesh(g, m);
    parent.add(me);
    return me;
  };

  // ---- receiver (stamped steel)
  add(sideProfile([[-0.175, -0.03], [0.085, -0.03], [0.095, -0.005], [0.095, 0.05], [-0.175, 0.05]], 0.05, 0.003), metal);
  // dust cover: rounded top
  const cover = new THREE.CylinderGeometry(0.023, 0.023, 0.245, 20, 1, false, -Math.PI / 2, Math.PI);
  cover.rotateX(Math.PI / 2);
  cover.translate(0, 0.05, -0.04);
  add(cover, metal);
  // cover ribs
  for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(0.048, 0.004, 0.006).translate(0, 0.072, 0.02 - i * 0.012), blued);
  // rear trunnion / sight block + tangent sight leaf
  add(sideProfile([[-0.2, 0.03], [-0.17, 0.03], [-0.17, 0.078], [-0.19, 0.078]], 0.032, 0.002), blued);
  add(new THREE.BoxGeometry(0.03, 0.008, 0.07).translate(0, 0.082, -0.15), blued);
  add(new THREE.BoxGeometry(0.012, 0.012, 0.01).translate(0, 0.09, -0.12), blued); // rear notch
  // charging handle (right side) + selector lever
  add(tube(V(0.025, 0.035, -0.135), V(0.055, 0.035, -0.135), 0.006, 0.008), blued);
  add(sideProfile([[-0.115, 0.03], [0.045, 0.034], [0.05, 0.022], [-0.11, 0.018]], 0.004, 0).translate(0.027, 0, 0), blued);
  // trigger guard + trigger
  add(sideProfile([[-0.06, -0.03], [-0.055, -0.03], [-0.05, -0.068], [0.04, -0.068], [0.045, -0.03], [0.05, -0.03], [0.05, -0.074], [-0.06, -0.074]], 0.012, 0.001), blued);
  add(sideProfile([[-0.02, -0.03], [-0.01, -0.03], [-0.006, -0.06], [-0.016, -0.062]], 0.007, 0.001), blued);

  // ---- pistol grip (wood)
  add(sideProfile([[0.035, -0.028], [0.08, -0.028], [0.112, -0.135], [0.103, -0.142], [0.064, -0.142]], 0.034, 0.006), wood);

  // ---- stock (wood) with steel buttplate
  add(sideProfile([[0.085, 0.048], [0.36, 0.02], [0.37, 0.015], [0.37, -0.105], [0.355, -0.11], [0.16, -0.045], [0.095, -0.025]], 0.042, 0.007), wood);
  add(sideProfile([[0.368, 0.022], [0.382, 0.02], [0.382, -0.112], [0.368, -0.108]], 0.046, 0.003), blued);

  // ---- barrel, gas tube, handguards
  add(tube(V(0, 0.022, -0.2), V(0, 0.022, -0.64), 0.0115, 0.0095), blued);
  add(tube(V(0, 0.052, -0.2), V(0, 0.052, -0.44), 0.0125), metal);
  // upper handguard (wood around gas tube)
  add(tube(V(0, 0.053, -0.205), V(0, 0.053, -0.36), 0.0175, 0.0165), wood);
  // lower handguard (wood, finger grooves suggested by profile)
  add(sideProfile([[-0.18, 0.04], [-0.375, 0.038], [-0.39, 0.025], [-0.39, -0.005], [-0.37, -0.022], [-0.25, -0.026], [-0.2, -0.03], [-0.18, -0.03]], 0.054, 0.008), wood);
  add(new THREE.BoxGeometry(0.056, 0.064, 0.012).translate(0, 0.006, -0.395), blued); // handguard retainer
  // gas block
  add(sideProfile([[-0.43, 0.068], [-0.46, 0.066], [-0.475, 0.01], [-0.43, 0.012]], 0.03, 0.003), blued);
  // cleaning rod under barrel
  add(tube(V(0, -0.002, -0.4), V(0, -0.002, -0.63), 0.0035), metal);
  // front sight base + post + ears
  add(sideProfile([[-0.585, 0.008], [-0.615, 0.008], [-0.615, 0.06], [-0.6, 0.07], [-0.585, 0.045]], 0.026, 0.002), blued);
  add(new THREE.BoxGeometry(0.003, 0.03, 0.003).translate(0, 0.082, -0.6), blued);
  add(new THREE.BoxGeometry(0.003, 0.03, 0.01).translate(0.012, 0.08, -0.6), blued);
  add(new THREE.BoxGeometry(0.003, 0.03, 0.01).translate(-0.012, 0.08, -0.6), blued);
  // slant muzzle brake
  add(sideProfile([[-0.635, 0.035], [-0.675, 0.037], [-0.685, 0.022], [-0.675, 0.007], [-0.635, 0.009]], 0.028, 0.003), blued);

  // ---- curved magazine
  const mag = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(-0.115, -0.028);
  s.lineTo(-0.04, -0.028);
  s.quadraticCurveTo(-0.045, -0.17, -0.115, -0.275);
  s.lineTo(-0.19, -0.252);
  s.quadraticCurveTo(-0.115, -0.15, -0.115, -0.028);
  add(extrudeSide(s, 0.032, 0.004), metal, mag);
  // magazine ribs
  for (let i = 0; i < 4; i++) {
    const t = 0.25 + i * 0.17;
    const x = -0.075 - t * 0.07 - t * t * 0.02;
    const y = -0.05 - t * 0.2;
    add(new THREE.BoxGeometry(0.036, 0.006, 0.045).rotateX(-0.25 - t * 0.6).translate(0, y, x - 0.02), blued, mag);
  }
  group.add(mag);

  return {
    group,
    muzzle: V(0, 0.022, -0.69),
    rightHand: V(0.0, -0.06, 0.07),
    leftHand: V(0.0, -0.005, -0.3),
    sightY: 0.092,
    frontZ: -0.6,
    magazine: mag,
  };
}
