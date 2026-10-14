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

// Banner para instalar la app (sólo en el navegador, se puede cerrar y no vuelve a molestar).
const INSTALL_KEY = 'bbf-install-dismissed';
const standalone =
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const dismissed = (() => {
  try {
    return localStorage.getItem(INSTALL_KEY) === '1';
  } catch {
    return false;
  }
})();

function showInstallBanner(onInstall: (() => void) | null): void {
  if (standalone || dismissed || document.querySelector('.install-banner')) return;
  const bar = document.createElement('div');
  bar.className = 'install-banner';
  const text = document.createElement('span');
  text.textContent = onInstall ? '📲 Instalá la app en tu teléfono' : '📲 Para instalarla: tocá Compartir y "Agregar a inicio"';
  bar.appendChild(text);
  if (onInstall) {
    const go = document.createElement('button');
    go.className = 'install-go';
    go.textContent = 'Instalar';
    go.addEventListener('click', () => {
      onInstall();
      bar.remove();
    });
    bar.appendChild(go);
  }
  const close = document.createElement('button');
  close.className = 'install-close';
  close.setAttribute('aria-label', 'Cerrar');
  close.textContent = '✕';
  close.addEventListener('click', () => {
    bar.remove();
    try {
      localStorage.setItem(INSTALL_KEY, '1');
    } catch {
      /* sin almacenamiento: vuelve a aparecer la próxima vez */
    }
  });
  bar.appendChild(close);
  document.body.appendChild(bar);
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  const evt = e as Event & { prompt(): Promise<void> };
  showInstallBanner(() => void evt.prompt());
});
// iPhone/iPad no tienen el aviso automático: se explica a mano.
if (/iphone|ipad|ipod/i.test(navigator.userAgent)) window.addEventListener('load', () => showInstallBanner(null));
