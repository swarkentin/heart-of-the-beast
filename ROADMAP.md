# Roadmap

This roadmap is a living plan, not a promise that every idea will ship. We prioritize a playable vertical slice and validate the experience before expanding systems.

## Product goals

- A complete run is enjoyable solo or with friends; multiplayer adds social possibilities rather than fixing a broken solo experience.
- Typical session target: 20–40 minutes. Dungeon levels target roughly 3–5 minutes.
- Illustrated, high-definition pixel-art scenes with directional exploration.
- Small parties, initially 1–4 players, with no mandatory class composition.
- No account or third-party service required to play. Optional Discord sign-in carries a profile across devices (ADR 0034); accounts may later support achievements and more.
- Spectator viewing is independent of participation: people can watch a run through a shared viewing link/QR code without joining the party or creating a character.
- Open-source and self-hostable, with Render and Neon as the initial prototype deployment.
 
## Next up — prioritized product work

These are the current priorities, not a promise that each item ships in strict isolation. Reorder as playtesting and implementation evidence changes. Priorities 2 and 3 are intentionally parallel, coupled workstreams: combat changes should be designed alongside the measurement and simulation improvements needed to evaluate them. Routine real-device testing, regression checks, and continuous QA are expected for every change and are not standalone roadmap milestones.

1. **Close the multiplayer usability gaps.**
   - [x] Make every multi-option room/event decision party-voted and server-authoritative, using a 15-second vote window, visible party choices/tallies, vote changes, random tie/no-vote fallback, and immediate solo resolution. This includes trade-off choices such as +1 Strike / -2 Guard; do not silently let one player decide for everyone.
   - [ ] Show each player's profile/display name consistently in the lobby and combat party UI, alongside their character/class identity, so everyone knows who is playing whom.
   - [ ] Support more than four people in a lobby: retain overflow members as waiting spectators who can watch the active dungeon without consuming a combat slot. Make active-player versus spectator/waiting status explicit and avoid affecting encounter scaling or votes.
   - [ ] Design and implement a safe, understandable transition for waiting lobby members to join at a future safe checkpoint when a slot becomes available.
   - [ ] Finish shareable party invitations (PR #87) and pre-adventure spectator links (PR #94); verify the complete host/guest/spectator journey.
   - [ ] After the current four-player experience is solid, design larger active parties. Do not simply raise the cap: revisit encounter composition, telegraph readability, action windows, UI density, and network/state scaling.

2. **Improve combat depth, encounter quality, and balance (in parallel with #3).**
   - [ ] Improve monster identity through distinct behaviours, target selection, support actions, interrupts, phases, environmental interactions, and complementary formations.
   - [ ] Make combat choices more consequential and readable; expand the tactical verbs gradually (consumables, aid/recovery, defensive interactions) without introducing MMO-style role requirements or resource-management sprawl.
   - [ ] Tune encounter pacing, monster durability/damage, player survivability, status effects, and reward cadence together. Prefer interesting mechanics over inflated health.
   - [ ] Playtest boss mechanics and floor guardians; ensure each major encounter teaches, tests, or remixes mechanics players can understand and counter.

3. **Build the balance-tuning workbench (in parallel with #2).**
   - [ ] Consolidate and document tunable parameters for monsters, abilities, classes, encounter budgets, party scaling, floors, modifiers, XP, rewards, and economy in versioned, data-driven configuration. Identify remaining hard-coded knobs and migrate them incrementally.
   - [ ] Make simulation reports explain the effective parameter set, scenario/episode seed, party composition, theme, policy, and outcome metrics; retain reproducible baselines and meaningful regression thresholds.
   - [ ] Add an episode-based optimization loop for LLM-assisted tuning: propose a small parameter diff, run representative seeded episodes (solo, duos, trios, four-player parties; themes and depth bands), compare against baseline and safety/quality guardrails, and summarize trade-offs.
   - [ ] Keep the loop deterministic, bounded, reproducible, and reviewable. LLMs may suggest changes and analyze results; they must not silently change balance or promote parameters without human review.
   - [ ] Include actual playtest feedback alongside simulation results; simulation policies are proxies, not substitutes for human play.

4. **Strengthen persistent progression and character identity.**
   - [x] Configure and launch production Discord authentication (PR #101, ADR 0034).
   - [ ] Verify the production guest-to-account journey, including conflict handling and cross-device profile access.
   - [ ] Add sign-out for Discord-linked devices, so a shared computer can return to a fresh guest profile.
   - [ ] Move best expedition distance/rank from browser-only storage to the server-side profile and show it in the Profile menu.
   - [ ] Continue tuning Adventurer Rank and class mastery pacing; expand mastery-based unlocks and cosmetics without talent trees, mandatory roles, or power-gated classes.
   - [ ] Keep lifetime character identity/records and permadeath as a separate, deliberate progression layer; define resurrection and retirement semantics before implementing the full character-life system.

5. **Expand cooperative formats and encounter spectacle.**
   - [ ] Design raid-style encounters for parties larger than the current four-player limit, with multiple simultaneous objectives, environmental interaction, boss phases, and mechanics that reward coordination without mandatory class roles.
   - [ ] Design a boss-rush mode: a focused sequence of escalating bosses, limited recovery/resources between fights, distinct modifiers, and clear score/progression rewards.
   - [ ] Prototype richer environmental interactions in boss arenas (hazards, switches, destructible/usable objects, positioning, arena phase changes) and make them meaningful to boss mechanics.
   - [ ] Treat raids and boss rushes as distinct modes with their own party-size, pacing, matchmaking/lobby, scaling, and reward rules—not merely longer standard expeditions.

6. **The Heart of the Beast: a shared objective (ADR 0040).** The most important motivation work right now.
   - [x] One shared, persistent heart health pool for every party on the server, banked once per fight; public `GET /beast`; a beating heart meter on the title screen and in the run prologue.
   - [ ] The heart encounter: rarely replaces a dungeon boss, unbeatable, round-limited with its own mechanics, then withdraws and records the party's damage. Needs a sprite, music treatment, rewards and balance (including a guard against one build dominating the pool).
   - [ ] An expensive shop item that forces the heart to appear in the next dungeon.
   - [ ] Decide what happens when the heart dies.
   - [ ] Optional: per-profile contribution ("your strikes") and a contributors board.

7. **Continue presentation and world-building polish.**
   - [x] Smooth transitions (ADR 0039): rooms dip in, floors descend down a stair over the viewport, new dungeons open through a rift-gate; the server gives each new floor's first round time for it.
   - [x] A prologue cutscene at the start of every run explaining the Beast, its masters, the rift-gates and the heart (ADR 0039).
   - [ ] A music cue for the prologue.
   - [ ] Improve combat readability and impact: character/enemy animation, attack anticipation, hit feedback, status presentation, and spectator cinematography.
   - [ ] Improve room-specific environmental props/layouts and interactions across themes; make the world feel less like repeated backdrops.
   - [ ] Continue audio, accessibility, localization, and UI polish. Maintain continuous real-device QA as part of normal delivery.

8. **Longer-term world and community work.**
   - [ ] Build a safe hub/intermission with NPCs, repair/resupply, ambience, and environmental storytelling when the core expedition loop is well tuned.
   - [ ] Complete self-hosting documentation, backup/restore, provider-neutral configuration, and release/contribution workflows after the product systems stabilize.



## Phase 0 — Foundation and discovery

- [x] Establish project overview and working agreements.
- [x] Agree on MVP game loop, solo/co-op rules, combat, and progression.
- [x] Record initial architecture, deployment, audio, presentation, and spectator-access decisions.
- [x] Establish GitHub Actions CI for pull requests and pushes to main: lockfile consistency, frontend type-check/build, Go formatting/vet/race-enabled tests/build, PostgreSQL-backed HTTP integration tests, and local development stack smoke test. CI generates the npm lockfile when needed and verifies it stays in sync once committed.
- [x] Bootstrap the frontend workspace, root-level local development commands, and baseline CI.
- [x] Select Go for the independently buildable authoritative backend (ADR 0009).
- [x] Add the initial Go service, health endpoint, container build, and independent backend CI.
- [x] Introduce the persisted room/session aggregate, local PostgreSQL workflow, and initial versioned migration.
- [x] Provide one-command local startup/shutdown, health status, and transactional versioned migration tooling (ADR 0011).
- [x] Make `npm run dev:up` observable and fail-fast: numbered progress with timings, preflight checks, separate backend build, live service log output, and immediate failure with log tails when a service exits (ADR 0011 amendment).
- [x] Add the Render Blueprint for the static frontend and Go API on Render, CI-gated auto-deploys, startup migrations, readiness checks, and graceful HTTP shutdown (ADR 0025).
- [x] Create the Neon project, configure its pooled DATABASE_URL secret in Render, and verify the production deployment at https://heart-of-the-beast.onrender.com. Render auto-deploys from `main`.
- [x] Define the room/run lifecycle and deterministic authoritative state transitions.
- [x] Establish responsive scene, character, enemy, and HUD presentation rules.
- [x] Choose first-person-inspired forward-facing player camera for exploration and combat; separate cinematic spectator renderer over shared game state.
- [x] Decide spectator access is independent of player participation, with a server-enforced read-only connection.
- [x] Check in Claude Code project skills (`.claude/skills/`) for repeatable work: balance simulation (`hotb-balance-simulation`), new themes (`hotb-theme-generation`) and new monsters or bosses (`hotb-monster-generation`, with a sprite preview script). Keep them current when the pipeline changes.

## Phase 1 — Playable multiplayer/solo vertical slice

- [x] Prototype one responsive combat room with one adventurer, two enemies, visible enemy intent, and immediate action resolution (PR #2).
- [x] Validate forward-facing player composition alongside a separate spectator/cast composition over the same encounter state.
- [x] Prototype directional room navigation through a small predefined room graph, with solo-immediate path choices, room-specific encounters, and matching spectator scene transitions (PRs #5 and #6).
- [x] Create a room and join a pre-run lobby by six-character invite code, with up to four guest players and host-controlled run start (PR #12).
- [ ] Finish the host-controlled spectator viewing link/QR flow so it works before the adventure starts as well as during a run (PR #94).
- [x] Add initial player-authenticated room creation, run start, validated command, reconnect snapshot, and separately authorized read-only spectator snapshot endpoints.
- [ ] Implement/verify server-authorized, read-only spectator subscriptions and reconnect/catch-up behavior.
- [ ] Ensure spectators cannot issue commands and do not affect party size, scaling, presence, votes, readiness, or deadlines.
- [x] Connect the player interface and independent spectator/cast presentation to the authoritative room API (PR #11; initial snapshot polling, with realtime subscriptions still pending).
- [x] Server-authoritative player presence (10-second heartbeat, 30-second disconnect threshold), same-identity reconnect, and explicit leave/token revocation (ADR 0014).
- [x] Illustrated room scenes and directional navigation.
- [ ] Readable character/enemy presentation with restrained, purposeful animation.
- [x] Generate a pixel-art bestiary for eleven themes (six priority plus alien jungle, dreamscape, arctic, ghost town, post-apocalyptic): 5 monsters and 3 bosses each, with idle, hit, attack, special, and death animations, plus manifests and a verifier (ADR 0022, `docs/art/README.md`).
- [x] Require art for every monster at compile time, add a dungeon theme catalog and themed encounters, and add catalog entries for the whole bestiary (82 new monsters, 72 new encounters; ADR 0023). Enemy snapshots now carry a `sprite` ID.
- [x] Replace the SVG monster art in the frontend with the pixel-art sprites: map server enemy definitions to sprite ids, play animations from combat events (telegraph, attack impact frame, hit, death), and honour reduced motion.
- [x] Generate player-character sprites for the nine classes in the bestiary style (idle loop and a signature flourish each, plus roster busts) and a pixel-art interface kit: panel, slot and button frames, wall and floor tiles, torch, crest, and an icon sheet (ADR 0024, `docs/art/README.md`).
- [x] Rebuild the title screen, party lobby, and class selection on the hero sprites and interface kit so the first screens match the monster art (ADR 0024).
- [x] Add hero status animations for the party portraits: hurt, injured, poisoned, and down rows on every hero sheet, plus layered status overlays (heal, guard, ward, buff, poison, sleep), status icons, and a viewport frame (ADR 0027, `docs/art/heroes.png`).
- [ ] Hand-polish pass on the generated monster and hero sprites; add attack animations for heroes if they ever act on stage in the spectator scene.
- [x] Server-authoritative party path voting with a 15-second window, majority resolution, random tie/no-vote fallback, and immediate solo choices (ADR 0017).
- [x] Establish server-authoritative simultaneous combat rounds: one action per living player, an 8-second co-op window, deadline fallback to defend, and immediate solo resolution (ADR 0015).
- [x] Add server-authoritative enemy intent telegraphs, targeted/party-wide attacks, guard mitigation, enemy turn resolution, combat feedback, and party defeat (ADR 0018).
- [x] Add a contextual interrupt counter for the Crypt Warden Soul Drain; see ADR 0018 and `docs/game-design/combat-roadmap.md`.
- [x] Implement complementary multi-enemy encounters and party-size composition scaling (see Phase 2 and ADR 0030).\n- [ ] Continue combat iteration per `docs/game-design/combat-roadmap.md`: improve monster behaviour, telegraphs, encounter variety and tactical engagement; then support and consumable actions.
- [x] Prototype opt-in Catacombs music, room ambience, event-driven gameplay effects, and independent master/music/effects controls (PR #20).
- [x] Replace the single-theme prototype with a data-driven, theme-aware procedural music system: a profile per dungeon theme, per-state layers scaled by depth, per-boss treatments, crossfades and per-theme effects (ADR 0026).
- [ ] Audition and tune the themed music by ear, and tune the mix on mobile, desktop, and spectator playback; consider authored assets later.
- [ ] End-to-end acceptance: one player can complete the dungeon; a group can complete it together; independent viewers can watch either without joining.
- Core screens are continuously checked across mobile, tablet, and desktop as part of normal QA; real-device testing is not a standalone roadmap milestone.
- [x] Rebuild the run screen (exploring and combat) on the interface kit: party portraits on the borders, a framed viewport, a combat log, and one command panel for actions, path votes, room choices, descent votes, and run over. Actions press in and lock, show keys 1-9, and automatic defends are announced, logged, and marked on the portrait. Works from one to four players and for spectators, and fits one screen without scrolling on phones (ADR 0027).
- [x] Replace the static first-person hands with arms that stay out of sight and rise only to act: a winding strike with a swing smear and screen shake, a spell gathered and cast from the palm, a braced guard, a snap block. Animations scale with skill rank (ADR 0034).
- [x] Run skill ranks: one skill point per run level-up, spent on a skill of the bar for small stat steps (rank I-V) and a more brilliant animation (ADR 0034).
- [x] Keep enemy names and health bars clear of the intent chips: the intents ride over the floor at the bottom of the scene, never resizing it (#138, ADR 0034).
- [x] Interrupt feedback: interruptible moves are marked on the enemy and its intent chip, the skill bar glows when an interrupt is ready and pressing it targets the interruptible enemy, and a successful interrupt (or a blunted one) shows floating text.
- [ ] Run-screen follow-ups: self-host or draw the pixel fonts, restyle the sound settings sliders.
- [ ] Balance pass after skill ranks (ADR 0034): solo Assassin, Spellguard and Juggernaut rarely pass the first castle; strong solo classes and parties that do pass it often run to the simulation depth limit, so add a difficulty curve beyond dungeon 5; add a second simulated skill-point policy (focus one damage skill) to bracket human play.
- [ ] First-person follow-ups: hand-drawn swing frames for the heaviest weapons, a per-skill signature effect at rank V, a hurt flinch, and a spectator-view equivalent of ranked skill animations. Check the intent chips on very short landscape phones.

## Phase 2 — Core roguelike loop

- [ ] Expand health and combat stats, add recovery/consumables, and introduce readable status effects. The portraits already show guard, ward, resolve, and charge from the combat state, and poison art exists (ADR 0027), but no rule applies poison or other timed conditions yet.
- [ ] Define and implement a server-authoritative in-run resurrection action with explicit timing, health, and end-of-run permanent-death rules.
- [x] Add the extensible class catalog, stable IDs, nine initial class definitions, unique starting stats/equipment, server-authoritative class selection, and run build snapshots (PR #35).
- [x] Implement registered server-authoritative signature ability and passive handlers for all nine classes, with solo/co-op combat tests (PR #38; first-pass balance values).
- [x] Selection experience: compact roster grouped by archetype with a focused class detail view, an animated hero, icon-led skills and passives, stats and gear, and mastery progression context. Available and locked classes are shown distinctly, and the chosen hero joins the party line-up (ADR 0024).
- [x] Add class signature actions and target/mode controls to the player combat UI; preserve universal actions and one action per round.
- [x] Use class mastery as the long-term class progression/unlock model. Do not build talent trees or MMO-style character progression; remove remaining talent-tree UI, terminology, assumptions, and code paths.
- [ ] Add mastery-based class/content unlocks only where they add meaningful goals; keep launch classes available and ensure unlocks grant content access, not combat power.
- [ ] Snapshot class/build definition versions in active runs and test compatibility across reconnects and content updates.
- [ ] First implementation should keep classes as build directions, not mandatory roles; every class must remain viable solo and duplicate classes must remain viable in parties.
- [ ] Expand run rewards selectively with meaningful gear, items, abilities, and combat consumables; avoid an MMO-style inventory/progression treadmill.
- [ ] Build choices that let solo players cover their own needs without mandatory roles.
- [x] Build complementary multi-enemy formations and tune encounter composition for solo, duo, and four-player parties without relying on health inflation. Larger parties meet theme reinforcements (up to six enemies a fight) instead of tougher enemies; see ADR 0030 and `docs/game-design/encounter-scaling-and-tuning.md`.
- [ ] Solo Bulwark balance follow-up: a solo Bulwark clears themed first floors only 47–72% of the time under the tactical simulation policy (other solo classes reach 85–100%), because its Strike needs two hits for most themed monsters and Shield Wall only blocks one hit. Decide between class changes (damage, Shield Wall, passive) and solo-specific content before tuning.
- [ ] Duo balance follow-up: two-player parties built around a support or an Arcanist (Arcanist + Cleric, Arcanist + Beastcaller, Ranger + Cleric) clear the whole first dungeon 93–95% of the time in simulation, even with Renewal on its three-round cooldown, while other duos reach about 45–60%. Find the cause (two-player reinforcement schedule, support kits, or Arcanist damage) before tuning.
- [ ] Shop tiers (ADR 0038): confirm with the endless matrix that tactical fifth-dungeon clears stay near main (63%) now that guard and maximum health no longer have finer versions. If they still run strong, look at the Herb Bundle and the Scroll of Practice next.
- [x] Extract monster/ability/modifier/encounter definitions into a versioned content catalog and build a deterministic simulation harness using the live combat rules. See `docs/game-design/monster-content-and-simulation-spike.md`.\n- [ ] Make balance inputs easy to inspect and tune: consolidate gameplay knobs into explicit, versioned configuration/content data with documented ranges and ownership; minimize scattered magic numbers and expose effective values in simulation reports.\n- [ ] Build repeatable episode-based balance workflows that let an LLM propose parameter changes, run seeded solo/party episodes across representative compositions and themes, compare against baseline metrics/guardrails, and produce reviewable diffs. Keep all changes human-reviewed; simulations are evidence, not automatic authority.
  - [x] Move authored monster names, base health, behavior mappings, and existing depth/party/solo health scaling into catalog-backed enemy definitions.
  - [x] Extract reusable encounter compositions, party-size variants, and provisional relative difficulty budgets into a validated encounter catalog.
  - [ ] Complete modifier/effect extraction: mastery-unlocked combat modifiers (if any), room-event run effects, class passive effects, typed signature-ability operation definitions, and typed encounter/floor reward definitions are catalog-backed. Signature ability operations and reward operations remain applied by authoritative runtime transitions until the pure transition extraction.
  - [x] Isolate deterministic combat transitions and add the first seeded simulation scenarios/reports.
  - [x] Extract pure, shared health damage/healing arithmetic and route live combat, class abilities/passives, and run rewards through it; preserve caller-owned target eligibility and combat feedback.
  - [x] Extract pure attack damage, interrupt damage, incoming mitigation, and deterministic enemy-intent resolution into shared transitions used by live combat.
  - [x] Extract pure XP/level progression transitions before building the simulation runner; live reward application uses the shared result and retains caller-owned event ordering.
  - [x] Add explicit combat snapshots, deterministic attack/defend/interrupt baseline policies, repeatable seeded runs, batch execution, and median/tail distribution summaries.
  - [x] Apply existing talent combat modifiers and class passive triggers in the seeded simulator, including attack/interrupt bonuses, mitigation, reflection, Resolve, companion recovery, and encounter healing.
  - [x] Execute registered class signature abilities through the same authoritative handlers in seeded simulations, with deterministic situational policies and ability-use reporting.
  - [x] Run a fixed solo/co-op balance suite in GitHub Actions, record successful main-branch reports as baselines, compare pull requests for meaningful drift, and publish evidence-based investigation prompts.
  - [x] Simulate complete seeded multi-floor runs by making random legal combat, route, event, and inter-floor decisions through authoritative game commands; report completion/wipe rates and the probability of reaching each depth for solo and 1–4 player parties.
  - [x] Compare random and tactical player-decision policies across a seeded endless-expedition composition matrix; report median/P10/P90 depth and survival probability at every reached depth (all solos, all duos, sampled trios/quads).
  - [ ] Extend run simulation coverage as consumables and new combat mechanics become playable; add live-transition parity fixtures before using full-run reports for balance tuning.
- [ ] Reward, monster, combat, and difficulty curves validated through ongoing solo and co-op playtesting.
- [ ] Spike multi-level runs: generate several connected dungeon floors from a run seed; carry party state and run rewards between floors; add a health-restoration-versus-perk choice between floors, occasional seeded minibosses with meaningful rewards, and a soundtrack that evolves with depth and encounter intensity; scale encounter pressure with depth and party size. Target 3–5 minutes per level. See `docs/game-design/multi-level-dungeon-spike.md` for scope and validation criteria.
- [ ] Iterate on the playable multi-level run spike before merging it: rebalance health/damage and encounter pacing to reach the 3–5 minute floor target without relying on enemy HP inflation; tune temporary run-level XP, damage/guard growth and depth-based monster scaling; tune healing and party-size scaling; add tactical enemy roles, complementary formations, and clearly telegraphed actions; introduce real risk/reward trade-offs for shrines, healing, perks, optional encounters, and treasure; add subtle depth-sensitive percussion to the existing musical progression. Validate solo and co-op with recorded floor duration, player damage/health changes, level-up timing, and choice outcomes. See the playtest follow-up section in `docs/game-design/multi-level-dungeon-spike.md`.

### Persistent player progression and personalization

- [x] Add durable, accountless guest-profile identity, separate from room membership and run player tokens; retain an opaque guest credential in browser storage and keep authoritative profile state on the server (PR: guest profile foundation).
- [x] Add profile-wide Adventurer Rank and an independent class-mastery XP/level track for every class. Mastery persists across character retirement and class switching.
- [x] Award profile and active-class XP server-side for cleared encounters and completed expeditions, including partial progress on unsuccessful runs; make every run award idempotent.
- [ ] Tune profile and class-mastery XP pacing against simulation and playtest results.
- [x] Add a persistent, non-expiring reward track with data-driven profile-rank and class-mastery milestones. Initial titles and badges remain available until earned and do not grant gameplay power.
- [x] Add an initial data-driven title/badge catalog and show recent unlocks in the profile collection.
- [ ] Add cosmetic equip controls and further rewards such as class skins, portraits, flourishes, interface themes, music selections, and visual effects.
- [ ] Keep all nine launch classes available. Future class unlocks may use explicit profile milestones, achievements, quests, or class mastery, but grant content access only.
- [x] Surface profile rank, class mastery, and earned rewards through the shared Profile menu on the title screen, party lobby, and combat screen; show each class's mastery during class selection.
- [x] Add profile collection and recent-unlock views to the shared Profile menu.
- [x] Add a safe guest-to-account linking path: optional Sign in with Discord links the browser's guest profile, or switches the device to the account's profile; profiles are never merged, and a device with its own progress asks first (ADR 0034).
- [x] Register the production Discord application with the `/auth/discord/callback` redirect and configure `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` and `DISCORD_REDIRECT_URI` on the Render API service (ADR 0034).
- [ ] Add sign-out for Discord-linked devices, so a shared computer can return to a fresh guest profile.
- [ ] Keep individual character levels, generated names, lifetime records, and permadeath separate from profile rank and class mastery.
- [ ] Add persistent guest-character creation and selection, with a memorable identity flow and lifetime record visible from the lobby.
- [ ] Track each character's life story: dungeons entered, completed, escaped, deaths, revivals, bosses defeated, discoveries, and other notable milestones.
- [ ] Preserve memorial records for retired characters and their accomplishments; do not silently reset or overwrite a guest's lifetime history when creating a successor.
- [ ] Unlock expressive character personalization such as name customization without granting combat stats, stronger equipment, or gameplay advantages.
- [ ] Make progression grants fair to eligible party members and award meaningful effort without rewarding repeated polling, duplicate commands, or trivial-action farming.

Progression scope, guest identity, reward integrity, and implementation sequence: see [ADR 0028](decisions/0028-player-progression-and-class-mastery.md). Character identity, lifetime records, and permadeath rules: see `docs/game-design/guest-character-life.md`.

## Phase 3 — Procedural dungeons and replayability

- [x] Show an expedition map between dungeons: the current group of four dungeons, the castle that crowns it, what has been cleared and where the party is (ADR 0033).
- [ ] Add an optional, party-shared floor map that reveals rooms and connections as they are discovered, marks the party's current room, and distinguishes unexplored, visited, and cleared areas. Keep in-scene directional exits as the primary way to move; the map is for orientation and reviewing discovered routes. The camp between dungeons is the first place to show it, next to the expedition map.
- [ ] Data-driven room graph and encounter director, informed by the multi-level generation spike.
- [ ] Traps, secrets, treasure rooms, merchants, puzzles, and alternate routes.
- [ ] Reusable optional side-mission framework.
- [ ] Tune and expand distinct enemy families and bosses with engaging, legible mechanics—not just larger health pools. Improve monster behaviour, combat pacing, telegraphs, counters, and encounter combinations.
- [x] Per-theme floor templates (Catacombs byte-identical) and a playable Sci-Fi theme; `themeId` on runs and rooms; optional theme at run start (ADR 0025)
- [ ] Simulate and tune the stats, abilities, behaviours and encounter budgets of the 82 art-backed monsters; add a dedicated miniboss sprite. (All eleven themes are now playable; see ADR 0029.)
- [x] Dungeon expeditions (ADR 0029): an endless chain of dungeons, each exactly four generated floors in one of eleven themes; floors 1–3 use the standard generator and floor 4 is a finale with an 85% chance of an optional bonus room before its mandatory, mechanically armed dungeon boss; a two-option theme vote with per-dungeon modifiers after every dungeon boss; camps (mini-game and shop) only at a dungeon's midpoint and between dungeons; floor debuffs and perks that grow with depth; discovery and vault rooms whose choices are trade-offs or gambles; a rank and personal best for how far the party got; lobby dungeon picker.
- [x] Capstone castles (ADR 0033): every fifth dungeon, the party chooses between the Eldritch Castle and the Infernal Citadel. A castle has four floors, tougher three-monster fights, and an armed boss on every floor. Four new boss mechanics (anchor, rebirth, legion, devour). Every castle boss offers each adventurer a choice of three run-long boons. Tuned so about 40% of tactical parties that reach a castle clear it.
- [x] Show the expedition map in every dungeon's briefing, and mark a ready interrupt skill when an enemy telegraphs an interruptible move (ADR 0033).
- [ ] Rule-changing floor debuffs, so debuffs change how a fight plays rather than a number: hidden telegraphs, nothing can be interrupted, enemies hitting harder the longer a fight lasts, enemies that burst when they die, enemy regeneration, no recovery after fights, longer cooldowns (with perks opposing some of them). A prototype with all seven in the roll pool lowered the tactical median depth for four-player parties from 17.5 to 9 floors, so it was set aside. Bring them back one at a time, measure each with the balance tools, and probably soften the numbers or roll at most one rule debuff per floor.
- [ ] Tune castles and boons by play: the midpoint guardian (especially the Choir of Mouths) ends most castle runs, and boon strength is untested. Teach the tactical simulation policy to choose boons.
- [ ] Check with more seeds whether adding themes lowered how often parties reach dungeon 5 (ADR 0033), or whether it is crossroads reshuffling.
- [x] Feed expedition distance into persistent progression (ADR 0028): profile and class-mastery XP now come from fights won, floors cleared and dungeons conquered across the whole expedition.
- [ ] Keep each profile's best expedition distance and rank on the server and show them in the Profile menu (today the personal best is browser-only).
- [ ] Tune the expedition by play: modifier strength, boss thresholds, floor length against the 3–5 minute target, and the difficulty of floors 4–6. Give floor guardians (not only dungeon bosses) a mechanic each. Initial Strike and gold curves are now capped and documented in `docs/game-design/expedition-economy-and-strike-scaling.md`.
- [ ] Grow the camp: co-operative or head-to-head mini-games, consumables that are used as combat actions, and theme-flavoured modifiers, shopkeepers and camp backdrops.

## Phase 4 — Open-world intermissions

- [ ] Safe hub between dungeon levels.
- [ ] Repair, upgrade, and resupply activities beyond the camp rest and shop of ADR 0029.
- [ ] NPCs, ambience, music, and environmental storytelling.
- [ ] Safe join checkpoint and party ready-up flow.

## Phase 5 — Content and presentation

- [x] Noir City (greyscale) and the 8-Bit Arcade (block-map sprites) as ordinary themes, with full art, backdrops, interface, music and content (ADR 0033).
- [ ] Additional themes (fantasy and stranger combinations).
- [x] Pixel-art room backdrops (first-person and cinematic; entry, corridor, event, boss, vault) for all eleven themes, registered in Go so a missing background fails CI (ADR 0025)
- [ ] Bespoke props and layouts per theme beyond Catacombs and Sci-Fi. (Lobby theme picker and content for all themes shipped with ADR 0029.)
- [ ] More enemy families, bosses, side missions, items, and abilities.
- [ ] Cinematic spectator camera movement, animation, audio, accessibility, and localization polish.
- [ ] Content authoring conventions and validation tools.

## Phase 6 — Optional accounts

- [x] Guest-to-account identity linking that preserves profile rank, class mastery, and unlocks (Discord, ADR 0034). Character records will follow the profile when they exist.
- [x] Cross-device profiles: every device signed in with the same Discord account uses the same server-side profile (ADR 0034).
- [ ] Consider further sign-in providers (for example Google, or Sign in with Apple for a native iOS app) using the same identity model.
- [ ] Achievements and run history, alongside the cosmetic unlock catalog introduced earlier.
- [ ] Optional account benefits remain cosmetic and identity-focused; no pay-to-win progression.
- [ ] Data export and deletion.

## Phase 7 — Self-hosting and community

- [ ] One-command container deployment.
- [ ] Provider-neutral configuration and PostgreSQL compatibility.
- [ ] Deployment guides for multiple hosting providers.
- [ ] Backup/restore, health checks, contribution guide, and release process.

## Initial content candidate: The Forgotten Catacombs

A provisional first dungeon: 8–12 connected rooms, 3–4 enemy types, one optional side mission, one treasure room, one boss, and a peaceful village intermission. The Crypt Warden is a sample boss concept with guard-breaking, soul-drain interruption, minion summons, and an enrage phase. Validate scope and fun before committing to all content.

## Design backlog

### Themes

Classic fantasy crypts and forests; sci-fi research facilities; 1930s mobster underworld; black-and-white noir city (shipped); 8-bit arcade (shipped); eldritch and infernal capstone castles (shipped); sunken kingdoms; clockwork empires; haunted carnivals; ghost towns; alien jungles; dreamscapes; arctic stations; post-apocalyptic settlements. Theme collisions can create surprising encounters and loot.

### Side-mission seeds

Rescue a prisoner; chase a key-stealing rat; escort an NPC; recover a missing courier; defend a mechanic; catch a mimic; disable an alarm; reunite a lost creature with its parent; identify an impostor; retrieve a ghost's letter; protect musicians; sabotage a rival shipment; choose which trapped group to rescue. Missions should be short, optional, and built from reusable objectives, timers, characters, rewards, and consequences.

## Cross-cutting design rules

- Server-authoritative state and deterministic game rules.
- No decision or disconnected player can stall the run indefinitely.
- Time-boxed group choices have explicit resolution and fallback rules; a solo choice is immediate.
- New players join at safe checkpoints; players may leave at any time.
- Spectators are not players: they use a separately authorized read-only viewing connection and never affect gameplay or party accounting.
- Solo and co-op are both tested as core supported modes, not one as an afterthought.
- Avoid rigid MMO roles. Archetypes are build directions, not required party slots.
- Keep the scene readable at phone, tablet, and desktop sizes; animation should communicate state and personality without competing with navigation, combat information, or player controls.
- Audio should support atmosphere and communicate gameplay events, with user control over music and effects volume.
- Prefer small focused PRs; keep main releasable; never merge without explicit approval.
