# MVP Game Design

Status: working design baseline. Tune numbers and content through playtesting; do not treat provisional values as balance commitments.

## Experience

Heart of the Beast is a cooperative, social-first roguelike dungeon crawler that is equally playable alone. A player can start a run immediately, explore illustrated pixel-art scenes, make meaningful build choices, fight tactical encounters, find treasure, and reach a safe hub. Friends can join at supported checkpoints, but the game never assumes they must.

Target session length is 20–40 minutes, with dungeon levels around 5–8 minutes. The first playable milestone is a complete short dungeon, a boss, rewards, and a safe intermission.

## Party model

- Support 1–4 players in the initial experience.
- Solo is a first-class mode, not a reduced multiplayer mode.
- No mandatory roles, class slots, trading, or teammate abilities.
- Players can leave without blocking the remaining party.
- New players can join at safe breaks (for example, after a boss or in the village), not in the middle of an encounter.
- Optional hirelings, pets, or temporary allies may be added later, but the base solo loop must not depend on them.

## Exploration

Each location is a detailed illustrated scene with visible environmental details, creatures, objects, and points of interest. The party chooses a direction (initially North, South, East, or West) to move through a connected room graph.

For groups, path choices use a 15-second vote window. The most-voted available path wins; a tie is settled by a server-side random choice among the tied paths. If nobody votes, choose randomly among all available paths so the run cannot stall. Solo choices resolve immediately; do not show a vote timer or simulate absent players.

Exploration content must not require simultaneous actions from multiple players. A puzzle that has a cooperative solution should also have a solo route, sequential interaction, or ability-based alternative.

## Character, enemy, and interface presentation

The visual direction is illustrated, high-definition pixel art. The scene should establish place and mood, while characters and enemies remain immediately recognizable and readable.

The interface belongs to the same pixel-art world as the scenes. Typography, talent trees, hero actions, HUD, navigation, dialogs, and combat feedback should use crisp pixel-aware forms, stepped borders, and compact game-like framing rather than generic smooth web controls. Pixel styling must preserve legibility: reserve the most pixelated display face for short headings and labels, and use a readable mono face for descriptions and longer text. Use a restrained palette drawn from the scene and maintain clear contrast, focus, selected, disabled, and danger states.

Working presentation principles for the first slice:

- Compose each room as a scene first, with clear visual hierarchy between environment, interactable points of interest, enemies, characters, and UI.
- Present the player character and enemies as distinct illustrated sprites or character cutouts integrated into the scene. Their silhouettes, facing, and current state should be understandable at a glance.
- Use restrained, purposeful animation: subtle idle motion to give characters life, with clearer action, hit, defeat, and boss-telegraph animations when those events matter.
- Animation must reinforce game state, not obscure it. Never rely on animation alone to communicate danger, damage, target selection, or an available action.
- Keep navigation, combat choices, enemy intent, health, and party status legible without covering the important part of the scene.
- Style player-facing controls and panels as part of the pixel-art presentation, including distinct hero action buttons and a talent tree whose nodes and connectors read as an in-world game interface.
- Adapt layout and information density for phones, tablets, and desktop screens. On small screens, prioritize the current scene, the most important encounter information, and reachable controls; secondary details can move into compact panels or progressive disclosure.
- Provide reduced-motion behavior and avoid flashing or constant motion that makes the interface tiring.
- Treat the spectator/cast presentation as a separate composition optimized for viewing at a distance, not simply a stretched player screen.

Exact sprite scale, animation frame style, camera composition, and HUD arrangement remain visual-design decisions to validate with a small prototype across target screen sizes.

## Combat: hybrid simultaneous tactics

1. Each enemy shows a clear intent before players act: the move, damage, and intended target (or the whole party).
2. Each living player submits one action during the shared window. The current slice offers Strike (10 damage) and Defend; additional actions are added only when they create a distinct, understandable choice.
3. Co-op uses an eight-second action window. Solo actions resolve immediately. An idle or disconnected player defaults to Defend when the group window closes.
4. The server resolves player actions in stable player-ID order, then surviving enemies resolve their telegraphed intents. Defeating an enemy before its turn cancels its intent.
5. Defend blocks up to 6 damage from the next incoming hit; it is not a heal. Damage, blocks, defeats, and player knockouts are shown in a short combat event log.
6. A run ends in victory when the boss is defeated, or defeat when every player is down.

The initial enemy behaviors are deliberately small and learnable:
- Restless Sentinel: a 4-damage Strike against one telegraphed adventurer.
- Drowned Scout: a 3-damage Quick Jab against one telegraphed adventurer.
- Reliquary Guardian: alternates an 8-damage Heavy Blow with a 4-damage Stone Strike.
- Crypt Warden: Soul Drain hits one adventurer for 5 and restores up to 2 of its health; every third turn, Soul Sweep hits all living adventurers for 3.

Enemy targets rotate predictably through the living party. This makes a targeted intent meaningful without hidden aggro rules, while party-wide attacks ask everyone to consider Defend. A 6-point guard absorbs small attacks and softens heavy attacks, so players can understand the tradeoff at a glance.

### Solo encounter tuning

Do not balance solo by merely dividing enemy health:
- Reduce simultaneous enemy pressure and avoid unavoidable multi-target attacks with no counterplay.
- Preserve readable telegraphs and adequate reaction windows.
- Ensure required interrupts, shields, healing, and utility have solo-accessible counters (build abilities, consumables, terrain, or sequential mechanics).
- Avoid mechanics that require two people to stand on switches or act at the same moment unless a solo alternative exists.
- Keep boss mechanics interesting; simplify coordination requirements rather than turning bosses into stationary health bars.

For groups, add complementary threats and opportunities for cooperation rather than only increasing enemy health. Validate difficulty at party sizes 1, 2, and 4.

## Builds and progression

Avoid rigid classes. Characters can develop toward flexible archetypes such as Vanguard (defense), Arcanist (magic/control), Rogue (precision/traps), or Warden (support/nature). These are inspiration for abilities, not exclusive party requirements.

A solo build should be able to obtain enough survivability and utility to complete the run. Loot and progression must not assume trading or duplicate drops being useful only to another class. Optional consumables and equipment can offer alternate answers to encounter mechanics.

## Dungeon and initial content candidate

The Forgotten Catacombs is the first authored adventure, replacing the original four-room demonstration graph. See [forgotten-catacombs.md](forgotten-catacombs.md) for its current route and room-by-room content:
- Nine room nodes across alternate entry routes and an optional rescue branch.
- Four encounter spaces along a complete route (including one of two alternate approaches), with complementary enemy pairs.
- An exploration event that can reveal the Warden's weakness, adding bonus Strike damage against the boss.
- An optional rescue mission that restores party health.
- A treasure room where the party chooses a run-long damage or defense relic.
- A gate encounter and the Crypt Warden finale.

The current prototype implements the room graph, server-authoritative choices, rescue recovery, and relic stat changes. Distinct scene art, deeper consequences for the rescue, more varied route layouts, and a safe village intermission remain unfinished.

The Crypt Warden should grow into a multi-phase boss whose guard, soul-drain mark, summons, and enrage phase respond to what the party learned and chose during the dungeon. In solo play, every mechanic must have a self-contained answer. In co-op, teammates can help interrupt or control adds.

## Multiplayer decisions and resilience

- Every group vote has a deadline and a documented tie/default policy.
- Solo choices resolve immediately.
- Reconnect should restore a player's place in the run when possible.
- Leaving is always allowed; the encounter director adapts to remaining players at safe resolution boundaries.
- The server is authoritative for combat, rewards, room transitions, and all consequential state.
- Player controls and spectator/cast view are separate presentations of the same game state.

## MVP acceptance criteria

The MVP is not complete until all of these are demonstrated:
1. One player can create a run and join without an account.
2. That player can navigate the dungeon without waiting for votes.
3. That player can defeat every required encounter and the boss with a viable build and available resources.
4. Solo boss mechanics do not require another player.
5. Two players can complete the same dungeon together, including group decisions and coordinated combat.
6. A four-player group can complete the same core loop without encounter mechanics becoming trivial or unmanageable.
7. Players can leave or reconnect without permanently stalling the run.
8. The party receives rewards and reaches a safe intermission.
9. Core player screens remain usable at mobile, tablet, and desktop sizes.

## Out of scope for the first playable slice

Accounts, persistent metagame progression, many world themes, a large quest catalogue, complex crafting, trading, PvP, and a large open world. Build the smallest complete adventure first.
