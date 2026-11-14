# Backend

Reserved for the authoritative game service.

The backend will be independently buildable and deployable, with its own language, dependency management, tests, and CI job. The language and framework remain undecided; do not introduce backend scaffolding until that decision is made and the first server-side vertical slice is ready.

Gameplay rules and important state transitions will be authoritative on the server. The browser client will send player intent and render validated state.
