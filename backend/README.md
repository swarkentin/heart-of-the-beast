# Backend

The backend is the authoritative game service. It is an independently buildable Go module and does not depend on the frontend's Node.js toolchain.

## Local development

Requires Go 1.25 or later.

From the repository root:

```sh
cd backend
go run ./cmd/server
```

The service listens on port 8080 by default. Set `PORT` to override it. The `GET /healthz` endpoint is a process-level health check; it does not imply database connectivity or game readiness.

Run checks:

```sh
gofmt -w .
go vet ./...
go test ./...
go build ./cmd/server
```

Build the container image from the repository root:

```sh
docker build -f backend/Dockerfile -t heart-of-the-beast-backend ./backend
```

## Architecture boundary

Keep deterministic game rules independent of HTTP/WebSocket transport and persistence. Transport handlers should translate authenticated client intent into application/domain calls; they must not become the source of game rules.

PostgreSQL remains the planned persistence contract. Database drivers, migrations, and local database orchestration will be introduced with the first persistence-backed room/session slice, so the schema and migration workflow are driven by actual game state rather than speculative scaffolding.
