import { CPU_CONFIG } from './GameConfig';
import { createRng } from './rng';

export type CpuDifficulty = keyof typeof CPU_CONFIG;

/** La CPU decide CUÁNDO "apretar"; los toques pasan por el mismo camino que los humanos. */
export class CpuController {
  private nextPressAt: number;
  private readonly rng: () => number;
  private readonly cfg: (typeof CPU_CONFIG)[CpuDifficulty];

  constructor(seed = 1, difficulty: CpuDifficulty = 'normal', startMs = 0) {
    this.rng = createRng(seed);
    this.cfg = CPU_CONFIG[difficulty];
    this.nextPressAt = startMs + this.interval();
  }

  private interval(): number {
    return this.cfg.minInterval + this.rng() * (this.cfg.maxInterval - this.cfg.minInterval);
  }

  pressesUntil(nowMs: number, energy: number): number[] {
    const out: number[] = [];
    while (this.nextPressAt <= nowMs) {
      out.push(this.nextPressAt);
      let gap = this.interval();
      if (energy >= this.cfg.relaxAboveEnergy) gap *= 1.6;
      if (this.rng() < this.cfg.pauseChance) gap += this.cfg.minPause + this.rng() * (this.cfg.maxPause - this.cfg.minPause);
      this.nextPressAt += gap;
    }
    return out;
  }
}
