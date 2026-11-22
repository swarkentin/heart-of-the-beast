# 0042: Startup reads survive a waking server

Status: accepted

## Context

Render spins an idle web service down and takes a while to start it again (ADR 0025). The static frontend is served at once, so the page can load and start asking `/api` for data while the API is still waking. Requests in that window fail with a proxy error or hit the 8 s client timeout.

The client loaded its reference data once per page and gave up on the first failure: the class and skill catalog (`GET /progression`), themes, sign-in providers, campaigns and the profile. Snapshot polling already retried (ADR 0014, ADR 0037), so a returning player rejoined their party and run as soon as the server woke, but without the catalog. The skill bar is built from the catalog, so it was empty for the rest of the visit, and a new party's lobby waited forever on "Preparing the class roster…". Only reloading the page fixed it.

## Decision

Every read the client makes once at startup goes through `loadUntilReady` (`frontend/src/startupLoad.ts`). It retries until the server answers, waiting 1, 2, 4, 8 and then every 15 seconds, and tries again sooner when the browser comes back online or the tab regains focus. Unmounting the screen aborts it.

While the catalog or profile is retrying, the shared error line says the server is waking; it is cleared when the read succeeds, unless something else has replaced it. The run screen says "Loading your skills…" instead of drawing an empty bar while the catalog is missing.

## Alternatives

- **Keep the server warm** (a paid always-on instance or an external ping). It hides the symptom on Render but not on any other host or after a deploy, and costs money. The client should cope with a slow server whatever the hosting.
- **Gate the whole app on a health check before rendering.** Simpler to reason about, but it would delay the title screen even when only one read failed, and still would not cover a read that fails after the check.

## Consequences

- A cold start or a deploy no longer needs a page reload: the catalog, profile and skill bar fill in on their own once the API answers.
- A server that stays down costs one small request per read every 15 s per open tab.
- New once-per-page reads should use `loadUntilReady`, not a bare `apiRequest` with a swallowed error.
