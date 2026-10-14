import type { AudioManager } from '../audio/AudioManager';
import { PLAYER1_NAME, getPlayer2Name, setPlayer2Name } from '../game/players';
import { arrowNav, esc, html } from './dom';

export function showMainMenu(root: HTMLElement, opts: { audio: AudioManager; onPlay(players: 1 | 2): void }): () => void {
  const ac = new AbortController();
  const el = html(`
    <section class="screen menu" aria-label="Menú principal">
      <h1 class="title"><span>BENG BUGS</span><span>FIGHTERS</span></h1>
      <div class="menu-buttons">
        <button class="big-btn" data-p="1">1 JUGADOR</button>
        <button class="big-btn secondary" data-p="2">2 JUGADORES</button>
      </div>
      <label class="p2-name">Jugador 2 <input type="text" maxlength="12" value="${esc(getPlayer2Name())}" aria-label="Nombre del jugador 2" /></label>
      <p class="hint">Mantené apretado para lanzar. Después tocá muchas veces para girar más fuerte.<br/>
        En la compu: ${esc(PLAYER1_NAME)} usa <kbd>Espacio</kbd> y el jugador 2 usa <kbd>L</kbd>.<br/><small>v0.3.1</small></p>
    </section>`);
  root.appendChild(el);
  const nameInput = el.querySelector<HTMLInputElement>('.p2-name input')!;
  nameInput.addEventListener('input', () => setPlayer2Name(nameInput.value), { signal: ac.signal });
  // Que las flechas y la barra espaciadora puedan escribirse en el campo sin disparar el juego.
  nameInput.addEventListener('keydown', (e) => e.stopPropagation(), { signal: ac.signal });
  const buttons = [...el.querySelectorAll<HTMLButtonElement>('.menu-buttons button')];
  for (const b of buttons) {
    b.addEventListener('click', () => {
      opts.audio.select();
      opts.onPlay(Number(b.dataset.p) as 1 | 2);
    }, { signal: ac.signal });
  }
  arrowNav(buttons, ac.signal, () => opts.audio.move());
  buttons[0].focus({ preventScroll: true });
  return () => {
    ac.abort();
    el.remove();
  };
}

/** Botón de sonido, visible en todas las pantallas. */
export function mountTopBar(root: HTMLElement, audio: AudioManager): void {
  const bar = html(`<div class="top-bar"><button class="icon-btn" aria-pressed="false"></button></div>`);
  const sound = bar.querySelector<HTMLButtonElement>('button')!;
  const paint = () => {
    sound.innerHTML = audio.muted ? '🔇<span class="lbl"> Sonido apagado</span>' : '🔊<span class="lbl"> Sonido</span>';
    sound.setAttribute('aria-pressed', String(!audio.muted));
  };
  paint();
  sound.addEventListener('click', () => {
    audio.setMuted(!audio.muted);
    paint();
    audio.select();
    sound.blur();
  });
  root.appendChild(bar);
}
