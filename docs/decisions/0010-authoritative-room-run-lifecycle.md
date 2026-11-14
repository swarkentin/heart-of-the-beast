# ADR 0010: Persist the authoritative room and run aggregate

- Status: Accepted
- Date: 2026-11-14

## Context

The Go service needs to move beyond a process health endpoint and own the gameplay state that clients currently simulate. The first useful vertical slice is a room that can start a solo dungeon run, validate player commands, move between encounters, and recover the latest state after a client reconnect or server restart. The model must not make spectators into players and must remain extensible to small parties.

## Decision

- Model a room as the durable aggregate boundary. It owns room identity/code, player membership and credential hashes, run state, and a monotonically increasing version.
- Model a run with an explicit phase, current room, dungeon room graph, encounter state, and player state.
- Keep transitions in a pure Go domain package. HTTP handlers authenticate and translate requests into commands; repositories persist the aggregate.
- Use PostgreSQL JSONB snapshots for the initial aggregate, with optimistic version checks on writes. Use the same schema locally and with Neon. Keep the repository interface independent of PostgreSQL.
- Generate player and spectator bearer credentials independently. Persist only SHA-256 token hashes. Player endpoints and spectator snapshot endpoints have separate authorization paths; spectators have no player ID and cannot submit commands.
- Start with a deterministic three-encounter dungeon and a small command vocabulary to exercise the complete solo lifecycle. Expand content and combat mechanics only after the server-owned loop is integrated with the client.
- Keep room state and command handling transport-independent. WebSockets, party action windows, join-by-code, token rotation, and event sourcing are not prerequisites for this first slice.

## Consequences

- A reconnect can fetch the latest durable snapshot from any backend process after restart.
- Optimistic concurrency rejects stale concurrent writes instead of silently losing a command.
- The JSONB snapshot is intentionally simple and portable, but does not yet provide an event log, fine-grained querying, or automated schema evolution for nested domain fields.
- The first implementation proves solo authority and the spectator trust boundary; it does not yet deliver a complete multiplayer or realtime experience.
