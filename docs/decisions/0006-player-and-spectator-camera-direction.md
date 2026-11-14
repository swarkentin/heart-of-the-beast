# ADR 0006: Player and spectator camera direction

- Status: Accepted for prototype validation
- Date: 2026-11-14

## Context

The initial combat prototype used a side-on composition reminiscent of a traditional JRPG battle screen. The intended game experience is closer to a directional dungeon crawler: players look forward into rooms and choose where to move or which visible threat to engage. A separate screen may show the run to an audience (for example, a television or Discord stream), where a close first-person view is less useful for communicating party position and encounter context.

## Decision

- Use a **first-person-inspired, forward-facing perspective** for the player view during both exploration and combat. Enemies appear ahead in the space; combat does not switch to a side-on battle formation.
- This is a camera and composition direction, not a commitment to true 3D. A 2D illustrated/pixel-art scene with perspective geometry can deliver the intended spatial feel.
- Build the spectator/cast view as a **separate cinematic renderer** over the same authoritative game state and event stream. It may use an elevated or pulled-back camera to show the party, enemies, room layout, and progress.
- The spectator view is read-only and must not own a separate simulation or divergent game state.
- Keep spectator UI restrained: party health/status, dungeon/floor, progress, and brief event callouts; avoid player controls and dashboard-like panels.

## Consequences

- Exploration and combat can share spatial language, reducing camera discontinuity.
- Player and spectator clients need distinct presentation layers but a shared state contract.
- The spectator camera can change framing by context (follow during travel, pull back for encounters, widen for bosses, briefly focus on notable events) without changing game rules.
- Exact rendering technology, sprite scale, camera movement, and final art pipeline remain open and should be validated with prototypes.
- The current prototype demonstrates a static first-person-inspired player composition and a static elevated cast composition; dynamic camera behavior and multiplayer synchronization remain future work.
