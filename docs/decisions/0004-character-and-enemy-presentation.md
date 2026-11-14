# ADR 0004: Use Readable Illustrated Characters with Restrained Animation

- Status: Proposed
- Date: 2026-11-14

## Context

The game uses illustrated pixel-art environments and must present characters, enemies, and combat information clearly across phones, tablets, desktop monitors, and a separate cast/spectator display. Rich animation can add personality, but excessive motion and overlapping UI can obscure the scene or make small screens difficult to use.

## Decision

For the first playable slice, prototype detailed illustrated room scenes with distinct character and enemy sprites or cutouts integrated into the composition.

- Prioritize recognizable silhouettes, facing, and readable combat states.
- Use subtle idle animation for life and stronger, brief animation for meaningful actions such as attacks, hits, defeats, and boss telegraphs.
- Do not rely on animation, color, or sound alone to communicate critical state; pair them with clear visual indicators and text/icons where appropriate.
- Preserve a clear hierarchy between environment, interactable points, characters, enemies, and interface.
- Keep navigation, combat choices, enemy intent, health, and party status legible and reachable.
- Adapt layout and information density to the available display. Small screens should prioritize the scene and immediate decisions, moving secondary details into compact panels or progressive disclosure.
- Provide reduced-motion behavior and avoid constant, distracting, or flashing effects.
- Design the cast view as a distinct composition for viewing at a distance rather than scaling up the player interface.

## Open questions

- Exact character representation, sprite scale, frame style, and animation technique.
- Whether scenes use fixed composition, layered parallax, or limited camera movement.
- How many party characters and enemies can be displayed simultaneously before the scene becomes crowded.
- Exact responsive HUD layout and cast-view composition.

## Consequences

The direction provides a visual prototype target without overcommitting to a rendering technology or final art pipeline. Validate a representative exploration room and combat encounter on phone, tablet, and desktop before expanding asset production.
