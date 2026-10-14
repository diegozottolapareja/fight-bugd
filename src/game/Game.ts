import { AudioManager } from '../audio/AudioManager';
import { CHARACTERS, getCharacter, type CharacterDefinition } from '../characters/characterDefinitions';
import { KeyboardInput, KEYMAP_1P, KEYMAP_2P } from '../input/KeyboardInput';
import { isTouchDevice } from '../input/TouchInput';
import { SceneRenderer } from '../rendering/SceneRenderer';
import { BattleHUD } from '../ui/BattleHUD';
import { showCharacterSelection } from '../ui/CharacterSelection';
import { showLaunch } from '../ui/LaunchOverlay';
import { mountTopBar, showMainMenu } from '../ui/MainMenu';
import { showReady } from '../ui/ReadyOverlay';
import { showResults } from '../ui/ResultsScreen';
import { BattleController, type BattleEvent, type BattleMode } from './BattleController';
import { CpuController } from './CpuController';
import { BATTLE_CONFIG } from './GameConfig';
import { GameStateMachine } from './GameState';

/** ?turnos=1 fuerza 2J por turnos; ?turnos=0 fuerza teclado. */
const params = new URLSearchParams(location.search);

export class Game {
  readonly state = new GameStateMachine();
  private readonly audio = new AudioManager();
  private readonly renderer: SceneRenderer;
  private readonly touch = isTouchDevice();
  private battle: BattleController | null = null;
  private demoCpus: CpuController[] = [];
  private hud: BattleHUD | null = null;
  private closeScreen: (() => void) | null = null;
  private keyboard = new KeyboardInput(KEYMAP_1P);
  private match: { players: 1 | 2; ids: [string, string] } | null = null;
  private labels: [string, string] = ['J1', 'CPU'];
  private lastFrame = performance.now();
  private resultTimer = 0;
  private timers: number[] = [];
  private token = 0;

  constructor(canvas: HTMLCanvasElement, private readonly ui: HTMLElement) {
    this.renderer = new SceneRenderer(canvas);
    mountTopBar(ui, this.audio);
    this.bindKeys();
    this.state.onChange((to) => document.body.setAttribute('data-phase', to));
    document.body.setAttribute('data-phase', this.state.phase);
  }

  async start(): Promise<void> {
    await this.startDemo();
    this.showMenu();
    requestAnimationFrame(this.loop);
  }

  private loop = (now: number): void => {
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    let alpha = 1;
    const phase = this.state.phase;
    if (this.battle) {
      if (phase === 'MAIN_MENU' || phase === 'CHARACTER_SELECTION') {
        this.driveDemo();
        alpha = this.battle.advance(dt * 1000);
      } else if (phase === 'BATTLE' || phase === 'RESULT') {
        alpha = this.battle.advance(dt * 1000);
      }
    }
    this.hud?.update();
    this.renderer.render(this.battle, alpha, dt, phase === 'READY' || phase === 'BATTLE');
    requestAnimationFrame(this.loop);
  };

  private bindKeys(): void {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.key.startsWith('Arrow')) e.preventDefault();
      if (this.state.phase !== 'BATTLE' || !this.battle) return;
      const player = this.keyboard.handleKeyDown(e);
      if (player !== null) this.humanPress(player);
    });
    window.addEventListener('keyup', (e) => this.keyboard.handleKeyUp(e));
    window.addEventListener('blur', () => this.keyboard.reset());
  }

  private humanPress(player: 0 | 1): void {
    if (!this.battle || this.state.phase !== 'BATTLE') return;
    if (this.battle.press(player).accepted) {
      this.audio.press(player);
      this.hud?.flashPress(player);
    }
  }

  // ---------- Pelea de fondo en el menú ----------
  private async startDemo(): Promise<void> {
    const token = ++this.token;
    const a = Math.floor(Math.random() * CHARACTERS.length);
    const b = (a + 1 + Math.floor(Math.random() * (CHARACTERS.length - 1))) % CHARACTERS.length;
    const battle = await BattleController.create({ characters: [CHARACTERS[a], CHARACTERS[b]], mode: 'versus', seed: Math.floor(Math.random() * 1000) });
    if (token !== this.token) return battle.dispose();
    battle.launch([0.5 + Math.random() * 0.5, 0.5 + Math.random() * 0.5]);
    this.replaceBattle(battle);
    this.demoCpus = [new CpuController(Math.random() * 1e6), new CpuController(Math.random() * 1e6)];
    this.renderer.setBattle([CHARACTERS[a], CHARACTERS[b]], null);
    battle.on((e) => {
      this.renderer.onBattleEvent(e, battle);
      if (e.type === 'end') {
        window.setTimeout(() => {
          if (this.battle === battle && (this.state.phase === 'MAIN_MENU' || this.state.phase === 'CHARACTER_SELECTION')) void this.startDemo();
        }, 1800);
      }
    });
  }

  private driveDemo(): void {
    const b = this.battle;
    if (!b || this.demoCpus.length !== 2 || b.result) return;
    for (const i of [0, 1] as const) for (const _ of this.demoCpus[i].pressesUntil(b.timeMs, b.spinners[i].energy)) b.press(i);
  }

  private replaceBattle(b: BattleController | null): void {
    this.battle?.dispose();
    this.battle = b;
  }

  // ---------- Pantallas ----------
  private swapScreen(close: (() => void) | null): void {
    this.closeScreen?.();
    this.closeScreen = close;
  }

  private showMenu(): void {
    this.swapScreen(showMainMenu(this.ui, { audio: this.audio, onPlay: (players) => this.showSelection(players) }));
  }

  private showSelection(players: 1 | 2): void {
    if (this.state.phase !== 'CHARACTER_SELECTION') this.state.go('CHARACTER_SELECTION');
    this.swapScreen(
      showCharacterSelection(this.ui, {
        players,
        audio: this.audio,
        initial: this.match?.players === players ? this.match.ids : undefined,
        onDone: (ids) => {
          this.match = { players, ids };
          void this.startMatch();
        },
        onBack: () => this.goMenu(),
      }),
    );
  }

  private battleMode(players: 1 | 2): BattleMode {
    if (players === 1) return 'cpu';
    const forced = params.get('turnos');
    if (forced === '1') return 'turns';
    if (forced === '0') return 'versus';
    return this.touch ? 'turns' : 'versus';
  }

  private async startMatch(): Promise<void> {
    if (!this.match) return;
    const token = ++this.token;
    const { players, ids } = this.match;
    const defs: [CharacterDefinition, CharacterDefinition] = [getCharacter(ids[0]), getCharacter(ids[1])];
    this.labels = players === 1 ? ['J1', 'CPU'] : ['J1', 'J2'];
    this.keyboard = new KeyboardInput(players === 1 ? KEYMAP_1P : KEYMAP_2P);
    const battle = await BattleController.create({ characters: defs, mode: this.battleMode(players), seed: Math.floor(Math.random() * 100000) });
    if (token !== this.token) return battle.dispose();
    this.demoCpus = [];
    this.replaceBattle(battle);
    battle.on((e) => this.onBattleEvent(e));
    this.ready();
  }

  /** READY: lanzamiento con barra → cuenta regresiva → BATTLE. */
  private ready(): void {
    const battle = this.battle!;
    this.state.go('READY');
    this.clearTimers();
    this.renderer.setBattle([battle.spinners[0].def, battle.spinners[1].def], this.labels);
    this.hud?.destroy();
    this.hud = null;
    const launchers = ([0, 1] as const).map((i) => ({
      player: i,
      label: this.labels[i],
      name: battle.spinners[i].def.name,
      sprite: battle.spinners[i].def.visual.sprite,
      cpu: this.labels[i] === 'CPU',
      key: i === 0 ? 'Space' : 'KeyL',
    }));
    this.swapScreen(showLaunch(this.ui, { launchers, touch: this.touch, audio: this.audio, onDone: (p) => this.countdown(p) }));
  }

  private countdown(powers: [number, number]): void {
    const battle = this.battle!;
    const overlay = showReady(this.ui, [battle.spinners[0].def.name, battle.spinners[1].def.name], this.labels);
    this.swapScreen(() => overlay.close());
    const step = BATTLE_CONFIG.countdownStepMs;
    ['3', '2', '1'].forEach((n, i) =>
      this.timers.push(window.setTimeout(() => {
        overlay.setCount(n, false);
        this.audio.countdown(false);
      }, i * step)),
    );
    this.timers.push(window.setTimeout(() => {
      overlay.setCount('¡A GIRAR!', true);
      this.audio.countdown(true);
      this.audio.launch();
      battle.launch(powers);
      this.beginBattle();
    }, 3 * step));
    this.timers.push(window.setTimeout(() => overlay.close(), 3 * step + 700));
  }

  private clearTimers(): void {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
  }

  private beginBattle(): void {
    if (this.state.phase !== 'READY' || !this.battle) return;
    this.state.go('BATTLE');
    this.keyboard.reset();
    this.lastFrame = performance.now();
    this.hud = new BattleHUD(this.ui, {
      battle: this.battle,
      labels: this.labels,
      touch: this.touch,
      onPress: (p) => this.humanPress(p),
      onQuit: () => this.goMenu(),
    });
    if (this.battle.turns) this.hud.announce('¡Turno de J1!', 0);
  }

  private onBattleEvent(e: BattleEvent): void {
    const battle = this.battle;
    if (!battle) return;
    this.renderer.onBattleEvent(e, battle);
    switch (e.type) {
      case 'hit':
        this.audio.hit(e.intensity);
        break;
      case 'special':
        this.audio.special();
        this.hud?.announce(`¡${e.character.toUpperCase()} ACTIVÓ ${e.name.toUpperCase()}!`, e.player);
        break;
      case 'burst':
        this.audio.burst();
        break;
      case 'fall':
        this.hud?.announce(`¡${battle.spinners[e.player].def.name.toUpperCase()} SE CAYÓ!`, e.player);
        break;
      case 'turn':
        this.audio.turn();
        this.hud?.announce(`¡Turno de J${e.player + 1}!`, e.player);
        break;
      case 'end':
        this.resultTimer = window.setTimeout(() => this.showResult(), BATTLE_CONFIG.resultDelayMs);
        break;
    }
  }

  private showResult(): void {
    const battle = this.battle;
    if (!battle?.result || this.state.phase !== 'BATTLE') return;
    this.state.go('RESULT');
    this.hud?.destroy();
    this.hud = null;
    this.audio.victory();
    this.swapScreen(
      showResults(this.ui, {
        result: battle.result,
        defs: [battle.spinners[0].def, battle.spinners[1].def],
        labels: this.labels,
        audio: this.audio,
        onRematch: () => {
          battle.reset();
          this.ready();
        },
        onSelect: () => {
          this.leaveBattle();
          this.state.go('CHARACTER_SELECTION');
          void this.startDemo();
          this.showSelection(this.match?.players ?? 1);
        },
        onMenu: () => this.goMenu(),
      }),
    );
  }

  private leaveBattle(): void {
    clearTimeout(this.resultTimer);
    this.clearTimers();
    this.hud?.destroy();
    this.hud = null;
  }

  private goMenu(): void {
    this.leaveBattle();
    if (this.state.phase !== 'MAIN_MENU') this.state.go('MAIN_MENU');
    void this.startDemo();
    this.showMenu();
  }
}
