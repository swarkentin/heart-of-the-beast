import { useEffect } from "react";
import { useReducedMotion } from "../monsters/hooks";
import { DESCENT_MS, DESCENT_REDUCED_MS, descentCard } from "./transitions.ts";

// The way down between two floors of a dungeon (ADR 0039). Stone steps rise up over the viewport, one at a time,
// as if the party were walking down a stair; the floor's card holds between two torches; then the steps carry on
// up and away, uncovering the new floor. It covers only the viewport, so the party and the log stay in place.
// The server gives the floor's first round FloorTransitionWindow, a little longer than this plays.

const STEPS = 8;

export function FloorDescent({ depth, maxDepth, boss, onDone }: { depth: number; maxDepth?: number; boss?: string; onDone: () => void }) {
  const reduced = useReducedMotion();
  useEffect(() => {
    const timer = window.setTimeout(onDone, reduced ? DESCENT_REDUCED_MS : DESCENT_MS);
    return () => window.clearTimeout(timer);
  }, [onDone, reduced]);
  const card = descentCard(depth, maxDepth, boss);
  return <div className={"rn-descent" + (reduced ? " rn-descent-still" : "")} role="status" aria-live="polite" onClick={onDone}>
    <div className="rn-descent-steps" aria-hidden="true">{Array.from({ length: STEPS }, (_, index) => <i key={index} style={{ ["--i" as string]: index, ["--n" as string]: STEPS }} />)}</div>
    <div className="rn-descent-card">
      <span className="px-torch" aria-hidden="true" />
      <div>
        <p className="px-eyebrow">{card.eyebrow}</p>
        <h2>{card.title}</h2>
        <p>{card.line}</p>
      </div>
      <span className="px-torch" aria-hidden="true" />
    </div>
  </div>;
}
