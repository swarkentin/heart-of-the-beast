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

## Amendment 2026-11-15: observable, fail-fast startup

`npm run dev:up` was hard to diagnose: the backend ran through `go run`, so compile time counted against a 60-second health timeout with no output, a service that crashed on startup was only noticed when that timeout expired, a stale process on port 8080 could satisfy the health check, and a child process that exited before reading stdin could crash the script with an unhandled `EPIPE`.

- Startup is a numbered sequence (prerequisites, PostgreSQL, migrations, backend build, backend start, frontend start) with per-step timing and a heartbeat line every 5 seconds during long steps.
- Preflight checks report every problem at once: Docker engine not running, Go missing, `npm install` not run, ports 8080 or 5173 already in use.
- The backend is compiled with `go build` into `.dev/bin/` and that binary is run, so build errors and slow builds are separated from startup and health waits. The backend health timeout no longer includes compilation.
- The script tracks child exit and fails immediately with the tail of that service's logs; it also streams new log lines while waiting. Logs are truncated on each start so failures never show output from an earlier run.
- `--verbose` adds Go compiler package output. The command surface (`dev:up`, `dev:down`, `dev:status`, `db:migrate`, `db:reset`) and the one-command contract are unchanged.
