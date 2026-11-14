# First Combat Room and Camera Prototype

## Purpose

Validate two coordinated presentations of one encounter: an immersive forward-facing player camera and a separate cinematic spectator/cast camera. Both render the same local encounter state; the spectator view is read-only and never owns game rules.

## Player presentation

- The player view is first-person-inspired and looks forward down the corridor into the room. Enemies are encountered ahead, not arranged in a side-on JRPG battle line.
- Combat keeps the same forward-facing spatial language as exploration. Target selection happens on visible enemies or their compact intent labels.
- Health, round, enemy intent, and actions stay in a restrained overlay around the scene. Choosing an action resolves immediately.
- The current scene is a perspective illusion built in SVG; it is not a commitment to a 3D renderer or true first-person movement.
- Directional navigation, room transitions, and route choices are future work; this prototype validates the camera language rather than a complete exploration loop.

## Spectator / cast presentation

- Use the **Spectator / Cast** toggle to see the same encounter from a distinct elevated, cinematic room camera.
- Player actions update the spectator scene immediately because both views consume the same encounter state.
- The cast view is read-only: no targeting or combat controls. It favors party/enemy/room composition over the player's close-up perspective.
- This is an initial static camera composition. Following movement, pulling back for combat, widening for bosses, and briefly focusing on important events are future camera behaviors, not yet implemented.
- In multiplayer, the player view and cast view must subscribe to the same authoritative server state/event stream; they must not maintain separate simulations.

## Current interaction

- Player mode: select an enemy in the scene or intent strip, then choose Strike, Ember, or Brace. The action resolves immediately.
- Spectator mode: observe the same health, enemy, round, and event state without controls.
- The view switch is presentation-only; switching views does not reset or fork the encounter.
- Mobile keeps the scene dominant and preserves large touch targets.

## Art and implementation status

The scene is hand-authored SVG with crisp-edged sprite shapes, perspective geometry, tiled textures, and layered lighting. It is prototype art, not a production pixel-art asset pack or established pipeline. The spectator camera is a separate composition, not a second game simulation.

## Explicit limitations

- State and combat resolution remain browser-local and scripted; this is not server-authoritative or multiplayer.
- The encounter is fixed and is not a balanced combat system.
- No directional navigation, room graph, camera animation, production sprite pipeline, or character animation exists yet.
- No persistence, inventory, audio, reconnect, or progression is implemented.
- Google Fonts are loaded from the network; system fallbacks remain available.

## Validation questions

- Does the forward-facing player view feel like looking into a dungeon rather than watching a side-on battle?
- Is it clear that combat and exploration will share this camera language?
- Does the cast view communicate party position, enemy threats, and encounter progress at a glance?
- Is the separation between player controls and spectator presentation clear on desktop and mobile?
