/** Nombres de los jugadores que se muestran en pantalla. */
export const PLAYER1_NAME = 'Joaquín';
export const DEFAULT_PLAYER2_NAME = 'Diego';
export const CPU_NAME = 'CPU';
const KEY = 'bbf-p2-name';

export function getPlayer2Name(): string {
  try {
    return localStorage.getItem(KEY)?.trim() || DEFAULT_PLAYER2_NAME;
  } catch {
    return DEFAULT_PLAYER2_NAME;
  }
}

export function setPlayer2Name(name: string): void {
  try {
    localStorage.setItem(KEY, name.trim().slice(0, 12));
  } catch {
    /* sin almacenamiento: el nombre vale sólo para esta sesión */
  }
}
