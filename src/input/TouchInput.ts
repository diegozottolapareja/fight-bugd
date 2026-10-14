/** Botón táctil: sólo pointerdown (sin duplicados), sin scroll ni menú. */
export function bindPressButton(el: HTMLElement, onPress: () => void): () => void {
  const down = (e: PointerEvent) => {
    if (e.button > 0) return;
    e.preventDefault();
    el.classList.add('pressed');
    onPress();
  };
  const up = () => el.classList.remove('pressed');
  const block = (e: Event) => e.preventDefault();
  el.addEventListener('pointerdown', down);
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, up);
  el.addEventListener('contextmenu', block);
  el.addEventListener('touchstart', block, { passive: false });
  return () => {
    el.removeEventListener('pointerdown', down);
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.removeEventListener(ev, up);
    el.removeEventListener('contextmenu', block);
    el.removeEventListener('touchstart', block);
  };
}

export function isTouchDevice(): boolean {
  return window.matchMedia?.('(pointer: coarse)').matches;
}
