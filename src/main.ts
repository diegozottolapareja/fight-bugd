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

function showUpdateBanner(reg: ServiceWorkerRegistration): void {
  if (document.querySelector('.update-banner')) return;
  const b = document.createElement('button');
  b.className = 'update-banner';
  b.textContent = '🔄 Nueva versión — Actualizar';
  b.addEventListener('click', () => {
    b.disabled = true;
    b.textContent = 'Actualizando…';
    reg.waiting?.postMessage('SKIP_WAITING');
    setTimeout(() => location.reload(), 3000);
  });
  document.body.appendChild(b);
}

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        const hadController = !!navigator.serviceWorker.controller;
        const check = () => {
          if (reg.waiting && navigator.serviceWorker.controller) showUpdateBanner(reg);
        };
        check();
        reg.addEventListener('updatefound', () => {
          reg.installing?.addEventListener('statechange', check);
        });
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (hadController) location.reload();
        });
        const poll = () => void reg.update().catch(() => undefined);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') poll();
        });
        setInterval(poll, 60_000);
      })
      .catch(() => undefined);
  });
}
