/** Procedurally synthesised placeholder sounds (no external audio assets). */
export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  volume = 0.5;

  private ensure(): AudioContext | null {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext({ latencyHint: 'interactive' });
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate * 0.5;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      } catch { return null; }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    this.master!.gain.value = this.volume;
    return this.ctx;
  }

  unlock(): void { this.ensure(); }

  private burst(dur: number, freq: number, q: number, gain: number, type: BiquadFilterType = 'lowpass'): void {
    const c = this.ensure(); if (!c || !this.noise) return;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t, Math.random() * 0.2, dur + 0.02);
  }

  private tone(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', endFreq?: number): void {
    const c = this.ensure(); if (!c) return;
    const o = c.createOscillator();
    o.type = type;
    const t = c.currentTime;
    o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t); o.stop(t + dur + 0.02);
  }

  shot(heavy = false): void {
    this.burst(heavy ? 0.35 : 0.16, heavy ? 1800 : 3200, 0.7, 0.9);
    this.tone(heavy ? 90 : 140, heavy ? 0.25 : 0.1, 0.5, 'triangle', 50);
  }
  hitBody(): void { this.tone(1400, 0.05, 0.25, 'square'); }
  hitHead(): void { this.tone(2400, 0.09, 0.3, 'sine', 1900); this.burst(0.05, 6000, 1, 0.3, 'highpass'); }
  kill(): void { this.tone(880, 0.08, 0.3, 'sine'); setTimeout(() => this.tone(1320, 0.12, 0.3, 'sine'), 60); }
  reload(): void { this.burst(0.06, 2500, 2, 0.3, 'bandpass'); setTimeout(() => this.burst(0.08, 1800, 2, 0.35, 'bandpass'), 350); }
  empty(): void { this.tone(600, 0.04, 0.2, 'square'); }
  step(): void { this.burst(0.06, 500, 1, 0.15); }
}
