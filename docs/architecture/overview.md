# Architecture Overview

Status: proposed direction for the first playable slice. Render and Neon are the chosen prototype deployment targets; application architecture should remain portable.

## Principles

- Build a modular monolith first; do not introduce microservices before scale or team boundaries require them.
- Keep the game server authoritative. Clients send intent; the server validates and resolves outcomes.
- Keep core game rules deterministic and independent of transport, storage, and UI.
- Separate the player interface from the spectator/cast presentation while deriving both from the same game state.
- Keep application code independent of hosting and database vendor-specific APIs.
- Make local development a first-class workflow, not a second-class fallback.
- Avoid infrastructure that does not directly support a playable vertical slice.

## Logical components

- **Game domain:** characters, attributes, abilities, inventory, encounters, room graph, voting, rewards, and deterministic rule resolution.
- **Session/room orchestration:** create/join/leave, party membership, reconnect, safe checkpoints, timers, and run lifecycle.
- **Realtime gateway:** WebSocket or equivalent transport for player intent and state updates. Transport is an adapter, not the game rules engine.
- **Persistence boundary:** repository interfaces and migrations for durable records. Neon-hosted PostgreSQL is the prototype database. Active run state may initially live in memory, with an explicit understanding that process restarts can lose sessions until snapshots/recovery are implemented.
- **Content:** data-driven definitions for enemies, items, abilities, rooms, themes, bosses, and side missions.
- **Clients:** responsive player UI and a separate cast/spectator UI.

## Suggested implementation shape

Start with a modular monolith and clear package boundaries. A TypeScript web client is the current frontend preference. Go is a provisional backend candidate for fast iteration and straightforward concurrency; Rust remains an option.

Use PostgreSQL as the persistence contract, with Neon as the hosted prototype instance. Avoid coupling domain code to Neon-specific features; standard PostgreSQL connectivity and migrations should also work against a local PostgreSQL instance.

## Realtime and game state

The server owns the canonical run state and timestamps/deadlines. Clients submit commands such as choose direction, select combat action, use item, or ready up. The server validates commands against the current phase, resolves timeouts, and broadcasts state changes. Clients must not authoritatively decide combat results or rewards.

Every timed phase needs an explicit deadline and fallback behavior. Solo sessions should skip group coordination waits. Disconnects and idle players must not block state transitions.

## Persistence and deployment

### Prototype deployment

- Deploy the application to Render.
- Configure automatic deployment from the repository's `main` branch.
- Use Neon as the hosted PostgreSQL database.
- Keep secrets and connection strings in environment configuration; never commit credentials.
- Use versioned database migrations and ensure deploys apply compatible schema changes safely.

### Local development

- The full application must be runnable locally with documented setup commands.
- Support a local PostgreSQL instance (for example through Docker Compose) using the same schema and migrations as Neon.
- Keep configuration environment-driven so developers can switch between local PostgreSQL and Neon without code changes.
- Document any external services required for local development and provide sensible local defaults where possible.

Render and Neon are the selected prototype providers, not permanent architectural dependencies. Container-first deployment and standard PostgreSQL interfaces should keep self-hosting and future provider changes practical.

## Testing strategy

- Unit tests for deterministic game rules, encounter scaling, voting resolution, and solo alternatives to mechanics.
- Integration tests for room lifecycle, reconnect, phase deadlines, and persistence adapters against PostgreSQL.
- A small number of end-to-end tests for one-player completion and a small-group completion.
- Avoid tests that merely mirror implementation details or make refactoring expensive.

## Open decisions

- Backend language and framework.
- Frontend framework and build tooling.
- WebSocket library and message protocol.
- Active-run snapshot/recovery timing.
- Database schema and the point at which durable run persistence becomes necessary.
- Exact Render service topology and deployment configuration.
