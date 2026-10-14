import type { AudioManager } from '../audio/AudioManager';
import { LAUNCH_CONFIG } from '../game/GameConfig';
import { esc, html } from './dom';

export interface Launcher {
  player: 0 | 1;
  label: string;
  name: string;
  sprite: string;
  cpu: boolean;
  key: string;
}

const KEY_NAME: Record<string, string> = { Space: 'Espacio', KeyL: 'L' };
const tri = (t: number) => 1 - Math.abs(((t * 2) % 2) - 1);

/** Mantener apretado → la barra sube y baja → soltar fija la potencia. */
export function showLaunch(
  root: HTMLElement,
  o: { launchers: Launcher[]; touch: boolean; audio: AudioManager; onDone(powers: [number, number]): void },
): () => void {
  const ac = new AbortController();
  const powers: [number, number] = [0.5, 0.5];
  let idx = 0, holding = false, locked = false, t0 = 0, power = 0, raf = 0;

  const el = html(`
    <section class="screen launch" aria-live="polite">
      <div class="launch-who"></div>
      <div class="power"><div class="pfill"></div><div class="pval">0%</div></div>
      <p class="hint ltext"></p>
      <button class="spin-btn">¡LANZAR!<small>Mantené apretado</small></button>
    </section>`);
  const who = el.querySelector<HTMLElement>('.launch-who')!;
  const fill = el.querySelector<HTMLElement>('.pfill')!;
  const val = el.querySelector<HTMLElement>('.pval')!;
  const text = el.querySelector<HTMLElement>('.ltext')!;
  const btn = el.querySelector<HTMLButtonElement>('.spin-btn')!;
  root.appendChild(el);
  const cur = () => o.launchers[idx];

  const paint = () => {
    fill.style.width = `${power * 100}%`;
    val.textContent = `${Math.round(power * 100)}%`;
  };

  function setup(): void {
    const l = cur();
    locked = holding = false;
    power = 0;
    paint();
    who.innerHTML = `<img src="${l.sprite}" alt="" /><span class="badge p${l.player + 1} ${l.cpu ? 'cpu' : ''}">${esc(l.label)}</span> ${esc(l.name)}`;
    btn.className = `spin-btn p${l.player + 1}`;
    btn.style.visibility = l.cpu ? 'hidden' : 'visible';
    text.innerHTML = l.cpu
      ? 'La CPU está lanzando…'
      : o.touch
        ? 'Mantené apretado el botón y soltalo para lanzar'
        : `Mantené <kbd>${KEY_NAME[l.key]}</kbd> (o el botón) y soltalo para lanzar`;
    if (l.cpu) {
      start();
      window.setTimeout(release, 400 + (0.55 + Math.random() * 0.4) * (LAUNCH_CONFIG.barPeriodMs / 2));
    }
  }

  function start(): void {
    if (holding || locked) return;
    holding = true;
    t0 = performance.now();
    const tick = () => {
      if (!holding) return;
      power = tri((performance.now() - t0) / LAUNCH_CONFIG.barPeriodMs);
      paint();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  function release(): void {
    if (!holding || locked) return;
    holding = false;
    locked = true;
    cancelAnimationFrame(raf);
    power = tri((performance.now() - t0) / LAUNCH_CONFIG.barPeriodMs);
    paint();
    powers[cur().player] = power;
    o.audio.select();
    text.textContent = power > 0.8 ? '¡Superlanzamiento!' : power > 0.5 ? '¡Buen lanzamiento!' : '¡Lanzado!';
    window.setTimeout(() => {
      if (ac.signal.aborted) return;
      idx += 1;
      if (idx >= o.launchers.length) o.onDone(powers);
      else setup();
    }, 800);
  }

  const human = () => !cur().cpu;
  const sig = { signal: ac.signal };
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (human()) {
      btn.classList.add('pressed');
      start();
    }
  }, sig);
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave'])
    btn.addEventListener(ev, () => {
      btn.classList.remove('pressed');
      if (human()) release();
    }, sig);
  btn.addEventListener('contextmenu', (e) => e.preventDefault(), sig);
  window.addEventListener('keydown', (e) => {
    if (e.code === cur().key && !e.repeat && human()) start();
  }, sig);
  window.addEventListener('keyup', (e) => {
    if (e.code === cur().key && human()) release();
  }, sig);

  setup();
  return () => {
    ac.abort();
    cancelAnimationFrame(raf);
    el.remove();
  };
}
