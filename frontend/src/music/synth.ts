// Turns the pure score and sound definitions into Web Audio. Everything here takes a BaseAudioContext, so the
// live engine (AudioContext) and the offline renderer used by the automated audio check (OfflineAudioContext)
// run exactly the same code.
import { generateBar, generateStinger, makePlan, mulberry32 } from "./score.ts";
import type { Plan } from "./score.ts";
import { DRUMS, RECIPES, effectSteps } from "./sounds.ts";
import type { EffectKind, MusicCue, ScoreEvent, Step, ThemeId } from "./types.ts";

export interface MasterChain {
  master: GainNode;
  music: GainNode;
  effects: GainNode;
}

/** music and effects buses into a master gain, then a compressor so busy moments cannot clip. */
export function createMasterChain(ctx: BaseAudioContext): MasterChain {
  const master = ctx.createGain();
  const music = ctx.createGain();
  const effects = ctx.createGain();
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -14;
  compressor.knee.value = 10;
  compressor.ratio.value = 6;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.25;
  music.connect(master);
  effects.connect(master);
  master.connect(compressor);
  compressor.connect(ctx.destination);
  return { master, music, effects };
}

type NoiseColour = "white" | "pink" | "brown";
const noiseCache = new WeakMap<BaseAudioContext, Partial<Record<NoiseColour, AudioBuffer>>>();

/** Three seconds of looping noise at roughly unit amplitude. Seeded so renders are reproducible. */
function noiseBuffer(ctx: BaseAudioContext, colour: NoiseColour): AudioBuffer {
  let cache = noiseCache.get(ctx);
  if (!cache) noiseCache.set(ctx, (cache = {}));
  const existing = cache[colour];
  if (existing) return existing;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 3), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const rng = mulberry32(colour === "white" ? 11 : colour === "pink" ? 22 : 33);
  let b0 = 0, b1 = 0, b2 = 0, last = 0;
  for (let i = 0; i < data.length; i += 1) {
    const white = rng() * 2 - 1;
    if (colour === "white") data[i] = white;
    else if (colour === "pink") {
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.25;
    } else {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
  }
  cache[colour] = buffer;
  return buffer;
}

const clampFreq = (f: number) => Math.min(18000, Math.max(20, f));

/** The ambience beds were tuned against a quiet 0.22-amplitude noise buffer; keep that level. */
const BED_NOISE_SCALE = 0.22;

/** Fights put the score in front: the ambience bed steps back while the percussion and lead take over. */
const BED_STATE_LEVEL = { exploration: 1, event: 1, combat: 0.55, miniboss: 0.5, boss: 0.45, victory: 0.8, defeat: 0.8 } as const;

/** Plays a list of fixed-pitch steps (a drum hit, an ambience event, a UI effect) starting at `when`. */
export function playSteps(ctx: BaseAudioContext, dest: AudioNode, steps: readonly Step[], when: number, vel = 1): void {
  for (const step of steps) {
    const start = when + (step.at ?? 0);
    const end = start + step.d;
    const peak = Math.max(0.0002, step.v * vel);
    const gain = ctx.createGain();
    gain.connect(dest);
    const attack = Math.min(step.k === "crunch" ? 0.008 : step.a ?? 0.02, step.d * 0.9);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + Math.max(0.001, attack));
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    if (step.k === "tone") {
      const osc = ctx.createOscillator();
      osc.type = step.w;
      osc.frequency.setValueAtTime(clampFreq(step.f), start);
      if (step.to !== undefined) osc.frequency.exponentialRampToValueAtTime(clampFreq(step.to), end);
      if (step.cents) osc.detune.value = step.cents;
      osc.connect(gain);
      osc.start(start);
      osc.stop(end + 0.03);
    } else if (step.k === "noise") {
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer(ctx, "white");
      source.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = step.ft;
      filter.Q.value = step.q ?? 0.7;
      filter.frequency.setValueAtTime(clampFreq(step.f), start);
      if (step.to !== undefined) filter.frequency.exponentialRampToValueAtTime(clampFreq(step.to), end);
      source.connect(filter);
      filter.connect(gain);
      source.start(start);
      source.stop(end + 0.03);
    } else {
      // The gritty scrape of a weapon hit: noise band-swept downward and pushed through a soft clipper.
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer(ctx, "white");
      source.loop = true;
      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.setValueAtTime(1850, start);
      band.frequency.exponentialRampToValueAtTime(780, end);
      band.Q.value = 0.72;
      const shaper = ctx.createWaveShaper();
      const curve = new Float32Array(256);
      for (let i = 0; i < curve.length; i += 1) curve[i] = Math.tanh(((i * 2) / (curve.length - 1) - 1) * 3.8);
      shaper.curve = curve;
      source.connect(band);
      band.connect(shaper);
      shaper.connect(gain);
      source.start(start);
      source.stop(end + 0.03);
    }
  }
}

/** Plays one pitched note from a recipe. */
export function playRecipe(ctx: BaseAudioContext, dest: AudioNode, voice: keyof typeof RECIPES, freq: number, when: number, dur: number, vel: number, cents = 0, echoed = false): void {
  const r = RECIPES[voice];
  const peak = Math.max(0.0002, r.gain * vel);
  const release = r.r ?? 0.05;
  const end = when + dur + (r.sustain ? release : 0);
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, when);
  out.gain.exponentialRampToValueAtTime(peak, when + Math.max(0.001, r.a));
  if (r.sustain) {
    out.gain.setValueAtTime(peak, when + Math.max(r.a, dur));
    out.gain.exponentialRampToValueAtTime(0.0001, end);
  } else {
    out.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  }
  out.connect(dest);

  let bus: AudioNode = out;
  if (r.trem) {
    const trem = ctx.createGain();
    trem.gain.value = 1 - r.trem.depth / 2;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = r.trem.rate;
    lfoGain.gain.value = r.trem.depth / 2;
    lfo.connect(lfoGain);
    lfoGain.connect(trem.gain);
    lfo.start(when);
    lfo.stop(end + 0.05);
    trem.connect(out);
    bus = trem;
  }
  if (r.filter) {
    const filter = ctx.createBiquadFilter();
    filter.type = r.filter.type;
    filter.Q.value = r.filter.q ?? 0.7;
    filter.frequency.setValueAtTime(clampFreq(freq * r.filter.fmul), when);
    if (r.filter.to !== undefined) filter.frequency.exponentialRampToValueAtTime(clampFreq(freq * r.filter.to), when + Math.min(dur, 1.5));
    filter.connect(bus);
    bus = filter;
  }
  let vibrato: GainNode | null = null;
  if (r.vib) {
    const lfo = ctx.createOscillator();
    vibrato = ctx.createGain();
    lfo.frequency.value = r.vib.rate;
    vibrato.gain.value = r.vib.cents;
    lfo.connect(vibrato);
    lfo.start(when);
    lfo.stop(end + 0.05);
  }
  for (const layer of r.layers) {
    const osc = ctx.createOscillator();
    const layerGain = ctx.createGain();
    const f = clampFreq(freq * layer.r);
    osc.type = layer.w;
    if (r.bend) {
      osc.frequency.setValueAtTime(clampFreq(f * r.bend), when);
      osc.frequency.exponentialRampToValueAtTime(f, when + 0.06);
    } else {
      osc.frequency.setValueAtTime(f, when);
    }
    osc.detune.value = cents + (layer.cents ?? 0);
    layerGain.gain.setValueAtTime(layer.v, when);
    if (layer.decay) layerGain.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(0.05, dur * layer.decay));
    vibrato?.connect(osc.detune);
    osc.connect(layerGain);
    layerGain.connect(bus);
    osc.start(when);
    osc.stop(end + 0.05);
  }
  if (r.echo && !echoed) playRecipe(ctx, dest, voice, freq, when + r.echo.delay, dur, vel * r.echo.gain, cents, true);
}

/** Schedules a list of score events, with their times offset from `origin` (the bar or stinger start). */
export function scheduleEvents(ctx: BaseAudioContext, dest: AudioNode, events: readonly ScoreEvent[], origin: number): void {
  for (const event of events) {
    const when = origin + event.t;
    if (event.kind === "melodic") playRecipe(ctx, dest, event.voice, event.freq, when, event.dur, event.vel, event.cents);
    else if (event.kind === "drum") playSteps(ctx, dest, DRUMS[event.voice as keyof typeof DRUMS], when, event.vel);
    else if (event.steps) playSteps(ctx, dest, event.steps, when, event.vel);
  }
}

export interface Bed {
  /** Fades the bed out starting at `at` over `fade` seconds, then stops its nodes. */
  stop(at: number, fade: number): void;
  out: GainNode;
}

/** The continuous layer of a scene: a noise bed with slow modulation plus the theme's drones. It starts silent and fades in. */
export function startBed(ctx: BaseAudioContext, dest: AudioNode, plan: Plan, when: number, fadeIn: number): Bed {
  const spec = plan.profile.bed;
  const variant = plan.profile.variants[plan.cue.variant];
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, when);
  out.gain.linearRampToValueAtTime(BED_STATE_LEVEL[plan.cue.state], when + fadeIn);
  out.connect(dest);
  const nodes: (OscillatorNode | AudioBufferSourceNode)[] = [];

  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx, spec.noise);
  source.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = spec.filter;
  filter.Q.value = spec.q;
  const cutoff = spec.f * (variant?.bedFilterMul ?? 1);
  filter.frequency.value = cutoff;
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = spec.gain * (variant?.bedGainMul ?? 1) * BED_NOISE_SCALE;
  source.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(out);
  source.start(when);
  nodes.push(source);
  if (spec.lfo) {
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = spec.lfo.rate;
    lfoGain.gain.value = cutoff * spec.lfo.depth * 0.9;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start(when);
    nodes.push(lfo);
  }
  for (const drone of spec.drones) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = drone.w;
    osc.frequency.value = clampFreq(plan.rootHz * drone.ratio);
    osc.detune.value = drone.cents;
    gain.gain.value = drone.gain;
    osc.connect(gain);
    gain.connect(out);
    osc.start(when);
    nodes.push(osc);
  }
  return {
    out,
    stop(at, fade) {
      out.gain.cancelScheduledValues(at);
      out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), at);
      out.gain.linearRampToValueAtTime(0.0001, at + fade);
      for (const node of nodes) {
        try { node.stop(at + fade + 0.1); } catch { /* already stopped */ }
      }
    },
  };
}

/** Plays the run-ending phrase for victory or defeat. */
export function playStinger(ctx: BaseAudioContext, dest: AudioNode, plan: Plan, kind: "victory" | "defeat", when: number): void {
  scheduleEvents(ctx, dest, generateStinger(plan, kind), when);
}

/** Plays a UI effect with the theme's flavour. */
export function playEffect(ctx: BaseAudioContext, dest: AudioNode, kind: EffectKind, theme: ThemeId, when: number): void {
  playSteps(ctx, dest, effectSteps(kind, theme), when);
}

export interface RenderOptions {
  seconds: number;
  sampleRate?: number;
  /** Master and music gain applied as in the game's default settings. */
  volumes?: { master: number; music: number };
}

/** Renders a cue offline for the automated audio check: the bed, every bar that starts inside the window, and the stinger for run endings. */
export async function renderCueOffline(cue: MusicCue, options: RenderOptions): Promise<Float32Array> {
  const sampleRate = options.sampleRate ?? 44100;
  const ctx = new OfflineAudioContext(1, Math.ceil(options.seconds * sampleRate), sampleRate);
  const chain = createMasterChain(ctx);
  chain.master.gain.value = options.volumes?.master ?? 0.72;
  chain.music.gain.value = options.volumes?.music ?? 0.48;
  const plan = makePlan(cue);
  startBed(ctx, chain.music, plan, 0, 0.5);
  for (let bar = 0; bar * plan.barSec < options.seconds; bar += 1) scheduleEvents(ctx, chain.music, generateBar(plan, bar), bar * plan.barSec);
  if (cue.state === "victory" || cue.state === "defeat") playStinger(ctx, chain.music, plan, cue.state, 0.1);
  const buffer = await ctx.startRendering();
  return buffer.getChannelData(0).slice();
}
