import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { playEffect, type EffectKind, type ThemeId } from "../audio";
import { isThemeId } from "../music/cue";
import { elementFor, type Element } from "../fx/elements";
import { FxLayer } from "../fx/FxLayer";
import { DURATIONS, type FxInstance, type FxKind } from "../fx/render";
import { eventKeys, planRound, type Cue } from "./choreography";
import { EnemySprite, SPRITE_SCALE, type SeqCue } from "./EnemySprite";
import { useReducedMotion } from "./hooks";
import { moveAnimForLabel } from "./moves";
import { peekSprite } from "./spriteStore";
import type { EventLike, StageEnemy, StageView } from "./types";
import "./monsters.css";

/** Where the party is, as seen from each composition: the point enemy attacks land on and player effects start from. */
const PARTY_POINT: Record<StageView, { x: number; y: number }> = { player: { x: 550, y: 560 }, cast: { x: 550, y: 420 } };
const FLOOR_Y: Record<StageView, number> = { player: 452, cast: 254 };
const FX_UNIT: Record<StageView, number> = { player: 6, cast: 4 };

type Popup = { id: string; x: number; y: number; text: string; color: string; born: number };

export type EnemyStageProps = {
  view: StageView;
  enemies: StageEnemy[];
  events: EventLike[];
  target?: string;
  onTarget?: (id: string) => void;
};

/** Enemy positions: the first-person view uses the server-provided x; the cast view spreads them evenly. */
export function stageX(view: StageView, enemies: StageEnemy[], index: number): number {
  if (view === "player") return enemies[index].x;
  if (enemies.length <= 1) return 550;
  if (enemies.length === 2) return 365 + index * 370;
  return 300 + (index * 500) / (enemies.length - 1);
}

let counter = 0;
const nextId = (prefix: string) => `${prefix}${++counter}`;

/**
 * Draws the enemies as animated sprites and plays the combat events of each round as a short choreography
 * (see choreography.ts) with pixel effects over the top (see fx/). It renders into the scene's SVG, so it is
 * used inside a <svg viewBox="0 0 1100 620"> by both the player view and the spectator (cast) view.
 */
export function EnemyStage({ view, enemies, events, target, onTarget }: EnemyStageProps) {
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
    const scale = sprite.creature.tier === "boss" ? SPRITE_SCALE[v].boss : SPRITE_SCALE[v].monster;
    const mid = (sprite.bbox.top + sprite.bbox.bottom) / 2;
    return { x, y: floorY - (sprite.creature.anchor.y - mid) * scale, theme: sprite.themeId, top: floorY - (sprite.creature.anchor.y - sprite.bbox.top) * scale, side: (sprite.bbox.right - sprite.creature.anchor.x) * scale };
  }, [floorY]);

  const spawn = useCallback((kind: FxKind, el: Element, x: number, y: number, x2?: number, y2?: number) => {
    const fx: FxInstance = { id: nextId("fx"), kind, el, x, y, x2, y2, born: performance.now(), dur: DURATIONS[kind], u: FX_UNIT[latest.current.view], n: counter % 4 };
    setEffects((list) => [...list.filter((item) => performance.now() - item.born < item.dur + 1200), fx]);
  }, []);

  const popup = useCallback((x: number, y: number, text: string, color: string) => {
    const item: Popup = { id: nextId("pop"), x, y, text, color, born: performance.now() };
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
        const el = elementFor(c.theme, cue.via.replace(/_/g, " "), undefined);
        sfx(el === "physical" ? "impact" : "magic", cue.enemyId);
        if (cue.via === "thorns") spawn("spark", "physical", c.x, c.y);
        else if (el === "physical") spawn("slash", "physical", c.x, c.y);
        else if (el === "shock") spawn("zap", el, party.x, party.y - 60, c.x, c.y);
        else spawn("bolt", el, party.x, party.y - 60, c.x, c.y);
        if (cue.amount > 0) popup(c.x + c.side * 0.6, c.top + 50, String(cue.amount), "#ffffff");
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
        break;
      }
      case "playerHeal":
        spawn("heal", "acid", party.x, party.y - 40);
        sfx("heal");
        popup(party.x, party.y - 90, "+" + cue.amount, "#9be84a");
        break;
      case "playerBlock":
        spawn("shield", "physical", party.x, party.y - 40);
        sfx("block");
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
    const plan = planRound(fresh, enemies, dead.current!);
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
          <text key={item.id} className="dmg-num" x={item.x} y={item.y} textAnchor="middle" fill={item.color} stroke="#0b0d13" strokeWidth="5" paintOrder="stroke" fontSize={view === "player" ? 40 : 28} fontWeight="bold">{item.text}</text>
        ))}
      </g>
    </g>
  );
}
