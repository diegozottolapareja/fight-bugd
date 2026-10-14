import type { AudioManager } from '../audio/AudioManager';
import type { CharacterDefinition } from '../characters/characterDefinitions';
import type { VictoryResult } from '../game/VictorySystem';
import { arrowNav, esc, html } from './dom';

const VICTORY_TEXT: Record<VictoryResult['type'], string> = {
  spin: '¡Se cayó!',
  ringout: '¡Fuera del estadio!',
  burst: '¡Explosión!',
  time: 'Se acabó el tiempo: ganó el que más giraba',
  draw: '¡Empate!',
};

export interface ResultOptions {
  result: VictoryResult;
  defs: [CharacterDefinition, CharacterDefinition];
  labels: [string, string];
  /** Se juega contra la computadora: el resultado se muestra como ganaste / perdiste. */
  vsCpu: boolean;
  audio: AudioManager;
  onRematch(): void;
  onSelect(): void;
  onMenu(): void;
}

export function showResults(root: HTMLElement, o: ResultOptions): () => void {
  const ac = new AbortController();
  const w = o.result.winner;
  const def = w === null ? null : o.defs[w];
  const who = w === null ? '' : '¡ganó!';
  const verdict = o.vsCpu && w !== null ? (w === 0 ? 'win' : 'lose') : null;
  const colors = ['#ff5a4e', '#ffc93c', '#2fc0ff', '#fff6e0', '#9cff5a'];
  const confetti = Array.from(
    { length: 40 },
    (_, i) =>
      `<i style="left:${(i * 37) % 100}%;background:${colors[i % colors.length]};animation-duration:${2.5 + ((i * 13) % 20) / 10}s;animation-delay:${((i * 7) % 15) / 10}s"></i>`,
  ).join('');
  const el = html(`
    <section class="screen result" aria-label="Resultado">
      ${verdict !== 'lose' ? `<div class="confetti">${confetti}</div>` : ''}
      ${verdict ? `<div class="verdict ${verdict}">${verdict === 'win' ? '¡GANASTE!' : '¡PERDISTE!'}</div>` : ''}
      <div class="vtype">${esc(VICTORY_TEXT[o.result.type])}</div>
      ${def ? `<img src="${def.visual.sprite}" alt="" />` : ''}
      <div class="winner">${def ? `¡Ganó ${esc(def.name)}!` : '¡Nadie gana!'}</div>
      ${def ? `<div class="hint"><span class="badge p${w! + 1}">${esc(o.labels[w!])}</span> ${esc(who)}</div>` : ''}
      <div class="result-buttons">
        <button class="big-btn" data-a="rematch">REVANCHA</button>
        <button class="big-btn secondary small" data-a="select">ELEGIR PERSONAJES</button>
        <button class="big-btn secondary small" data-a="menu">MENÚ PRINCIPAL</button>
      </div>
    </section>`);
  root.appendChild(el);
  const btns = [...el.querySelectorAll<HTMLButtonElement>('.result-buttons button')];
  const actions: Record<string, () => void> = { rematch: o.onRematch, select: o.onSelect, menu: o.onMenu };
  for (const b of btns) {
    b.addEventListener('click', () => {
      o.audio.select();
      actions[b.dataset.a!]();
    }, { signal: ac.signal });
  }
  arrowNav(btns, ac.signal, () => o.audio.move());
  // Pausa corta para que un toque de la pelea no apriete REVANCHA sin querer.
  btns.forEach((b) => (b.disabled = true));
  setTimeout(() => {
    btns.forEach((b) => (b.disabled = false));
    btns[0].focus({ preventScroll: true });
  }, 700);
  return () => {
    ac.abort();
    el.remove();
  };
}
