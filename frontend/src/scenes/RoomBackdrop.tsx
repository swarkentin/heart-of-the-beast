import { useEffect, useState } from "react";
import { backdropKind, backdropUrl, DEFAULT_THEME_ID, type BackdropKind, type BackdropRoom, type BackdropView } from "./backdrop";

export type BackdropRef = { themeId?: string; kind: BackdropKind };
export const backdropRef = (room: BackdropRoom, runThemeId?: string): BackdropRef => ({ themeId: room.themeId || runThemeId, kind: backdropKind(room) });

/** Plain gradient stand-in shown until (or instead of) the pixel art: a missing file never leaves the scene blank. */
function Placeholder({ view }: { view: BackdropView }) {
  const id = "backdrop-placeholder-" + view;
  return <g data-backdrop="placeholder">
    <defs><linearGradient id={id} x2="0" y2="1"><stop stopColor="#2a2630"/><stop offset="1" stopColor="#121319"/></linearGradient></defs>
    <rect width="1100" height="620" fill={"url(#" + id + ")"}/>
    {view === "first" ? <path d="M0 400L340 255H760L1100 400V620H0Z" fill="#000" opacity=".25"/> : <path d="M0 0H1100V145H0z" fill="#000" opacity=".25"/>}
  </g>;
}

/**
 * The themed pixel-art background of a room, drawn inside a 1100x620 scene SVG. The 275x155 art is scaled 4x with
 * nearest-neighbour filtering. If the requested theme's image fails to load, the Catacombs image of the same kind is
 * tried, then a plain placeholder.
 */
export function RoomBackdrop({ themeId, kind, view }: BackdropRef & { view: BackdropView }) {
  const [source, setSource] = useState(() => backdropUrl(themeId, kind, view));
  const [failed, setFailed] = useState(false);
  useEffect(() => { setSource(backdropUrl(themeId, kind, view)); setFailed(false); }, [themeId, kind, view]);
  if (failed) return <Placeholder view={view}/>;
  const fallback = backdropUrl(DEFAULT_THEME_ID, kind, view);
  return <image data-backdrop={themeId || DEFAULT_THEME_ID} data-kind={kind} href={source} x="0" y="0" width="1100" height="620" preserveAspectRatio="none"
    style={{ imageRendering: "pixelated" }}
    onError={() => { if (source !== fallback) setSource(fallback); else setFailed(true); }}/>;
}
