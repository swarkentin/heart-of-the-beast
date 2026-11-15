import { useEffect, useState } from "react";
import { renderFx, renderMarker, type FxInstance, type Rect } from "./render";

const MARKER_MS = 900;

function Rects({ rects }: { rects: Rect[] }) {
  return <>{rects.map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.f} opacity={r.o} />)}</>;
}

/** The current time, refreshed every animation frame while any effect is alive. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const tick = () => {
      setNow(performance.now());
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active]);
  return now;
}

/**
 * Draws combat effects in scene coordinates, above the sprites. With reduced motion each effect becomes a
 * short-lived static marker where it lands instead of an animation.
 */
export function FxLayer({ effects, reduced }: { effects: FxInstance[]; reduced: boolean }) {
  const now = useNow(effects.length > 0);
  return (
    <g className="fx-layer" pointerEvents="none" shapeRendering="crispEdges" aria-hidden="true">
      {effects.map((fx) => {
        const age = now - fx.born;
        if (age < 0) return null;
        if (reduced) return age < MARKER_MS ? <Rects key={fx.id} rects={renderMarker(fx)} /> : null;
        return age <= fx.dur ? <Rects key={fx.id} rects={renderFx(fx, age / fx.dur)} /> : null;
      })}
    </g>
  );
}
