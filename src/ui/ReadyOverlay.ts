import { esc, html } from './dom';

/** Cuenta regresiva con el VS arriba. */
export function showReady(root: HTMLElement, names: [string, string], labels: [string, string]) {
  const el = html(`
    <section class="screen ready" aria-live="assertive">
      <div class="vs"><span class="badge p1">${esc(labels[0])}</span>${esc(names[0])}<span class="x">VS</span>${esc(names[1])}<span class="badge p2 ${labels[1] === 'CPU' ? 'cpu' : ''}">${esc(labels[1])}</span></div>
      <div class="count"></div>
    </section>`);
  root.appendChild(el);
  let count = el.querySelector<HTMLElement>('.count')!;
  return {
    setCount(text: string, go: boolean) {
      const n = html(`<div class="count${go ? ' go' : ''}"></div>`);
      n.textContent = text;
      count.replaceWith(n);
      count = n;
    },
    close() {
      el.remove();
    },
  };
}
