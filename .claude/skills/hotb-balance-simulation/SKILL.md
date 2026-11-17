---
name: hotb-balance-simulation
description: Simulate and balance Heart of the Beast content (themes, monsters, bosses, castles, boons, floor modifiers) against main using the repo's seeded balance tools, then record the numbers in an ADR. Use after any change to combat rules or content, before opening the PR.
---

# Heart of the Beast: simulation and balance

Use this after any change to combat rules, monsters, encounters, bosses, floor generation, floor modifiers, camps,
boons or themes, before opening the PR. The goal is a before/after comparison against `main` with numbers you
can put in the ADR, not a one-off run.

## 1. Build the tools (branch and baseline)

The simulators only import `internal/game`, so they build without PostgreSQL or pgx.

- If the sandbox has an older Go than `backend/go.mod` asks for and no network, temporarily lower the `go` line
  (for example `sed -i 's/^go 1.25.0/go 1.24/' backend/go.mod`) and build with `GOTOOLCHAIN=local`. **Restore
  go.mod before committing** (keep a copy, e.g. `cp backend/go.mod /tmp/go.mod.orig`). `internal/httpapi` and
  `cmd/server` need pgx and cannot be built offline; leave them to CI.
- Branch tools:
  ```sh
  cd backend
  GOTOOLCHAIN=local go build -o /tmp/eb ./cmd/endless-balance
  GOTOOLCHAIN=local go build -o /tmp/rs ./cmd/run-simulation
  GOTOOLCHAIN=local go build -o /tmp/br ./cmd/balance-report
  ```
- Baseline tools from main in a throwaway worktree (apply the same go.mod tweak there):
  ```sh
  git worktree add -q /tmp/base origin/main   # or HEAD before your commits
  cd /tmp/base/backend && sed -i 's/^go 1.25.0/go 1.24/' go.mod
  GOTOOLCHAIN=local go build -o /tmp/eb-base ./cmd/endless-balance   # likewise rs-base, br-base
  ```
  Remove it at the end with `git worktree remove --force /tmp/base`.

## 2. Run the same suites CI runs

Run these from `/tmp` (the tools write files relative to the working directory).

- **Fixed regression suite** (the one CI fails on):
  ```sh
  /tmp/br-base -seeds 30 -first-seed 1 -json /tmp/br-base.json -markdown /tmp/br-base.md
  /tmp/br -seeds 30 -first-seed 1 -json /tmp/br-new.json -markdown /tmp/br-new.md -baseline /tmp/br-base.json -fail-on-regression
  ```
  A non-zero exit means a regression. Read the REGRESSION and SUGGESTION lines.
- **Endless expedition matrix** (126 compositions × random/tactical × 12 seeds ≈ 3,000 expeditions, about 25 s):
  ```sh
  /tmp/eb-base -runs 12 -first-seed 1 -theme random -json /tmp/eb-base.json -markdown /tmp/eb-base.md
  /tmp/eb      -runs 12 -first-seed 1 -theme random -json /tmp/eb-new.json  -markdown /tmp/eb-new.md
  ```
- **Per-theme check** for a new or changed theme: run `run-simulation` for the theme and two or three existing
  themes as a reference band, with a spread of parties.
  ```sh
  for theme in catacombs mobster ghosttown NEWTHEME; do for party in arcanist juggernaut ranger,cleric assassin,juggernaut spellguard,assassin,ranger; do
    /tmp/rs -runs 40 -theme $theme -party $party -policy tactical -json /tmp/rs-$theme-$party.json >/dev/null; done; done
  ```
  The JSON's `runs` array holds per-run reports (`dungeonsCleared`, `reachedDepth`, `endDungeon`, `endThemeId`,
  `endDepth`, `endRoomType`). A capstone castle (`eldritch`, `infernal`) cannot be the first dungeon in live play;
  measure castles through the endless matrix (parties that reach dungeon 5).

## 3. Compare

Judge by the **tactical** policy; random play is a regression floor, not a target.

Useful comparisons (small Python scripts over the JSON):

- Median of per-scenario `medianDepth` by party size, base against new.
- How many runs reach and clear dungeon N: `dungeonsCleared >= N-1` and `>= N`. Clear rate = cleared / reached.
- Where parties die: count `(endThemeId, endDepth, endRoomType)` for wipes inside the dungeon you changed. This
  shows whether a boss or the ordinary fights are the wall.
- For a theme: first-dungeon clear rate (`dungeonsCleared >= 1`) and median `reachedDepth` per party, next to the
  reference themes.
- For a set of rollable modifiers: ablate. Make one modifier non-rollable at a time, rebuild, rerun the matrix, and
  compare medians, so you know which one moves the numbers.

Example skeleton:
```python
import json
from collections import Counter
rs = [r for s in json.load(open('/tmp/eb-new.json'))['scenarios'] if s['policy'] == 'tactical' for r in s['results']]
reached = [r for r in rs if r['dungeonsCleared'] >= 4]
print(len(reached), sum(r['dungeonsCleared'] >= 5 for r in reached))
print(Counter((r.get('endThemeId'), r.get('endDepth'), r.get('endRoomType')) for r in reached if r['dungeonsCleared'] == 4).most_common(15))
```

Things to keep in mind:

- Crossroads choices are seeded per run, so every composition with the same seed sees the same theme sequence.
  Adding or removing a theme reshuffles them, and one hard seeded dungeon can move totals for every party at once.
  Before you blame a rule, check whether one theme or dungeon dominates the deaths, and rerun with another
  `-first-seed` or more `-runs`.
- Reference points (ADR 0033): about 70% of tactical parties that reach an ordinary fifth dungeon clear it; about
  40% clear a capstone castle; tactical medians are roughly 5 floors solo and 15–20 for parties. New ordinary themes
  should clear in the same band as the existing themes.
- Bonuses compound. Extra depth, +damage on every move, +health and bigger encounters together overshoot quickly.
  Change one lever at a time, rerun, and note each step. A prototype that put seven rule-changing floor debuffs in
  the roll pool at once halved four-player depth (ADR 0033); add such things one at a time.

## 4. Tune, then lock it in

- Tune with constants and catalog data, not health inflation. Prefer a boss's mechanics, encounter composition and
  pool placement (standard or heavy) over raw numbers.
- Run `GOTOOLCHAIN=local go test ./internal/game/` after every change. `TestTacticalPlayUsuallyClearsTheFirstFloor`
  is the coarse guard: at least 75% of tactical parties must clear floor one.
- If you changed art, also run `npm run art:verify` and `npm run art:rooms:verify`.

## 5. Record it

- In the ADR's Consequences, record: the matrix size, the before and after figures for each lever you tried (the
  rejected first draft too), which encounters or bosses end the most runs, and any open questions such as seed noise.
- Add any open tuning work to `ROADMAP.md` as an unchecked item.
- In the PR body, list the balance numbers and say which checks ran locally and which only CI can run (httpapi and
  the PostgreSQL integration tests, and the frontend `tsc` build when `node_modules` cannot be installed).
- CI's `balance.yml` reruns both suites on the PR and compares against the last successful main baseline. Check
  that the "Seeded balance scenarios" job passes.
