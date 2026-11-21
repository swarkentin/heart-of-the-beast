# 0038: A shopkeeper, goods that get finer, vault keepers, and no button for the only path

Status: accepted

## Context

Playtesters asked for four things. The shop needed a shopkeeper worth looking at. Its goods were basic and never got better deeper in. Vaults should have characters offering trade-offs, and should not turn up too often. And when a cleared room has only one way on, nobody should have to press a button to take it.

## Decision

**The shopkeeper.** `frontend/src/scenes/characters.ts` holds character-grid sprites; `ScenePropsLayer` draws them. The camp shop shows a plumed-hat merchant behind a striped stall, with a shelf of wares, a swinging lantern and a counter of potions. The stall is drawn a third larger than the other props so he is the first thing you see. He breathes and blinks. Every sale (the count of the camp's purchases) makes him bob a thank-you and pops a coin off the counter.

**Goods that get finer.** A shop's tier follows the effective depth: the first two camps sell tier 1, the next two tier 2, and every camp after that tier 3 (`shopTier`). `shopUpgrades` holds the finer version of an item per tier, and `atTier` swaps it in:

- Healing Draught (12) → Greater Draught (20) → Elixir of Mending (32)
- Healing Herb → Herb Bundle (two herbs, filling the pack to its cap and no further)
- Ward Charm (8) → Runed Ward (14) → Aegis Sigil (20)
- New: Field Journal (30 XP) → Veteran's Memoir (60) → Sage's Codex (100)
- New, from tier 2: Scroll of Practice (+1 skill point)

The shelf holds five items instead of four. A finer item is a bigger purchase, never a better deal: it costs at least as much per point as the basic one. Finer items show their tier as gold numerals in the shop.

**Vault keepers.** Every vault holds a seeded keeper (`vault_keepers.go`), drawn standing at the back of the vault; in cast view they stand to the left, clear of the party. The warden, the vault's own ghost, presents the dungeon's treasure (safe coin, or a gamble on a relic). Five wanderers offer deals of their own, using existing discovery effects so every choice is already balanced and tested:

| Keeper | Deals |
|---|---|
| The Blood Broker | blood pact, vital tithe |
| The Grinning Gambler | trapped cache (double or nothing), safe coin |
| The Masked Alchemist | risky draught, uneasy rest |
| The Ghost Armourer | heavy plate, glass edge |
| The Hollow Merchant | greedy haul, cursed boon |

Each also offers to walk away. Vaults are rarer: a floor holds one at `min(20 + 3 × depth, 33)` percent, down from `35 + 5 × depth`. The keeper is rolled from its own seed stream, so floor layouts did not change.

**The only path.** A cleared room with one exit starts an automatic four-second countdown (`SinglePathDelay`, `NavigationVote.Auto`). The party moves on at the deadline. Anyone can press GO NOW to leave at once.

## Consequences

- Balance, endless matrix (126 compositions × random/tactical × 100 seeds, 25,200 expeditions), tactical parties that reach a fifth dungeon and clear it:
  - main: 63%.
  - First draft, where guard (+1/+2/+3) and maximum health (+5/+8/+12) also had finer versions: 79%.
  - The first draft with tiers turned off: 63%. Without the new XP and skill-point items: 82%. So the finer goods caused the whole change, not the new items or the vaults.
  - Pricing the finer goods at no better value per point than the basic ones: still 79%. Deep in a run gold is plentiful, so price does not limit buying; the size of a permanent upgrade does.
  - So guard and maximum health keep their basic amounts at every depth. They are permanent and stack at every camp. Heals, wards, herbs and XP still get finer. **This final version has not been measured locally:** the confirmation run was stopped when the machine ran low on memory. CI's seeded balance job measures it on the PR.
- The fixed regression suite (`balance-report`, 30 seeds) passed for the first draft.
- Simulated players still shop by kind; they buy the new XP and skill-point items only through the random fallback.
- Open: if CI shows the final version still running strong, the next levers are the Herb Bundle and the Scroll of Practice.
