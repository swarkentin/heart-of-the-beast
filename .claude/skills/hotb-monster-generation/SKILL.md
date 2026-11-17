---
name: hotb-monster-generation
description: Add or redesign a Heart of the Beast monster or boss end to end - procedural pixel-art sprite, server stats and moves, traits or boss mechanics, encounters, music treatment, tests. Use when asked for new monsters, bosses, lair bosses or trait monsters in an existing theme.
---

# Heart of the Beast: monster generation

A monster exists in three places that must agree: the **sprite** (generated pixel art), the **server definition**
(stats, moves, traits, mechanics) and the **encounters** that field it. Bosses also need a **music treatment**.
CI fails if any of them is missing: `art.Sprites()` must match the catalog, every monster must appear in an
encounter, and every boss needs a music treatment.

For a whole new theme, use the `hotb-theme-generation` skill; it calls this one for the creatures.

## 1. Design first

Decide, for each creature:

- **Role.** Monsters: `striker`, `protector`, `bruiser`, `disruptor`, `support`. Trait monsters use `fuse`,
  `warder`, `splits` or `bodyguard`. Bosses: `boss-drain`, `boss-slam` or `boss-relentless` (dungeon bosses),
  `lair` (optional lair boss). These are the templates in `roleMoves` (`backend/internal/game/themes_new.go`).
- **Two move names**, an attack and a special, in the theme's voice ("Pistol whip", "Snub-nose shot"). The server
  ability **Label** must equal the art's `attackName`/`specialName`. The client matches the telegraphed label to
  choose the attack or special animation (`frontend/src/monsters/moves.ts`).
- **Trait** (optional, `monster_traits.go`): `fuse`, `warder`, `splits`, `bodyguard`, `phasing`, `regenerate`,
  `spiked`, `avenger`. Usual values are in `theme_variety.go` (`VarietyFuseTurns`, `VarietyLairHealth`...).
- **Boss mechanics** (dungeon and lair bosses, `boss_mechanics.go` and `capstone.go`): `summon`, `barrier`,
  `cataclysm` (enrage is added to final bosses automatically), and the capstone-only `anchor`, `rebirth`,
  `legion`, `devour`. Each needs its label or monster ID on the `FinalBossTemplate`.
- **Originality.** Every design must be original. No character, enemy, mascot or logo from a game, film or tabletop
  setting, and no names lifted from one (no beholders, gibbering mouthers, goombas, space invaders, Pac-Man ghosts).
  If a design reads as a known creature, change the silhouette until it doesn't.

## 2. Draw the sprite

Creatures live in `scripts/pixel-art/themes/<theme>.mjs` as entries of `creatures`:

```js
{
  id: "fedora_thug", name: "Fedora Thug", role: "Street muscle; ...",   // id is snake_case
  attack: "slash", special: "shoot",            // pose kinds (anim.mjs)
  death: "topple",                               // crumble (default) | dissolve | explode | melt | topple
  attackName: "Pistol whip", specialName: "Snub-nose shot",   // must equal the server labels
  fx: { attack: ["slash", "burst"], special: ["muzzle"] },   // fx.mjs: slash burst ring claw stream puffs shock muzzle rise orb
  tier: "boss",                                  // bosses only: 128px cell, drawn at s = 2
  draw: (c, p, s) => biped(c, p, { ... }),
}
```

- **Pose kinds** (`anim.mjs`): slash, smash, lunge, claw, shoot, spit, slam, cast, roar, summon, guard, wail, vent,
  spin, channel, brace.
- **Rigs** (`kit.mjs`): `biped` (legs or a robe, torso, head, two hands), `floater` (hovering body, arms, face),
  `crawler` (legged body with a head), `blob` (mass with a face), plus `tentacle`, `mass`, `ragged`, and the parts
  in `heads`, `torsos`, `hands` and `parts.mjs` (`eyeball`, `fangs`, `wing`, `hat`, `spike`, `paw`...). Read an
  existing theme first; `themes/wasteland.mjs`, `noir.mjs` and `eldritch.mjs` cover most rigs.
- **Block-map sprites:** `themes/arcade.mjs` has `sprite8`, which draws creatures from coarse block maps. Copy it
  for a deliberately low-resolution look.
- **A custom `draw`** must return the anchors the effects use:
  `{ s, cx, floor, top, chest, hL, hR, mouth, head, vent }`.
- **Animation.** Use `p` (bob, wave, jaw, glow, lean, reach, crouch, aLx/aLy/aRx/aRy...) so idle visibly moves and
  attacks swing. A static idle fails verification.
- **Materials.** Colour only with the theme's `mats`; `{ color, emissive: true, pulse: true }` makes a glow.
- **Preview** before the full build:
  ```sh
  node .claude/skills/hotb-monster-generation/preview.mjs <themeId> /tmp/<themeId>.png
  ```
  Then look at the PNG. Check the silhouette, that it reads at 64px, that the attack and special frames differ,
  and that the auto-scale is not tiny (bosses that sprawl get shrunk; keep wide limbs in check).
- **Build and verify:** `npm run art:build`, `npm run art:verify`, `npm run art:gallery`.
  - `art:build` regenerates `backend/internal/art/sprites_gen.go` (Go names such as `art.NoirFedoraThug`),
    `frontend/public/art/monsters/` and the interface files.
  - `art:verify` requires 5 or more monsters and 1 to 4 bosses per theme. "Touches the frame edge" warnings are
    normal.

## 3. Define it on the server

- **Stats and moves.** Add an entry to `newThemeMonsterContent` in `backend/internal/game/themes_new.go`. That
  table works for any theme:
  ```go
  {sprite: art.NoirFedoraThug, id: "fedora-thug", name: "Fedora Thug", role: "striker", attack: "Pistol whip", special: "Snub-nose shot"},
  ```
  Use `traits:` for a trait monster, `healthOverride:` for lairs (`VarietyLairHealth`,
  `VarietyPhasingLairHealth`), and `capstone: true` for castle monsters (+2 health; +1 damage for castle bosses).
  - Server IDs are kebab-case; art IDs are snake_case.
  - Older themes define monsters longhand in `monster_catalog_themes.go` and `theme_variety.go`. Follow the file
    the theme already uses.
  - If a role template doesn't fit, write the abilities by hand (`AbilityDefinition`: Kind, Damage, Heal,
    TargetAll, Interruptible, EveryTurns, TurnRemainder, ExceptEveryTurns) with the same rhythm conventions.
- **Encounters.** Add entries to `newThemeEncounters` in the same file, or `encounters_themes.go` for older themes.
  Every monster must appear in at least one. Budget costs: 2 for most monsters, 3 for protectors and bodyguards,
  4 for bruisers, 8 for bosses.
  - Avoid stacking a warder with a bruiser in a heavy fight; ADR 0032 found that too hard.
  - Boss encounter IDs are `<theme>-boss-<monster-id>`; the lair is `<theme>-lair`.
- **Placement.** Put the encounter in the theme's `ExpeditionTheme` pools (`Light`, `Standard`, `Heavy`,
  `EliteID`), or make it a `Guardians`, `ArmedGuardians`, `Final` or `Lair` boss with its mechanics. Validation
  rejects mechanics without their label or monster, and summons from another theme.
- **Briefing.** New boss mechanics need a line in `bossAdvice` (`briefing.go`), or in `capstoneAdvice` for castle
  mechanics.
- **Reinforcements.** `encounter_reinforcements.go` lists two cheap monsters per theme for big parties.

## 4. Client touches

- **Music.** Every boss needs a treatment in its theme's profile, keyed by the **art** creature id:
  `frontend/src/music/profiles.ts`, `bosses: { fedora_thug: { tempoMul, transpose, scale?, lead?, fill?, extraFx?, note } }`.
  `npm run test:audio` checks it.
- **Tags.** New mechanics or traits need a tag in `frontend/src/run/traits.ts` (label, rule and tone) and a test in
  `run/run.test.ts`.

## 5. Tests, balance, docs

- Update the bestiary count in `dungeon_theme_catalog_test.go` (`len(art.Sprites())`).
- Run `GOTOOLCHAIN=local go test ./internal/game/ ./internal/art/`, `npm run test:ui` and `npm run test:audio`.
- Balance with the `hotb-balance-simulation` skill: the theme against a reference band, and the endless matrix if
  the monster lands in many fights.
- Add the creature to the roster table in `docs/art/README.md`, regenerate the gallery (`npm run art:gallery`), and
  record notable design or tuning choices in the theme's ADR and `ROADMAP.md`.
