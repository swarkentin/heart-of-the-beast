// Shared vocabulary for the theme-aware score. Everything in src/music except synth.ts and engine.ts is pure
// (no DOM, no Web Audio), so it can be unit tested under plain Node. Keep this file to erasable TypeScript
// (no enums or namespaces) so Node's type stripping can run it directly.

/** Dungeon themes, in the order of the backend DungeonThemeCatalog. Ids match the art theme folder names. */
export const THEME_IDS = ["catacombs", "scifi", "mobster", "sunken", "clockwork", "carnival", "jungle", "dreamscape", "arctic", "ghosttown", "wasteland", "noir", "arcade", "eldritch", "infernal"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

/** The two capstone castles (backend capstone.go). Their whole score sits a step higher than an ordinary dungeon. */
export const CAPSTONE_THEMES: readonly ThemeId[] = ["eldritch", "infernal"];

/** What the party is doing. Each state gets its own arrangement, tempo and (for victory and defeat) a stinger. */
export const MUSIC_STATES = ["title", "party", "exploration", "event", "combat", "miniboss", "boss", "victory", "defeat"] as const;
export type MusicState = (typeof MUSIC_STATES)[number];

export type Depth = 1 | 2 | 3;

/** The complete description of what the score should be doing right now. Derived from a run snapshot. */
export interface MusicCue {
  theme: ThemeId;
  state: MusicState;
  depth: Depth;
  /** Art creature id of the boss being fought (for example "crypt_warden"), when the profile has a treatment for it. */
  boss?: string;
  /** 2 once a boss is below half health or has risen again: the score jumps to its climax and lifts a semitone. */
  phase?: 1 | 2;
  /** Room flavour inside a theme, such as the flooded crossing in the catacombs. "default" when none applies. */
  variant: string;
  /** Used only for room-change effects. It is deliberately not part of the music identity (see cueKey). */
  roomId: string;
}

export type Wave = "sine" | "triangle" | "square" | "sawtooth";
export type FilterKind = "lowpass" | "highpass" | "bandpass";

export const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
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
// Mixer parts. Every score event is routed to one part; each part has its own level, stereo position, reverb
// and echo send (synth.ts MIX), and the sound test can mute any of them.
// ---------------------------------------------------------------------------------------------------------

export const PARTS = ["pad", "bass", "lead", "counter", "arp", "orch", "drums", "perc", "fx"] as const;
export type Part = (typeof PARTS)[number];

export const PART_LABELS: Record<Part, string> = { pad: "PADS", bass: "BASS", lead: "MELODY", counter: "HARMONY", arp: "OSTINATO", orch: "ORCHESTRA", drums: "DRUMS", perc: "PERCUSSION", fx: "AMBIENCE" };

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

/** A metallic cluster (six detuned square waves, as in classic drum machines) through a high-pass: hats, cymbals, gongs. */
export interface MetalStep {
  k: "metal";
  d: number;
  v: number;
  /** High-pass cutoff. */
  f: number;
  /** Base frequency of the cluster; the classic drum-machine value is about 40 Hz. */
  base?: number;
  at?: number;
  a?: number;
}

export type Step = ToneStep | NoiseStep | CrunchStep | MetalStep;

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
  /** Percussive voices ring for at least this many seconds, however short the written note. */
  ring?: number;
  gain: number;
  /** Low-pass or band-pass filter; frequencies are multiples of the note frequency so it tracks pitch. */
  filter?: { type: FilterKind; fmul: number; to?: number; q?: number; /** Seconds the sweep to `to` takes (default min(dur, 1.5)). */ t?: number };
  vib?: { rate: number; cents: number; /** Seconds before the vibrato reaches full depth (string and wind players). */ delay?: number };
  trem?: { rate: number; depth: number };
  /** Starts this many times the pitch and falls to the note (a plucked twang or a thump). */
  bend?: number;
  /** Seconds the bend takes (default 0.06). */
  bendT?: number;
  echo?: { delay: number; gain: number };
  /** Each layer is doubled into this many detuned copies spread across ±cents: ensemble strings, supersaws, choirs. */
  unison?: { n: number; cents: number };
  /** Frequency modulation of every layer by a sine at r x the note: electric piano, brass bite, bell clang, FM bass. */
  fm?: { r: number; index: number; /** Index the modulator decays to by the end of the note (brightness envelope). */ end?: number };
  /** A short filtered noise burst at the start: hammer, pick, breath or bow. */
  hammer?: { v: number; f: number; d: number; ft?: FilterKind; q?: number };
  /** Soft saturation amount (1 = gentle warmth, 4 = growl). */
  drive?: number;
}

export const PAD_VOICES = ["dronePad", "choirPad", "glassPad", "muffledPad", "synthPad", "smokePad", "boilerPad", "ironPad", "breathPad", "reedPad", "organPad", "strings", "warmPad", "choirAah", "brassPad", "junoPad"] as const;
export const LEAD_VOICES = ["bell", "pluck", "arp", "musicBox", "calliope", "marimba", "glass", "twang", "vibes", "warble", "horn", "sub", "sonarBell", "piano", "epiano", "harp", "flute", "violin", "brass", "frenchHorn", "celesta", "sawLead", "squareLead", "kalimba", "steelDrum", "staccato", "stab", "choirLead", "organLead", "accordion", "trumpet", "sax", "guitar", "theremin", "chime", "koto", "timpani"] as const;
export const BASS_VOICES = ["subBass", "walkBass", "pulseBass", "tubaBass", "ironBass", "thumpBass", "fmBass", "upright", "synthBass", "cello", "reeseBass", "chipBass"] as const;
export const DRUM_VOICES = ["kick", "tom", "snare", "rim", "tick", "hat", "shaker", "wood", "clank", "gear", "bongo", "heartbeat", "brush", "bellTick", "anvil", "crack", "openHat", "crash", "ride", "clap", "taiko", "gong", "tambourine", "conga", "chipKick", "chipSnare", "chipHat", "snap", "boom", "cowbell"] as const;
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
  /** One line describing the intent, for the sound test and the ADR. */
  note: string;
}

export interface VariantTweak {
  transpose?: number;
  bedFilterMul?: number;
  bedGainMul?: number;
  tempoMul?: number;
}

export type BassStyle = "root" | "octave" | "fifth" | "walk" | "pulse" | "drive";
export type ArpStyle = "up" | "updown" | "broken" | "pedal";

/**
 * The band around the theme's signature sound: the instruments that join as the music builds, how the bass and
 * ostinato move, the second-section chord progression and the room the music plays in.
 */
export interface Ensemble {
  /** Ostinato / arpeggio instrument. */
  arp: LeadVoice;
  arpStyle: ArpStyle;
  /** Counter-melody and second-section melody instrument. */
  counter: LeadVoice;
  /** Instrument for the calm exploration and rest melody (the combat lead is ThemeProfile.voices.lead). */
  calm: LeadVoice;
  /** Boss-fight orchestra: chord stabs, the sustained choir and the pitched drum. */
  stab: LeadVoice;
  choir: PadVoice;
  /** Tuned drum struck on chord changes in boss fights (timpani, or something stranger). */
  timpani: LeadVoice;
  /** Cymbal or gong that marks the start of every section in fights. */
  crash: DrumVoice;
  /** Off-beat open hat for driving fights, or null for themes whose kit has none. */
  openHat: DrumVoice | null;
  bassStyle: BassStyle;
  /** Bass instrument for boss fights (defaults to the theme's own). */
  bossBass?: BassVoice;
  /** Scale degrees of the B section's chords; the A section uses ThemeProfile.chordRoots. */
  progB: readonly number[];
  /** Reverb: tail length in seconds, brightness 0 (dark) to 1 (bright), and the overall wet level. */
  room: { size: number; bright: number; wet: number };
  /** Echo feedback 0..0.6; the echo time is a dotted eighth of the current tempo. */
  echo: number;
  /** The groove for fights: its own kick, backbeat, ticks and bass rhythm, and optionally a heavier kit. */
  fight: { kick: string; back: string; tick: string; bass: string; voices: { kick?: DrumVoice; back?: DrumVoice; tick?: DrumVoice } };
}

export interface ThemeProfile {
  id: ThemeId;
  name: string;
  /** One line describing the sound, for the sound test. */
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
  /** Scale degrees of the theme's tune, relative to the chord in force. */
  motif: readonly number[];
  /** Scale degrees on which the two-bar chords of the A section are built (a triad is stacked on each). */
  chordRoots: readonly number[];
  ensemble: Ensemble;
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
  part: Part;
}

export interface SoundEvent {
  kind: "drum" | "fx";
  t: number;
  voice: DrumVoice | FxVoice;
  vel: number;
  part: Part;
  /** Multiplies every frequency of a drum (tom fills, tuned toms). */
  pitch?: number;
  /** Concrete steps for fx (they are randomised per occurrence); drums look their steps up by voice. */
  steps?: readonly Step[];
}

export type ScoreEvent = MelodicEvent | SoundEvent;

/** How present each group is, from 0 (silent) to 1 (full); higher levels unlock denser patterns. */
export interface Layers {
  pad: number;
  bass: number;
  lead: number;
  counter: number;
  arp: number;
  perc: number;
  orch: number;
  fx: number;
}

/** Song sections. A states the tune, B answers it, C is the boss breakdown, D the climax. */
export type Section = "A" | "B" | "C" | "D";

export type EffectKind = "impact" | "block" | "magic" | "heal" | "defeat" | "door" | "encounter" | "victory" | "failure" | "rankUp" | "masteryUp";
export const EFFECT_KINDS: readonly EffectKind[] = ["impact", "block", "magic", "heal", "defeat", "door", "encounter", "victory", "failure", "rankUp", "masteryUp"];
