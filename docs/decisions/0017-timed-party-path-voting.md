# ADR 0017: Timed party path voting

- Status: Accepted
- Date: 2026-11-14

## Context

Exploration offers consequential choices about which connected room the party enters next. Letting the first player to click immediately move the entire party does not provide a cooperative decision and can make the rest of the group feel bypassed.

Group decisions must have a deadline so disconnected or idle players cannot stall a run. Solo navigation must remain immediate and must not simulate a party vote.

## Decision

- When a cleared room offers multiple exits and at least two eligible players remain, the server opens a 15-second navigation vote.
- Each living, non-departed player may submit a path choice. The server records the vote and exposes vote counts and the shared deadline in room snapshots.
- The path with the most votes wins. If multiple paths share the highest vote count, the server randomly selects among those tied paths.
- If the deadline expires with no votes, the server randomly selects among all available exits so the run continues.
- A vote resolves early once every eligible player has voted. Disconnected players remain eligible but cannot stall the run beyond the deadline; players who have left or are dead are excluded.
- A room with one available exit does not need a vote. Solo choices resolve immediately.
- The server advances expired votes during normal player and spectator snapshot polling; no background worker or realtime transport is required.
- The player and spectator presentations show a compact countdown and current vote totals. The timer remains separate from interactive path choices and must not obscure them.

## Consequences

- Party navigation becomes an explicit cooperative decision instead of first-click-wins.
- The 15-second window is a starting value to validate through playtesting.
- Random tie-breaking avoids a persistent host privilege or arbitrary player ordering deciding a tied vote.
- Random no-vote fallback ensures an idle party cannot block exploration indefinitely.
- Vote state is persisted as part of the run aggregate and transitions remain server-authoritative.
