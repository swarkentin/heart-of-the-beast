# Architecture Overview

Status: proposed direction for the first playable slice. Specific language, framework, and hosting choices remain open until repository bootstrap.

## Principles

- Build a modular monolith first; do not introduce microservices before scale or team boundaries require them.
- Keep the game server authoritative. Clients send intent; the server validates and resolves outcomes.
- Keep core game rules deterministic and independent of transport, storage, and UI.
- Separate the player interface from the spectator/cast presentation while deriving both from the same game state.
- Keep hosting, database, and realtime transport behind replaceable boundaries where practical.
- Avoid infrastructure that does not directly support a playable vertical slice.

## Logical components

- **Game domain:** characters, attributes, abilities, inventory, encounters, room graph, voting, rewards, and deterministic rule resolution.
- **Session/room orchestration:** create/join/leave, party membership, reconnect, safe checkpoints, timers, and run lifecycle.
- **Realtime gateway:** WebSocket or equivalent transport for player intent and state updates. Transport is an adapter, not the game rules engine.
- **Persistence boundary:** repository interfaces for optional accounts and durable records. Active run state may initially live in memory, with an explicit understanding that process restarts can lose sessions until snapshots/recovery are implemented.
- **Content:** data-driven definitions for enemies, items, abilities, rooms, themes, bosses, and side missions.
- **Clients:** responsive player UI and a separate cast/spectator UI.

## Suggested implementation shape

Start with a modular monolith and clear package boundaries. A TypeScript web client is the current frontend preference. Go is a provisional backend candidate for fast iteration and straightforward concurrency; Rust remains an option. Use a relational persistence adapter only when needed by the first slice. PostgreSQL is a reasonable portable choice, but no cloud provider or managed database is selected.

## Realtime and game state

The server owns the canonical run state and timestamps/deadlines. Clients submit commands such as choose direction, select combat action, use item, or ready up. The server validates commands against the current phase, resolves timeouts, and broadcasts state changes. Clients must not authoritatively decide combat results or rewards.

Every timed phase needs an explicit deadline and fallback behavior. Solo sessions should skip group coordination waits. Disconnects and idle players must not block state transitions.

## Persistence and deployment

Keep the domain independent of any provider-specific database or hosting SDK. Start with the smallest persistence needed for the vertical slice; document the recovery limitations of in-memory active sessions. Container-first deployment and environment-driven configuration should make local development and self-hosting straightforward.

## Testing strategy

- Unit tests for deterministic game rules, encounter scaling, voting resolution, and solo alternatives to mechanics.
- Integration tests for room lifecycle, reconnect, phase deadlines, and persistence adapters.
- A small number of end-to-end tests for one-player completion and a small-group completion.
- Avoid tests that merely mirror implementation details or make refactoring expensive.

## Open decisions

- Backend language and framework.
- Frontend framework and build tooling.
- WebSocket library and message protocol.
- Active-run snapshot/recovery timing.
- Database schema and the point at which persistence becomes necessary.
- Hosting/deployment target.
