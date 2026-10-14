/** Un keydown → como mucho un toque. Ignora la tecla mantenida. */
export class KeyboardInput {
  private down = new Set<string>();
  constructor(private readonly mapping: Record<string, 0 | 1>) {}

  handleKeyDown(e: { code: string; repeat: boolean }): 0 | 1 | null {
    const player = this.mapping[e.code];
    if (player === undefined || e.repeat || this.down.has(e.code)) return null;
    this.down.add(e.code);
    return player;
  }

  handleKeyUp(e: { code: string }): void {
    this.down.delete(e.code);
  }

  reset(): void {
    this.down.clear();
  }
}

export const KEYMAP_1P: Record<string, 0 | 1> = { Space: 0 };
export const KEYMAP_2P: Record<string, 0 | 1> = { Space: 0, KeyL: 1 };
