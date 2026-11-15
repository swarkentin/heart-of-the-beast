# ADR 0015: Simultaneous combat action rounds

- Status: Accepted
- Date: 2026-11-14

## Context

The initial authoritative combat prototype resolves each player's attack immediately. That makes co-op combat order-dependent: the first player to click changes the encounter before other players can choose, and rapid clicks can resolve several turns before a teammate can participate. Combat needs a shared decision window that works for both solo and small groups without allowing an absent player to stall a run.

## Decision

- Combat is divided into server-owned rounds. Each living, non-departed player may submit one action per round.
- Co-op rounds have an eight-second action window. A round resolves as soon as all eligible players have submitted, or when the server observes that the deadline has elapsed.
- A player who has not submitted by the deadline defaults to defend. This includes temporarily disconnected players; they do not stall combat.
- Dead and explicitly departed players are excluded from the set of players whose actions are required. A dead or departed player cannot submit an action.
- Solo rounds resolve immediately after the solo player submits, without waiting for the co-op timer.
- Player actions are resolved in stable player-ID order so the same aggregate and submitted actions always produce the same result. Targets are validated when submitted and checked again when applied.
- The active round, deadline, and submitted actions are part of the persisted run aggregate. Player and spectator snapshots advance an expired round and persist the resulting state, so polling clients observe progress without a background worker.
- The initial slice supports attack and defend. Enemy intent telegraphs and enemy turn resolution, additional abilities/items/status effects, and richer action feedback are subsequent combat milestones.

## Consequences

- Co-op players choose within the same shared window rather than racing to resolve immediate turns.
- A disconnected or idle player can delay a co-op round by at most eight seconds; their fallback is defend.
- Solo combat remains immediate and does not inherit multiplayer waiting.
- Round state survives process restarts because it is stored with the room/run aggregate.
- Polling remains sufficient for this initial implementation; realtime delivery can be added independently later.
