import type { AbilityId, CharacterDefinition } from '../characters/characterDefinitions';
import { physicalMass, statFactor } from '../characters/characterDefinitions';
import { TurnInputController } from '../input/TurnInputController';
import { resolveCollision, shouldBurst, type CombatantSnapshot } from './CollisionSystem';
import { CpuController, type CpuDifficulty } from './CpuController';
import { BATTLE_CONFIG, COLLISION_CONFIG, LAUNCH_CONFIG, PHYSICS_CONFIG, TOP_CONFIG, TURN_CONFIG } from './GameConfig';
import { PhysicsWorld, initPhysics } from './PhysicsWorld';
import { Spinner } from './Spinner';
import type { PressResult } from './SpinnerController';
import { checkVictory, type VictoryResult } from './VictorySystem';

export type BattleMode = 'cpu' | 'versus' | 'turns';

export interface BattleSetup {
  characters: [CharacterDefinition, CharacterDefinition];
  mode: BattleMode;
  seed?: number;
  cpuDifficulty?: CpuDifficulty;
  maxBattleMs?: number;
}

export type BattleEvent =
  | { type: 'hit'; x: number; y: number; z: number; intensity: number }
  | { type: 'special'; player: 0 | 1; ability: AbilityId; name: string; character: string }
  | { type: 'burst'; player: 0 | 1 }
  | { type: 'fall'; player: 0 | 1 }
  | { type: 'turn'; player: 0 | 1 }
  | { type: 'end'; result: VictoryResult };

const DT_MS = PHYSICS_CONFIG.timestep * 1000;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export class BattleController {
  physics!: PhysicsWorld;
  spinners!: [Spinner, Spinner];
  turns: TurnInputController | null = null;
  cpu: CpuController | null = null;
  timeMs = 0;
  result: VictoryResult | null = null;
  started = false;
  private accumulator = 0;
  private listeners: Array<(e: BattleEvent) => void> = [];
  private readonly maxBattleMs: number;

  private constructor(readonly setup: BattleSetup) {
    this.maxBattleMs = setup.maxBattleMs ?? BATTLE_CONFIG.maxBattleMs;
    this.build();
  }

  static async create(setup: BattleSetup): Promise<BattleController> {
    await initPhysics();
    return new BattleController(setup);
  }

  private build(): void {
    const seed = this.setup.seed ?? 1;
    this.physics = new PhysicsWorld();
    const d = PHYSICS_CONFIG.startRadius;
    const mk = (i: 0 | 1, x: number) => {
      const def = this.setup.characters[i];
      const body = this.physics.createSpinner({ x, z: 0, radius: def.visual.radius, mass: physicalMass(def.stats) });
      return new Spinner(i, def, body, i * 2.3 + (seed % 7) * 0.37);
    };
    this.spinners = [mk(0, -d), mk(1, d)];
    this.timeMs = 0;
    this.accumulator = 0;
    this.result = null;
    this.started = false;
    this.turns = this.setup.mode === 'turns' ? new TurnInputController(TURN_CONFIG) : null;
    this.turns?.onTurnChange((player) => this.emit({ type: 'turn', player }));
    this.cpu = this.setup.mode === 'cpu' ? new CpuController(seed * 7919 + 13, this.setup.cpuDifficulty ?? 'normal') : null;
  }

  reset(): void {
    this.physics.dispose();
    this.build();
  }

  dispose(): void {
    this.physics.dispose();
    this.listeners = [];
  }

  on(l: (e: BattleEvent) => void): void {
    this.listeners.push(l);
  }

  private emit(e: BattleEvent): void {
    for (const l of this.listeners) l(e);
  }

  /** Lanzamiento: la potencia (0..1) define el giro inicial y el impulso. Lo demás es automático. */
  launch(powers: [number, number]): void {
    const L = LAUNCH_CONFIG;
    this.spinners.forEach((s, i) => {
      const p = L.minPower + (1 - L.minPower) * clamp01(powers[i]);
      s.launchPower = p;
      s.ctrl.energy.value = L.minEnergy + (L.maxEnergy - L.minEnergy) * p;
      const pos = s.position;
      const r = Math.hypot(pos.x, pos.z) || 1;
      const tx = -pos.z / r, tz = pos.x / r;
      const ix = -pos.x / r, iz = -pos.z / r;
      const sp = (L.minSpeed + (L.maxSpeed - L.minSpeed) * p) * statFactor(s.def.stats.speed, 0.25);
      const a = L.inwardAngle;
      s.body.setLinvel({ x: (tx * Math.cos(a) + ix * Math.sin(a)) * sp, y: 0, z: (tz * Math.cos(a) + iz * Math.sin(a)) * sp }, true);
      s.tilt = L.launchTilt;
      s.precess = i * Math.PI;
    });
    this.started = true;
  }

  canPress(player: 0 | 1): boolean {
    if (this.result || !this.started) return false;
    if (this.setup.mode === 'cpu' && player === 1) return false;
    if (this.turns) return this.turns.canInput(player);
    return !this.spinners[player].fallen;
  }

  press(player: 0 | 1): PressResult {
    if (!this.canPress(player)) return { accepted: false, special: false, gained: 0 };
    return this.applyPress(player, this.timeMs);
  }

  private applyPress(player: 0 | 1, atMs: number): PressResult {
    const s = this.spinners[player];
    if (s.fallen) return { accepted: false, special: false, gained: 0 };
    const r = s.ctrl.press(atMs, this.spinners[player === 0 ? 1 : 0].energy);
    if (r.special) this.activateSpecial(s);
    return r;
  }

  private activateSpecial(s: Spinner): void {
    const action = s.abilities.activate();
    const o = this.spinners[s.index === 0 ? 1 : 0];
    const p = s.position, op = o.position;
    const dx = op.x - p.x, dz = op.z - p.z;
    const dist = Math.hypot(dx, dz) || 1;
    if (action.kind === 'dash') {
      s.body.applyImpulse({ x: (dx / dist) * action.deltaV * s.mass, y: 0, z: (dz / dist) * action.deltaV * s.mass }, true);
    } else if (action.kind === 'push' && dist < action.radius) {
      const k = action.deltaV * (0.4 + 0.6 * (1 - dist / action.radius)) * o.abilities.modifiers().knockbackTakenMult;
      o.body.applyImpulse({ x: (dx / dist) * k * o.mass, y: 0.6 * o.mass, z: (dz / dist) * k * o.mass }, true);
    } else if (action.kind === 'heal') {
      s.ctrl.energy.heal(action.amount);
      s.tilt *= 0.5;
    }
    this.emit({ type: 'special', player: s.index, ability: s.def.ability, name: s.def.abilityName, character: s.def.name });
  }

  advance(dtMs: number): number {
    this.accumulator += Math.min(dtMs, 100);
    while (this.accumulator >= DT_MS) {
      this.step();
      this.accumulator -= DT_MS;
    }
    return this.accumulator / DT_MS;
  }

  step(): void {
    const dt = DT_MS / 1000;
    for (const s of this.spinners) s.prevPos = s.position;
    if (!this.started) return;
    if (!this.result) {
      this.turns?.update(DT_MS);
      if (this.cpu) for (const t of this.cpu.pressesUntil(this.timeMs, this.spinners[1].energy)) this.applyPress(1, t);
      const decayMult = this.turns ? TURN_CONFIG.decayMultiplier : 1;
      for (const s of this.spinners) {
        s.ctrl.combo.tick(DT_MS, !!this.turns && !this.turns.canInput(s.index));
        s.abilities.tick(DT_MS);
        if (!s.fallen) s.ctrl.energy.decay(dt, decayMult, s.abilities.modifiers().stabilityMult);
        s.stress = Math.max(0, s.stress - COLLISION_CONFIG.stressRecoveryPerSecond * dt);
      }
    }
    for (const s of this.spinners) this.applyTopPhysics(s, dt);
    if (!this.result) this.detectCollision();
    this.physics.step();
    for (const s of this.spinners) s.spinAngle += (s.fallen ? 0 : 8 + 40 * s.energyRatio) * dt;
    this.timeMs += DT_MS;
    if (!this.result) this.checkEnd();
  }

  /** Giroscopio simplificado: inclinación, precesión, roce de la punta y caída. */
  private applyTopPhysics(s: Spinner, dt: number): void {
    const T = TOP_CONFIG;
    s.body.resetForces(true);
    if (s.burst) return;
    if (s.fallen) {
      s.tilt = Math.min(1.4, s.tilt + dt * 2);
      return;
    }
    const mods = s.abilities.modifiers();
    const ratio = s.energyRatio;
    const stab = statFactor(s.def.stats.stability, 0.4) * mods.stabilityMult;
    const tiltEq = T.baseTilt + T.wobble / (stab * (ratio + 0.06));
    s.tilt += (tiltEq - s.tilt) * Math.min(1, dt * T.tiltRecovery);
    s.precess += (T.precession / (ratio + 0.15)) * dt;
    if (s.tilt > T.fallTilt || ratio <= 0) {
      s.fallen = true;
      s.ctrl.energy.value = 0;
      s.body.setLinearDamping(3);
      this.emit({ type: 'fall', player: s.index });
      return;
    }
    const v = s.velocity;
    const speedF = statFactor(s.def.stats.speed, 0.3) * mods.speedMult;
    const curve = T.curve * Math.min(1, ratio * 3);
    const walk = T.tipWalk * Math.sin(s.tilt) * Math.min(1, ratio * 4) * speedF;
    const ax = -v.z * curve - Math.sin(s.precess) * walk;
    const az = v.x * curve + Math.cos(s.precess) * walk;
    s.body.addForce({ x: ax * s.mass, y: 0, z: az * s.mass }, true);
  }

  private snapshot(s: Spinner): CombatantSnapshot {
    return { stats: s.def.stats, mass: s.mass, energyRatio: s.energyRatio, mods: s.abilities.modifiers() };
  }

  private detectCollision(): void {
    const [a, b] = this.spinners;
    if (a.fallen || b.fallen) return;
    const pa = a.position, pb = b.position;
    const dx = pb.x - pa.x, dy = pb.y - pa.y, dz = pb.z - pa.z;
    if (Math.hypot(dx, dy, dz) > a.radius + b.radius + 0.08) return;
    if (this.timeMs - Math.max(a.lastHitMs, b.lastHitMs) < COLLISION_CONFIG.hitCooldownMs) return;
    const hd = Math.hypot(dx, dz) || 1e-3;
    const nx = dx / hd, nz = dz / hd;
    const va = a.velocity, vb = b.velocity;
    const closing = (va.x - vb.x) * nx + (va.z - vb.z) * nz;
    const intensity = Math.max(0, closing) + 1.2 * (a.energyRatio + b.energyRatio);
    if (intensity < COLLISION_CONFIG.minIntensity) return;

    const aPush = Math.max(0, va.x * nx + va.z * nz);
    const bPush = Math.max(0, -(vb.x * nx + vb.z * nz));
    const aShare = aPush + bPush > 1e-6 ? aPush / (aPush + bPush) : 0.5;
    const out = resolveCollision(this.snapshot(a), this.snapshot(b), intensity, aShare);
    a.lastHitMs = b.lastHitMs = this.timeMs;
    a.ctrl.energy.damage(out.onA.damage);
    b.ctrl.energy.damage(out.onB.damage);
    const pressure = 1 + (Math.max(0, this.timeMs - BATTLE_CONFIG.suddenDeathFromMs) / 10000) * BATTLE_CONFIG.suddenDeathRampPer10s;
    a.stress += out.onA.stress * pressure;
    b.stress += out.onB.stress * pressure;

    const T = TOP_CONFIG;
    const gA = (T.grind * b.energyRatio * statFactor(b.def.stats.attack, 0.5)) / statFactor(a.def.stats.defense, 0.5);
    const gB = (T.grind * a.energyRatio * statFactor(a.def.stats.attack, 0.5)) / statFactor(b.def.stats.defense, 0.5);
    const kA = out.onA.knockbackDeltaV, kB = out.onB.knockbackDeltaV;
    a.body.applyImpulse({ x: (-nx * kA - nz * gA) * a.mass, y: kA * 0.12 * a.mass, z: (-nz * kA + nx * gA) * a.mass }, true);
    b.body.applyImpulse({ x: (nx * kB + nz * gB) * b.mass, y: kB * 0.12 * b.mass, z: (nz * kB - nx * gB) * b.mass }, true);
    for (const [s, k] of [[a, 1 - aShare], [b, aShare]] as Array<[Spinner, number]>) {
      const stab = statFactor(s.def.stats.stability, 0.4) * s.abilities.modifiers().stabilityMult;
      s.tilt += (intensity * T.hitTilt * (0.5 + k)) / (stab * (s.energyRatio + 0.2));
    }
    this.emit({ type: 'hit', x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2, z: (pa.z + pb.z) / 2, intensity });

    const candidates = this.spinners.filter((s) => !s.burst && shouldBurst(s.stress, intensity));
    if (candidates.length > 0) {
      const s = candidates.reduce((x, y) => (y.stress > x.stress || (y.stress === x.stress && y.energy < x.energy) ? y : x));
      s.burst = true;
      this.emit({ type: 'burst', player: s.index });
    }
  }

  private checkEnd(): void {
    const [a, b] = this.spinners;
    const res = checkVictory(
      [
        { energy: a.energy, burst: a.burst, ...a.position },
        { energy: b.energy, burst: b.burst, ...b.position },
      ],
      this.timeMs,
      this.maxBattleMs,
    );
    if (res) {
      this.result = res;
      this.emit({ type: 'end', result: res });
    }
  }
}
