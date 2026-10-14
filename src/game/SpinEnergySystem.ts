import { SPIN_CONFIG, type SpinConfig } from './GameConfig';
import { statFactor, type CharacterStats } from '../characters/characterDefinitions';

/** Energía de giro 0..max. Sube con cada toque y baja de a poco. */
export class SpinEnergy {
  value: number;

  constructor(
    private readonly stats: Pick<CharacterStats, 'endurance' | 'stability'>,
    private readonly cfg: SpinConfig = SPIN_CONFIG,
  ) {
    this.value = cfg.startingEnergy;
  }

  get max(): number {
    return this.cfg.maxEnergy;
  }

  gainForPress(opponentEnergy?: number): number {
    const { energyPerPress, diminishingReturnsFrom, diminishingReturnsFloor, maxEnergy } = this.cfg;
    let gain = energyPerPress;
    if (this.value > diminishingReturnsFrom) {
      const t = (this.value - diminishingReturnsFrom) / (maxEnergy - diminishingReturnsFrom);
      gain *= 1 - t * (1 - diminishingReturnsFloor);
    }
    if (opponentEnergy !== undefined && opponentEnergy > this.value) {
      const behind = Math.min(1, (opponentEnergy - this.value) / this.cfg.catchUpRange);
      gain *= 1 + this.cfg.catchUpBonus * behind;
    }
    return gain;
  }

  press(opponentEnergy?: number): number {
    const before = this.value;
    this.value = Math.min(this.cfg.maxEnergy, this.value + this.gainForPress(opponentEnergy));
    return this.value - before;
  }

  decayRate(multiplier = 1, stabilityMult = 1): number {
    const endurance = 1 / statFactor(this.stats.endurance, 0.45);
    const stability = 1 / statFactor(this.stats.stability * stabilityMult, 0.15);
    const level = 0.3 + 0.7 * (this.value / this.cfg.maxEnergy);
    return this.cfg.baseEnergyDecayPerSecond * endurance * stability * level * multiplier;
  }

  decay(dtSeconds: number, multiplier = 1, stabilityMult = 1): void {
    this.value = Math.max(0, this.value - this.decayRate(multiplier, stabilityMult) * dtSeconds);
  }

  damage(amount: number): void {
    this.value = Math.max(0, this.value - Math.max(0, amount));
  }

  heal(amount: number): void {
    this.value = Math.min(this.cfg.maxEnergy, this.value + Math.max(0, amount));
  }

  get ratio(): number {
    return this.value / this.cfg.maxEnergy;
  }

  get isEmpty(): boolean {
    return this.value <= 0;
  }
}
