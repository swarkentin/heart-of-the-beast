# ADR 0009: Use Go for the authoritative backend

- Status: Accepted
- Date: 2026-11-14

## Context

The frontend has been separated into its own workspace, and the next milestone is an authoritative service for room lifecycle and gameplay state. The service needs a short edit/build/test loop, a small operational footprint, straightforward concurrency, and a portable deployment story. Future integrations such as Tailscale should remain possible without shaping the game domain around a particular provider.

## Decision

- Use Go for the backend implementation.
- Keep the backend as an independently buildable Go module under `backend/`; it does not depend on Node.js, npm, or frontend build artifacts.
- Start with the Go standard library for the HTTP process and health endpoint. Add libraries only when a concrete requirement justifies them.
- Keep the application a modular monolith. Domain rules and state transitions remain deterministic and independent of HTTP/WebSocket transport, persistence, and hosting.
- Use PostgreSQL as the persistence contract, with local PostgreSQL and Neon as the prototype environments. Introduce the driver, migration tool, and local orchestration alongside the first persistence-backed room/session slice.
- Treat Tailscale and other network integrations as optional adapters around the service, not dependencies of core gameplay or session rules.

## Consequences

- Go provides a lightweight service and a fast, simple compile/test loop without committing to a large framework.
- The standard library keeps the initial service dependency-free and makes the first backend CI checks inexpensive.
- PostgreSQL remains portable across local development, Neon, and self-hosted deployments.
- The initial health endpoint verifies process liveness only; database readiness will be a separate check once persistence exists.
- WebSocket protocol/library, authentication/token implementation, and Tailscale integration remain open until the room lifecycle and trust boundaries are designed.
