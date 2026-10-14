import diablito from '../assets/sprites/diablito.png';
import reptil from '../assets/sprites/reptil.png';
import multiojos from '../assets/sprites/multiojos.png';
import cerebrin from '../assets/sprites/cerebrin.png';
import momia from '../assets/sprites/momia.png';
import roca from '../assets/sprites/roca.png';
import esqueleto from '../assets/sprites/esqueleto.png';
import pulpo from '../assets/sprites/pulpo.png';
import lobo from '../assets/sprites/lobo.png';
import baba from '../assets/sprites/baba.png';
import robot from '../assets/sprites/robot.png';
import insecto from '../assets/sprites/insecto.png';

export type AbilityId = 'fireCharge' | 'stoneShield' | 'lightningSpeed' | 'whirlwind' | 'heavyImpact' | 'recovery';

/** Escala 1–10. 5 = promedio. */
export interface CharacterStats {
  mass: number;
  attack: number;
  defense: number;
  speed: number;
  endurance: number;
  stability: number;
}

export interface CharacterDefinition {
  id: string;
  name: string;
  specialty: string;
  stats: CharacterStats;
  ability: AbilityId;
  abilityName: string;
  visual: { sprite: string; color: string; accent: string; radius: number };
}

type Row = [string, string, string, CharacterStats, AbilityId, string, string, string, string];
const s = (mass: number, attack: number, defense: number, speed: number, endurance: number, stability: number) => ({
  mass, attack, defense, speed, endurance, stability,
});

const ROWS: Row[] = [
  ['diablito', 'Diablito', 'Ataque', s(5, 9, 4, 7, 4, 5), 'fireCharge', 'Embestida de Fuego', diablito, '#e8312a', '#ffd23f'],
  ['reptil', 'Reptil', 'Velocidad', s(4, 7, 4, 9, 5, 5), 'lightningSpeed', 'Carrera Reptil', reptil, '#3fa83a', '#f0a020'],
  ['multiojos', 'Multiojos', 'Equilibrado', s(5, 6, 6, 6, 6, 6), 'whirlwind', 'Remolino de Ojos', multiojos, '#2d8fd8', '#ffe14d'],
  ['cerebrin', 'Cerebrín', 'Aguante', s(4, 5, 5, 5, 9, 7), 'recovery', 'Supermente', cerebrin, '#e05bb8', '#ffe14d'],
  ['momia', 'Momia', 'Defensa', s(6, 4, 9, 4, 7, 6), 'stoneShield', 'Vendas de Hierro', momia, '#e8dcc0', '#c9a227'],
  ['roca', 'Roca', 'Peso pesado', s(9, 6, 8, 3, 4, 7), 'heavyImpact', 'Avalancha', roca, '#e8822a', '#7a3d10'],
  ['esqueleto', 'Esqueleto', 'Velocidad', s(3, 7, 4, 9, 5, 5), 'lightningSpeed', 'Huesos Rápidos', esqueleto, '#efe4c8', '#d4262b'],
  ['pulpo', 'Pulpo', 'Equilibrado', s(5, 6, 6, 6, 6, 7), 'whirlwind', 'Tentáculos Giratorios', pulpo, '#8a4cc4', '#ff7a1a'],
  ['lobo', 'Lobo', 'Ataque', s(6, 8, 5, 7, 4, 5), 'fireCharge', 'Aullido Salvaje', lobo, '#8a5a33', '#ffd23f'],
  ['baba', 'Baba', 'Aguante', s(5, 4, 6, 5, 9, 6), 'recovery', 'Baba Regeneradora', baba, '#8ee03a', '#e0242b'],
  ['robot', 'Robot', 'Peso pesado', s(8, 7, 7, 3, 5, 6), 'heavyImpact', 'Puño de Acero', robot, '#a8b0bc', '#e0242b'],
  ['insecto', 'Insecto', 'Defensa', s(4, 5, 8, 7, 5, 6), 'stoneShield', 'Caparazón', insecto, '#d6dd2a', '#e0242b'],
];

export const CHARACTERS: CharacterDefinition[] = ROWS.map(([id, name, specialty, stats, ability, abilityName, sprite, color, accent]) => ({
  id, name, specialty, stats, ability, abilityName,
  visual: { sprite, color, accent, radius: 0.5 + stats.mass * 0.025 },
}));

export function getCharacter(id: string): CharacterDefinition {
  const c = CHARACTERS.find((x) => x.id === id);
  if (!c) throw new Error(`Personaje desconocido: ${id}`);
  return c;
}

export function statFactor(value: number, spread = 0.5): number {
  return 1 + ((value - 5) / 5) * spread;
}

export function physicalMass(stats: CharacterStats): number {
  return 1 + stats.mass * 0.08;
}
