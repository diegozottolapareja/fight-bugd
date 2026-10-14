/** Sonidos sintetizados (sin archivos). Se habilitan con el primer toque. */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;
  private lastHit = 0;

  constructor() {
    try {
      this.muted = localStorage.getItem('spinner-muted') === '1';
    } catch {
      /* sin almacenamiento */
    }
    const unlock = () => {
      this.ensure();
      if (this.ctx?.state === 'suspended') void this.ctx.resume();
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    return this.ctx;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
    try {
      localStorage.setItem('spinner-muted', m ? '1' : '0');
    } catch {
      /* ignorar */
    }
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.25, slideTo?: number, delay = 0): void {
    const ctx = this.ensure();
    if (!ctx || !this.master || this.muted) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, freq = 1800): void {
    const ctx = this.ensure();
    if (!ctx || !this.master || this.muted) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.master);
    src.start();
  }

  select(): void {
    this.tone(660, 0.08, 'square', 0.15);
    this.tone(990, 0.08, 'square', 0.12, undefined, 0.06);
  }

  move(): void {
    this.tone(440, 0.05, 'triangle', 0.12);
  }

  countdown(go: boolean): void {
    if (go) this.tone(880, 0.35, 'square', 0.22, 1320);
    else this.tone(523, 0.18, 'square', 0.2);
  }

  launch(): void {
    this.noise(0.5, 0.35, 900);
    this.tone(200, 0.5, 'sawtooth', 0.12, 900);
  }

  press(player: 0 | 1): void {
    this.tone(player === 0 ? 700 : 820, 0.035, 'triangle', 0.06);
  }

  hit(intensity: number): void {
    const now = performance.now();
    if (now - this.lastHit < 60) return;
    this.lastHit = now;
    const k = Math.min(1, intensity / 9);
    this.noise(0.12 + k * 0.15, 0.25 + k * 0.4, 2400 - k * 1200);
    this.tone(180 + k * 120, 0.1, 'square', 0.08 + k * 0.1, 90);
  }

  /** Poder: zumbido de carga que sube + ráfaga + explosión con acorde. */
  special(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master || this.muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(880, t + 0.7);
    lfo.frequency.setValueAtTime(8, t);
    lfo.frequency.linearRampToValueAtTime(22, t + 0.7);
    lfoGain.gain.value = 25;
    lfo.connect(lfoGain).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    o.connect(g).connect(this.master);
    o.start(t);
    lfo.start(t);
    o.stop(t + 0.85);
    lfo.stop(t + 0.85);
    const len = Math.floor(ctx.sampleRate * 0.8);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(4000, t + 0.7);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.35, t + 0.55);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    src.connect(f).connect(ng).connect(this.master);
    src.start(t);
    [523, 659, 784, 1047].forEach((fr) => this.tone(fr, 0.45, 'square', 0.1, undefined, 0.72));
    this.tone(160, 0.5, 'sine', 0.5, 40, 0.72);
  }

  turn(): void {
    this.tone(784, 0.1, 'triangle', 0.18);
    this.tone(1046, 0.14, 'triangle', 0.18, undefined, 0.1);
  }

  burst(): void {
    this.noise(0.8, 0.7, 700);
    this.tone(300, 0.6, 'sawtooth', 0.15, 60);
  }

  victory(): void {
    [523, 659, 784, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.2, 'square', 0.16, undefined, i * 0.13));
  }
}
