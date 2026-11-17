// The run screen dresses in its dungeon: frames, the wall behind each portrait and the label colours come from
// /art/ui/themes/<theme>/ (built by scripts/pixel-art/theme-ui.mjs). Themes without their own kit, the
// Catacombs among them, keep the default interface, so this returns no overrides for them.
import type { CSSProperties } from "react";
import { UI_THEME_COLORS, UI_THEME_IDS } from "./uiThemes.gen.ts";

/** CSS custom properties for a dungeon theme, or undefined for the default kit. */
export function themeVars(themeId?: string): CSSProperties | undefined {
  if (!themeId || !UI_THEME_IDS.includes(themeId)) return undefined;
  const art = (file: string) => `url("/art/ui/themes/${themeId}/${file}.png")`;
  const vars: Record<string, string> = {
    "--ui-frame": art("frame-panel"), "--ui-view": art("frame-view"), "--ui-inset": art("frame-inset"), "--ui-wall": art("tile-wall"), "--ui-button": art("button"),
  };
  for (const [name, value] of Object.entries(UI_THEME_COLORS[themeId] ?? {})) vars["--" + name] = value;
  return vars as unknown as CSSProperties;
}
