import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { playEffect, type EffectKind, type ThemeId } from "../audio";
import { isThemeId } from "../music/cue";
import { elementFor, type Element } from "../fx/elements";
import { FxLayer } from "../fx/FxLayer";
import { DURATIONS, type FxInstance, type FxKind } from "../fx/render";
import { eventKeys, planRound, type Cue } from "./choreography";
import { EnemySprite, type SeqCue } from "./EnemySprite";
import { enemyX, spriteScale, STAGE_FLOOR_Y } from "./layout";
import { useReducedMotion } from "./hooks";
import { moveAnimForLabel } from "./moves";
import { peekSprite } from "./spriteStore";
import type { EventLike, StageEnemy, StageView } from "./types";
import type { Skill } from "../combatAbilities";
import { selfMoveIn, SELF_LEAD_MS, type SelfMove } from "../run/selfMoves";
import "./monsters.css";

/** Where the party is, as seen from each composition: the point enemy attacks land on and player effects start from. */
const PARTY_POINT: Record<StageView, { x: number; y: number }> = { player: { x: 550, y: 560 }, cast: { x: 550, y: 420 } };
const FLOOR_Y = STAGE_FLOOR_Y;
const FX_UNIT: Record<StageView, number> = { player: 6, cast: 4 };

type Popup = { id: string; x: number; y: number; text: string; color: string; critical?: boolean; born: number };

export type EnemyStageProps = {
  view: StageView;
  enemies: StageEnemy[];
  events: EventLike[];
  target?: string;
  onTarget?: (id: string) => void;
  /** Called at the moment an effect lands on a party member, so portraits can react in step with the stage. */
  onPartyImpact?: (impact: PartyImpact) => void;
  /**
   * The first-person view only: the player's own moves, so the arms can play them in step with the stage. `begin`
   * fires when a round containing the player's action arrives (the stage then holds the round back SELF_LEAD_MS so
   * the arm can wind up), `land` when the player's hit lands, `block` when the player blocks an enemy hit.
   */
  self?: { id: string; skills: ReadonlyMap<string, Skill>; palm: { x: number; y: number }; onCue: (cue: SelfCue) => void };
};

export type SelfCue =
  | { type: "begin"; move: SelfMove }
  | { type: "land"; move: SelfMove; x: number; y: number; el: Element; critical?: boolean }
  | { type: "block"; amount: number };

export type PartyImpact = { playerId: string; effect: "damage" | "heal" | "block"; amount: number };

/** Enemy positions: the first-person view uses the x the run screen laid out; the cast view spreads them (see layout.ts). */
export function stageX(view: StageView, enemies: StageEnemy[], index: number): number {
  if (view === "player") return enemies[index].x;
  return enemyX(view, enemies.length, index);
}

let counter = 0;
const nextId = (prefix: string) => `${prefix}${++counter}`;

/**
 * Draws the enemies as animated sprites and plays the combat events of each round as a short choreography
 * (see choreography.ts) with pixel effects over the top (see fx/). It renders into the scene's SVG, so it is
 * used inside a <svg viewBox="0 0 1100 620"> by both the player view and the spectator (cast) view.
 */
export function EnemyStage({ view, enemies, events, target, onTarget, onPartyImpact, self }: EnemyStageProps) {
  const impactRef = useRef(onPartyImpact);
  impactRef.current = onPartyImpact;
  const selfRef = useRef(view === "player" ? self : undefined);
  selfRef.current = view === "player" ? self : undefined;
  const selfMove = useRef<SelfMove | null>(null);
  const reduced = useReducedMotion();
  const floorY = FLOOR_Y[view];
  const [effects, setEffects] = useState<FxInstance[]>([]);
  const [popups, setPopups] = useState<Popup[]>([]);
  const [queues, setQueues] = useState<Record<string, SeqCue[]>>({});

  const latest = useRef({ view, enemies, reduced });
  latest.current = { view, enemies, reduced };
  const seen = useRef<Set<string> | null>(null);
  if (!seen.current) seen.current = new Set(eventKeys(events));
  const dead = useRef<Set<string> | null>(null);
  if (!dead.current) dead.current = new Set(enemies.filter((enemy) => enemy.hp <= 0).map((enemy) => enemy.id));
  const initialDead = useRef<Set<string>>(new Set(dead.current));
  const acts = useRef(new Map<number, Extract<Cue, { type: "act" }>>());
  const seq = useRef(0);
  const timers = useRef<number[]>([]);

  const centerOf = useCallback((id: string) => {
    const { view: v, enemies: list } = latest.current;
    const index = list.findIndex((enemy) => enemy.id === id);
    if (index < 0) return { x: 550, y: floorY - 100, theme: undefined as string | undefined, top: floorY - 200, side: 60 };
    const enemy = list[index];
    const sprite = peekSprite(enemy.sprite);
    const x = stageX(v, list, index);
    if (!sprite) return { x, y: floorY - 100, theme: undefined, top: floorY - 200, side: 60 };
    const scale = spriteScale(v, sprite.creature.tier, list.length);
    const mid = (sprite.bbox.top + sprite.bbox.bottom) / 2;
    return { x, y: floorY - (sprite.creature.anchor.y - mid) * scale, theme: sprite.themeId, top: floorY - (sprite.creature.anchor.y - sprite.bbox.top) * scale, side: (sprite.bbox.right - sprite.creature.anchor.x) * scale };
  }, [floorY]);

  const spawn = useCallback((kind: FxKind, el: Element, x: number, y: number, x2?: number, y2?: number, p = 1) => {
    const fx: FxInstance = { id: nextId("fx"), kind, el, x, y, x2, y2, born: performance.now(), dur: DURATIONS[kind], u: FX_UNIT[latest.current.view], n: counter % 4, p };
    setEffects((list) => [...list.filter((item) => performance.now() - item.born < item.dur + 1200), fx]);
  }, []);

  const popup = useCallback((x: number, y: number, text: string, color: string, critical = false) => {
    const item: Popup = { id: nextId("pop"), x, y, text, color, critical, born: performance.now() };
    setPopups((list) => [...list.filter((entry) => performance.now() - entry.born < 1400), item]);
    timers.current.push(window.setTimeout(() => setPopups((list) => list.filter((entry) => entry.id !== item.id)), 1300));
  }, []);

  const push = useCallback((enemyId: string, cue: Cue): number => {
    const id = ++seq.current;
    setQueues((all) => ({ ...all, [enemyId]: [...(all[enemyId] ?? []).slice(-6), { seq: id, cue }] }));
    return id;
  }, []);

  /** Plays a themed sound effect at the moment its visual lands. The theme is the art theme of the enemy involved (or the first enemy). */
  const sfx = useCallback((kind: EffectKind, enemyId?: string) => {
    const enemies = latest.current.enemies;
    const sprite = (enemies.find((item) => item.id === enemyId) ?? enemies[0])?.sprite;
    const theme = sprite?.split("/")[0];
    playEffect(kind, (isThemeId(theme) ? theme : "catacombs") as ThemeId);
  }, []);

  const handleCue = useCallback((cue: Cue) => {
    const { view: v } = latest.current;
    const party = PARTY_POINT[v];
    switch (cue.type) {
      case "hit": {
        const c = centerOf(cue.enemyId);
        push(cue.enemyId, cue);
        const own = selfRef.current && cue.actorId === selfRef.current.id && cue.via !== "thorns" ? selfMove.current : null;
        // The player's own spell is cast from the first-person palm; its element follows the skill's name.
        let el = elementFor(c.theme, cue.via.replace(/_/g, " "), undefined);
        if (own?.kind === "spell") { const named = elementFor(undefined, (own.skill.split(".")[1] ?? "").replace(/-/g, " "), undefined); el = named === "physical" ? "arcane" : named; }
        const from = own?.kind === "spell" ? selfRef.current!.palm : { x: party.x, y: party.y - 60 };
        const p = own ? own.rank : 1;
        sfx(el === "physical" ? "impact" : "magic", cue.enemyId);
        if (cue.via === "thorns") spawn("spark", "physical", c.x, c.y);
        else if (el === "physical") spawn("slash", "physical", c.x, c.y, undefined, undefined, p);
        else if (el === "shock") spawn("zap", el, from.x, from.y, c.x, c.y, p);
        else spawn("bolt", el, from.x, from.y, c.x, c.y, p);
        if (own && p >= 5 && el === "physical") spawn("impact", "physical", c.x, c.y + 40, undefined, undefined, p);
        if (own) selfRef.current!.onCue({ type: "land", move: own, x: c.x, y: c.y, el, critical: cue.critical });
        if (cue.amount > 0) popup(c.x + c.side * 0.6, c.top + 50, cue.critical ? "CRIT! " + cue.amount : String(cue.amount), cue.critical ? "#ffd166" : "#ffffff", Boolean(cue.critical));
        break;
      }
      case "act": {
        const id = push(cue.enemyId, cue);
        acts.current.set(id, cue);
        break;
      }
      case "defeat":
        dead.current!.add(cue.enemyId);
        push(cue.enemyId, cue);
        sfx("defeat", cue.enemyId);
        break;
      case "drain": {
        const c = centerOf(cue.enemyId);
        spawn("drain", "arcane", party.x, party.y - 60, c.x, c.y);
        spawn("heal", "acid", c.x, c.y);
        sfx("magic", cue.enemyId);
        break;
      }
      case "freeze": {
        const c = centerOf(cue.enemyId);
        spawn("shards", "frost", c.x, c.y);
        sfx("magic", cue.enemyId);
        if (cue.interrupted) {
          // A cancelled move gets an unmistakable callout: a cross over the enemy and floating text.
          spawn("cross", "frost", c.x, c.y);
          popup(c.x, c.top + 20, "INTERRUPTED!", "#7fe6ff", true);
        }
        break;
      }
      case "blunted": {
        const c = centerOf(cue.enemyId);
        spawn("spark", "frost", c.x, c.y);
        popup(c.x, c.top + 20, "BLUNTED", "#a9c8d6");
        break;
      }
      case "playerHeal":
        spawn("heal", "acid", party.x, party.y - 40);
        sfx("heal");
        popup(party.x, party.y - 90, "+" + cue.amount, "#9be84a");
        if (cue.playerId) impactRef.current?.({ playerId: cue.playerId, effect: "heal", amount: cue.amount });
        break;
      case "playerBlock":
        spawn("shield", "physical", party.x, party.y - 40);
        sfx("block");
        if (cue.playerId && cue.playerId === selfRef.current?.id) selfRef.current.onCue({ type: "block", amount: cue.amount });
        if (cue.playerId) impactRef.current?.({ playerId: cue.playerId, effect: "block", amount: cue.amount });
        break;
    }
  }, [centerOf, popup, push, sfx, spawn]);

  /** An enemy's move reached its impact frame (or, with reduced motion, its moment): show what it did to the party. */
  const handleImpact = useCallback((id: number) => {
    const cue = acts.current.get(id);
    if (!cue) return;
    acts.current.delete(id);
    const { view: v } = latest.current;
    const party = PARTY_POINT[v];
    const c = centerOf(cue.enemyId);
    const enemy = latest.current.enemies.find((item) => item.id === cue.enemyId);
    const sprite = peekSprite(enemy?.sprite);
    const anim = moveAnimForLabel(sprite?.creature, cue.label, cue.partyWide);
    const move = sprite?.creature.animations[anim].move;
    const el = elementFor(c.theme, cue.label, move);
    const target = { x: party.x, y: party.y - 40 };
    for (const hit of cue.targets) {
      if (hit.blocked > 0) impactRef.current?.({ playerId: hit.playerId, effect: "block", amount: hit.blocked });
      if (hit.blocked > 0 && hit.playerId === selfRef.current?.id) selfRef.current.onCue({ type: "block", amount: hit.blocked });
      if (hit.damage > 0) impactRef.current?.({ playerId: hit.playerId, effect: "damage", amount: hit.damage });
    }
    if (cue.miss) {
      spawn("cross", "physical", c.x, c.y);
      return;
    }
    sfx(cue.damage === 0 && cue.blocked > 0 ? "block" : el === "physical" ? "impact" : "magic", cue.enemyId);
    if (cue.damage > 0 || cue.blocked === 0) {
      if (cue.partyWide) spawn("wave", el, target.x, target.y);
      else if (/summon/.test(move ?? "")) spawn("summon", el, c.x, floorY);
      else if (/cloud|vent|spit/.test(move ?? "") && el === "acid") spawn("cloud", el, target.x, target.y);
      else if (el === "shock") spawn("zap", el, c.x, c.y, target.x, target.y);
      else if (/roar|wail/.test(move ?? "")) spawn("wave", el, target.x, target.y);
      else if (el !== "physical" || /cast|shoot/.test(move ?? "")) spawn("bolt", el, c.x, c.y, target.x, target.y);
      else if (/slam|smash|stomp|crush/.test(move ?? "")) spawn("impact", el, target.x, party.y);
      else if (/claw|swipe|rake|bite/.test(move ?? "")) spawn("claw", el, target.x, target.y);
      else spawn("slash", el, target.x, target.y);
    }
    if (cue.blocked > 0) {
      spawn("shield", "physical", target.x, target.y);
      popup(target.x + 110, target.y + 20, "BLOCKED " + cue.blocked, "#a9d9f3");
    }
    if (cue.damage > 0) {
      if (v === "player") spawn("screenHit", "fire", 550, 310);
      popup(target.x + (counter % 3) * 40 - 40, target.y - 10, "-" + cue.damage, "#ff7a6a");
    }
  }, [centerOf, floorY, popup, sfx, spawn]);

  // Turn each new batch of combat events into a timeline and play it.
  useEffect(() => {
    const keys = eventKeys(events);
    const fresh = events.filter((_, index) => !seen.current!.has(keys[index]));
    for (const key of keys) seen.current!.add(key);
    if (fresh.length === 0) return;
    const own = selfRef.current ? selfMoveIn(fresh, selfRef.current.id, selfRef.current.skills) : null;
    selfMove.current = own;
    if (own) selfRef.current!.onCue({ type: "begin", move: own });
    const plan = planRound(fresh, enemies, dead.current!, own?.damaging && !reduced ? SELF_LEAD_MS : 0);
    for (const entry of plan) {
      if (entry.cue.type === "defeat") dead.current!.add(entry.cue.enemyId);
      timers.current.push(window.setTimeout(() => handleCue(entry.cue), reduced ? Math.min(entry.at, 400) : entry.at));
    }
  }, [events, enemies, handleCue, reduced]);

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

  const positions = useMemo(() => enemies.map((_, index) => stageX(view, enemies, index)), [view, enemies]);

  return (
    <g className={`enemy-stage enemy-stage-${view}`}>
      {enemies.map((enemy, index) => (
        <EnemySprite
          key={enemy.id}
          enemy={enemy}
          view={view}
          x={positions[index]}
          index={index}
          count={enemies.length}
          floorY={floorY}
          selected={target === enemy.id}
          onClick={onTarget && enemy.hp > 0 ? () => onTarget(enemy.id) : undefined}
          cues={queues[enemy.id] ?? []}
          startDead={initialDead.current.has(enemy.id)}
          reduced={reduced}
          onImpact={handleImpact}
        />
      ))}
      <FxLayer effects={effects} reduced={reduced} />
      <g className="dmg-layer" pointerEvents="none" aria-hidden="true">
        {popups.map((item) => (
          <text key={item.id} className={"dmg-num" + (item.critical ? " dmg-num-critical" : "")} x={item.x} y={item.y} textAnchor="middle" fill={item.color} stroke="#0b0d13" strokeWidth="5" paintOrder="stroke" fontSize={item.critical ? (view === "player" ? 56 : 40) : (view === "player" ? 40 : 28)} fontWeight="bold">{item.text}</text>
        ))}
      </g>
    </g>
  );
}
