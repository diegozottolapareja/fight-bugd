/** Todas las constantes de jugabilidad en un solo lugar para ajustar el balance. */

export const SPIN_CONFIG = {
  maxEnergy: 100,
  startingEnergy: 55,
  energyPerPress: 2.5,
  baseEnergyDecayPerSecond: 5,
  comboTimeoutMs: 500,
  specialComboThreshold: 20,
  specialCooldownMs: 1200,
  /** Ignora toques más rápidos que esto (dobles eventos accidentales). */
  minPressIntervalMs: 60,
  /** Por encima de esta energía cada toque rinde menos. */
  diminishingReturnsFrom: 50,
  diminishingReturnsFloor: 0.2,
  /** Ayuda para el que va atrás (vale igual para todos). */
  catchUpBonus: 1.6,
  catchUpRange: 40,
};

export const TURN_CONFIG = {
  windowMs: 3000,
  transitionMs: 700,
  decayMultiplier: 0.6,
};

export const ARENA_CONFIG = {
  radius: 6,
  depth: 1.25,
  lipHeight: 0.35,
  lipThickness: 0.3,
  gapCount: 3,
  gapAngle: 0.55,
  ledgeWidth: 1.2,
  ringOutRadius: 6.35,
  ringOutY: -1,
};

export const PHYSICS_CONFIG = {
  timestep: 1 / 60,
  gravity: -20,
  restitution: 0.45,
  friction: 0.04,
  linearDamping: 0.3,
  startRadius: 3.2,
};

export const COLLISION_CONFIG = {
  minIntensity: 1.2,
  hitCooldownMs: 160,
  damagePerIntensity: 1.8,
  knockbackPerIntensity: 0.85,
  /** Golpes acumulados necesarios para explotar (BURST). */
  burstStressThreshold: 80,
  burstMinIntensity: 3.5,
  stressPerIntensity: 3,
  stressRecoveryPerSecond: 0.5,
};

export const CPU_CONFIG = {
  child: { minInterval: 260, maxInterval: 420, pauseChance: 0.05, minPause: 600, maxPause: 1400, relaxAboveEnergy: 101 },
  normal: { minInterval: 150, maxInterval: 240, pauseChance: 0.035, minPause: 550, maxPause: 1100, relaxAboveEnergy: 88 },
};

export const BATTLE_CONFIG = {
  countdownStepMs: 800,
  maxBattleMs: 40000,
  suddenDeathFromMs: 22000,
  suddenDeathRampPer10s: 1.2,
  resultDelayMs: 1300,
};

export const ABILITY_DURATIONS_MS = {
  fireCharge: 1000,
  stoneShield: 2200,
  lightningSpeed: 2200,
  whirlwind: 1500,
  heavyImpact: 2200,
  recovery: 2000,
};

/** Lanzamiento con barra de potencia. */
export const LAUNCH_CONFIG = {
  barPeriodMs: 1800,
  minPower: 0.25,
  minEnergy: 45,
  maxEnergy: 100,
  minSpeed: 2,
  maxSpeed: 4.8,
  inwardAngle: 0.35,
  launchTilt: 0.3,
};

/** Física simplificada del trompo. */
export const TOP_CONFIG = {
  baseTilt: 0.03,
  wobble: 0.05,
  tiltRecovery: 2.5,
  precession: 1.1,
  tipWalk: 6,
  curve: 1.1,
  fallTilt: 0.78,
  hitTilt: 0.03,
  grind: 1.6,
};

export type SpinConfig = typeof SPIN_CONFIG;
export type TurnConfig = typeof TURN_CONFIG;
