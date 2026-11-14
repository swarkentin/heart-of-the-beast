# ADR 0008: Separate frontend and backend repository workspaces

- Status: Accepted
- Date: 2026-11-14

## Context

The initial prototype placed the browser client and its build configuration at the repository root. The project is adding an authoritative game service. Keeping both applications' source, tooling, dependencies, and build workflows mixed at the root would make ownership and independent development harder to understand as the codebase grows.

The frontend uses React, TypeScript, and Vite. The backend stack has now been selected in ADR 0009.

## Decision

- Place browser-client source and its application-specific configuration under `frontend/`.
- Keep the authoritative game service in `backend/` as an independently buildable Go module.
- Keep the root `package.json` as a small npm workspace manifest for the frontend. Keep the npm lockfile at the repository root and expose predictable root-level development, build, and preview commands.
- Do not make the backend depend on Node.js, npm, or frontend build artifacts. It is built and tested using Go's toolchain.
- Keep repository-wide documentation and GitHub automation at the root. CI has distinct frontend and backend checks; frontend checks do not require the Go toolchain.
- Keep authoritative gameplay rules and important state transitions on the backend. The frontend sends player intent and renders validated state; it is not the source of truth for game outcomes.
- Share protocol schemas or generated transport types only when a concrete need emerges. Do not create a general-purpose shared code directory or move domain logic into frontend-owned packages merely to share implementation.
- Continue with simple directory boundaries and npm workspaces. Revisit more elaborate monorepo tooling only when actual coordination needs justify it.

## Consequences

- Frontend and backend code, dependencies, and build processes have clear ownership.
- Frontend development remains straightforward from the repository root with one npm install and familiar root-level commands.
- The root lockfile represents the npm workspace only; backend dependencies are managed by Go modules.
- CI can evolve independently for each application while retaining shared repository-level automation.
- Some protocol duplication may exist until a stable contract is needed; this is preferable to premature coupling between application implementations.
- Render deployment configuration and local database orchestration will be added with the backend vertical slice, not fabricated as empty scaffolding now.

## Implementation notes

- The frontend relocation and workspace setup were introduced in PR #4.
- The initial Go service, health endpoint, container build, and backend CI are introduced in the Go backend foundation PR.
- Preserve the modular-monolith direction in ADR 0001; separate directories do not imply separate services or microservices.
- Backend language/tooling details are recorded in ADR 0009.
