# Multi-level procedural dungeon spike

Status: proposed spike. This is an experiment to validate the run structure and generation model before committing to a larger procedural-content system.

## Problem

The current run is one authored Forgotten Catacombs graph. Defeating the Crypt Warden sets the run to `completed`, so there is no descent, no next level, and no difficulty curve across levels. The roadmap already targets 20–40 minute runs and 5–8 minute dungeon levels; one short dungeon cannot deliver that loop.

## Spike question

Can we produce a replayable 20–40 minute run from several seeded, randomly assembled dungeon levels while keeping exploration readable, encounters fair in solo and co-op, and the authoritative run state straightforward to persist and reconnect?

The spike should answer that question with a small playable implementation, not build a general-purpose dungeon editor or an unlimited procedural content framework.

## Proposed experiment

- A run contains **three dungeon levels** initially. Target roughly 5–8 minutes per level, for a 15–24 minute dungeon core; a later safe-hub intermission can extend the full session toward the 20–40 minute target.
- Each level is a connected graph of approximately **6–9 rooms**: an entrance, a guaranteed main route, a small number of optional branches, at least one non-combat room, and a descent/exit room. The final level ends in a boss room.
- Generate each level from a small set of authored room/encounter/event templates. Randomness chooses and connects content; it does not invent arbitrary mechanics or prose.
- Keep the current forward-facing room navigation and party voting. The graph is shared by players and spectators; no client-side generation.
- A descent is a safe transition between levels: preserve player health, class/build, talents, run flags, and acquired run rewards. Clear transient combat/vote state and generate the next level.
- The run completes only after the final level's boss is defeated. Party defeat still ends the run immediately.
- Use a server-generated run seed and deterministic generation from `(run seed, level depth)`. Persist the seed and generated graph in the run aggregate so reconnects, retries, and spectators see the exact same dungeon. Never regenerate a level during snapshot/poll handling.

## Difficulty progression

Depth should change encounter pressure and composition, not just multiply enemy health.

- Early level: teach the floor's enemy family and introduce one readable threat at a time.
- Middle level: combine complementary enemy behaviors, add more multi-enemy encounters, and offer meaningful optional risk/reward branches.
- Final level: use the strongest combinations and a boss with at least one mechanic that asks the party to respond to telegraphs or an interrupt window.
- Scale by active party size as well as depth. Solo must reduce simultaneous pressure or provide alternate counterplay; do not simply apply a large health multiplier for larger parties.
- Keep player health and run-long rewards between levels. A level boundary may offer a modest recovery or reward choice, but should not erase the cost of earlier decisions.
- Difficulty tuning should be expressed as an encounter budget/director policy with tests, not scattered `if depth > N` adjustments throughout combat code.

## Generation constraints

1. **Reachability:** every generated room is reachable from the entrance; the descent is reachable and is the only way to advance.
2. **Guaranteed completion:** every generated floor has a valid main path to its exit; optional branches cannot soft-lock the run.
3. **Content shape:** required room roles are present (entrance, encounter(s), utility/event, exit; boss on final depth).
4. **No accidental dead ends:** only intentional optional branches may terminate without an exit, and they must have a reward or discovery.
5. **Stable identity:** room and exit IDs are unique within the run; generation uses stable IDs and ordering.
6. **Determinism:** identical seed, depth, party size, and generator version produce identical content.
7. **Bounded scope:** cap room count and branch count so level length remains within the target.
8. **Snapshot safety:** generated content is ordinary run aggregate data and survives JSON persistence/reconnect unchanged.

## Implementation shape to test

- Add run metadata for seed, generator/content version, and current depth (plus a maximum depth or explicit final-floor marker).
- Extract the current authored room definitions into reusable content templates rather than coupling generation to HTTP handlers or React.
- Add a pure Go generator that accepts an explicit seed, depth, party size, and content catalog and returns a validated room graph plus its start room.
- Add a floor-transition domain operation invoked when a descent/exit room is cleared. It must be idempotent under the existing aggregate mutation/persistence model and must not reset player state.
- Represent descent as an ordinary server-authoritative room transition/event so player and spectator snapshots remain consistent.
- Keep generated room names, descriptions, enemy definitions, and event choices data-driven. The frontend should render the returned room data, not infer dungeon structure from hard-coded room IDs.
- Preserve a compatibility path for already-running persisted runs that lack the new metadata; do not reinterpret an existing active run as a generated multi-floor run.

## Spike acceptance criteria

- Starting two runs with the same explicit test seed and party size produces identical floor graphs; different seeds produce meaningfully different layouts.
- Property/table-driven tests verify graph reachability, required room roles, unique IDs, bounded room counts, and a reachable exit across many seeds.
- A solo player can complete all three levels; a 2–4 player party can do the same using the existing vote and combat rules.
- Clearing a non-final boss/guardian opens the descent and creates the next floor without resetting health, talents, class/build, or run rewards.
- The final boss completes the run; a wipe on any floor fails it.
- Encounter budgets increase with depth and vary by party size, with tests showing that later floors introduce additional threat combinations/mechanics rather than relying only on larger HP values.
- Reconnect and spectator snapshots during and after a floor transition show the same depth, graph, current room, and encounter state.
- Playtesting confirms the generated floors still feel authored enough to navigate and that a level generally fits the 5–8 minute target.

## Explicitly out of scope

- Infinite or unbounded dungeon runs.
- Procedural art, arbitrary room geometry, or a visual dungeon editor.
- A large library of enemy families, bosses, traps, puzzles, or themes.
- Persistent character/meta progression changes.
- Village/hub intermissions between every level (keep the boundary safe and model-ready, but validate the dungeon descent first).
- Replacing the existing directional navigation and party voting UX with a map-first interface.

## Decision after the spike

Keep the generator only if the tests and playtest show that it creates meaningfully different, completable floors without making room content generic. If it does, promote the generator, encounter director, and floor transition into the Phase 3 procedural-dungeon work; otherwise retain authored floor graphs and use the spike's difficulty/progression findings to guide them.
