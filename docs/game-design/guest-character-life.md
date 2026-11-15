# Guest Character Life and Legacy

Status: working design direction. Character persistence and exact record fields need implementation and playtesting.

## Character creation and selection

- A guest begins with a persistent local character identity, without needing an account.
- Character creation should feel like meeting a new adventurer: name (generated initially, with renaming unlocked early), class choice, and a concise preview of the class's identity, signature ability, passive, starting stats, and gear.
- Show which classes are available now and which can be unlocked later. Locked entries remain visible with an understandable requirement, but cannot be selected. Do not present an unlock requirement until the game has defined it.
- The lobby should show the active character's name and a compact lifetime record, and allow review of retired characters' memorial records.
- A class is a character's chosen direction. Class unlocks grant content access, not combat power.

## A life has stakes

- Record each character's lifetime separately from run-only progression. Run levels, temporary talents, health, and run rewards do not substitute for the character's lifetime history.
- Lifetime history should include at least dungeons entered, dungeon completions, deaths, successful resurrections, bosses defeated, and notable discoveries or side-mission outcomes. Add milestones only when they can be awarded consistently and idempotently by the server.
- Character death is permanent once the run ends with that character dead. The player must create or choose another living character before joining a new run.
- A successful resurrection during the same run saves the character's life. Track the resurrection as part of the record; do not count the character as dead for the permanent-death rule.
- Preserve retired characters as memorials. Creating a successor never replaces or erases a prior character or their accomplishments.
- If a party wipes, determine each character's final state from authoritative run resolution. Disconnected players and spectators must not change death or survival outcomes.

## Guest persistence and future accounts

- Store guest identity and its character records locally before account infrastructure exists. Define a reliable export/backup and recovery approach so a browser reset does not silently erase a character's history.
- Keep the identity model ready for later guest-to-account linking that preserves active and retired characters, class unlocks, names, and lifetime records.
- Character rewards and milestones are server-authoritative, idempotent, and not farmable by replaying the same event.

## Open design questions

- Can a guest keep multiple living characters, or only one active character plus memorials?
- What happens when a player disconnects while downed and the rest of the party completes the run?
- Which dungeon exits count as survival, and how should partial progress be presented after defeat?
- When and how does name customization unlock?
- Which local backup or recovery mechanism offers a useful guest experience without requiring an account?
