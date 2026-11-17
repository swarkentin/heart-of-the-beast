// Shared vocabulary for the theme-aware score. Everything in src/music except synth.ts and engine.ts is pure
// (no DOM, no Web Audio), so it can be unit tested under plain Node. Keep this file to erasable TypeScript
// (no enums or namespaces) so Node's type stripping can run it directly.

/** Dungeon themes, in the order of the backend DungeonThemeCatalog. Ids match the art theme folder names. */
export const THEME_IDS = ["catacombs", "scifi", "mobster", "sunken", "clockwork", "carnival", "jungle", "dreamscape", "arctic", "ghosttown", "wasteland"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

/** What the party is doing. Each state gets its own layer mix, tempo and (for victory and defeat) a stinger. */
export const MUSIC_STATES = ["exploration", "event", "combat", "miniboss", "boss", "victory", "defeat"] as const;
export type MusicState = (typeof MUSIC_STATES)[number];

export type Depth = 1 | 2 | 3;

/** The complete description of what the score should be doing right now. Derived from a run snapshot. */
export interface MusicCue {
  theme: ThemeId;
  state: MusicState;
  depth: Depth;
  /** Art creature id of the boss being fought (for example "crypt_warden"), when the profile has a treatment for it. */
  boss?: string;
  /** Room flavour inside a theme, such as the flooded crossing in the catacombs. "default" when none applies. */
  variant: string;
  /** Used only for room-change effects. It is deliberately not part of the music identity (see cueKey). */
  roomId: string;
}

export type Wave = "sine" | "triangle" | "square" | "sawtooth";
export type FilterKind = "lowpass" | "highpass" | "bandpass";

export const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  phrygianDominant: [0, 1, 4, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  wholeTone: [0, 2, 4, 6, 8, 10],
  diminished: [0, 2, 3, 5, 6, 8, 9, 11],
  pentMinor: [0, 3, 5, 7, 10],
  pentMajor: [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10],
} as const satisfies Record<string, readonly number[]>;
export type ScaleName = keyof typeof SCALES;

// ---------------------------------------------------------------------------------------------------------
// Sounds as data. A sound is either a Recipe (pitched, played at a frequency) or a list of Steps (unpitched or
// fixed-pitch: drums, ambience events and UI effects). synth.ts is the only place that turns these into audio.
// ---------------------------------------------------------------------------------------------------------

export interface ToneStep {
  k: "tone";
  f: number;
  d: number;
  w: Wave;
  v: number;
  /** Start offset in seconds from the sound's start. */
  at?: number;
  cents?: number;
  /** Exponential sweep target frequency. */
  to?: number;
  /** Attack in seconds. */
  a?: number;
}

export interface NoiseStep {
  k: "noise";
  d: number;
  f: number;
  v: number;
  ft: FilterKind;
  at?: number;
  q?: number;
  to?: number;
  a?: number;
}

/** The gritty scrape layer of a weapon hit: shaped, band-passed noise. */
export interface CrunchStep {
  k: "crunch";
  d: number;
  v: number;
  at?: number;
}

export type Step = ToneStep | NoiseStep | CrunchStep;

export interface PartialLayer {
  w: Wave;
  /** Frequency ratio to the note. */
  r: number;
  v: number;
  cents?: number;
  /** Fraction of the note's duration this partial rings for (bells ring their upper partials shorter). */
  decay?: number;
}

export interface Recipe {
  layers: readonly PartialLayer[];
  /** Attack seconds. */
  a: number;
  /** Release seconds (sustained voices) after the note's duration. */
  r?: number;
  /** Sustained voices hold at full level for the duration; percussive voices decay across it. */
  sustain?: boolean;
  gain: number;
  /** Low-pass or band-pass filter; frequencies are multiples of the note frequency so it tracks pitch. */
  filter?: { type: FilterKind; fmul: number; to?: number; q?: number };
  vib?: { rate: number; cents: number };
  trem?: { rate: number; depth: number };
  /** Starts this many times the pitch and falls to the note (a plucked twang or a thump). */
  bend?: number;
  echo?: { delay: number; gain: number };
}

export const PAD_VOICES = ["dronePad", "choirPad", "glassPad", "muffledPad", "synthPad", "smokePad", "boilerPad", "ironPad", "breathPad", "reedPad", "organPad"] as const;
export const LEAD_VOICES = ["bell", "pluck", "arp", "musicBox", "calliope", "marimba", "glass", "twang", "vibes", "warble", "horn", "sub", "sonarBell"] as const;
export const BASS_VOICES = ["subBass", "walkBass", "pulseBass", "tubaBass", "ironBass", "thumpBass"] as const;
export const DRUM_VOICES = ["kick", "tom", "snare", "rim", "tick", "hat", "shaker", "wood", "clank", "gear", "bongo", "heartbeat", "brush", "bellTick", "anvil", "crack"] as const;
export const FX_VOICES = ["drip", "creak", "toll", "beep", "steam", "sonar", "bubble", "pop", "honk", "insect", "bird", "swell", "whisper", "wind", "icecreak", "glassPing", "tumble", "metalClank", "static", "geiger", "siren", "carHorn"] as const;

export type PadVoice = (typeof PAD_VOICES)[number];
export type LeadVoice = (typeof LEAD_VOICES)[number];
export type BassVoice = (typeof BASS_VOICES)[number];
export type DrumVoice = (typeof DRUM_VOICES)[number];
export type FxVoice = (typeof FX_VOICES)[number];
export type MelodicVoice = PadVoice | LeadVoice | BassVoice;

// ---------------------------------------------------------------------------------------------------------
// Theme profiles
// ---------------------------------------------------------------------------------------------------------

/** Rhythm strings, one character per step: X strong hit, x normal, o ghost note, . rest. Length must equal steps. */
export interface Patterns {
  kick: string;
  back: string;
  tick: string;
  bass: string;
  lead: string;
  leadSparse: string;
}

export interface BedSpec {
  noise: "white" | "pink" | "brown";
  filter: FilterKind;
  f: number;
  q: number;
  gain: number;
  /** Slow modulation of the filter cutoff (wind, breathing, water). */
  lfo?: { rate: number; depth: number };
  /** Continuous drones, as ratios of the tonic. They keep the room sounding alive across crossfades. */
  drones: readonly { ratio: number; w: Wave; gain: number; cents: number }[];
}

export interface AmbientEvent {
  fx: FxVoice;
  /** Chance per bar, before the state's fx level is applied. */
  p: number;
  minDepth?: Depth;
}

export interface BossTreatment {
  tempoMul: number;
  /** Semitones relative to the theme tonic. */
  transpose: number;
  scale?: ScaleName;
  motif?: readonly number[];
  lead?: LeadVoice;
  fill?: DrumVoice;
  extraFx?: FxVoice;
  /** One line describing the intent, for the audition page and the ADR. */
  note: string;
}

export interface VariantTweak {
  transpose?: number;
  bedFilterMul?: number;
  bedGainMul?: number;
  tempoMul?: number;
}

export interface ThemeProfile {
  id: ThemeId;
  name: string;
  /** One line describing the sound, for the audition page. */
  character: string;
  /** Tonic in Hz at depth 1, in the bass register. */
  rootHz: number;
  /** Semitone offset of the tonic at depths 1, 2 and 3: the score sinks or climbs as the party descends. */
  depthDrift: readonly [number, number, number];
  scale: ScaleName;
  /** If set, the mode rotates every four bars (the dreamscape never sits still). */
  scaleCycle?: readonly ScaleName[];
  bpm: number;
  /** 16 (straight sixteenths) or 12 (a 12/8 waltz or shuffle). */
  steps: 12 | 16;
  /** Fraction of a step by which off-beat steps are delayed (swing). */
  swing: number;
  /** Random pitch instability per note in cents. */
  wobble: number;
  /** Octave (in scale lengths) above the tonic that the lead plays in. */
  leadOct: number;
  voices: { pad: PadVoice; bass: BassVoice; lead: LeadVoice; accent: LeadVoice; kick: DrumVoice; back: DrumVoice; tick: DrumVoice; fill: DrumVoice };
  patterns: Patterns;
  /** Scale degrees of the theme's tune. */
  motif: readonly number[];
  /** Scale degrees on which the two-bar chords are built (a triad is stacked on each). */
  chordRoots: readonly number[];
  /** Bass note degrees, cycled across the onsets in patterns.bass. */
  bassLines: readonly (readonly number[])[];
  bed: BedSpec;
  fx: readonly AmbientEvent[];
  variants: Readonly<Record<string, VariantTweak>>;
  /** Keyed by the boss's art creature id. */
  bosses: Readonly<Record<string, BossTreatment>>;
}

// ---------------------------------------------------------------------------------------------------------
// Score events
// ---------------------------------------------------------------------------------------------------------

export interface MelodicEvent {
  kind: "melodic";
  /** Seconds from the start of the bar (or stinger). */
  t: number;
  voice: MelodicVoice;
  freq: number;
  dur: number;
  vel: number;
  cents: number;
}

export interface SoundEvent {
  kind: "drum" | "fx";
  t: number;
  voice: DrumVoice | FxVoice;
  vel: number;
  /** Concrete steps for fx (they are randomised per occurrence); drums look their steps up by voice. */
  steps?: readonly Step[];
}

export type ScoreEvent = MelodicEvent | SoundEvent;

export interface Layers {
  pad: number;
  bass: number;
  lead: number;
  perc: number;
  fx: number;
}

export type EffectKind = "impact" | "block" | "magic" | "heal" | "defeat" | "door" | "encounter" | "victory" | "failure" | "rankUp" | "masteryUp";
export const EFFECT_KINDS: readonly EffectKind[] = ["impact", "block", "magic", "heal", "defeat", "door", "encounter", "victory", "failure", "rankUp", "masteryUp"];
