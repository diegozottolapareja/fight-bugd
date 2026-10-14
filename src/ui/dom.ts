export function html<T extends HTMLElement = HTMLElement>(markup: string): T {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild as T;
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Navegación con flechas entre botones. */
export function arrowNav(buttons: HTMLElement[], signal: AbortSignal, onMove?: () => void): void {
  window.addEventListener(
    'keydown',
    (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      e.preventDefault();
      const i = buttons.indexOf(document.activeElement as HTMLElement);
      const dir = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
      buttons[(Math.max(0, i) + dir + buttons.length) % buttons.length].focus();
      onMove?.();
    },
    { signal },
  );
}
