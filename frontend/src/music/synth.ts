// Turns the pure score and sound definitions into Web Audio. Everything here takes a BaseAudioContext, so the
// live engine (AudioContext) and the offline renderer used by the automated audio check (OfflineAudioContext)
// run exactly the same code.
//
// Signal flow:
//   note -> part bus (level, mute) -> stereo pan -> layer out ------------------------> music -> master
//                                  \-> reverb send -> convolver (the theme's room) -/            |
//                                  \-> echo send   -> dotted-eighth feedback delay -/   glue compressor
//   effects -> master (+ a short room)                                                     -> limiter -> out
import { generateBar, generateStinger, makePlan, mulberry32 } from "./score.ts";
import type { Plan } from "./score.ts";
import { DRUMS, RECIPES, effectSteps } from "./sounds.ts";
import { PARTS } from "./types.ts";
import type { EffectKind, MusicCue, MusicState, Part, ScoreEvent, Step, ThemeId } from "./types.ts";

export interface MasterChain {
  master: GainNode;
  music: GainNode;
  effects: GainNode;
  /** Taps the final output, for the sound test's visualiser. */
  analyser: AnalyserNode;
}

/** The mix: each part's level, stereo position, reverb send and echo send. Tuned so the melody and bass lead, the drums punch and the pads sit behind. */
export const MIX: Record<Part, { gain: number; pan: number; rev: number; echo: number }> = {
  pad: { gain: 0.5, pan: 0, rev: 0.5, echo: 0 },
  bass: { gain: 0.95, pan: 0, rev: 0.06, echo: 0 },
  lead: { gain: 0.85, pan: 0.06, rev: 0.32, echo: 0.22 },
  counter: { gain: 0.62, pan: -0.32, rev: 0.4, echo: 0.12 },
  arp: { gain: 0.5, pan: 0.34, rev: 0.28, echo: 0.2 },
  orch: { gain: 0.72, pan: -0.12, rev: 0.45, echo: 0 },
  drums: { gain: 0.95, pan: 0, rev: 0.14, echo: 0 },
  perc: { gain: 0.62, pan: 0.24, rev: 0.18, echo: 0 },
  fx: { gain: 0.75, pan: -0.15, rev: 0.55, echo: 0.1 },
};

/** music and effects buses into a master gain, then a glue compressor and a limiter so busy moments never clip. */
export function createMasterChain(ctx: BaseAudioContext): MasterChain {
  const master = ctx.createGain();
  const music = ctx.createGain();
  const effects = ctx.createGain();
  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = -16;
  glue.knee.value = 8;
  glue.ratio.value = 3;
  glue.attack.value = 0.012;
  glue.release.value = 0.25;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.12;
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.75;
  music.connect(master);
  effects.connect(master);
  // Effects get a small room of their own so hits and spells sit in the same space as the music.
  const effectRoom = ctx.createConvolver();
  effectRoom.buffer = impulse(ctx, 1.1, 0.55);
  const effectSend = ctx.createGain();
  effectSend.gain.value = 0.16;
  effects.connect(effectSend);
  effectSend.connect(effectRoom);
  effectRoom.connect(master);
  master.connect(glue);
  glue.connect(limiter);
  limiter.connect(ctx.destination);
  limiter.connect(analyser);
  return { master, music, effects, analyser };
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

const metalCache = new WeakMap<BaseAudioContext, Map<number, AudioBuffer>>();
/** Ratios of the six square oscillators in the classic drum-machine cymbal. */
const METAL_RATIOS = [2, 3, 4.16, 5.43, 6.79, 8.21];

/** Two seconds of the six-square metallic cluster, rendered once per base pitch and looped (far cheaper than six oscillators per hit). */
function metalBuffer(ctx: BaseAudioContext, base: number): AudioBuffer {
  let cache = metalCache.get(ctx);
  if (!cache) metalCache.set(ctx, (cache = new Map()));
  const existing = cache.get(base);
  if (existing) return existing;
  const rate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, Math.floor(rate * 2), rate);
  const data = buffer.getChannelData(0);
  const phases = METAL_RATIOS.map(r => r * base / rate);
  for (let i = 0; i < data.length; i += 1) {
    let sum = 0;
    for (const inc of phases) sum += (i * inc) % 1 < 0.5 ? 1 : -1;
    data[i] = sum / METAL_RATIOS.length;
  }
  cache.set(base, buffer);
  return buffer;
}

const impulseCache = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();

/**
 * A stereo reverb impulse response: decaying noise that darkens as it fades, with a short pre-delay and a few
 * early reflections. `size` is roughly the time to fall 60 dB; `bright` 0..1 sets how much high end survives.
 */
export function impulse(ctx: BaseAudioContext, size: number, bright: number): AudioBuffer {
  let cache = impulseCache.get(ctx);
  if (!cache) impulseCache.set(ctx, (cache = new Map()));
  const key = `${size.toFixed(2)}|${bright.toFixed(2)}`;
  const existing = cache.get(key);
  if (existing) return existing;
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(rate * size));
  const buffer = ctx.createBuffer(2, length, rate);
  const pre = Math.floor(rate * 0.014);
  for (let ch = 0; ch < 2; ch += 1) {
    const data = buffer.getChannelData(ch);
    const rng = mulberry32(9001 + ch * 77 + Math.round(size * 100));
    let lp = 0;
    for (let i = pre; i < length; i += 1) {
      const t = (i - pre) / rate;
      const env = Math.exp((-6.9 * t) / size);
      const a = Math.max(0.03, Math.min(0.95, 0.08 + bright * 0.85 - (t / size) * 0.6));
      lp += a * (rng() * 2 - 1 - lp);
      data[i] = lp * env;
    }
    // Early reflections from nearby walls, a little different in each ear.
    for (const [ms, g] of [[11, 0.5], [19, 0.35], [29, 0.28], [41, 0.2]] as const) {
      const at = pre + Math.floor((rate * (ms + ch * 3)) / 1000);
      if (at < length) data[at] += g * (ch ? -1 : 1);
    }
  }
  cache.set(key, buffer);
  return buffer;
}

const clampFreq = (f: number) => Math.min(18000, Math.max(20, f));

const driveCurves = new Map<number, Float32Array<ArrayBuffer>>();
function driveCurve(amount: number): Float32Array<ArrayBuffer> {
  const existing = driveCurves.get(amount);
  if (existing) return existing;
  const curve = new Float32Array(512);
  const norm = Math.tanh(amount);
  for (let i = 0; i < curve.length; i += 1) curve[i] = Math.tanh(((i * 2) / (curve.length - 1) - 1) * amount) / norm;
  driveCurves.set(amount, curve);
  return curve;
}

/** The ambience beds were tuned against a quiet 0.22-amplitude noise buffer; keep that level. */
const BED_NOISE_SCALE = 0.22;

/** Fights put the score in front: the ambience bed steps back while the percussion and lead take over. */
const BED_STATE_LEVEL: Record<MusicState, number> = { title: 0.7, party: 0.6, exploration: 1, event: 0.9, combat: 0.5, miniboss: 0.45, boss: 0.4, victory: 0.7, defeat: 0.8 };

/** Plays a list of fixed-pitch steps (a drum hit, an ambience event, a UI effect) starting at `when`. */
export function playSteps(ctx: BaseAudioContext, dest: AudioNode, steps: readonly Step[], when: number, vel = 1, pitch = 1): void {
  for (const step of steps) {
    const start = when + (step.at ?? 0);
    const end = start + step.d;
    const peak = Math.max(0.0002, step.v * vel);
    const gain = ctx.createGain();
    gain.connect(dest);
    const attack = Math.min(step.k === "crunch" ? 0.008 : step.a ?? (step.k === "metal" ? 0.001 : 0.02), step.d * 0.9);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + Math.max(0.001, attack));
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    if (step.k === "tone") {
      const osc = ctx.createOscillator();
      osc.type = step.w;
      osc.frequency.setValueAtTime(clampFreq(step.f * pitch), start);
      if (step.to !== undefined) osc.frequency.exponentialRampToValueAtTime(clampFreq(step.to * pitch), end);
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
    } else if (step.k === "metal") {
      const source = ctx.createBufferSource();
      source.buffer = metalBuffer(ctx, Math.round((step.base ?? 40) * pitch));
      source.loop = true;
      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = clampFreq(step.f * 1.4);
      band.Q.value = 0.5;
      const high = ctx.createBiquadFilter();
      high.type = "highpass";
      high.frequency.value = clampFreq(step.f);
      source.connect(band);
      band.connect(high);
      high.connect(gain);
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
      shaper.curve = driveCurve(3.8);
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
  const ringFor = r.sustain ? dur : Math.max(dur, r.ring ?? 0);
  const end = when + ringFor + (r.sustain ? release : 0);
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, when);
  out.gain.exponentialRampToValueAtTime(peak, when + Math.max(0.001, r.a));
  if (r.sustain) {
    out.gain.setValueAtTime(peak, when + Math.max(r.a, dur));
    out.gain.exponentialRampToValueAtTime(0.0001, end);
  } else {
    out.gain.exponentialRampToValueAtTime(0.0001, when + ringFor);
  }
  out.connect(dest);

  let bus: AudioNode = out;
  if (r.drive) {
    const shaper = ctx.createWaveShaper();
    shaper.curve = driveCurve(r.drive);
    shaper.connect(bus);
    bus = shaper;
  }
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
    trem.connect(bus);
    bus = trem;
  }
  if (r.filter) {
    const filter = ctx.createBiquadFilter();
    filter.type = r.filter.type;
    filter.Q.value = r.filter.q ?? 0.7;
    filter.frequency.setValueAtTime(clampFreq(freq * r.filter.fmul), when);
    if (r.filter.to !== undefined) filter.frequency.exponentialRampToValueAtTime(clampFreq(freq * r.filter.to), when + Math.max(0.02, r.filter.t ?? Math.min(dur, 1.5)));
    filter.connect(bus);
    bus = filter;
  }
  let vibrato: GainNode | null = null;
  if (r.vib) {
    const lfo = ctx.createOscillator();
    vibrato = ctx.createGain();
    lfo.frequency.value = r.vib.rate;
    if (r.vib.delay) {
      vibrato.gain.setValueAtTime(0, when);
      vibrato.gain.linearRampToValueAtTime(r.vib.cents, when + r.vib.delay);
    } else vibrato.gain.value = r.vib.cents;
    lfo.connect(vibrato);
    lfo.start(when);
    lfo.stop(end + 0.05);
  }
  let fm: GainNode | null = null;
  if (r.fm) {
    const mod = ctx.createOscillator();
    fm = ctx.createGain();
    mod.frequency.value = clampFreq(freq * r.fm.r);
    fm.gain.setValueAtTime(freq * r.fm.index, when);
    if (r.fm.end !== undefined) fm.gain.exponentialRampToValueAtTime(Math.max(0.01, freq * r.fm.end), when + Math.max(0.05, Math.min(ringFor, 1.2)));
    mod.connect(fm);
    mod.start(when);
    mod.stop(end + 0.05);
  }
  const copies = r.unison?.n ?? 1;
  const spread = r.unison?.cents ?? 0;
  const copyLevel = 1 / Math.sqrt(copies);
  for (const layer of r.layers) {
    const f = clampFreq(freq * layer.r);
    for (let c = 0; c < copies; c += 1) {
      const osc = ctx.createOscillator();
      const layerGain = ctx.createGain();
      osc.type = layer.w;
      if (r.bend) {
        osc.frequency.setValueAtTime(clampFreq(f * r.bend), when);
        osc.frequency.exponentialRampToValueAtTime(f, when + (r.bendT ?? 0.06));
      } else {
        osc.frequency.setValueAtTime(f, when);
      }
      const detune = copies > 1 ? -spread + (2 * spread * c) / (copies - 1) : 0;
      osc.detune.value = cents + (layer.cents ?? 0) + detune;
      layerGain.gain.setValueAtTime(layer.v * copyLevel, when);
      if (layer.decay) layerGain.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(0.05, ringFor * layer.decay));
      vibrato?.connect(osc.detune);
      fm?.connect(osc.frequency);
      osc.connect(layerGain);
      layerGain.connect(bus);
      osc.start(when);
      osc.stop(end + 0.05);
    }
  }
  if (r.hammer) {
    const h = r.hammer;
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer(ctx, "white");
    const filter = ctx.createBiquadFilter();
    filter.type = h.ft ?? "lowpass";
    filter.frequency.value = clampFreq(h.f);
    filter.Q.value = h.q ?? 0.7;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.max(0.0002, h.v * vel), when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + h.d);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    source.start(when);
    source.stop(when + h.d + 0.02);
  }
  if (r.echo && !echoed) playRecipe(ctx, dest, voice, freq, when + r.echo.delay, dur, vel * r.echo.gain, cents, true);
}

/** Where a layer's events go: one bus per part, each panned and sending to the layer's reverb and echo. */
export interface LayerBus {
  /** The layer's output; fade it to crossfade the whole layer, reverb and echo tails included. */
  out: GainNode;
  parts: Record<Part, GainNode>;
  /** Mutes or unmutes parts (the sound test mixer). */
  setMutes(mutes: ReadonlySet<Part>, at: number): void;
  dispose(): void;
}

/** A layer's mixer: part buses, the theme's reverb room and a tempo-synced echo, all summed into `out`. */
export function createLayerBus(ctx: BaseAudioContext, dest: AudioNode, plan: Plan, mutes: ReadonlySet<Part> = new Set()): LayerBus {
  const out = ctx.createGain();
  out.connect(dest);
  const nodes: AudioNode[] = [out];
  const room = ctx.createConvolver();
  room.buffer = impulse(ctx, plan.room.size, plan.room.bright);
  const reverbIn = ctx.createGain();
  const wet = ctx.createGain();
  wet.gain.value = plan.room.wet * 1.6;
  reverbIn.connect(room);
  room.connect(wet);
  wet.connect(out);
  nodes.push(room, reverbIn, wet);
  let echoIn: GainNode | null = null;
  if (plan.echo.feedback > 0) {
    echoIn = ctx.createGain();
    const delay = ctx.createDelay(2);
    delay.delayTime.value = Math.min(1.9, plan.echo.time);
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 2800;
    const feedback = ctx.createGain();
    feedback.gain.value = Math.min(0.6, plan.echo.feedback);
    const echoOut = ctx.createGain();
    echoOut.gain.value = 0.55;
    echoIn.connect(delay);
    delay.connect(tone);
    tone.connect(feedback);
    feedback.connect(delay);
    tone.connect(echoOut);
    echoOut.connect(out);
    // The echo is also a little reverberant, so repeats melt into the room.
    echoOut.connect(reverbIn);
    nodes.push(echoIn, delay, tone, feedback, echoOut);
  }
  const level = (part: Part) => MIX[part].gain * (plan.fight && part === "pad" ? 0.8 : 1);
  const parts = {} as Record<Part, GainNode>;
  for (const part of PARTS) {
    const input = ctx.createGain();
    input.gain.value = mutes.has(part) ? 0 : level(part);
    const pan = typeof ctx.createStereoPanner === "function" ? ctx.createStereoPanner() : null;
    if (pan) { pan.pan.value = MIX[part].pan; input.connect(pan); pan.connect(out); nodes.push(pan); } else input.connect(out);
    const send = ctx.createGain();
    send.gain.value = MIX[part].rev;
    input.connect(send);
    send.connect(reverbIn);
    nodes.push(input, send);
    if (echoIn && MIX[part].echo > 0) {
      const echoSend = ctx.createGain();
      echoSend.gain.value = MIX[part].echo;
      input.connect(echoSend);
      echoSend.connect(echoIn);
      nodes.push(echoSend);
    }
    parts[part] = input;
  }
  return {
    out,
    parts,
    setMutes(next, at) {
      for (const part of PARTS) parts[part].gain.setTargetAtTime(next.has(part) ? 0 : level(part), at, 0.03);
    },
    dispose() {
      for (const node of nodes) { try { node.disconnect(); } catch { /* already gone */ } }
    },
  };
}

/** Schedules a list of score events into a layer's part buses, with their times offset from `origin` (the bar or stinger start). */
export function scheduleEvents(ctx: BaseAudioContext, bus: Pick<LayerBus, "parts">, events: readonly ScoreEvent[], origin: number): void {
  for (const event of events) {
    const when = origin + event.t;
    const dest = bus.parts[event.part];
    if (event.kind === "melodic") playRecipe(ctx, dest, event.voice, event.freq, when, event.dur, event.vel, event.cents);
    else if (event.kind === "drum") playSteps(ctx, dest, DRUMS[event.voice as keyof typeof DRUMS], when, event.vel, event.pitch ?? 1);
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
  const spec = plan.cue.state === "title"
    ? { ...plan.profile.bed, noise: "brown" as const, filter: "lowpass" as const, f: 320, q: 0.45, gain: 0.02, lfo: { rate: 0.07, depth: 0.55 }, drones: [{ ratio: 1, w: "sine" as const, gain: 0.05, cents: 0 }] }
    : plan.cue.state === "party"
      ? { ...plan.profile.bed, noise: "pink" as const, filter: "lowpass" as const, f: 700, q: 0.6, gain: 0.012, lfo: { rate: 0.18, depth: 0.35 }, drones: [{ ratio: 1, w: "sine" as const, gain: 0.04, cents: 0 }] }
      : plan.profile.bed;
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
    // Drones sit lower in fights so they never fight the bass line.
    gain.gain.value = drone.gain * (plan.fight ? 0.6 : 0.85);
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
export function playStinger(ctx: BaseAudioContext, bus: Pick<LayerBus, "parts">, plan: Plan, kind: "victory" | "defeat", when: number): void {
  scheduleEvents(ctx, bus, generateStinger(plan, kind), when);
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
  /** Render only these parts (all when omitted): lets the check measure the balance between parts. */
  only?: readonly Part[];
}

/** Renders a cue offline for the automated audio check: the bed, every bar that starts inside the window, and the stinger for run endings. Returns the mono sum. */
export async function renderCueOffline(cue: MusicCue, options: RenderOptions): Promise<Float32Array> {
  const sampleRate = options.sampleRate ?? 44100;
  const ctx = new OfflineAudioContext(2, Math.ceil(options.seconds * sampleRate), sampleRate);
  const chain = createMasterChain(ctx);
  chain.master.gain.value = options.volumes?.master ?? 0.72;
  chain.music.gain.value = options.volumes?.music ?? 0.48;
  const plan = makePlan(cue);
  const mutes = new Set<Part>(options.only ? PARTS.filter(p => !options.only!.includes(p)) : []);
  const bus = createLayerBus(ctx, chain.music, plan, mutes);
  startBed(ctx, bus.parts.fx, plan, 0, 0.5);
  for (let bar = 0; bar * plan.barSec < options.seconds; bar += 1) scheduleEvents(ctx, bus, generateBar(plan, plan.entryBar + bar), bar * plan.barSec);
  if (cue.state === "victory" || cue.state === "defeat") playStinger(ctx, bus, plan, cue.state, 0.1);
  const buffer = await ctx.startRendering();
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  const mono = new Float32Array(left.length);
  for (let i = 0; i < mono.length; i += 1) mono[i] = (left[i] + right[i]) / 2;
  return mono;
}
