// Sound definitions as pure data: pitched voice recipes, drum kits, ambience events and UI effect recipes.
// synth.ts turns these into Web Audio nodes. Nothing here touches the DOM.
import type { DrumVoice, EffectKind, FilterKind, FxVoice, MelodicVoice, NoiseStep, Recipe, Step, ThemeId, ToneStep, Wave } from "./types.ts";

const tone = (f: number, d: number, w: Wave, v: number, o: Partial<ToneStep> = {}): ToneStep => ({ k: "tone", f, d, w, v, ...o });
const noise = (d: number, f: number, v: number, ft: FilterKind = "lowpass", o: Partial<NoiseStep> = {}): NoiseStep => ({ k: "noise", d, f, v, ft, ...o });

// ------------------------------------------------------------------------------------------------ pitched voices

export const RECIPES: Record<MelodicVoice, Recipe> = {
  // Pads: sustained, slow attack, filter tracks the note.
  dronePad: { layers: [{ w: "triangle", r: 1, v: 0.18 }, { w: "sine", r: 1.5, v: 0.11, cents: -4 }, { w: "sine", r: 2, v: 0.045, cents: 5 }], a: 1.5, r: 2, sustain: true, gain: 0.5, filter: { type: "lowpass", fmul: 4, q: 0.7 } },
  choirPad: { layers: [{ w: "sine", r: 1, v: 0.2 }, { w: "sine", r: 2, v: 0.1, cents: 7 }, { w: "sine", r: 3, v: 0.05, cents: -6 }], a: 2, r: 2.5, sustain: true, gain: 0.45, filter: { type: "lowpass", fmul: 6 }, vib: { rate: 5, cents: 12 } },
  glassPad: { layers: [{ w: "sine", r: 1, v: 0.12 }, { w: "sine", r: 2, v: 0.12, cents: 3 }, { w: "sine", r: 3, v: 0.06 }, { w: "sine", r: 4.01, v: 0.04 }], a: 2.5, r: 3, sustain: true, gain: 0.4, trem: { rate: 0.3, depth: 0.5 } },
  muffledPad: { layers: [{ w: "triangle", r: 1, v: 0.2 }, { w: "sine", r: 0.5, v: 0.2 }], a: 2, r: 3, sustain: true, gain: 0.5, filter: { type: "lowpass", fmul: 2.5, q: 1 }, vib: { rate: 0.2, cents: 8 } },
  synthPad: { layers: [{ w: "sawtooth", r: 1, v: 0.08, cents: -9 }, { w: "sawtooth", r: 1, v: 0.08, cents: 9 }], a: 1.2, r: 1.5, sustain: true, gain: 0.45, filter: { type: "lowpass", fmul: 5, to: 2.5, q: 1.5 } },
  smokePad: { layers: [{ w: "triangle", r: 1, v: 0.14, cents: -6 }, { w: "triangle", r: 1, v: 0.14, cents: 6 }, { w: "sine", r: 0.5, v: 0.1 }], a: 0.8, r: 1.2, sustain: true, gain: 0.5, filter: { type: "lowpass", fmul: 4 }, vib: { rate: 4.2, cents: 6 } },
  boilerPad: { layers: [{ w: "square", r: 1, v: 0.05 }, { w: "sine", r: 0.5, v: 0.15 }, { w: "sawtooth", r: 2, v: 0.03 }], a: 1, r: 1.5, sustain: true, gain: 0.5, filter: { type: "lowpass", fmul: 3 }, trem: { rate: 2.2, depth: 0.25 } },
  ironPad: { layers: [{ w: "sawtooth", r: 1, v: 0.08, cents: -14 }, { w: "sawtooth", r: 1.005, v: 0.08, cents: 14 }, { w: "sawtooth", r: 0.5, v: 0.1 }], a: 0.6, r: 1.2, sustain: true, gain: 0.4, filter: { type: "lowpass", fmul: 3, q: 4 } },
  breathPad: { layers: [{ w: "sine", r: 1, v: 0.14 }, { w: "triangle", r: 2, v: 0.06, cents: 10 }, { w: "sine", r: 1.5, v: 0.08 }], a: 1.8, r: 2, sustain: true, gain: 0.5, filter: { type: "lowpass", fmul: 5 }, trem: { rate: 0.5, depth: 0.35 } },
  reedPad: { layers: [{ w: "sawtooth", r: 1, v: 0.06, cents: -7 }, { w: "sawtooth", r: 1, v: 0.06, cents: 7 }, { w: "square", r: 2, v: 0.03 }], a: 0.5, r: 0.8, sustain: true, gain: 0.5, filter: { type: "lowpass", fmul: 6 }, vib: { rate: 5.5, cents: 8 } },
  organPad: { layers: [{ w: "square", r: 1, v: 0.05 }, { w: "square", r: 2, v: 0.04 }, { w: "sine", r: 3, v: 0.03 }, { w: "sine", r: 4, v: 0.02 }], a: 0.3, r: 0.6, sustain: true, gain: 0.55, filter: { type: "lowpass", fmul: 7 }, vib: { rate: 6, cents: 14 } },

  // Lead and accent voices.
  bell: { layers: [{ w: "sine", r: 1, v: 0.2, decay: 1 }, { w: "sine", r: 2.76, v: 0.1, decay: 0.6 }, { w: "sine", r: 5.4, v: 0.06, decay: 0.35 }, { w: "sine", r: 8.93, v: 0.03, decay: 0.2 }], a: 0.005, gain: 0.8 },
  pluck: { layers: [{ w: "triangle", r: 1, v: 0.22 }, { w: "sine", r: 2, v: 0.06, decay: 0.5 }], a: 0.004, gain: 0.8, filter: { type: "lowpass", fmul: 8, to: 2 } },
  arp: { layers: [{ w: "sawtooth", r: 1, v: 0.1 }, { w: "square", r: 1, v: 0.05, cents: 5 }], a: 0.003, gain: 0.7, filter: { type: "lowpass", fmul: 6, to: 1.5, q: 2 } },
  musicBox: { layers: [{ w: "sine", r: 1, v: 0.2 }, { w: "sine", r: 2, v: 0.08, decay: 0.5 }, { w: "sine", r: 4, v: 0.05, decay: 0.3 }, { w: "sine", r: 6, v: 0.02, decay: 0.2 }], a: 0.002, gain: 0.8 },
  calliope: { layers: [{ w: "sawtooth", r: 1, v: 0.06, cents: -12 }, { w: "sawtooth", r: 1, v: 0.06, cents: 12 }, { w: "square", r: 2, v: 0.03 }], a: 0.03, r: 0.08, sustain: true, gain: 0.7, filter: { type: "lowpass", fmul: 7 }, vib: { rate: 6, cents: 20 } },
  marimba: { layers: [{ w: "sine", r: 1, v: 0.25 }, { w: "sine", r: 4, v: 0.1, decay: 0.15 }, { w: "triangle", r: 0.5, v: 0.06 }], a: 0.002, gain: 0.85 },
  glass: { layers: [{ w: "sine", r: 1, v: 0.14 }, { w: "sine", r: 2, v: 0.1, cents: 2, decay: 0.8 }, { w: "sine", r: 3, v: 0.06, decay: 0.6 }, { w: "sine", r: 5.04, v: 0.03, decay: 0.4 }], a: 0.01, gain: 0.8, echo: { delay: 0.55, gain: 0.45 } },
  twang: { layers: [{ w: "sawtooth", r: 1, v: 0.1 }, { w: "square", r: 1, v: 0.03 }], a: 0.003, gain: 0.8, bend: 1.04, filter: { type: "bandpass", fmul: 3, to: 1.2, q: 2 }, echo: { delay: 0.3, gain: 0.3 } },
  vibes: { layers: [{ w: "sine", r: 1, v: 0.2 }, { w: "sine", r: 4, v: 0.08, decay: 0.5 }], a: 0.004, gain: 0.85, trem: { rate: 5, depth: 0.35 } },
  warble: { layers: [{ w: "sine", r: 1, v: 0.16 }, { w: "sine", r: 1.01, v: 0.12, cents: 25 }, { w: "triangle", r: 2, v: 0.05 }], a: 0.08, r: 0.4, sustain: true, gain: 0.7, vib: { rate: 3.1, cents: 45 } },
  horn: { layers: [{ w: "sawtooth", r: 1, v: 0.1 }, { w: "sawtooth", r: 1, v: 0.06, cents: 8 }], a: 0.06, r: 0.25, sustain: true, gain: 0.7, filter: { type: "lowpass", fmul: 3, to: 6 } },
  sub: { layers: [{ w: "sine", r: 1, v: 0.3 }, { w: "sine", r: 0.5, v: 0.15 }], a: 0.01, r: 0.2, sustain: true, gain: 0.8 },
  sonarBell: { layers: [{ w: "sine", r: 1, v: 0.22 }, { w: "sine", r: 2, v: 0.05, decay: 0.5 }], a: 0.006, gain: 0.8, filter: { type: "lowpass", fmul: 3 }, echo: { delay: 0.6, gain: 0.55 } },

  // Bass voices.
  subBass: { layers: [{ w: "sine", r: 1, v: 0.35 }, { w: "triangle", r: 1, v: 0.12, decay: 0.7 }], a: 0.01, gain: 0.9, filter: { type: "lowpass", fmul: 3 } },
  walkBass: { layers: [{ w: "triangle", r: 1, v: 0.3 }, { w: "sine", r: 1, v: 0.2 }], a: 0.006, gain: 0.9, filter: { type: "lowpass", fmul: 3 } },
  pulseBass: { layers: [{ w: "square", r: 1, v: 0.12 }], a: 0.002, gain: 0.9, filter: { type: "lowpass", fmul: 2.5, to: 1.2, q: 2 } },
  tubaBass: { layers: [{ w: "triangle", r: 1, v: 0.3 }, { w: "square", r: 1, v: 0.06 }], a: 0.02, gain: 0.9, filter: { type: "lowpass", fmul: 3 } },
  ironBass: { layers: [{ w: "sawtooth", r: 1, v: 0.14 }, { w: "sawtooth", r: 1, v: 0.1, cents: 12 }], a: 0.004, gain: 0.8, filter: { type: "lowpass", fmul: 2.5, q: 5 } },
  thumpBass: { layers: [{ w: "sine", r: 1, v: 0.4 }], a: 0.002, gain: 0.9, bend: 1.8 },
};

// ------------------------------------------------------------------------------------------------------- drums

export const DRUMS: Record<DrumVoice, readonly Step[]> = {
  kick: [tone(120, 0.18, "sine", 0.5, { to: 45, a: 0.003 }), noise(0.03, 600, 0.1)],
  tom: [tone(160, 0.3, "sine", 0.4, { to: 70, a: 0.003 }), noise(0.06, 500, 0.08)],
  snare: [noise(0.15, 1800, 0.22, "bandpass", { q: 0.8 }), tone(190, 0.08, "triangle", 0.12, { a: 0.002 })],
  rim: [tone(800, 0.03, "square", 0.06, { a: 0.001 }), noise(0.03, 2500, 0.1, "bandpass", { q: 1.5 })],
  tick: [noise(0.02, 5000, 0.08, "highpass")],
  hat: [noise(0.04, 7000, 0.07, "highpass")],
  shaker: [noise(0.07, 6000, 0.06, "bandpass", { q: 1, a: 0.02 })],
  wood: [tone(520, 0.07, "triangle", 0.16, { a: 0.001 }), tone(780, 0.05, "sine", 0.08, { a: 0.001 })],
  clank: [tone(340, 0.25, "square", 0.05, { a: 0.001 }), tone(530, 0.35, "sine", 0.08, { a: 0.001 }), tone(817, 0.3, "sine", 0.05, { a: 0.001 }), noise(0.05, 3000, 0.08, "bandpass", { q: 2 })],
  gear: [noise(0.03, 2600, 0.1, "bandpass", { q: 3 }), tone(1200, 0.015, "square", 0.04, { a: 0.001 })],
  bongo: [tone(330, 0.12, "sine", 0.3, { to: 260, a: 0.002 })],
  heartbeat: [tone(70, 0.2, "sine", 0.5, { to: 45, a: 0.004 }), tone(62, 0.15, "sine", 0.3, { to: 42, at: 0.18, a: 0.004 })],
  brush: [noise(0.12, 4000, 0.1, "bandpass", { q: 0.4, a: 0.03 })],
  bellTick: [tone(1760, 0.25, "sine", 0.04, { a: 0.001 }), tone(2349, 0.18, "sine", 0.025, { a: 0.001 })],
  anvil: [tone(220, 0.4, "square", 0.07, { a: 0.001 }), tone(440, 0.45, "sine", 0.08, { a: 0.001 }), tone(662, 0.5, "sine", 0.06, { a: 0.001 }), noise(0.1, 2000, 0.15, "bandpass", { q: 1 })],
  crack: [noise(0.1, 3500, 0.2, "highpass"), tone(1200, 0.06, "sine", 0.1, { to: 300, a: 0.001 })],
};

// ------------------------------------------------------------------------------------------- ambience events

/** A deterministic random source in [0, 1). */
export type Rng = () => number;

const pick = (rng: Rng, pool: readonly number[], fallback: number): number => (pool.length ? pool[Math.floor(rng() * pool.length) % pool.length] : fallback);

/**
 * Builds the steps for one occurrence of an ambience event. `pool` is a set of in-key frequencies (high register)
 * so pitched events (pings, bells, bubbles) stay consonant with the score.
 */
export function fxSteps(fx: FxVoice, rng: Rng, pool: readonly number[]): Step[] {
  switch (fx) {
    case "drip": { const f = 1400 + rng() * 800; return [tone(f, 0.12, "sine", 0.1, { to: f * 0.6, a: 0.002 }), tone(f * 0.8, 0.1, "sine", 0.04, { to: f * 0.5, at: 0.18, a: 0.002 })]; }
    case "creak": { const f = 120 + rng() * 60; return [tone(f, 0.9, "sawtooth", 0.035, { to: f * 0.7, a: 0.2 }), noise(0.8, 700, 0.04, "lowpass", { a: 0.2 })]; }
    case "toll": { const f = pick(rng, pool, 440) / 4; return [tone(f, 3, "sine", 0.08, { a: 0.005 }), tone(f * 2.76, 1.6, "sine", 0.03, { a: 0.005 })]; }
    case "beep": { const f = pick(rng, pool, 1200) * 2; return [tone(f, 0.06, "square", 0.03, { a: 0.002 }), tone(f * 1.5, 0.06, "square", 0.03, { at: 0.1, a: 0.002 })]; }
    case "steam": return [noise(1.2, 2500, 0.05, "highpass", { a: 0.15 })];
    case "sonar": { const f = pick(rng, pool, 1100); return [tone(f, 1.4, "sine", 0.08, { a: 0.005 }), tone(f, 1.2, "sine", 0.04, { at: 0.7, a: 0.005 }), tone(f, 1, "sine", 0.02, { at: 1.4, a: 0.005 })]; }
    case "bubble": return [0, 1, 2].map((i) => { const f = 400 + rng() * 300; return tone(f, 0.08, "sine", 0.05, { to: f * 2, at: i * 0.05 + rng() * 0.03, a: 0.002 }); });
    case "pop": return [noise(0.05, 900, 0.15), tone(300, 0.06, "sine", 0.1, { to: 100, a: 0.001 })];
    case "honk": return [tone(330, 0.25, "sawtooth", 0.04, { to: 290, a: 0.01 }), tone(415, 0.25, "sawtooth", 0.04, { to: 370, at: 0.3, a: 0.01 })];
    case "insect": { const n = 6 + Math.floor(rng() * 5); const base = 4800 + rng() * 1800; return Array.from({ length: n }, (_, i) => noise(0.02, base, 0.02, "bandpass", { q: 8, at: i * 0.035 })); }
    case "bird": { const n = 2 + Math.floor(rng() * 2); return Array.from({ length: n * 2 }, (_, i) => (i % 2 === 0 ? tone(1800, 0.1, "sine", 0.03, { to: 2600, at: Math.floor(i / 2) * 0.28, a: 0.01 }) : tone(2600, 0.1, "sine", 0.03, { to: 1900, at: Math.floor(i / 2) * 0.28 + 0.12, a: 0.01 }))); }
    case "swell": { const f = pick(rng, pool, 440); return [noise(3, 400, 0.06, "bandpass", { q: 1, to: 1400, a: 1.5 }), tone(f, 3, "sine", 0.03, { a: 1.5 })]; }
    case "whisper": return [noise(1.4, 1800, 0.05, "bandpass", { q: 4, to: 2200, a: 0.5 })];
    case "wind": return [noise(3, 500, 0.09, "bandpass", { q: 0.8, to: 900, a: 1.4 })];
    case "icecreak": return [tone(900, 0.6, "sawtooth", 0.02, { to: 300, a: 0.05 }), noise(0.2, 4000, 0.02, "highpass")];
    case "glassPing": { const f = pick(rng, pool, 1500); return [tone(f, 2.2, "sine", 0.05, { a: 0.003 }), tone(f * 2.01, 1.2, "sine", 0.025, { a: 0.003 })]; }
    case "tumble": return [noise(1.8, 400, 0.05, "lowpass", { a: 0.6 }), tone(90, 0.15, "sine", 0.1, { at: 0.5, a: 0.005 }), tone(80, 0.15, "sine", 0.08, { at: 0.9, a: 0.005 }), tone(95, 0.15, "sine", 0.06, { at: 1.4, a: 0.005 })];
    case "metalClank": return [tone(300, 0.3, "square", 0.04, { a: 0.001 }), tone(460, 0.4, "sine", 0.06, { a: 0.001 }), noise(0.05, 2500, 0.06, "bandpass", { q: 2 })];
    case "static": return [0, 1, 2].map((i) => noise(0.08, 3000, 0.04, "highpass", { at: i * 0.11 + rng() * 0.05 }));
    case "geiger": { const n = 5 + Math.floor(rng() * 4); return Array.from({ length: n }, () => noise(0.008, 4000, 0.06, "highpass", { at: rng() * 1 })); }
    case "siren": return [tone(600, 1.5, "sine", 0.02, { to: 800, a: 0.5 }), tone(800, 1.5, "sine", 0.02, { to: 600, at: 1.5, a: 0.3 })];
    case "carHorn": return [tone(330, 0.35, "sawtooth", 0.03, { a: 0.01 }), tone(415, 0.35, "sawtooth", 0.03, { a: 0.01 })];
  }
}

// ---------------------------------------------------------------------------------------------- UI effects

/** The original Catacombs effects, expressed as data. Every theme starts from these and is flavoured below. */
const BASE_EFFECTS: Record<EffectKind, readonly Step[]> = {
  impact: [noise(0.045, 3200, 0.28), { k: "crunch", d: 0.075, v: 0.3 }, tone(125, 0.14, "triangle", 0.3, { to: 48, a: 0.002 }), noise(0.095, 620, 0.16)],
  block: [noise(0.12, 850, 0.12), tone(185, 0.14, "triangle", 0.18, { cents: -10 }), tone(740, 0.07, "sine", 0.08, { cents: -12 })],
  magic: [tone(310, 0.34, "sine", 0.16, { to: 920, a: 0.002 }), noise(0.24, 2400, 0.07)],
  heal: [tone(523.25, 0.45, "sine", 0.09), tone(659.25, 0.45, "sine", 0.08, { at: 0.09 }), tone(783.99, 0.5, "sine", 0.06, { at: 0.18 })],
  defeat: [noise(0.28, 520, 0.2), tone(180, 0.42, "sawtooth", 0.18, { to: 48, a: 0.002 })],
  door: [noise(0.38, 480, 0.11), tone(110, 0.45, "triangle", 0.13, { to: 54, a: 0.002 })],
  encounter: [tone(110, 0.5, "triangle", 0.18, { cents: -8 }), tone(164.81, 0.65, "sine", 0.1, { cents: -12 })],
  victory: [293.66, 369.99, 440].map((f, i) => tone(f, 0.8, "sine", 0.12, { at: i * 0.08, cents: -5 + i * 2 })),
  failure: [tone(220, 0.9, "triangle", 0.17, { to: 55, a: 0.002 })],
  // Adventurer Rank up: a quick brass-like climb to a held major chord, with a sparkle on top.
  rankUp: [
    ...[392, 523.25, 659.25].map((f, i) => tone(f, 0.13, "square", 0.05, { at: i * 0.1, a: 0.004 })),
    ...[523.25, 659.25, 783.99, 1046.5].map((f, i) => tone(f, 1.3, "triangle", 0.09 - i * 0.012, { at: 0.32, a: 0.01, cents: -4 + i * 3 })),
    tone(1046.5, 0.12, "square", 0.04, { at: 0.32, a: 0.003 }),
    tone(130.81, 1.1, "sine", 0.14, { at: 0.32, a: 0.01 }),
    noise(0.7, 5200, 0.035, "highpass", { at: 0.34, a: 0.05 }),
    ...[2093, 2637, 3136].map((f, i) => tone(f, 0.35, "sine", 0.025, { at: 0.55 + i * 0.11, a: 0.002 })),
  ],
  // Class mastery up: a bright run that keeps rising, a bell, and a low swell of power underneath.
  masteryUp: [
    ...[587.33, 739.99, 880, 1108.73, 1174.66].map((f, i) => tone(f, 0.16, "triangle", 0.08, { at: i * 0.075, a: 0.003 })),
    tone(1174.66, 1.6, "sine", 0.07, { at: 0.4, a: 0.004 }),
    tone(1174.66 * 2.76, 0.9, "sine", 0.025, { at: 0.4, a: 0.003 }),
    tone(146.83, 1.4, "sawtooth", 0.05, { to: 293.66, at: 0.05, a: 0.3 }),
    noise(1, 1800, 0.04, "bandpass", { q: 1.2, to: 6000, at: 0.05, a: 0.35 }),
    ...[1760, 2349.32].map((f, i) => tone(f, 0.5, "sine", 0.03, { at: 0.7 + i * 0.14, a: 0.002 })),
  ],
};

interface EffectFlavour {
  /** Multiplies every tone and sweep frequency. */
  pitch: number;
  /** Multiplies noise filter cutoffs (lower is duller and wetter, higher is brighter and icier). */
  cutoff: number;
  /** Replaces the waveform of magic sweeps. */
  magicWave?: Wave;
  /** Extra steps layered onto specific effects. */
  extra?: Partial<Record<EffectKind, readonly Step[]>>;
}

const FLAVOUR: Record<ThemeId, EffectFlavour> = {
  catacombs: { pitch: 1, cutoff: 1, extra: { block: [tone(1480, 0.2, "sine", 0.03, { a: 0.002 })] } },
  scifi: { pitch: 1.25, cutoff: 1.4, magicWave: "square", extra: { impact: [tone(2400, 0.05, "square", 0.05, { to: 600, a: 0.001 })], magic: [tone(1800, 0.2, "square", 0.04, { to: 3200, a: 0.002 })], heal: [tone(1568, 0.2, "square", 0.03, { at: 0.27, a: 0.002 })] } },
  mobster: { pitch: 0.9, cutoff: 0.9, extra: { impact: [noise(0.12, 1500, 0.2, "bandpass", { q: 0.7, at: 0.02 })], block: [tone(660, 0.3, "sine", 0.05, { a: 0.002 })], magic: [tone(233, 0.5, "sawtooth", 0.04, { a: 0.05 })] } },
  sunken: { pitch: 0.8, cutoff: 0.45, extra: { impact: [noise(0.3, 350, 0.15, "lowpass", { at: 0.05 })], magic: [tone(740, 0.6, "sine", 0.06, { at: 0.1, a: 0.003 }), tone(740, 0.6, "sine", 0.03, { at: 0.5, a: 0.003 })], heal: [noise(0.2, 600, 0.04, "bandpass", { q: 2, at: 0.05 })] } },
  clockwork: { pitch: 1.15, cutoff: 1.2, extra: { impact: [tone(880, 0.3, "sine", 0.06, { a: 0.001 }), noise(0.03, 2600, 0.12, "bandpass", { q: 3 })], block: [tone(1320, 0.35, "sine", 0.05, { a: 0.001 })], magic: [tone(1568, 0.3, "sine", 0.05, { to: 2093, a: 0.001 })] } },
  carnival: { pitch: 1.1, cutoff: 1, magicWave: "triangle", extra: { impact: [tone(330, 0.15, "sawtooth", 0.06, { to: 220, a: 0.005 })], block: [noise(0.05, 900, 0.1, "lowpass")], magic: [tone(880, 0.2, "sawtooth", 0.04, { to: 1320, a: 0.005 })] } },
  jungle: { pitch: 0.95, cutoff: 0.8, extra: { impact: [tone(330, 0.12, "sine", 0.25, { to: 200, a: 0.002 })], block: [tone(520, 0.08, "triangle", 0.12, { a: 0.001 })], magic: [noise(0.4, 4800, 0.04, "bandpass", { q: 6, to: 6500, a: 0.1 })] } },
  dreamscape: { pitch: 1, cutoff: 0.8, magicWave: "triangle", extra: { impact: [tone(97, 0.5, "sine", 0.1, { to: 60, at: 0.05, a: 0.05 })], magic: [tone(311, 0.6, "sine", 0.06, { to: 233, at: 0.1, a: 0.05 })], defeat: [noise(0.6, 1200, 0.05, "bandpass", { q: 3, to: 300, a: 0.2 })] } },
  arctic: { pitch: 1.3, cutoff: 1.6, extra: { impact: [tone(2800, 0.15, "sine", 0.05, { to: 900, a: 0.001 }), noise(0.04, 6000, 0.12, "highpass")], block: [tone(2093, 0.5, "sine", 0.05, { a: 0.001 })], magic: [tone(1760, 0.7, "sine", 0.05, { a: 0.002 })] } },
  ghosttown: { pitch: 0.95, cutoff: 1.05, extra: { impact: [noise(0.2, 1200, 0.14, "bandpass", { q: 0.6, at: 0.03 })], block: [tone(196, 0.5, "sawtooth", 0.04, { to: 190, a: 0.005 })], magic: [tone(330, 0.5, "sawtooth", 0.04, { to: 247, a: 0.01 })] } },
  wasteland: { pitch: 0.85, cutoff: 0.9, extra: { impact: [tone(240, 0.3, "square", 0.05, { a: 0.001 }), noise(0.12, 2200, 0.12, "bandpass", { q: 1.5 })], block: [tone(300, 0.35, "square", 0.04, { a: 0.001 })], magic: [noise(0.35, 3500, 0.06, "bandpass", { q: 3, to: 800, a: 0.01 })] } },
};

/** The steps for a UI effect in a given theme: the base recipe, retuned and with a few theme-specific layers. */
export function effectSteps(kind: EffectKind, theme: ThemeId): Step[] {
  const flavour = FLAVOUR[theme];
  const retune = (step: Step): Step => {
    if (step.k === "tone") return { ...step, f: step.f * flavour.pitch, to: step.to === undefined ? undefined : step.to * flavour.pitch, w: kind === "magic" && flavour.magicWave && step.to !== undefined ? flavour.magicWave : step.w };
    if (step.k === "noise") return { ...step, f: step.f * flavour.cutoff, to: step.to === undefined ? undefined : step.to * flavour.cutoff };
    return step;
  };
  return [...BASE_EFFECTS[kind].map(retune), ...(flavour.extra?.[kind] ?? [])];
}
