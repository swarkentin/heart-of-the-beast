# Pixel-art bestiary

Front-facing pixel-art monster sprite sheets for the first-person dungeon view, one folder per theme under
`frontend/public/art/monsters/`. Every theme has 5 monsters and 3 bosses. Every creature has `idle`, `hit`,
`attack`, `special` and `death` animations.

![Bestiary overview](bestiary.png)

## Roster

| Theme ID | Theme | Monsters | Bosses |
| --- | --- | --- | --- |
| `catacombs` | Forgotten Catacombs | Restless Sentinel, Drowned Scout, Bonebound Guardian, Hooded Wraith, Gravebound Sentry | Crypt Warden, Ossuary Colossus, The Pale Archivist |
| `scifi` | Sci-Fi Research Facility | Sentry Crab, Security Bot, Mutated Subject, Vat Specimen, Sentry Drone | Containment Unit-9, The Overseer, Patient Zero |
| `mobster` | 1930s Mobster Underworld | Goon Gunner, Trenchcoat Hitman, Spectral Enforcer, Syndicate Bruiser, Velvet Viper | The Don, Spectral Kingpin, The Black Sedan |
| `sunken` | Sunken Kingdom | Drowned Knight, Reef Lurker, Ghost Jelly, Tide Brute, Drowned Siren | The Drowned King, Abyssal Angler, Ancient Guardian |
| `clockwork` | Clockwork Empire | Windup Scamp, Gilded Dancer, Cogwork Spider, Brass Assassin, Boiler Brute | Brass Colossus, The Clockmaker, Leviathan Boiler |
| `carnival` | Haunted Carnival | Jester Cutthroat, Carousel Specter, Balloon Horror, Cotton-Candy Ooze, Midway Strongman | The Ringmaster, The Laughing Big Top, Harlequin Horror |
| `jungle` | Alien Jungle | Lumen Stalker, Spore Bloom, Thorn Walker, Lantern Moth, Razor Mantis | Heartroot Titan, Mother Lantern, The Apex Maw |
| `dreamscape` | Dreamscapes | Wandering Eye, Chatterhead, Palm Crawler, Hourless Slug, Stilt Walker | Sovereign of Sleep, The Hungry Grin, The Hollow Child |
| `arctic` | Arctic Station | Frostbitten Researcher, Husk Hound, Ice Wraith, Ice-Saw Drone, Rimefur Brute | Glacier Titan, The Thing in the Ice, Cryo Warden |
| `ghosttown` | Ghost Town | Revenant Gunslinger, Tumbleweed Haunt, Cursed Prospector, Carrion Vulture, Phantom Coyote | The Undertaker, Sheriff of the Damned, The Hanging Tree |
| `wasteland` | Post-Apocalyptic Settlement | Scrap Raider, Rust Hound, Jury-Rigged Flamer, Rad-Roach, Bloated Brute | Warlord's War-Rig, Fallout Behemoth, The Scrap-Heap King |

## Files

```
frontend/public/art/monsters/
  index.json                 # all themes, frame columns, animation order
  <theme>/manifest.json      # palette, creatures, per-animation timing
  <theme>/<creature>.png     # sprite sheet (RGBA, transparent background)
  <theme>/preview.png        # contact sheet for quick review
```

Served by Vite at `/art/monsters/...`.

## Sprite sheet layout

One row per animation, in this order, six columns per row (unused cells are transparent):

| Row | Animation | Frames | FPS | Loops | Notes |
| --- | --- | --- | --- | --- | --- |
| 0 | `idle` | 4 | 6 | yes | Subtle breathing/hover; the resting state in a formation |
| 1 | `hit` | 2 | 12 | no | White flash plus recoil when damaged |
| 2 | `attack` | 6 | 10 | no | Telegraph, strike, recovery. `impactFrame` is 3: apply the hit effect on that frame |
| 3 | `special` | 6 | 10 | no | The creature's signature move (stance, wail, summon, cast). `impactFrame` is 3 |
| 4 | `death` | 6 | 8 | no | Ends on its last frame (`hold: true`); the final frame is rubble, nothing, or a faded remnant |

Monsters use 64x64 frames (sheet 384x320). Bosses use 128x128 frames (sheet 768x640). All creatures anchor at
bottom-centre: `anchor` in the manifest is the floor contact point (`x = size/2`, `y = size-3`). Draw sprites
with `image-rendering: pixelated` and scale by whole integers.

Each creature entry in the manifest also carries `name`, `tier` (`monster` or `boss`), `role`, `attack` and
`special` (display names for telegraphs), and the `move` and `style` hints used to pick matching effects.

## Using a sprite

```ts
const m = await (await fetch("/art/monsters/sunken/manifest.json")).json();
const c = m.creatures.find((x) => x.id === "drowned_knight");
const a = c.animations.attack;                 // { row, frames, fps, loop, impactFrame }
// frame i of animation a is at: x = i * c.frame.w, y = a.row * c.frame.h
```

## Design rules

- Front-facing, centred, readable silhouettes, because the party views enemies head-on in first person.
- Consistent pixel density: bosses are drawn at 2x the monster canvas, not at a coarser pixel size.
- Per-theme palette, with emissive eyes and cores for readability in dark rooms.
- Telegraph and response: `attack` and `special` wind up visibly before the impact frame, matching ADR 0018.
- Reduced motion: hold `idle` frame 0 and skip to the `impactFrame` pose; do not rely on animation alone for state.

## Regenerating

The art is produced deterministically by code in `scripts/pixel-art/` (no external tools or network needed).
Creature definitions live in `scripts/pixel-art/themes/<theme>.mjs`.

```
npm run art:build     # regenerate every sheet, manifest, index and preview
npm run art:verify    # fail if art is stale, a frame is empty or clipped, or a roster rule is broken
npm run art:gallery   # regenerate docs/art/bestiary.png
```

`art:verify` enforces: unique creature ids, at least 5 monsters and 1-3 bosses per theme, sheets byte-identical
to a fresh render, correct dimensions, no empty frames, no clipping of idle/hit frames, and an idle loop that
actually animates. Oversized creatures are automatically scaled down (same pixel density) until their idle and
hit frames fit their cell. Run `art:build` and commit the output after changing any theme file.

## Backend registry

`npm run art:build` also writes `backend/internal/art/sprites_gen.go`, the Go registry of every theme and sprite. Backend content must reference art through
its exported variables (`art.SunkenDrownedKnight`); the ids cannot be forged or misspelled, so a monster that needs art which does not exist fails to
compile. Monsters are declared with `defineMonster(sprite, MonsterDefinition{...})`. See ADR 0023. Commit `sprites_gen.go` together with the art.
Enemy snapshots carry the sprite as `sprite: "<theme>/<creature>"`, which maps to `/art/monsters/<theme>/<creature>.png`.

