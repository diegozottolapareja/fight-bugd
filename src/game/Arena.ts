import { ARENA_CONFIG } from './GameConfig';

/** Forma del estadio, compartida por la física y el render. */
type ArenaConfig = typeof ARENA_CONFIG;

export function surfaceHeight(r: number, a: ArenaConfig = ARENA_CONFIG): number {
  if (r <= a.radius) return a.depth * (r / a.radius) ** 2;
  const t = Math.min(1, (r - a.radius) / a.ledgeWidth);
  return a.depth - 0.25 * t;
}

export function gapCenters(a: ArenaConfig = ARENA_CONFIG): number[] {
  return Array.from({ length: a.gapCount }, (_, k) => Math.PI / 2 + (k * 2 * Math.PI) / a.gapCount);
}

function angleDiff(x: number, y: number): number {
  let d = (x - y) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

export function isInGap(angle: number, a: ArenaConfig = ARENA_CONFIG): boolean {
  return gapCenters(a).some((c) => angleDiff(angle, c) < a.gapAngle / 2);
}

export function lipSegments(a: ArenaConfig = ARENA_CONFIG, count = 72): Array<{ angle: number; length: number }> {
  const out: Array<{ angle: number; length: number }> = [];
  const rMid = a.radius + a.lipThickness / 2;
  const len = ((Math.PI * 2 * rMid) / count) * 1.08;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    if (!isInGap(angle, a)) out.push({ angle, length: len });
  }
  return out;
}

export function buildSurfaceMesh(a: ArenaConfig = ARENA_CONFIG, rings = 18, segments = 64) {
  const radii: number[] = [];
  for (let i = 0; i <= rings; i++) radii.push((i / rings) * a.radius);
  radii.push(a.radius + a.ledgeWidth * 0.5, a.radius + a.ledgeWidth);
  const vertices: number[] = [0, surfaceHeight(0, a), 0];
  for (let ri = 1; ri < radii.length; ri++) {
    const r = radii[ri];
    for (let s = 0; s < segments; s++) {
      const th = (s / segments) * Math.PI * 2;
      vertices.push(Math.cos(th) * r, surfaceHeight(r, a), Math.sin(th) * r);
    }
  }
  const indices: number[] = [];
  const idx = (ring: number, s: number) => 1 + (ring - 1) * segments + (s % segments);
  for (let s = 0; s < segments; s++) indices.push(0, idx(1, s + 1), idx(1, s));
  for (let ri = 1; ri < radii.length - 1; ri++) {
    for (let s = 0; s < segments; s++) {
      const a0 = idx(ri, s), a1 = idx(ri, s + 1), b0 = idx(ri + 1, s), b1 = idx(ri + 1, s + 1);
      indices.push(a0, a1, b1, a0, b1, b0);
    }
  }
  return { vertices: new Float32Array(vertices), indices: new Uint32Array(indices) };
}
