import type { CharacterDefinition } from '../characters/characterDefinitions';
import { physicalMass } from '../characters/characterDefinitions';
import { AbilitySystem } from './AbilitySystem';
import { COLLISION_CONFIG } from './GameConfig';
import { SpinnerController } from './SpinnerController';
import type { Body } from './PhysicsWorld';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Estado de simulación de un trompo (sin render). */
export class Spinner {
  readonly ctrl: SpinnerController;
  readonly abilities: AbilitySystem;
  readonly mass: number;
  readonly radius: number;
  stress = 0;
  burst = false;
  spinAngle = 0;
  tilt = 0;
  precess = 0;
  fallen = false;
  launchPower = 0;
  lastHitMs = -Infinity;
  prevPos: Vec3;

  constructor(
    readonly index: 0 | 1,
    readonly def: CharacterDefinition,
    readonly body: Body,
    readonly phase: number,
  ) {
    this.ctrl = new SpinnerController(def.stats);
    this.abilities = new AbilitySystem(def.ability);
    this.mass = physicalMass(def.stats);
    this.radius = def.visual.radius;
    this.prevPos = this.position;
  }

  get energy(): number {
    return this.ctrl.energy.value;
  }

  get energyRatio(): number {
    return this.ctrl.energy.ratio;
  }

  /**
   * Vida 0..1: lo que esté más cerca de hacerlo perder.
   * Se queda sin giro → se cae. Muchos golpes → explota.
   */
  get life(): number {
    if (this.fallen || this.burst) return 0;
    const hits = 1 - this.stress / COLLISION_CONFIG.burstStressThreshold;
    return Math.max(0, Math.min(this.energyRatio, hits));
  }

  get position(): Vec3 {
    const t = this.body.translation();
    return { x: t.x, y: t.y, z: t.z };
  }

  get velocity(): Vec3 {
    const v = this.body.linvel();
    return { x: v.x, y: v.y, z: v.z };
  }
}
