# 0039: Floor transitions, rift-gates and a run prologue

Status: accepted

## Context

Moving from room to room is quick, but every change of place was a hard cut: the backdrop swapped in one frame. Between floors that cut was jarring, because the whole room, its enemies and the floor number changed at once while the server had already started the next floor's first round. Runs also started cold: nothing told a new party what it was fighting or why it travels from theme to theme, so the game had no story to hold on to.

## Decision

**Three transitions, one per kind of move** (`frontend/src/run/transitions.ts`, pure and tested):

- **Room** (a doorway on the same floor): the scene comes up out of the dark with a slight push-in in five stepped frames, 320 ms (`Scene.tsx`). Short enough that rooms still feel quick.
- **Floor** (the way down within a dungeon): `FloorDescent` covers the viewport only, so the party and log stay put. Eight stone steps rise up over the room one after another, as if the party were walking down a stair; the floor card ("FLOOR 02 OF 04", or "THE LAST FLOOR" naming the boss) holds between two torches with one line of mood; the steps carry on upward and uncover the new floor. 2.6 s, tap to skip; a 1.2 s fade under reduced motion. Number keys are ignored while it plays.
- **Dungeon** (a new land): the briefing's iris wipe now opens a stepped, spinning **rift-gate** ring, so every new theme is entered through a portal. This is the story's device for going from theme to theme.

Nothing plays on the first look at a run (a fresh mount or a reconnect): the client compares where the party is with where it last saw it.

**The prologue** (`RunPrologue.tsx`, scenes in `prologueArt.tsx` and `prologue.css`). Every new run opens on five short panels before the first briefing, built from the game's own art (room backdrops, boss sheets, the party's own heroes) and pixel shapes in the same palette. Each panel has an animation of its own, stepped like the rest of the game's motion:

1. **The lands**: under a dusk sky with stars and a moon, five lands' entrances rise into view one by one, then each lights its own lantern with a flicker, and fireflies drift up.
2. **The Beast wakes**: the ground under the lands shakes, red cracks run down through the rock, and the heart rises out of the deep, every beat sending out a shockwave while dust falls.
3. **Its masters**: the lands drain of colour as rot climbs them in tendrils, lightning splits the sky, and four lands' bosses rise glowing red.
4. **The rift-gates**: a portal tears open onto the run's first land, light fans out, motes spiral into it, and the party's heroes walk up to it out of the dark.
5. **The charge**: veins spread from the heart, every beat sends out a shockwave and embers rise, under the title and the live shared heart (ADR 0040). Narration types out; tap completes a line, then moves on; each panel holds for 4.2 s after its line has finished (6.5 s under reduced motion) before moving on; SKIP or Escape leaves at once. It is decided once per run, during render so the briefing cannot open first, and only while the party stands in the first room of the first dungeon before round 2, so a reconnect never replays it. It is marked seen per tab.

**The round waits for the screens.** The round behind any of these is *held*: its countdown does not start until every player's screen is ready. A client sends `combat_ready` (a beat after its prologue, briefing or descent has closed); choosing an action also counts. When every player who can act is ready, the round's `startedAt` moves to now and it gets a full `CombatActionWindow`. Until then the timer shows full and still, with "GET READY". So nobody is caught off guard, and a solo player's countdown starts the moment their own screen is clear. The hold has a cap, so one idle player cannot stall the party: `FloorTransitionWindow` (3 s) for a new floor, `DungeonBriefingWindow` (25 s, longer than the briefing's 22 s auto-close) for a new dungeon, and `RunPrologueWindow` (50 s) on top of that at the start of a run (`briefing.go`). (The first version only lengthened the round's deadline, so the countdown visibly ran while the prologue and briefing were still on screen.)

## Consequences

- Watching any of these never costs a turn. A solo player who skips the prologue just acts sooner.
- The story frame (the Beast, its masters, rift-gates, the heart) is now the reason runs move between themes; briefings, bosses and future content can lean on it.
- The prologue has no music cue of its own yet; it plays over the dungeon's music. A dedicated cue is a follow-up.
