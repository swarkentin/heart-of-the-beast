# ADR 0003: Treat Music and Sound as Part of the Game Experience

- Status: Accepted for the first playable prototype
- Date: 2026-11-14

## Context

Music, ambience, and sound effects can make exploration, combat, bosses, and safe hubs feel distinct. They can also become distracting or inaccessible if they are constant, too loud, or impossible to control.

## Decision

For the first playable slice, plan for three complementary audio layers:

- **Music:** atmospheric themes that support the current location or encounter; use transitions rather than abrupt changes where practical.
- **Ambience:** restrained environmental loops that establish a place (for example, wind, machinery, distant water, or room tone).
- **Sound effects:** short, purposeful feedback for player actions, enemy telegraphs, hits, loot, UI confirmation, and important state changes.

Audio should reinforce visual/gameplay communication, never be the only way to understand a critical event. Provide independent controls for music and sound effects, a master mute/volume control, and respect browser/device autoplay restrictions. Avoid unnecessarily busy or repetitive loops.

Use original, appropriately licensed, or public-domain audio assets with provenance recorded in the project. Do not assume third-party commercial game or soundtrack audio is available for reuse.

## Open questions

- Final musical identity and instrumentation for each theme.
- Whether ambience gets its own user-facing volume control or is grouped with effects.
- Asset format, streaming/loading strategy, and audio implementation library.
- Whether cast/spectator audio is mixed differently from player-device audio.

## Consequences

Audio can be introduced incrementally and tested on real devices. The precise soundtrack style and production pipeline remain intentionally undecided until the visual themes and first playable slice are clearer.


## Prototype implementation (November 2026)

The first browser prototype uses the built-in Web Audio API rather than introducing an audio dependency or shipping unlicensed recordings. It generates a restrained Catacombs drone, sparse melodic notes, filtered room ambience, and short synthesized combat/transition cues. The flooded crossing and Warden gate receive different tonal palettes, and combat adds a little rhythmic tension.

Audio is opt-in after a user gesture to respect autoplay restrictions. The prototype exposes independent master, music, and effects levels plus mute. Ambience is currently grouped with music. This is a functional sound-design experiment, not the final soundtrack or asset pipeline; replace or layer in authored audio assets as the visual themes mature, retaining clear provenance for every asset.
