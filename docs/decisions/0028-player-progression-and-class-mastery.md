# ADR 0028: Player progression, class mastery, and milestone rewards

- Status: Accepted direction
- Date: 2026-11-16

## Context

Heart of the Beast needs meaningful reasons to return between dungeon runs. Players should be able to build a long-term identity, make progress across the full class roster, and earn visible rewards without requiring an account.

ADR 0016 already defines persistent character identity, character levels, lifetime records, and cosmetic personalization. ADR 0021 defines the extensible class catalog and content-access unlocks. This decision clarifies the relationship between those systems and adds profile-wide class mastery and a persistent, battle-pass-style milestone reward track.

The progression system must complement the roguelike run loop without turning accumulated playtime into combat power. It must also survive character retirement and eventually migrate cleanly into an optional account.

## Decision

### Three separate progression scopes

1. **Adventurer profile progression** belongs to the player's persistent guest profile. It represents overall participation and unlocks profile-wide rewards, titles, name customization, and collection milestones.
2. **Class mastery** belongs to the profile, with an independent XP/level track for every class. Playing a class advances that class's mastery. Mastery survives character retirement and changing the active character. Its rewards are class expression: skins, portraits, entrance/flourish animations, profile badges, and titles.
3. **Character life and legacy** remain attached to an individual character. Character level, name, dungeon history, deaths, revivals, bosses, discoveries, and memorial status describe that adventurer's story. They are not a substitute for profile rank or class mastery.

Run-only levels, stats, talents, gear, and temporary effects remain a fourth, strictly temporary scope and reset according to the run rules.

### Rewards and fairness

- Persistent progression rewards are cosmetic, expressive, or content-access only. They never grant stats, stronger equipment, combat advantages, or exclusive gameplay mechanics.
- All nine launch classes remain available. Future class unlocks may use explicit profile milestones, achievements, quests, or mastery requirements, but unlocks grant access only.
- The reward track presents a sequence of milestones and rewards. The initial track does not expire; milestones remain available until earned.
- Reward definitions, eligibility requirements, XP curves, and unlock mappings are data-driven and use stable IDs.
- Meaningful participation earns progress even on an unsuccessful run. Rewards are based on validated accomplishments and contribution/eligibility, not raw action counts, repeated polling, or easily farmed trivial actions.
- A single accomplishment can advance profile progression, the active class's mastery, and character history where appropriate, but each award is granted at most once.

### Guest identity and persistence

- No account is required. The browser creates and retains an opaque guest-profile credential; the server uses it to identify the guest profile and remains authoritative for XP, levels, unlocks, and reward grants.
- Store the credential in browser-managed persistent storage (prefer IndexedDB or localStorage, not cookies as the progression database). It is a bearer secret and must not be exposed in URLs or logs.
- Store profile progression in durable server persistence, not only in browser storage. Browser storage identifies the guest and can cache presentation state; it must not be the authority for reward balances or unlock eligibility.
- Provide a user-visible export/recovery path before relying on guest profiles for substantial long-term progress. Browser data can be cleared or lost.
- Optional account linking later attaches the existing guest profile to an authenticated account without resetting, duplicating, or losing class mastery, profile rank, cosmetics, achievements, or character/memorial records.
- Keep profile identity separate from room membership and per-run player tokens. A guest profile can join different rooms and devices only after account linking; same-browser persistence is the initial promise.

### Award integrity

- The server derives eligible profile and class awards from authoritative run outcomes and validated accomplishment events.
- Every grant has a stable idempotency key tied to the profile, run, and accomplishment. Retries, reconnects, repeated snapshot polling, and duplicate commands cannot grant it twice.
- The active class is snapshotted in the run and determines which class mastery receives eligible XP. A player cannot change class mid-run to multiply a single accomplishment across several mastery tracks.
- XP curves and reward pacing are tuned through playtesting. Avoid grind based solely on hours played; meaningful milestones should provide clear, understandable progress.

## Initial implementation sequence

1. Add guest-profile identity and durable profile storage, keeping it independent from room/player session identity.
2. Add idempotent server-side progression grants and profile/class mastery state with deterministic, unit-tested XP transitions.
3. Surface profile rank, per-class mastery, progress-to-next-level, and recent unlocks in the lobby/profile experience.
4. Add a small first reward catalog with class skins/portraits and profile titles, plus a collection/equip experience.
5. Add export/recovery and account-linking contracts before optional account implementation.

Keep each step small and releasable. Do not block normal guest play if profile persistence is unavailable; make the state and recovery limitation clear rather than silently claiming progress was saved.

## Consequences

- Players have multiple long-term goals: overall progression, mastery of each class, and individual character stories.
- Class mastery encourages trying different classes without penalizing players who prefer one.
- Progress survives permadeath because mastery and profile rewards do not belong to a single adventurer.
- The backend needs durable guest profiles, secure guest credentials, idempotent reward grants, and a data-driven reward catalog.
- Local browser storage alone is insufficient as the source of truth for server-authoritative rewards. It is used to retain the guest credential and may cache profile data.
- The first reward track is persistent and non-expiring; additional tracks can be considered later without making existing rewards unavailable.
