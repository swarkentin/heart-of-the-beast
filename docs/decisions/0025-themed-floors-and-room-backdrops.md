# ADR 0025: Themed floor generation and pixel-art room backdrops

- Status: Accepted
- Date: 2026-11-15

## Context

ADR 0023 made every monster and dungeon theme catalog content, but only the Forgotten Catacombs could be played:
floor generation hard-coded Catacombs rooms, prose and encounters, and rooms were drawn with hand-written SVG whose
colour was shifted per room id with CSS hue filters. We want a second playable theme (Sci-Fi) now, the other nine
themes to be additions of data rather than code, and room backgrounds to be pixel art that cannot silently go missing.

## Decision

**Floors are generated from a per-theme `FloorTemplate`.**

- `backend/internal/game/floor_templates.go` holds one shared topology (entry, two alternative routes, event room,
  guard room, boss room, optional miniboss branch; three floors) and fills it from the theme's template: room
  names and prose, route and guard encounters, shrine events, a boss per depth, miniboss chance, victory text.
  Seeded randomness only chooses among authored options.
- The Catacombs template is the original content moved into data, and its generator consumes `math/rand` in the
  original order, so Catacombs floors are byte-identical. `TestCatacombsFloorsAreByteIdentical` pins a fingerprint
  of 4,800 generated floors recorded before the refactor.
- Sci-Fi (`scifi`) is the second template, with its own bosses by depth (Containment Unit-9, The Overseer,
  Patient Zero), an event pool, a miniboss and the `scifi-breach` encounter. A theme is `Playable` exactly when it
  has a template (`TestPlayableThemesMatchFloorTemplates`). The other nine stay unplayable until they get templates.
- `Run.ThemeID` and `DungeonRoom.ThemeID` (`themeId`, omitted when empty) are set when a run starts. Runs and rooms
  saved before this change have no `themeId` and are treated as Catacombs (`Run.Theme()`), so no migration is needed.
- `POST /rooms/{id}/start` accepts an optional `{"themeId": "..."}`. An empty body starts Catacombs; an unknown or
  unplayable theme is a 400. `GET /themes` lists the playable themes and the default.

**Room backdrops are generated pixel art with a compile-time-style registry.**

- `scripts/pixel-art/rooms/` renders every pixel of a room procedurally (per-pixel perspective texturing, lighting,
  fog and ordered dithering, then props). Each of the eleven themes has an entry, corridor, event, boss and vault
  backdrop, each in a first-person view and an elevated cinematic (spectator) view: 110 PNGs of 275x155 under
  `frontend/public/art/rooms/<theme>/<kind>-<first|cinema>.png`, shown at 4x with nearest-neighbour filtering.
  Catacombs and Sci-Fi have hand-authored props (skull niches, ceiling conduits...); the other nine have their own
  palettes, surface patterns, light fixtures, doors and set pieces. Output is deterministic.
- `build.mjs` also writes `backend/internal/art/rooms_gen.go`: opaque `art.RoomKind` values and one `art.Backdrop` per
  theme and kind. `game.RoomBackdropKind(room)` maps a room to a kind (`id` ends in `entry` -> entry; boss/miniboss ->
  boss; event -> event; reward -> vault; otherwise corridor). `FloorTemplateCatalog.Validate` requires a backdrop
  for every kind the topology produces, and `TestEveryPlayableRoomHasABackdrop` generates floors of every playable
  theme and checks each room resolves to existing 275x155 PNGs. A template or topology change that needs a
  background nobody painted fails CI.
- `npm run art:rooms:verify` (also run in CI) fails if any PNG, manifest, index or the Go registry is stale, missing
  or extra, if rendering is non-deterministic, if an image is flat, if views or kinds duplicate each other, or if the
  foreground floor in front of the enemies is busier than the rest of the frame.
- The frontend (`frontend/src/scenes/`) draws `<RoomBackdrop>` keyed by `themeId` and the same kind rule, falls back to
  the Catacombs image of that kind and then to a plain placeholder if an image fails to load. The room hue filters
  are removed; colour now comes from the theme. `App.tsx` only passes the backdrop reference and theme title.
  Until the lobby has a picker, `?theme=<id>` on the host page chooses the theme at start.

## Consequences

- Adding a playable theme is: a `FloorTemplate`, `Playable: true`, bosses and encounters from its sprites. Its
  backdrops already exist, and the tests tell you what is missing.
- The kind rule exists twice (Go and `scenes/backdrop.ts`). The Go test table is the spec; there is no frontend test
  runner yet to enforce the mirror.
- The `vault` backdrop is painted and registered but only reward rooms use it, and the shared topology has none.
- Enemy figures and the player's hands are still SVG drawn over the backdrop; thread A replaces the enemies with
  sprites. Backdrops leave the standing area and the foreground floor clear for them.
- Other-theme backdrops are palette and prop variants of shared layouts, not bespoke scenes, and are expected to be
  refined theme by theme as those themes get floor templates.
