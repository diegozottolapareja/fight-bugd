import { SPIN_CONFIG, type SpinConfig } from './GameConfig';
import { Combo, PressGate } from './ComboSystem';
import { SpinEnergy } from './SpinEnergySystem';
import type { CharacterStats } from '../characters/characterDefinitions';

export interface PressResult {
  accepted: boolean;
  special: boolean;
  gained: number;
}

/** Único camino de entrada para humanos y CPU: un toque → energía + combo. */
export class SpinnerController {
  readonly energy: SpinEnergy;
  readonly combo: Combo;
  readonly gate: PressGate;
  presses = 0;

  constructor(stats: CharacterStats, cfg: SpinConfig = SPIN_CONFIG) {
    this.energy = new SpinEnergy(stats, cfg);
    this.combo = new Combo(cfg);
    this.gate = new PressGate(cfg);
  }

  press(timeMs: number, opponentEnergy?: number): PressResult {
    if (this.energy.isEmpty || !this.gate.accept(timeMs)) return { accepted: false, special: false, gained: 0 };
    this.presses += 1;
    const gained = this.energy.press(opponentEnergy);
    const special = this.combo.press();
    return { accepted: true, special, gained };
  }
}
