// One music profile per dungeon theme in the backend DungeonThemeCatalog, plus a treatment for every boss in the
// bestiary. All numbers are starting points for a human to audition and tune; see docs/decisions/0026.
import type { BossTreatment, ThemeId, ThemeProfile } from "./types.ts";

const catacombs: ThemeProfile = {
  id: "catacombs", name: "Forgotten Catacombs", character: "Minor drone, tolling bells, slow heartbeat toms and dripping stone",
  rootHz: 73.42, depthDrift: [0, -2, -5], scale: "minor", bpm: 84, steps: 16, swing: 0, wobble: 0, leadOct: 2,
  voices: { pad: "strings", bass: "cello", lead: "frenchHorn", accent: "bell", kick: "tom", back: "wood", tick: "tick", fill: "tom" },
  patterns: { kick: "X.......x.......", back: "........o.......", tick: "..o...o...o...o.", bass: "X.......x.....o.", lead: "X.....x...x.....", leadSparse: "X.......x......." },
  motif: [0, 2, 3, 2, -1, 0], chordRoots: [0, 5, 3, 4],
  ensemble: { arp: "harp", arpStyle: "broken", counter: "violin", calm: "piano", stab: "stab", choir: "choirAah", timpani: "timpani", crash: "crash", openHat: null, bassStyle: "octave", progB: [5, 3, 6, 4], room: { size: 3.4, bright: 0.4, wet: 0.38 }, echo: 0.25,
    fight: { kick: "X.....x.X.......", back: "....X.......X...", tick: "x.x.x.x.x.x.x.x.", bass: "X.x...x.X.x...x.", voices: { kick: "taiko", back: "snare", tick: "hat" } } },
  bed: { noise: "pink", filter: "lowpass", f: 700, q: 0.7, gain: 0.075, drones: [{ ratio: 1, w: "triangle", gain: 0.1, cents: 0 }, { ratio: 1.5, w: "sine", gain: 0.06, cents: -4 }, { ratio: 2, w: "sine", gain: 0.025, cents: 5 }] },
  fx: [{ fx: "drip", p: 0.5 }, { fx: "creak", p: 0.12 }, { fx: "toll", p: 0.12, minDepth: 2 }],
  variants: { flooded: { transpose: -5, bedFilterMul: 0.6, bedGainMul: 1.7 }, gate: { transpose: -11, bedFilterMul: 0.8 } },
  bosses: {
    crypt_warden: { tempoMul: 1.12, transpose: 0, scale: "harmonicMinor", lead: "horn", note: "Regal funeral march: harmonic minor, brass lead, soul-drain tension" },
    ossuary_colossus: { tempoMul: 0.85, transpose: -5, fill: "anvil", lead: "sub", note: "Slow earth-shaking slams: a fifth lower, anvil fills, sub-bass melody" },
    pale_archivist: { tempoMul: 1.25, transpose: 2, scale: "phrygian", lead: "musicBox", extraFx: "whisper", note: "Restless scholar: phrygian music-box runs over whispering stacks" },
    tolling_abbot: { tempoMul: 0.75, transpose: -5, scale: "harmonicMinor", fill: "tom", lead: "bell", note: "Bell-tower vigil: slow harmonic-minor bells and tolling toms" },
  },
};

const scifi: ThemeProfile = {
  id: "scifi", name: "Sci-Fi Research Facility", character: "Pulsing synth arpeggios, square-wave bass, electric crack snare, steam hiss and alarm beeps",
  rootHz: 55, depthDrift: [0, -2, 3], scale: "dorian", bpm: 116, steps: 16, swing: 0, wobble: 0, leadOct: 2,
  voices: { pad: "junoPad", bass: "synthBass", lead: "sawLead", accent: "glass", kick: "kick", back: "crack", tick: "tick", fill: "crack" },
  patterns: { kick: "X...x...X...x.o.", back: "....X.......X...", tick: "x.x.x.x.x.x.x.x.", bass: "X.xxX.xxX.xxX.xx", lead: "x.x.x.x.x.x.x.x.", leadSparse: "X...x...X...x..." },
  motif: [0, 2, 4, 7, 4, 2], chordRoots: [0, 3, 5, 4],
  ensemble: { arp: "arp", arpStyle: "up", counter: "epiano", calm: "epiano", stab: "stab", choir: "choirAah", timpani: "timpani", crash: "crash", openHat: "openHat", bassStyle: "drive", progB: [5, 3, 4, 4], room: { size: 2.2, bright: 0.7, wet: 0.28 }, echo: 0.35,
    fight: { kick: "X...X...X...X.x.", back: "....X.......X...", tick: "x.xxx.xxx.xxx.xx", bass: "X.xxX.xxX.xxX.xx", voices: { back: "clap", tick: "hat" } } },
  bed: { noise: "white", filter: "highpass", f: 3000, q: 0.5, gain: 0.015, lfo: { rate: 0.6, depth: 0.4 }, drones: [{ ratio: 1, w: "sine", gain: 0.08, cents: 0 }, { ratio: 2, w: "square", gain: 0.012, cents: 6 }] },
  fx: [{ fx: "beep", p: 0.5 }, { fx: "steam", p: 0.12 }, { fx: "static", p: 0.1, minDepth: 2 }],
  variants: {},
  bosses: {
    containment_mech: { tempoMul: 0.95, transpose: -5, fill: "anvil", lead: "sub", note: "Hydraulic stomp: low, heavy, anvil-struck fills" },
    overseer_core: { tempoMul: 1.3, transpose: 0, scale: "diminished", lead: "pluck", extraFx: "beep", note: "Glitching machine mind: fast diminished plucks and beeps" },
    patient_zero: { tempoMul: 1, transpose: -2, scale: "locrian", lead: "warble", extraFx: "swell", note: "Organic horror: locrian, wavering voice, swelling noise" },
    specimen_omega: { tempoMul: 1.15, transpose: -3, scale: "locrian", lead: "warble", extraFx: "beep", note: "Escaped specimen: locrian warble over containment alarms" },
  },
};

const mobster: ThemeProfile = {
  id: "mobster", name: "1930s Mobster Underworld", character: "Smoky swing with a walking upright bass, vibraphone, brushes, rain and vinyl crackle",
  rootHz: 82.41, depthDrift: [0, -2, -5], scale: "blues", bpm: 104, steps: 16, swing: 0.28, wobble: 0, leadOct: 2,
  voices: { pad: "smokePad", bass: "upright", lead: "trumpet", accent: "vibes", kick: "kick", back: "brush", tick: "hat", fill: "snare" },
  patterns: { kick: "x.......x.......", back: "....x.......x...", tick: "x.xxx.xxx.xxx.xx", bass: "x...x...x...x...", lead: "x..x..x...x.x...", leadSparse: "x.....x........." },
  motif: [0, 1, 2, 3, 2, 1, 4, 2], chordRoots: [0, 3, 2, 4],
  ensemble: { arp: "piano", arpStyle: "pedal", counter: "piano", calm: "vibes", stab: "brass", choir: "brassPad", timpani: "timpani", crash: "crash", openHat: null, bassStyle: "walk", progB: [3, 4, 0, 4], room: { size: 1.4, bright: 0.5, wet: 0.22 }, echo: 0.15,
    fight: { kick: "x.......x.......", back: "....x.......x...", tick: "x..xx..xx..xx..x", bass: "x.x.x.x.x.x.x.x.", voices: { back: "snare", tick: "ride" } } },
  bed: { noise: "pink", filter: "bandpass", f: 500, q: 0.6, gain: 0.05, lfo: { rate: 0.1, depth: 0.3 }, drones: [{ ratio: 1, w: "sine", gain: 0.08, cents: 0 }] },
  fx: [{ fx: "static", p: 0.6 }, { fx: "carHorn", p: 0.07 }, { fx: "siren", p: 0.08, minDepth: 2 }],
  variants: {},
  bosses: {
    the_don: { tempoMul: 0.9, transpose: -5, lead: "horn", note: "Menacing slow swing: low muted-brass lead" },
    spectral_kingpin: { tempoMul: 1, transpose: 0, scale: "diminished", lead: "glass", extraFx: "swell", note: "Ghost boss: diminished glass tones and swelling haze" },
    black_sedan: { tempoMul: 1.35, transpose: -2, fill: "tom", lead: "sub", extraFx: "carHorn", note: "Getaway chase: fast, engine-low, horn stabs" },
    ledger_ghost: { tempoMul: 0.95, transpose: 0, scale: "diminished", lead: "musicBox", extraFx: "whisper", note: "Haunted books: diminished music-box and whispered sums" },
  },
};

const sunken: ThemeProfile = {
  id: "sunken", name: "Sunken Kingdom", character: "Muffled deep pads, sonar pings, bubbling, slow heartbeat and distant undersea bells",
  rootHz: 55, depthDrift: [0, -2, -5], scale: "dorian", bpm: 66, steps: 16, swing: 0, wobble: 4, leadOct: 2,
  voices: { pad: "muffledPad", bass: "subBass", lead: "sonarBell", accent: "glass", kick: "heartbeat", back: "tom", tick: "bellTick", fill: "tom" },
  patterns: { kick: "X...............", back: "........x.......", tick: "....o.......o...", bass: "X.......o.......", lead: "X.......x.......", leadSparse: "X..............." },
  motif: [0, 4, 2, 3, 1], chordRoots: [0, 3, 5, 4],
  ensemble: { arp: "celesta", arpStyle: "updown", counter: "choirLead", calm: "harp", stab: "brass", choir: "choirAah", timpani: "timpani", crash: "gong", openHat: null, bassStyle: "root", bossBass: "cello", progB: [3, 1, 4, 5], room: { size: 4.5, bright: 0.2, wet: 0.45 }, echo: 0.4,
    fight: { kick: "X.......X.......", back: "....x.......x...", tick: "..x...x...x...x.", bass: "X...x...X...x.o.", voices: { kick: "taiko", back: "snare" } } },
  bed: { noise: "brown", filter: "lowpass", f: 260, q: 0.7, gain: 0.12, lfo: { rate: 0.12, depth: 0.5 }, drones: [{ ratio: 1, w: "sine", gain: 0.12, cents: 0 }, { ratio: 0.5, w: "sine", gain: 0.1, cents: 0 }] },
  fx: [{ fx: "sonar", p: 0.45 }, { fx: "bubble", p: 0.6 }, { fx: "toll", p: 0.1, minDepth: 2 }, { fx: "whisper", p: 0.1, minDepth: 3 }],
  variants: {},
  bosses: {
    drowned_king: { tempoMul: 1, transpose: 0, scale: "minor", fill: "tom", lead: "bell", note: "Sunken court dirge: minor bells over drum-like toms" },
    abyssal_angler: { tempoMul: 0.8, transpose: -7, extraFx: "sonar", note: "Stalking depths: slow, a fifth lower, relentless sonar" },
    ancient_guardian: { tempoMul: 0.7, transpose: -12, fill: "anvil", lead: "sub", note: "Monolith waking: an octave down, anvil strikes" },
    pearl_leviathan: { tempoMul: 0.85, transpose: -5, scale: "lydian", lead: "glass", extraFx: "sonar", note: "Pearl grotto: slow lydian glass and distant sonar" },
  },
};

const clockwork: ThemeProfile = {
  id: "clockwork", name: "Clockwork Empire", character: "Ticking gear percussion, music-box tune, boiler drone, steam jets and tolling brass bells",
  rootHz: 98, depthDrift: [0, -2, -5], scale: "harmonicMinor", bpm: 112, steps: 16, swing: 0, wobble: 0, leadOct: 2,
  voices: { pad: "boilerPad", bass: "thumpBass", lead: "musicBox", accent: "bell", kick: "kick", back: "gear", tick: "gear", fill: "clank" },
  patterns: { kick: "X.......X.......", back: "....x.......x...", tick: "x.x.x.x.x.x.x.x.", bass: "X...x...X...x...", lead: "x.x...x.x.x...x.", leadSparse: "x...x.....x....." },
  motif: [0, 2, 4, 2, 7, 4, 2, 0], chordRoots: [0, 3, 4, 0],
  ensemble: { arp: "marimba", arpStyle: "broken", counter: "violin", calm: "celesta", stab: "stab", choir: "organPad", timpani: "timpani", crash: "crash", openHat: null, bassStyle: "octave", bossBass: "tubaBass", progB: [5, 3, 4, 4], room: { size: 1.8, bright: 0.6, wet: 0.25 }, echo: 0.2,
    fight: { kick: "X...x...X...x...", back: "....X.......X...", tick: "xxxxxxxxxxxxxxxx", bass: "X.x.X.x.X.x.X.x.", voices: { back: "snare" } } },
  bed: { noise: "white", filter: "bandpass", f: 1400, q: 1.2, gain: 0.02, drones: [{ ratio: 1, w: "triangle", gain: 0.09, cents: 0 }, { ratio: 2, w: "square", gain: 0.015, cents: 4 }] },
  fx: [{ fx: "metalClank", p: 0.6 }, { fx: "steam", p: 0.25 }, { fx: "toll", p: 0.12, minDepth: 2 }],
  variants: {},
  bosses: {
    brass_colossus: { tempoMul: 0.9, transpose: -5, fill: "anvil", lead: "horn", note: "Furnace march: heavy brass over anvil fills" },
    the_clockmaker: { tempoMul: 1.3, transpose: 0, scale: "phrygianDominant", lead: "musicBox", note: "Intricate artificer: fast music-box in phrygian dominant" },
    leviathan_boiler: { tempoMul: 1.1, transpose: -7, extraFx: "steam", fill: "clank", note: "Living engine: low roar, venting steam, clanking fills" },
    grand_orrery: { tempoMul: 1.2, transpose: 2, scale: "wholeTone", lead: "arp", fill: "clank", note: "Turning heavens: whole-tone arpeggios and ticking gears" },
  },
};

const carnival: ThemeProfile = {
  id: "carnival", name: "Haunted Carnival", character: "A detuned calliope waltz in 12/8 with tuba oom-pah, crowd murmur, balloon pops and clown horns",
  rootHz: 130.81, depthDrift: [0, -2, 3], scale: "harmonicMinor", bpm: 120, steps: 12, swing: 0, wobble: 14, leadOct: 1,
  voices: { pad: "organPad", bass: "tubaBass", lead: "calliope", accent: "musicBox", kick: "kick", back: "rim", tick: "shaker", fill: "snare" },
  patterns: { kick: "X.....x.....", back: "..x.x...x.x.", tick: "x.x.x.x.x.x.", bass: "X.....x.....", lead: "x..x..x..x.x", leadSparse: "x.....x....." },
  motif: [0, 2, 4, 5, 4, 2, 0, -1], chordRoots: [0, 3, 4, 0],
  ensemble: { arp: "celesta", arpStyle: "up", counter: "accordion", calm: "celesta", stab: "brass", choir: "brassPad", timpani: "timpani", crash: "crash", openHat: null, bassStyle: "fifth", progB: [5, 3, 4, 0], room: { size: 1.6, bright: 0.6, wet: 0.25 }, echo: 0.15,
    fight: { kick: "X.....X.....", back: "...x.....x..", tick: "x.xx.xx.xx.x", bass: "X..x..X..x..", voices: { back: "snare" } } },
  bed: { noise: "pink", filter: "bandpass", f: 900, q: 0.8, gain: 0.03, lfo: { rate: 0.25, depth: 0.4 }, drones: [{ ratio: 1, w: "triangle", gain: 0.07, cents: 0 }, { ratio: 1.5, w: "triangle", gain: 0.04, cents: 10 }] },
  fx: [{ fx: "pop", p: 0.35 }, { fx: "honk", p: 0.15 }, { fx: "swell", p: 0.1, minDepth: 2 }],
  variants: {},
  bosses: {
    the_ringmaster: { tempoMul: 1.2, transpose: 2, lead: "horn", note: "Ringleader fanfare: brass over the waltz" },
    laughing_big_top: { tempoMul: 1.4, transpose: 0, scale: "wholeTone", extraFx: "honk", note: "Cackling tent: fast whole-tone, honking" },
    harlequin_horror: { tempoMul: 1.25, transpose: -2, scale: "diminished", lead: "musicBox", note: "Jerky contortionist: diminished music-box" },
    calliope_golem: { tempoMul: 1.15, transpose: -2, scale: "phrygianDominant", lead: "horn", extraFx: "steam", note: "Steam organ: brassy phrygian dominant and hissing pipes" },
  },
};

const jungle: ThemeProfile = {
  id: "jungle", name: "Alien Jungle", character: "Late-night jungle / liquid drum and bass: rolling Amen-style breaks, warm sub, lush phased PS2-era pads and spacious dub echoes",
  rootHz: 65.41, depthDrift: [0, -2, -5], scale: "dorian", bpm: 170, steps: 16, swing: 0.04, wobble: 1, leadOct: 2,
  voices: { pad: "warmPad", bass: "reeseBass", lead: "flute", accent: "glass", kick: "kick", back: "snare", tick: "hat", fill: "snare" },
  patterns: { kick: "X..x...xX...x..x", back: "....X.......X.x.", tick: "x.x.xx.x.x.x.x.x", bass: "X.....x.X...x...", lead: "x.......x...x...", leadSparse: "X.......x......." },
  motif: [0, 2, 4, 3, 2, 4, 6, 4], chordRoots: [0, 5, 3, 4],
  ensemble: { arp: "marimba", arpStyle: "broken", counter: "epiano", calm: "kalimba", stab: "stab", choir: "choirAah", timpani: "timpani", crash: "crash", openHat: "openHat", bassStyle: "root", progB: [3, 4, 5, 4], room: { size: 2.5, bright: 0.6, wet: 0.32 }, echo: 0.4,
    fight: { kick: "X.........X.....", back: "....X.......X...", tick: "x.xxx.xxx.xxx.xx", bass: "X.....x...X.....", voices: {} } },
  bed: { noise: "pink", filter: "lowpass", f: 1800, q: 0.8, gain: 0.018, lfo: { rate: 0.08, depth: 0.7 }, drones: [{ ratio: 1, w: "sawtooth", gain: 0.055, cents: -7 }, { ratio: 1.003, w: "sawtooth", gain: 0.05, cents: 7 }, { ratio: 1.5, w: "triangle", gain: 0.035, cents: -4 }] },
  fx: [{ fx: "swell", p: 0.45 }, { fx: "drip", p: 0.12 }, { fx: "whisper", p: 0.08 }],
  variants: {},
  bosses: {
    heartroot_titan: { tempoMul: 0.85, transpose: -7, fill: "tom", lead: "sub", note: "Ancient grove: a fifth lower, slow earth drums" },
    mother_lantern: { tempoMul: 1, transpose: 2, scale: "lydian", lead: "glass", extraFx: "swell", note: "Luminous bloom: bright lydian glass and swells" },
    apex_maw: { tempoMul: 1.3, transpose: -2, scale: "phrygian", fill: "bongo", note: "Apex predator: fast phrygian with bongo runs" },
    hive_queen: { tempoMul: 1.25, transpose: 0, scale: "phrygian", lead: "warble", fill: "bongo", note: "Humming hive: buzzing phrygian warble and busy drums" },
  },
};

const dreamscape: ThemeProfile = {
  id: "dreamscape", name: "Dreamscapes", character: "Unstable tuning and a mode that rotates every four bars: choir pads, warbling voice, whispers and reversed swells",
  rootHz: 110, depthDrift: [0, 1, -2], scale: "wholeTone", scaleCycle: ["wholeTone", "lydian", "locrian", "diminished"], bpm: 72, steps: 16, swing: 0.05, wobble: 30, leadOct: 2,
  voices: { pad: "choirPad", bass: "subBass", lead: "warble", accent: "glass", kick: "heartbeat", back: "rim", tick: "bellTick", fill: "tom" },
  patterns: { kick: "X.....x...x.....", back: "......x.........", tick: "..o.....o....o..", bass: "X.....x.........", lead: "x...x..x....x...", leadSparse: "x.....x........." },
  motif: [0, 3, 1, 5, 2, 4], chordRoots: [0, 2, 4, 1],
  ensemble: { arp: "harp", arpStyle: "updown", counter: "theremin", calm: "celesta", stab: "choirLead", choir: "glassPad", timpani: "chime", crash: "gong", openHat: null, bassStyle: "root", progB: [1, 3, 2, 0], room: { size: 5, bright: 0.6, wet: 0.5 }, echo: 0.45,
    fight: { kick: "X.....x...x.....", back: "....x.......x...", tick: "..x...x...x...x.", bass: "X.....x...x.....", voices: { back: "snap" } } },
  bed: { noise: "pink", filter: "bandpass", f: 600, q: 1, gain: 0.06, lfo: { rate: 0.07, depth: 0.8 }, drones: [{ ratio: 1, w: "sine", gain: 0.1, cents: 0 }, { ratio: 1.0595, w: "sine", gain: 0.05, cents: 0 }] },
  fx: [{ fx: "swell", p: 0.5 }, { fx: "whisper", p: 0.35 }, { fx: "glassPing", p: 0.2 }],
  variants: {},
  bosses: {
    moon_sovereign: { tempoMul: 0.8, transpose: 0, scale: "lydian", lead: "glass", note: "Stately lullaby: slow lydian glass" },
    hungry_grin: { tempoMul: 1.3, transpose: 1, scale: "diminished", extraFx: "whisper", note: "Laughing void: fast, diminished, whispering" },
    hollow_child: { tempoMul: 0.75, transpose: -3, scale: "minor", lead: "musicBox", extraFx: "whisper", note: "Lullaby from the door: a slow, wrong music box" },
    nightmare_mare: { tempoMul: 1.3, transpose: -1, scale: "diminished", lead: "glass", fill: "tom", note: "Night gallop: fast diminished glass over galloping toms" },
  },
};

const arctic: ThemeProfile = {
  id: "arctic", name: "Arctic Station", character: "Sparse high glass tones, howling wind, ice cracks and a very slow pulse",
  rootHz: 65.41, depthDrift: [0, -2, -5], scale: "pentMinor", bpm: 60, steps: 16, swing: 0, wobble: 2, leadOct: 3,
  voices: { pad: "glassPad", bass: "subBass", lead: "glass", accent: "bell", kick: "heartbeat", back: "crack", tick: "tick", fill: "crack" },
  patterns: { kick: "X...............", back: "........x.......", tick: "..o...........o.", bass: "X...............", lead: "x.......o.......", leadSparse: "x..............." },
  motif: [0, 2, 4, 3, 1, 0], chordRoots: [0, 3, 1, 4],
  ensemble: { arp: "harp", arpStyle: "up", counter: "flute", calm: "celesta", stab: "stab", choir: "choirAah", timpani: "timpani", crash: "crash", openHat: null, bassStyle: "root", bossBass: "cello", progB: [3, 2, 4, 1], room: { size: 4.2, bright: 0.85, wet: 0.42 }, echo: 0.4,
    fight: { kick: "X.......x.......", back: "....X.......X...", tick: "x...x...x...x...", bass: "X.......X...x...", voices: { kick: "taiko", back: "snare", tick: "shaker" } } },
  bed: { noise: "white", filter: "bandpass", f: 900, q: 0.5, gain: 0.1, lfo: { rate: 0.2, depth: 0.7 }, drones: [{ ratio: 1, w: "sine", gain: 0.06, cents: 0 }] },
  fx: [{ fx: "wind", p: 0.5 }, { fx: "icecreak", p: 0.25 }, { fx: "glassPing", p: 0.4 }],
  variants: {},
  bosses: {
    glacier_titan: { tempoMul: 0.8, transpose: -7, fill: "tom", lead: "sub", note: "Colossal thaw: slow, a fifth down, deep toms" },
    thing_in_the_ice: { tempoMul: 1.2, transpose: -1, scale: "locrian", lead: "warble", extraFx: "icecreak", note: "Thawed horror: locrian warble, cracking ice" },
    cryo_warden: { tempoMul: 1.15, transpose: 0, lead: "arp", fill: "clank", note: "Security mech: cold arpeggios and clanking fills" },
    permafrost_maw: { tempoMul: 0.8, transpose: -7, scale: "locrian", lead: "sub", extraFx: "icecreak", note: "Something under the ice: low locrian groans and cracking ice" },
  },
};

const ghosttown: ThemeProfile = {
  id: "ghosttown", name: "Ghost Town", character: "Twangy shuffle with hoof-clop ticks, reedy accordion pads, desert wind and a distant church bell",
  rootHz: 82.41, depthDrift: [0, -2, -5], scale: "pentMinor", bpm: 96, steps: 16, swing: 0.22, wobble: 3, leadOct: 2,
  voices: { pad: "reedPad", bass: "walkBass", lead: "twang", accent: "bell", kick: "tom", back: "wood", tick: "wood", fill: "snare" },
  patterns: { kick: "X.......x.......", back: "....x.......x...", tick: "x.x.x.x.x.x.x.x.", bass: "X.......x.......", lead: "x..x.x..x.....x.", leadSparse: "x.....x........." },
  motif: [0, 1, 2, 4, 2, 1, 0, -1], chordRoots: [0, 3, 4, 0],
  ensemble: { arp: "guitar", arpStyle: "broken", counter: "trumpet", calm: "guitar", stab: "brass", choir: "choirAah", timpani: "timpani", crash: "crash", openHat: null, bassStyle: "fifth", progB: [3, 4, 0, 4], room: { size: 2.4, bright: 0.55, wet: 0.3 }, echo: 0.35,
    fight: { kick: "X.......X.......", back: "....x.......x...", tick: "x.xx.xx.x.xx.xx.", bass: "X..x.xX..x.x....", voices: { kick: "kick", back: "snare", tick: "shaker" } } },
  bed: { noise: "pink", filter: "bandpass", f: 500, q: 0.5, gain: 0.09, lfo: { rate: 0.15, depth: 0.6 }, drones: [{ ratio: 1, w: "sine", gain: 0.06, cents: 0 }] },
  fx: [{ fx: "wind", p: 0.5 }, { fx: "creak", p: 0.3 }, { fx: "tumble", p: 0.2 }, { fx: "toll", p: 0.12, minDepth: 2 }],
  variants: {},
  bosses: {
    the_undertaker: { tempoMul: 0.8, transpose: -5, fill: "tom", lead: "bell", note: "Funeral toll: slow, low, bell lead" },
    sheriff_of_the_damned: { tempoMul: 1.25, transpose: 0, scale: "phrygianDominant", lead: "twang", note: "High-noon showdown: fast phrygian dominant twang" },
    hanging_tree: { tempoMul: 0.75, transpose: -2, scale: "minor", lead: "glass", extraFx: "creak", note: "Mournful gallows: slow minor glass, creaking rope" },
    hanging_judge: { tempoMul: 0.85, transpose: -3, scale: "harmonicMinor", lead: "twang", extraFx: "creak", note: "Court in session: harmonic-minor twang and a creaking rope" },
  },
};

const wasteland: ThemeProfile = {
  id: "wasteland", name: "Post-Apocalyptic Settlement", character: "Industrial clanks over detuned saw drones, geiger ticks, radio static and a distant siren",
  rootHz: 61.74, depthDrift: [0, -2, -5], scale: "phrygian", bpm: 100, steps: 16, swing: 0, wobble: 6, leadOct: 2,
  voices: { pad: "ironPad", bass: "ironBass", lead: "guitar", accent: "horn", kick: "kick", back: "clank", tick: "tick", fill: "anvil" },
  patterns: { kick: "X..x..X...x.X...", back: "....X.......X...", tick: "x.x.x.x.x.x.x.x.", bass: "X..x..X...x.X...", lead: "x.....x...x.....", leadSparse: "X..............." },
  motif: [0, 1, 3, 1, 4, 3, 1, 0], chordRoots: [0, 1, 3, 0],
  ensemble: { arp: "pluck", arpStyle: "pedal", counter: "violin", calm: "pluck", stab: "stab", choir: "choirAah", timpani: "timpani", crash: "crash", openHat: "openHat", bassStyle: "drive", progB: [1, 3, 0, 5], room: { size: 2, bright: 0.4, wet: 0.26 }, echo: 0.3,
    fight: { kick: "X..x..X...x.X...", back: "....X.......X...", tick: "x.x.x.x.x.x.x.x.", bass: "X..x..X...x.X..x", voices: { tick: "hat" } } },
  bed: { noise: "brown", filter: "lowpass", f: 400, q: 0.7, gain: 0.1, drones: [{ ratio: 1, w: "sawtooth", gain: 0.04, cents: -10 }, { ratio: 1.01, w: "sawtooth", gain: 0.04, cents: 10 }] },
  fx: [{ fx: "metalClank", p: 0.5 }, { fx: "static", p: 0.3 }, { fx: "geiger", p: 0.7 }, { fx: "siren", p: 0.1, minDepth: 2 }],
  variants: {},
  bosses: {
    warlord_rig: { tempoMul: 1.2, transpose: -5, fill: "anvil", note: "War-engine: fast, low, anvil fills" },
    fallout_behemoth: { tempoMul: 0.8, transpose: -12, extraFx: "geiger", lead: "sub", note: "Radioactive giant: an octave down, geiger crackle" },
    scrap_heap_king: { tempoMul: 1.1, transpose: 1, scale: "diminished", extraFx: "metalClank", note: "Junk-crowned chaos: diminished and clattering" },
    rad_behemoth: { tempoMul: 0.85, transpose: -7, fill: "anvil", lead: "sub", extraFx: "geiger", note: "Glowing crater: heavy anvil stomps and geiger crackle" },
  },
};

const noir: ThemeProfile = {
  id: "noir", name: "Noir City", character: "Brushed snare and a slow walking bass under a muted horn, with rain, a distant car horn and a lonely piano bell",
  rootHz: 69.3, depthDrift: [0, -2, -5], scale: "blues", bpm: 78, steps: 16, swing: 0.3, wobble: 2, leadOct: 2,
  voices: { pad: "smokePad", bass: "walkBass", lead: "sax", accent: "vibes", kick: "kick", back: "brush", tick: "brush", fill: "rim" },
  patterns: { kick: "X.......x.......", back: "....x.......x...", tick: "x.xx.xx.x.xx.xx.", bass: "X...x...X...x...", lead: "x.....x...x..x..", leadSparse: "x.........x....." },
  motif: [0, 2, 3, 4, 3, 1, 0, -1], chordRoots: [0, 3, 4, 0],
  ensemble: { arp: "epiano", arpStyle: "broken", counter: "vibes", calm: "piano", stab: "brass", choir: "strings", timpani: "timpani", crash: "crash", openHat: null, bassStyle: "walk", bossBass: "upright", progB: [3, 4, 0, 4], room: { size: 2.2, bright: 0.4, wet: 0.3 }, echo: 0.2,
    fight: { kick: "x.......x.......", back: "....x.......x...", tick: "x..xx..xx..xx..x", bass: "x.x.x.x.x.x.x.x.", voices: { back: "snare", tick: "ride" } } },
  bed: { noise: "pink", filter: "bandpass", f: 2400, q: 0.4, gain: 0.05, lfo: { rate: 0.2, depth: 0.3 }, drones: [{ ratio: 1, w: "sine", gain: 0.05, cents: 0 }] },
  fx: [{ fx: "drip", p: 0.6 }, { fx: "carHorn", p: 0.1 }, { fx: "siren", p: 0.08, minDepth: 2 }],
  variants: {},
  bosses: {
    the_commissioner: { tempoMul: 0.9, transpose: -5, fill: "rim", lead: "horn", note: "Smoke-filled office: slow, low, muted brass" },
    the_rain_king: { tempoMul: 1.1, transpose: 2, scale: "minor", lead: "glass", extraFx: "drip", note: "Storm drain: minor glass over a downpour" },
    man_in_shadow: { tempoMul: 1.2, transpose: -7, scale: "locrian", lead: "sub", fill: "rim", note: "The last streetlight: locrian sub-bass stalking, rim-shot heartbeats" },
    the_projectionist: { tempoMul: 1, transpose: 0, scale: "harmonicMinor", lead: "musicBox", extraFx: "static", note: "Picture palace: a music-box score through a crackling projector" },
  },
};

const arcade: ThemeProfile = {
  id: "arcade", name: "8-Bit Arcade", character: "Square-wave arpeggios, pulse bass and chip-tune drums, with coin blips and power-up sweeps",
  rootHz: 65.41, depthDrift: [0, 2, 5], scale: "mixolydian", bpm: 132, steps: 16, swing: 0, wobble: 0, leadOct: 3,
  voices: { pad: "synthPad", bass: "chipBass", lead: "squareLead", accent: "pluck", kick: "chipKick", back: "chipSnare", tick: "chipHat", fill: "chipSnare" },
  patterns: { kick: "X...X...X...X...", back: "....X.......X...", tick: "x.x.x.x.x.x.x.x.", bass: "X.x.X.x.X.x.X.x.", lead: "x.xxx.x.x.xxx.x.", leadSparse: "x...x...x...x..." },
  motif: [0, 2, 4, 5, 4, 2, 4, 7], chordRoots: [0, 4, 5, 3],
  ensemble: { arp: "arp", arpStyle: "up", counter: "squareLead", calm: "pluck", stab: "squareLead", choir: "synthPad", timpani: "pluck", crash: "crash", openHat: null, bassStyle: "octave", progB: [3, 4, 5, 4], room: { size: 0.9, bright: 0.8, wet: 0.15 }, echo: 0.3,
    fight: { kick: "X...X...X...X.x.", back: "....X.......X...", tick: "x.x.x.x.x.x.x.x.", bass: "X.x.X.x.X.x.X.x.", voices: {} } },
  bed: { noise: "white", filter: "highpass", f: 5000, q: 0.5, gain: 0.006, drones: [{ ratio: 1, w: "square", gain: 0.02, cents: 0 }] },
  fx: [{ fx: "beep", p: 0.5 }, { fx: "pop", p: 0.3 }, { fx: "static", p: 0.08, minDepth: 2 }],
  variants: {},
  bosses: {
    mecha_drake: { tempoMul: 1.15, transpose: -5, scale: "phrygian", fill: "anvil", note: "Volcano stage: phrygian, low, anvil fills" },
    high_scorer: { tempoMul: 1.25, transpose: 5, scale: "lydian", lead: "musicBox", note: "Leaderboard: bright lydian music-box combo" },
    the_final_boss: { tempoMul: 1.3, transpose: 0, scale: "harmonicMinor", lead: "arp", fill: "crack", note: "The last level: fast harmonic-minor arps, every drum hitting" },
    glitch_king: { tempoMul: 1.05, transpose: 1, scale: "wholeTone", lead: "warble", extraFx: "static", note: "Corrupted save: warbling whole-tone glitches" },
  },
};

const eldritch: ThemeProfile = {
  id: "eldritch", name: "The Eldritch Castle", character: "A drowned organ under whispered choirs, a slow wrong heartbeat and dripping stone; it never quite resolves",
  rootHz: 51.91, depthDrift: [0, -1, -6], scale: "locrian", bpm: 70, steps: 16, swing: 0, wobble: 8, leadOct: 2,
  voices: { pad: "organPad", bass: "subBass", lead: "organLead", accent: "bell", kick: "heartbeat", back: "tom", tick: "bellTick", fill: "tom" },
  patterns: { kick: "X..x............", back: "........x.......", tick: "..x.......x.....", bass: "X.......X.......", lead: "x......x....x...", leadSparse: "x..............." },
  motif: [0, 1, 4, 3, 1, 0, -2, 0], chordRoots: [0, 1, 4, 6],
  ensemble: { arp: "musicBox", arpStyle: "broken", counter: "choirLead", calm: "glass", stab: "stab", choir: "choirAah", timpani: "timpani", crash: "gong", openHat: null, bassStyle: "pulse", bossBass: "cello", progB: [4, 1, 6, 0], room: { size: 5.5, bright: 0.3, wet: 0.5 }, echo: 0.3,
    fight: { kick: "X..x....X..x....", back: "....X.......X...", tick: "x.x.x.x.x.x.x.x.", bass: "X.x.X.x.X.x.X.x.", voices: { kick: "taiko", back: "snare", tick: "hat" } } },
  bed: { noise: "brown", filter: "lowpass", f: 300, q: 1, gain: 0.1, lfo: { rate: 0.05, depth: 0.5 }, drones: [{ ratio: 1, w: "sine", gain: 0.08, cents: 0 }, { ratio: 1.06, w: "triangle", gain: 0.03, cents: -8 }] },
  fx: [{ fx: "whisper", p: 0.5 }, { fx: "drip", p: 0.4 }, { fx: "bubble", p: 0.2 }, { fx: "toll", p: 0.1, minDepth: 2 }],
  variants: {},
  bosses: {
    dreaming_bishop: { tempoMul: 0.8, transpose: -5, scale: "phrygian", lead: "bell", extraFx: "whisper", note: "Sermon of madness: slow phrygian bells and whispers" },
    choir_of_mouths: { tempoMul: 1, transpose: 3, scale: "diminished", lead: "warble", extraFx: "whisper", note: "Discordant hymn: diminished warbling choir" },
    the_sleeper: { tempoMul: 0.7, transpose: -12, scale: "locrian", lead: "sub", fill: "heartbeat", extraFx: "bubble", note: "The eye opens: an octave down, a vast slow heartbeat, bubbles from the deep" },
    unwritten_librarian: { tempoMul: 1.1, transpose: 2, scale: "wholeTone", lead: "musicBox", extraFx: "whisper", note: "Unwritten stacks: whole-tone music box and turning pages" },
  },
};

const infernal: ThemeProfile = {
  id: "infernal", name: "The Infernal Citadel", character: "War drums and anvils under a burning brass choir and an iron organ, with steam vents and a tolling bell",
  rootHz: 55, depthDrift: [0, -2, -5], scale: "phrygianDominant", bpm: 108, steps: 16, swing: 0, wobble: 4, leadOct: 2,
  voices: { pad: "choirAah", bass: "ironBass", lead: "brass", accent: "bell", kick: "kick", back: "anvil", tick: "clank", fill: "tom" },
  patterns: { kick: "X..X..X.X..X..X.", back: "....X.......X...", tick: "x.x.x.x.x.x.x.x.", bass: "X..X..X.X..X..X.", lead: "x...x.x.x...x...", leadSparse: "X.......X......." },
  motif: [0, 1, 4, 5, 4, 1, 0, -1], chordRoots: [0, 1, 5, 4],
  ensemble: { arp: "staccato", arpStyle: "broken", counter: "choirLead", calm: "violin", stab: "stab", choir: "brassPad", timpani: "timpani", crash: "crash", openHat: "openHat", bassStyle: "drive", progB: [5, 1, 4, 0], room: { size: 3.6, bright: 0.45, wet: 0.38 }, echo: 0.2,
    fight: { kick: "X..X..X.X..X..x.", back: "....X.......X...", tick: "x.x.x.x.x.x.x.x.", bass: "X.xX..X.X.xX..X.", voices: { kick: "kick" } } },
  bed: { noise: "brown", filter: "lowpass", f: 500, q: 0.8, gain: 0.11, lfo: { rate: 0.3, depth: 0.4 }, drones: [{ ratio: 1, w: "sawtooth", gain: 0.04, cents: -6 }, { ratio: 1.5, w: "sawtooth", gain: 0.03, cents: 6 }] },
  fx: [{ fx: "steam", p: 0.4 }, { fx: "metalClank", p: 0.3 }, { fx: "toll", p: 0.15, minDepth: 2 }],
  variants: {},
  bosses: {
    hellforge_smith: { tempoMul: 1, transpose: -5, fill: "anvil", lead: "horn", extraFx: "metalClank", note: "The hellforge: hammered anvils and brass" },
    chain_duke: { tempoMul: 1.15, transpose: 1, scale: "harmonicMinor", lead: "bell", extraFx: "metalClank", note: "Hall of chains: rattling harmonic-minor bells" },
    archfiend: { tempoMul: 1.25, transpose: -7, scale: "phrygianDominant", lead: "horn", fill: "anvil", note: "The burning throne: fast, low, every drum and every horn" },
    gluttonous_maw: { tempoMul: 0.8, transpose: -12, lead: "sub", fill: "heartbeat", extraFx: "bubble", note: "The gullet: a low hungry heartbeat and boiling slag" },
  },
};

/** The Heart of the Beast (ADR 0040) can replace any dungeon's boss, so it plays over that dungeon's own music
 * with one treatment of its own: slow, low and pounding, a heartbeat under the theme. */
export const HEART_BOSS_ID = "heart_of_the_beast";
export const HEART_TREATMENT: BossTreatment = { tempoMul: 0.8, transpose: -7, scale: "harmonicMinor", fill: "tom", lead: "sub", note: "The great beat: the dungeon's theme a fifth down and slower, a sub-bass lead over pounding toms" };

export const PROFILES: Readonly<Record<ThemeId, ThemeProfile>> = { catacombs, scifi, mobster, sunken, clockwork, carnival, jungle, dreamscape, arctic, ghosttown, wasteland, noir, arcade, eldritch, infernal };

export function profileFor(theme: ThemeId): ThemeProfile {
  return PROFILES[theme];
}
