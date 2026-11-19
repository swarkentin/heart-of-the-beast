// Deterministic score generation. Given a MusicCue this produces, bar by bar, a list of note and percussion
// events. It never touches Web Audio, so it can be unit tested and rendered offline with exactly the same
// output the live engine plays.
import { layersFor } from "./cue.ts";
import { fxSteps } from "./sounds.ts";
import { profileFor } from "./profiles.ts";
import { SCALES } from "./types.ts";
import type { Rng } from "./sounds.ts";
import type { BossTreatment, Layers, MelodicEvent, MelodicVoice, MusicCue, MusicState, ScaleName, ScoreEvent, SoundEvent, ThemeProfile } from "./types.ts";

export type { Rng };

/** How much faster or slower each state plays relative to the theme's base tempo. */
export const STATE_TEMPO: Record<MusicState, number> = { title: 0.92, party: 0.82, exploration: 0.72, event: 0.6, combat: 1, miniboss: 1.06, boss: 1.12, victory: 0.7, defeat: 0.55 };

export interface Plan {
  cue: MusicCue;
  profile: ThemeProfile;
  boss?: BossTreatment;
  layers: Layers;
  /** Tonic of the current key in Hz. */
  rootHz: number;
  scale: ScaleName;
  bpm: number;
  stepsPerBar: 12 | 16;
  stepSec: number;
  barSec: number;
  swing: number;
  wobble: number;
  voices: { pad: MelodicVoice; bass: MelodicVoice; lead: MelodicVoice; accent: MelodicVoice };
  motif: readonly number[];
}

export function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** mulberry32: a tiny, fast, seedable generator. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makePlan(cue: MusicCue): Plan {
  const profile = profileFor(cue.theme);
  const boss = cue.state === "boss" && cue.boss ? profile.bosses[cue.boss] : undefined;
  const variant = profile.variants[cue.variant];
  const semitones = profile.depthDrift[cue.depth - 1] + (variant?.transpose ?? 0) + (boss?.transpose ?? 0);
  const stepsPerBeat = profile.steps / 4;
  const bpm = profile.bpm * STATE_TEMPO[cue.state] * (1 + 0.04 * (cue.depth - 1)) * (boss?.tempoMul ?? 1) * (variant?.tempoMul ?? 1);
  const stepSec = 60 / (bpm * stepsPerBeat);
  return {
    cue,
    profile,
    boss,
    layers: layersFor(cue.state, cue.depth),
    rootHz: profile.rootHz * 2 ** (semitones / 12),
    scale: boss?.scale ?? profile.scale,
    bpm,
    stepsPerBar: profile.steps,
    stepSec,
    barSec: stepSec * profile.steps,
    swing: profile.swing,
    wobble: profile.wobble,
    voices: { pad: profile.voices.pad, bass: profile.voices.bass, lead: boss?.lead ?? profile.voices.lead, accent: profile.voices.accent },
    motif: boss?.motif ?? profile.motif,
  };
}

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** The scale in force during a bar. Themes with a scale cycle rotate modes every four bars. */
export function scaleForBar(plan: Plan, bar: number): readonly number[] {
  const cycle = plan.profile.scaleCycle;
  if (cycle && cycle.length > 0 && !plan.boss?.scale) return SCALES[cycle[Math.floor(bar / 4) % cycle.length]];
  return SCALES[plan.scale];
}

/** Frequency of a scale degree. Degrees outside 0..len-1 wrap into other octaves; `octave` shifts whole octaves. */
export function degreeFreq(plan: Plan, scale: readonly number[], degree: number, octave = 0): number {
  const len = scale.length;
  const semitones = scale[mod(degree, len)] + 12 * Math.floor(degree / len);
  return plan.rootHz * 2 ** ((semitones + 12 * octave) / 12);
}

/** Seconds from the start of a bar to a step, including swing on the off-beat steps. */
export function stepTime(plan: Plan, step: number): number {
  return step * plan.stepSec + (step % 2 === 1 ? plan.swing * plan.stepSec : 0);
}

/** How a pattern character plays at a given layer level: its velocity, or 0 if the level is too low to include it. */
export function gate(ch: string, level: number): number {
  if (ch === "X") return level >= 0.3 ? 1 : 0;
  if (ch === "x") return level >= 0.5 ? 0.75 : 0;
  if (ch === "o") return level >= 0.85 ? 0.45 : 0;
  return 0;
}

function onsets(pattern: string, level: number): { step: number; vel: number }[] {
  const out: { step: number; vel: number }[] = [];
  for (let step = 0; step < pattern.length; step += 1) {
    const vel = gate(pattern[step], level);
    if (vel > 0) out.push({ step, vel });
  }
  return out;
}

/** Every bar of a given cue is a pure function of (cue, bar index): replaying a bar reproduces it exactly. */
export function generateBar(plan: Plan, bar: number): ScoreEvent[] {
  const { profile, layers, cue } = plan;
  const rng = mulberry32(hashString([cue.theme, cue.state, cue.boss ?? "", cue.depth, cue.variant].join("|")) ^ Math.imul(bar + 1, 2654435761));
  const scale = scaleForBar(plan, bar);
  const events: ScoreEvent[] = [];
  const chordRoot = profile.chordRoots[Math.floor(bar / 2) % profile.chordRoots.length];
  const cents = () => (plan.wobble ? (rng() - 0.5) * 2 * plan.wobble : 0);
  const melodic = (t: number, voice: MelodicVoice, freq: number, dur: number, vel: number): MelodicEvent => ({ kind: "melodic", t, voice, freq, dur, vel, cents: cents() });

  // Pad: a triad held for two bars. Fuller when the layer is louder.
  if (layers.pad > 0 && bar % 2 === 0) {
    const degrees = layers.pad >= 0.7 ? [chordRoot, chordRoot + 2, chordRoot + 4] : [chordRoot, chordRoot + 4];
    for (const degree of degrees) events.push(melodic(0, plan.voices.pad, degreeFreq(plan, scale, degree, 1), plan.barSec * 2.05, 0.5 * layers.pad));
    // A quiet upper fifth adds harmonic sheen without changing the theme's chord progression.
    events.push(melodic(0, plan.voices.pad, degreeFreq(plan, scale, chordRoot + 4, 2), plan.barSec * 2.05, 0.2 * layers.pad));
  }

  // Bass: onsets from the theme's bass rhythm, notes from its bass lines.
  if (layers.bass > 0) {
    const hits = onsets(profile.patterns.bass, layers.bass);
    const line = profile.bassLines[bar % profile.bassLines.length];
    hits.forEach((hit, k) => {
      const next = hits[k + 1]?.step ?? plan.stepsPerBar;
      const degree = line[k % line.length];
      events.push(melodic(stepTime(plan, hit.step), plan.voices.bass, degreeFreq(plan, scale, degree), Math.max(0.2, (next - hit.step) * plan.stepSec * 0.95), 0.62 * hit.vel * layers.bass));
    });
  }

  // Lead: the theme's tune, following the chord roots. Sparse and every other bar when quiet.
  if (layers.lead > 0 && !(layers.lead < 0.7 && bar % 2 === 1)) {
    const sparse = layers.lead < 0.7;
    const hits = onsets(sparse ? profile.patterns.leadSparse : profile.patterns.lead, layers.lead);
    const slot = sparse ? Math.floor(bar / 2) : bar;
    hits.forEach((hit, k) => {
      const degree = plan.motif[(slot * hits.length + k) % plan.motif.length] + chordRoot;
      events.push(melodic(stepTime(plan, hit.step), plan.voices.lead, degreeFreq(plan, scale, degree, profile.leadOct), plan.stepSec * (sparse ? 6 : 3), 0.55 * hit.vel * layers.lead * (0.92 + rng() * 0.16)));
    });
    // A long accent on the tonic: every fourth bar, every second bar for a boss.
    if (layers.lead >= 0.5 && bar % (plan.boss ? 2 : 4) === 0) events.push(melodic(0, plan.voices.accent, degreeFreq(plan, scale, chordRoot, 1), plan.stepSec * 10, 0.45 * layers.lead));
  }

  // Percussion: kick, backbeat and tick patterns gated by the percussion level, plus a fill at the end of every fourth bar.
  if (layers.perc > 0) {
    const kit: [string, SoundEvent["voice"], number][] = [
      [profile.patterns.kick, profile.voices.kick, layers.perc],
      [profile.patterns.back, profile.voices.back, layers.perc],
      [profile.patterns.tick, profile.voices.tick, layers.perc * 1.4],
    ];
    for (const [pattern, voice, level] of kit) for (const hit of onsets(pattern, level)) events.push({ kind: "drum", t: stepTime(plan, hit.step), voice, vel: hit.vel });
    if (layers.perc >= 0.9 && bar % 4 === 3) {
      const fill = plan.boss?.fill ?? profile.voices.fill;
      for (let step = plan.stepsPerBar - 4; step < plan.stepsPerBar; step += 1) events.push({ kind: "drum", t: stepTime(plan, step), voice: fill, vel: 0.5 + 0.1 * (step - (plan.stepsPerBar - 4)) });
    }
  }

  // Ambience events: random but seeded, so a replayed bar is identical. Pitched ones draw from the key's high register.
  if (layers.fx > 0) {
    const pool = scale.map((_, degree) => degreeFreq(plan, scale, degree, 3));
    const entries = plan.boss?.extraFx ? [...profile.fx, { fx: plan.boss.extraFx, p: 0.5 }] : profile.fx;
    for (const entry of entries) {
      if ((entry.minDepth ?? 1) > cue.depth) continue;
      if (rng() < entry.p * layers.fx) events.push({ kind: "fx", t: rng() * plan.barSec * 0.8, voice: entry.fx, vel: 0.8 + rng() * 0.4, steps: fxSteps(entry.fx, rng, pool) });
    }
  }

  return events;
}

/** A short phrase marking the end of the run: rising for victory, falling for defeat. Times are seconds from the stinger's start. */
export function generateStinger(plan: Plan, kind: "victory" | "defeat"): ScoreEvent[] {
  const scale = scaleForBar(plan, 0);
  const len = scale.length;
  const degrees = kind === "victory" ? [0, 2, 4, len] : [4, 2, 1, 0];
  const times = kind === "victory" ? [0, 0.22, 0.44, 0.8] : [0, 0.4, 0.8, 1.4];
  const events: ScoreEvent[] = degrees.map((degree, i) => ({ kind: "melodic", t: times[i], voice: plan.voices.lead, freq: degreeFreq(plan, scale, degree, plan.profile.leadOct), dur: kind === "victory" ? 0.9 : 1.4, vel: 0.7, cents: 0 }));
  for (const degree of [0, 2, 4]) events.push({ kind: "melodic", t: 0, voice: plan.voices.pad, freq: degreeFreq(plan, scale, degree, 1), dur: 3.5, vel: 0.6, cents: 0 });
  events.push({ kind: "melodic", t: kind === "victory" ? 0.8 : 0, voice: plan.voices.accent, freq: degreeFreq(plan, scale, 0, 1), dur: 2.4, vel: 0.6, cents: 0 });
  if (kind === "defeat") events.push({ kind: "melodic", t: 0, voice: plan.profile.voices.bass, freq: degreeFreq(plan, scale, 0, -1), dur: 3, vel: 0.7, cents: 0 });
  return events;
}
