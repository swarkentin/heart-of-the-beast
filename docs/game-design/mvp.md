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

For groups, choices are time-boxed and resolved by a documented policy (for example, majority, then a safe deterministic tie-break). For a solo player, the selected direction resolves immediately; do not show a vote timer or simulate absent players.

Exploration content must not require simultaneous actions from multiple players. A puzzle that has a cooperative solution should also have a solo route, sequential interaction, or ability-based alternative.

## Combat: hybrid simultaneous tactics

1. The encounter begins with enemy positions, health, and telegraphed intentions visible.
2. Each player chooses an attack, spell, ability, item, or defensive action.
3. Players may revise their choice until the action window closes.
4. The server resolves player actions in a deterministic order, then resolves enemy actions.
5. The next action phase begins.

A 6–8 second action window is a starting hypothesis for groups, to be validated. Solo actions should resolve without waiting for a nonexistent party; a short tactical confirmation window may be retained only if it improves the feel. Idle or disconnected players must not stall combat; group defaults should be safe and visible (initially defend/guard).

### Solo encounter tuning

Do not balance solo by merely dividing enemy health. Scale encounter composition and mechanics:
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

The Forgotten Catacombs is a provisional first setting:
- 8–12 connected rooms.
- 3–4 enemy types.
- One optional side mission and one treasure room.
- One boss encounter.
- 3–5 possible equipment rewards.
- A peaceful village intermission.

Sample boss: the Crypt Warden. Its guard can be broken through varied attacks or abilities; a soul-drain mark creates an interrupt opportunity; it summons minions and changes behavior at low health. In solo play, the mark must be answerable by the player's own kit or the environment. In co-op, teammates can help interrupt or control adds.

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

## Out of scope for the first playable slice

Accounts, persistent metagame progression, many world themes, a large quest catalogue, complex crafting, trading, PvP, and a large open world. Build the smallest complete adventure first.
