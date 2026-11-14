# ADR 0012: Browser views use the authoritative room API

- Status: Accepted
- Date: 2026-11-14

## Context

The player and spectator presentations were initially local prototypes with independent in-browser combat and navigation state. The Go service now owns room/run state and validates commands, so leaving the browser simulation active would create two competing sources of truth.

The first integrated slice needs to work in local development without introducing a separate frontend service, account system, or realtime transport before those are needed.

## Decision

- The browser treats the Go room API as the source of truth for run state. Player actions submit commands and render the returned room snapshot; the browser does not simulate combat or room transitions.
- The player client authenticates with its room-scoped bearer token. The browser stores the current guest session in local storage so refresh/reconnect can reload the authorized snapshot.
- The spectator client receives a distinct read-only bearer token. The host shares a spectator URL containing the room ID and token in the URL fragment; fragments are not sent in HTTP requests. Spectator pages call only the read-only snapshot endpoint.
- Both views refresh snapshots periodically for the initial integration. The server remains authoritative; a future realtime subscription transport can replace polling without changing game rules or presentation ownership.
- Frontend requests use a same-origin `/api` path. Vite proxies that path to the local Go service during development; production routing can provide the same origin contract.
- No player join-by-code, multi-player membership flow, spectator revocation control, or realtime event protocol is implied by this initial slice.

## Consequences

- Player and spectator screens now show the same persisted room/run state, including after refresh or server restart.
- A spectator can watch in a separate browser/device without taking a player slot or receiving a player credential.
- Local development can exercise the API without browser CORS configuration.
- Polling adds periodic requests and is intentionally temporary; reconnect/catch-up currently means fetching the latest snapshot.
- Local-storage bearer credentials are suitable only for this early guest prototype. Production hardening must consider token rotation/revocation, browser storage exposure, transport security, and room access controls.
- Combat rules and presentation remain intentionally simple; richer tactical turns and enemy intent data must be modeled by the server before the UI presents them as authoritative.
