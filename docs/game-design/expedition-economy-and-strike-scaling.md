# Expedition economy and permanent Strike scaling

## Problem

Permanent Strike bonuses compounded across floor perks, room discoveries, reliquaries, miniboss rewards, and Whetstones. Whetstone prices rose linearly with depth while encounter and mini-game gold also rose with depth. A player who consistently chose Strike upgrades could therefore turn later floors into one-hit encounters, with the economy continuing to fund the same strategy.

The full-run simulator already executes camp and reward transitions, but its tactical shop policy previously prioritized healing and then fell back to random purchases. It did not deliberately model a player investing in permanent damage.

## Rules

- All permanent Strike increases share a run-wide cap of **+4 Strike damage above the starting Strike value**. The cap applies to Whetstones, room-event effects, and expedition rewards. Negative Strike trade-offs still apply.
- Whetstones cost `30 + 8 × (depth - 1) + 4 × (depth - 1)²` gold, using expedition-wide depth. Other permanent shop boons retain their gentler linear price increase.
- Encounter gold uses `4 + 2 × encounter budget + min(depth, 8)`, before floor gold modifiers.
- Mini-game payouts gain 8% per depth after the first, capped at a 64% bonus. This preserves a modest depth reward without allowing the camp mini-game to inflate indefinitely.
- The tactical full-run policy buys affordable emergency healing or revival first, then invests in a Whetstone when stable and below the permanent Strike cap. This deliberately tests an aggressive, damage-focused purchasing strategy rather than relying on random shop behavior.
- Full-run reports include each player's ending Strike damage and count actual gold spent at the dynamic shop price.

## Validation intent

The permanent cap should preserve the excitement of early upgrades while preventing an unbounded damage ramp. The quadratic Whetstone curve makes late upgrades a meaningful savings decision, and capped gold growth prevents long runs from automatically funding every permanent boon. Full-run balance reports should be reviewed for Bulwark solo as well as mixed parties; this is an initial tuning pass, not a claim that all expedition economy values are final.