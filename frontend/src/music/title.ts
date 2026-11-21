// The two composed menu scores. Unlike the dungeon music they are written out note by note, in D minor, around
// one tune: the "Heart of the Beast" theme.
//
//   Title (40 bars, 72 bpm): a heartbeat and a swelling choir draw the player in (4 bars); a French horn states
//   the theme over harp and strings (16 bars); the whole orchestra takes it up with brass, octave violins,
//   choir, string ostinato and taiko (16 bars); then it breathes out back to the heartbeat (4 bars).
//
//   Party (16 bars, 104 bpm): anticipation in four stages, like the moment before a heist. A ticking clock and
//   pulsing bass; then a string ostinato and horn calls of the theme; then the drums and the theme's second
//   half on violin; then brass stabs, four-on-the-floor and a rising line into a snare roll, and the loop
//   drops back to the ticking clock to build again.
//
// Pure, like score.ts: a bar is a function of its index only.
import type { DrumVoice, MelodicEvent, MelodicVoice, Part, ScoreEvent, SoundEvent } from "./types.ts";
import type { Plan } from "./score.ts";

export const MENU_FORM_BARS = { title: 40, party: 16 } as const;

/** A chord as semitones relative to D: its root and its tones above that root. */
interface Chord { root: number; tones: readonly [number, number, number] }
const Dm: Chord = { root: 0, tones: [0, 3, 7] };
const Bb: Chord = { root: -4, tones: [0, 4, 7] };
const F: Chord = { root: 3, tones: [0, 4, 7] };
const C: Chord = { root: -2, tones: [0, 4, 7] };
const A: Chord = { root: -5, tones: [0, 4, 7] };
const Gm: Chord = { root: -7, tones: [0, 3, 7] };

/** Melody notes as [semitones above D4, start beat, length in beats]. */
type Line = readonly (readonly [number, number, number])[];

/** The sixteen-bar theme: a question that climbs to the high D and falls to the leading tone, and an answer that comes home. */
const THEME_CHORDS: readonly Chord[] = [Dm, Dm, Bb, Bb, F, F, C, A, Dm, Dm, Bb, Gm, F, Gm, A, Dm];
const THEME: readonly Line[] = [
  [[7, 0, 1.5], [8, 1.5, 0.5], [7, 2, 1], [12, 3, 1]],
  [[10, 0, 2], [7, 2, 2]],
  [[8, 0, 1.5], [7, 1.5, 0.5], [3, 2, 1], [5, 3, 1]],
  [[3, 0, 2.5], [2, 2.5, 0.5], [3, 3, 1]],
  [[12, 0, 1.5], [10, 1.5, 0.5], [7, 2, 1], [3, 3, 1]],
  [[7, 0, 2], [8, 2, 1], [10, 3, 1]],
  [[12, 0, 1], [10, 1, 1], [7, 2, 1], [4, 3, 1]],
  [[4, 0, 1.5], [2, 1.5, 0.5], [-1, 2, 2]],
  [[7, 0, 1.5], [8, 1.5, 0.5], [7, 2, 1], [12, 3, 1]],
  [[14, 0, 2], [12, 2, 1], [10, 3, 1]],
  [[12, 0, 1.5], [10, 1.5, 0.5], [8, 2, 2]],
  [[10, 0, 1], [8, 1, 1], [7, 2, 1], [5, 3, 1]],
  [[7, 0, 1.5], [5, 1.5, 0.5], [3, 2, 1], [0, 3, 1]],
  [[5, 0, 1], [3, 1, 1], [2, 2, 2]],
  [[4, 0, 1.5], [2, 1.5, 0.5], [-1, 2, 2]],
  [[0, 0, 4]],
];
const INTRO_CHORDS: readonly Chord[] = [Dm, Bb, Gm, A];
const PARTY_CHORDS: readonly Chord[] = [Dm, Dm, Bb, A, Dm, Dm, Bb, A, Dm, Dm, Bb, Gm, Bb, Bb, A, A];

/** Shared helpers bound to one plan and bar. */
function writer(plan: Plan) {
  const events: ScoreEvent[] = [];
  const beat = plan.stepSec * 4;
  const d4 = plan.rootHz * 4;
  const hz = (semitones: number, base = d4) => base * 2 ** (semitones / 12);
  const note = (part: Part, beatAt: number, voice: MelodicVoice, freq: number, beats: number, vel: number) => {
    events.push({ kind: "melodic", t: beatAt * beat, voice, freq, dur: Math.max(0.05, beats * beat), vel, cents: 0, part } satisfies MelodicEvent);
  };
  const drum = (part: Part, step: number, voice: DrumVoice, vel: number, pitch?: number) => {
    events.push({ kind: "drum", t: step * plan.stepSec, voice, vel, part, ...(pitch ? { pitch } : {}) } satisfies SoundEvent);
  };
  /** A chord's tones placed close to `base`, voice-led. */
  const chordTones = (chord: Chord, base: number) => chord.tones.map(t => { let f = hz(chord.root + t, base); while (f > base * Math.SQRT2) f /= 2; while (f < base / Math.SQRT2) f *= 2; return f; });
  const bassOf = (chord: Chord) => { let f = hz(chord.root, plan.rootHz); if (f < 45) f *= 2; return f; };
  const line = (part: Part, voice: MelodicVoice, notes: Line, vel: number, octave = 0) => {
    for (const [semi, at, beats] of notes) note(part, at, voice, hz(semi + 12 * octave), beats * 0.96, vel * (at === 0 ? 1 : at % 1 === 0 ? 0.9 : 0.8));
  };
  const timpaniRoll = (from: number, vel: number, freq: number) => { for (let s = from; s < 16; s += 1) note("orch", s / 4, "timpani", freq, 0.5, vel * (0.4 + 0.6 * (s - from) / (16 - from))); };
  return { events, hz, note, drum, chordTones, bassOf, line, timpaniRoll, d4 };
}

export function titleBar(plan: Plan, bar: number): ScoreEvent[] {
  const w = writer(plan);
  const at = ((bar % 40) + 40) % 40;
  const intro = at < 4;
  const outro = at >= 36;
  const first = at >= 4 && at < 20;
  const i = first ? at - 4 : at - 20;
  const chord = intro ? INTRO_CHORDS[at] : outro ? INTRO_CHORDS[at - 36] : THEME_CHORDS[i];
  const pad = w.chordTones(chord, w.d4);
  const bass = w.bassOf(chord);

  if (intro || outro) {
    const k = intro ? at : at - 36;
    const swell = intro ? 0.6 + 0.13 * k : 1 - 0.15 * k;
    // The beast's heart: two beats a bar, under a choir that swells in and strings that hold the chord.
    w.drum("drums", 0, "heartbeat", 0.55 * swell);
    w.drum("drums", 8, "heartbeat", 0.4 * swell);
    if (intro && k === 0) w.drum("orch", 0, "boom", 0.55);
    for (const f of pad) w.note("pad", 0, "strings", f, 4.2, 0.3 * swell);
    if (k > 0 || outro) for (const f of w.chordTones(chord, w.d4 * 2)) w.note("orch", 0, "choirAah", f, 4.2, 0.17 * swell);
    w.note("bass", 0, "cello", bass, 4, 0.42 * swell);
    // A piano picks out the theme's first notes, as if remembering it.
    const tease = intro ? [7, 12, 10, 4][k] : [12, 10, 8, -1][k];
    w.note("counter", 0, "piano", w.hz(tease), 3, 0.42);
    w.note("counter", 2.5, "piano", w.hz(tease - 12), 1.5, 0.22);
    if (k === 3) w.timpaniRoll(intro ? 8 : 12, intro ? 0.55 : 0.3, bass * 2 > 160 ? bass : bass * 2);
    return w.events;
  }

  const melody = THEME[i];
  const chordChanged = i === 0 || THEME_CHORDS[i - 1] !== chord;
  const timp = bass * 2 > 160 ? bass : bass * 2;
  if (first) {
    // Statement one: French horn over harp and strings; the heartbeat keeps time underneath.
    for (const f of pad) w.note("pad", 0, "strings", f, 4.1, 0.26);
    w.note("bass", 0, "cello", bass, i === 15 ? 4 : 2, 0.45);
    if (i !== 15) w.note("bass", 2, "cello", bass, 2, 0.36);
    const harp = [0, 1, 2, 3, 2, 1, 3, 1];
    const tones = [...w.chordTones(chord, plan.rootHz * 2), w.chordTones(chord, plan.rootHz * 2)[0] * 2];
    harp.forEach((n, k) => w.note("arp", k / 2, "harp", tones[n], 0.9, (k % 2 === 0 ? 0.32 : 0.24)));
    w.line("lead", "frenchHorn", melody, 0.6);
    w.drum("drums", 0, "heartbeat", 0.32);
    if (i % 4 === 0) w.note("orch", 0, "timpani", timp, 1.5, 0.35);
    if (i === 15) { w.timpaniRoll(8, 0.6, timp); for (let s = 12; s < 16; s += 1) w.drum("drums", s, "snare", 0.18 + 0.08 * (s - 12)); }
    return w.events;
  }

  // Statement two: the full orchestra.
  for (const f of pad) w.note("pad", 0, "strings", f, 4.1, 0.3);
  for (const f of w.chordTones(chord, w.d4 * 2)) w.note("orch", 0, "choirAah", f, 4.1, 0.2);
  for (let q = 0; q < 4; q += 1) w.note("bass", q, "cello", q % 2 === 0 ? bass : bass * 2, 0.9, 0.5);
  const tones = w.chordTones(chord, plan.rootHz * 2);
  const ostinato = [tones[0], tones[0] * 2, tones[2], tones[0] * 2, tones[1], tones[0] * 2, tones[2], tones[0] * 2];
  for (let s = 0; s < 16; s += 1) w.note("arp", s / 4, "staccato", ostinato[s % 8], 0.22, s % 4 === 0 ? 0.3 : 0.2);
  w.line("lead", "brass", melody, 0.58);
  w.line("counter", "violin", melody, 0.34, 1);
  w.drum("orch", 0, "taiko", 0.6);
  w.drum("orch", 8, "taiko", 0.5);
  w.drum("orch", 14, "taiko", 0.32);
  w.drum("drums", 12, "snare", 0.3);
  if (i === 0 || i === 8) { w.drum("perc", 0, "crash", 0.7); w.drum("orch", 0, "boom", i === 0 ? 0.7 : 0.45); }
  if (chordChanged) w.note("orch", 0, "timpani", timp, 1.5, 0.5);
  if (i === 7 || i === 15) w.timpaniRoll(8, 0.65, timp);
  return w.events;
}

export function partyBar(plan: Plan, bar: number): ScoreEvent[] {
  const w = writer(plan);
  const at = ((bar % 16) + 16) % 16;
  const stage = Math.floor(at / 4);
  const chord = PARTY_CHORDS[at];
  const bass = w.bassOf(chord);
  const tones = w.chordTones(chord, plan.rootHz * 2);

  // Always: a ticking clock, a pulsing bass and the heart.
  for (let s = 0; s < 16; s += 1) w.drum("perc", s, "tick", s % 4 === 0 ? 0.55 : 0.3);
  for (let e = 0; e < 8; e += 1) w.note("bass", e / 2, "cello", e % 4 === 3 ? bass * 2 : bass, 0.4, e % 2 === 0 ? 0.5 : 0.36);
  w.drum("drums", 0, "heartbeat", 0.42);
  if (stage >= 2) w.drum("drums", 8, "heartbeat", 0.32);

  if (stage >= 1) {
    const ost = [tones[0], tones[2], tones[0] * 2, tones[2]];
    for (let e = 0; e < 8; e += 1) w.note("arp", e / 2, "staccato", ost[e % 4], 0.3, e % 2 === 0 ? 0.3 : 0.22);
    w.drum("drums", 12, "tom", 0.32, 1.2);
    w.drum("drums", 14, "tom", 0.36, 0.95);
  }
  if (stage === 1) {
    // Horn calls of the theme's opening, answered two bars later.
    if (at === 4) w.line("lead", "frenchHorn", THEME[0], 0.55);
    if (at === 6) w.line("lead", "frenchHorn", THEME[1], 0.5);
  }
  if (stage >= 2) {
    w.drum("drums", 4, "snare", 0.32);
    w.drum("drums", 12, "snare", 0.36);
    for (const f of w.chordTones(chord, w.d4)) w.note("pad", 0, "strings", f, 4.05, 0.22);
    const harp = [tones[0], tones[1], tones[2], tones[0] * 2];
    for (let s = 0; s < 16; s += 1) w.note("counter", s / 4, "harp", harp[s % 4] * 2, 0.5, 0.15);
  }
  if (stage === 2) w.line("lead", "violin", THEME[8 + (at - 8)], 0.5);
  if (stage === 3) {
    for (let q = 0; q < 4; q += 1) w.drum("drums", q * 4, "kick", 0.6);
    for (let e = 0; e < 8; e += 1) w.drum("perc", e * 2 + 1, "hat", 0.3);
    for (const step of [0, 6, 10]) for (const f of w.chordTones(chord, w.d4)) w.note("orch", step / 4, "stab", f, 0.5, 0.26);
    w.note("orch", 0, "timpani", bass * 2 > 160 ? bass : bass * 2, 1, 0.5);
    if (at === 12) { w.drum("perc", 0, "crash", 0.7); w.drum("orch", 0, "boom", 0.5); }
    // A line that climbs a step a bar, held, into the drop.
    w.note("lead", 0, "brass", w.hz([7, 8, 11, 14][at - 12]), 3.9, 0.48);
    w.note("counter", 0, "violin", w.hz([7, 8, 11, 14][at - 12] + 12), 3.9, 0.28);
    if (at === 15) { for (let s = 0; s < 16; s += 1) w.drum("drums", s, "snare", 0.14 + 0.03 * s); w.timpaniRoll(8, 0.6, bass * 2 > 160 ? bass : bass * 2); }
  }
  return w.events;
}
