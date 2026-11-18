# ADR 0034: Optional Discord sign-in for cross-device profiles

- Status: Accepted
- Date: 2026-11-17
- Builds on: [ADR 0028](0028-player-progression-and-class-mastery.md) (guest profiles and the account-linking promise), [ADR 0025](0025-render-neon-deployment.md) (Render deployment)

## Context

Guest profiles (ADR 0028) keep Adventurer Rank, class mastery and rewards on the server, but the only key to a
profile is a credential in one browser's storage. A player who switches from a laptop to a phone starts again, and
clearing browser data loses the profile. Phase 6 of the roadmap planned optional accounts for this.

The game is for small groups of friends, often playing together over Discord and sometimes streaming the
spectator view there (ADRs 0006 and 0007). The project also promises that no account is needed to play and that
the server is self-hostable.

Options considered: Discord, Google, Apple (only needed for a native iOS app), Twitch, Steam (only for a Steam
release), passkeys or email links (no third party, more UI work), a device link code that moves a guest profile
between devices without any provider, and hosted identity services (Clerk, Auth0, Supabase Auth).

## Decision

### Discord only, for now

- **Sign in with Discord** is the only sign-in provider. It fits where the players already are, and the same
  Discord application could later host the game as a Discord Activity.
- No device link code and no hosted identity service. Hosted services work against self-hosting.
- Sign-in stays optional. It is off unless `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` and
  `DISCORD_REDIRECT_URI` are all set, so a self-hosted server is guest-only by default. With it on, guests still
  play without signing in.
- Only the `identify` scope is requested. The game stores the Discord user ID and display name; Discord tokens are
  used once to look the user up and are never stored.

### Identity model

- A profile can have **external identities** (`profile_identities`): one per provider account, and at most one per
  provider for each profile. Other providers can be added later without changing this.
- A profile can have **several device credentials**. The first guest credential stays on `player_profiles`; each
  device that signs in to the account gets its own credential (`profile_credentials`). The browser keeps using a
  bearer profile credential for everything, exactly as before, so rooms, rewards and mastery checks are unchanged.
- The server runs the OAuth authorization-code flow itself (no new Go dependencies). The `state` is random,
  single-use, expires after 10 minutes, is stored only as a hash, and is bound to the guest credential that started
  it, so it cannot be completed from another browser.
- Discord redirects to the static site's `/auth/discord/callback` page. The browser posts the code to the API with
  its credential, so the API never needs its own public redirect.

### No merging: link, switch, or ask

When a device signs in:

1. **The Discord account is new to the game**: it is linked to this device's guest profile. Nothing else changes.
2. **The Discord account already owns this device's profile**: nothing changes.
3. **The Discord account owns another profile and this device's profile has no progress** (no Adventurer XP and no
   class-mastery XP): the device switches to the account's profile without asking.
4. **The Discord account owns another profile and this device's profile has progress**: the player chooses.
   - **Keep this device's progress** (abort): nothing is linked or changed.
   - **Use the Discord profile** (overwrite): the device switches to the account's profile. The local guest profile
     is left behind, not merged and not deleted; its old credential is dropped from the browser.

Profiles are never merged. Merging rewards would be safe because they only grow, but it adds rules (character
records, memorials, future spending) for a rare case, and a clear choice is easier to explain.

### Where sign-in is offered

- In the Profile dialog (title screen, lobby and run menus). It is only enabled outside a party, so a room seat never
  changes profile mid-run; the dialog says "Leave your party to sign in."
- A signed-in profile shows the Discord name in the same place.

## Consequences

- A player can carry rank, mastery and rewards to any device by signing in with Discord.
- Players without Discord, or on servers without it configured, keep today's single-browser guest profiles. The
  export/recovery item from ADR 0028 remains open for them.
- Choosing "Use the Discord profile" strands that device's guest progress. The dialog says so before the player
  chooses.
- There is no sign-out yet. A shared computer stays signed in until its browser data is cleared.
- Abandoned guest profiles are kept. A cleanup policy belongs with data export and deletion (roadmap Phase 6).
- The Render API service gains three optional secrets, and a Discord application must be registered with the
  production callback URI before sign-in works in production.
