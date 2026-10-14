import { TURN_CONFIG, type TurnConfig } from '../game/GameConfig';

/** 2 jugadores en un celular: ventanas de entrada alternadas. */
export class TurnInputController {
  activePlayer: 0 | 1;
  remainingMs: number;
  inTransition = false;
  private listeners: Array<(player: 0 | 1) => void> = [];

  constructor(readonly cfg: TurnConfig = TURN_CONFIG, startingPlayer: 0 | 1 = 0) {
    this.activePlayer = startingPlayer;
    this.remainingMs = cfg.windowMs;
  }

  canInput(player: 0 | 1): boolean {
    return !this.inTransition && player === this.activePlayer;
  }

  get windowProgress(): number {
    return this.inTransition ? 0 : this.remainingMs / this.cfg.windowMs;
  }

  update(dtMs: number): void {
    let left = dtMs;
    while (left > 0) {
      const step = Math.min(left, this.remainingMs);
      this.remainingMs -= step;
      left -= step;
      if (this.remainingMs <= 0) {
        if (this.inTransition) {
          this.inTransition = false;
          this.remainingMs = this.cfg.windowMs;
        } else {
          this.activePlayer = this.activePlayer === 0 ? 1 : 0;
          this.inTransition = true;
          this.remainingMs = this.cfg.transitionMs;
          for (const l of this.listeners) l(this.activePlayer);
        }
      }
    }
  }

  onTurnChange(l: (player: 0 | 1) => void): void {
    this.listeners.push(l);
  }
}
