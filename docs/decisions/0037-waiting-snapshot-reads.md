# 0037: Snapshot reads wait for the room to change

Status: accepted

## Context

The game felt laggy on the hosted server, worst in a party. Two causes, measured against the live server:

- **Every poll wrote to the database.** Banking run XP during a run (#156) ran one transaction per player on every request that passed through `awardRunProgress`, including the plain snapshot reads each client sent every 750 ms in combat. A poll took about 150 ms before the first fight was won and about 400 ms after; with four players polling, that work multiplied and queued behind 8 database connections.
- **Clients learned of changes on a timer.** Another player's action, or a round's result, reached you only on your next poll: up to 750 ms in combat and 1.5 s elsewhere, plus the request itself.

## Decision

**Bank XP only when the run has earned more.** The handler remembers, per run, the XP it has already banked for every player and skips the database when nothing new was earned. It is a process-local optimisation: `AwardRunXP` is idempotent, so a restart or a second instance just banks the same total once more. An award that fails is not remembered, so the next request retries it.

**Snapshot reads wait (long polling).** `GET /rooms/{id}?after=<version>` and `GET /spectate/{id}?after=<version>` hold the request open until the room's version passes `<version>`, the room's next round, vote or camp deadline is due (the server then advances it and answers with the result), or 15 seconds pass. Without `after`, a read answers at once, as before. Every room save in the API goes through `saveRoom`, which wakes the room's waiting readers. Waiting readers hold no database connection.

The client asks for what comes after the newest version it holds and starts the next read as soon as one answers. A quick answer with nothing new (a server that does not wait) or a failure falls back to a read every 1.5 s, so the loop cannot spin.

The database pool also keeps all 8 connections idle instead of 2, since opening a connection to Neon costs several round trips.

## Alternatives

- **WebSockets or Server-Sent Events.** These are lower overhead per update, but they need a second transport, reconnect handling and a check that Render's `/api` rewrite proxy does not buffer streams. Long polling reuses the authorised snapshot endpoints and works through the proxy unchanged. Revisit if updates become frequent enough that a request per change matters.
- **Postgres LISTEN/NOTIFY for wake-ups.** It would wake readers on every instance, but Neon's pooled connection string (PgBouncer in transaction mode) does not support LISTEN. One API instance serves the game today.

## Consequences

- A party sees each other's actions and every round's result within one request of it happening (about 20 ms on the local stack), not on the next poll.
- Wake-ups are in-process. During a rolling deploy, a save made by the other instance reaches a waiting reader at the room's next deadline or within 15 s. Correctness never depends on the wake-up.
- Presence (online/disconnected) changes with time, not with a save, so in a room with no deadlines it can show up to 15 s late.
- Database latency is still paid on every request. Keep the Render service and the Neon database in the same region.
