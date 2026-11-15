# ADR 0025: Render deployment and automatic Neon migrations

- Status: Accepted
- Date: 2026-11-15

## Context

The Go API and PostgreSQL room/run persistence are ready for a hosted prototype. Render is the deployment target and Neon is the managed PostgreSQL provider. Deploys must require minimal operator work and must not discard active runs. Render rolling deploys can briefly overlap old and new processes, and the platform sends SIGTERM before terminating an old instance.

## Decision

- Define the API and static frontend in the root Render Blueprint. Deploy automatically from main only after GitHub checks pass.
- Use Neon PostgreSQL as the source of truth. The API receives DATABASE_URL as a Render secret; use Neon's pooled TLS connection string and keep the connection pool small.
- Embed SQL migrations in the Go API binary. Apply pending migrations before listening, using a PostgreSQL advisory lock to serialize concurrent startup and a transaction per migration. Track filenames in schema_migrations, matching the local development tooling.
- Refuse to start if the database is unavailable or any migration fails. This prevents a new instance from receiving traffic with an incomplete schema.
- Keep /healthz as process liveness and /readyz as database readiness.
- On SIGTERM, stop accepting new requests and drain in-flight HTTP work for up to 25 seconds. Configure Render with a 30-second shutdown allowance.
- Keep migrations backward-compatible with the previous application version using expand/contract sequencing. Do not combine destructive schema changes with the first deploy that stops using the old shape.
- Persist authoritative room/run snapshots in PostgreSQL so a replacement process can serve reconnecting players from the latest committed state.

## Consequences

- After the one-time Neon secret is configured in Render, deployments and migrations require no manual command or database console work.
- A migration failure leaves the previous healthy instance serving traffic while the new instance fails readiness.
- A SIGTERM does not guarantee a command interrupted by a hard kill is replayed; clients must re-fetch their persisted snapshot after reconnecting.
- The current polling/snapshot model is restart-tolerant but not a durable event log. Future realtime subscriptions, command idempotency, and stronger handoff semantics remain separate work.
- Render API compute should not spin down during active sessions. The Blueprint uses a paid Starter instance; the static frontend remains on the CDN.

## Operational follow-up

Create the Neon project, select a region close to Render, provide the pooled DATABASE_URL during the initial Blueprint sync, and verify a room can be created and recovered after an API restart. See docs/deployment/render-neon.md.
