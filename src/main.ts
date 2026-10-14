import './styles/main.css';
import { Game } from './game/Game';

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const ui = document.querySelector<HTMLElement>('#ui')!;

document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
document.addEventListener(
  'touchmove',
  (e) => {
    if (!(e.target as HTMLElement).closest?.('.select')) e.preventDefault();
  },
  { passive: false },
);

ui.innerHTML = '<div class="screen"><p class="loading">Cargando estadio…</p></div>';

async function boot(): Promise<void> {
  try {
    await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 1500))]);
    ui.innerHTML = '';
    const game = new Game(canvas, ui);
    await game.start();
  } catch (err) {
    console.error(err);
    ui.innerHTML =
      '<div class="screen"><p class="error">No se pudo iniciar el juego. Probá con un navegador actualizado (Chrome, Safari o Firefox).</p></div>';
  }
}
void boot();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => undefined));
}
