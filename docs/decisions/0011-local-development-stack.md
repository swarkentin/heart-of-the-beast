# ADR 0011: Standardize the local development stack

- Status: Accepted
- Date: 2026-11-14

## Context

The project needs a repeatable local feedback loop for the React/Vite client and authoritative Go backend. Developers should not need to install PostgreSQL directly or manually apply SQL files, and local behavior should use the same database engine as the hosted prototype.

## Decision

- Use Docker Compose to run PostgreSQL locally. Keep the local database engine and schema aligned with the production PostgreSQL/Neon environment.
- Use a persistent named Docker volume so stopping the development stack does not erase local game data.
- Use a small Node.js orchestration script, exposed through root npm scripts, to start and stop the database, apply pending migrations, launch the backend and frontend, and report service health.
- Track applied SQL migration filenames in a `schema_migrations` table. Apply each migration transactionally and only once.
- Keep process state and application logs under the ignored `.dev/` directory.
- Make database reset an explicit, confirmation-gated destructive operation.

## Consequences

- A developer with Docker Desktop, Node.js, and Go can start the complete local stack with one command.
- The frontend and backend remain independently runnable; the orchestration script is convenience tooling, not a runtime dependency.
- Local development uses PostgreSQL rather than SQLite, reducing differences between development and production.
- Docker is required for the standard local stack, but not for building or testing the frontend or Go domain packages independently.
