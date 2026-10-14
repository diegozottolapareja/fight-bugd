import { COLLISION_CONFIG } from './GameConfig';
import { statFactor, type CharacterStats } from '../characters/characterDefinitions';
import type { Modifiers } from './AbilitySystem';

export interface CombatantSnapshot {
  stats: CharacterStats;
  mass: number;
  energyRatio: number;
  mods: Modifiers;
}

export interface HitEffectOnTarget {
  damage: number;
  knockbackDeltaV: number;
  stress: number;
}

function power(a: CombatantSnapshot): number {
  return statFactor(a.stats.attack, 0.6) * a.mods.attackMult * (0.8 + 0.2 * a.energyRatio);
}

/** attackerShare: cuánto del choque puso el atacante (quien embiste sufre menos). */
function effectOn(target: CombatantSnapshot, attacker: CombatantSnapshot, intensity: number, attackerShare: number): HitEffectOnTarget {
  const c = COLLISION_CONFIG;
  const p = power(attacker);
  const def = statFactor(target.stats.defense, 0.6);
  const stab = statFactor(target.stats.stability, 0.5) * target.mods.stabilityMult;
  const wobble = target.energyRatio < 0.3 ? 1 + ((0.3 - target.energyRatio) / 0.3) * 0.5 : 1;
  const massRatio = Math.sqrt((2 * attacker.mass) / (attacker.mass + target.mass));
  const initiative = 0.6 + 0.8 * attackerShare;
  return {
    damage: c.damagePerIntensity * intensity * (p / def) * target.mods.damageTakenMult * initiative,
    knockbackDeltaV:
      (c.knockbackPerIntensity * intensity * p * attacker.mods.impulseMult * massRatio * target.mods.knockbackTakenMult) / stab,
    stress:
      (c.stressPerIntensity * intensity * statFactor(attacker.stats.attack, 0.6) * attacker.mods.attackMult * wobble * initiative) /
      (stab * def),
  };
}

export function resolveCollision(a: CombatantSnapshot, b: CombatantSnapshot, intensity: number, aShare = 0.5) {
  const share = Math.min(1, Math.max(0, aShare));
  return { intensity, onA: effectOn(a, b, intensity, 1 - share), onB: effectOn(b, a, intensity, share) };
}

/** El BURST requiere golpes acumulados y un golpe fuerte. Nunca es aleatorio. */
export function shouldBurst(stress: number, hitIntensity: number): boolean {
  return stress >= COLLISION_CONFIG.burstStressThreshold && hitIntensity >= COLLISION_CONFIG.burstMinIntensity;
}
