export type Phase = 'MAIN_MENU' | 'CHARACTER_SELECTION' | 'READY' | 'BATTLE' | 'RESULT';

const ALLOWED: Record<Phase, Phase[]> = {
  MAIN_MENU: ['CHARACTER_SELECTION'],
  CHARACTER_SELECTION: ['READY', 'MAIN_MENU'],
  READY: ['BATTLE', 'MAIN_MENU'],
  BATTLE: ['RESULT', 'MAIN_MENU'],
  RESULT: ['READY', 'CHARACTER_SELECTION', 'MAIN_MENU'],
};

export class GameStateMachine {
  phase: Phase = 'MAIN_MENU';
  private listeners: Array<(to: Phase) => void> = [];

  go(to: Phase): void {
    if (!ALLOWED[this.phase].includes(to)) throw new Error(`Transición inválida: ${this.phase} → ${to}`);
    this.phase = to;
    for (const l of this.listeners) l(to);
  }

  onChange(l: (to: Phase) => void): void {
    this.listeners.push(l);
  }
}
