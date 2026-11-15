# Combat Roadmap

Status: working design plan. Keep mechanics provisional until tested in solo and small-party play.

## Combat promise

Combat should be easy to read and interesting to decide:

1. Read the enemy's announced intent.
2. Choose one action during the shared party window.
3. Resolve player actions, then surviving enemy intents.
4. See clear consequences and the next threat.

The tactical depth should come from choosing when to deal damage, defend, interrupt, or help—not from memorizing a large ability catalogue or managing hidden threat rules.

## Rules that should stay true

- One clear action choice per player per round.
- One visible intent per living enemy, including move, damage, and target.
- Player actions resolve before enemy actions. Defeating an enemy cancels its intent.
- Eight-second co-op action window; idle/disconnected players default to Defend.
- Solo actions resolve immediately and every mechanic has a solo-accessible answer.
- No mandatory classes, party roles, or simultaneous multi-player-only mechanics.
- Prefer adding enemy behaviors and encounter composition over inflating enemy health for larger parties.
- Keep the active action vocabulary small (roughly 2–4 useful choices at once).
- Show important outcomes in the scene or a short combat log; avoid requiring players to inspect a combat spreadsheet.

## Stage 1 — Read and respond (current implementation)

Implemented in PR #17:

- Strike: deal 10 damage to one living enemy.
- Defend: block up to 6 damage from the next incoming hit.
- Sentinel: 4-damage single-target strike.
- Scout: 3-damage quick jab.
- Guardian: alternating 8-damage heavy blow and 4-damage stone strike.
- Crypt Warden: 5-damage Soul Drain that restores up to 2 health; every third turn, a 3-damage Soul Sweep against all living players.
- Single-target intents rotate predictably through the living party.
- Enemy intents resolve after player actions; defeating the enemy cancels its intent.
- Recent damage, blocks, defeats, and knockouts are visible to players and spectators.
- A run ends when the boss is defeated or the whole party is down.

The numbers are starting values, not balance promises.

## Stage 2 — Encounter composition and party scaling

Next priority after the first intent/response playtest:

- Introduce small multi-enemy encounters (start with two enemies, then three where useful).
- Give enemies complementary jobs:
  - Bruiser: slow, high-damage single-target wind-up.
  - Skirmisher: low-damage quick strike that changes targets.
  - Channeler: announces a party-wide or ally-supporting effect.
- Make target selection and focus fire meaningful: players can remove one threat, split damage, or defend the player being targeted.
- Scale party pressure primarily through enemy count, combinations, and intent patterns—not just multiplying health.
- Tune the same room at party sizes 1, 2, and 4. Keep solo encounters smaller and ensure all essential counters remain available to one player.
- Avoid presenting more than two or three simultaneous intents until the interface can communicate them cleanly.

## Stage 3 — Add a few tactical verbs

Add one action at a time and keep its purpose obvious:

- Interrupt: spend the player's action to cancel an explicitly interruptible intent. It deals no damage, so the choice is a tradeoff. Solo players can use it too.
- Aid: restore a modest amount of health to one player, with a limited use or other clear cost. No dedicated healer role.
- Consumable: use a small number of shared-understandable items such as a healing tonic or ward. Item use should compete with attacking/defending for the round.
- Only add an action if it creates a decision that Strike and Defend cannot already express. Avoid adding mana, stamina, combo points, or cooldown grids by default.

## Stage 4 — Boss mechanics

Build the Crypt Warden from mechanics already taught in normal encounters:

- Soul Drain: mark one player, deal damage, and restore some boss health if not stopped.
- Soul Sweep: announce a party-wide hit with a clear response window.
- Summon: introduce a lesser enemy that changes the party's priorities.
- Guard break or exposed phase: create a short opportunity after the party answers a telegraph correctly.
- Use a small number of readable phases rather than a long list of unrelated abilities.
- Every mechanic needs a solo answer (interrupt, guard, movement/terrain, or a consumable), not a mandatory second player.

## Stage 5 — Build choices and rewards

After the basic encounter loop is enjoyable:

- Offer a small choice of reward after meaningful encounters: recovery, a weapon modifier, a defensive charm, or a new action.
- Let players develop flexible build directions without locking them into classes.
- Prefer item effects that change a decision ("Guard also protects an ally" or "Strike weakens the next heavy hit") over large passive stat inflation.
- Keep guest/solo play viable without trading or duplicate drops.

## Playtest questions

- Can a new player explain an enemy's intent and target after one glance?
- Is it clear when Defend is better than Strike?
- Does killing an enemy before its turn feel rewarding?
- Does co-op create complementary choices rather than everyone pressing the same attack?
- Does solo remain tense but fair without waiting?
- Can the party understand why health changed from the combat log?
- Are encounters roughly 5–8 minutes per level, and does a full run fit the 20–40 minute target?

Do not advance to a more complex stage just because it is easy to code. First confirm that the current choices are understandable and fun.
