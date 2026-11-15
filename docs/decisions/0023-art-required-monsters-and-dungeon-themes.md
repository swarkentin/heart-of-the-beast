# ADR 0023: Every monster requires art; dungeon themes are catalog content

- Status: Accepted
- Date: 2026-11-15

## Context

ADR 0022 produced a pixel-art bestiary (88 creatures across eleven themes), but the authoritative monster and
encounter catalogs knew nothing about it. Monsters were free-standing definitions, art could be missing or
misnamed without anyone noticing until a client rendered a placeholder, and only the original Forgotten
Catacombs roster existed as game content. We want content errors of this kind to be impossible to ship, and
we want a catalog entry for every monster we have art for.

## Decision

**Art is a compile-time requirement of a monster definition.**

- `scripts/pixel-art/build.mjs` also generates `backend/internal/art/sprites_gen.go`: one exported variable per
  theme (`art.ThemeSunken`) and per creature (`art.SunkenDrownedKnight`), plus a registry of sheet paths and frame sizes.
- `art.SpriteID` and `art.ThemeID` have an unexported field, so no other package can construct or forge one.
  The only way to name art is to reference a generated variable.
- Monsters are declared with `defineMonster(sprite, MonsterDefinition{...})`, where the sprite is a required
  parameter. Omitting it, misspelling it, or referencing a sprite the pipeline never built is a compile error
  (verified: "not enough arguments", "undefined: art.X", "implicit assignment to unexported field").
- The remaining gap is a `MonsterDefinition` built without `defineMonster`, which leaves the zero sprite.
  `MonsterCatalog.Validate` rejects it, and so does a test run in CI.
- Tests also check, against the files on disk, that the generated registry lists exactly the themes and sprites in
  the manifests, that each sheet is a valid PNG of the expected size, and that every sprite is used by at least one
  monster. Adding art without a monster, or a monster without art, fails CI.
- Boss-role monsters must use a boss-tier (128 px) sprite.

**Dungeon themes are catalog content.**

- `DungeonThemeCatalog` defines the eleven themes, each backed by the art theme of the same ID.
  `EncounterDefinition` gains a `ThemeID`. Validation requires that an encounter only spawns monsters whose art is from its
  theme, that each theme has a boss monster and a boss encounter, and that every monster of a non-Catacombs theme
  appears in an encounter.
- Only Forgotten Catacombs is `Playable` (used by the floor generator); the other themes exist as catalog content
  until they get room graphs.

**Catalog entries for the whole bestiary.**

- The original Catacombs monsters map onto the Catacombs art (several definitions share a sprite, for example every
  Drowned Scout variant). Two new Catacombs monsters, the Hooded Wraith and the Pale Archivist, use art that existed
  without a monster. 80 monsters for the other ten themes (5 monsters and 3 bosses each) are new definitions in
  `monster_catalog_themes.go`, each with an attack and a special ability whose labels come from the art manifest.
- Authored encounters for the new themes live in `encounters_themes.go`: outpost, patrol, ambush, vanguard, and
  one encounter per boss, at most two enemies each (what the scene layout can place).

**Clients learn the art from the enemy snapshot.** `Enemy` gains an optional `sprite` ("<theme>/<creature>"). Runs
persisted before this change lack it and must fall back to a placeholder.

## Consequences

- Stats and ability numbers for the new monsters are provisional role templates (documented in
  `monster_catalog_themes.go`) that mirror the Catacombs monsters. They have not been simulated or playtested.
  Encounter budgets use provisional per-role costs. Do not treat any of it as balanced.
- Ability kinds for new monsters (`bolt`, `wail`, `sweep`, `cloud`, `drain`, `special_strike`) are descriptive tags
  only; combat resolves damage, healing, targeting and interruption from the ability's fields. Class passives that
  key on `soul_drain` and `soul_sweep` do not apply to them. Revisit when a typed status/effect model exists.
- The miniboss ("Reliquary Brute") currently reuses the Bonebound Guardian sprite, and the Ossuary Champion uses
  the Ossuary Colossus. A dedicated miniboss sprite is a follow-up.
- Regenerating art changes `sprites_gen.go`; commit both. Hand-edited art keeps working as long as sprite IDs and
  sheet layout are preserved.
- Not done: floor generation for non-Catacombs themes, frontend rendering of the sprites, server-side selection of a
  theme per run, and balance via the simulator.
