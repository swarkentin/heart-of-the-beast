# Multi-level procedural dungeon spike

Status: playable spike under iteration in PR #39. The initial implementation exists; playtest follow-ups below must be addressed and revalidated before the spike is considered ready to merge.

## Problem

The current run is one authored Forgotten Catacombs graph. Defeating the Crypt Warden sets the run to `completed`, so there is no descent, no next level, and no difficulty curve across levels. The roadmap targets 20–40 minute sessions; the initial multi-floor experiment targets 3–5 minutes per floor. One short dungeon cannot deliver a satisfying run arc.

## Spike question

Can we produce a replayable 20–40 minute run from several seeded, randomly assembled dungeon levels while keeping exploration readable, encounters fair in solo and co-op, and the authoritative run state straightforward to persist and reconnect?

The spike should answer that question with a small playable implementation, not build a general-purpose dungeon editor or an unlimited procedural content framework.

## Proposed experiment

- A run contains **three dungeon levels** initially. Target roughly **3–5 minutes per level**, for a 9–15 minute three-floor dungeon core. A later safe-hub intermission and optional exploration/reward choices can extend the complete session toward the 20–40 minute product target.
- Each level is a connected graph of approximately **6–9 rooms**: an entrance, a guaranteed main route, a small number of optional branches, at least one non-combat room, and a descent/exit room. The final level ends in a boss room.
- Generate each level from a small set of authored room/encounter/event templates. Randomness chooses and connects content; it does not invent arbitrary mechanics or prose.
- Keep the current forward-facing room navigation and party voting. The graph is shared by players and spectators; no client-side generation.
- A descent is a safe transition between levels: preserve player health, class/build, talents, run flags, and acquired run rewards. Clear transient combat/vote state, resolve an inter-floor choice, then generate the next level.
- Between each pair of floors, offer a clear party-shared choice: restore a meaningful amount of health **or** gain a run perk. The choice is server-authoritative, time-boxed for co-op, immediate for solo, and applied once. Perks should be small, legible, and useful across multiple builds; the recovery option must remain relevant when the party is battered.
- Seed occasional miniboss encounters into eligible rooms or optional branches. They should be rare enough to remain surprising, have a distinct readable mechanic, and offer a reward worth the added risk. Do not put one on every floor or make them mandatory for floor completion.
- Make the soundtrack evolve as the party descends. Each depth should add or transform musical material (for example: percussion, bass, harmony, melody, distortion, or a recurring motif) while retaining a recognizable musical identity. Use authored stems/variants and deterministic depth/encounter cues rather than generating arbitrary music. Floor transitions and miniboss/boss states are natural points for musical changes; music should not restart abruptly on every room transition.
- The run completes only after the final level's boss is defeated. Party defeat still ends the run immediately.
- Use a server-generated run seed and deterministic generation from `(run seed, level depth)`. Persist the seed and generated graph in the run aggregate so reconnects, retries, and spectators see the exact same dungeon. Never regenerate a level during snapshot/poll handling.

## Difficulty progression

Depth should change encounter pressure, composition, atmosphere, and musical intensity—not just multiply enemy health.

- Early level: teach the floor's enemy family and introduce one readable threat at a time.
- Middle level: combine complementary enemy behaviors, add more multi-enemy encounters, and offer meaningful optional risk/reward branches.
- Final level: use the strongest combinations and a boss with at least one mechanic that asks the party to respond to telegraphs or an interrupt window.
- Minibosses: use a seeded encounter budget/chance with guardrails on frequency and placement. A miniboss should remix known enemy behaviors around one signature mechanic, telegraph that mechanic clearly, and pay out a perk, treasure, or other meaningful reward. Avoid stacking a miniboss with an already exceptional encounter.
- Inter-floor choices: make the health-versus-perk decision a deliberate pacing beat. The choice should reflect current run state without forcing a single mathematically dominant option; perks should be sidegrades or modest synergies rather than mandatory power spikes.
- Music arc: establish a recognizable theme on the first floor, then increase tension and complexity with depth. Use layered stems or authored floor variants so intensity can rise/fall with gameplay state (exploration, combat, miniboss, boss) without becoming noisy or fatiguing. Keep music and gameplay cues synchronized through authoritative state/events, while actual audio playback remains client-side.
- Scale by active party size as well as depth. Solo must reduce simultaneous pressure or provide alternate counterplay; do not simply apply a large health multiplier for larger parties.
- Keep player health and run-long rewards between levels. The health-restoration-versus-perk choice is the baseline inter-floor decision; other rewards should come from optional exploration, minibosses, and special encounters rather than stacking free rewards at every boundary.
- Difficulty tuning should be expressed as an encounter budget/director policy with tests, not scattered `if depth > N` adjustments throughout combat code.

## Other run-variety beats

Keep the first experiment selective so floors still fit the 3–5 minute target. Use a small rotating set of authored room events to make exploration and optional branches feel different:

- **Shrines:** accept a trade-off such as health for a temporary blessing, a curse for a stronger perk, or a resource sacrifice for a party benefit.
- **Treasure rooms:** offer a reward behind a small combat or navigation risk; avoid making every branch a guaranteed upgrade.
- **Merchants or caches:** provide a limited, understandable way to spend run resources or exchange one kind of advantage for another. These can be represented as simple room events before building a full shop system.
- **Shortcuts and risky routes:** let the party choose between a safer longer path and a more dangerous route with a better reward or earlier descent.
- **Rescue and side objectives:** use compact optional objectives with a clear consequence, such as freeing a prisoner who provides a perk, supplies, or information.

These are content templates, not a requirement to place every event type on every floor. The generator should choose a restrained mix, guarantee a viable main route, and avoid chaining too many decision rooms together. Every optional branch should communicate its risk/reward before the party commits where practical.

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
- Add persisted, server-authoritative state for pending/resolved inter-floor choices and acquired run perks; make resolution idempotent.
- Add stable music progression cues to floor/run state or derive them deterministically from depth and encounter state, so reconnecting clients converge on the same soundtrack phase.
- Model miniboss eligibility/selection as part of seeded encounter generation, with explicit frequency and placement constraints.
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
- Inter-floor health-versus-perk choice is offered after each non-final floor, resolves correctly for solo/co-op, persists across reconnects, and cannot be claimed twice.
- Seeded miniboss placement is reproducible, bounded in frequency, never blocks the main path, and its encounter/reward can be completed in solo and co-op.
- Music progression cues advance with depth and encounter state, survive reconnect/snapshot handling, and support a recognizable escalation without forcing a full track restart at each room.
- Reconnect and spectator snapshots during and after a floor transition show the same depth, graph, current room, and encounter state.
- Playtesting confirms the generated floors still feel authored enough to navigate and that a level generally fits the 3–5 minute target.

## Explicitly out of scope

- Infinite or unbounded dungeon runs.
- Procedural art, arbitrary room geometry, or a visual dungeon editor.
- A large library of enemy families, bosses, traps, puzzles, or themes.
- Persistent character/meta progression changes.
- Village/hub intermissions between every level (keep the boundary safe and model-ready, but validate the dungeon descent first).
- A large perk catalog or complex perk synergies; validate a small set of readable run perks first.
- Fully dynamic procedural music composition; use authored stems/variants and state-driven layering.
- Replacing the existing directional navigation and party voting UX with a map-first interface.

## Playtest feedback and follow-up iteration

Initial hands-on feedback confirms that the overall multi-floor structure, evolving musical direction, and end-of-floor recovery-versus-perk decision are promising. The current implementation is not yet balanced or tactically deep enough to merge as a validated gameplay loop.

### Observations

- Floors currently take **less than one minute**, well below the 3–5 minute target. The likely contributors are under-tuned health/damage relationships and encounter pacing; do not solve this by simply inflating enemy health.
- Characters level up too quickly early in a run. Early XP thresholds and/or encounter XP rewards need to be retuned so the first level-up feels earned.
- The final recovery-versus-perk decision was compelling when party health was low. Preserve this decision beat, but strengthen the costs and consequences around the available options.
- Most random encounters and perks currently provide upside with little meaningful risk. Actions feel too safe and rewards too uniformly beneficial.
- The music progression is working directionally. Add a restrained percussive layer that complements the existing progression and increases with depth/encounter intensity rather than replacing the musical identity.
- Encounters do not yet ask for enough tactical thought. Players need meaningful target priorities and responses to enemy behavior, not only stronger attacks or larger enemy health pools.

### First tuning slice: early XP pacing

The first implementation slice reduces the early level-up cadence without changing combat damage or enemy durability before we have better encounter telemetry:

| Reward | XP |
|---|---:|
| Regular encounter | 18 |
| Boss encounter | 30 |

Cumulative level thresholds are now 60 / 150 / 275 / 425 XP for levels 2–5. This means a new character needs four regular encounters for the first level rather than one, and subsequent levels require progressively more of the run. These are provisional tuning values, not a final progression curve; validate them against full-run length, optional encounters, and the actual rate of level-up choices.

### Follow-up iteration, in priority order

1. **Combat and progression balance**
   - Tune player health, enemy health, damage, guard/mitigation, healing, and encounter rewards together.
   - Instrument or record actual floor duration, damage taken, remaining health, healing used, and level-up timing during playtests.
   - Slow early XP/level progression; make the first level-up a meaningful milestone.
   - Tune solo, duo, and four-player pressure independently. Party size must change encounter composition and simultaneous threat, not only enemy health.
   - Add enough meaningful encounters, route choices, and event beats to approach 3–5 minutes without padding rooms or making enemies damage sponges.

2. **Tactical encounter design**
   - Establish distinct enemy roles such as high-priority threats, protectors/supports, disruptors, and durable bruisers.
   - Compose encounters from complementary roles so target priority matters.
   - Add clear telegraphs and response windows for dangerous actions, with counterplay through target selection, guard, interrupts, or class abilities.
   - Validate that solo players have viable counterplay and that co-op adds coordination choices rather than mandatory role requirements.

3. **Risk/reward and meaningful costs**
   - Preserve the successful end-of-floor choice, but make healing and power choices carry meaningful opportunity costs. Possible costs include temporary maximum-health loss, a curse/debuff, resource sacrifice, or accepting a harder subsequent encounter; test options rather than committing to all of them.
   - Make shrines, random events, optional minibosses, treasure, and perks offer explicit, legible trade-offs. A strong boon may come with a drawback; optional rewards should carry a visible risk.
   - Avoid making every event a guaranteed upgrade. Include choices to decline, pay a cost, or accept a dangerous consequence.
   - Ensure choices are situational rather than having one mathematically dominant answer in every run.

4. **Music layering**
   - Preserve the current musical progression and add subtle percussion that complements the existing synthesized material.
   - Let rhythmic density/intensity increase with depth and encounter state, with stronger accents for minibosses/bosses.
   - Keep percussion restrained during exploration and avoid abrupt restarts or a genre shift.

### Validation goals

- Typical floors approach **3–5 minutes** in both solo and co-op playtests, with duration coming from meaningful gameplay rather than inflated enemy health.
- Early level-ups are less frequent and feel earned; XP pacing remains satisfying over a full run.
- Players regularly take meaningful damage and must consider healing, defense, target priority, and whether optional risks are worth taking.
- At least some rewards/events create a real downside or opportunity cost, and players can explain why they chose one option over another.
- Enemy combinations create distinct tactical priorities, and telegraphed threats have understandable counterplay.
- The existing music identity remains recognizable while percussion adds a subtle sense of depth and momentum.

## Update: generation is now theme-aware

The generator no longer hard-codes Catacombs content. Floors come from a per-theme `FloorTemplate` over the same topology, Catacombs output is unchanged (golden-tested), and Sci-Fi is the second playable theme. Runs and rooms carry `themeId`; legacy runs default to Catacombs. See ADR 0025.

## Decision after the spike

Keep the generator only if the tests and playtest show that it creates meaningfully different, completable floors without making room content generic. If it does, promote the generator, encounter director, and floor transition into the Phase 3 procedural-dungeon work; otherwise retain authored floor graphs and use the spike's difficulty/progression findings to guide them.
