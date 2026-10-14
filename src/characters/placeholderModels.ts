import * as THREE from 'three';
import type { CharacterDefinition } from './characterDefinitions';

/** Trompo = base 3D que gira + monstruito 2D (sprite) parado encima. */
export interface SpinnerModel {
  root: THREE.Group;
  tilt: THREE.Group;
  spin: THREE.Group;
  sprite: THREE.Sprite;
  spriteSize: number;
  spriteBaseY: number;
  materials: THREE.MeshStandardMaterial[];
  dispose(): void;
}

function stripes(color: string, accent: string): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 8; i++) {
    g.beginPath();
    g.moveTo(64, 64);
    g.arc(64, 64, 64, (i / 8) * Math.PI * 2, ((i + 1) / 8) * Math.PI * 2);
    g.fillStyle = i % 2 ? color : i % 4 === 0 ? accent : '#ffffff';
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createSpinnerModel(def: CharacterDefinition): SpinnerModel {
  const r = def.visual.radius;
  const root = new THREE.Group();
  const tilt = new THREE.Group();
  const spin = new THREE.Group();
  root.add(tilt);
  tilt.add(spin);
  const ringMat = new THREE.MeshStandardMaterial({ map: stripes(def.visual.color, def.visual.accent), roughness: 0.4, metalness: 0.3 });
  const sideMat = new THREE.MeshStandardMaterial({ color: def.visual.color, roughness: 0.4, metalness: 0.4 });
  const metal = new THREE.MeshStandardMaterial({ color: '#c8ccd6', roughness: 0.25, metalness: 0.9 });
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.55, r * 0.3, 28), [sideMat, ringMat, sideMat]);
  ring.position.y = -r * 0.62;
  ring.castShadow = true;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(r * 0.2, r * 0.3, 12), metal);
  tip.rotation.x = Math.PI;
  tip.position.y = -r * 0.88;
  tip.castShadow = true;
  spin.add(ring, tip);

  const tex = new THREE.TextureLoader().load(def.visual.sprite);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  const size = r * 2.6;
  sprite.scale.set(size, size, 1);
  const baseY = -r * 0.5 + size * 0.5;
  sprite.position.y = baseY;
  root.add(sprite);

  return {
    root, tilt, spin, sprite, spriteSize: size, spriteBaseY: baseY,
    materials: [sideMat, ringMat],
    dispose() {
      root.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          for (const m of [o.material].flat() as THREE.MeshStandardMaterial[]) {
            m.map?.dispose();
            m.dispose();
          }
        }
      });
      tex.dispose();
      sprite.material.dispose();
    },
  };
}
