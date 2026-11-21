# 0036: Less to read on screen, and props in vaults and camps

Status: accepted

## Context

Players found the game had too much to read. A dungeon opened with a briefing of four columns of bullet text. In a fight, every skill button repeated a line of its rules, the party card carried a paragraph about the class passive, and choices, the shop and the dungeon vote listed every modifier's full rule. Vaults were a near-empty room with one chest in the art.

## Decision

**Show the gist; keep the details one hover, focus or tap away.**

- **Dungeon briefing.** It shows one narrator line, the boss's name, the floor modifiers as name chips (with the rule on hover or focus), the expedition road and the start button. The rest of the story, the threats, the boss advice and the full modifier rules sit under a DETAILS toggle.
- **Skill buttons.** They show the name only, plus a status line when it matters: a cooldown, an interrupt opening, picking an ally, or Defend's block amount. Enemy skills no longer repeat the target, which the target selector already shows. The full rules stay in the hover line and the tooltip.
- **Party card.** The class passive moved into the tooltip on the class name.
- **Choices** (vault, discovery, boons, shop, dungeon vote). A description shows one line and expands on hover or focus. Modifiers are chips everywhere.
- **Camp copy.** The explanatory sentences for boons and the dungeon vote were cut.

**Props in the scene.** `scenes/ScenePropsLayer.tsx` draws small pixel-art sprites over the backdrop:

- a vault: open and closed chests, heaps of gold, an urn and a glowing gem on a pedestal;
- every camp: a campfire;
- the camp shop: a vendor behind a stall with potions.

The sprites are character grids drawn as crisp rects, at about the backdrop's pixel size. They stay at the sides and front so they never cover the enemies or the party in cast view. The theme art files are unchanged.

## Consequences

- A new player sees much less text before their first move. The information is still there for anyone who wants it.
- On touch screens, choice descriptions are one line unless the button has focus. Shop prices and names stay visible.
- New props are a sprite grid and a position. A theme can get its own variants later without new image files.
