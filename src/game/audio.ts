// Procedural audio (Web Audio) - no samples. Her sey kodla sintez olunur.
type ShotKind = "pbow" | "sniper" | "glock" | "m16" | "aug" | "musket" | "bow";

// "In" miqyasi (D, Eb, G, A, Bb) - iki oktava
const SCALE = [146.83, 155.56, 196, 220, 233.08, 293.66, 311.13, 392, 440, 466.16];

export class Sfx {
  private ctx: AudioContext | null = null;
  private master!: GainNode; private sfxBus!: GainNode; private musicBus!: GainNode;
  private windGain!: GainNode; private reverb!: ConvolverNode; private noiseBuf!: AudioBuffer;
  private vol = 0.6;
  private nextMusic = 0; private nextCricket = 0; private lastStep = 0;

  constructor() {}

  unlock(): void {
    if (!this.ctx) this.init();
    const c = this.ctx;
    if (c && c.state === "suspended") void c.resume();
  }

  setMaster(v: number): void {
    this.vol = Math.min(1, Math.max(0, v));
    if (this.ctx) this.master.gain.setTargetAtTime(this.vol, this.ctx.currentTime, 0.05);
  }

  private init(): void {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const c = (this.ctx = new AC());
    this.master = c.createGain(); this.master.gain.value = this.vol; this.master.connect(c.destination);
    this.sfxBus = c.createGain(); this.sfxBus.connect(this.master);
    this.musicBus = c.createGain(); this.musicBus.gain.value = 0.25; this.musicBus.connect(this.master);
    // 1 saniyelik ag kuy bufer (hami paylasir)
    this.noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // reverb: 2.5 s eksponensial sonen kuy impulsu
    const len = Math.floor(c.sampleRate * 2.5), ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const o = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) o[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    this.reverb = c.createConvolver(); this.reverb.buffer = ir;
    const rg = c.createGain(); rg.gain.value = 0.8;
    this.reverb.connect(rg); rg.connect(this.musicBus);
    // kulek: bandpass kuy + yavas LFO
    const wsrc = this.noise(true);
    const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 600; bp.Q.value = 0.8;
    this.windGain = c.createGain(); this.windGain.gain.value = 0.05;
    wsrc.connect(bp); bp.connect(this.windGain); this.windGain.connect(this.master);
    const lfo = c.createOscillator(); lfo.frequency.value = 0.13;
    const lg = c.createGain(); lg.gain.value = 180; lfo.connect(lg); lg.connect(bp.frequency); lfo.start();
    const lfo2 = c.createOscillator(); lfo2.frequency.value = 0.07;
    const lg2 = c.createGain(); lg2.gain.value = 0.02; lfo2.connect(lg2); lg2.connect(this.windGain.gain); lfo2.start();
    this.nextMusic = c.currentTime + 4;
  }

  private noise(loop = false, at = 0): AudioBufferSourceNode {
    const s = this.ctx!.createBufferSource(); s.buffer = this.noiseBuf; s.loop = loop;
    s.playbackRate.value = loop ? 1 : 0.8 + Math.random() * 0.4;
    s.start(at); return s;
  }

  /** Mesafeye gore seviyye + lowpass; giris node-u qaytarir. */
  private out(dist = 0, gain = 1): AudioNode {
    const c = this.ctx!;
    const g = c.createGain(); g.gain.value = gain / (1 + dist / 25);
    const lp = c.createBiquadFilter(); lp.type = "lowpass";
    lp.frequency.value = 18000 - 16500 * Math.min(1, dist / 300);
    g.connect(lp); lp.connect(this.sfxBus);
    return g;
  }

  /** Filtrlenmis kuy partlayisi. */
  private burst(dst: AudioNode, t: number, dur: number, f: number, type: BiquadFilterType, vol: number, q = 1, fEnd = f): void {
    const c = this.ctx!, s = this.noise(false, t);
    const fl = c.createBiquadFilter(); fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(f, t); fl.frequency.exponentialRampToValueAtTime(Math.max(20, fEnd), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, 0); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(dst); s.stop(t + dur + 0.05);
  }

  /** Tonal ses (thump / ton). */
  private tone(dst: AudioNode, t: number, dur: number, f0: number, f1: number, vol: number, type: OscillatorType = "sine", attack = 0.003): void {
    const c = this.ctx!, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g); g.connect(dst); o.start(t); o.stop(t + dur + 0.05);
  }

  shot(kind: ShotKind, dist = 0): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.out(dist, 0.9);
    switch (kind) {
      case "sniper":
        this.burst(o, t, 0.12, 5000, "highpass", 0.9); this.tone(o, t, 0.25, 140, 40, 1);
        this.burst(o, t + 0.12, 1.2, 900, "lowpass", 0.35, 0.7, 120); // eks-seda quyrugu
        break;
      case "glock": this.burst(o, t, 0.06, 3500, "bandpass", 0.8, 1.5); this.tone(o, t, 0.05, 300, 90, 0.4); break;
      case "m16": case "aug":
        this.burst(o, t, 0.09, kind === "aug" ? 3000 : 4000, "bandpass", 0.9, 1.2, 800);
        this.tone(o, t, 0.08, 200, 60, 0.5); break;
      case "musket":
        this.tone(o, t, 0.3, 90, 35, 1); this.burst(o, t, 0.25, 700, "lowpass", 0.8);
        this.burst(o, t + 0.05, 0.7, 6000, "highpass", 0.12); break; // tustu fisiltisi
      case "bow": case "pbow":
        this.tone(o, t, 0.25, kind === "bow" ? 220 : 300, 180, 0.35, "triangle"); // simin zinqiltisi
        this.burst(o, t + 0.03, 0.3, 1500, "bandpass", 0.25, 2, 400); break; // fis
    }
  }

  sword(dist = 0): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.out(dist, 0.5);
    this.burst(o, t, 0.05, 6000, "highpass", 0.8);
    for (const f of [1800, 2870, 4310, 5900]) this.tone(o, t, 0.5 + Math.random() * 0.3, f, f * 0.995, 0.12);
  }

  cannon(dist = 0): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.out(dist, 1.2);
    this.tone(o, t, 0.8, 80, 25, 1.2); this.burst(o, t, 0.4, 1200, "lowpass", 1, 0.7, 100);
    this.burst(o, t + 0.1, 2.5, 200, "lowpass", 0.5, 0.7, 40); // gurultu quyrugu
  }

  boom(dist = 0): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.out(dist, 1);
    this.tone(o, t, 0.6, 100, 30, 1); this.burst(o, t, 1.2, 2500, "lowpass", 0.9, 0.8, 150);
  }

  step(run: boolean): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (t - this.lastStep < 0.12) return;
    this.lastStep = t;
    const o = this.out(0, run ? 0.35 : 0.2);
    this.burst(o, t, 0.09, 500 + Math.random() * 200, "lowpass", 0.8, 0.7, 150);
  }

  reload(kind: string): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.out(0, 0.5);
    if (kind === "bow" || kind === "pbow") {
      this.tone(o, t, 0.6, 140, 260, 0.15, "sawtooth", 0.3); // gerilen simin cirilti
      this.burst(o, t, 0.6, 900, "bandpass", 0.06, 4, 1400);
      return;
    }
    for (const dt of [0, 0.35, 0.55]) { // mexaniki klik-klaklar
      this.burst(o, t + dt, 0.03, 2500 + dt * 2000, "bandpass", 0.7, 3);
      this.tone(o, t + dt, 0.04, 900, 400, 0.15, "square");
    }
  }

  transform(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.out(0, 0.7);
    this.burst(o, t, 1.6, 200, "bandpass", 0.5, 2, 5000); // yukselen kuy
    this.tone(o, t, 1.8, 110, 440, 0.4, "sawtooth", 0.8);
    this.tone(o, t + 1.2, 1.6, 220, 220, 0.4, "sine", 0.1);
    this.tone(o, t + 1.2, 1.6, 331, 331, 0.2, "sine", 0.1); // qirmizi "guc" tonu (kvinta)
    this.tone(o, t + 1.2, 1.6, 55, 55, 0.5, "triangle", 0.1);
  }

  hit(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.out(0, 0.8);
    this.tone(o, t, 0.2, 120, 45, 0.9); this.burst(o, t, 0.12, 900, "lowpass", 0.6);
  }

  // ---- Atmosfer (~1x/s cagirilir) ----
  ambience(night: boolean, wind: number): void {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime;
    this.windGain.gain.setTargetAtTime(0.04 + 0.11 * Math.min(1, Math.max(0, wind)), t, 1.5);
    if (night && t >= this.nextCricket) {
      this.nextCricket = t + 1.5 + Math.random() * 4;
      const n = 3 + Math.floor(Math.random() * 4), base = 4200 + Math.random() * 600;
      for (let i = 0; i < n; i++) this.tone(this.sfxBus, t + 0.05 + i * 0.07, 0.04, base, base * 1.02, 0.012, "sine", 0.005);
    }
    if (t >= this.nextMusic) {
      this.nextMusic = t + 6 + Math.random() * 8;
      const pick = () => SCALE[Math.floor(Math.random() * SCALE.length)];
      this.pluck(pick(), t + 0.1);
      if (Math.random() < 0.5) this.pluck(pick(), t + 0.7 + Math.random() * 0.6);
      if (Math.random() < 0.25) this.flute(SCALE[5 + Math.floor(Math.random() * 5)], t + 1.5);
    }
  }

  /** Koto/shamisen kimi not: harmonikalar + suretli sonme, reverb-e gonderilir. */
  private pluck(f: number, t: number): void {
    const g = this.ctx!.createGain(); g.gain.value = 0.5;
    g.connect(this.musicBus); g.connect(this.reverb);
    [1, 2, 3, 4.01, 5.02].forEach((h, i) => this.tone(g, t, 2.2 / (1 + i * 0.7), f * h, f * h * 0.998, 0.3 / (1 + i), "sine", 0.004));
    this.burst(g, t, 0.03, 3000, "bandpass", 0.2, 1);
  }

  /** Shakuhachi kimi nefesli ton: yavas atak, vibrato, kuy qarisigi. */
  private flute(f: number, t: number): void {
    const c = this.ctx!, g = c.createGain(), dur = 3.5;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.25, t + 1);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    g.connect(this.musicBus); g.connect(this.reverb);
    const o = c.createOscillator(); o.frequency.value = f * 2;
    const v = c.createOscillator(), vg = c.createGain(); v.frequency.value = 5; vg.gain.value = f * 0.012;
    v.connect(vg); vg.connect(o.frequency); o.connect(g); o.start(t); v.start(t); o.stop(t + dur); v.stop(t + dur);
    const s = this.noise(false, t), bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = f * 2; bp.Q.value = 6;
    const ng = c.createGain(); ng.gain.value = 0.8; s.connect(bp); bp.connect(ng); ng.connect(g); s.stop(t + dur);
  }

  /** motosiklet mühərriki: speed null — susur; sürətə görə dövr (iki mişar dalğa + aşağı keçid filtri) */
  private eng: { o1: OscillatorNode; o2: OscillatorNode; g: GainNode; lp: BiquadFilterNode } | null = null;
  engine(speed: number | null): void {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    if (!this.eng) {
      const o1 = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
      o1.type = "sawtooth"; o2.type = "square"; lp.type = "lowpass"; lp.frequency.value = 600; g.gain.value = 0;
      o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(this.sfxBus); o1.start(); o2.start();
      this.eng = { o1, o2, g, lp };
    }
    const e = this.eng, v = Math.abs(speed ?? 0), rpm = 38 + v * 3.2 + Math.sin(t * 9) * 2;
    e.o1.frequency.setTargetAtTime(rpm, t, 0.08); e.o2.frequency.setTargetAtTime(rpm * 0.5, t, 0.08);
    e.lp.frequency.setTargetAtTime(400 + v * 40, t, 0.1);
    e.g.gain.setTargetAtTime(speed === null ? 0 : 0.07 + Math.min(0.08, v * 0.003), t, 0.15);
  }

  /** əjdaha alovu: gurultulu, xışıltılı alov axını */
  flame(dist = 0): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.out(dist, 0.9);
    this.burst(o, t, 0.5, 900, "bandpass", 0.7, 0.6, 400); this.burst(o, t, 0.45, 180, "lowpass", 0.8, 0.7, 90);
  }

  dispose(): void {
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
  }
}
