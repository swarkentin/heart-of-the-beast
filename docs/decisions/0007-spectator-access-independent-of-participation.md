# ADR 0007: Spectators are independent of game participation

- Status: Accepted
- Date: 2026-11-14

## Context

Heart of the Beast needs a spectator/cast experience for televisions, Discord streams, and other shared displays. A spectator may be watching a solo run or a multiplayer party without wanting to play. Requiring spectators to join the party, create a character, or consume a player slot would make this use case unnecessarily difficult and would couple presentation to gameplay membership.

The spectator experience also needs to remain safe and predictable: viewers should see the live run but must not be able to change its outcome.

## Decision

- Spectating is a distinct session access mode, separate from player membership.
- A spectator can open a dedicated viewing link or scan a viewing QR code without joining the party, creating a character, or having an account.
- Spectator connections are read-only. They receive an authorized snapshot and stream of game-state updates/events, but cannot submit gameplay commands, vote, ready up, or otherwise affect the run.
- Spectators do not count toward party size, player limits, encounter scaling, player presence, voting thresholds, or turn/action deadlines.
- Spectators can connect, disconnect, and reconnect independently at any point in a run. Their lifecycle must not affect gameplay.
- The host controls whether spectator access is enabled and can share a room-scoped viewing link/token. The server validates that access and scopes it to the intended run.
- Player and spectator clients use separate permissions and presentation paths while observing the same authoritative game state. The spectator renderer may use its own cinematic camera and UI.
- The server must never trust the client to enforce read-only access; authorization is enforced at the server boundary.

## Consequences

- A solo player can have an arbitrary number of viewers subject to operational/resource limits, without changing the game party.
- A television or stream can display the run without becoming a player device.
- Player membership, game rules, and spectator access can evolve independently.
- The realtime protocol needs distinct player-command and spectator-subscription permissions. Spectator updates should expose only information intended for viewers.
- Viewing links/tokens need appropriate entropy, scope, revocation/rotation behavior, and transport security. Public discoverability is not implied; the host explicitly shares access.
- Spectator capacity limits, visibility of hidden information, and moderation controls remain implementation details to define before public deployment.
