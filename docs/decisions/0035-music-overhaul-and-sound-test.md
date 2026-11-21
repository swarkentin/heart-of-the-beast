# ADR 0035: Music Overhaul — Arranged Songs, a Real Mix, Boss Scores and a Sound Test

- Status: Accepted
- Date: 2026-11-20
- Extends: ADR 0026 (theme-aware procedural music)

## Context

ADR 0026 made the soundtrack data-driven and theme-aware, and the building intensity with depth and the
variation between fights worked. But it sounded like an old FM sound card: dry and mono, every bar
re-generated from the same one-bar patterns, melodies that wandered instead of repeating, a bass that ignored
the harmony, thin drums, the same few oscillator voices everywhere and no real balance between parts. The
title screen did not draw the player in, the party lobby did not build anticipation, and boss fights (above
all the capstone castles' bosses) were not much bigger than ordinary fights.

## Decision

Keep the architecture (pure, deterministic score generation in `src/music`, Web Audio playback, cues derived
from the snapshot) and rebuild what it plays.

**Sound.** `synth.ts` now renders in stereo through a mixer: every score event names a *part* (pads, bass,
melody, harmony, ostinato, orchestra, drums, percussion, ambience), and each part has a level, pan, reverb send
and echo send (`MIX`). Each cue gets the theme's own room (a generated convolution reverb: catacomb stone,
undersea, cathedral, small arcade cabinet...) and a dotted-eighth echo. The master runs through a glue
compressor and a limiter. Voices gained unison detune (ensemble strings, choirs, supersaws), FM (electric
piano, steel drum, brass bite, FM bass), hammer and breath noise, saturation, delayed vibrato and filter
envelopes. That gives about 60 instruments: piano, harp, strings, French horn, brass, trumpet, sax, violin,
cello, flute, celesta, kalimba, choir, organ, accordion, guitar, theremin, timpani, chip voices and more.
Drums were rebuilt (punchy kick, snare with body and wires, metallic hats, crash and ride, taiko, gong, clap,
cinematic boom). Bass voices carry an octave harmonic so they can be heard on phone speakers.

**Arrangement.** `score.ts` arranges each state as a song. An A section states the theme's tune in two
four-bar phrases (a question that ends on the fifth, an answer that comes home); a B section answers on a
second instrument over a second chord progression. Melodies are a function of their place in the form, so
they repeat and can be remembered. Chords are voice-led, the bass follows the harmony in a per-theme style
(walking, oom-pah fifths, octaves, driving eighths...), and an ostinato breaks up the chord. Each theme's
`ensemble` (in `profiles.ts`) names its calm melody instrument, counter-melody, ostinato, orchestra, room and a
separate fight groove, so exploration and combat differ in feel as well as volume.

**Intensity.** One `energyFor(state, depth, {capstone, phase})` drives which parts play and how densely:
rests (camp, intermissions, room events) have no drums at all; exploration starts light and adds bass,
ostinato and drums floor by floor; fights bring the fight groove; minibosses add brass stabs and timpani.
Boss fights run a 32-bar A–B–C–D form with an orchestra (brass stabs, choir, tuned timpani, taiko, booms),
a half-time breakdown and a climax lifted a whole tone. Capstone castles (Eldritch Castle, Infernal Citadel)
sit a step above everything else, and a boss at half health, or risen again, enters **phase II**: a new cue
that jumps straight to the climax, a semitone higher and a little faster.

**Menus.** `title.ts` holds two composed pieces around one theme, "Heart of the Beast", in D minor. The
title (40 bars) opens on a heartbeat and swelling choir, has a French horn state the tune over harp and
strings, then hands it to the full orchestra. The party lobby (16 bars) builds in four stages from a ticking
clock to brass stabs and a snare roll, then drops and builds again.

**Sound test.** The menu gets a SOUND TEST (`soundTest.tsx`): every main theme, every theme's exploration,
respite, battle, elite, victory and defeat music, every named boss, floor intensity and boss phase controls,
a mute toggle for each mixer part, a live spectrum and every sound effect in each theme's flavour. It unlocks
at Adventurer Rank 3 or with one mastery point, and the castles' music at rank 6 or three mastery points, in
line with the display filters. On `localhost` (or the Vite dev server) everything is unlocked. It drives the
game's own engine through an override, so closing it crossfades back to the game's music. `?audio-preview`
now opens the same panel standalone.

## Verification

- `npm run test:audio` checks validity only: every theme and boss has music, profiles are consistent, cues
  (including boss phase) derive correctly, bars are deterministic and every event is playable and in range.
  It deliberately does not assert taste (which theme is busier or louder, whether bosses sound different):
  such tests would only block changes that make the music better.
- `npm run audio:check` renders every cue in a real browser. Silence, clipping, DC offset and
  non-determinism fail it; spectral similarity, intensity ordering and the balance between part groups are
  printed as notes to listen for. It can use an installed Chrome via `PLAYWRIGHT_MODULE` and `CHROME_PATH`.
- Scheduling the densest bars (a capstone boss in phase II) takes about 30 ms of main-thread time per bar on
  a desktop, against a 450 ms lookahead.

None of this judges whether the music is good. That takes a listening pass, which is what the sound test is for.
