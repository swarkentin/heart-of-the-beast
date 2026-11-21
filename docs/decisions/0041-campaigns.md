# 0041: Campaigns

Status: accepted

## Context

The endless expedition has no ending: parties go until they fall, and the Heart of the Beast (ADR 0040) shows up by chance or by lure. We want a second way to play with a beginning, a middle and an end. Each campaign tells a story, builds toward a heart fight that is the point of the whole run, and leads on to the next one. Endless runs stay as they are.

## Decision

**Four campaigns, each five chapters long.** The catalog lives on the server (`game/campaigns.go`) and is served, story included, at `GET /campaigns` (public, cached for 300 s):

| # | Campaign | Lands (chapters 1–3) | Castle (chapter 4) | Trophy |
|---|---|---|---|---|
| 1 | The First Beat | catacombs, sunken, ghosttown | eldritch | Ossic's Lantern |
| 2 | The Iron Pulse | clockwork, scifi, arctic | infernal | The Stopped Clock |
| 3 | The Dreaming Wound | carnival, dreamscape, noir | eldritch | The Waking Bell |
| 4 | The Last Heartbeat | jungle, wasteland, mobster | infernal | The Still Heart |

The road is fixed: the three lands in order, then the castle, then **the Heart's Chamber**, a single floor in the castle's land with the campaign's heart at the bottom. There is no crossroads vote; the camp between chapters says where the road goes next (`Camp.Road`). Floor modifiers are still rolled per dungeon, seeded as in endless runs. Later campaigns go one floor deeper per tier (`CampaignTierExtraDepth`), so their monsters hit harder from the first chapter. The Beast Lure is not sold, and the random heart never replaces a boss, because a campaign already has its hearts.

**A mid-campaign heart.** Chapter 2's boss is the **Heartshard**, a torn-off piece of the heart: the same sprite drawn smaller, with less health, a barrier ("Scar tissue") and a cataclysm ("A torn beat"). When it falls the run sets `CampaignInterlude`, and the camp that follows plays the **interlude**: three panels about the havoc the heart has caused in the campaign's lands. The camp gets `CampaignInterludeWindow` (30 s) extra on its timer to make room for it.

**The final heart grows with the campaign.** `campaignHeart` starts from the castle heart of ADR 0040 (barrier, cataclysm, rebirth) and adds to it by tier:

| Tier | Extra health | Damage bonus | Added mechanics |
|---|---|---|---|
| 1 | +30% | +3 | none |
| 2 | +35% | +4 | legion (cackling imps) |
| 3 | +40% | +4 | anchor (grasping tentacle) |
| 4 | +45% | +5 | legion and devour |

The heart's tier travels on the enemy (`Enemy.HeartTier`), and the client draws a grander aura for each tier (`monsters/HeartAura.tsx`). Every tier keeps what the tier before had:

| Heart | Aura |
|---|---|
| Heartshard | a faint broken ring |
| Tier 1 | a beating glow, a shockwave and one ring of runes |
| Tier 2 | a second ring turning the other way, and embers |
| Tier 3 | a third ring, veins cracking the floor and a second shockwave |
| Tier 4 | a fourth ring and a crown of red lightning |

The beat quickens with each tier. All of it is stepped like the game's other motion, and it holds still under reduced motion.

**No rest before the chamber.** After the castle boss the party goes straight to the chamber through a camp that offers boons only (`openChamberGate`): no rest, no mini-game, no shop. Balance depends on this (see below).

**Story: one tale across four campaigns, the story of Brother Ossic.** A first draft gave every campaign the same five beats (quiet lands, the heart arrives, the bosses turn, a gate opens, go) and the same pictures, so the campaigns felt alike and nothing carried over. Now one story runs through all four. Brother Ossic, keeper of the crypts, guides every campaign and is changed by the heart:

1. **The First Beat:** Ossic finds the first rift-gate and sends for you. In the epilogue a drop of the fleeing heart's blood marks his hand, and it starts to beat.
2. **The Iron Pulse:** the beating hand leads to the Clockwork Empire. Chief Artificer Brasswhistle cages it in brass. The interlude reveals that the heart has made a bargain with the demons of the Infernal Citadel. In the epilogue Ossic falls asleep and does not wake.
3. **The Dreaming Wound:** the heart is hiding in Ossic's sleep. The interlude shows that it remembers your faces. In the epilogue Ossic wakes, but then walks through a gate alone, following its call.
4. **The Last Heartbeat:** you follow Ossic to the jungle where the heart has healed. The interlude reveals that the heart is only the woken part of the Beast. In the epilogue Ossic presses his hand to the heart and both stop. The final hook is the Beast, deep below, looking for a new heart.

Every prologue after the first opens with a "previously" panel that picks up where the last epilogue ended. Each part of the story has:
- **Prologue:** five panels; for example, the masters panel raises the campaign's own bosses over its lands.
- **Interlude:** three panels after the Heartshard, ending on a reveal.
- **Epilogue:** three panels, ending on the trophy and "NEXT: …" or, for the last campaign, "THE END… FOR NOW".

Twelve scenes were drawn for the story (`run/storyArt.tsx`):
- the previously memory;
- Ossic at the crypt gate;
- his marked hand;
- the backward clock tower;
- the gauntlet;
- the bargain;
- the dreamer;
- the remembered faces;
- the lantern left by a gate;
- the healed heart;
- the sacrifice;
- the deep eye.

The scenes that recur change with the campaign number: Ossic's hand is bare, then marked, then brass, and the close-up of it beats harder each time. The scene names live in one list on each side (`storyArt` on the server, `STORY_SCENES` on the client). The server refuses a panel naming an unknown scene, the compiler refuses a scene with no art, and a UI test checks that the two lists agree.

All three parts use the prologue's cutscene (ADR 0039). Each plays once per run in a tab. When the host plays the epilogue through after a win, it takes the party back to the lobby, where the road picker suggests the newly opened campaign. The epilogue can be replayed from the result screen. A player's trophy shelf (profile → overview) replays the prologue of any campaign that player has opened and the epilogue of any they have won. For development, `?story-preview` opens a page that plays every campaign's prologue, interlude and epilogue, with a gallery showing every scene as each campaign draws it. It reads only the public catalog, so it unlocks and awards nothing.


**Unlocks belong to the account, and the party leader's account decides.** A campaign is open once the one before it has been won (`CampaignUnlocked`). `POST /rooms/{id}/start` takes `{campaignId}` as well as `{themeId}`. The server reads the **host's** profile and refuses a locked campaign with 403, or an unknown one with 400. Other party members don't need it unlocked to play it.

**Trophies.** Migration `0008_add_profile_campaigns.sql` adds `player_profile_campaigns` (completions, first and last completion per profile and campaign) and `player_profile_campaign_awards` (one row per profile and run, so banking is idempotent). When a campaign is won, every player still in the party who has a profile is credited with the trophy, including members for whom the campaign was not yet open. They also get `RunXPPerCampaign` (150) adventurer XP in place of the ordinary completion bonus. A run that used idkfa gets no trophy, and its result says so. Heart strikes in campaigns count toward the shared pool of ADR 0040 like any other heart fight.

## Consequences

- Balance: `go run ./cmd/campaign-balance` runs 126 party compositions × 8 seeds per campaign under the tactical policy. "Win" is the share of runs that beat the final heart. Each chapter column is the clear rate of that chapter, given the party reached it.

  | Campaign | Party | Win | Ch 1 | Ch 2 (shard) | Ch 3 | Ch 4 (castle) | Ch 5 (heart) |
  |---|---|---|---|---|---|---|---|
  | 1 | solo | 41.7% | 100% | 98.6% | 93.0% | 45.5% | 100% |
  | 1 | duo | 73.6% | 100% | 100% | 98.6% | 78.3% | 96.0% |
  | 1 | trio | 91.0% | 100% | 100% | 100% | 92.0% | 98.9% |
  | 1 | four | 84.0% | 100% | 100% | 100% | 84.0% | 100% |
  | 2 | solo | 12.5% | 72.2% | 100% | 92.3% | 47.9% | 39.1% |
  | 2 | duo | 63.1% | 98.6% | 100% | 97.2% | 84.3% | 78.0% |
  | 2 | trio | 86.1% | 99.0% | 100% | 100% | 91.6% | 95.0% |
  | 2 | four | 79.5% | 97.2% | 100% | 99.3% | 84.9% | 97.0% |
  | 3 | solo | 9.7% | 72.2% | 100% | 84.6% | 31.8% | 50.0% |
  | 3 | duo | 46.9% | 97.2% | 100% | 98.0% | 64.1% | 76.8% |
  | 3 | trio | 74.7% | 97.9% | 100% | 99.6% | 82.6% | 92.7% |
  | 3 | four | 71.9% | 96.2% | 100% | 99.6% | 77.5% | 96.7% |
  | 4 | solo | 6.9% | 63.9% | 100% | 82.6% | 31.6% | 41.7% |
  | 4 | duo | 38.3% | 91.7% | 99.4% | 95.1% | 68.3% | 64.8% |
  | 4 | trio | 71.2% | 96.9% | 100% | 100% | 82.8% | 88.7% |
  | 4 | four | 64.6% | 92.4% | 100% | 99.6% | 74.3% | 94.4% |

  - The castle is the main gate, as in endless runs (ADR 0040's endless castle cleared 72.9%).
  - The Heartshard is a set piece, not a gate: almost every party that reaches it wins.
  - In the first draft the final heart came after a full camp (rest, herb refill, shop). Any party that reached it won, whatever its health and damage. Going straight from the castle to the chamber is what made the heart a real final fight.
  - Higher tiers are harder both through the extra depth, which shows from chapter 1 for solo players, and through the heart itself.
- Solo play at tiers 2–4 is hard: 7–13% of solo runs win. That keeps the campaigns cooperative, but it may be too steep. It is an open item to watch against real results.
- The interlude only plays if a player is at the camp after the Heartshard. A run that skips that camp, as idkfa does, never shows it.
- Open:
  - per-campaign music for the chamber;
  - whether repeat wins should earn anything beyond a completions count;
  - more campaigns once more themes exist.
