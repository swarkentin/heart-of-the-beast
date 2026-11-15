import type { EventLike, StageEnemy } from "./types";

/**
 * Turns one round's combat events into a timeline of cues for the stage.
 *
 * The server resolves a whole round at once and returns every event in a single snapshot (it resets the list at
 * the start of each resolution). The stage replays it as a short sequence: first what the party did to the enemies
 * (a stagger of hits, then any defeats), then what each enemy did, one after another. Event order from the server
 * is already player phase then enemy phase; this module only spaces it out in time.
 *
 * Events do not name the enemy that acted, so actors are recovered from the message text ("<name> uses <label> on
 * ...", "<name>'s <label> finds no target."). Enemies sharing a display name are told apart by event order: a new
 * actor starts when a target repeats.
 */

export type Cue =
  | { type: "hit"; enemyId: string; amount: number; via: string }
  | { type: "act"; enemyId: string; label: string; partyWide: boolean; hits: number; damage: number; blocked: number; miss: boolean }
  | { type: "drain"; enemyId: string; amount: number }
  | { type: "freeze"; enemyId: string }
  | { type: "defeat"; enemyId: string }
  | { type: "playerHeal"; amount: number }
  | { type: "playerBlock"; amount: number };

export type TimedCue = { at: number; cue: Cue };

/** Milliseconds. */
export const TIMING = { playerStep: 170, enemyGap: 520, enemyStep: 820, deathDelay: 280, thornsDelay: 450, drainDelay: 380, firstEnemyAt: 120 };

/** A stable key per event, including a counter so identical events in one snapshot stay distinct. */
export function eventKeys(events: EventLike[]): string[] {
  const counts = new Map<string, number>();
  return events.map((event) => {
    const base = `${event.round}|${event.kind}|${event.targetId ?? ""}|${event.amount ?? 0}|${event.message}`;
    const n = counts.get(base) ?? 0;
    counts.set(base, n + 1);
    return `${base}|${n}`;
  });
}

type ActDraft = Extract<Cue, { type: "act" }>;

/**
 * @param events the new (unseen) events, in server order
 * @param enemies the enemies as they are now (after the round)
 * @param knownDead ids of enemies whose defeat has already been shown
 */
export function planRound(events: EventLike[], enemies: Pick<StageEnemy, "id" | "name" | "hp">[], knownDead: ReadonlySet<string>): TimedCue[] {
  const idsByName = new Map<string, string[]>();
  for (const enemy of enemies) idsByName.set(enemy.name, [...(idsByName.get(enemy.name) ?? []), enemy.id]);

  const hits: Extract<Cue, { type: "hit" }>[] = [];
  const acts: ActDraft[] = [];
  const drains: Extract<Cue, { type: "drain" }>[] = [];
  const freezes: Extract<Cue, { type: "freeze" }>[] = [];
  const playerCues: Cue[] = [];
  const pointer = new Map<string, number>();
  const seenTargets = new Map<string, Set<string>>();

  const actorOf = (message: string, kind: string): { name: string; rest: string } | null => {
    for (const enemy of enemies) {
      const uses = enemy.name + " uses ";
      if (kind === "enemy_attack" && message.startsWith(uses)) return { name: enemy.name, rest: message.slice(uses.length) };
      const possessive = enemy.name + "'s ";
      if (kind === "enemy_block" && message.startsWith(possessive + "attack")) return { name: enemy.name, rest: "" };
      if (kind === "enemy_miss" && message.startsWith(possessive)) return { name: enemy.name, rest: message.slice(possessive.length) };
    }
    return null;
  };

  const draftFor = (name: string, targetId: string | undefined, marksTarget: boolean, label: string): ActDraft | null => {
    const ids = idsByName.get(name);
    if (!ids?.length) return null;
    let index = pointer.get(name) ?? 0;
    const seen = seenTargets.get(name) ?? new Set<string>();
    if (targetId && seen.has(targetId)) {
      index++;
      seen.clear();
    }
    index = Math.min(index, ids.length - 1);
    pointer.set(name, index);
    if (targetId && marksTarget) seen.add(targetId);
    seenTargets.set(name, seen);
    const enemyId = ids[index];
    let draft = acts.find((item) => item.enemyId === enemyId);
    if (!draft) {
      draft = { type: "act", enemyId, label, partyWide: false, hits: 0, damage: 0, blocked: 0, miss: false };
      acts.push(draft);
    }
    if (!draft.label && label) draft.label = label;
    return draft;
  };

  for (const event of events) {
    if (event.effect === "damage" && event.targetType === "enemy" && event.targetId) {
      hits.push({ type: "hit", enemyId: event.targetId, amount: event.amount ?? 0, via: event.kind });
      continue;
    }
    switch (event.kind) {
      case "enemy_attack": {
        const actor = actorOf(event.message, event.kind);
        if (!actor) break;
        const onIndex = actor.rest.lastIndexOf(" on Adventurer");
        const label = onIndex >= 0 ? actor.rest.slice(0, onIndex) : actor.rest.split(" on ")[0];
        const draft = draftFor(actor.name, event.targetId, true, label);
        if (draft) {
          draft.hits++;
          draft.damage += event.amount ?? 0;
          draft.partyWide = draft.hits > 1;
        }
        break;
      }
      case "enemy_block": {
        const actor = actorOf(event.message, event.kind);
        const draft = actor ? draftFor(actor.name, event.targetId, false, "") : null;
        if (draft) draft.blocked += event.amount ?? 0;
        break;
      }
      case "enemy_miss": {
        const actor = actorOf(event.message, event.kind);
        if (!actor) break;
        const label = actor.rest.replace(/ finds no target\.$/, "");
        const draft = draftFor(actor.name, undefined, false, label);
        if (draft) {
          draft.miss = true;
          // A miss has no target to repeat, so the next event for this name belongs to the next enemy.
          pointer.set(actor.name, (pointer.get(actor.name) ?? 0) + 1);
        }
        break;
      }
      case "enemy_heal":
        if (event.targetId && (event.amount ?? 0) > 0) drains.push({ type: "drain", enemyId: event.targetId, amount: event.amount ?? 0 });
        break;
      case "runic_ward":
        if ((event.amount ?? 0) > 0) {
          const last = acts[acts.length - 1];
          if (last) last.blocked += event.amount ?? 0;
          else playerCues.push({ type: "playerBlock", amount: event.amount ?? 0 });
        }
        break;
      case "elemental_frost": {
        const target = enemies.find((enemy) => event.message.includes(" " + enemy.name));
        if (target) freezes.push({ type: "freeze", enemyId: target.id });
        break;
      }
      default:
        if (event.effect === "heal" && event.targetType === "player" && (event.amount ?? 0) > 0) playerCues.push({ type: "playerHeal", amount: event.amount ?? 0 });
    }
  }

  const timeline: TimedCue[] = [];
  const lastHitAt = new Map<string, number>();
  const regularHits = hits.filter((hit) => hit.via !== "thorns");
  regularHits.forEach((cue, index) => {
    const at = index * TIMING.playerStep;
    timeline.push({ at, cue });
    lastHitAt.set(cue.enemyId, at);
  });
  freezes.forEach((cue, index) => timeline.push({ at: index * TIMING.playerStep, cue }));
  const playerPhaseEnd = Math.max(0, regularHits.length - 1) * TIMING.playerStep;
  const enemyBase = (regularHits.length > 0 ? playerPhaseEnd + TIMING.enemyGap : TIMING.firstEnemyAt);

  const actAt = new Map<string, number>();
  acts.forEach((cue, index) => {
    const at = enemyBase + index * TIMING.enemyStep;
    actAt.set(cue.enemyId, at);
    timeline.push({ at, cue });
  });
  for (const cue of hits.filter((hit) => hit.via === "thorns")) {
    const at = (actAt.get(cue.enemyId) ?? enemyBase) + TIMING.thornsDelay;
    timeline.push({ at, cue });
    lastHitAt.set(cue.enemyId, Math.max(lastHitAt.get(cue.enemyId) ?? 0, at));
  }
  for (const cue of drains) timeline.push({ at: (actAt.get(cue.enemyId) ?? enemyBase) + TIMING.drainDelay, cue });
  for (const cue of playerCues) timeline.push({ at: cue.type === "playerHeal" ? playerPhaseEnd : enemyBase, cue });

  for (const enemy of enemies) {
    if (enemy.hp > 0 || knownDead.has(enemy.id)) continue;
    timeline.push({ at: (lastHitAt.get(enemy.id) ?? 0) + TIMING.deathDelay, cue: { type: "defeat", enemyId: enemy.id } });
  }
  return timeline.sort((a, b) => a.at - b.at);
}
