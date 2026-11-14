# Roadmap

This roadmap is a living plan, not a promise that every idea will ship. We prioritize a playable vertical slice and validate the experience before expanding systems.

## Product goals

- A complete run is enjoyable solo or with friends; multiplayer adds social possibilities rather than fixing a broken solo experience.
- Typical session target: 20–40 minutes. Dungeon levels target roughly 5–8 minutes.
- Illustrated, high-definition pixel-art scenes with directional exploration.
- Small parties, initially 1–4 players, with no mandatory class composition.
- No account or third-party service required to play. Optional accounts may later support identity, achievements, and cosmetics.
- Spectator viewing is independent of participation: people can watch a run through a shared viewing link/QR code without joining the party or creating a character.
- Open-source and self-hostable, with Render and Neon as the initial prototype deployment.

## Phase 0 — Foundation and discovery

- [x] Establish project overview and working agreements.
- [x] Agree on MVP game loop, solo/co-op rules, combat, and progression.
- [x] Record initial architecture, deployment, audio, presentation, and spectator-access decisions.
- [x] Establish baseline GitHub Actions CI for pull requests and pushes to `main`, installing frontend dependencies and running the TypeScript check plus production build. CI generates the npm lockfile and publishes it as an artifact so it can be committed without a local npm environment; once committed, CI verifies it stays in sync and uses `npm ci`. Add automated test execution as test suites are introduced, expand checks to the backend when it exists, and configure the workflow as a required merge check.
- [x] Bootstrap the frontend workspace, root-level local development commands, and baseline CI.
- [ ] Introduce the independently buildable backend service, local database workflow, and backend CI when its stack is selected.
- [ ] Configure Render auto-deploy and Neon PostgreSQL for the prototype.
- [ ] Define room lifecycle and authoritative game-state model.
- [x] Establish responsive scene, character, enemy, and HUD presentation rules.
- [x] Choose first-person-inspired forward-facing player camera for exploration and combat; separate cinematic spectator renderer over shared game state.
- [x] Decide spectator access is independent of player participation, with a server-enforced read-only connection.

## Phase 1 — Playable multiplayer/solo vertical slice

- [x] Prototype one responsive combat room with one adventurer, two enemies, visible enemy intent, and immediate action resolution (PR #2).
- [x] Validate forward-facing player composition alongside a separate spectator/cast composition over the same encounter state.
- [ ] Add directional room navigation and context-aware spectator camera movement.
- [ ] Create a room and join by invite link/code; no account required.
- [ ] Provide a separate, host-controlled spectator viewing link/QR code that does not consume a player slot or require party membership.
- [ ] Implement server-authorized, read-only spectator subscriptions and reconnect/catch-up behavior.
- [ ] Ensure spectators cannot issue commands and do not affect party size, scaling, presence, votes, readiness, or deadlines.
- [ ] Responsive player interface and separate spectator/cast presentation.
- [ ] Presence, reconnect, and graceful leave behavior for players.
- [ ] Illustrated room scenes and directional navigation.
- [ ] Readable character/enemy presentation with restrained, purposeful animation.
- [ ] Party direction voting; solo decisions resolve immediately.
- [ ] One complete dungeon path with basic encounters and a boss.
- [ ] Timed tactical combat that works for one player and small groups.
- [ ] Basic music, ambience, and gameplay sound effects with independent volume controls.
- [ ] End-to-end acceptance: one player can complete the dungeon; a group can complete it together; independent viewers can watch either without joining.
- [ ] Verify core screens on mobile, tablet, and desktop layouts.

## Phase 2 — Core roguelike loop

- [ ] Health, stats, damage, status effects, and progression.
- [ ] Gear, loot, inventory, spells, abilities, and consumables.
- [ ] Build choices that let solo players cover their own needs without mandatory roles.
- [ ] Enemy intent telegraphs, coordinated actions, and encounter tuning by party size.
- [ ] Reward and difficulty curves validated through playtesting.

## Phase 3 — Procedural dungeons and replayability

- [ ] Data-driven room graph and encounter director.
- [ ] Traps, secrets, treasure rooms, merchants, puzzles, and alternate routes.
- [ ] Reusable optional side-mission framework.
- [ ] Distinct enemy families and bosses with mechanics, not just larger health pools.
- [ ] Run modifiers and varied dungeon themes.

## Phase 4 — Open-world intermissions

- [ ] Safe hub between dungeon levels.
- [ ] Rest, shop, repair, upgrade, and resupply activities.
- [ ] NPCs, ambience, music, and environmental storytelling.
- [ ] Safe join checkpoint and party ready-up flow.

## Phase 5 — Content and presentation

- [ ] Additional themes (fantasy, sci-fi, noir, and stranger combinations).
- [ ] More enemy families, bosses, side missions, items, and abilities.
- [ ] Cinematic spectator camera movement, animation, audio, accessibility, and localization polish.
- [ ] Content authoring conventions and validation tools.

## Phase 6 — Optional accounts

- [ ] Guest-to-account identity linking without losing progress where feasible.
- [ ] Achievements, titles, cosmetics, and run history.
- [ ] Cosmetic-only account benefits; no pay-to-win progression.
- [ ] Data export and deletion.

## Phase 7 — Self-hosting and community

- [ ] One-command local development and container deployment.
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
