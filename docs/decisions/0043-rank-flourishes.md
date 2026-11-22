# 0043: Every skill rank does something — flourishes at ranks III and V

Status: accepted

## Context

Skill ranks (ADR 0034) add a step to a skill's scaling effects: +1 in total at ranks II and III, +2 at IV and V. So
ranks III and V changed no numbers for most skills. Spending a point there only brightened the animation, and the
rank-up picker could only say "same numbers". Playtesting called this out as boring.

The obvious fix, +1 at every rank, is the first draft ADR 0034 rejected: it took about a third of the wipes out of
party expeditions.

## Decision

Ranks II and IV keep raising the numbers. Ranks III and V add a **flourish** instead: one small extra effect chosen
by the skill's tone, appended to the skill's effects (`rankFlourish` in `skill_ranks.go`). Rank V makes it bigger.

| Tone | Flourish | Rank III | Rank V |
|---|---|---|---|
| strike | **Echo**: a chance, rolled for each enemy the skill hit, to strike again for a little flat damage | 25%, 2 damage | 35%, 3 damage |
| guard (and control that targets only you) | **Thorns** this round | 1 | 2 |
| control aimed at enemies | **Mark**: the party's next hit on the target deals more | 1 | 2 |
| support | **Self-heal**: you restore health | 2 | 3 |

- Echo is the only new effect (`EffectEcho`). It lands only after the skill has struck, uses a seeded per-action
  roll like critical hits (`echoRoll`) so live play and simulations agree, and does flat damage (no crit, mark or
  boon multipliers), so it stays mild. Its event (`skill_echo`) is tagged with the actor, skill and rank.
- Thorns, mark and heal reuse the existing effects, so their rules, combat log and visuals already work.
- Defend's flourish is thorns, applied in `defend`, so an automatic Defend gets it too.
- The rule text describes the flourish, so the rank-up picker shows it as a gain ("+25% echo chance",
  "+2 echo damage", "+1 thorns", "+2 self-heal").
- **Visuals.** An echo is drawn as a violet ghost claw with an "ECHO n" popup, a beat after the hit, without
  another swing of the arm. Your own rank III+ hits add a burst in the skill's colour. At rank V, weapon hits add a
  ground shockwave and spells a ripple. The skill bar's rank III badge has a violet glow; rank V shimmers.

## Alternatives

- **+1 at every rank** (the ADR 0034 first draft). Simple, but too strong (numbers below).
- **Ranks III and V shorten the cooldown** (the basic attack and skills with a one-round cooldown get +1 instead).
  It was even stronger than +1 per rank: a shorter cooldown on a stun or interrupt compounds over a fight.
- **Cooldowns plus extra crit chance for the basic attack.** About as strong as +1 per rank, and harder to read.

## Consequences

- Endless expedition matrix: 126 compositions × random/tactical × 100 seeds (25,200 expeditions). Tactical policy,
  median of per-scenario median depth and wipe rate by party size; fifth-dungeon clears are among tactical parties
  that reach one:

  | Variant | Solo | Pair | Trio | Four | Fifth-dungeon clears | Random median |
  |---|---|---|---|---|---|---|
  | main | 18, 80% | 94, 38% | 100.5, 16% | 99, 27% | 77% | 2 |
  | +1 every rank (rejected draft) | 20, 72% | 98, 30% | 103.5, 11% | 101.5, 19% | 82% | 2 |
  | flourishes (accepted) | 20, 76% | 96, 33% | 102, 13% | 100.5, 22% | 80% | 2 |

  The flourishes take about half as many wipes out as the rejected draft (solo 80% → 76% against 72%; four-player
  27% → 22% against 19%). Random play is unchanged. In 30-seed quick runs the cooldown variant was stronger still
  (two-player wipes 38% → 25%), and cooldowns plus crit chance matched the draft.
- The fixed regression suite (`balance-report`, 30 seeds) reports no regression against main.
- The matrix above ran just before echo was stopped from passing through barriers, shields and phasing, so the
  accepted numbers are a slight upper bound. CI's balance job reruns both suites on the final code.

- A rank never changes what a skill does; it adds one small, readable extra. Retune the flourishes in
  `rankFlourish` (chances and sizes), not by inflating health.
- New skills need a `Tone` that matches what they do, since the tone picks the flourish.
