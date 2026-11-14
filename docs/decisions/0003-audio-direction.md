# ADR 0003: Treat Music and Sound as Part of the Game Experience

- Status: Proposed
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
