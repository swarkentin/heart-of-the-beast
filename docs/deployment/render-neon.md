# Production deployment: Render + Neon

The root render.yaml defines two automatically deployed services:

- heart-of-the-beast: the Vite/React static frontend on Render's CDN.
- heart-of-the-beast-api: the Go API, built from backend/Dockerfile.

The frontend's /api/* requests are rewritten to the API service, so browser requests remain same-origin and do not require permissive CORS settings. Both services deploy after GitHub checks pass.

## One-time setup

1. Create a Neon project in a region close to the Render service. Keep the Neon project in a supported region and retain its default database and role.
2. In Neon, copy the pooled connection string (the hostname contains -pooler). It should use TLS, for example ...?sslmode=require. Do not commit it or put it in render.yaml.
3. In Render, create a Blueprint from this repository and select render.yaml. During the first sync, provide the Neon connection string for the API service's DATABASE_URL secret.
4. Deploy the Blueprint. Render creates the API and frontend services; the API applies database migrations before opening its listener.
5. Open the frontend service URL and create a room. Confirm /readyz on the API returns HTTP 200.

The API service is configured on Render's Starter plan so it does not spin down while players are using it. The static frontend is hosted on Render's CDN. Keep the API and Neon database in the same region where possible; Render's service region is selected when the service is first created and cannot later be changed in place.

## Ongoing operations

- Merge to main: Render waits for required GitHub checks, then deploys both services automatically.
- Database migrations: SQL files in backend/migrations/ are embedded in the API binary and applied at startup. Each migration runs in its own transaction and is recorded in schema_migrations. A PostgreSQL advisory lock serializes startup migrations if old and new instances overlap during a zero-downtime deploy.
- Failed migration: the new API instance refuses to start and remains unhealthy; the previous instance continues serving traffic. Fix the migration and deploy again. Never edit a migration that has already been applied; add a new migration instead.
- Secrets: rotate DATABASE_URL in the Render dashboard. Never add credentials to source control or frontend build variables.
- Backups: enable/verify Neon restore points and periodically test restoring to a separate Neon branch before relying on production data.

## Deploy and game continuity

The API stores each room/run snapshot in PostgreSQL, not process memory. A replacement instance can therefore serve the next poll/command against the latest committed state. Render's health check uses /readyz, which verifies database connectivity; /healthz remains a process-liveness check.

On SIGTERM the API stops accepting new connections and gives in-flight requests up to 25 seconds to finish. Render is configured with a 30-second shutdown allowance. The service does not hold game state only in memory, and a player can reconnect using the existing room credentials.

Keep schema changes expand/contract compatible with the old and new application versions during rolling deploys:

1. Add nullable columns/tables or otherwise additive structures first.
2. Deploy code that can read both old and new representations; backfill separately if needed.
3. Switch writes and reads only after all old instances are gone.
4. Remove obsolete schema in a later deploy.

Do not rename/drop columns or change JSONB shapes in a migration that can overlap an old application instance. Current gameplay is snapshot-persisted and polled; this is not yet a durable event log or a guarantee that a command interrupted by a process kill is replayed. A request that committed before shutdown is retained; clients should retry/re-fetch state after a disconnect.
