// Sound definitions as pure data: pitched voice recipes, drum kits, ambience events and UI effect recipes.
// synth.ts turns these into Web Audio nodes. Nothing here touches the DOM.
import type { DrumVoice, EffectKind, FilterKind, FxVoice, MelodicVoice, NoiseStep, Recipe, Step, ThemeId, ToneStep, Wave } from "./types.ts";

const tone = (f: number, d: number, w: Wave, v: number, o: Partial<ToneStep> = {}): ToneStep => ({ k: "tone", f, d, w, v, ...o });
const noise = (d: number, f: number, v: number, ft: FilterKind = "lowpass", o: Partial<NoiseStep> = {}): NoiseStep => ({ k: "noise", d, f, v, ft, ...o });

// ------------------------------------------------------------------------------------------------ pitched voices

// Levels: a single note at velocity 1 peaks around 0.2-0.3 before the part mix (synth.ts MIX). Bass voices
// carry an octave harmonic so the line stays audible on phone and laptop speakers that cannot reproduce the
// fundamental.
export const RECIPES: Record<MelodicVoice, Recipe> = {
  // Pads: sustained, slow attack, filter tracks the note.
  dronePad: { layers: [{ w: "triangle", r: 1, v: 0.18 }, { w: "sine", r: 1.5, v: 0.11, cents: -4 }, { w: "sine", r: 2, v: 0.045, cents: 5 }], a: 1.5, r: 2, sustain: true, gain: 0.5, filter: { type: "lowpass", fmul: 4, q: 0.7 }, unison: { n: 2, cents: 7 } },
  choirPad: { layers: [{ w: "sine", r: 1, v: 0.2 }, { w: "sine", r: 2, v: 0.1, cents: 7 }, { w: "sine", r: 3, v: 0.05, cents: -6 }], a: 2, r: 2.5, sustain: true, gain: 0.45, filter: { type: "lowpass", fmul: 6 }, vib: { rate: 5, cents: 12 } },
  glassPad: { layers: [{ w: "sine", r: 1, v: 0.12 }, { w: "sine", r: 2, v: 0.12, cents: 3 }, { w: "sine", r: 3, v: 0.06 }, { w: "sine", r: 4.01, v: 0.04 }], a: 2.5, r: 3, sustain: true, gain: 0.4, trem: { rate: 0.3, depth: 0.5 } },
  muffledPad: { layers: [{ w: "triangle", r: 1, v: 0.2 }, { w: "sine", r: 0.5, v: 0.2 }], a: 2, r: 3, sustain: true, gain: 0.5, filter: { type: "lowpass", fmul: 2.5, q: 1 }, vib: { rate: 0.2, cents: 8 } },
  synthPad: { layers: [{ w: "sawtooth", r: 1, v: 0.08, cents: -9 }, { w: "sawtooth", r: 1, v: 0.08, cents: 9 }], a: 1.2, r: 1.5, sustain: true, gain: 0.45, filter: { type: "lowpass", fmul: 5, to: 2.5, q: 1.5 } },
  smokePad: { layers: [{ w: "triangle", r: 1, v: 0.14, cents: -6 }, { w: "triangle", r: 1, v: 0.14, cents: 6 }, { w: "sine", r: 0.5, v: 0.1 }], a: 0.8, r: 1.2, sustain: true, gain: 0.5, filter: { type: "lowpass", fmul: 4 }, vib: { rate: 4.2, cents: 6 } },
  boilerPad: { layers: [{ w: "square", r: 1, v: 0.05 }, { w: "sine", r: 0.5, v: 0.15 }, { w: "sawtooth", r: 2, v: 0.03 }], a: 1, r: 1.5, sustain: true, gain: 0.5, filter: { type: "lowpass", fmul: 3 }, trem: { rate: 2.2, depth: 0.25 } },
  ironPad: { layers: [{ w: "sawtooth", r: 1, v: 0.08, cents: -14 }, { w: "sawtooth", r: 1.005, v: 0.08, cents: 14 }, { w: "sawtooth", r: 0.5, v: 0.1 }], a: 0.6, r: 1.2, sustain: true, gain: 0.4, filter: { type: "lowpass", fmul: 3, q: 4 } },
  breathPad: { layers: [{ w: "sine", r: 1, v: 0.14 }, { w: "triangle", r: 2, v: 0.06, cents: 10 }, { w: "sine", r: 1.5, v: 0.08 }], a: 1.8, r: 2, sustain: true, gain: 0.5, filter: { type: "lowpass", fmul: 5 }, trem: { rate: 0.5, depth: 0.35 } },
  reedPad: { layers: [{ w: "sawtooth", r: 1, v: 0.06, cents: -7 }, { w: "sawtooth", r: 1, v: 0.06, cents: 7 }, { w: "square", r: 2, v: 0.03 }], a: 0.5, r: 0.8, sustain: true, gain: 0.5, filter: { type: "lowpass", fmul: 6 }, vib: { rate: 5.5, cents: 8 } },
  organPad: { layers: [{ w: "square", r: 1, v: 0.05 }, { w: "square", r: 2, v: 0.04 }, { w: "sine", r: 3, v: 0.03 }, { w: "sine", r: 4, v: 0.02 }, { w: "sine", r: 0.5, v: 0.05 }], a: 0.3, r: 0.8, sustain: true, gain: 0.55, filter: { type: "lowpass", fmul: 7 }, vib: { rate: 6, cents: 9 } },
  // Ensemble strings: three detuned saws per partial, darkened, with a slow bow and late vibrato.
  strings: { layers: [{ w: "sawtooth", r: 1, v: 0.11 }, { w: "sawtooth", r: 2, v: 0.025, cents: 4 }], a: 0.7, r: 1.4, sustain: true, gain: 0.5, filter: { type: "lowpass", fmul: 3.2, q: 0.6 }, unison: { n: 3, cents: 11 }, vib: { rate: 5.2, cents: 7, delay: 0.5 } },
  warmPad: { layers: [{ w: "triangle", r: 1, v: 0.16 }, { w: "sawtooth", r: 1, v: 0.05 }, { w: "sine", r: 2, v: 0.04 }], a: 1.1, r: 1.8, sustain: true, gain: 0.5, filter: { type: "lowpass", fmul: 3, q: 0.8 }, unison: { n: 2, cents: 9 }, trem: { rate: 0.25, depth: 0.2 } },
  choirAah: { layers: [{ w: "sawtooth", r: 1, v: 0.07 }, { w: "triangle", r: 1, v: 0.1 }, { w: "sine", r: 2, v: 0.05 }], a: 0.9, r: 1.6, sustain: true, gain: 0.5, filter: { type: "bandpass", fmul: 3.2, q: 1.4 }, unison: { n: 3, cents: 14 }, vib: { rate: 5.4, cents: 10, delay: 0.3 } },
  brassPad: { layers: [{ w: "sawtooth", r: 1, v: 0.1 }, { w: "sawtooth", r: 1, v: 0.07, cents: 6 }], a: 0.35, r: 0.8, sustain: true, gain: 0.45, filter: { type: "lowpass", fmul: 1.6, to: 4, q: 0.9, t: 0.6 }, drive: 1 },
  junoPad: { layers: [{ w: "sawtooth", r: 1, v: 0.08 }, { w: "square", r: 1, v: 0.04 }, { w: "sine", r: 0.5, v: 0.06 }], a: 0.8, r: 1.6, sustain: true, gain: 0.48, filter: { type: "lowpass", fmul: 3.5, to: 2.2, q: 1.2, t: 2 }, unison: { n: 3, cents: 16 }, trem: { rate: 0.4, depth: 0.15 } },

  // Lead and accent voices.
  bell: { layers: [{ w: "sine", r: 1, v: 0.2, decay: 1 }, { w: "sine", r: 2.76, v: 0.1, decay: 0.6 }, { w: "sine", r: 5.4, v: 0.06, decay: 0.35 }, { w: "sine", r: 8.93, v: 0.03, decay: 0.2 }], a: 0.005, gain: 0.8, ring: 1.8 },
  pluck: { layers: [{ w: "triangle", r: 1, v: 0.22 }, { w: "sine", r: 2, v: 0.06, decay: 0.5 }], a: 0.004, gain: 0.8, filter: { type: "lowpass", fmul: 8, to: 2, t: 0.25 }, ring: 0.5 },
  arp: { layers: [{ w: "sawtooth", r: 1, v: 0.1 }, { w: "square", r: 1, v: 0.05, cents: 5 }], a: 0.003, gain: 0.7, filter: { type: "lowpass", fmul: 6, to: 1.5, q: 2, t: 0.18 }, ring: 0.3 },
  musicBox: { layers: [{ w: "sine", r: 1, v: 0.2 }, { w: "sine", r: 2, v: 0.08, decay: 0.5 }, { w: "sine", r: 4, v: 0.05, decay: 0.3 }, { w: "sine", r: 6, v: 0.02, decay: 0.2 }], a: 0.002, gain: 0.8, ring: 1.2 },
  calliope: { layers: [{ w: "sawtooth", r: 1, v: 0.06, cents: -12 }, { w: "sawtooth", r: 1, v: 0.06, cents: 12 }, { w: "square", r: 2, v: 0.03 }], a: 0.03, r: 0.08, sustain: true, gain: 0.7, filter: { type: "lowpass", fmul: 7 }, vib: { rate: 6, cents: 20 } },
  marimba: { layers: [{ w: "sine", r: 1, v: 0.25 }, { w: "sine", r: 4, v: 0.1, decay: 0.15 }, { w: "triangle", r: 0.5, v: 0.06 }], a: 0.002, gain: 0.85, ring: 0.7, hammer: { v: 0.04, f: 1800, d: 0.015, ft: "bandpass", q: 2 } },
  glass: { layers: [{ w: "sine", r: 1, v: 0.14 }, { w: "sine", r: 2, v: 0.1, cents: 2, decay: 0.8 }, { w: "sine", r: 3, v: 0.06, decay: 0.6 }, { w: "sine", r: 5.04, v: 0.03, decay: 0.4 }], a: 0.01, gain: 0.8, echo: { delay: 0.55, gain: 0.45 }, ring: 1.4 },
  twang: { layers: [{ w: "sawtooth", r: 1, v: 0.1 }, { w: "square", r: 1, v: 0.03 }], a: 0.003, gain: 0.8, bend: 1.04, filter: { type: "bandpass", fmul: 3, to: 1.2, q: 2 }, echo: { delay: 0.3, gain: 0.3 }, ring: 0.8 },
  vibes: { layers: [{ w: "sine", r: 1, v: 0.2 }, { w: "sine", r: 4, v: 0.08, decay: 0.5 }], a: 0.004, gain: 0.85, trem: { rate: 5, depth: 0.35 }, ring: 1.4 },
  warble: { layers: [{ w: "sine", r: 1, v: 0.16 }, { w: "sine", r: 1.01, v: 0.12, cents: 25 }, { w: "triangle", r: 2, v: 0.05 }], a: 0.08, r: 0.4, sustain: true, gain: 0.7, vib: { rate: 3.1, cents: 45 } },
  horn: { layers: [{ w: "sawtooth", r: 1, v: 0.1 }, { w: "sawtooth", r: 1, v: 0.06, cents: 8 }], a: 0.06, r: 0.25, sustain: true, gain: 0.7, filter: { type: "lowpass", fmul: 2, to: 5, t: 0.15 }, vib: { rate: 5, cents: 6, delay: 0.3 } },
  sub: { layers: [{ w: "sine", r: 1, v: 0.3 }, { w: "sine", r: 0.5, v: 0.12 }, { w: "triangle", r: 2, v: 0.06 }], a: 0.01, r: 0.2, sustain: true, gain: 0.8, drive: 1 },
  sonarBell: { layers: [{ w: "sine", r: 1, v: 0.22 }, { w: "sine", r: 2, v: 0.05, decay: 0.5 }], a: 0.006, gain: 0.8, filter: { type: "lowpass", fmul: 3 }, echo: { delay: 0.6, gain: 0.55 }, ring: 1.6 },
  // Felt-hammer piano: a bright strike that mellows as it rings.
  piano: { layers: [{ w: "triangle", r: 1, v: 0.2 }, { w: "sine", r: 2, v: 0.09, decay: 0.55 }, { w: "sine", r: 3.01, v: 0.04, decay: 0.3 }, { w: "sine", r: 4.03, v: 0.02, decay: 0.2 }], a: 0.003, gain: 0.85, ring: 1.8, filter: { type: "lowpass", fmul: 7, to: 2.2, t: 1.4 }, hammer: { v: 0.035, f: 2600, d: 0.02, ft: "bandpass", q: 1.2 } },
  // Tine electric piano: FM bell attack that settles into a warm sine, with gentle tremolo.
  epiano: { layers: [{ w: "sine", r: 1, v: 0.22 }, { w: "sine", r: 2, v: 0.03, decay: 0.3 }], a: 0.003, gain: 0.85, ring: 1.6, fm: { r: 1, index: 1.8, end: 0.15 }, trem: { rate: 4.5, depth: 0.18 } },
  harp: { layers: [{ w: "triangle", r: 1, v: 0.22 }, { w: "sine", r: 2, v: 0.08, decay: 0.4 }, { w: "sine", r: 3, v: 0.03, decay: 0.2 }], a: 0.002, gain: 0.85, ring: 1.5, filter: { type: "lowpass", fmul: 9, to: 2.5, t: 0.5 }, hammer: { v: 0.02, f: 3200, d: 0.01, ft: "highpass" } },
  flute: { layers: [{ w: "sine", r: 1, v: 0.22 }, { w: "triangle", r: 2, v: 0.025 }], a: 0.07, r: 0.18, sustain: true, gain: 0.85, vib: { rate: 5, cents: 13, delay: 0.25 }, hammer: { v: 0.035, f: 2400, d: 0.12, ft: "bandpass", q: 0.8 } },
  violin: { layers: [{ w: "sawtooth", r: 1, v: 0.13 }, { w: "sawtooth", r: 2, v: 0.02 }], a: 0.08, r: 0.25, sustain: true, gain: 0.7, filter: { type: "lowpass", fmul: 4.5, q: 1 }, unison: { n: 2, cents: 5 }, vib: { rate: 5.6, cents: 15, delay: 0.2 } },
  brass: { layers: [{ w: "sawtooth", r: 1, v: 0.12 }, { w: "sawtooth", r: 1, v: 0.08, cents: 7 }], a: 0.04, r: 0.18, sustain: true, gain: 0.7, filter: { type: "lowpass", fmul: 1.4, to: 5, t: 0.12, q: 1.1 }, fm: { r: 1, index: 0.3, end: 0.1 }, drive: 1.2, vib: { rate: 5.2, cents: 6, delay: 0.35 } },
  frenchHorn: { layers: [{ w: "triangle", r: 1, v: 0.18 }, { w: "sawtooth", r: 1, v: 0.06 }], a: 0.09, r: 0.3, sustain: true, gain: 0.8, filter: { type: "lowpass", fmul: 2.2, to: 3.5, t: 0.25 }, vib: { rate: 4.6, cents: 5, delay: 0.35 } },
  celesta: { layers: [{ w: "sine", r: 1, v: 0.2 }, { w: "sine", r: 4, v: 0.07, decay: 0.3 }, { w: "sine", r: 8.1, v: 0.02, decay: 0.15 }], a: 0.002, gain: 0.8, ring: 1.3, hammer: { v: 0.02, f: 5000, d: 0.008, ft: "highpass" } },
  sawLead: { layers: [{ w: "sawtooth", r: 1, v: 0.1 }, { w: "square", r: 0.5, v: 0.03 }], a: 0.01, r: 0.15, sustain: true, gain: 0.7, filter: { type: "lowpass", fmul: 4, q: 2 }, unison: { n: 3, cents: 10 }, vib: { rate: 5.5, cents: 9, delay: 0.3 } },
  squareLead: { layers: [{ w: "square", r: 1, v: 0.1 }], a: 0.004, r: 0.04, sustain: true, gain: 0.7, filter: { type: "lowpass", fmul: 7 }, vib: { rate: 6, cents: 10, delay: 0.18 } },
  kalimba: { layers: [{ w: "sine", r: 1, v: 0.24 }, { w: "sine", r: 5.3, v: 0.05, decay: 0.12 }, { w: "sine", r: 2, v: 0.03, decay: 0.4 }], a: 0.002, gain: 0.85, ring: 0.9, hammer: { v: 0.03, f: 1400, d: 0.01, ft: "bandpass", q: 3 } },
  steelDrum: { layers: [{ w: "sine", r: 1, v: 0.2 }, { w: "sine", r: 2, v: 0.08, decay: 0.6 }, { w: "sine", r: 3.95, v: 0.05, decay: 0.3 }], a: 0.003, gain: 0.85, ring: 0.9, fm: { r: 2, index: 0.6, end: 0.05 } },
  // Orchestral string ostinato: short bowed notes.
  staccato: { layers: [{ w: "sawtooth", r: 1, v: 0.12 }], a: 0.008, gain: 0.7, ring: 0.22, filter: { type: "lowpass", fmul: 4, to: 1.8, t: 0.15 }, unison: { n: 3, cents: 10 } },
  // Orchestral hit: brass and strings together, saturated.
  stab: { layers: [{ w: "sawtooth", r: 1, v: 0.1 }, { w: "square", r: 0.5, v: 0.05 }, { w: "sawtooth", r: 2, v: 0.03 }], a: 0.006, gain: 0.7, ring: 0.6, filter: { type: "lowpass", fmul: 5, to: 1.5, t: 0.4 }, unison: { n: 3, cents: 12 }, drive: 1.6 },
  choirLead: { layers: [{ w: "sawtooth", r: 1, v: 0.07 }, { w: "triangle", r: 1, v: 0.12 }], a: 0.15, r: 0.4, sustain: true, gain: 0.65, filter: { type: "bandpass", fmul: 3, q: 1.2 }, unison: { n: 3, cents: 12 }, vib: { rate: 5.4, cents: 12, delay: 0.25 } },
  organLead: { layers: [{ w: "square", r: 1, v: 0.06 }, { w: "square", r: 2, v: 0.04 }, { w: "sine", r: 3, v: 0.04 }, { w: "sine", r: 0.5, v: 0.06 }], a: 0.01, r: 0.15, sustain: true, gain: 0.7, filter: { type: "lowpass", fmul: 6 }, vib: { rate: 6.4, cents: 8 } },
  accordion: { layers: [{ w: "sawtooth", r: 1, v: 0.07, cents: -9 }, { w: "sawtooth", r: 1, v: 0.07, cents: 9 }, { w: "square", r: 2, v: 0.03 }], a: 0.04, r: 0.1, sustain: true, gain: 0.7, filter: { type: "lowpass", fmul: 5 }, trem: { rate: 6, depth: 0.15 } },
  trumpet: { layers: [{ w: "sawtooth", r: 1, v: 0.1 }, { w: "square", r: 1, v: 0.05 }], a: 0.03, r: 0.12, sustain: true, gain: 0.65, filter: { type: "lowpass", fmul: 2, to: 6, t: 0.08, q: 1.2 }, vib: { rate: 5.6, cents: 10, delay: 0.25 }, drive: 1 },
  sax: { layers: [{ w: "sawtooth", r: 1, v: 0.1 }, { w: "square", r: 1, v: 0.04 }], a: 0.05, r: 0.15, sustain: true, gain: 0.65, filter: { type: "lowpass", fmul: 3, q: 3 }, vib: { rate: 5, cents: 16, delay: 0.2 }, drive: 1.5, hammer: { v: 0.02, f: 2000, d: 0.05, ft: "bandpass", q: 1 } },
  guitar: { layers: [{ w: "sawtooth", r: 1, v: 0.1 }, { w: "triangle", r: 1, v: 0.12 }], a: 0.002, gain: 0.8, ring: 1, bend: 1.01, filter: { type: "lowpass", fmul: 6, to: 1.6, t: 0.35 }, hammer: { v: 0.03, f: 3000, d: 0.01, ft: "highpass" } },
  theremin: { layers: [{ w: "sine", r: 1, v: 0.24 }, { w: "triangle", r: 2, v: 0.02 }], a: 0.12, r: 0.35, sustain: true, gain: 0.8, vib: { rate: 6, cents: 28, delay: 0.1 } },
  chime: { layers: [{ w: "sine", r: 1, v: 0.16 }, { w: "sine", r: 2.4, v: 0.08, decay: 0.7 }, { w: "sine", r: 4.6, v: 0.04, decay: 0.4 }], a: 0.003, gain: 0.8, ring: 2.6 },
  koto: { layers: [{ w: "triangle", r: 1, v: 0.2 }, { w: "sawtooth", r: 1, v: 0.04 }], a: 0.002, gain: 0.85, ring: 1.1, bend: 1.02, filter: { type: "lowpass", fmul: 7, to: 2, t: 0.25 } },
  timpani: { layers: [{ w: "sine", r: 1, v: 0.32 }, { w: "sine", r: 1.5, v: 0.08, decay: 0.4 }, { w: "sine", r: 2, v: 0.05, decay: 0.3 }], a: 0.003, gain: 0.9, ring: 1.5, bend: 1.05, bendT: 0.1, hammer: { v: 0.08, f: 320, d: 0.06 } },

  // Bass voices.
  subBass: { layers: [{ w: "sine", r: 1, v: 0.3 }, { w: "triangle", r: 1, v: 0.1, decay: 0.7 }, { w: "sine", r: 2, v: 0.07 }], a: 0.01, gain: 0.9, filter: { type: "lowpass", fmul: 4 } },
  walkBass: { layers: [{ w: "triangle", r: 1, v: 0.3 }, { w: "sine", r: 1, v: 0.18 }, { w: "sine", r: 2, v: 0.06 }], a: 0.006, gain: 0.9, filter: { type: "lowpass", fmul: 3 }, hammer: { v: 0.03, f: 700, d: 0.03 } },
  pulseBass: { layers: [{ w: "square", r: 1, v: 0.12 }], a: 0.002, gain: 0.9, filter: { type: "lowpass", fmul: 2.5, to: 1.2, q: 2, t: 0.2 } },
  tubaBass: { layers: [{ w: "triangle", r: 1, v: 0.3 }, { w: "square", r: 1, v: 0.06 }], a: 0.02, gain: 0.9, filter: { type: "lowpass", fmul: 3 } },
  ironBass: { layers: [{ w: "sawtooth", r: 1, v: 0.14 }, { w: "sawtooth", r: 1, v: 0.1, cents: 12 }], a: 0.004, gain: 0.8, filter: { type: "lowpass", fmul: 2.5, q: 5 }, drive: 1.5 },
  thumpBass: { layers: [{ w: "sine", r: 1, v: 0.38 }, { w: "sine", r: 2, v: 0.06 }], a: 0.002, gain: 0.9, bend: 1.8 },
  fmBass: { layers: [{ w: "sine", r: 1, v: 0.3 }, { w: "sine", r: 2, v: 0.05 }], a: 0.003, r: 0.06, sustain: true, gain: 0.9, fm: { r: 1, index: 2.2, end: 0.4 } },
  upright: { layers: [{ w: "triangle", r: 1, v: 0.3 }, { w: "sine", r: 1, v: 0.18 }, { w: "sine", r: 2, v: 0.06, decay: 0.5 }], a: 0.004, gain: 0.95, ring: 0.6, filter: { type: "lowpass", fmul: 3.5, to: 1.6, t: 0.25 }, hammer: { v: 0.05, f: 600, d: 0.03 } },
  synthBass: { layers: [{ w: "sawtooth", r: 1, v: 0.13 }, { w: "square", r: 0.5, v: 0.08 }], a: 0.003, r: 0.06, sustain: true, gain: 0.85, filter: { type: "lowpass", fmul: 2.2, to: 1.1, q: 4, t: 0.18 } },
  cello: { layers: [{ w: "sawtooth", r: 1, v: 0.13 }, { w: "sine", r: 1, v: 0.1 }], a: 0.05, r: 0.2, sustain: true, gain: 0.8, filter: { type: "lowpass", fmul: 3, q: 0.8 }, unison: { n: 2, cents: 6 }, vib: { rate: 5, cents: 8, delay: 0.3 } },
  reeseBass: { layers: [{ w: "sawtooth", r: 1, v: 0.1, cents: -16 }, { w: "sawtooth", r: 1, v: 0.1, cents: 16 }, { w: "sine", r: 1, v: 0.16 }], a: 0.01, r: 0.1, sustain: true, gain: 0.8, filter: { type: "lowpass", fmul: 2.5, q: 1.2 }, drive: 1.4 },
  chipBass: { layers: [{ w: "triangle", r: 1, v: 0.36 }], a: 0.002, r: 0.02, sustain: true, gain: 0.9 },
};

// ------------------------------------------------------------------------------------------------------- drums

export const DRUMS: Record<DrumVoice, readonly Step[]> = {
  // A punchy kick: a fast pitch drop for the body, a short click for the beater.
  kick: [tone(155, 0.32, "sine", 0.55, { to: 44, a: 0.002 }), tone(78, 0.26, "sine", 0.18, { to: 42, a: 0.003 }), noise(0.012, 3800, 0.1, "highpass")],
  tom: [tone(175, 0.4, "sine", 0.42, { to: 78, a: 0.002 }), tone(350, 0.08, "triangle", 0.06, { to: 160, a: 0.002 }), noise(0.05, 900, 0.07)],
  // Snare: a tuned body under band-passed wires and a high sizzle.
  snare: [tone(195, 0.12, "triangle", 0.18, { to: 160, a: 0.002 }), tone(330, 0.06, "sine", 0.07, { a: 0.001 }), noise(0.2, 2300, 0.2, "bandpass", { q: 0.7 }), noise(0.13, 6500, 0.07, "highpass")],
  rim: [tone(800, 0.03, "square", 0.06, { a: 0.001 }), noise(0.03, 2500, 0.1, "bandpass", { q: 1.5 })],
  tick: [noise(0.02, 5000, 0.08, "highpass")],
  hat: [{ k: "metal", d: 0.05, v: 0.06, f: 7200 }, noise(0.03, 9000, 0.03, "highpass")],
  shaker: [noise(0.07, 6000, 0.06, "bandpass", { q: 1, a: 0.02 })],
  wood: [tone(520, 0.07, "triangle", 0.16, { a: 0.001 }), tone(780, 0.05, "sine", 0.08, { a: 0.001 })],
  clank: [tone(340, 0.25, "square", 0.05, { a: 0.001 }), tone(530, 0.35, "sine", 0.08, { a: 0.001 }), tone(817, 0.3, "sine", 0.05, { a: 0.001 }), noise(0.05, 3000, 0.08, "bandpass", { q: 2 })],
  gear: [noise(0.03, 2600, 0.1, "bandpass", { q: 3 }), tone(1200, 0.015, "square", 0.04, { a: 0.001 })],
  bongo: [tone(330, 0.12, "sine", 0.3, { to: 260, a: 0.002 })],
  heartbeat: [tone(70, 0.22, "sine", 0.5, { to: 45, a: 0.004 }), tone(140, 0.06, "sine", 0.06, { to: 90, a: 0.002 }), tone(62, 0.16, "sine", 0.3, { to: 42, at: 0.18, a: 0.004 })],
  brush: [noise(0.12, 4000, 0.1, "bandpass", { q: 0.4, a: 0.03 })],
  bellTick: [tone(1760, 0.25, "sine", 0.04, { a: 0.001 }), tone(2349, 0.18, "sine", 0.025, { a: 0.001 })],
  anvil: [tone(220, 0.4, "square", 0.07, { a: 0.001 }), tone(440, 0.45, "sine", 0.08, { a: 0.001 }), tone(662, 0.5, "sine", 0.06, { a: 0.001 }), noise(0.1, 2000, 0.15, "bandpass", { q: 1 })],
  crack: [noise(0.1, 3500, 0.2, "highpass"), tone(1200, 0.06, "sine", 0.1, { to: 300, a: 0.001 })],
  openHat: [{ k: "metal", d: 0.32, v: 0.05, f: 6800 }, noise(0.28, 8500, 0.025, "highpass")],
  crash: [{ k: "metal", d: 1.9, v: 0.065, f: 4200, base: 58 }, noise(2.1, 5200, 0.06, "highpass", { a: 0.002 })],
  ride: [{ k: "metal", d: 0.9, v: 0.03, f: 5200, base: 71 }, tone(2640, 0.7, "sine", 0.015, { a: 0.001 })],
  clap: [0, 0.011, 0.022].map(at => noise(0.012, 1500, 0.16, "bandpass", { q: 1.2, at, a: 0.001 })).concat([noise(0.18, 1400, 0.12, "bandpass", { q: 1, at: 0.03, a: 0.002 })]),
  taiko: [tone(105, 0.75, "sine", 0.55, { to: 52, a: 0.003 }), tone(210, 0.16, "triangle", 0.08, { to: 105, a: 0.002 }), noise(0.08, 450, 0.22)],
  gong: [{ k: "metal", d: 3.4, v: 0.045, f: 900, base: 24, a: 0.01 }, tone(98, 3.5, "sine", 0.1, { a: 0.01 }), tone(147.3, 3, "sine", 0.05, { a: 0.02 }), tone(233, 2.4, "sine", 0.03, { a: 0.03 })],
  tambourine: [{ k: "metal", d: 0.18, v: 0.035, f: 8200, base: 92 }, noise(0.15, 9000, 0.03, "highpass", { a: 0.008 })],
  conga: [tone(262, 0.22, "sine", 0.3, { to: 232, a: 0.002 }), noise(0.02, 1200, 0.05)],
  chipKick: [tone(210, 0.12, "triangle", 0.4, { to: 42, a: 0.001 })],
  chipSnare: [noise(0.12, 5200, 0.17), tone(310, 0.05, "square", 0.05, { to: 150, a: 0.001 })],
  chipHat: [noise(0.03, 9000, 0.07, "highpass")],
  snap: [noise(0.04, 2200, 0.18, "bandpass", { q: 2, a: 0.001 }), tone(1800, 0.02, "sine", 0.04, { a: 0.001 })],
  // Cinematic sub boom for the downbeat of a boss section.
  boom: [tone(62, 1.3, "sine", 0.5, { to: 30, a: 0.004 }), noise(0.45, 220, 0.28, "lowpass", { a: 0.004 })],
  cowbell: [tone(540, 0.25, "square", 0.04, { a: 0.001 }), tone(800, 0.25, "square", 0.03, { a: 0.001 })],
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
  noir: { pitch: 0.9, cutoff: 0.8, extra: { impact: [noise(0.1, 1400, 0.16, "bandpass", { q: 0.8, at: 0.02 })], block: [tone(523, 0.3, "triangle", 0.04, { a: 0.002 })], magic: [tone(185, 0.6, "sine", 0.05, { to: 175, a: 0.04 })] } },
  arcade: { pitch: 1.35, cutoff: 1.3, magicWave: "square", extra: { impact: [tone(220, 0.08, "square", 0.08, { to: 110, a: 0.001 })], block: [tone(988, 0.08, "square", 0.05, { a: 0.001 }), tone(1319, 0.12, "square", 0.05, { at: 0.08, a: 0.001 })], heal: [tone(1047, 0.08, "square", 0.04, { a: 0.001 }), tone(1568, 0.12, "square", 0.04, { at: 0.08, a: 0.001 })] } },
  eldritch: { pitch: 0.75, cutoff: 0.6, magicWave: "triangle", extra: { impact: [tone(110, 0.4, "sine", 0.12, { to: 70, a: 0.01 })], magic: [noise(0.5, 900, 0.05, "bandpass", { q: 5, to: 400, a: 0.1 })], heal: [tone(277, 0.6, "sine", 0.04, { to: 262, a: 0.05 })] } },
  infernal: { pitch: 0.8, cutoff: 0.85, extra: { impact: [tone(160, 0.25, "square", 0.06, { a: 0.001 }), noise(0.2, 900, 0.14, "lowpass", { at: 0.02 })], block: [tone(330, 0.4, "square", 0.04, { a: 0.001 })], magic: [noise(0.4, 2400, 0.07, "bandpass", { q: 2, to: 600, a: 0.02 })] } },
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
