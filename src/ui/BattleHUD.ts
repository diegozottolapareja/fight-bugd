import type { BattleController } from '../game/BattleController';
import { bindPressButton } from '../input/TouchInput';
import { esc, html } from './dom';

export interface HudOptions {
  battle: BattleController;
  labels: [string, string];
  touch: boolean;
  onPress(player: 0 | 1): void;
  onQuit(): void;
}

/** HUD: nombre, Vida, Giro, combo, turno y avisos. */
export class BattleHUD {
  readonly el: HTMLElement;
  private panels: HTMLElement[] = [];
  private bars: Array<{ life: HTMLElement; lifeLbl: HTMLElement; lifeM: HTMLElement; spin: HTMLElement; spinLbl: HTMLElement; spinM: HTMLElement }> = [];
  private pips: HTMLElement[][] = [];
  private comboTexts: HTMLElement[] = [];
  private turnBanner: HTMLElement | null = null;
  private spinBtn: HTMLButtonElement | null = null;
  private unbind: Array<() => void> = [];
  private last = { life: [-1, -1], e: [-1, -1], c: [-1, -1], turn: '' };

  constructor(root: HTMLElement, private readonly opts: HudOptions) {
    const { battle, labels } = opts;
    const threshold = battle.spinners[0].ctrl.combo.threshold;
    const mode = battle.setup.mode;
    this.el = html(`<div class="screen hud"></div>`);

    battle.spinners.forEach((s, i) => {
      const key = mode === 'cpu' ? (i === 0 ? 'Espacio' : '') : mode === 'versus' ? (i === 0 ? 'Espacio' : 'L') : '';
      const panel = html(`
        <div class="panel ${i === 0 ? 'left' : 'right'} p${i + 1}">
          <div class="row">
            <span class="badge p${i + 1} ${battle.setup.mode === 'cpu' && i === 1 ? 'cpu' : ''}">${esc(labels[i])}</span>
            <span class="pname">${esc(s.def.name)}</span>
            ${key && !opts.touch ? `<span class="keycap">${key}</span>` : ''}
          </div>
          <div class="meter life"><div class="fill"></div><div class="label">❤ Vida</div></div>
          <div class="meter energy"><div class="fill"></div><div class="label">Giro</div></div>
          <div class="pips">${'<i></i>'.repeat(threshold)}</div>
          <div class="combo-text">Combo 0 de ${threshold}</div>
        </div>`);
      this.el.appendChild(panel);
      this.panels.push(panel);
      const life = panel.querySelector<HTMLElement>('.meter.life')!;
      const spin = panel.querySelector<HTMLElement>('.meter.energy')!;
      this.bars.push({
        lifeM: life, life: life.querySelector('.fill')!, lifeLbl: life.querySelector('.label')!,
        spinM: spin, spin: spin.querySelector('.fill')!, spinLbl: spin.querySelector('.label')!,
      });
      this.pips.push([...panel.querySelectorAll<HTMLElement>('.pips i')]);
      this.comboTexts.push(panel.querySelector('.combo-text')!);
    });

    if (mode === 'turns') {
      this.turnBanner = html(`<div class="turn-banner"><div class="ttext"></div><div class="tbar"><i></i></div></div>`);
      this.el.appendChild(this.turnBanner);
    }

    if (opts.touch && mode === 'versus') {
      // 2 jugadores en el celular: un botón a cada lado, se pueden apretar a la vez.
      ([0, 1] as const).forEach((p) => {
        const btn = html<HTMLButtonElement>(`<button class="spin-btn side p${p + 1} ${p === 0 ? 'left' : 'right'}" aria-label="Girar ${esc(labels[p])}">¡GIRA!<small>${esc(labels[p])}</small></button>`);
        this.el.appendChild(btn);
        this.unbind.push(bindPressButton(btn, () => opts.onPress(p)));
      });
    } else if (opts.touch || mode === 'cpu') {
      this.spinBtn = html<HTMLButtonElement>(`<button class="spin-btn p1" aria-label="Girar">¡GIRA!<small>${esc(labels[0])}</small></button>`);
      this.el.appendChild(this.spinBtn);
      this.unbind.push(bindPressButton(this.spinBtn, () => opts.onPress(battle.turns ? battle.turns.activePlayer : 0)));
    } else {
      this.el.appendChild(html(`<p class="hint keys-hint">${esc(labels[0])}: <kbd>Espacio</kbd> &nbsp; ${esc(labels[1])}: <kbd>L</kbd></p>`));
    }

    root.appendChild(this.el);
    this.update();
  }

  flashPress(player: 0 | 1): void {
    const p = this.panels[player];
    p.style.transform = 'scale(1.04)';
    setTimeout(() => (p.style.transform = ''), 70);
  }

  announce(text: string, player?: 0 | 1): void {
    this.el.querySelector('.announce')?.remove();
    const a = html(`<div class="announce ${player === undefined ? '' : `p${player + 1}c`}" role="status">${esc(text)}</div>`);
    this.el.appendChild(a);
    setTimeout(() => a.remove(), 1700);
  }

  update(): void {
    const b = this.opts.battle;
    b.spinners.forEach((s, i) => {
      const bar = this.bars[i];
      const life = Math.ceil(s.life * 100);
      if (life !== this.last.life[i]) {
        this.last.life[i] = life;
        bar.life.style.width = `${life}%`;
        bar.lifeLbl.textContent = `❤ Vida ${life}`;
        bar.lifeM.classList.toggle('low', life < 30);
      }
      const e = Math.ceil(s.energy);
      if (e !== this.last.e[i]) {
        this.last.e[i] = e;
        bar.spin.style.width = `${s.energyRatio * 100}%`;
        bar.spinLbl.textContent = `Giro ${e}`;
      }
      const c = s.ctrl.combo.count;
      if (c !== this.last.c[i]) {
        this.last.c[i] = c;
        this.pips[i].forEach((pip, k) => pip.classList.toggle('on', k < c));
        this.comboTexts[i].textContent = `Combo ${c} de ${s.ctrl.combo.threshold}`;
      }
    });

    if (b.turns && this.turnBanner) {
      const p = b.turns.activePlayer;
      const key = `${p}-${b.turns.inTransition}`;
      if (key !== this.last.turn) {
        this.last.turn = key;
        this.turnBanner.querySelector('.ttext')!.textContent = b.turns.inTransition ? `¡Ahora ${this.opts.labels[p]}!` : `Turno de ${this.opts.labels[p]}`;
        this.turnBanner.style.background = p === 0 ? 'var(--p1)' : 'var(--p2)';
        this.turnBanner.style.color = p === 0 ? '#fff' : 'var(--ink)';
        this.panels.forEach((panel, i) => {
          panel.classList.toggle('turn', i === p);
          panel.classList.toggle('dim', i !== p);
        });
        if (this.spinBtn) {
          this.spinBtn.className = `spin-btn p${p + 1} ${b.turns.inTransition ? 'wait' : ''}`;
          this.spinBtn.innerHTML = `${b.turns.inTransition ? '¡LISTO!' : '¡GIRA!'}<small>${esc(this.opts.labels[p])}</small>`;
        }
      }
      this.turnBanner.querySelector<HTMLElement>('.tbar i')!.style.width = `${b.turns.windowProgress * 100}%`;
    }
  }

  destroy(): void {
    for (const u of this.unbind) u();
    this.el.remove();
  }
}
