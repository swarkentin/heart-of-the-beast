# Heart of the Beast

A cooperative, social-first roguelike dungeon crawler designed to be fun with one player or a small group of friends.

Players explore illustrated, high-definition pixel-art environments, make choices together, fight tactical encounters, discover gear and abilities, and return to safe hubs between increasingly dangerous expeditions.

## Repository layout

- `frontend/` — React, TypeScript, and Vite browser client.
- `backend/` — reserved for the future authoritative game service. The backend language and framework remain intentionally undecided.
- `docs/` — product design, architecture, prototype notes, and architecture decision records.
- `.github/workflows/` — repository automation and CI.

The frontend is an npm workspace. The backend will be independently buildable and will not depend on the Node.js toolchain.

## Design pillars

- **Solo-first compatible:** every core activity, encounter, puzzle, and progression path must work for one player.
- **Co-op by choice:** support small parties (initially 1–4) without requiring fixed roles or another player's presence.
- **Keep the adventure moving:** time-boxed decisions, safe defaults, reconnect support, and no idle-player deadlocks.
- **A living world:** varied themes, memorable enemies and bosses, optional side missions, and surprising encounters.
- **Accessible sessions:** target 20–40 minutes, with short dungeon levels and safe intermissions.
- **Open and self-hostable:** no account required to play; Render and Neon are the initial prototype hosting/database targets, with local development supported.

## Project status

Foundation documented; the first client-side combat-room prototype is in progress. It is a local UI simulation, not yet connected to an authoritative game server.

## Local frontend development

Requires Node.js 22 or later.

```sh
npm install
npm run dev
npm run build
npm run preview
```

Run these commands from the repository root. npm installs and manages the frontend workspace dependencies from the root lockfile.

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
