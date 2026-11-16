# ADR 0026: Data-Driven, Theme-Aware Procedural Music

- Status: Accepted
- Date: 2026-11-15
- Extends: ADR 0003 (audio direction)

## Context

The prototype engine in `frontend/src/audio.tsx` had one hard-coded Catacombs score. The game now has 11 dungeon themes (ADR 0023) with 33 bosses, and the soundtrack should match the dungeon, the encounter and the depth, without restarting when the party walks between rooms.

## Decision

Music is generated procedurally from data, in `frontend/src/music/`:

- **`profiles.ts`** holds one `ThemeProfile` per theme: key and scale, tempo, swing, instrument voices, bass/lead/percussion patterns, motif, ambience bed, ambient one-shots, Catacombs room variants (flooded crossing, Warden's gate) and a `BossTreatment` for every boss creature id in the art manifests (tempo, transposition, scale, lead voice, fill, extra ambience).
- **`cue.ts`** derives a `MusicCue` (theme, state, depth, boss, variant) from the authoritative run snapshot. Theme resolves from `room.themeId`, then `run.themeId`, then the art theme of an enemy sprite, then Catacombs. The cue identity (`cueKey`) excludes the room id, so moving between rooms of one theme and state changes nothing. Because the cue is a pure function of the snapshot, reconnecting clients and spectators converge on the same music.
- **`score.ts`** generates each bar as a pure function of (cue, bar): deterministic and unit-testable. Layers (pad, bass, lead, percussion, ambience) scale with state and depth; percussion and bass arrive and thicken as floors deepen.
- **`synth.ts` / `engine.ts`** play that score with Web Audio through a master chain with a compressor. The engine keeps one layer audible and crossfades to the next on cue change, quantised to the next beat for fights and the next bar otherwise, with stingers for victory and defeat. The same synth code renders offline for checks.
- **`playEffect(kind, theme)`** (exported from `audio.tsx`) plays per-theme hit, block, heal, spell, defeat, door, encounter, victory and failure effects, so combat visuals can trigger sound directly.

Opt-in autoplay (first user gesture), reduced-volume defaults, the settings key and the master/music/effects controls are unchanged.

## Verification

- `npm run test:audio`: node:test unit tests (profiles cover every theme and boss in the art and backend catalogs, cue derivation, determinism, layer escalation, distinct theme fingerprints). Runs in CI.
- `npm run audio:check`: renders every theme x state x depth through a real OfflineAudioContext in headless Chromium and asserts non-silence, no clipping even at maximum sliders, no DC offset, deterministic re-render, distinct spectra between themes and more rhythmic activity in combat than exploration. Needs Playwright; not run in CI.
- `?audio-preview` on the dev server: an audition page listing every theme, state, boss and effect.

These checks cannot judge musicality. The tunes, instrument choices and mix need a human listening pass.

## Consequences

- Adding a theme or boss means adding a profile entry; the tests fail if one is missing.
- Rooms learn their theme from the server: `room.themeId` is the primary signal, then `run.themeId`. Runs from before themed floors fall back to the enemy sprite theme, then Catacombs.
- Combat sounds are played by the combat stage (`monsters/EnemyStage`) through `playEffect(kind, theme)` at the moment each visual lands (hit, enemy impact, block, heal, spell, defeat), using the enemy's art theme. They go through the effects bus, so the effects slider and mute apply. `useGameAudio` keeps only the encounter-level sounds (door, encounter start, victory chime).
- Unit test files are excluded from `tsc -b` (`tsconfig.app.json`) because they import Node built-ins.
- Synthesised audio remains the only source; no third-party audio is used.
