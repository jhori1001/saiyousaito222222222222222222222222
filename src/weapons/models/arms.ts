import * as THREE from 'three';
import { limbMeshes } from './parts';

/**
 * First-person arms: bare forearms with dark fingerless tactical gloves.
 * Hands are placed at the weapon's grip points (model space); forearms run back
 * toward the camera.
 */
export function buildArms(right: THREE.Vector3, left: THREE.Vector3, pistol = false): THREE.Group {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9a07c, roughness: 0.6 });
  const glove = new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.85 });
  const gloveTrim = new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.8 });
  const add = (meshes: THREE.Mesh | THREE.Mesh[]) => ([] as THREE.Mesh[]).concat(meshes).forEach((m) => g.add(m));
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

  // ---------- right hand (on pistol grip) ----------
  {
    const h = right;
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.085, 0.07), glove);
    palm.geometry.translate(0, 0, 0);
    palm.position.copy(h).add(V(0.01, -0.035, 0.015));
    palm.rotation.x = -0.25;
    add(palm);
    // fingers wrap around the front of the grip
    for (let i = 0; i < 4; i++) {
      const y = h.y - 0.008 - i * 0.021;
      const a = V(0.03, y, h.z + 0.0);
      const b = V(-0.022, y - 0.004, h.z - 0.03 + i * 0.004);
      add(limbMeshes(a, b, 0.0105, 0.0095, glove));
    }
    // trigger finger resting along the frame
    add(limbMeshes(V(0.028, h.y + 0.02, h.z - 0.02), V(0.026, h.y + 0.018, h.z - 0.075), 0.0095, 0.009, glove));
    // thumb over the top-left
    add(limbMeshes(V(-0.018, h.y + 0.02, h.z + 0.03), V(-0.03, h.y + 0.04, h.z - 0.03), 0.011, 0.0095, glove));
    // wrist cuff + forearm
    const wrist = V(h.x + 0.03, h.y - 0.07, h.z + 0.07);
    add(limbMeshes(wrist, V(h.x + 0.035, h.y - 0.085, h.z + 0.095), 0.034, 0.035, gloveTrim));
    add(limbMeshes(V(h.x + 0.04, h.y - 0.095, h.z + 0.1), V(h.x + 0.14, h.y - 0.26, h.z + 0.42), 0.036, 0.046, skin));
  }

  // ---------- left hand (on handguard, or supporting under the right hand) ----------
  {
    const h = left;
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.07, 0.085), glove);
    palm.position.copy(h).add(V(-0.04, -0.025, 0));
    palm.rotation.z = -0.25;
    add(palm);
    // fingers curl up the right side of the handguard
    for (let i = 0; i < 4; i++) {
      const z = h.z - 0.03 + i * 0.021;
      add(limbMeshes(V(-0.035, h.y - 0.045, z), V(0.02, h.y - 0.035, z - 0.004), 0.0105, 0.0095, glove));
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.0098, 10, 8), skin);
      tip.position.set(0.034, h.y - 0.02, z - 0.004);
      add(tip);
      add(limbMeshes(V(0.02, h.y - 0.035, z - 0.004), V(0.032, h.y - 0.02, z - 0.004), 0.0095, 0.009, skin));
    }
    // thumb along the left side
    add(limbMeshes(V(-0.04, h.y - 0.01, h.z + 0.03), V(-0.032, h.y + 0.022, h.z - 0.03), 0.011, 0.0095, glove));
    const wrist = V(h.x - 0.055, h.y - 0.06, h.z + 0.05);
    add(limbMeshes(wrist, V(h.x - 0.07, h.y - 0.075, h.z + 0.08), 0.033, 0.034, gloveTrim));
    const elbow = pistol ? V(h.x - 0.2, h.y - 0.25, h.z + 0.35) : V(h.x - 0.24, h.y - 0.24, h.z + 0.46);
    add(limbMeshes(V(h.x - 0.075, h.y - 0.08, h.z + 0.085), elbow, 0.035, 0.046, skin));
  }
  return g;
}
