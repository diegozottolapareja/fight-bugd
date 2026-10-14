import * as THREE from 'three';
import { ARENA_CONFIG } from '../game/GameConfig';
import { buildSurfaceMesh, gapCenters, lipSegments, surfaceHeight } from '../game/Arena';
import type { BattleController, BattleEvent } from '../game/BattleController';
import { createSpinnerModel, type SpinnerModel } from '../characters/placeholderModels';
import type { CharacterDefinition } from '../characters/characterDefinitions';
import { CameraController } from './CameraController';
import { Aura, BurstPieces, Shockwaves, Sparks, Trail } from './Effects';

export const PLAYER_COLORS = ['#ff5a4e', '#2fc0ff'] as const;

export const ABILITY_COLORS: Record<string, string> = {
  fireCharge: '#ff6a00',
  stoneShield: '#d9c49a',
  lightningSpeed: '#fff04d',
  whirlwind: '#5ff5e6',
  heavyImpact: '#9cff5a',
  recovery: '#c9a8ff',
};

interface SpinnerView {
  def: CharacterDefinition;
  model: SpinnerModel;
  marker: THREE.Group;
  label: THREE.Sprite;
  aura: Aura;
  trail: Trail;
  ki: THREE.Sprite;
  kiFrames: THREE.Texture[];
  kiOn: number;
  kiPop: number;
  ghosts: THREE.Sprite[];
  hist: THREE.Vector3[];
  swirl: THREE.Mesh;
  hit: number;
  fall: number;
  pivot: number;
  burstDone: boolean;
}

/** Todo lo de Three.js. Lee el estado de la simulación; nunca lo modifica. */
export class SceneRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly cam = new CameraController();
  private views: SpinnerView[] = [];
  private sparks = new Sparks();
  private waves = new Shockwaves();
  private pieces = new BurstPieces();
  private readonly mobile = window.matchMedia('(pointer: coarse)').matches;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.mobile, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.mobile ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = this.mobile ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = new THREE.Color('#0b1240');
    this.scene.fog = new THREE.Fog('#0b1240', 90, 180);
    this.buildLights();
    this.buildArena();
    this.scene.add(this.sparks.points, this.waves.group, this.pieces.group);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private buildLights(): void {
    this.scene.add(new THREE.HemisphereLight('#bcd2ff', '#2a1d4a', 1.3));
    const sun = new THREE.DirectionalLight('#fff3dc', 2.4);
    sun.position.set(5, 14, 7);
    sun.castShadow = true;
    const size = this.mobile ? 512 : 1024;
    sun.shadow.mapSize.set(size, size);
    const c = sun.shadow.camera as THREE.OrthographicCamera;
    c.left = c.bottom = -9;
    c.right = c.top = 9;
    c.near = 1;
    c.far = 40;
    sun.shadow.bias = -0.0015;
    this.scene.add(sun);
    const rimA = new THREE.PointLight('#ff6a3d', 30, 30);
    rimA.position.set(-9, 5, -6);
    const rimB = new THREE.PointLight('#38c6ff', 30, 30);
    rimB.position.set(9, 5, -6);
    this.scene.add(rimA, rimB);
  }

  private buildArena(): void {
    const a = ARENA_CONFIG;
    const m = buildSurfaceMesh(a, 24, 96);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(m.vertices, 3));
    geo.setIndex(new THREE.BufferAttribute(m.indices, 1));
    const colors = new Float32Array(m.vertices.length);
    const cA = new THREE.Color('#2b3ea8'), cB = new THREE.Color('#3550c9');
    const cCenter = new THREE.Color('#ffc93c'), cLedge = new THREE.Color('#1a2370');
    for (let i = 0; i < m.vertices.length / 3; i++) {
      const r = Math.hypot(m.vertices[i * 3], m.vertices[i * 3 + 2]);
      const c = r < 0.9 ? cCenter : r > a.radius + 0.01 ? cLedge : Math.floor(r) % 2 ? cA : cB;
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const floor = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.1 }));
    floor.receiveShadow = true;
    this.scene.add(floor);

    const segs = lipSegments(a);
    const lip = new THREE.InstancedMesh(
      new THREE.BoxGeometry(a.lipThickness, a.lipHeight, 1),
      new THREE.MeshStandardMaterial({ color: '#ffc93c', roughness: 0.4, metalness: 0.2 }),
      segs.length,
    );
    const rMid = a.radius + a.lipThickness / 2;
    const tmp = new THREE.Object3D();
    segs.forEach((s, i) => {
      tmp.position.set(Math.cos(s.angle) * rMid, surfaceHeight(a.radius) + a.lipHeight / 2, Math.sin(s.angle) * rMid);
      tmp.rotation.set(0, -s.angle, 0);
      tmp.scale.set(1, 1, s.length);
      tmp.updateMatrix();
      lip.setMatrixAt(i, tmp.matrix);
    });
    lip.castShadow = lip.receiveShadow = true;
    this.scene.add(lip);

    const postGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.8, 12);
    const red = new THREE.MeshStandardMaterial({ color: '#ff3b3b', emissive: '#7a0000', emissiveIntensity: 0.4 });
    for (const g of gapCenters(a)) {
      for (const side of [-1, 1]) {
        const ang = g + (side * a.gapAngle) / 2;
        const post = new THREE.Mesh(postGeo, red);
        post.position.set(Math.cos(ang) * rMid, surfaceHeight(a.radius) + 0.4, Math.sin(ang) * rMid);
        post.castShadow = true;
        this.scene.add(post);
      }
    }
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(a.radius + a.ledgeWidth + 0.05, a.radius + 1.8, 2.2, 64, 1, true),
      new THREE.MeshStandardMaterial({ color: '#141c5c', roughness: 0.8, side: THREE.DoubleSide }),
    );
    base.position.y = a.depth - 1.35;
    this.scene.add(base);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.MeshStandardMaterial({ color: '#0e1650', roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2.4;
    ground.receiveShadow = true;
    this.scene.add(ground);
    ['#ff5a4e', '#ffc93c', '#2fc0ff'].forEach((color, i) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(11 + i * 2.2, 0.5, 6, 64), new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -1.6 + i * 1.3;
      this.scene.add(ring);
    });
  }

  resize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.cam.resize(window.innerWidth, window.innerHeight);
  }

  private makeLabel(text: string, color: string): THREE.Sprite {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const g = c.getContext('2d')!;
    g.fillStyle = color;
    g.beginPath();
    g.roundRect(28, 18, 200, 84, 30);
    g.fill();
    g.beginPath();
    g.moveTo(108, 100);
    g.lineTo(128, 124);
    g.lineTo(148, 100);
    g.fill();
    g.font = '900 64px "Lilita One", "Arial Rounded MT Bold", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#1b1030';
    g.fillText(text, 128, 62);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
    s.scale.set(1.3, 0.65, 1);
    s.renderOrder = 100;
    return s;
  }

  /** Marca en el piso: J1 anillo con flechas, J2 anillo punteado (no sólo color). */
  private makeMarker(player: 0 | 1): THREE.Group {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: PLAYER_COLORS[player], transparent: true, opacity: 0.85, depthWrite: false });
    if (player === 0) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.35, 40), mat);
      ring.rotation.x = -Math.PI / 2;
      g.add(ring);
      for (let i = 0; i < 3; i++) {
        const tri = new THREE.Mesh(new THREE.CircleGeometry(0.28, 3), mat);
        const a = (i / 3) * Math.PI * 2;
        tri.rotation.set(-Math.PI / 2, 0, a);
        tri.position.set(Math.cos(a) * 1.6, 0, Math.sin(a) * 1.6);
        g.add(tri);
      }
    } else {
      for (let i = 0; i < 12; i++) {
        const dash = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.4, 6, 1, (i / 12) * Math.PI * 2, Math.PI / 9), mat);
        dash.rotation.x = -Math.PI / 2;
        g.add(dash);
      }
    }
    return g;
  }

  setBattle(defs: [CharacterDefinition, CharacterDefinition], labels: [string, string] | null): void {
    this.clearBattle();
    defs.forEach((def, i) => {
      const model = createSpinnerModel(def);
      const marker = this.makeMarker(i as 0 | 1);
      marker.scale.setScalar(def.visual.radius);
      const label = this.makeLabel(labels ? labels[i] : '', PLAYER_COLORS[i]);
      label.visible = !!labels;
      const aura = new Aura('#ffffff');
      const trail = new Trail(PLAYER_COLORS[i]);
      const kiFrames = makeKiFrames(ABILITY_COLORS[def.ability]);
      const ki = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: kiFrames[0], transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }),
      );
      ki.visible = false;
      model.root.add(ki);
      const ghosts = [0, 1, 2].map(() => {
        const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: model.sprite.material.map, transparent: true, depthTest: false, opacity: 0 }));
        this.scene.add(g);
        return g;
      });
      const swirl = new THREE.Mesh(
        new THREE.CircleGeometry(def.visual.radius * 1.75, 40),
        new THREE.MeshBasicMaterial({ map: swirlTexture(PLAYER_COLORS[i]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }),
      );
      swirl.rotation.x = -Math.PI / 2;
      swirl.position.y = -def.visual.radius * 0.5;
      model.spin.add(swirl);
      this.scene.add(model.root, marker, label, aura.mesh, trail.group);
      this.views.push({ def, model, marker, label, aura, trail, ki, kiFrames, kiOn: 0, kiPop: 0, ghosts, hist: [], swirl, hit: 0, fall: 0, pivot: 0, burstDone: false });
    });
  }

  clearBattle(): void {
    for (const v of this.views) {
      this.scene.remove(v.model.root, v.marker, v.label, v.aura.mesh, v.trail.group);
      v.kiFrames.forEach((t) => t.dispose());
      v.ki.material.dispose();
      v.ghosts.forEach((g) => {
        this.scene.remove(g);
        g.material.dispose();
      });
      v.model.dispose();
    }
    this.views = [];
    this.pieces.clear();
    this.sparks.clear();
  }

  onBattleEvent(e: BattleEvent, battle: BattleController): void {
    if (e.type === 'hit') {
      for (const v of this.views) v.hit = 0.22;
      const strength = Math.min(1, e.intensity / 9);
      this.sparks.burst(e.x, e.y + 0.2, e.z, Math.round(8 + strength * 26), new THREE.Color('#ffd27a'), 3 + strength * 4);
      if (strength > 0.6) this.cam.bump(0.03 * strength);
    } else if (e.type === 'special') {
      const s = battle.spinners[e.player];
      const p = s.position;
      const col = ABILITY_COLORS[e.ability];
      const v = this.views[e.player];
      if (v) {
        v.aura.setColor(col);
        v.kiPop = 1;
      }
      this.waves.spawn(p.x, p.y - s.radius, p.z, col, e.ability === 'whirlwind' ? 9 : 3, e.ability === 'whirlwind' ? 0.7 : 0.5);
      this.sparks.burst(p.x, p.y, p.z, 30, new THREE.Color(col), 5);
    } else if (e.type === 'burst') {
      const s = battle.spinners[e.player];
      const v = this.views[e.player];
      const p = s.position;
      v.burstDone = true;
      v.model.root.visible = false;
      this.pieces.spawn(p.x, p.y, p.z, [v.def.visual.color, v.def.visual.accent, '#ffffff'], s.radius);
      this.sparks.burst(p.x, p.y, p.z, 60, new THREE.Color('#ffffff'), 7);
      this.waves.spawn(p.x, p.y - s.radius, p.z, '#ffffff', 5, 0.6);
      this.cam.bump(0.08);
    }
  }

  render(battle: BattleController | null, alpha: number, dt: number, showLabels: boolean): void {
    const t = performance.now() / 1000;
    if (battle) {
      battle.spinners.forEach((s, i) => {
        const v = this.views[i];
        if (!v) return;
        const cur = s.position;
        const x = s.prevPos.x + (cur.x - s.prevPos.x) * alpha;
        const y = s.prevPos.y + (cur.y - s.prevPos.y) * alpha;
        const z = s.prevPos.z + (cur.z - s.prevPos.z) * alpha;
        v.model.root.position.set(x, y, z);
        v.model.spin.rotation.y = -s.spinAngle;
        v.model.tilt.rotation.set(Math.cos(s.precess) * s.tilt, 0, Math.sin(s.precess) * s.tilt);

        // Monstruito 2D: bamboleo, aplastado al chocar y caída al perder.
        const res = battle.result;
        const lost = s.fallen || (!!res && res.loser === i && res.type !== 'ringout');
        v.fall += ((lost ? 1 : 0) - v.fall) * Math.min(1, dt * 4);
        v.hit = Math.max(0, v.hit - dt);
        const k = v.hit / 0.22;
        const S = v.model.spriteSize;
        const sprite = v.model.sprite;
        const sm = sprite.material as THREE.SpriteMaterial;
        sm.rotation = Math.sin(s.precess) * s.tilt * 1.3 + v.fall * 1.5 * (i === 0 ? 1 : -1);
        // Pivoteo: cuanto más rápido gira el trompo, más rápido "se da vuelta" el monstruito
        // sobre su lugar (se angosta y se ensancha), se balancea y rebota.
        const alive = lost || v.burstDone ? 0 : s.energyRatio;
        v.pivot += dt * (1.5 + 20 * alive * alive);
        const turn = THREE.MathUtils.lerp(1, Math.cos(v.pivot), 0.65 * alive);
        const wobble = Math.sin(v.pivot * 2) * 0.22 * alive;
        const bob = Math.abs(Math.sin(v.pivot)) * S * 0.07 * alive;
        sprite.scale.set(S * (1 + 0.2 * k) * turn, S * (1 - 0.16 * k) * (1 + 0.06 * alive * Math.abs(Math.sin(v.pivot))), 1);
        sprite.position.y = v.model.spriteBaseY - v.fall * S * 0.3 + bob;
        sprite.renderOrder = 20 + z;

        // Sensación de velocidad: inclinación, vibración, remolino y estela.
        const vel = s.velocity;
        const moveSpeed = Math.hypot(vel.x, vel.z);
        const spinK = lost || v.burstDone ? 0 : s.energyRatio;
        sm.rotation += wobble + THREE.MathUtils.clamp(-vel.x * 0.06, -0.35, 0.35) + Math.sin(t * 90) * 0.05 * spinK;
        (v.swirl.material as THREE.MeshBasicMaterial).opacity = 0.15 + 0.7 * spinK;
        v.hist.unshift(new THREE.Vector3(x, y + sprite.position.y, z));
        if (v.hist.length > 13) v.hist.pop();
        const ghostK = THREE.MathUtils.clamp((moveSpeed - 1.2) / 4, 0, 1) * (v.burstDone || lost ? 0 : 1);
        v.ghosts.forEach((g, gi) => {
          const gm = g.material as THREE.SpriteMaterial;
          gm.opacity = ghostK * (0.45 - gi * 0.13);
          g.visible = gm.opacity > 0.02;
          g.position.copy(v.hist[Math.min(v.hist.length - 1, (gi + 1) * 4)]);
          g.scale.copy(sprite.scale).multiplyScalar(1 - gi * 0.06);
          gm.rotation = sm.rotation;
          g.renderOrder = sprite.renderOrder - 1 - gi * 0.1;
        });

        // Aura de ki (estilo Dragon Ball) mientras el poder está activo.
        const kiActive = s.abilities.active && !v.burstDone && !lost;
        v.kiOn += ((kiActive ? 1 : 0) - v.kiOn) * Math.min(1, dt * (kiActive ? 10 : 3));
        v.kiPop = Math.max(0, v.kiPop - dt * 2.5);
        v.ki.visible = v.kiOn > 0.02;
        if (v.ki.visible) {
          const km = v.ki.material as THREE.SpriteMaterial;
          km.map = v.kiFrames[Math.floor(t * 14) % v.kiFrames.length];
          km.opacity = Math.min(1, v.kiOn * (0.9 + 0.2 * Math.sin(t * 31)));
          const ks = S * (2.3 + 0.15 * Math.sin(t * 13) + v.kiPop * 0.8);
          v.ki.scale.set(ks, ks * 1.25, 1);
          v.ki.position.set(0, v.model.spriteBaseY + S * 0.3, 0);
          v.ki.renderOrder = sprite.renderOrder - 0.5;
          sprite.position.x = Math.sin(t * 70) * 0.035 * v.kiOn;
          sprite.scale.multiplyScalar(1 + 0.08 * v.kiOn + 0.25 * v.kiPop);
          if (Math.random() < dt * 45) {
            this.sparks.burst(x + (Math.random() - 0.5) * S * 0.6, y + v.model.spriteBaseY + S * 0.4, z, 2, new THREE.Color(ABILITY_COLORS[s.def.ability]), 3);
          }
        } else {
          sprite.position.x = 0;
        }

        const r = Math.hypot(x, z);
        v.marker.position.set(x, surfaceHeight(r) + 0.03, z);
        v.marker.rotation.y += dt * 1.5;
        v.marker.visible = !v.burstDone && r < ARENA_CONFIG.radius + 0.5;
        v.label.position.set(x, y + v.model.spriteBaseY + S * 0.55 + 0.3, z);
        v.label.visible = showLabels && !v.burstDone;
        v.aura.update(dt, s.abilities.active && !v.burstDone, x, y, z, s.radius);
        v.trail.update(dt, x, y, z, s.radius, moveSpeed, !v.burstDone);
      });
    }
    this.sparks.update(dt);
    this.waves.update(dt);
    this.pieces.update(dt, (x, z) => surfaceHeight(Math.hypot(x, z)));
    this.cam.update(dt);
    this.renderer.render(this.scene, this.cam.camera);
  }
}

/** Cuadros de un aura con llamas que suben. */
function makeKiFrames(color: string, count = 4): THREE.Texture[] {
  const col = new THREE.Color(color);
  const rgba = (a: number) => `rgba(${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)},${a})`;
  return Array.from({ length: count }, () => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    g.globalCompositeOperation = 'lighter';
    const glow = g.createRadialGradient(128, 160, 10, 128, 150, 110);
    glow.addColorStop(0, 'rgba(255,255,255,0.55)');
    glow.addColorStop(0.35, rgba(0.65));
    glow.addColorStop(1, rgba(0));
    g.fillStyle = glow;
    g.beginPath();
    g.ellipse(128, 150, 95, 105, 0, 0, Math.PI * 2);
    g.fill();
    for (let i = 0; i < 34; i++) {
      const x = 128 + (Math.random() - 0.5) * 150;
      const y = 215 - Math.random() * 40;
      const h = 100 + Math.random() * 130 - Math.abs(x - 128) * 0.4;
      const w = 14 + Math.random() * 24;
      const tipX = x + (Math.random() - 0.5) * 30;
      const grad = g.createLinearGradient(0, y, 0, y - h);
      grad.addColorStop(0, rgba(0));
      grad.addColorStop(0.2, rgba(0.85));
      grad.addColorStop(0.55, 'rgba(255,255,255,0.5)');
      grad.addColorStop(1, rgba(0));
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(x - w, y);
      g.quadraticCurveTo(x - w * 0.8, y - h * 0.55, tipX, y - h);
      g.quadraticCurveTo(x + w * 0.8, y - h * 0.55, x + w, y);
      g.closePath();
      g.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
}

/** Arcos tipo cometa que, al girar rápido, se ven como un remolino. */
function swirlTexture(color: string): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    const a0 = (k / 3) * Math.PI * 2;
    for (let i = 0; i < 24; i++) {
      const tt = i / 24;
      g.strokeStyle = i > 20 ? 'rgba(255,255,255,0.95)' : color;
      g.globalAlpha = tt * 0.9;
      g.lineWidth = 4 + tt * 12;
      g.beginPath();
      g.arc(128, 128, 100 - k * 6, a0 + tt * 1.6, a0 + tt * 1.6 + 0.09);
      g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
