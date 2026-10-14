"use client";

// ═══════════════════════════════════════════════════════════════════
// Paysage sonore de NOS RACINES — une forêt calme, délicate et nette.
//
// • Ambiance : vent doux dans les branches, bruissement de feuilles, oiseaux lointains.
// • Interactions : feuilles froissées au toucher, clochette en bois, souffle entre les pages.
//
// Si de vrais enregistrements sont déposés dans /public/sons/ (voir README), ils sont joués en priorité.
// Sinon, tout est synthétisé en direct avec la Web Audio API : aucun fichier à télécharger,
// donc rien à charger en 3G.
// ═══════════════════════════════════════════════════════════════════

export type Cue = "tap" | "chime" | "whoosh" | "success" | "bell" | "seal" | "earth" | "candle";

// Les enregistrements réels sont déclarés dans /public/sons/manifest.json, par exemple :
// { "ambience": "/sons/foret-ambiance.mp3", "birds": ["/sons/oiseau-1.mp3", "/sons/oiseau-2.mp3"] }

const STORAGE_KEY = "nr-son";

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private ambienceBus!: GainNode;
  private fxBus!: GainNode;
  private reverb!: ConvolverNode;
  private reverbSend!: GainNode;
  private noise!: AudioBuffer;
  private birdTimer: ReturnType<typeof setTimeout> | undefined;
  private rustleTimer: ReturnType<typeof setTimeout> | undefined;
  private ambienceNodes: AudioNode[] = [];
  private recorded: { ambience?: AudioBuffer; birds: AudioBuffer[] } = { birds: [] };
  private listeners = new Set<(on: boolean) => void>();
  enabled = false;
  ambienceOn = false;
  /** Volume de l'ambiance de forêt (0 à 1) et effets des boutons, réglés dans les paramètres. */
  ambienceLevel = 1;
  effects = true;
  private ducked = false;

  constructor() {
    if (typeof window !== "undefined") {
      try {
        this.enabled = localStorage.getItem(STORAGE_KEY) !== "off";
        const lv = Number(localStorage.getItem(STORAGE_KEY + "-ambiance"));
        if (localStorage.getItem(STORAGE_KEY + "-ambiance") !== null && Number.isFinite(lv)) this.ambienceLevel = Math.min(1, Math.max(0, lv));
        this.effects = localStorage.getItem(STORAGE_KEY + "-effets") !== "off";
      } catch {
        this.enabled = true;
      }
    }
  }

  setAmbienceLevel(v: number) {
    this.ambienceLevel = Math.min(1, Math.max(0, v));
    try {
      localStorage.setItem(STORAGE_KEY + "-ambiance", String(this.ambienceLevel));
    } catch {}
    if (this.ctx && !this.ducked) this.ambienceBus.gain.setTargetAtTime(this.ambienceLevel, this.ctx.currentTime, 0.3);
  }

  setEffects(on: boolean) {
    this.effects = on;
    try {
      localStorage.setItem(STORAGE_KEY + "-effets", on ? "on" : "off");
    } catch {}
  }

  onChange(fn: (on: boolean) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** L'application passe en arrière-plan : tout se tait, comme les autres applications. */
  sleep() {
    if (this.ctx && this.ctx.state === "running") void this.ctx.suspend().catch(() => undefined);
  }
  /** Retour dans l'application : l'ambiance reprend doucement (si le son est activé). */
  wake() {
    if (this.ctx && this.enabled && this.ctx.state === "suspended") void this.ctx.resume().catch(() => undefined);
  }

  /** Doit être appelé après un geste de l'utilisateur (règle des navigateurs). */
  async unlock() {
    if (!this.enabled) return;
    if (!this.ctx) this.build();
    if (this.ctx!.state === "suspended") await this.ctx!.resume();
    if (!this.ambienceOn) this.startAmbience();
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    try {
      localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
    } catch {}
    if (on) void this.unlock();
    else this.stopAmbience();
    this.listeners.forEach((f) => f(on));
  }

  /** Baisse l'ambiance (ex. pendant qu'un ancien enregistre son récit). */
  duck(down: boolean) {
    this.ducked = down;
    if (!this.ctx) return;
    this.ambienceBus.gain.setTargetAtTime(down ? 0 : this.ambienceLevel, this.ctx.currentTime, 0.6);
  }

  // ─── Construction du graphe audio ───────────────────────────────
  private build() {
    // « playback » : tampon plus large, aucune micro-coupure, même sur un téléphone modeste.
    const ctx = new AudioContext({ latencyHint: "playback" });
    this.ctx = ctx;

    // Chaîne finale douce : compresseur léger pour éviter tout pic, volume global discret.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.ratio.value = 3;
    comp.attack.value = 0.02;
    comp.release.value = 0.4;
    this.master = ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(comp).connect(ctx.destination);

    this.ambienceBus = ctx.createGain();
    this.ambienceBus.gain.value = this.ambienceLevel;
    this.ambienceBus.connect(this.master);
    this.fxBus = ctx.createGain();
    this.fxBus.gain.value = 0.9;
    this.fxBus.connect(this.master);

    // Réverbération de sous-bois : réponse impulsionnelle générée (2,4 s, sombre).
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(2.4, 3.2);
    const wet = ctx.createGain();
    wet.gain.value = 0.32;
    this.reverb.connect(wet).connect(this.master);
    this.reverbSend = ctx.createGain();
    this.reverbSend.connect(this.reverb);

    this.noise = this.makePinkNoise(6);
    void this.loadRecordings();
  }

  private makePinkNoise(seconds: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      // Bruit rose (filtre de Paul Kellet) : plus doux à l'oreille que le bruit blanc.
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
      // Fondu aux extrémités pour une boucle sans clic.
      const f = Math.floor(ctx.sampleRate * 0.05);
      for (let i = 0; i < f; i++) {
        d[i] *= i / f;
        d[len - 1 - i] *= i / f;
      }
    }
    return buf;
  }

  private makeImpulse(seconds: number, decay: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        lp = lp * 0.7 + (Math.random() * 2 - 1) * 0.3; // queue légèrement filtrée = sous-bois feutré
        d[i] = lp * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  private async loadRecordings() {
    const ctx = this.ctx!;
    const load = async (url: string) => {
      try {
        const r = await fetch(url);
        if (!r.ok) return undefined;
        return await ctx.decodeAudioData(await r.arrayBuffer());
      } catch {
        return undefined;
      }
    };
    // On ne demande que les fichiers déclarés dans le manifeste : aucune requête inutile en 3G.
    let manifest: { ambience?: string | null; birds?: string[] } = {};
    try {
      const r = await fetch("sons/manifest.json");
      if (r.ok) manifest = await r.json();
    } catch {}
    const amb = manifest.ambience ? await load(manifest.ambience) : undefined;
    if (amb) {
      this.recorded.ambience = amb;
      if (this.ambienceOn) {
        this.stopAmbience();
        this.startAmbience();
      }
    }
    this.recorded.birds = (await Promise.all((manifest.birds ?? []).map(load))).filter(Boolean) as AudioBuffer[];
  }

  // ─── Ambiance de forêt ──────────────────────────────────────────
  private startAmbience() {
    const ctx = this.ctx!;
    this.ambienceOn = true;
    const t = ctx.currentTime;
    this.ambienceBus.gain.cancelScheduledValues(t);
    this.ambienceBus.gain.setValueAtTime(0, t);
    this.ambienceBus.gain.linearRampToValueAtTime(1, t + 4); // entrée très progressive

    if (this.recorded.ambience) {
      const src = ctx.createBufferSource();
      src.buffer = this.recorded.ambience;
      src.loop = true;
      const g = ctx.createGain();
      g.gain.value = 0.5;
      src.connect(g).connect(this.ambienceBus);
      src.start();
      this.ambienceNodes.push(src);
    } else {
      this.startWind();
      this.scheduleRustle();
    }
    this.scheduleBird(2.5);
  }

  /**
   * Ajoute à un paramètre plusieurs ondulations lentes qui se superposent.
   * Comme leurs vitesses ne se divisent pas entre elles, le mouvement ne se répète jamais :
   * c'est fluide et organique, sans aucune coupure ni minuterie.
   */
  private modulate(param: AudioParam, waves: [rate: number, depth: number][]) {
    const ctx = this.ctx!;
    const oscs: OscillatorNode[] = [];
    for (const [rate, depth] of waves) {
      const o = ctx.createOscillator();
      o.frequency.value = rate;
      const g = ctx.createGain();
      g.gain.value = depth;
      o.connect(g).connect(param);
      o.start();
      oscs.push(o);
    }
    this.ambienceNodes.push(...oscs);
    return oscs;
  }

  private noiseSource(rate = 1) {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.playbackRate.value = rate;
    src.start(0, Math.random() * 5);
    this.ambienceNodes.push(src);
    return src;
  }

  private filter(type: BiquadFilterType, freq: number, q: number) {
    const f = this.ctx!.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  /**
   * Vent continu en trois couches, jamais interrompu :
   * 1. le corps du vent, grave et rond, qui ondule lentement ;
   * 2. l'air dans les hautes branches, plus léger, de l'autre côté de l'espace stéréo ;
   * 3. les feuilles, qui frémissent en permanence et s'animent quand le vent forcit.
   */
  private startWind() {
    const ctx = this.ctx!;

    // 1. Corps du vent
    const body = ctx.createGain();
    body.gain.value = 0.03;
    const bodyBp = this.filter("bandpass", 480, 1.0);
    this.noiseSource(0.85).connect(this.filter("highpass", 180, 0.7)).connect(bodyBp).connect(this.filter("lowpass", 1100, 0.4)).connect(body);
    const bodyPan = ctx.createStereoPanner();
    body.connect(bodyPan).connect(this.ambienceBus);
    // Respiration du vent : trois ondulations lentes superposées (jamais à zéro).
    const [swell] = this.modulate(body.gain, [[0.043, 0.012], [0.071, 0.008], [0.117, 0.005]]);
    this.modulate(bodyBp.frequency, [[0.043, 110], [0.09, 40]]);
    this.modulate(bodyPan.pan, [[0.021, 0.4]]);

    // 2. Air dans les hautes branches
    const high = ctx.createGain();
    high.gain.value = 0.013;
    const highBp = this.filter("bandpass", 950, 1.2);
    this.noiseSource(1.05).connect(this.filter("highpass", 500, 0.7)).connect(highBp).connect(this.filter("lowpass", 1700, 0.4)).connect(high);
    const highPan = ctx.createStereoPanner();
    high.connect(highPan).connect(this.ambienceBus);
    this.modulate(high.gain, [[0.061, 0.007], [0.097, 0.004]]);
    this.modulate(highBp.frequency, [[0.061, 160]]);
    this.modulate(highPan.pan, [[0.017, -0.5]]);

    // 3. Feuillage : bande aiguë, frémissement rapide et irrégulier, lié aux rafales.
    const leaves = ctx.createGain();
    leaves.gain.value = 0.021;
    this.noiseSource(1.3).connect(this.filter("highpass", 2200, 0.7)).connect(this.filter("bandpass", 3800, 0.8)).connect(this.filter("lowpass", 7000, 0.4)).connect(leaves);
    const leavesPan = ctx.createStereoPanner();
    leaves.connect(leavesPan).connect(this.ambienceBus);
    leaves.connect(this.reverbSend);
    this.modulate(leaves.gain, [[0.37, 0.006], [0.61, 0.004], [1.13, 0.0025]]);
    // Quand le corps du vent forcit, les feuilles s'animent avec lui.
    const couple = ctx.createGain();
    couple.gain.value = 0.007; // la sinusoïde brute du vent, ramenée à l’échelle des feuilles
    swell.connect(couple).connect(leaves.gain);
    this.modulate(leavesPan.pan, [[0.029, 0.35]]);

    this.startAir();
  }

  /**
   * L'air : trois notes tenues très basses en volume (ré, la, fa dièse), presque inaudibles,
   * qui respirent lentement. Elles donnent une chaleur ronde sous les oiseaux, sans devenir une musique.
   */
  private startAir() {
    const ctx = this.ctx!;
    const air = ctx.createGain();
    air.gain.value = 0;
    air.gain.setTargetAtTime(1, ctx.currentTime, 4);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;
    air.connect(lp).connect(this.ambienceBus);
    lp.connect(this.reverbSend);
    [146.83, 220, 369.99].forEach((f, i) => {
      for (const detune of [-4, 4]) {
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = f;
        o.detune.value = detune; // léger battement = chaleur
        const g = ctx.createGain();
        g.gain.value = 0.0045 / (i + 1);
        // Respiration : chaque voix monte et descend à son rythme.
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.035 + i * 0.017;
        const amt = ctx.createGain();
        amt.gain.value = 0.0035 / (i + 1);
        lfo.connect(amt).connect(g.gain);
        o.connect(g).connect(air);
        o.start();
        lfo.start();
        this.ambienceNodes.push(o, lfo);
      }
    });
  }

  /** Bruissements isolés, rares, comme une feuille qui bouge seule. */
  private scheduleRustle() {
    const next = 5 + Math.random() * 6;
    this.rustleTimer = setTimeout(() => {
      if (!this.ambienceOn) return;
      this.leaves(0.035 + Math.random() * 0.025, 1.4 + Math.random() * 1.2, Math.random() * 1.4 - 0.7, this.ambienceBus);
      this.scheduleRustle();
    }, next * 1000);
  }

  private stopAmbience() {
    this.ambienceOn = false;
    clearTimeout(this.birdTimer);
    clearTimeout(this.rustleTimer);
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.ambienceBus.gain.setTargetAtTime(0, t, 0.5);
    const nodes = this.ambienceNodes;
    this.ambienceNodes = [];
    setTimeout(() => nodes.forEach((n) => (n as AudioScheduledSourceNode).stop?.()), 2500);
  }

  // ─── Oiseaux ────────────────────────────────────────────────────
  private scheduleBird(delay?: number) {
    const wait = delay ?? 4 + Math.random() * 9;
    this.birdTimer = setTimeout(() => {
      if (!this.ambienceOn) return;
      const pan = Math.random() * 1.6 - 0.8;
      const far = 0.35 + Math.random() * 0.5; // certains oiseaux sont loin, d'autres plus proches
      if (this.recorded.birds.length) this.playBuffer(this.recorded.birds[Math.floor(Math.random() * this.recorded.birds.length)], 0.35 * far, pan, this.ambienceBus);
      else {
        const song = [this.birdWhistle, this.birdTrill, this.birdWarble][Math.floor(Math.random() * 3)];
        song.call(this, this.ctx!.currentTime + 0.05, pan, far * 0.16, this.ambienceBus);
      }
      this.scheduleBird();
    }, wait * 1000);
  }

  /** Une note d'oiseau : sinusoïde glissante, vibrato léger, attaque et chute très douces. */
  private chirp(t: number, f0: number, f1: number, dur: number, vol: number, pan: number, bus: AudioNode) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const vib = ctx.createOscillator();
    vib.frequency.value = 28 + Math.random() * 20;
    const vg = ctx.createGain();
    vg.gain.value = f0 * 0.012;
    vib.connect(vg).connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1200;
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    o.connect(hp).connect(g).connect(p);
    p.connect(bus);
    p.connect(this.reverbSend);
    o.start(t);
    vib.start(t);
    o.stop(t + dur + 0.05);
    vib.stop(t + dur + 0.05);
  }

  private birdWhistle(t: number, pan: number, vol: number, bus: AudioNode) {
    // « tiou… tiou » descendant, comme un tourterelle lointaine sifflée
    const base = 2200 + Math.random() * 600;
    this.chirp(t, base * 1.25, base, 0.32, vol, pan, bus);
    this.chirp(t + 0.45, base * 1.2, base * 0.92, 0.38, vol * 0.85, pan, bus);
  }

  private birdTrill(t: number, pan: number, vol: number, bus: AudioNode) {
    // petite série rapide, comme un tisserin
    const base = 3200 + Math.random() * 900;
    const n = 5 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) this.chirp(t + i * 0.07, base * 1.15, base * (0.95 - i * 0.01), 0.05, vol * (1 - i / (n * 1.6)), pan, bus);
  }

  private birdWarble(t: number, pan: number, vol: number, bus: AudioNode) {
    // phrase montante puis descendante
    const base = 2600 + Math.random() * 700;
    const steps = [1, 1.18, 1.32, 1.12, 1.4, 0.98];
    steps.forEach((s, i) => this.chirp(t + i * 0.11, base * s, base * s * (i % 2 ? 0.94 : 1.06), 0.09, vol * 0.9, pan, bus));
  }

  // ─── Textures ───────────────────────────────────────────────────
  /** Froissement de feuilles : soyeux, enveloppe lisse en cloche, bande aiguë étroite. */
  private leaves(vol: number, dur: number, pan: number, bus: AudioNode) {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 1.2;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2800 + Math.random() * 1400;
    bp.Q.value = 1.6;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 6000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.setTargetAtTime(vol, t, dur * 0.18);
    g.gain.setTargetAtTime(0, t + dur * 0.45, dur * 0.2);
    const p = ctx.createStereoPanner();
    p.pan.setValueAtTime(pan, t);
    p.pan.linearRampToValueAtTime(pan * 0.4, t + dur); // la feuille bouge un peu
    src.connect(bp).connect(lp).connect(g).connect(p).connect(bus);
    p.connect(this.reverbSend);
    src.start(t, Math.random() * 4);
    src.stop(t + dur * 2);
  }

  private playBuffer(buf: AudioBuffer, vol: number, pan: number, bus: AudioNode) {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = vol;
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    s.connect(g).connect(p).connect(bus);
    p.connect(this.reverbSend);
    s.start();
  }

  /** Clochette en bois / cristal doux : quelques partiels qui s'éteignent lentement. */
  private bellTone(t: number, freq: number, vol: number, decay = 2.2) {
    const ctx = this.ctx!;
    [1, 2.01, 3.98].forEach((m, i) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = freq * m;
      const g = ctx.createGain();
      const v = vol / (i * 1.8 + 1);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(v, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay / (i + 1));
      o.connect(g);
      g.connect(this.fxBus);
      g.connect(this.reverbSend);
      o.start(t);
      o.stop(t + decay + 0.1);
    });
  }

  // ─── API publique ───────────────────────────────────────────────
  play(cue: Cue) {
    if (!this.enabled || !this.effects) return;
    if (!this.ctx) {
      void this.unlock().then(() => this.play(cue));
      return;
    }
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.01;
    switch (cue) {
      case "tap": {
        // Feuille froissée très brève + petit « toc » boisé.
        this.leaves(0.09, 0.14, (Math.random() - 0.5) * 0.4, this.fxBus);
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(520, t);
        o.frequency.exponentialRampToValueAtTime(300, t + 0.06);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.05, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
        o.connect(g).connect(this.fxBus);
        o.start(t);
        o.stop(t + 0.1);
        break;
      }
      case "chime":
        // Pentatonique majeure : toujours consonant, jamais insistant.
        this.bellTone(t, [1046.5, 1174.7, 1318.5, 1568, 1760][Math.floor(Math.random() * 5)], 0.06, 1.8);
        break;
      case "whoosh": {
        // Souffle de feuilles entre deux pages : bruit filtré qui balaie l'espace stéréo.
        const src = ctx.createBufferSource();
        src.buffer = this.noise;
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.Q.value = 0.8;
        bp.frequency.setValueAtTime(500, t);
        bp.frequency.exponentialRampToValueAtTime(2600, t + 0.5);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.045, t + 0.22);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
        const p = ctx.createStereoPanner();
        p.pan.setValueAtTime(-0.5, t);
        p.pan.linearRampToValueAtTime(0.5, t + 0.7);
        src.connect(bp).connect(g).connect(p).connect(this.fxBus);
        p.connect(this.reverbSend);
        src.start(t, Math.random() * 4);
        src.stop(t + 0.8);
        break;
      }
      case "bell":
        this.bellTone(t, 784, 0.07, 2.6);
        break;
      case "success":
        this.bellTone(t, 1046.5, 0.05, 1.6);
        this.bellTone(t + 0.14, 1318.5, 0.045, 1.8);
        this.bellTone(t + 0.28, 1568, 0.04, 2.2);
        this.birdTrill(t + 0.5, 0.3, 0.05, this.fxBus);
        break;
      case "seal": {
        // Couvercle qui se ferme (bois sourd) puis cire posée.
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(140, t + 0.75);
        o.frequency.exponentialRampToValueAtTime(70, t + 0.95);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.setValueAtTime(0.18, t + 0.75);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
        o.connect(g).connect(this.fxBus);
        g.connect(this.reverbSend);
        o.start(t);
        o.stop(t + 1.2);
        setTimeout(() => this.bellTone(ctx.currentTime, 659.3, 0.05, 1.4), 1000);
        break;
      }
      case "earth":
        // Terre qui recouvre le coffre : grains graves et lents.
        this.leaves(0.07, 1.4, 0, this.fxBus);
        break;
      case "candle":
        this.leaves(0.04, 0.35, 0, this.fxBus);
        this.bellTone(t + 0.1, 880, 0.03, 2.8);
        break;
    }
  }
}

export const sound = new SoundEngine();
