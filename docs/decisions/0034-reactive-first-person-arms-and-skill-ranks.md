# ADR 0034: Reactive first-person arms, run skill ranks, and an intent strip

- Status: Accepted
- Date: 2026-11-20
- Builds on: [ADR 0020](0020-temporary-run-progression.md) (run levels), [ADR 0024](0024-sprite-rendering-and-combat-effects.md) (combat effects), [ADR 0027](0027-run-and-combat-interface.md) (run screen), [ADR 0031](0031-class-skills-loadouts-and-dungeon-briefings.md) (skills)
- Supersedes in part: [ADR 0024 (heroes and interface kit)](0024-pixel-art-heroes-and-interface-kit.md), the static first-person sprite
- Fixes: [#138](https://github.com/swarkentin/heart-of-the-beast/issues/138)

## Context

The first-person view drew a static pair of arms across the bottom of the room. They covered the floor and the
enemies' feet, never moved, and said nothing about the fight. To keep the enemy intents clear of them, an earlier
change moved the intent chips to the top of the scene, where they now cover the names and health bars of tall bosses
(#138).

Separately, run levels raised numbers (health, Strike, Guard) but never asked the player to choose anything, and
nothing on screen showed that a character had grown.

## Decision

### Arms that only appear to act

- The arms are **hidden while the player chooses**. They rise only for the player's own action, in step with the
  stage, and drop again straight after:
  - **strike** (Power or Agility damage): the weapon arm winds up when the round arrives, then swings through on the
    strike frame as the hit lands, with a swing smear, a short hit-stop and a stepped screen shake.
  - **spell** (Focus or elemental damage): the off hand comes up gathering motes; the stage fires the projectile
    **from the palm** to the target, and the palm flares as it leaves.
  - **guard** (guard, ward, thorns, taunt, Defend): the off hand braces high behind an expanding hex ward.
  - **cast** (heals, buffs, debuffs without damage): the off hand rises with a burst of light.
  - **block**: when an enemy hit is blocked, the off hand snaps up into it with a ward, sparks and a shake.
- The stage holds a round containing the player's own hit back 200 ms (`SELF_LEAD_MS`) so the windup reads before
  the impact.
- The server tags every event of a player's action with the **skill and rank** (`CombatEvent.Skill`, `.Rank`, next to
  the existing `ActorID`), including an automatic Defend. The client classifies the move from the skill's effects
  (`frontend/src/run/selfMoves.ts`).
- The art is a generated sheet (`scripts/pixel-art/first-person.mjs`): two 128x64 columns, left arm and right arm
  alone, one row per pose (rest, windup, strike, present, brace). Each arm covers the whole frame so a swing may
  cross the centre. It is drawn at 4x, the room backdrops' pixel density. The generator draws foreshortened forearms
  rising from the bottom corners with class sleeves, gloves, bracers and implements, and rotates the held implement
  about the wrist between poses. `verify.mjs` checks the sheet size and that every pose moves its arm.
- With reduced motion the arms are not drawn at all; the stage's static effect markers remain.

### Skill ranks

- **Every run level-up grants one skill point.** The player spends it with an `upgrade_skill` command on a skill of
  their bar, raising it one rank, I to V (`MaxSkillRank`). It is a free action at any time during the run, never a
  turn. Ranks live on `PlayerState.SkillRanks` with `SkillPoints`, reset with the run and survive a camp loadout swap.
- A rank adds a small step to each scaling effect (`rankedSkill` in `skill_ranks.go`): +1 at ranks II and III, +2 at
  IV and V, to damage, counter, heal, guard, weaken, interrupt-weaken, mark, thorns and empower; twice that to ward;
  +1 bleed or regen at IV and V; +5 percentage points of lifesteal or revive per rank. Stun, taunt, hasten and damage
  riders never change, so a rank changes how much a skill does, never what it does. A ranked Defend guards more,
  including the automatic one.
- The catalog sends each skill's rule text at every rank (`SkillDefinition.RankRules`) so the picker can show the
  current and next rank side by side, and the combat bar shows a rank badge and the ranked rules.
- **The rank drives the animation**: smear length, thickness and afterimages, slash cross-cuts and a white-hot core
  at V, longer brighter bolt wakes and an impact ring from IV, more charge motes and flare rays, more ward rings, a
  harder shake.
- The balance simulations spend points deterministically: the basic attack first, then the lowest-ranked skill in bar
  order, Defend last (`spendSkillPointsByPolicy`).

### Intents in their own strip (#138)

- The enemy intents are a strip **above** the scene drawing, in the layout flow, not an overlay inside it. The room
  is drawn in the space left below, so no intent can cover a name or health bar however tall the enemy, however many
  enemies, however long the move names, in both views. Nameplate placement moved to `plateY` in `layout.ts`;
  `arms.test.ts` guards the structure and the plate clamp.

## Consequences

- The view is clear while the player decides, and every action now has a visible, class-flavoured response that
  grows with the run.
- Run levels now carry a choice. Ranks make parties stronger. Endless expedition matrix, 126 compositions x
  random/tactical x 100 seeds (25,200 expeditions), tactical policy, median of per-scenario median depth and mean
  wipe rate by party size:

  | Party | main | first draft (+1 per rank) | accepted (+1 at II-III, +2 at IV-V) |
  |---|---|---|---|
  | Solo | 18 floors, 93% wipe | 19, 83% | 18, 88% |
  | Pair | 20, 65% | 96, 43% | 40, 52% |
  | Trio | 95.5, 38% | 102.5, 20% | 100, 28% |
  | Four | 20, 52% | 100, 32% | 97.5, 41% |

  Capstone castle clears among tactical parties that reach one: 54% on main, 71% with the first draft, 63% accepted.
  Medians are bimodal (a party either dies around the first castle or runs to the simulation depth limit), so the
  wipe rate is the steadier number. The first draft took a third of the wipes out of two- to four-player
  expeditions and was halved. Random play is unchanged (median depth 2). The fixed regression suite (`balance-report`,
  30 seeds) reports no regression.
- The accepted version is still a deliberate buff for longer expeditions. If castles or late dungeons feel soft,
  tune them through their mechanics (ADR 0033) rather than by shrinking ranks further.
- One latent test bug surfaced: `TestSimulateRunBatchSummarizesDepthReachProbability` summed Completed and Wiped,
  which double-counts a run that beats the first boss and later wipes. It now counts each run by its single Outcome.
- The intent strip takes a little height from the scene; on a phone the drawing letterboxes slightly smaller.
