# ADR 0005: Use React, TypeScript, and Vite for the Web Client Prototype

- Status: Proposed
- Date: 2026-11-14

## Context

The first visual prototype needs to validate a responsive player experience and a distinct scene composition before the project invests in a larger rendering or game-engine layer. The frontend should be quick to iterate on, support typed UI state, and remain easy to run locally.

## Decision

Use React, TypeScript, and Vite for the initial web-client prototype.

Keep the first combat-room prototype client-only and use local in-memory state. This is a deliberate presentation/gameplay experiment, not the authoritative game implementation. Do not introduce backend, realtime, persistence, or account dependencies until the interaction and visual direction have been validated.

Use hand-authored SVG scene elements and CSS for the first pass so layout, silhouettes, state indicators, and responsive behavior can be iterated without committing to an art pipeline. Replace these placeholders with production art assets as the visual direction is validated.

## Consequences

- A familiar component model supports the player and cast interfaces as separate views over future shared game state.
- TypeScript provides safer iteration on the UI and interaction model.
- Vite keeps the local development/build loop small.
- The prototype can be hosted as a static frontend later, but it does not yet demonstrate server-authoritative combat or multiplayer behavior.
- SVG/CSS placeholder art is functional scaffolding, not a final quality bar for the game's pixel-art assets.

## Revisit when

The first room and encounter have been tested on phone, tablet, and desktop, and the project has evidence to choose a long-term rendering and asset pipeline.
