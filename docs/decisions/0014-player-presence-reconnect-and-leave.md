# ADR 0014: Player presence, reconnect, and graceful leave

- Status: Accepted
- Date: 2026-11-14

## Context

Room membership now supports multiple guest players, but the server cannot distinguish an active browser from a temporarily disconnected one. A player also has no explicit way to leave and revoke their room credential. Presence must remain server-authoritative and must not turn spectators into party members.

## Decision

- Player clients send an authenticated heartbeat every 10 seconds. The server considers a player online while their last heartbeat is no more than 30 seconds old; after that they are shown as disconnected.
- A disconnected player remains a room member and retains their player identity, run state, and credential. A later heartbeat restores online presence without creating a new character or consuming another slot.
- Explicit leave is authenticated, records a permanent left state, and revokes the player's bearer token. A departed member no longer consumes one of the four lobby slots.
- A departed player's historical roster entry and run state remain in the aggregate for now; the player cannot read snapshots or submit commands after leaving.
- The host has no automatic transfer. A host disconnect does not stop an already-started run; a host who explicitly leaves an unstarted lobby leaves that lobby without an owner who can start it. Host transfer is a separate future decision.
- Presence is exposed as derived online, disconnected, or left status in player and spectator snapshots. Spectators do not heartbeat and never count toward party membership.
- Snapshot polling remains the transport for now. A brief network interruption does not clear local credentials; normal polling and heartbeat resume when connectivity returns.

## Validation

- The API's clock is injectable so presence timeout behavior can be tested deterministically without waiting 30 seconds.
- A PostgreSQL-backed HTTP integration test covers room creation, guest joining, online/disconnected/reconnected transitions, spectator read-only access, explicit leave, token revocation, persisted state after handler recreation, and lobby slot reuse. CI runs it against a PostgreSQL service on every pull request.
- Unit tests continue to cover fast, isolated behavior; manual checks are reserved for visual and experiential qualities that automation cannot judge reliably.

## Consequences

- A refresh or short network interruption can reconnect as the same player.
- The UI can distinguish active, temporarily disconnected, and departed party members.
- Explicit leave frees a pre-run lobby slot and immediately invalidates that player's token.
- The 30-second timeout is a presentation/presence threshold, not a gameplay timer. No combat turn or party decision may wait on a disconnected player.
- Realtime subscriptions, host transfer, safe-checkpoint joins, and automatic character control after long disconnects remain future work.
