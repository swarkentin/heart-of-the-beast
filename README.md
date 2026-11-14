# Heart of the Beast

A cooperative, social-first roguelike dungeon crawler designed to be fun with one player or a small group of friends.

Players explore illustrated, high-definition pixel-art environments, make choices together, fight tactical encounters, discover gear and abilities, and return to safe hubs between increasingly dangerous expeditions.

## Repository layout

- `frontend/` — React, TypeScript, and Vite browser client.
- `backend/` — independently buildable Go service; the future authoritative game server.
- `docs/` — product design, architecture, prototype notes, and architecture decision records.
- `.github/workflows/` — repository automation and CI.

The frontend is an npm workspace. The backend is a separate Go module with its own build, test, and CI workflow; it does not depend on Node.js.

## Design pillars

- **Solo-first compatible:** every core activity, encounter, puzzle, and progression path must work for one player.
- **Co-op by choice:** support small parties (initially 1–4) without requiring fixed roles or another player's presence.
- **Keep the adventure moving:** time-boxed decisions, safe defaults, reconnect support, and no idle-player deadlocks.
- **A living world:** varied themes, memorable enemies and bosses, optional side missions, and surprising encounters.
- **Accessible sessions:** target 20–40 minutes, with short dungeon levels and safe intermissions.
- **Open and self-hostable:** no account required to play; Render and Neon are the initial prototype hosting/database targets, with local development supported.

## Project status

The frontend has a client-side combat and directional-navigation prototype. The Go backend now has an independent service entry point, process health endpoint, container build, and automated tests. The next slice is the authoritative room/session model and its first persistence-backed lifecycle—not more isolated UI simulation.

## Local frontend development

Requires Node.js 22 or later.

```sh
npm install
npm run dev
npm run build
npm run preview
```

Run these commands from the repository root. npm installs and manages the frontend workspace dependencies from the root lockfile.

## Local backend development

Requires Go 1.25 or later.

```sh
cd backend
go run ./cmd/server
go test ./...
```

The backend listens on port 8080 by default; set `PORT` to override it. See [backend development notes](backend/README.md) for build and container commands.

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
