# 0040: The Heart of the Beast, a shared objective

Status: accepted (pool, API and title meter); proposed (the heart encounter)

## Context

Runs had no goal beyond themselves. The game is named for the heart of the Beast, and the prologue (ADR 0039) now says every party is out to destroy it. We want that to be literally true: one heart that every player on the server fights together, whose progress is visible on the title screen and that gives people a reason to come back.

## Decision

**One pool for everyone, kept forever.** Migration `0007_create_beast_heart.sql` adds a single-row `beast_heart` table (max health, damage, strikes) and `beast_heart_strikes`, keyed by (run, encounter), so each fight counts once however often it is saved, retried or polled. The pool starts at `game.BeastHeartInitialHealth` (1,000,000); after that it lives in the database, so retuning it is a data change. Damage past the pool is kept, so raising `max_health` never loses anyone's work.

**The game only reports; the server banks.** A run records each fight against the heart with `game.RecordHeartStrike` (`Run.HeartStrikes`). The HTTP layer banks strikes at the same moments it banks run progress (`awardHeartStrikes`, called from `awardRunProgress`), with an in-process cache so snapshot polls skip the database.

**Everyone can see it.** `GET /beast` is public and cacheable for 15 s. The title screen shows the heart above "Gather your party": a beating pixel heart (faster as it weakens), a 24-segment bar, the health left and the share remaining, and how many strikes parties have landed. The prologue's last panel shows the same meter.

**The heart encounter (proposed, next).** Every so often a dungeon's boss is replaced by the heart itself; an expensive shop item can force it to appear in the next dungeon. It is not beatable: it has the shared pool, fights for a fixed number of rounds with its own escalating mechanics, then withdraws, and the damage the party dealt is recorded as a strike. The party is rewarded for the fight as for a boss, so meeting it is never a loss. Open questions: the appearance chance and the item's price, the round limit, how to stop one strong build from dominating the pool (a per-fight cap or diminishing returns), the sprite and music, and what happens when the heart finally dies.

## Consequences

- The shared goal is in place and visible now; until the encounter ships no run records strikes, so the meter reads whole and invites the first strike.
- Contributions are anonymous totals. Per-profile contributions (a "your strikes" line, a leaderboard) can be added on the same strikes table later.
