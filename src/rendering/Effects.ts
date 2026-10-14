import * as THREE from 'three';

const MAX = 260;

/** Chispas de impacto (un único Points reutilizado). */
export class Sparks {
  readonly points: THREE.Points;
  private pos = new Float32Array(MAX * 3);
  private col = new Float32Array(MAX * 3);
  private vel = new Float32Array(MAX * 3);
  private life = new Float32Array(MAX);
  private next = 0;

  constructor() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(
      g,
      new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.points.frustumCulled = false;
    this.clear();
  }

  burst(x: number, y: number, z: number, count: number, color: THREE.Color, speed = 4): void {
    for (let k = 0; k < count; k++) {
      const i = this.next;
      this.next = (this.next + 1) % MAX;
      const a = Math.random() * Math.PI * 2;
      const up = 0.3 + Math.random() * 0.9;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.pos.set([x, y, z], i * 3);
      this.vel.set([Math.cos(a) * s, up * s, Math.sin(a) * s], i * 3);
      const c = color.clone().offsetHSL((Math.random() - 0.5) * 0.08, 0, (Math.random() - 0.3) * 0.2);
      this.col.set([c.r, c.g, c.b], i * 3);
      this.life[i] = 0.35 + Math.random() * 0.35;
    }
  }

  update(dt: number): void {
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const o = i * 3;
      this.vel[o + 1] -= 14 * dt;
      this.pos[o] += this.vel[o] * dt;
      this.pos[o + 1] += this.vel[o + 1] * dt;
      this.pos[o + 2] += this.vel[o + 2] * dt;
      if (this.life[i] <= 0) this.pos[o + 1] = -100;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }

  clear(): void {
    this.life.fill(0);
    for (let i = 0; i < MAX; i++) this.pos[i * 3 + 1] = -100;
  }
}

/** Anillo de energía alrededor de un trompo con poder activo. */
export class Aura {
  readonly mesh: THREE.Mesh;
  private t = 0;

  constructor(color: string) {
    this.mesh = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.06, 8, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.mesh.rotation.x = Math.PI / 2;
  }

  update(dt: number, active: boolean, x: number, y: number, z: number, r: number): void {
    this.t += dt;
    const m = this.mesh.material as THREE.MeshBasicMaterial;
    m.opacity += ((active ? 0.85 : 0) - m.opacity) * Math.min(1, dt * 8);
    const s = r * (1.5 + 0.12 * Math.sin(this.t * 10));
    this.mesh.scale.set(s, s, s);
    this.mesh.position.set(x, y - r * 0.3, z);
    this.mesh.visible = m.opacity > 0.02;
  }

  setColor(color: string): void {
    (this.mesh.material as THREE.MeshBasicMaterial).color.set(color);
  }
}

/** Onda expansiva. */
export class Shockwaves {
  readonly group = new THREE.Group();
  private waves: Array<{ mesh: THREE.Mesh; t: number; dur: number; max: number }> = [];

  spawn(x: number, y: number, z: number, color: string, max = 4, dur = 0.6): void {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y + 0.05, z);
    this.group.add(mesh);
    this.waves.push({ mesh, t: 0, dur, max });
  }

  update(dt: number): void {
    for (const w of this.waves) {
      w.t += dt;
      const k = w.t / w.dur;
      w.mesh.scale.setScalar(0.3 + k * w.max);
      (w.mesh.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - k);
    }
    for (const w of this.waves.filter((w) => w.t >= w.dur)) {
      this.group.remove(w.mesh);
      w.mesh.geometry.dispose();
      (w.mesh.material as THREE.Material).dispose();
    }
    this.waves = this.waves.filter((w) => w.t < w.dur);
  }
}

/** Piezas que salen volando en un BURST. */
export class BurstPieces {
  readonly group = new THREE.Group();
  private pieces: Array<{ mesh: THREE.Mesh; v: THREE.Vector3; w: THREE.Vector3 }> = [];

  spawn(x: number, y: number, z: number, colors: string[], r: number): void {
    for (let i = 0; i < 9; i++) {
      const geo = i % 3 === 0 ? new THREE.TetrahedronGeometry(r * 0.35) : new THREE.BoxGeometry(r * 0.5, r * 0.12, r * 0.3);
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.5 }));
      mesh.castShadow = true;
      mesh.position.set(x, y, z);
      const a = (i / 9) * Math.PI * 2 + Math.random() * 0.4;
      const s = 3 + Math.random() * 3;
      this.group.add(mesh);
      this.pieces.push({
        mesh,
        v: new THREE.Vector3(Math.cos(a) * s, 4 + Math.random() * 4, Math.sin(a) * s),
        w: new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10),
      });
    }
  }

  update(dt: number, floorAt: (x: number, z: number) => number): void {
    for (const p of this.pieces) {
      p.v.y -= 18 * dt;
      p.mesh.position.addScaledVector(p.v, dt);
      const f = floorAt(p.mesh.position.x, p.mesh.position.z) + 0.05;
      if (p.mesh.position.y < f && Math.hypot(p.mesh.position.x, p.mesh.position.z) < 7) {
        p.mesh.position.y = f;
        p.v.set(p.v.x * 0.7, -p.v.y * 0.35, p.v.z * 0.7);
        p.w.multiplyScalar(0.7);
      }
      p.mesh.rotation.x += p.w.x * dt;
      p.mesh.rotation.y += p.w.y * dt;
      p.mesh.rotation.z += p.w.z * dt;
    }
  }

  clear(): void {
    for (const p of this.pieces) {
      this.group.remove(p.mesh);
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
    }
    this.pieces = [];
  }
}

/** Estela de discos en el piso. */
export class Trail {
  readonly group = new THREE.Group();
  private discs: THREE.Mesh[] = [];
  private i = 0;
  private acc = 0;

  constructor(color: string, count = 10) {
    for (let k = 0; k < count; k++) {
      const m = new THREE.Mesh(
        new THREE.CircleGeometry(1, 20),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
      );
      m.rotation.x = -Math.PI / 2;
      this.group.add(m);
      this.discs.push(m);
    }
  }

  update(dt: number, x: number, y: number, z: number, r: number, speed: number, visible: boolean): void {
    this.acc += dt;
    if (visible && speed > 2.5 && this.acc > 0.03) {
      this.acc = 0;
      const d = this.discs[this.i];
      this.i = (this.i + 1) % this.discs.length;
      d.position.set(x, y - r * 0.85, z);
      d.scale.setScalar(r * 0.9);
      (d.material as THREE.MeshBasicMaterial).opacity = Math.min(0.45, speed / 16);
    }
    for (const d of this.discs) {
      const m = d.material as THREE.MeshBasicMaterial;
      m.opacity = Math.max(0, m.opacity - dt * 1.4);
      d.visible = m.opacity > 0.01;
    }
  }
}
