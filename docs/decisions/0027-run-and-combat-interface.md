# ADR 0027: Run and combat interface

- Status: Accepted
- Date: 2026-11-15

## Context

ADR 0024 rebuilt the title screen, lobby, and class selection on generated pixel art. The run screen (exploring and
combat) was still the older interface: thin CSS borders, glyph buttons, a party list under the scene, the same
information in different places depending on the phase (exits over the scene, events in a panel, actions in a dock),
inline styles, and several layers of overrides in `styles.css`. A missed action silently became a defend. The target
is a classic dungeon-crawler frame: the party on the borders, the room in a framed viewport, a log, and tactile
controls, working equally for one player and for four.

## Decision

**One home for each kind of information.** The run screen (`frontend/src/run/`) is a fixed frame:

| Where | What |
| --- | --- |
| Left and right borders | Party portraits. You are always top-left; the rest fill left-top, right-top, left-bottom, right-bottom. |
| Viewport | The room, the enemies, and each enemy's telegraphed move (selectable to target). |
| Bottom left | The log. |
| Bottom right | What you can do now: combat actions, path vote, room choice, descent vote, or run over. |

Exits, room events, and descent choices moved out of the scene and into the command panel, so nothing interactive
overlays the art and the primary action is in the same place on every screen size.

**Party size.** Solo uses one wider border with a larger portrait; with one card per border the card also lists the
class's signature and passive. Three and four players stack two cards per border.

**Phones.** Below 900 px nothing scrolls, so the playfield never leaves the screen. From the top: the viewport (it
takes whatever height is left), the party as one strip of compact cards (head-and-shoulders portrait with status and
round badges over it, health under it), the last two lines of the log, and the command panel at the bottom where
thumbs reach. The layout was sized for an iPhone 13 in Safari (390x664 visible). A phone on its side is too short for
the stack and scrolls instead.

**Portraits.** Each card shows the animated hero, health, level, stats, statuses, the enemy moves aimed at that
player, and the player's round state (choosing, ready with the chosen action's icon, auto-defended, away, down).
Portraits react when an effect lands: the stage reports per-player impacts at the impact frame (`onPartyImpact`), so
the hurt animation, heal overlay, and floating numbers stay in step with the enemy animation. The body-language row
comes from health (`injured` at 35% or less, `down` at zero); overlays come from the combat state (guard, ward,
resolve and arcane charge).

**Hero art.** Every hero sheet gains `hurt`, `injured`, `poisoned`, and `down` rows. Status effects that can combine
are separate overlays in `ui/status-fx.png` (heal, guard, ward, buff, poison, sleep) layered on the hero cell. Poison
art is ready, but no rule applies poison yet, so nothing shows it.

**Actions.** Actions are bitmap buttons with an icon, a number key, and a one-line effect. Pressing one depresses it
at once (optimistically, before the server answers) and it stays pressed and outlined as "locked in" while the others
dim; a rejected command releases it. Keys 1-9 choose, arrow keys change target, and phones get a short vibration.
Abilities aimed at an ally are chosen by selecting that ally's portrait.

**Automatic actions.** Combat events now carry `actorId` and `auto` on defends. When a player's timer runs out the
server's message says so, the log line is highlighted with an hourglass, the player's portrait is marked
`AUTO-DEFENDED` until they act again. For the player themselves the cue is on the Defend button, the action the
server will take: it pulses over the last three seconds ("Automatic in 3"), then shows as pressed and marked
`AUTOMATIC` while the round resolves. An earlier banner over the viewport was removed because it lingered and covered
the scene.

**Log.** The client keeps the last 80 lines across rounds (the server only returns the latest round), relabels
"Adventurer N" to the portrait labels ("You", "P2 Arcanist"), and colours lines by what happened. It is an
`aria-live` log, replacing the hidden impact list.

**Scale.** The run screen uses the interface kit at 2x. On screens of at least 1900x1000 the whole board is zoomed
1.5x (art lands on 3x), and 2x from 2540x1380, so text and art grow together and stay on the pixel grid.

**Polling.** Snapshot polling runs every 750 ms during combat (1500 ms otherwise), because a round that ends at its
deadline is only revealed by a snapshot.

**Code.** `App.tsx` keeps the session, polling, and commands. API types moved to `api.ts`. `styles.css` is reduced to
the page base and sound settings; the old run-screen rules and `CombatSupport.tsx` are removed. The pure parts
(`party.ts`, `logLines.ts`) have unit tests (`npm run test:ui`).

## Consequences

- The interface is one system from the title screen to the end of a run, and every phase uses the same four regions.
- Faster polling during combat doubles snapshot requests while a fight is on. Realtime delivery would remove it.
- Timed conditions (poison, stun, buffs with durations) need a field on the player snapshot; the portraits take a
  pose and overlays per player, so adding one is a change in `party.ts` only.
- The spectator view draws the party as static hero frames in the scene; heroes do not animate on stage.
- Fonts still load from Google Fonts. The layout was checked with stand-in fonts of the same character widths, not
  the real ones.
