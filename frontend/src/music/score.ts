// Deterministic score generation. Given a MusicCue this produces, bar by bar, a list of note and percussion
// events. It never touches Web Audio, so it can be unit tested and rendered offline with exactly the same
// output the live engine plays.
//
// Every state is arranged as a song rather than a loop of one bar: an A section states the theme's tune in two
// four-bar phrases (a question that ends on the fifth, an answer that comes home), a B section answers it on
// another instrument over a second chord progression, and boss fights add a half-time C breakdown and a D
// climax a whole tone higher. Because a bar is a pure function of its place in the form, the tune repeats
// exactly from loop to loop and can be remembered; only the ambience is random (seeded).
import { energyFor, isCapstone, isFight, layersFor } from "./cue.ts";
import { fxSteps } from "./sounds.ts";
import { HEART_BOSS_ID, HEART_TREATMENT, profileFor } from "./profiles.ts";
import { partyBar, titleBar, MENU_FORM_BARS } from "./title.ts";
import { SCALES } from "./types.ts";
import type { Rng } from "./sounds.ts";
import type { ArpStyle, BassStyle, BossTreatment, DrumVoice, Layers, MelodicEvent, MelodicVoice, MusicCue, MusicState, Part, ScaleName, ScoreEvent, Section, SoundEvent, ThemeProfile } from "./types.ts";

export type { Rng };

/** How much faster or slower each state plays relative to the theme's base tempo. */
export const STATE_TEMPO: Record<MusicState, number> = { title: 1, party: 1, exploration: 0.74, event: 0.62, combat: 1, miniboss: 1.05, boss: 1.1, victory: 0.7, defeat: 0.55 };

/** Title and party have their own composed scores (title.ts) in D minor, independent of the dungeon theme. */
const MENU_SCORE = { rootHz: 73.42, title: 72, party: 104 } as const;

export interface Plan {
  cue: MusicCue;
  profile: ThemeProfile;
  boss?: BossTreatment;
  layers: Layers;
  /** Overall intensity (see energyFor): around 0.1 at rest, 0.6 in a fight, above 1 for a capstone boss in its second phase. */
  energy: number;
  capstone: boolean;
  fight: boolean;
  /** Tonic of the current key in Hz. */
  rootHz: number;
  scale: ScaleName;
  bpm: number;
  stepsPerBar: 12 | 16;
  stepSec: number;
  barSec: number;
  swing: number;
  wobble: number;
  voices: { pad: MelodicVoice; bass: MelodicVoice; lead: MelodicVoice; accent: MelodicVoice; counter: MelodicVoice; arp: MelodicVoice; stab: MelodicVoice; choir: MelodicVoice; timpani: MelodicVoice };
  kit: { kick: DrumVoice; back: DrumVoice; tick: DrumVoice; fill: DrumVoice; crash: DrumVoice; openHat: DrumVoice | null };
  patterns: { kick: string; back: string; tick: string; bass: string; lead: string; leadSparse: string };
  motif: readonly number[];
  progA: readonly number[];
  progB: readonly number[];
  bassStyle: BassStyle;
  arpStyle: ArpStyle;
  /** The section of every bar of one pass through the song. */
  form: readonly Section[];
  /** Bar the score starts from: a boss entering its second phase jumps straight to the climax. */
  entryBar: number;
  /** Semitones the D (climax) section is lifted. */
  climaxLift: number;
  room: { size: number; bright: number; wet: number };
  /** Echo feedback and time (a dotted eighth). */
  echo: { feedback: number; time: number };
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

const repeat = (section: Section, n: number): Section[] => Array.from({ length: n }, () => section);

function formFor(state: MusicState): Section[] {
  if (state === "title" || state === "party") return repeat("A", MENU_FORM_BARS[state]);
  if (state === "boss") return [...repeat("A", 8), ...repeat("B", 8), ...repeat("C", 8), ...repeat("D", 8)];
  return [...repeat("A", 8), ...repeat("B", 8)];
}

export function makePlan(cue: MusicCue): Plan {
  const profile = profileFor(cue.theme);
  const ens = profile.ensemble;
  const menu = cue.state === "title" || cue.state === "party";
  const boss = cue.state === "boss" && cue.boss ? (cue.boss === HEART_BOSS_ID ? HEART_TREATMENT : profile.bosses[cue.boss]) : undefined;
  const variant = profile.variants[cue.variant];
  const capstone = isCapstone(cue.theme);
  const fight = isFight(cue.state);
  const phase2 = fight && cue.phase === 2;
  const opts = { capstone, phase: cue.phase };
  const semitones = profile.depthDrift[cue.depth - 1] + (variant?.transpose ?? 0) + (boss?.transpose ?? 0) + (phase2 ? 1 : 0);
  const steps = menu ? 16 : profile.steps;
  const stepsPerBeat = steps / 4;
  const bpm = menu
    ? MENU_SCORE[cue.state as "title" | "party"]
    : profile.bpm * STATE_TEMPO[cue.state] * (1 + 0.04 * (cue.depth - 1)) * (boss?.tempoMul ?? 1) * (variant?.tempoMul ?? 1) * (phase2 ? 1.05 : 1);
  const stepSec = 60 / (bpm * stepsPerBeat);
  const calm = cue.state === "exploration" || cue.state === "event" || cue.state === "victory" || cue.state === "defeat";
  const bossLead = boss?.lead ?? profile.voices.lead;
  const lead: MelodicVoice = calm ? ens.calm : cue.state === "boss" ? bossLead : profile.voices.lead;
  const fightKit = fight ? ens.fight.voices : {};
  const form = formFor(cue.state);
  return {
    cue,
    profile,
    boss,
    layers: layersFor(cue.state, cue.depth, opts),
    energy: menu ? 0.5 : energyFor(cue.state, cue.depth, opts),
    capstone,
    fight,
    rootHz: menu ? MENU_SCORE.rootHz : profile.rootHz * 2 ** (semitones / 12),
    scale: menu ? "minor" : boss?.scale ?? profile.scale,
    bpm,
    stepsPerBar: steps,
    stepSec,
    barSec: stepSec * steps,
    swing: menu ? 0 : profile.swing,
    wobble: menu ? 0 : profile.wobble,
    voices: {
      pad: profile.voices.pad,
      bass: cue.state === "boss" ? ens.bossBass ?? profile.voices.bass : profile.voices.bass,
      lead,
      accent: profile.voices.accent,
      counter: ens.counter,
      arp: cue.state === "boss" && !["arcade", "scifi"].includes(cue.theme) ? "staccato" : ens.arp,
      stab: ens.stab,
      choir: ens.choir,
      timpani: ens.timpani,
    },
    kit: {
      kick: fightKit.kick ?? profile.voices.kick,
      back: fightKit.back ?? profile.voices.back,
      tick: fightKit.tick ?? profile.voices.tick,
      fill: boss?.fill ?? profile.voices.fill,
      crash: ens.crash,
      openHat: ens.openHat,
    },
    patterns: fight
      ? { kick: ens.fight.kick, back: ens.fight.back, tick: ens.fight.tick, bass: ens.fight.bass, lead: profile.patterns.lead, leadSparse: profile.patterns.leadSparse }
      : profile.patterns,
    motif: boss?.motif ?? profile.motif,
    progA: profile.chordRoots,
    progB: ens.progB,
    bassStyle: ens.bassStyle,
    arpStyle: ens.arpStyle,
    form,
    entryBar: phase2 && cue.state === "boss" ? 24 : 0,
    climaxLift: cue.state === "boss" ? 2 : 0,
    room: menu ? { size: 3.8, bright: 0.5, wet: 0.4 } : ens.room,
    echo: { feedback: ens.echo, time: stepSec * stepsPerBeat * 0.75 },
  };
}

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** The scale in force during a bar. Themes with a scale cycle rotate modes every four bars. */
export function scaleForBar(plan: Plan, bar: number): readonly number[] {
  const cycle = plan.profile.scaleCycle;
  if (cycle && cycle.length > 0 && !plan.boss?.scale && plan.cue.state !== "title" && plan.cue.state !== "party") return SCALES[cycle[Math.floor(bar / 4) % cycle.length]];
  return SCALES[plan.scale];
}

/** Frequency of a scale degree above `root`. Degrees outside 0..len-1 wrap into other octaves; `octave` shifts whole octaves. */
export function freqOf(root: number, scale: readonly number[], degree: number, octave = 0): number {
  const len = scale.length;
  const semitones = scale[mod(degree, len)] + 12 * Math.floor(degree / len);
  return root * 2 ** ((semitones + 12 * octave) / 12);
}

/** Frequency of a scale degree in the plan's key. */
export function degreeFreq(plan: Plan, scale: readonly number[], degree: number, octave = 0): number {
  return freqOf(plan.rootHz, scale, degree, octave);
}

/** Seconds from the start of a bar to a step, including swing on the off-beat steps. */
export function stepTime(plan: Plan, step: number): number {
  return step * plan.stepSec + (step % 2 === 1 && step < plan.stepsPerBar - 1 ? plan.swing * plan.stepSec : 0);
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

/** Where a bar sits in the song. */
export interface BarPlace {
  section: Section;
  /** Bar within its eight-bar section. */
  inSection: number;
  /** Bar within its four-bar phrase. */
  inPhrase: number;
  /** 0 for the first phrase of a section (the question), 1 for the second (the answer). */
  phrase: number;
}

export function placeOf(plan: Plan, bar: number): BarPlace {
  const at = mod(bar, plan.form.length);
  const section = plan.form[at];
  let start = at;
  while (start > 0 && plan.form[start - 1] === section) start -= 1;
  const inSection = (at - start) % 8;
  return { section, inSection, inPhrase: inSection % 4, phrase: Math.floor(inSection / 4) };
}

/** Scale degree of the chord root in force during a bar (chords change every two bars). */
export function chordAt(plan: Plan, place: BarPlace): number {
  const slot = Math.floor(place.inSection / 2);
  switch (place.section) {
    case "B": return plan.progB[slot % plan.progB.length];
    // The breakdown sits on the tonic and the first chord of B, a held breath before the climax.
    case "C": return [plan.progA[0], plan.progA[0], plan.progB[0], plan.progA[plan.progA.length - 1]][slot % 4];
    default: return plan.progA[slot % plan.progA.length];
  }
}

/** Moves a frequency by octaves into the octave centred on `centre`, so chord changes move by small steps. */
/**
 * The octave (counted from the key's tonic) that keeps a part's tonic at or above `floor` Hz. Low keys sink
 * further with depth and boss transposition; without this the bass and melody fall below what speakers and ears
 * can carry (an Infernal boss would put its bass near 27 Hz and its melody under its own filter).
 */
export function octaveAtLeast(root: number, octave: number, floor: number): number {
  let oct = octave;
  while (root * 2 ** oct < floor) oct += 1;
  return oct;
}

/** Register floors for the tonic of each part, in Hz. */
export const REGISTER = { bass: 52, lead: 230, counter: 175, arp: 175 } as const;

function nearOctave(freq: number, centre: number): number {
  let f = freq;
  while (f > centre * Math.SQRT2) f /= 2;
  while (f < centre / Math.SQRT2) f *= 2;
  return f;
}

/** The chord tone of `chord` (root, third or fifth, in any octave) nearest to `degree`. */
function snapToChord(degree: number, chord: number, len: number): number {
  let best = degree;
  let bestDist = Infinity;
  for (let oct = -2; oct <= 2; oct += 1) for (const tone of [0, 2, 4]) {
    const candidate = chord + tone + oct * len;
    const dist = Math.abs(candidate - degree);
    if (dist < bestDist) { best = candidate; bestDist = dist; }
  }
  return best;
}

const ARP_ORDER: Record<ArpStyle, readonly number[]> = { up: [0, 1, 2, 3], updown: [0, 1, 2, 3, 2, 1], broken: [0, 2, 1, 3, 2, 1, 0, 2], pedal: [0, 3, 0, 2, 0, 3, 0, 1] };

/** Every bar of a given cue is a pure function of (cue, bar index): replaying a bar reproduces it exactly. */
export function generateBar(plan: Plan, bar: number): ScoreEvent[] {
  if (plan.cue.state === "title") return titleBar(plan, bar);
  if (plan.cue.state === "party") return partyBar(plan, bar);
  const { profile, layers, cue } = plan;
  const rng = mulberry32(hashString([cue.theme, cue.state, cue.boss ?? "", cue.depth, cue.variant, cue.phase ?? 1].join("|")) ^ Math.imul(bar + 1, 2654435761));
  const scale = scaleForBar(plan, bar);
  const len = scale.length;
  const place = placeOf(plan, bar);
  const { section, inSection, inPhrase, phrase } = place;
  const root = plan.rootHz * 2 ** ((section === "D" ? plan.climaxLift : 0) / 12);
  const chord = chordAt(plan, place);
  const nextChord = chordAt(plan, placeOf(plan, bar + (inSection % 2 === 0 ? 2 : 1)));
  const chordBar = inSection % 2; // 0 on the bar a chord arrives, 1 on its second bar
  const steps = plan.stepsPerBar;
  const beat = steps / 4;
  const events: ScoreEvent[] = [];
  const e = plan.energy;
  const cents = () => (plan.wobble ? (rng() - 0.5) * 2 * plan.wobble : 0);
  const note = (part: Part, step: number, voice: MelodicVoice, freq: number, dur: number, vel: number): void => {
    events.push({ kind: "melodic", t: stepTime(plan, step), voice, freq, dur, vel, cents: cents(), part } satisfies MelodicEvent);
  };
  const drum = (part: Part, step: number, voice: DrumVoice, vel: number, pitch?: number): void => {
    events.push({ kind: "drum", t: stepTime(plan, step), voice, vel, part, ...(pitch ? { pitch } : {}) } satisfies SoundEvent);
  };
  /** Accent by position in the bar: the downbeat leads, beats follow, off-beats lie back. */
  const accent = (step: number) => (step === 0 ? 1 : step % beat === 0 ? 0.88 : step % (beat / 2 || 1) === 0 ? 0.76 : 0.66);
  const breakdown = section === "C";
  const climax = section === "D";

  // ---- Pads: the chord, voice-led around a fixed register, re-struck when it changes. Fights put them behind the band.
  if (layers.pad > 0 && chordBar === 0) {
    const centre = plan.rootHz * 4;
    const vel = (plan.fight ? 0.38 : 0.42) * layers.pad * (breakdown ? 1.25 : 1);
    for (const tone of [0, 2, 4]) note("pad", 0, plan.voices.pad, nearOctave(freqOf(root, scale, chord + tone), centre), plan.barSec * 2.05, vel);
    if (!plan.fight) note("pad", 0, plan.voices.pad, nearOctave(freqOf(root, scale, chord + 4), centre * 2), plan.barSec * 2.05, vel * 0.35);
  }

  // ---- Bass: the fight or calm rhythm, following the harmony in the theme's style.
  if (layers.bass > 0) {
    const pattern = breakdown ? "X" + ".".repeat(beat * 2 - 1) + "x" + ".".repeat(beat * 2 - 1) : plan.patterns.bass;
    const hits = onsets(pattern.slice(0, steps), layers.bass);
    hits.forEach((hit, k) => {
      const next = hits[k + 1]?.step ?? steps;
      const last = k === hits.length - 1;
      let degree = chord;
      let octave = 0;
      switch (plan.bassStyle) {
        case "octave": if (k % 2 === 1) octave = 1; break;
        case "fifth": if (k % 2 === 1) degree = chord + 4; break;
        case "walk": degree = last && chordBar === 1 ? nextChord + (nextChord > chord ? -1 : 1) : chord + [0, 2, 4, 5][k % 4]; break;
        case "pulse": if (last && chordBar === 1) degree = chord + 4; break;
        case "drive": if (hit.vel < 1 && k % 2 === 1) octave = 1; break;
        default: break;
      }
      const dur = Math.max(0.12, (next - hit.step) * plan.stepSec * (plan.bassStyle === "walk" ? 0.8 : 0.92));
      note("bass", hit.step, plan.voices.bass, freqOf(root, scale, degree, octave + octaveAtLeast(root, 0, REGISTER.bass)), dur, 0.7 * hit.vel * layers.bass * accent(hit.step));
    });
  }

  // ---- Melody: the theme's tune in four-bar phrases. A carries it on the lead, B answers on the counter
  // instrument, the breakdown leaves it out and the climax doubles it in octaves.
  const melodyVoice = section === "B" ? plan.voices.counter : plan.voices.lead;
  const melodyLevel = section === "B" ? Math.max(layers.lead * 0.9, layers.counter) : layers.lead;
  const calmBar = !plan.fight && (inPhrase === 1 || inPhrase === 3);
  const playMelody = layers.lead > 0 && !breakdown && !(e < 0.2 && inPhrase % 2 === 1);
  if (playMelody) {
    const sparse = inPhrase === 3 || calmBar;
    const pattern = sparse ? plan.patterns.leadSparse : plan.patterns.lead;
    // Earlier bars of the phrase consume motif notes, so each bar continues the line instead of restarting it.
    let idx = 0;
    for (let p = 0; p < inPhrase; p += 1) idx += onsets((p === 3 || (!plan.fight && p % 2 === 1) ? plan.patterns.leadSparse : plan.patterns.lead).slice(0, steps), melodyLevel).length;
    const hits = onsets(pattern.slice(0, steps), melodyLevel);
    const shift = section === "B" ? 2 : 0;
    const octave = octaveAtLeast(root, profile.leadOct, REGISTER.lead) + (section === "B" ? -1 : 0);
    hits.forEach((hit, k) => {
      let degree = plan.motif[mod(idx + k + shift, plan.motif.length)] + chord + (section === "B" ? 2 : 0);
      if (hit.step % beat === 0) degree = snapToChord(degree, chord, len);
      // The phrase's last note: the first phrase ends open on the fifth, the second comes home to the root.
      if (inPhrase === 3 && k === hits.length - 1) degree = phrase === 0 ? snapToChord(chord + 4, chord, len) : snapToChord(chord + len, chord, len) - len;
      const next = hits[k + 1]?.step ?? steps;
      const span = (next - hit.step) * plan.stepSec;
      const dur = Math.min(plan.barSec, Math.max(plan.stepSec * 1.5, span * (inPhrase === 3 && k === hits.length - 1 ? 1.8 : 0.92)));
      const vel = 0.62 * hit.vel * melodyLevel * accent(hit.step) * (0.95 + rng() * 0.1);
      const freq = freqOf(root, scale, degree, octave);
      note("lead", hit.step, melodyVoice, freq, dur, vel);
      // The climax doubles the tune an octave below on the counter instrument, and the arrival of D on the stab.
      if (climax && layers.counter > 0) note("counter", hit.step, plan.voices.counter, freq / 2, dur, vel * 0.6);
    });
  }
  // A long accent note on the tonic at the start of each phrase, in calm music only: a bell in the distance.
  if (!plan.fight && layers.lead >= 0.5 && inPhrase === 0 && phrase === 0) note("counter", 0, plan.voices.accent, freqOf(root, scale, chord, 2), plan.stepSec * 10, 0.3 * layers.lead);

  // ---- Counter-line: in fights, a sustained harmony line (the chord's third) above the band in A and D,
  // and a slow, long-note theme in the breakdown.
  if (layers.counter >= 0.5 && plan.fight && section !== "B") {
    if (breakdown && chordBar === 0) note("counter", 0, plan.voices.counter, freqOf(root, scale, plan.motif[mod(inSection, plan.motif.length)] + chord, octaveAtLeast(root, profile.leadOct, REGISTER.lead)), plan.barSec * 1.9, 0.5 * layers.counter);
    else if (!breakdown && chordBar === 0) note("counter", 0, plan.voices.counter, freqOf(root, scale, chord + 2, octaveAtLeast(root, profile.leadOct - 1, REGISTER.counter)), plan.barSec * 1.95, 0.32 * layers.counter);
  }

  // ---- Ostinato: the chord broken into a running figure. Quarter notes at rest, eighths in fights,
  // sixteenths when it is a boss.
  if (layers.arp > 0) {
    const every = e >= 0.8 ? 1 : e >= 0.45 ? 2 : steps === 12 ? 3 : 4;
    const order = ARP_ORDER[plan.arpStyle];
    const tones = [0, 2, 4, len];
    const octave = octaveAtLeast(root, Math.max(1, profile.leadOct - 1), REGISTER.arp);
    for (let step = 0, k = 0; step < steps; step += every, k += 1) {
      const degree = chord + tones[order[k % order.length]];
      const vel = 0.42 * layers.arp * accent(step) * (breakdown ? 0.8 : 1);
      note("arp", step, plan.voices.arp, freqOf(root, scale, degree, octave), every * plan.stepSec * 0.9, vel);
    }
  }

  // ---- Orchestra: brass stabs, choir, tuned timpani and the taiko that make a boss fight feel enormous.
  if (layers.orch > 0) {
    const centre = plan.rootHz * 4;
    const stabPattern = cue.state === "boss" ? (steps === 12 ? "X.....x..x.." : "X.....x...x.....") : steps === 12 ? "X..........." : "X...............";
    if (layers.orch >= 0.3 && !breakdown && (chordBar === 0 || layers.orch >= 0.75)) {
      for (const hit of onsets(stabPattern, layers.orch)) for (const tone of [0, 2, 4]) note("orch", hit.step, plan.voices.stab, nearOctave(freqOf(root, scale, chord + tone), centre), plan.stepSec * 2.5, 0.34 * hit.vel * layers.orch);
    }
    if ((layers.orch >= 0.55 || breakdown) && chordBar === 0) {
      for (const tone of [0, 2, 4]) note("orch", 0, plan.voices.choir, nearOctave(freqOf(root, scale, chord + tone), centre * 2), plan.barSec * 2.05, 0.22 * layers.orch * (breakdown || climax ? 1.3 : 1));
    }
    if (layers.orch >= 0.45) {
      const timp = nearOctave(freqOf(root, scale, chord), 110);
      if (chordBar === 0) note("orch", 0, plan.voices.timpani, timp, plan.barSec * 0.5, 0.6 * layers.orch);
      // A timpani roll into the next section.
      if (inSection === 7) for (let step = steps - beat; step < steps; step += 1) note("orch", step, plan.voices.timpani, timp, plan.stepSec * 2, (0.25 + 0.1 * (step - (steps - beat))) * layers.orch);
    }
    if (layers.orch >= 0.5) {
      const taiko = breakdown ? "X...X...X...X..." : "X.......X.....x.";
      for (const hit of onsets(taiko.slice(0, steps), layers.orch)) drum("orch", hit.step, "taiko", 0.55 * hit.vel * layers.orch);
    }
    if ((climax || (cue.state === "boss" && section === "A")) && inSection === 0) drum("orch", 0, "boom", 0.8 * layers.orch);
  }

  // ---- Drums: kick, backbeat and ticks gated by the percussion level; a crash marks each fight section, fills
  // close every phrase and a tom run closes every section. The breakdown drops to half time.
  if (layers.perc > 0) {
    const half = "X" + ".".repeat(steps - 1);
    const backHalf = ".".repeat(steps / 2) + "X" + ".".repeat(steps / 2 - 1);
    const kit: [string, DrumVoice, number, Part][] = [
      [breakdown ? half : plan.patterns.kick, plan.kit.kick, layers.perc, "drums"],
      [breakdown ? backHalf : plan.patterns.back, plan.kit.back, layers.perc, "drums"],
      [plan.patterns.tick, plan.kit.tick, Math.min(1, layers.perc * 1.4) * (breakdown ? 0.6 : 1), "perc"],
    ];
    const fillBar = inPhrase === 3 && layers.perc >= 0.9;
    const tomRun = inSection === 7 && layers.perc >= 0.6 && plan.fight;
    const fillFrom = steps - (tomRun ? beat + beat / 2 : beat);
    for (const [pattern, voice, level, part] of kit) for (const hit of onsets(pattern.slice(0, steps), level)) {
      if ((fillBar || tomRun) && hit.step >= fillFrom && part === "drums" && voice !== plan.kit.kick) continue;
      drum(part, hit.step, voice, hit.vel * accent(hit.step) * (plan.fight ? 1 : 0.8));
    }
    if (plan.kit.openHat && plan.fight && layers.perc >= 0.75 && !breakdown) for (let step = beat / 2; step < steps; step += beat) if (Number.isInteger(step)) drum("perc", step, plan.kit.openHat, 0.5 * layers.perc);
    if (plan.fight && inSection === 0 && layers.perc >= 0.55) drum("perc", 0, plan.kit.crash, 0.75 * layers.perc);
    if (tomRun) {
      for (let step = fillFrom, k = 0; step < steps; step += 1, k += 1) drum("drums", step, "tom", 0.5 + 0.06 * k, 1.6 - k * 0.12);
    } else if (fillBar) {
      for (let step = fillFrom; step < steps; step += 1) drum("drums", step, plan.kit.fill, 0.45 + 0.1 * (step - fillFrom));
    }
  }

  // ---- Ambience events: random but seeded, so a replayed bar is identical. Pitched ones draw from the key's high register.
  if (layers.fx > 0) {
    const pool = scale.map((_, degree) => freqOf(root, scale, degree, 3));
    const entries = plan.boss?.extraFx ? [...profile.fx, { fx: plan.boss.extraFx, p: 0.5 }] : profile.fx;
    for (const entry of entries) {
      if ((entry.minDepth ?? 1) > cue.depth) continue;
      if (rng() < entry.p * layers.fx) events.push({ kind: "fx", t: rng() * plan.barSec * 0.8, voice: entry.fx, vel: 0.8 + rng() * 0.4, steps: fxSteps(entry.fx, rng, pool), part: "fx" });
    }
  }

  return events;
}

/** A short phrase marking the end of the run: a fanfare for victory, a fall for defeat. Times are seconds from the stinger's start. */
export function generateStinger(plan: Plan, kind: "victory" | "defeat"): ScoreEvent[] {
  const scale = scaleForBar(plan, 0);
  const len = scale.length;
  const lead = plan.voices.lead;
  const oct = octaveAtLeast(plan.rootHz, plan.profile.leadOct, REGISTER.lead);
  const melodic = (t: number, voice: MelodicVoice, freq: number, dur: number, vel: number, part: Part): MelodicEvent => ({ kind: "melodic", t, voice, freq, dur, vel, cents: 0, part });
  const events: ScoreEvent[] = [];
  if (kind === "victory") {
    const degrees = [0, 2, 4, len];
    const times = [0, 0.18, 0.36, 0.62];
    degrees.forEach((degree, i) => events.push(melodic(times[i], lead, freqOf(plan.rootHz, scale, degree, oct), i === 3 ? 1.6 : 0.3, 0.75, "lead")));
    for (const degree of [0, 2, 4]) {
      events.push(melodic(0.62, plan.voices.stab, nearOctave(freqOf(plan.rootHz, scale, degree), plan.rootHz * 4), 0.5, 0.45, "orch"));
      events.push(melodic(0.62, plan.voices.choir, nearOctave(freqOf(plan.rootHz, scale, degree), plan.rootHz * 8), 3, 0.3, "orch"));
      events.push(melodic(0, plan.voices.pad, freqOf(plan.rootHz, scale, degree, 1), 3.5, 0.5, "pad"));
    }
    for (let i = 0; i < 6; i += 1) events.push(melodic(0.62 - 0.36 + i * 0.06, plan.voices.timpani, nearOctave(plan.rootHz, 110), 0.4, 0.25 + i * 0.07, "orch"));
    events.push({ kind: "drum", t: 0.62, voice: plan.kit.crash, vel: 0.8, part: "perc" });
    events.push(melodic(0.62, plan.voices.bass, plan.rootHz, 2.4, 0.7, "bass"));
    events.push(melodic(0.8, plan.voices.accent, freqOf(plan.rootHz, scale, 0, 2), 2.4, 0.5, "counter"));
  } else {
    const degrees = [4, 2, 1, 0];
    const times = [0, 0.45, 0.9, 1.5];
    degrees.forEach((degree, i) => events.push(melodic(times[i], lead, freqOf(plan.rootHz, scale, degree, oct), i === 3 ? 2.4 : 1.2, 0.65, "lead")));
    for (const degree of [0, 2, 4]) events.push(melodic(0, "strings", freqOf(plan.rootHz, scale, degree, 1), 3.6, 0.45, "pad"));
    events.push(melodic(1.5, plan.voices.bass, freqOf(plan.rootHz, scale, 0, -1) < 25 ? plan.rootHz : freqOf(plan.rootHz, scale, 0, -1), 3, 0.7, "bass"));
    events.push({ kind: "drum", t: 1.5, voice: "gong", vel: 0.6, part: "perc" });
    events.push(melodic(1.5, plan.voices.accent, freqOf(plan.rootHz, scale, 0, 1), 2.4, 0.5, "counter"));
  }
  return events;
}
