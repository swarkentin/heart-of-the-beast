# ADR 0019: Complementary multi-enemy encounters

- Status: Accepted
- Date: 2026-11-15

## Context

A single enemy creates a narrow decision: attack it or respond to its one telegraphed move. Combat needs focus-fire choices and overlapping threats without hiding intent details or making every encounter a larger health bar.

## Decision

- Introduce multi-enemy encounters gradually, starting with a two-enemy pairing in the Silent Reliquary.
- Pair the Reliquary Guardian's slower, heavier attack pattern with the Drowned Scout's lighter quick strike.
- Generate and display one independent intent per living enemy. Each intent keeps its own target and resolves independently after player actions.
- Defeating one enemy cancels only that enemy's intent; surviving enemies still resolve their announced moves.
- Keep the opening Watcher's Hall and Drowned Crossing encounters single-enemy for pacing and variety.
- Do not add three-enemy encounters until the interface can keep every intent legible. Tune encounter pressure at party sizes one, two, and four before broadening the pattern.

## Consequences

- Players can choose to focus fire and remove one threat, or split damage to manage multiple threats.
- Defend remains valuable but blocks only the next incoming hit, so it cannot automatically negate every enemy in a multi-enemy round.
- Solo players face the same two-threat decision; current damage and health values are provisional and must be playtested.
- Additional enemy combinations should be added through the combat roadmap rather than as isolated one-off mechanics.
