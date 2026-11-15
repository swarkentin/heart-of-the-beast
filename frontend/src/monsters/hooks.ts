import { useEffect, useState } from "react";
import { loadSprite, peekSprite, type SpriteData } from "./spriteStore";

/** True while the user prefers reduced motion; updates live if the setting changes. */
export function useReducedMotion(): boolean {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(query);
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

/**
 * The sprite for "<theme>/<creature>": undefined while loading, null if there is none or it failed to load.
 * Already-loaded sprites resolve synchronously so a re-mounted enemy never flashes.
 */
export function useSprite(spriteId: string | undefined): SpriteData | null | undefined {
  const [state, setState] = useState<SpriteData | null | undefined>(() => peekSprite(spriteId));
  useEffect(() => {
    if (!spriteId) {
      setState(null);
      return;
    }
    const cached = peekSprite(spriteId);
    if (cached !== undefined) {
      setState(cached);
      return;
    }
    let live = true;
    void loadSprite(spriteId).then((data) => {
      if (live) setState(data);
    });
    return () => {
      live = false;
    };
  }, [spriteId]);
  return state;
}
