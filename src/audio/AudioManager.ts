/**
 * All audio is synthesised at runtime with the Web Audio API.
 *
 * Nothing is loaded from disk or the network, which keeps the build tiny and
 * guarantees every sound and every note of music is original to this project.
 *
 * Autoplay policy is respected: the context is created lazily and only resumed
 * from inside a real user gesture (see `unlock`).
 */

export type SfxName =
  | "punch"
  | "kick"
  | "strong"
  | "block"
  | "jump"
  | "hit"
  | "ko"
  | "select"
  | "confirm"
  | "round"
  | "fight"
  | "reveal"
  | "firework";

type MusicTrack = "menu" | "fight" | "reveal" | null;

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  musicEnabled = true;
  sfxEnabled = true;

  private currentTrack: MusicTrack = null;
  /** Scheduler handle for the music sequencer. */
  private musicTimer: number | null = null;
  private nextNoteTime = 0;
  private step = 0;
  private unlocked = false;

  /**
   * Must be called from a user gesture. Safe to call repeatedly.
   */
  unlock(): void {
    if (!this.ctx) {
      const Ctor: typeof AudioContext =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();

      this.master = this.ctx.createGain();
      this.master.gain.value = 0.85;
      this.master.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicEnabled ? 0.34 : 0;
      this.musicGain.connect(this.master);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxEnabled ? 0.6 : 0;
      this.sfxGain.connect(this.master);
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    this.unlocked = true;
  }

  get ready(): boolean {
    return this.unlocked && this.ctx !== null && this.ctx.state === "running";
  }

  setMusicEnabled(on: boolean): void {
    this.musicEnabled = on;
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(on ? 0.34 : 0, this.ctx.currentTime, 0.05);
    }
  }

  setSfxEnabled(on: boolean): void {
    this.sfxEnabled = on;
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(on ? 0.6 : 0, this.ctx.currentTime, 0.05);
    }
  }

  // ---------------------------------------------------------------- sfx ----

  private env(
    node: AudioNode,
    attack: number,
    decay: number,
    peak: number,
    when: number,
  ): GainNode {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + attack + decay);
    node.connect(g);
    g.connect(this.sfxGain!);
    return g;
  }

  /** Filtered noise burst, the basis of every impact sound. */
  private noise(
    when: number,
    duration: number,
    filterType: BiquadFilterType,
    freq: number,
    peak: number,
    q = 1,
  ): void {
    const ctx = this.ctx!;
    const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      // Slight downward bias over the burst makes it feel like an impact.
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 0.35;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq, when);
    filter.Q.value = q;
    src.connect(filter);

    this.env(filter, 0.004, duration, peak, when);
    src.start(when);
    src.stop(when + duration + 0.02);
  }

  /** Pitched tone with an envelope. */
  private tone(
    when: number,
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType,
    peak: number,
    target?: GainNode,
  ): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    if (endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), when + duration);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(g);
    g.connect(target ?? this.sfxGain!);
    osc.start(when);
    osc.stop(when + duration + 0.02);
  }

  play(name: SfxName): void {
    if (!this.ready || !this.sfxEnabled) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;

    switch (name) {
      case "punch":
        // Short, tight, mid-high slap.
        this.noise(t, 0.09, "bandpass", 1750, 0.5, 1.4);
        this.tone(t, 300, 150, 0.07, "square", 0.1);
        break;
      case "kick":
        // Meatier, lower, a touch longer.
        this.noise(t, 0.15, "bandpass", 900, 0.6, 1.1);
        this.tone(t, 190, 80, 0.13, "square", 0.16);
        break;
      case "strong":
        // Big layered crunch with a sub thump and a metallic ring.
        this.noise(t, 0.3, "lowpass", 1500, 0.75, 0.8);
        this.tone(t, 130, 42, 0.3, "sawtooth", 0.26);
        this.tone(t + 0.01, 520, 200, 0.22, "square", 0.12);
        this.noise(t + 0.02, 0.16, "highpass", 3600, 0.28);
        break;
      case "block":
        // Hard, bright, non-damaging clank.
        this.noise(t, 0.11, "highpass", 2900, 0.42, 2);
        this.tone(t, 780, 620, 0.09, "square", 0.12);
        break;
      case "jump":
        this.tone(t, 260, 700, 0.13, "square", 0.13);
        break;
      case "hit":
        this.noise(t, 0.12, "bandpass", 1200, 0.35, 1.2);
        break;
      case "ko": {
        // Descending stinger plus a long noise wash.
        this.noise(t, 0.7, "lowpass", 1100, 0.6, 0.7);
        const notes = [440, 349, 262, 196];
        notes.forEach((f, i) => {
          this.tone(t + i * 0.11, f, f * 0.94, 0.34, "square", 0.22);
        });
        this.tone(t, 90, 30, 0.9, "sawtooth", 0.3);
        break;
      }
      case "select":
        this.tone(t, 660, 660, 0.05, "square", 0.14);
        break;
      case "confirm":
        this.tone(t, 523, 523, 0.07, "square", 0.16);
        this.tone(t + 0.07, 784, 784, 0.1, "square", 0.16);
        this.tone(t + 0.16, 1047, 1047, 0.14, "square", 0.14);
        break;
      case "round":
        this.tone(t, 392, 392, 0.16, "square", 0.2);
        this.tone(t + 0.18, 523, 523, 0.2, "square", 0.2);
        break;
      case "fight":
        // Rising fanfare.
        [392, 523, 659, 784].forEach((f, i) => {
          this.tone(t + i * 0.075, f, f, 0.2, "square", 0.24);
        });
        this.noise(t + 0.3, 0.4, "highpass", 2000, 0.2);
        break;
      case "reveal": {
        // Big ascending arpeggio into a sustained chord.
        const scale = [523, 659, 784, 1047, 1319];
        scale.forEach((f, i) => {
          this.tone(t + i * 0.1, f, f, 0.5, "square", 0.2);
        });
        [523, 659, 784, 1047].forEach((f) => {
          this.tone(t + 0.55, f, f, 1.6, "triangle", 0.16);
        });
        break;
      }
      case "firework":
        this.noise(t, 0.35, "highpass", 2200, 0.4);
        this.tone(t, 900, 200, 0.2, "triangle", 0.1);
        break;
    }
  }

  // -------------------------------------------------------------- music ----

  /**
   * Simple step sequencer. Each track is a set of patterns evaluated per 16th
   * note, scheduled slightly ahead of the clock so timing stays solid.
   */
  playMusic(track: Exclude<MusicTrack, null>): void {
    if (!this.ready) return;
    if (this.currentTrack === track) return;
    this.stopMusic();
    this.currentTrack = track;
    this.step = 0;
    this.nextNoteTime = this.ctx!.currentTime + 0.08;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 25);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.currentTrack = null;
  }

  private scheduleMusic(): void {
    if (!this.ctx || !this.currentTrack) return;
    const ctx = this.ctx;
    // Tempo per track.
    const bpm = this.currentTrack === "fight" ? 148 : this.currentTrack === "reveal" ? 128 : 112;
    const stepDur = 60 / bpm / 4;

    while (this.nextNoteTime < ctx.currentTime + 0.15) {
      this.playStep(this.step, this.nextNoteTime, stepDur);
      this.nextNoteTime += stepDur;
      this.step = (this.step + 1) % 64;
    }
  }

  private musicTone(
    when: number,
    freq: number,
    duration: number,
    type: OscillatorType,
    peak: number,
  ): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(g);
    g.connect(this.musicGain!);
    osc.start(when);
    osc.stop(when + duration + 0.02);
  }

  private drum(when: number, kind: "kick" | "snare" | "hat"): void {
    const ctx = this.ctx!;
    if (kind === "kick") {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(150, when);
      osc.frequency.exponentialRampToValueAtTime(45, when + 0.13);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.5, when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.16);
      osc.connect(g);
      g.connect(this.musicGain!);
      osc.start(when);
      osc.stop(when + 0.18);
      return;
    }
    const dur = kind === "snare" ? 0.13 : 0.05;
    const frames = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = kind === "snare" ? "bandpass" : "highpass";
    filt.frequency.value = kind === "snare" ? 1800 : 7000;
    const g = ctx.createGain();
    g.gain.value = kind === "snare" ? 0.28 : 0.12;
    src.connect(filt);
    filt.connect(g);
    g.connect(this.musicGain!);
    src.start(when);
  }

  /** One 16th-note step of the current track. */
  private playStep(step: number, when: number, dur: number): void {
    const track = this.currentTrack;
    if (!track) return;
    const bar = Math.floor(step / 16);
    const s = step % 16;

    if (track === "menu") {
      // Laid-back arcade attract-mode loop in A minor.
      const bass = [110, 110, 0, 110, 0, 98, 0, 98, 87, 0, 87, 0, 98, 0, 110, 0];
      if (bass[s]) this.musicTone(when, bass[s], dur * 1.8, "triangle", 0.22);
      const lead = [
        0, 440, 0, 523, 0, 0, 659, 0, 0, 587, 0, 523, 0, 440, 0, 0,
      ];
      if (lead[s]) this.musicTone(when, lead[s], dur * 2.2, "square", 0.09);
      if (s % 4 === 0) this.drum(when, "kick");
      if (s === 8) this.drum(when, "snare");
      if (s % 2 === 1) this.drum(when, "hat");
      return;
    }

    if (track === "fight") {
      // Driving, aggressive loop. The bassline shifts every two bars and a
      // counter-melody enters later so the fight builds tension over time.
      const roots = [82.4, 82.4, 110, 98];
      const root = roots[bar % 4];
      const pattern = [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1];
      if (pattern[s]) {
        const oct = s === 6 || s === 14 ? 2 : 1;
        this.musicTone(when, root * oct, dur * 1.3, "sawtooth", 0.2);
      }

      // Lead riff, pentatonic, enters on alternating bars.
      if (bar % 2 === 1) {
        const riff = [
          659, 0, 0, 784, 0, 659, 0, 587, 0, 0, 494, 0, 587, 0, 659, 0,
        ];
        if (riff[s]) this.musicTone(when, riff[s], dur * 1.6, "square", 0.085);
      }

      // Stabs on the offbeat for urgency.
      if (bar % 4 === 3 && (s === 3 || s === 11)) {
        this.musicTone(when, root * 4, dur * 0.9, "square", 0.07);
      }

      if (s % 4 === 0 || s === 10) this.drum(when, "kick");
      if (s === 4 || s === 12) this.drum(when, "snare");
      this.drum(when, "hat");
      return;
    }

    // reveal: bright, major, celebratory
    const chords = [
      [523, 659, 784],
      [587, 740, 880],
      [659, 831, 988],
      [587, 740, 880],
    ];
    const chord = chords[bar % 4];
    if (s === 0 || s === 8) {
      for (const f of chord) this.musicTone(when, f, dur * 7, "triangle", 0.13);
    }
    const melody = [
      1047, 0, 1319, 0, 1568, 0, 1319, 0, 1047, 0, 1319, 0, 1568, 0, 2093, 0,
    ];
    if (melody[s]) this.musicTone(when, melody[s], dur * 2, "square", 0.1);
    if (s % 4 === 0) this.drum(when, "kick");
    if (s % 8 === 4) this.drum(when, "snare");
    if (s % 2 === 0) this.drum(when, "hat");
  }
}

export const audio = new AudioManager();
