# ADR 0008: Separate frontend and backend repository workspaces

- Status: Accepted
- Date: 2026-11-14

## Context

The project currently has a browser client but will soon add an authoritative game service. Keeping both concerns at the repository root would make ownership, tooling, and build boundaries increasingly unclear. At the same time, the project is early enough that introducing a complex monorepo framework or committing to a backend language would add unnecessary overhead.

The frontend currently uses React, TypeScript, Vite, and npm. The backend language and framework have not been selected.

## Decision

- Keep the project in one repository, with distinct top-level `frontend/` and `backend/` directories.
- Place the existing browser application and its Vite/TypeScript configuration under `frontend/`.
- Keep the root `package.json` as a lightweight npm workspace manifest, with the root `package-lock.json` managing frontend dependencies and root-level commands for common frontend development tasks.
- Keep backend source, dependency management, build, and tests self-contained under `backend/`. The backend must not depend on Node.js/npm or frontend build tooling.
- Do not select a backend language or framework as part of this repository-layout change. Choose it separately when the first backend vertical slice is ready to be implemented.
- Keep CI responsibilities distinct: frontend checks use the root npm workspace; backend checks will be added when a backend toolchain exists.
- Keep architecture/gameplay decisions independent of this folder layout. In particular, authoritative gameplay rules and state belong on the server, not in frontend code.
- Introduce shared protocol schemas or generated client types only when a concrete cross-boundary need exists. Do not create a generic shared-code directory as a dumping ground or make frontend implementation the source of truth for game rules.

## Consequences

- Frontend and backend can evolve and be built independently while sharing one issue/PR history and repository.
- Frontend dependency installation remains straightforward through one root npm lockfile.
- Backend contributors can use the language's native tooling without requiring Node.js.
- CI can grow by adding a backend job without entangling it with frontend dependency installation.
- A small amount of root-level npm workspace configuration remains, but application code and tool-specific configuration live with the application they serve.
- The backend stack, API/protocol design, and any shared schema generation remain separate decisions.
