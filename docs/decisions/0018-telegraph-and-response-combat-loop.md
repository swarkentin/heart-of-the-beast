# ADR 0018: Telegraph-and-response combat loop

- Status: Accepted
- Date: 2026-11-15

## Context

The shared action-round foundation currently supports player attacks and defense, but enemies do not yet act. Without a visible threat and a consequence for each round, combat is only a synchronized target-clicking exercise. The next step should add tactical choices without requiring complex roles, hidden threat systems, or large ability lists.

## Decision

- Every living enemy has one server-generated intent before the player action window opens. An intent includes a readable move label, damage, and either one targeted living player or all living players.
- Enemy intent targets rotate deterministically through the living party. The target is visible in both player and spectator views; there is no hidden aggro or random target selection in this slice.
- Players choose one action per round: Strike (10 damage to one living enemy), Defend (blocks up to 6 damage from the next incoming hit), or contextual Interrupt (cancels one explicitly interruptible enemy intent and deals no damage).
- Co-op retains the shared eight-second action window and defaults missing actions to Defend. Solo actions resolve immediately.
- The server resolves player actions in stable player-ID order, then surviving enemies resolve their intents. If players defeat an enemy before its turn, that enemy's intent is canceled.
- Initial enemy behaviors are:
  - Restless Sentinel: 4-damage single-target Strike.
  - Drowned Scout: 3-damage single-target Quick Jab.
  - Reliquary Guardian: alternates 8-damage Heavy Blow and 4-damage Stone Strike.
  - Crypt Warden: 5-damage Soul Drain against one player, restoring up to 2 enemy health; Soul Drain is interruptible. Every third turn, 3-damage Soul Sweep against all living players.
- Guard applies to one incoming hit. For a party-wide intent, each player independently applies their own guard.
- The run ends in defeat when no living, non-departed players remain. Boss defeat remains the victory condition.
- The run aggregate retains a bounded set of recent combat events so player and spectator clients can explain damage, mitigation, defeats, and knockouts without relying on client-side simulation.

## Consequences

- Players can make a meaningful, readable choice between dealing damage and mitigating an announced threat.
- Enemies have distinct patterns without introducing complex status systems or class requirements.
- The same rules work solo and in co-op; party size changes who can be targeted, not the basic action vocabulary.
- Values are provisional and should be tuned through solo, duo, and four-player playtests.
- Contextual interrupts are the first tactical counter; healing, consumables, multi-enemy formations, status effects, and richer boss phases remain future extensions.
