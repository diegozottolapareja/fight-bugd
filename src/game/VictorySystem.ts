import { ARENA_CONFIG } from './GameConfig';

export type VictoryType = 'spin' | 'ringout' | 'burst' | 'time' | 'draw';

export interface VictoryResult {
  winner: 0 | 1 | null;
  type: VictoryType;
  loser: 0 | 1 | null;
}

export interface VictoryInput {
  energy: number;
  burst: boolean;
  x: number;
  y: number;
  z: number;
}

export function isRingOut(p: { x: number; y: number; z: number }): boolean {
  return Math.hypot(p.x, p.z) > ARENA_CONFIG.ringOutRadius || p.y < ARENA_CONFIG.ringOutY;
}

/** Prioridad: BURST > RING OUT > SE CAYÓ. */
export function checkVictory(s: [VictoryInput, VictoryInput], elapsedMs: number, maxMs: number): VictoryResult | null {
  const checks: Array<[VictoryType, (v: VictoryInput) => boolean]> = [
    ['burst', (v) => v.burst],
    ['ringout', (v) => isRingOut(v)],
    ['spin', (v) => v.energy <= 0],
  ];
  for (const [type, lost] of checks) {
    const l0 = lost(s[0]);
    const l1 = lost(s[1]);
    if (l0 && l1) return { winner: null, loser: null, type: 'draw' };
    if (l0) return { winner: 1, loser: 0, type };
    if (l1) return { winner: 0, loser: 1, type };
  }
  if (elapsedMs >= maxMs) {
    if (Math.abs(s[0].energy - s[1].energy) < 0.5) return { winner: null, loser: null, type: 'draw' };
    const winner = s[0].energy > s[1].energy ? 0 : 1;
    return { winner, loser: winner === 0 ? 1 : 0, type: 'time' };
  }
  return null;
}
