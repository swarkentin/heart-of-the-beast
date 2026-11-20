# ADR 0035: Persist real-run telemetry in PostgreSQL

- Status: Accepted
- Date: 2026-11-20

## Context

The balance simulator provides reproducible evidence about seeded policies, but it cannot show how real players choose builds, navigate encounters, abandon runs, or progress. The authoritative Go service persists room/run aggregates as PostgreSQL JSONB snapshots with optimistic room versions. The frontend combat log is only a rolling presentation layer and is not a source of truth.

## Decision

- Capture telemetry only from versioned writes to the production `rooms` aggregate. Simulation runs do not write to this table and therefore cannot pollute production telemetry.
- Use a PostgreSQL trigger so the room-state update and its telemetry snapshot/terminal record commit in the same transaction. A failed telemetry write rejects the room update rather than silently losing analytics.
- Append one structured `room_state_snapshot` event per persisted room version while a run exists. The payload contains the run snapshot and pseudonymous participant profile/build references, not the full room aggregate.
- Persist exactly one terminal run record for `completed` and `failed` outcomes, keyed by run ID. A primary key and conflict-safe insert make retries idempotent.
- Keep common analysis dimensions relational (timestamps, outcome, theme, depth, party size, seed and duration) and retain the full run state as JSONB for flexible analysis.
- Store no player/spectator bearer tokens, token hashes, display names, or other unnecessary personal information.

## Consequences

- Each successful versioned room transition is available for reconstructing the run timeline, including the current combat round actions and combat events present in that snapshot.
- The first implementation records authoritative state snapshots rather than a fully normalized semantic event for every domain action. This is deliberately compatible with the current aggregate architecture; a later iteration can add explicit domain-event emission without trusting client telemetry.
- Telemetry is committed atomically with the room snapshot. Database unavailability can therefore make a gameplay mutation fail, which is preferable to claiming an unrecorded run transition succeeded.
- The terminal record is immutable by convention and protected from duplicate insertion by its run ID primary key. Retention and export policies can be added after real usage and query needs are understood.
