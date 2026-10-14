import { PLAYER1_NAME, getPlayer2Name } from '../game/players';
import type { AudioManager } from '../audio/AudioManager';
import { CHARACTERS, type CharacterStats } from '../characters/characterDefinitions';
import { esc, html } from './dom';

export interface SelectionOptions {
  players: 1 | 2;
  audio: AudioManager;
  initial?: [string, string];
  onDone(ids: [string, string]): void;
  onBack(): void;
}

const STAT_ROWS: Array<[keyof CharacterStats, string, string]> = [
  ['attack', 'Fuerza', 'FUE'],
  ['speed', 'Velocidad', 'VEL'],
  ['stability', 'Equilibrio', 'EQU'],
  ['endurance', 'Aguante', 'AGU'],
];

/** Rojo = bajo, amarillo = medio, verde = alto. */
const level = (v: number) => (v >= 8 ? 'high' : v >= 5 ? 'mid' : 'low');

/** Selección: primero J1, después J2 (o la CPU elige sola). */
export function showCharacterSelection(root: HTMLElement, opts: SelectionOptions): () => void {
  const ac = new AbortController();
  const picks: string[] = [];
  let cursor = Math.max(0, CHARACTERS.findIndex((c) => c.id === opts.initial?.[0]));

  const el = html(`
    <section class="screen select" aria-label="Elegir personajes">
      <div class="select-header"><span class="badge"></span><h2></h2></div>
      <div class="cards" role="listbox"></div>
      <div class="select-footer">
        <button class="big-btn small secondary" data-a="back">Volver</button>
        <button class="big-btn" data-a="ok">¡ELEGIR!</button>
      </div>
      <p class="hint">Flechas para moverte y <kbd>Enter</kbd> para elegir.</p>
    </section>`);
  const cards = el.querySelector<HTMLElement>('.cards')!;
  const badge = el.querySelector<HTMLElement>('.badge')!;
  const title = el.querySelector<HTMLElement>('h2')!;

  const cardEls = CHARACTERS.map((c, i) => {
    const stats = STAT_ROWS.map(
      ([k, label, short]) =>
        `<span class="stat-label"><b class="full">${label}</b><b class="short">${short}</b></span><span class="stat-bar" role="img" aria-label="${label}: ${c.stats[k]} de 10"><i class="${level(c.stats[k])}" style="width:${c.stats[k] * 10}%"></i></span>`,
    ).join('');
    const card = html<HTMLButtonElement>(`
      <button class="card" role="option">
        <img src="${c.visual.sprite}" alt="" draggable="false" />
        <span class="name">${esc(c.name)}</span>
        <span class="spec">${esc(c.specialty)}</span>
        <span class="stats">${stats}</span>
      </button>`);
    card.addEventListener('click', () => {
      if (cursor === i) return confirm();
      cursor = i;
      opts.audio.move();
      paint();
    }, { signal: ac.signal });
    cards.appendChild(card);
    return card;
  });

  function paint(): void {
    const p = picks.length;
    badge.className = `badge p${p + 1}`;
    badge.textContent = `J${p + 1}`;
    title.textContent = opts.players === 1 ? 'Elegí tu monstruito' : `${p === 0 ? PLAYER1_NAME : getPlayer2Name()}: elegí tu monstruito`;
    cardEls.forEach((c, i) => {
      c.classList.toggle('active', i === cursor);
      c.setAttribute('aria-selected', String(i === cursor));
      c.querySelector('.taken')?.remove();
      const takenBy = picks.indexOf(CHARACTERS[i].id);
      if (takenBy >= 0) c.appendChild(html(`<span class="badge taken p${takenBy + 1}">J${takenBy + 1}</span>`));
    });
    cardEls[cursor].focus({ preventScroll: true });
    cardEls[cursor].scrollIntoView({ block: 'nearest' });
  }

  function confirm(): void {
    opts.audio.select();
    picks.push(CHARACTERS[cursor].id);
    if (opts.players === 1) {
      const others = CHARACTERS.filter((c) => c.id !== picks[0]);
      picks.push(others[Math.floor(Math.random() * others.length)].id);
    }
    if (picks.length >= 2) return opts.onDone([picks[0], picks[1]]);
    cursor = Math.max(0, CHARACTERS.findIndex((c) => c.id === opts.initial?.[1]));
    paint();
  }

  const back = el.querySelector<HTMLButtonElement>('[data-a="back"]')!;
  el.querySelector('[data-a="ok"]')!.addEventListener('click', confirm, { signal: ac.signal });
  back.addEventListener('click', () => {
    if (picks.length > 0) {
      picks.pop();
      paint();
    } else opts.onBack();
  }, { signal: ac.signal });

  window.addEventListener('keydown', (e) => {
    const cols = getComputedStyle(cards).gridTemplateColumns.split(' ').length;
    const n = CHARACTERS.length;
    if (e.key === 'ArrowLeft') cursor = (cursor + n - 1) % n;
    else if (e.key === 'ArrowRight') cursor = (cursor + 1) % n;
    else if (e.key === 'ArrowUp') cursor = (cursor - cols + n) % n;
    else if (e.key === 'ArrowDown') cursor = (cursor + cols) % n;
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (!e.repeat) confirm();
      return;
    } else if (e.key === 'Escape') return back.click();
    else return;
    e.preventDefault();
    opts.audio.move();
    paint();
  }, { signal: ac.signal });

  root.appendChild(el);
  paint();
  return () => {
    ac.abort();
    el.remove();
  };
}
