# First Combat Room Prototype

## Purpose

Validate an immersive, game-first presentation for one solo combat encounter. The browser-only combat simulation remains intentionally small while we test the scene, HUD hierarchy, and interaction cost.

## Current interaction

- The dungeon scene is the primary view; persistent website navigation, page headings, sidebars, stats panels, and battle-history panel have been removed.
- Player health and round are compact overlays at the bottom of the scene.
- Enemy health, target selection, and telegraphed intent are presented in the scene. Players can select a target directly in the artwork or from its compact intent label.
- Three contextual moves live in one bottom action dock. Choosing a move resolves the round immediately; there is no separate select-then-resolve step.
- Recent combat feedback appears as one short status line rather than a scrolling combat log.
- The mobile layout keeps the scene dominant and turns the action dock into compact touch targets instead of stacking desktop panels.

## Art status

The scene is a hand-authored SVG pixel-art-style composition using crisp-edged sprite shapes, tiled stone textures, layered lighting, and atmospheric depth. It is still prototype artwork, not a finished production asset pack. The art direction should be validated before investing in a full set of environment and character sprites.

## Explicit limitations

- All state and combat resolution live in the browser; this is not server-authoritative.
- The encounter is a fixed scripted scenario, not a balanced combat system.
- Character and enemy sprites are still hand-authored placeholders; no production pixel-art asset pipeline or animation system exists yet.
- No navigation, multiplayer, reconnect, inventory, audio, or persistence is implemented.
- Google Fonts are loaded from the network; system fallbacks remain available if they cannot load.

## Validation questions

- Does the single scene feel like playing a game rather than operating a website?
- Can players understand enemy intent, health, and target selection without scanning separate panels?
- Are the three moves discoverable and comfortable to use on a narrow phone?
- Does the pixel-art-style treatment feel closer to the intended art direction, and what needs to change before commissioning/creating production assets?
