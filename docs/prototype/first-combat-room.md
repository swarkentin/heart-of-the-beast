# First Combat Room Prototype

## Purpose

Validate the visual hierarchy and interaction loop for one solo combat encounter before adding server, multiplayer, progression, or procedural content.

## What's represented

- A torchlit chamber in the Forgotten Catacombs.
- One Vanguard-style adventurer and two distinct undead enemies.
- Enemy health and intent are visible before the player commits an action.
- The player chooses a quick strike, ember bolt, or defensive brace.
- Offensive actions target one living enemy; brace reduces incoming damage.
- Resolving a turn applies the player's action and then each surviving enemy's telegraphed attack.
- The encounter can be won or lost and restarted.

## Explicit limitations

- All state and combat resolution live in the browser; this is not server-authoritative.
- The encounter is a fixed scripted scenario, not a balanced combat system.
- Character and enemy art are SVG/CSS placeholders, not production pixel-art assets.
- No navigation, multiplayer, reconnect, inventory, audio, or persistence is implemented.
- Google Fonts are loaded from the network; system fallbacks remain available if they cannot load.

## Validation questions

- Can players understand the room, enemy silhouettes, target selection, and telegraphed intents at a glance?
- Are the action choices and outcome clear on a phone-sized screen?
- Does the scene retain enough visual presence on tablet and desktop without hiding critical controls?
- Does the compact cast-view direction need to be prototyped separately before committing to a final scene composition?
