import { useEffect, useState } from "react";
import { useReducedMotion, useSprite } from "./hooks";

/** A small animated idle portrait that reuses the combat sprite manifest and sheet. */
export function BestiarySprite({ spriteId, name }: { spriteId?: string; name: string }) {
  const sprite = useSprite(spriteId);
  const reduced = useReducedMotion();
  const [frame, setFrame] = useState(0);
  const idle = sprite?.creature.animations.idle;
  useEffect(() => {
    setFrame(0);
    if (!idle || reduced || idle.frames < 2) return;
    const timer = window.setInterval(() => setFrame(value => (value + 1) % idle.frames), Math.max(80, 1000 / idle.fps));
    return () => window.clearInterval(timer);
  }, [spriteId, idle?.frames, idle?.fps, reduced]);
  if (!sprite) return <div className="px-bestiary-sprite px-bestiary-placeholder" role="img" aria-label={name + " portrait"}><span>?</span></div>;
  const { creature } = sprite;
  const { w, h } = creature.frame;
  const anim = creature.animations.idle;
  const shownFrame = reduced ? 0 : frame;
  return <div className="px-bestiary-sprite" role="img" aria-label={name + " animated portrait"}>
    <svg viewBox={`${shownFrame * w} ${anim.row * h} ${w} ${h}`} aria-hidden="true" shapeRendering="crispEdges">
      <image href={sprite.url} width={sprite.sheetW} height={sprite.sheetH} />
    </svg>
  </div>;
}
