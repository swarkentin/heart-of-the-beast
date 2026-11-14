# Heart of the Beast

A cooperative, social-first roguelike dungeon crawler designed to be fun with one player or a small group of friends.

Players explore illustrated, high-definition pixel-art environments, make choices together, fight tactical encounters, discover gear and abilities, and return to safe hubs between increasingly dangerous expeditions.

## Repository layout

- `frontend/` — React, TypeScript, and Vite browser client.
- `backend/` — independently buildable Go service; the authoritative game server.
- `scripts/` — cross-platform local development tooling.
- `docs/` — product design, architecture, prototype notes, and architecture decision records.
- `.github/workflows/` — repository automation and CI.

The frontend is an npm workspace. The backend is a separate Go module with its own build, test, and CI workflow; it does not depend on the frontend's Node.js toolchain.

## Design pillars

- **Solo-first compatible:** every core activity, encounter, puzzle, and progression path must work for one player.
- **Co-op by choice:** support small parties (initially 1–4) without requiring fixed roles or another player's presence.
- **Keep the adventure moving:** time-boxed decisions, safe defaults, reconnect support, and no idle-player deadlocks.
- **A living world:** varied themes, memorable enemies and bosses, optional side missions, and surprising encounters.
- **Accessible sessions:** target 20–40 minutes, with short dungeon levels and safe intermissions.
- **Open and self-hostable:** no account required to play; Render and Neon are the initial prototype hosting/database targets, with local development supported.

## Project status

The Go backend owns the initial persisted room/run lifecycle, including player-authorized commands and a separately authorized read-only spectator snapshot. The browser UI is not connected to that API yet; that is the next integration milestone.

## Local development

Requires Docker Desktop with Docker Compose, Node.js 22+, and Go 1.25+. Start Docker Desktop before running the commands below. Run all npm commands from the repository root.

```sh
npm install
npm run dev:up
```

Open [http://localhost:5173](http://localhost:5173). The backend health endpoint is [http://localhost:8080/healthz](http://localhost:8080/healthz); PostgreSQL is available on `localhost:5432`.

The first start creates the PostgreSQL container and volume, waits for the database to become healthy, applies pending SQL migrations, and starts the Go backend and Vite frontend in the background.

| Command | Purpose |
| --- | --- |
| `npm run dev:up` | Start PostgreSQL, migrate, and start frontend/backend |
| `npm run dev:down` | Stop frontend/backend and PostgreSQL; preserve database data |
| `npm run dev:status` | Check whether each service is running and healthy |
| `npm run db:migrate` | Start PostgreSQL if needed and apply pending migrations |
| `npm run db:reset` | Stop the stack and recreate the local database (asks before deleting data) |
| `npm run build` | Build the frontend |

Application logs and process state are written under `.dev/` (ignored by Git). If startup fails, inspect `.dev/logs/backend.err.log` and `.dev/logs/frontend.err.log`.

The default local database is `heart` / `heart` on port 5432. You can override the backend connection string by setting `DATABASE_URL` before `npm run dev:up`. Do not point local development commands at the production database: `db:reset` permanently deletes the configured database volume and is intended only for the local Compose database.

## Backend checks

```sh
cd backend
go vet ./...
go test -race ./...
go build ./cmd/server
```

The backend listens on port 8080 by default; set `PORT` to override it. See [backend development notes](backend/README.md) for API details and container commands.

## Start here

- [Roadmap](ROADMAP.md)
- [MVP game design](docs/game-design/mvp.md)
- [Architecture overview](docs/architecture/overview.md)
- [Architecture decisions](docs/decisions/)

## Working agreements

- Work in small, focused pull requests.
- Keep main releasable; do not merge without explicit approval.
- Prefer playable vertical slices over speculative infrastructure.
- Keep gameplay rules deterministic and server-authoritative.
- Test important game rules, lifecycle/concurrency behavior, and critical player journeys.
- Record durable architectural decisions as numbered ADRs.
- Update the roadmap as scope and progress change.
