import { SPIN_CONFIG, type SpinConfig } from './GameConfig';

/** Contador de toques consecutivos. Independiente de la energía. */
export class Combo {
  count = 0;
  idleMs = 0;
  cooldownMs = 0;

  constructor(private readonly cfg: SpinConfig = SPIN_CONFIG) {}

  get threshold(): number {
    return this.cfg.specialComboThreshold;
  }

  /** Registra un toque. Devuelve true si se dispara el especial. */
  press(): boolean {
    this.count += 1;
    this.idleMs = 0;
    if (this.count >= this.cfg.specialComboThreshold && this.cooldownMs <= 0) {
      this.count = 0;
      this.cooldownMs = this.cfg.specialCooldownMs;
      return true;
    }
    return false;
  }

  tick(dtMs: number, paused = false): void {
    if (this.cooldownMs > 0) this.cooldownMs = Math.max(0, this.cooldownMs - dtMs);
    if (paused || this.count === 0) return;
    this.idleMs += dtMs;
    if (this.idleMs > this.cfg.comboTimeoutMs) {
      this.count = 0;
      this.idleMs = 0;
    }
  }
}

/** Filtra dobles eventos demasiado seguidos. */
export class PressGate {
  private lastAccepted = -Infinity;
  constructor(private readonly cfg: SpinConfig = SPIN_CONFIG) {}

  accept(timeMs: number): boolean {
    if (timeMs - this.lastAccepted < this.cfg.minPressIntervalMs) return false;
    this.lastAccepted = timeMs;
    return true;
  }
}
