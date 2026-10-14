import { ABILITY_DURATIONS_MS } from './GameConfig';
import type { AbilityId } from '../characters/characterDefinitions';

export interface Modifiers {
  speedMult: number;
  attackMult: number;
  damageTakenMult: number;
  knockbackTakenMult: number;
  impulseMult: number;
  stabilityMult: number;
  charging: boolean;
}

const NEUTRAL: Modifiers = {
  speedMult: 1,
  attackMult: 1,
  damageTakenMult: 1,
  knockbackTakenMult: 1,
  impulseMult: 1,
  stabilityMult: 1,
  charging: false,
};

export type InstantAction =
  | { kind: 'dash'; deltaV: number }
  | { kind: 'push'; radius: number; deltaV: number }
  | { kind: 'heal'; amount: number }
  | { kind: 'none' };

interface AbilitySpec {
  durationMs: number;
  modifiers: Partial<Modifiers>;
  instant: InstantAction;
}

export const ABILITIES: Record<AbilityId, AbilitySpec> = {
  fireCharge: {
    durationMs: ABILITY_DURATIONS_MS.fireCharge,
    modifiers: { attackMult: 1.3, speedMult: 1.3, charging: true },
    instant: { kind: 'dash', deltaV: 6 },
  },
  stoneShield: {
    durationMs: ABILITY_DURATIONS_MS.stoneShield,
    modifiers: { damageTakenMult: 0.35, knockbackTakenMult: 0.4 },
    instant: { kind: 'none' },
  },
  lightningSpeed: {
    durationMs: ABILITY_DURATIONS_MS.lightningSpeed,
    modifiers: { speedMult: 1.35, attackMult: 1.25, stabilityMult: 1.2 },
    instant: { kind: 'dash', deltaV: 3 },
  },
  whirlwind: {
    durationMs: ABILITY_DURATIONS_MS.whirlwind,
    modifiers: { knockbackTakenMult: 0.6, damageTakenMult: 0.7, stabilityMult: 1.4 },
    instant: { kind: 'push', radius: 5, deltaV: 8 },
  },
  heavyImpact: {
    durationMs: ABILITY_DURATIONS_MS.heavyImpact,
    modifiers: { impulseMult: 1.8, attackMult: 1.25 },
    instant: { kind: 'none' },
  },
  recovery: {
    durationMs: ABILITY_DURATIONS_MS.recovery,
    modifiers: { stabilityMult: 1.6, damageTakenMult: 0.8 },
    instant: { kind: 'heal', amount: 18 },
  },
};

export class AbilitySystem {
  effects: Array<{ ability: AbilityId; remainingMs: number }> = [];

  constructor(readonly ability: AbilityId) {}

  activate(): InstantAction {
    const spec = ABILITIES[this.ability];
    this.effects = this.effects.filter((e) => e.ability !== this.ability);
    this.effects.push({ ability: this.ability, remainingMs: spec.durationMs });
    return spec.instant;
  }

  tick(dtMs: number): void {
    for (const e of this.effects) e.remainingMs -= dtMs;
    this.effects = this.effects.filter((e) => e.remainingMs > 0);
  }

  get active(): boolean {
    return this.effects.length > 0;
  }

  modifiers(): Modifiers {
    const m: Modifiers = { ...NEUTRAL };
    for (const e of this.effects) {
      const s = ABILITIES[e.ability].modifiers;
      m.speedMult *= s.speedMult ?? 1;
      m.attackMult *= s.attackMult ?? 1;
      m.damageTakenMult *= s.damageTakenMult ?? 1;
      m.knockbackTakenMult *= s.knockbackTakenMult ?? 1;
      m.impulseMult *= s.impulseMult ?? 1;
      m.stabilityMult *= s.stabilityMult ?? 1;
      m.charging = m.charging || !!s.charging;
    }
    return m;
  }
}
