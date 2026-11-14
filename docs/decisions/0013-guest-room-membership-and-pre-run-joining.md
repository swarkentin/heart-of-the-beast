# ADR 0013: Guest room membership and pre-run joining

- Status: Accepted
- Date: 2026-11-14

## Context

The authoritative room API currently creates a room with one host player and immediately starts the solo run from the browser. The next vertical slice needs real guest membership without requiring accounts, while keeping the room aggregate and server-issued credentials authoritative.

## Decision

- A room supports up to four player members, including its host.
- The host creates a room and shares its six-character, case-insensitive room code. Guests join by submitting that code; no account or external identity provider is required.
- Joining is permitted only while the room is in its lobby state, before the run starts. Mid-run joining is deferred until the game has explicit safe checkpoints and party-ready rules.
- Each member receives a distinct cryptographically random player ID and bearer token. Only a SHA-256 hash of each player token is persisted in the room aggregate.
- The host remains the room owner and is the only player authorized to start the run. All members may read the room snapshot and submit normal player commands once the run starts.
- Starting a run initializes player state for every room member. Spectators continue to use their separate read-only token and do not occupy a player slot.
- The browser persists each guest's own room/player credentials locally so separate browsers can independently reconnect to the same room.

## Consequences

- A host and up to three guests can gather in one lobby, then enter the same server-authoritative run.
- Room membership is persisted with the existing JSONB aggregate and optimistic version check; concurrent joins cannot silently overwrite one another.
- Room codes are convenient invitation credentials for discovery, not player authentication. A successful join issues a separate high-entropy player token.
- Presence/heartbeat, explicit leave, host transfer, token revocation, safe-checkpoint joining, and realtime notifications remain future work. Lobby and run snapshots currently update through the existing polling mechanism.
