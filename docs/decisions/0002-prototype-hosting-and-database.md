# ADR 0002: Use Render and Neon for the Prototype

- Status: Accepted
- Date: 2026-11-14

## Context

The prototype needs a low-friction hosted environment for playtesting, while remaining straightforward to run locally and practical to self-host later.

## Decision

- Deploy the prototype application to Render.
- Configure automatic deployment from the repository's `main` branch.
- Use Neon-hosted PostgreSQL for the prototype's shared database.
- Keep local development fully supported, including a local PostgreSQL option using the same migrations and schema.
- Configure secrets and connection strings through environment variables; do not commit credentials.
- Keep application/domain code on standard PostgreSQL interfaces and avoid requiring Render- or Neon-specific APIs.

## Consequences

- We can get a continuously deployed shared prototype without giving up a useful local development loop.
- The hosted database is available across application deploys and restarts.
- We accept some provider configuration in deployment documentation and infrastructure, but not in core game logic.
- Active in-memory game sessions may still be lost on application restart until explicit snapshot/recovery support is implemented.

## Revisit when

Operational needs, cost, reliability, or self-hosting requirements justify changing providers. A provider change should not require rewriting game-domain code.
