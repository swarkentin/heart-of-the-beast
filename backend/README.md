# Backend

The Go backend is the authoritative game service. It is an independently buildable module and does not depend on the frontend's Node.js toolchain.

## Local development

For the full local stack, install Docker Desktop, Node.js 22+, and Go 1.25+, then follow the root [local development guide](../README.md#local-development). The root scripts start PostgreSQL, apply pending migrations, and launch the backend and frontend together.

To run only the backend manually, start PostgreSQL with Docker Compose. The backend applies pending migrations automatically before it starts accepting requests:

~~~sh
docker compose up -d --wait postgres
~~~

Then start the service:

~~~sh
cd backend
DATABASE_URL="postgres://heart:heart@localhost:5432/heart_of_the_beast?sslmode=disable" go run ./cmd/server
~~~

The service listens on port 8080 by default; set PORT to override it. GET /healthz checks process liveness; GET /readyz checks database readiness. The server requires a reachable PostgreSQL database and successfully applied migrations before it starts accepting requests. Migration files are embedded in the binary, serialized across instances with a PostgreSQL advisory lock, and each migration is recorded transactionally in schema_migrations.

## Initial room API

- POST /rooms creates a room and returns its player and spectator bearer tokens. Tokens are shown once; only their SHA-256 hashes are stored.
- GET /rooms/{id} returns the player-authorized room snapshot.
- POST /rooms/{id}/start starts the host's solo run.
- POST /rooms/{id}/return-to-lobby lets the host end a completed or failed run and return the existing party to its lobby without changing the room code or active player credentials.
- POST /rooms/{id}/commands accepts validated gameplay commands.
- GET /spectate/{id} returns a read-only snapshot using the separate spectator token. Spectator credentials cannot submit player commands.

Send credentials in Authorization: Bearer <token>. The initial deterministic dungeon has three encounters to exercise combat, directional transitions, and run completion. The room aggregate is persisted as JSONB with optimistic version checks, so reconnecting clients can fetch the latest snapshot after a process restart. This is an initial persistence boundary, not yet an event log or realtime subscription protocol.

Example command bodies:

~~~json
{"type":"combat","action":"attack","targetId":"sentinel"}
{"type":"choose_exit","exitId":"north"}
~~~

## Checks

~~~sh
gofmt -w .
go vet ./...
go test -race ./...
go build ./cmd/server
~~~

Build the container from the repository root (the image includes the embedded SQL migrations):

~~~sh
docker build -f backend/Dockerfile -t heart-of-the-beast-backend ./backend
~~~

## Architecture boundary

Domain transitions are deterministic and independent of HTTP and storage. The repository interface has in-memory and PostgreSQL implementations; PostgreSQL is the runtime store. SQL migrations are versioned in migrations/ and the backend applies them at startup; local development tooling uses the same schema_migrations ledger. Keep future WebSocket, party coordination, and spectator streaming adapters outside the domain package.
