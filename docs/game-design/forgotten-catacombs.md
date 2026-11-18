# The Forgotten Catacombs

Status: first authored adventure prototype. Room order, encounter values, and rewards are provisional and must be playtested.

## Adventure promise

The party descends through a drowned archive to confront the Crypt Warden. The route should feel like a journey with discoveries and decisions, not a chain of identical combat rooms.

A typical path visits seven rooms: an opening fight, one of two approaches, an exploration discovery, a larger encounter, a reward decision, a gate encounter, and a boss. Taking the optional rescue detour makes it eight. The graph has nine room nodes because both approach routes are authored.

## Room graph

```text
                         ┌─ Silent Reliquary ─┐
Watcher's Hall ──────────┤                    ├─ Archive of Names ─ Bone Gallery
                         └─ Drowned Crossing ┘                         │
                                                          ┌────────────┴────────────┐
                                                          │                         │
                                                   Prisoner's Cell ────────┐        │
                                                          │                │        │
                                                          └──── Reliquary Vault ◄───┘
                                                                   │
                                                             Warden's Gate
                                                                   │
                                                             Warden's Sanctum
```

## Rooms and gameplay

### 1. The Watcher's Hall — opening encounter

A Restless Sentinel guards the first chamber. This is intentionally a short introduction to target selection and the enemy intent display. It should not be the difficulty benchmark for the rest of the run.

### 2A. The Silent Reliquary — dangerous route

A Reliquary Guardian and Drowned Scout attack together. The Guardian threatens a heavy hit while the Scout adds a quick jab. Players can focus fire to remove one intent or defend the announced target. Clearing the room grants a sigil that adds 1 Strike damage for the rest of the run.

### 2B. The Drowned Crossing — alternate route

A single Drowned Scout waits on a half-submerged causeway. This is the lower-pressure route into the archive. A waterlogged cache restores up to 8 health to each living party member. The routes converge at the Archive of Names.

### 3. The Archive of Names — discovery

The party finds a fading inscription describing the Warden's binding. Choose to study it or move on. Studying it records the Warden's weakness and adds 2 damage to every party member's Strike against the Warden. This is the first example of exploration changing a later fight.

### 4. The Gallery of Bones — formation encounter

A Bonebound Guardian and Crypt Skirmisher defend the route. This is the second multi-enemy formation, with more health than the opening rooms. The exits create a choice between a rescue detour and a direct route to treasure.

### 5. The Prisoner's Cell — optional side mission

A wounded archivist is trapped under a collapsing arch. Freeing them completes the optional rescue and restores 10 health to each living party member (up to their maximum). Leaving them behind saves the detour but forfeits recovery. The archivist's deeper impact on the Warden fight is intentionally a future increment.

### 6. The Reliquary Vault — run reward

Choose one relic for the whole party:
- **Emberheart:** Strike deals 3 additional damage for the rest of the run.
- **Stoneward:** Defend blocks 4 additional damage for the rest of the run.

The choice changes combat values immediately and is visible in the action hints. The party cannot take both.

### 7. The Warden's Gate — final guard encounter

A Gatekeeper and Gravebound Sentry stand between the party and the sanctum. This is the last regular encounter and a check that the party's route and relic choice matter.

### 8. The Warden's Sanctum — boss finale

The Crypt Warden is the run's payoff. Its current implementation retains the Soul Drain interrupt and party-wide Soul Sweep. The first adventure should evolve this into a phase-based boss that reacts to the inscription and rescue, summons lesser enemies, and creates a visible exposed window after the party answers a mechanic.

## Server-authoritative event rules

- An event room blocks navigation until one available choice is submitted.
- A living, non-departed party member may submit the choice.
- The server validates the choice, resolves it once, records the result, and applies its effect to the run/party.
- Room choices and rewards are part of the persisted run aggregate, so player and spectator snapshots see the same outcome.
- Solo and co-op use the same choices; no event requires two people to act simultaneously.
- Multi-option room decisions open a 15-second party vote. Every living, non-departed player may vote or change their vote; the most-voted option wins, with a server-random tie-break. If nobody votes, the server chooses randomly so the run cannot stall. Solo choices resolve immediately.

## Playtest goals

1. Does the route feel like a descent through a place with a history?
2. Is the difference between the Reliquary and Crossing routes understandable?
3. Does studying the inscription make the party feel clever later?
4. Is the rescue detour worth the time and risk?
5. Does choosing Emberheart versus Stoneward produce a noticeable build difference?
6. Does the party reach the boss with enough health and meaningful choices left?
7. Does the run feel like an adventure rather than a set of combat clicks?
8. Is the full run long enough to feel satisfying without dragging?

## Deliberately not solved yet

- Procedural generation or multiple dungeon layouts.
- Distinct, finished art for every room.
- Full inventory/equipment management.
- Persistent character progression.
- The village intermission and safe checkpoint join flow.
- A fully phased boss with consequences from discoveries and side missions.
- Combat balance across all party sizes.

These should be built after the authored run is engaging to play end-to-end.
