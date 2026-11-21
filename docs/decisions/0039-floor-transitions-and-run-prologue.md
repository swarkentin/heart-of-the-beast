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

**The prologue** (`RunPrologue.tsx`). Every new run opens on five short panels before the first briefing, drawn only from the game's own art: the lands as slices of their entrance backdrops; the Beast's pixel heart waking with veins spreading; the lands turning as four themes' bosses rise as its masters; a rift-gate opening onto the run's first theme with the party's own heroes before it; and the charge, with the title and the live shared heart (ADR 0040). Narration types out; tap completes a line, then moves on; panels auto-advance after 3.8 s; SKIP or Escape leaves at once. It is decided once per run, during render so the briefing cannot open first, and only while the party stands in the first room of the first dungeon before round 2, so a reconnect never replays it. It is marked seen per tab.

**The server pays for the time.** The first round of every new floor gets `FloorTransitionWindow` (3 s) and the first round of a run gets `RunPrologueWindow` (20 s), on top of the existing `DungeonBriefingWindow` (`briefing.go`). Rounds still resolve as soon as every player has acted, so a party that skips loses nothing either.

## Consequences

- Watching any of these never costs a turn. A solo player who skips the prologue just acts sooner.
- The story frame (the Beast, its masters, rift-gates, the heart) is now the reason runs move between themes; briefings, bosses and future content can lean on it.
- The prologue has no music cue of its own yet; it plays over the dungeon's music. A dedicated cue is a follow-up.
