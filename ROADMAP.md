# Roadmap

This roadmap is a living plan, not a promise that every idea will ship. We prioritize a playable vertical slice and validate the experience before expanding systems.

## Product goals

- A complete run is enjoyable solo or with friends; multiplayer adds social possibilities rather than fixing a broken solo experience.
- Typical session target: 20–40 minutes. Dungeon levels target roughly 3–5 minutes.
- Illustrated, high-definition pixel-art scenes with directional exploration.
- Small parties, initially 1–4 players, with no mandatory class composition.
- No account or third-party service required to play. Optional accounts may later support identity, achievements, and cosmetics.
- Spectator viewing is independent of participation: people can watch a run through a shared viewing link/QR code without joining the party or creating a character.
- Open-source and self-hostable, with Render and Neon as the initial prototype deployment.

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
- [x] Add the Render Blueprint for the static frontend and Go API on free compute, CI-gated auto-deploys, startup migrations, readiness checks, and graceful HTTP shutdown (ADR 0025).
- [ ] Create the Neon project, configure its pooled DATABASE_URL secret in Render, and verify the first production deploy.
- [x] Define the room/run lifecycle and deterministic authoritative state transitions.
- [x] Establish responsive scene, character, enemy, and HUD presentation rules.
- [x] Choose first-person-inspired forward-facing player camera for exploration and combat; separate cinematic spectator renderer over shared game state.
- [x] Decide spectator access is independent of player participation, with a server-enforced read-only connection.

## Phase 1 — Playable multiplayer/solo vertical slice

- [x] Prototype one responsive combat room with one adventurer, two enemies, visible enemy intent, and immediate action resolution (PR #2).
- [x] Validate forward-facing player composition alongside a separate spectator/cast composition over the same encounter state.
- [x] Prototype directional room navigation through a small predefined room graph, with solo-immediate path choices, room-specific encounters, and matching spectator scene transitions (PRs #5 and #6).
- [x] Create a room and join a pre-run lobby by six-character invite code, with up to four guest players and host-controlled run start (PR #12).
- [ ] Provide a separate, host-controlled spectator viewing link/QR code that does not consume a player slot or require party membership.
- [x] Add initial player-authenticated room creation, run start, validated command, reconnect snapshot, and separately authorized read-only spectator snapshot endpoints.
- [ ] Implement server-authorized, read-only spectator subscriptions and reconnect/catch-up behavior.
- [ ] Ensure spectators cannot issue commands and do not affect party size, scaling, presence, votes, readiness, or deadlines.
- [x] Connect the player interface and independent spectator/cast presentation to the authoritative room API (PR #11; initial snapshot polling, with realtime subscriptions still pending).
- [x] Server-authoritative player presence (10-second heartbeat, 30-second disconnect threshold), same-identity reconnect, and explicit leave/token revocation (ADR 0014).
- [ ] Illustrated room scenes and directional navigation.
- [ ] Readable character/enemy presentation with restrained, purposeful animation.
- [x] Generate a pixel-art bestiary for eleven themes (six priority plus alien jungle, dreamscape, arctic, ghost town, post-apocalyptic): 5 monsters and 3 bosses each, with idle, hit, attack, special, and death animations, plus manifests and a verifier (ADR 0022, `docs/art/README.md`).
- [x] Require art for every monster at compile time, add a dungeon theme catalog and themed encounters, and add catalog entries for the whole bestiary (82 new monsters, 72 new encounters; ADR 0023). Enemy snapshots now carry a `sprite` ID.
- [x] Replace the SVG monster art in the frontend with the pixel-art sprites: map server enemy definitions to sprite ids, play animations from combat events (telegraph, attack impact frame, hit, death), and honour reduced motion.
- [x] Generate player-character sprites for the nine classes in the bestiary style (idle loop and a signature flourish each, plus roster busts) and a pixel-art interface kit: panel, slot and button frames, wall and floor tiles, torch, crest, and an icon sheet (ADR 0024, `docs/art/README.md`).
- [x] Rebuild the title screen, party lobby, and class selection on the hero sprites and interface kit so the first screens match the monster art (ADR 0024).
- [ ] Hand-polish pass on the generated monster and hero sprites; add hit, attack, and defeat animations for heroes when they appear in combat and spectator scenes.
- [x] Server-authoritative party path voting with a 15-second window, majority resolution, random tie/no-vote fallback, and immediate solo choices (ADR 0017).
- [x] Establish server-authoritative simultaneous combat rounds: one action per living player, an 8-second co-op window, deadline fallback to defend, and immediate solo resolution (ADR 0015).
- [x] Add server-authoritative enemy intent telegraphs, targeted/party-wide attacks, guard mitigation, enemy turn resolution, combat feedback, and party defeat (ADR 0018).
- [x] Add a contextual interrupt counter for the Crypt Warden Soul Drain; see ADR 0018 and `docs/game-design/combat-roadmap.md`.
- [ ] Continue combat iteration per `docs/game-design/combat-roadmap.md`: multi-enemy encounters, party-size composition scaling, then support and consumable actions.
- [x] Prototype opt-in Catacombs music, room ambience, event-driven gameplay effects, and independent master/music/effects controls (PR #20).
- [ ] Replace or expand the synthesized prototype with authored theme-specific music and effects; tune the mix on mobile, desktop, and spectator playback.
- [ ] End-to-end acceptance: one player can complete the dungeon; a group can complete it together; independent viewers can watch either without joining.
- [ ] Verify core screens on mobile, tablet, and desktop layouts. Title, lobby, and class selection were checked at 390, 820, and 1366 px wide in Chrome with fallback fonts; they still need a pass on real devices with the web fonts loaded.
- [ ] Bring the rest of the in-game interface into the pixel-art direction using the interface kit from ADR 0024 (title, lobby, and class selection are done): pixel-appropriate typography, crisp stepped borders/panels, hero action controls, talent trees, HUD, navigation, dialogs, and feedback. Keep body text readable at small sizes and validate across mobile, tablet, desktop, and spectator views.

## Phase 2 — Core roguelike loop

- [ ] Expand health and combat stats, add recovery/consumables, and introduce readable status effects.
- [x] Add the extensible class catalog, stable IDs, nine initial class definitions, unique starting stats/equipment, server-authoritative class selection, and run build snapshots (PR #35).
- [x] Implement registered server-authoritative signature ability and passive handlers for all nine classes, with solo/co-op combat tests (PR #38; first-pass balance values).
- [x] Selection experience: compact roster grouped by archetype with a focused class detail view, an animated hero, icon-led skills and passives, stats and gear, and an in-context talent-tree preview. Available and locked paths are shown distinctly, and the chosen hero joins the party line-up (ADR 0024). Next: continue multi-level spike iteration.
- [ ] Add class signature actions and target/mode controls to the player combat UI.
- [ ] Replace archetype-only talent assumptions with small class-specific talent trees while preserving explicit preview/acceptance and between-encounter spending.
- [ ] Add persistent class-unlock foundations: player-owned unlock state, data-driven eligibility requirements, server-side authorization, and idempotent rewards. Keep initial classes available until progression unlock milestones are designed.
- [ ] Snapshot class/build definition versions in active runs and test compatibility across reconnects and content updates.
- [ ] First implementation should keep classes as build directions, not mandatory roles; every class must remain viable solo and duplicate classes must remain viable in parties.
- [ ] Expand run rewards into gear, loot, inventory, spells, abilities, and consumables.
- [ ] Build choices that let solo players cover their own needs without mandatory roles.
- [ ] Build complementary multi-enemy formations and tune encounter composition for solo, duo, and four-player parties without relying on health inflation.
- [ ] Extract monster/ability/modifier/encounter definitions into a versioned content catalog and build a deterministic simulation harness using the live combat rules. See `docs/game-design/monster-content-and-simulation-spike.md`.
  - [x] Move authored monster names, base health, behavior mappings, and existing depth/party/solo health scaling into catalog-backed enemy definitions.
  - [x] Extract reusable encounter compositions, party-size variants, and provisional relative difficulty budgets into a validated encounter catalog.
  - [ ] Complete modifier/effect extraction: talent combat modifiers, room-event run effects, class passive effects, typed signature-ability operation definitions, and typed encounter/floor reward definitions are catalog-backed. Signature ability operations and reward operations remain applied by authoritative runtime transitions until the pure transition extraction.
  - [ ] Isolate deterministic combat transitions and add simulation scenarios/reports.
  - [x] Extract pure, shared health damage/healing arithmetic and route live combat, class abilities/passives, and run rewards through it; preserve caller-owned target eligibility and combat feedback.
  - [x] Extract pure attack damage, interrupt damage, incoming mitigation, and deterministic enemy-intent resolution into shared transitions used by live combat.
  - [ ] Extract progression transitions before building the simulation runner.
- [ ] Reward and difficulty curves validated through playtesting.
- [ ] Spike multi-level runs: generate several connected dungeon floors from a run seed; carry party state and run rewards between floors; add a health-restoration-versus-perk choice between floors, occasional seeded minibosses with meaningful rewards, and a soundtrack that evolves with depth and encounter intensity; scale encounter pressure with depth and party size. Target 3–5 minutes per level. See `docs/game-design/multi-level-dungeon-spike.md` for scope and validation criteria.
- [ ] Iterate on the playable multi-level run spike before merging it: rebalance health/damage and encounter pacing to reach the 3–5 minute floor target without relying on enemy HP inflation; slow early XP/level progression; tune healing and party-size scaling; add tactical enemy roles, complementary formations, and clearly telegraphed actions; introduce real risk/reward trade-offs for shrines, healing, perks, optional encounters, and treasure; add subtle depth-sensitive percussion to the existing musical progression. Validate solo and co-op with recorded floor duration, player damage/health changes, level-up timing, and choice outcomes. See the playtest follow-up section in `docs/game-design/multi-level-dungeon-spike.md`.

### Persistent character progression and personalization

- [ ] Distinguish persistent character meta-progression from temporary, within-run roguelike progression.
- [ ] Add a persistent guest-character identity and a memorable character-creation flow, including a generated or chosen name, class selection, and a lifetime record visible from the lobby.
- [ ] Track each character's life story: dungeons entered, completed, escaped, deaths, revivals, bosses defeated, discoveries, and other notable milestones. Show a concise lifetime summary when choosing or reviewing a character.
- [ ] Make character death permanent when the character is not raised before the run ends. A successful in-run resurrection preserves that character's life; once a run ends with the character dead, retire the character and require creation or selection of a living character for the next run.
- [ ] Preserve memorial records for retired characters and their accomplishments; do not silently reset or overwrite a guest's lifetime history when creating a successor.
- [ ] Award character experience server-side for meaningful run accomplishments: dungeon completions, boss and mini-quest victories, discoveries, and special challenges.
- [ ] Provide persistent character levels with cosmetic and expressive unlocks such as name customization, interface themes, music selections, portraits, titles, and visual effects.
- [ ] Add class unlocks as persistent content-access rewards, using data-defined requirements (character level, achievements, quests, or other milestones); unlocks must not grant combat power.
- [ ] Give guest characters a randomly assigned name initially; unlock player-selected naming at an early level.
- [ ] Support a useful local guest progression path before account creation, with a clear path to link and preserve that identity later.
- [ ] Keep character levels and unlocks cosmetic/content-access focused; never grant combat power or gameplay advantages through meta-progression.
- [ ] Make accomplishment rewards idempotent, resistant to farming, and fair to eligible party members, including meaningful partial progress on unsuccessful runs.
- [ ] Define how a guest maintains or selects multiple characters locally, and how each character's record survives browser storage changes before account linking exists.

Character identity, lifetime records, and permadeath rules: see `docs/game-design/guest-character-life.md`.

## Phase 3 — Procedural dungeons and replayability

- [ ] Add an optional, party-shared dungeon map that reveals rooms and connections as they are discovered, marks the party's current room, and distinguishes unexplored, visited, and cleared areas. Keep in-scene directional exits as the primary way to move; the map is for orientation and reviewing discovered routes.
- [ ] Data-driven room graph and encounter director, informed by the multi-level generation spike.
- [ ] Traps, secrets, treasure rooms, merchants, puzzles, and alternate routes.
- [ ] Reusable optional side-mission framework.
- [ ] Distinct enemy families and bosses with mechanics, not just larger health pools.
- [ ] Simulate and tune the provisional stats, abilities and encounter budgets of the 82 art-backed monsters; give the non-Catacombs themes room graphs and floor generation so their encounters can appear in runs; add a dedicated miniboss sprite.
- [ ] Run modifiers and varied dungeon themes.

## Phase 4 — Open-world intermissions

- [ ] Safe hub between dungeon levels.
- [ ] Rest, shop, repair, upgrade, and resupply activities.
- [ ] NPCs, ambience, music, and environmental storytelling.
- [ ] Safe join checkpoint and party ready-up flow.

## Phase 5 — Content and presentation

- [ ] Additional themes (fantasy, sci-fi, noir, and stranger combinations).
- [ ] Per-theme room backgrounds, props, and encounter tables for the eleven themes that already have monster art; server-side theme and enemy definitions that reference sprite ids.
- [ ] More enemy families, bosses, side missions, items, and abilities.
- [ ] Cinematic spectator camera movement, animation, audio, accessibility, and localization polish.
- [ ] Content authoring conventions and validation tools.

## Phase 6 — Optional accounts

- [ ] Guest-to-account identity linking that preserves persistent character level, name, unlocks, and achievements.
- [ ] Cross-device synchronization of character progression and personalization.
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

Classic fantasy crypts and forests; sci-fi research facilities; 1930s mobster/noir underworld; sunken kingdoms; clockwork empires; haunted carnivals; ghost towns; alien jungles; dreamscapes; arctic stations; post-apocalyptic settlements. Theme collisions can create surprising encounters and loot.

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
