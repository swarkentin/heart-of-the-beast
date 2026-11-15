# ADR 0024: Sprite rendering and combat effects in the frontend

- Status: Accepted
- Date: 2026-11-15

## Context

ADR 0022 produced the sprite sheets and ADR 0023 made every enemy snapshot carry a `sprite` id
(`"<theme>/<creature>"`). The frontend still drew two hand-built SVG figures and flashed a CSS class when an enemy
was hit. We want to see the art in play: animated enemies that telegraph, attack, react and die, with effects over
them, in both the player (first-person) view and the spectator (cast) view, without breaking ADR 0004
(never rely on animation alone) or `prefers-reduced-motion`.

## Decision

**Code layout.** New code lives in `frontend/src/monsters/` (sprites, animation, choreography, the stage) and
`frontend/src/fx/` (effects). `App.tsx` only mounts `<EnemyStage view events enemies target onTarget />` inside each
scene's SVG and carries `sprite` and the raw intent on its `Enemy` type, so scene/background work can proceed in
parallel.

**Sprites.** `spriteStore` fetches `/art/monsters/<theme>/manifest.json` and the sheet once each and caches the
promises. A frame is drawn by a nested `<svg viewBox>` that clips one cell of the sheet, so scaling is always an
integer multiple of the art pixel (monsters 5x and bosses 3x in the player view, 3x and 2x in the cast view) with
`image-rendering: pixelated`. Sprites are anchored bottom-centre on the floor using the manifest anchor, and the idle
bounding box is measured at load to place nameplates, selection rings and the click target. An enemy with no `sprite`
(runs persisted before ADR 0023) or whose art fails to load gets a plain placeholder silhouette and stays playable.

**Animation state machine (per enemy).**

| State | When | Frames |
| --- | --- | --- |
| idle | default | idle loop |
| telegraph | an intent is shown | the move's wind-up (frames before `impactFrame`), played slowly, then held |
| act | the round resolves | from the held wind-up through the impact frame to recovery; the stage is told at the impact frame |
| hit | the enemy takes damage | hit frames, plus a sideways shake and white flash |
| death | the enemy reaches 0 health | death frames, last frame held (nothing left for dissolves) |

**Intent to animation.** Each creature has an `attack` and a `special` move. An intent plays `special` if its label
equals the creature's `special` name; `attack` if it equals the `attack` name; otherwise (the original Catacombs
monsters, whose labels predate the art) `special` for party-wide or healing intents and the kinds `wail`, `sweep`,
`cloud`, `special_strike`, `soul_sweep`, `soul_drain`, and `attack` for everything else. Implemented in `moves.ts`.

**Choreography.** The server resolves a round at once and returns all events in one snapshot. The stage keeps a set of
event keys it has already played (seeded on mount, so reconnecting never replays a past round) and turns the new events
into a timeline (`planRound`, a pure function): the party's hits first, staggered, then defeats, then each enemy's move
in turn. Events do not name the acting enemy, so it is recovered from the message text ("`<name>` uses `<label>` on...");
enemies sharing a display name are told apart by event order (a repeated target starts the next one). This is a heuristic.
If it ever misattributes two identical enemies, only which sprite animates is affected, never the numbers or state.
Adding an `actorId` to combat events would remove it and is the recommended follow-up.

**Effects.** Effects are pure functions from progress to a list of pixel rectangles (`fx/render.ts`) snapped to a
grid, quantised to nine steps, drawn by `FxLayer` with `shape-rendering: crispEdges`: no blur, no gradients. Kinds: hit spark,
slash, claw, ground impact, projectile bolt, jagged zap, party-wide wave, block shield, heal, drain wisps, summon rune,
gas cloud, interrupt cross, freeze shards, and a red first-person screen frame. The element look (physical, frost, fire,
acid, shock, spectral, arcane) is chosen by keywords in the move label, else by the art's move type (cast, wail, roar,
summon, vent, spit take the theme's default element), else physical (`fx/elements.ts`). Effects start on the sprite's
impact frame, so what lands matches the pose.

**Reduced motion and accessibility.** With `prefers-reduced-motion` the sprites stay on idle frame 0 (or the final death
frame), nothing shakes or flashes, and each effect is replaced by a static marker for about a second where it lands.
Telegraphs are never conveyed by animation alone: a "!" badge, the nameplate and the existing intent panel carry them.
Damage, heal and block numbers are drawn on the stage; the existing `aria-live` combat text stays in the DOM (visually
hidden) for screen readers.

## Consequences

- Enemy art, animation and effects are driven by the art manifests and combat events. A new theme needs no frontend change.
- The stage is independent of scene backgrounds, so room/dungeon art can change freely.
- The actor heuristic and the fixed timings (`TIMING`) are the places to revisit if combat gets simultaneous or longer rounds.
- The frontend does not yet have a test runner. `planRound`, `moveAnim`, `elementFor` and the effect renderers are pure and
  ready for unit tests when one is added.
