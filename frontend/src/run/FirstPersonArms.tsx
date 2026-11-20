import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { FxLayer } from "../fx/FxLayer";
import { DURATIONS, type FxInstance, type FxKind } from "../fx/render";
import type { Element } from "../fx/elements";
import type { SelfCue } from "../monsters/EnemyStage";
import type { SelfMove } from "./selfMoves";

/**
 * The player's own arms in the first-person view. They are out of sight while you choose, so they never cover the
 * room or the enemies; they rise only to act, in step with the stage:
 *   strike  the weapon arm winds up as the round arrives, then swings through with a smear as the hit lands
 *   spell   the off hand comes up gathering light, and the spell leaves the palm (the stage fires it from there)
 *   guard   the off hand braces high behind a ward
 *   cast    the off hand rises with a burst of light
 *   block   when an enemy hit is blocked, the off hand snaps up into it
 * The skill's rank (I-V) drives every effect: a longer, brighter smear, more motes, more rings, a harder shake.
 *
 * The art is a generated sheet (scripts/pixel-art/first-person.mjs): two 128x64 columns (left arm, right arm), one
 * row per pose. It is drawn at 4x, the room backdrop's own pixel density.
 */

const K = 4, FW = 128, FH = 64;
const ROW = { rest: 0, windup: 1, strike: 2, present: 3, brace: 4 } as const;
type Row = (typeof ROW)[keyof typeof ROW];
/** Scene positions of the two arm frames when raised; lowered they sit fully below the frame. */
const LEFT_X = 110, RIGHT_X = 1100 - 110 - FW * K, TOP_Y = 372, HIDDEN = 300;
/** Where a spell leaves the off hand (the stage fires the player's spells from here), and the weapon hand's pivot. */
export const ARMS_PALM = { x: 300, y: 492 };
const WEAPON_PIVOT = { x: 850, y: 600 };
const WARD_AT = { x: 372, y: 452 };
/** Each class's own colour for spells, wards and support magic. */
const CLASS_ELEMENT: Record<string, Element> = { arcanist: "arcane", cleric: "shock", spellguard: "frost", beastcaller: "acid", assassin: "spectral", ranger: "acid", bulwark: "frost", juggernaut: "fire", tactician: "frost" };

type Arm = { row: Row; up: boolean; push?: boolean };
const REST: Arm = { row: ROW.rest, up: false };

let fxCounter = 0;

export function FirstPersonArms({ sheet, classId, cueRef, onShake, reduced }: {
  sheet: string; classId?: string; reduced: boolean;
  cueRef: MutableRefObject<((cue: SelfCue) => void) | null>;
  onShake: (strength: number) => void;
}) {
  const [left, setLeft] = useState<Arm>(REST);
  const [right, setRight] = useState<Arm>(REST);
  const [effects, setEffects] = useState<FxInstance[]>([]);
  const timers = useRef<number[]>([]);
  const element = CLASS_ELEMENT[classId ?? ""] ?? "arcane";

  const later = (ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)); };
  const clear = () => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; };
  const lower = useCallback(() => { setLeft(REST); setRight(REST); }, []);
  const spawn = useCallback((kind: FxKind, el: Element, x: number, y: number, p: number, x2?: number, y2?: number) => {
    const fx: FxInstance = { id: "arm" + ++fxCounter, kind, el, x, y, x2, y2, born: performance.now(), dur: DURATIONS[kind], u: 6, n: fxCounter % 4, p };
    setEffects((list) => [...list.filter((item) => performance.now() - item.born < item.dur + 200), fx]);
  }, []);

  const play = useCallback((cue: SelfCue) => {
    if (cue.type === "begin") {
      const { kind, rank, damaging } = cue.move;
      clear();
      setLeft(REST); setRight(REST);
      if (kind === "strike") {
        setRight({ row: ROW.windup, up: true });
        if (!damaging) later(220, () => land(cue.move));
      } else if (kind === "spell") {
        setLeft({ row: ROW.present, up: true });
        spawn("charge", element, ARMS_PALM.x, ARMS_PALM.y, rank);
        if (!damaging) later(220, () => land(cue.move));
      } else if (kind === "guard") {
        setLeft({ row: ROW.brace, up: true });
        later(90, () => { spawn("ward", element, WARD_AT.x, WARD_AT.y, rank); onShake(rank >= 4 ? 1 : 0); });
        later(760, lower);
      } else {
        setLeft({ row: ROW.present, up: true });
        later(90, () => spawn("flare", element, ARMS_PALM.x, ARMS_PALM.y, rank));
        if (rank >= 3) later(200, () => spawn("charge", element, ARMS_PALM.x, ARMS_PALM.y - 40, rank));
        later(780, lower);
      }
      // A hit that never lands (the target fell to an ally first) must not leave an arm hanging in view.
      later(1600, lower);
    } else if (cue.type === "land") {
      land(cue.move, cue.critical);
    } else {
      clear();
      setRight(REST);
      setLeft({ row: ROW.brace, up: true, push: true });
      spawn("ward", "frost", WARD_AT.x, WARD_AT.y - 10, Math.min(5, 1 + Math.floor(cue.amount / 3)));
      spawn("spark", "physical", WARD_AT.x + 30, WARD_AT.y - 40, 3);
      onShake(2);
      later(120, () => setLeft({ row: ROW.brace, up: true }));
      later(480, lower);
    }
  }, [element, lower, onShake, spawn]);

  function land(move: SelfMove, critical?: boolean) {
    clear();
    if (move.kind === "strike") {
      // Hit-stop: the swing lands on the strike frame and holds a beat before the arm drops.
      setRight({ row: ROW.strike, up: true, push: true });
      spawn("smear", "physical", WEAPON_PIVOT.x, WEAPON_PIVOT.y, move.rank, 35, -95);
      onShake(Math.min(3, 1 + Math.floor(move.rank / 2) + (critical ? 1 : 0)));
      later(300, () => setRight({ row: ROW.strike, up: true }));
      later(380, lower);
    } else {
      setLeft({ row: ROW.present, up: true, push: true });
      spawn("flare", element, ARMS_PALM.x, ARMS_PALM.y, move.rank);
      if (move.rank >= 3 || critical) onShake(move.rank >= 5 || critical ? 2 : 1);
      later(340, lower);
    }
  }

  useEffect(() => {
    cueRef.current = reduced ? null : play;
    return () => { cueRef.current = null; };
  }, [cueRef, play, reduced]);
  useEffect(() => () => clear(), []);

  if (reduced) return null;
  const arm = (side: 0 | 1, state: Arm, x: number) => (
    <g className={"fp-arm fp-arm-" + (side ? "r" : "l") + (state.up ? " fp-arm-up" : "") + (state.push ? " fp-arm-push" : "")}
      style={{ transform: `translate(0px, ${state.up ? 0 : HIDDEN}px)` }}>
      <svg x={x} y={TOP_Y} width={FW * K} height={FH * K} viewBox={`${side * FW} ${state.row * FH} ${FW} ${FH}`} overflow="hidden">
        <image href={sheet} width={FW * 2} height={FH * 5} imageRendering="pixelated" preserveAspectRatio="none" />
      </svg>
    </g>
  );
  return <g className="fp-arms" aria-hidden="true" pointerEvents="none">
    {arm(0, left, LEFT_X)}
    {arm(1, right, RIGHT_X)}
    <FxLayer effects={effects} reduced={false} />
  </g>;
}
