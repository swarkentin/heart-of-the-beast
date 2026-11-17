---
name: hotb-theme-generation
description: Add a complete new Heart of the Beast dungeon theme (or capstone castle) - creatures, room backdrops, themed interface, music, server content, briefing, tests, balance and docs. Use when asked for a new theme, dungeon setting or castle.
---

# Heart of the Beast: theme generation

A theme touches the art pipeline, the server and the client. CI fails if any piece is missing: sprites without a
catalog, a playable theme without expedition content, backdrops, music, a briefing, or a boss without music.
Follow this checklist in order. The Noir City, 8-Bit Arcade, Eldritch Castle and Infernal Citadel commits (ADR 0033)
are a complete worked example; `git show` them when in doubt.

Pick a short lowercase **theme id** (`noir`, `arcade`). It is the key everywhere below.

## 1. Concept

Write these down first:

- **Basics:** name, tagline, a narrator voice and two briefing lines.
- **Look:** a palette of 4 swatches plus `bg`, `shadow`, `light` and `fxc`, and a material list. Pick one strong
  visual rule that makes the theme read at a glance, such as greys only, block-map sprites, or ember lighting from
  below.
- **Monsters:** five monsters, one per role (striker, protector, bruiser, disruptor, support), plus two trait
  monsters.
- **Bosses:** two floor guardians, a final boss with mechanics, and a lair boss with a trait and a mechanic.
- **Places:** two entries, six halls, three discoveries, a vault, an elite room and a guard room. Each has a name
  and one or two vivid sentences.
- **Originality:** every name and design must be original (see the monster skill).
- **Ordinary or capstone:** ordinary themes are `Playable: true`. A **capstone castle** is `Capstone: true` and
  only appears at the crossroads before every fifth dungeon (`capstone.go`). Castles use `ArmedGuardians`
  (mechanics on every floor boss), `capstone: true` monsters, and mostly three-monster encounters.

## 2. Art (`scripts/pixel-art`)

1. **Creatures:** `themes/<id>.mjs`, exporting `{ id, name, tagline, bg, shadow, light, fxc, palette, mats, creatures }`.
   Follow the `hotb-monster-generation` skill for each creature. Register the theme in `themes/index.mjs` (the
   import and the `THEMES` array).
2. **Room backdrops:** add an entry to `rooms/styles.mjs`.
   - `wall`, `floor` and `ceil` each take a texture pattern and three colours.
   - `fog`, `lamp`, `door`, `event`, `boss`, `vault`, `accent` and `dust` set the rest.
   - Patterns live in `rooms/painter.mjs`: block, checker, dirt, flag, grate, ice, organic, panel, pixel, plank,
     stripe and wave. Add a case there if none fits.
3. **Interface:** add an entry to `THEMES` in `theme-ui.mjs`.
   - Set `rim`, `trim`, `slate`, `panel` and `pit`, plus `wall` (one of the `WALLS` painters) and an optional
     `glow`.
   - Add a 32x32 wall painter to `WALLS` if needed.
4. **Preview, then build and verify:**
   ```sh
   node .claude/skills/hotb-monster-generation/preview.mjs <id> /tmp/<id>.png   # look at it
   npm run art:build && npm run art:rooms
   npm run art:verify && npm run art:rooms:verify
   npm run art:gallery && npm run art:rooms:gallery
   ```
   The build generates:
   - `backend/internal/art/sprites_gen.go` (`art.Theme<Id>` and `art.<Id><Creature>`) and `rooms_gen.go`;
   - `frontend/src/uiThemes.gen.ts`;
   - everything under `frontend/public/art/`;
   - the gallery images in `docs/art/`.

   Look at the generated backdrops too, for example `frontend/public/art/rooms/<id>/boss-first.png`.

## 3. Server (`backend/internal/game`)

1. **Catalog:** add a `DungeonThemeDefinition` to `dungeon_theme_catalog.go` with `Art: art.Theme<Id>` and
   `Playable: true`, plus `Capstone: true` for a castle.
2. **Monsters:** add entries to `newThemeMonsterContent` in `themes_new.go` (role templates through `roleMoves`).
3. **Encounters:** add entries to `newThemeEncounters`.
   - Ordinary themes need: an outpost (one monster), patrols, a vanguard, an ambush, two trait encounters, three
     boss encounters and a lair.
   - Castles mostly field three monsters.
4. **Expedition content:** add an `ExpeditionTheme` to `newExpeditionThemes`, or a function like
   `eldritchExpeditionTheme()` for a castle. It sets:
   - `Entries` (2), `Halls` (6), `Discoveries` (3), `Vault`, `Elite` and `Guard`;
   - the encounter pools `Light`, `Standard`, `Heavy` and `EliteID`;
   - the bosses: `Guardians` (or `ArmedGuardians`), `Final` (with `Mechanics` and their labels or monsters) and
     `Lair`;
   - `ClearedText`.

   Discovery options use the effect IDs in `expedition_content.go`: `blood_pact`, `vital_tithe`, `risky_draught`,
   `uneasy_rest`, `heavy_plate`, `glass_edge`, `greedy_haul`, `trapped_cache`, `cursed_boon`, `vault_coin`,
   `vault_relic` and `leave`.
5. **Briefing:** add a `themeBriefings` entry in `briefing.go` (narrator and two lines).
6. **Reinforcements:** add a `themeReinforcements` entry in `encounter_reinforcements.go` (two cheap monster IDs).
7. **Tests:** update the counts in `dungeon_theme_catalog_test.go` (sprite count, `PlayableDungeonThemes` or
   `CapstoneDungeonThemes`) and the ordered theme list in `internal/httpapi/themes_test.go`. Capstones are not
   listed there.

## 4. Client (`frontend/src`)

- **Music:**
  - add the id to `THEME_IDS` in `music/types.ts`;
  - add a `ThemeProfile` in `music/profiles.ts` (root, scale, bpm, voices, patterns, motif, bed, fx) with a
    `bosses` treatment for every boss, keyed by its art id, and add it to `PROFILES`;
  - add a theme entry in `music/sounds.ts` (pitch, cutoff and `extra` layers).
- **Effects and title:** add an element flavour in `fx/elements.ts`, and the display title in `THEME_TITLES` in
  `scenes/backdrop.ts`.
- **New mechanics:** if the theme brings new mechanics or traits, add tags in `run/traits.ts` and tests.
- The lobby picker reads the server's `/themes` endpoint, so a new playable theme appears there once the backend
  is rebuilt. Castles never appear there.

## 5. Check, balance, document

- `GOTOOLCHAIN=local go test ./internal/game/ ./internal/art/` (see the balance skill for building offline), then
  `npm run test:ui`, `npm run test:audio` and `node --test frontend/combatAbilities.test.mjs`.
- Balance with `hotb-balance-simulation`:
  - an ordinary theme must clear in the same band as the existing themes;
  - a castle should be cleared by roughly 40% of the tactical parties that reach it;
  - measure where parties die before you tune.
- Docs:
  - add a row to the roster table in `docs/art/README.md`;
  - write an ADR in `docs/decisions/` (design, rules, tuning numbers);
  - update `ROADMAP.md`, checking off the theme and adding open tuning items.
- PR: list the balance numbers, which checks ran locally, and which only CI could run.
