# ADR 0008: Separate frontend and backend repository workspaces

- Status: Accepted
- Date: 2026-11-14

## Context

The initial prototype placed the browser client and its build configuration at the repository root. The project is expected to add an authoritative game service soon. Keeping both applications' source, tooling, dependencies, and build workflows mixed at the root would make ownership and independent development harder to understand as the codebase grows.

The frontend currently uses React, TypeScript, and Vite. The backend language and framework have not been selected. The project should establish a clear boundary now without prematurely committing to a backend stack or introducing heavyweight monorepo tooling.

## Decision

- Place browser-client source and its application-specific configuration under `frontend/`.
- Reserve `backend/` for the future authoritative game service. Its language, framework, dependency management, and build tooling remain independent and undecided until selected deliberately.
- Keep the root `package.json` as a small npm workspace manifest for the frontend. Keep the npm lockfile at the repository root and expose predictable root-level development, build, and preview commands.
- Do not make the backend depend on Node.js, npm, or frontend build artifacts. It must be independently buildable and testable using its own toolchain.
- Keep repository-wide documentation and GitHub automation at the root. CI should have distinct frontend and backend checks as each application is introduced; frontend checks should not require a backend toolchain.
- Keep authoritative gameplay rules and important state transitions on the backend. The frontend sends player intent and renders validated state; it is not the source of truth for game outcomes.
- Share protocol schemas or generated transport types only when a concrete need emerges. Do not create a general-purpose shared code directory or move domain logic into frontend-owned packages merely to share implementation.
- Continue with simple directory boundaries and npm workspaces. Revisit more elaborate monorepo tooling only when actual coordination needs justify it.

## Consequences

- Frontend and backend code, dependencies, and build processes have clear ownership.
- Frontend development remains straightforward from the repository root with one npm install and familiar root-level commands.
- The root lockfile represents the npm workspace only; backend dependencies are managed by the backend's eventual toolchain.
- Backend language selection remains an explicit future decision rather than an accidental consequence of repository layout.
- CI can evolve independently for each application while retaining shared repository-level automation.
- Some protocol duplication may exist until a stable contract is needed; this is preferable to premature coupling between application implementations.
- Render deployment configuration and local database orchestration will be added with the backend vertical slice, not fabricated as empty scaffolding now.

## Implementation notes

- The frontend relocation and workspace setup are introduced in PR #4.
- The backend directory is initially documentation-only. Add service code, local database workflow, migrations, and backend CI when the backend stack and first server-side slice are selected.
- Preserve the modular-monolith direction in ADR 0001; separate directories do not imply separate services or microservices.
