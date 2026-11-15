// Room backdrop renderer: renderRoom(themeId, kind, view) -> Img (275x155, opaque, deterministic).
import { Pen, makeContext, paintArchitecture, finish } from "./painter.mjs";
import { plan } from "./props.mjs";
import { styles, KINDS, VIEWS } from "./styles.mjs";

export { KINDS, VIEWS, styles };
export { W as ROOM_W, H as ROOM_H } from "./painter.mjs";

export function renderRoom(themeId, kind, view) {
  if (!styles[themeId]) throw new Error(`no room style for theme ${themeId}`);
  const ctx = makeContext(themeId, kind, view), draws = plan(ctx);
  const img = paintArchitecture(ctx), pen = new Pen(img);
  for (const draw of draws) draw(pen);
  return finish(img, ctx);
}
