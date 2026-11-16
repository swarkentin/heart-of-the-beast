// Props and per-kind layouts. plan(ctx) registers the room's light sources (so the architecture pass can light
// the walls around them) and returns the draw calls to run on top of the finished architecture, back to front.
import { mix, hex } from "../engine.mjs";
import { Pen, VPX, VPY, W, H, CINE_TOP } from "./painter.mjs";

const R = Math.round;
const tone = (c, f) => c.map((v) => Math.max(0, Math.min(255, R(v * f))));
const light = (ctx, x, y, r, c, i = 0.9) => ctx.lights.push({ x, y, r, c, i });
const stone = (ctx, l) => (l < 0.5 ? mix(ctx.wall.c[0], ctx.wall.c[1], l * 2) : mix(ctx.wall.c[1], ctx.wall.c[2], (l - 0.5) * 2));
const dark = (ctx) => mix(ctx.fog, [0, 0, 0], 0.55);
const WHITE = [255, 255, 255];

// ---------- primitives ----------
function lamp(pen, ctx, x, y, s) {
  const [kind] = ctx.style.lamp, c = ctx.lampColor, sz = Math.max(2, R(s)), core = mix(c, WHITE, 0.6);
  if (kind === "torch") {
    pen.rect(x - 1, y + sz, 2, sz * 2, [46, 32, 22]); pen.rect(x - sz, y + sz - 1, sz * 2, 2, [86, 74, 66]);
    pen.ellipse(x, y, sz, R(sz * 1.7), c, 0.9); pen.ellipse(x, y + 1, R(sz * 0.65), R(sz * 1.2), mix(c, WHITE, 0.35)); pen.ellipse(x, y + 1, Math.max(1, R(sz * 0.3)), R(sz * 0.6), core);
  } else if (kind === "strip") {
    pen.rect(x - sz, y - sz * 3, sz * 2 + 1, sz * 6, tone(ctx.wall.c[0], 0.7)); pen.rect(x - sz + 1, y - sz * 3 + 1, sz * 2 - 1, sz * 6 - 2, c); pen.rect(x - 1, y - sz * 3 + 1, 1, sz * 6 - 2, core);
  } else {
    pen.vline(x, y - sz * 5, sz * 4, [60, 52, 48]); pen.disc(x, y, sz, tone(c, 0.7)); pen.disc(x, y, Math.max(1, sz - 1), c); pen.px(x - 1, y - 1, core);
  }
}
const addLamp = (ctx, draws, x, y, s, r) => { light(ctx, x, y, r, ctx.lampColor, 0.85); draws.push((pen) => lamp(pen, ctx, x, y, s)); };

function column(pen, ctx, x, yTop, yBot, w) {
  const x0 = R(x - w / 2), n = Math.max(2, R(w));
  for (let i = 0; i < n; i++) { const t = i / (n - 1), l = 0.18 + 0.55 * Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.12)); pen.rect(x0 + i, R(yTop), 1, R(yBot - yTop), stone(ctx, l)); }
  pen.rect(x0 - 1, R(yTop), n + 2, Math.max(2, R(w * 0.25)), stone(ctx, 0.6)); pen.rect(x0 - 1, R(yBot - w * 0.3), n + 2, Math.max(2, R(w * 0.3)), stone(ctx, 0.45));
  pen.rect(x0 - 1, R(yTop + w * 0.25), n + 2, 1, dark(ctx));
}

function runeCircle(pen, ctx, cx, cy, rx, ry, alpha = 0.3) {
  const c = ctx.accent;
  pen.ellipse(cx, cy, rx, ry, c, alpha, false); pen.ellipse(cx, cy, R(rx * 0.7), R(ry * 0.7), c, alpha * 0.8, false);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.2; pen.px(cx + Math.cos(a) * rx * 0.85, cy + Math.sin(a) * ry * 0.85, mix(c, WHITE, 0.4), alpha + 0.1); }
  pen.glow(cx, cy, Math.max(8, ry * 2.6), c, 0.18);
}

function doorway(pen, ctx, x, yb, w, h, style = ctx.style.door, open = true) {
  const x0 = R(x - w / 2), top = R(yb - h), f = ctx.style.door, accent = ctx.accent;
  const frame = (l) => stone(ctx, l), hole = dark(ctx);
  if (style === "arch") {
    const r = R(w / 2);
    pen.rect(x0 - 2, top - 2 + r, w + 4, h - r + 2, frame(0.55)); pen.ellipse(x, top + r, r + 2, r + 2, frame(0.6));
    pen.rect(x0, top + r, w, h - r, hole); pen.ellipse(x, top + r, r, r, hole);
    for (let i = 0; i < 7; i++) { const a = Math.PI + (i / 6) * Math.PI; pen.px(x + Math.cos(a) * (r + 1), top + r + Math.sin(a) * (r + 1), frame(0.9)); }
    pen.rect(x0 - 2, yb - 2, w + 4, 2, frame(0.8));
  } else if (style === "blast") {
    pen.rect(x0 - 2, top - 2, w + 4, h + 2, tone(ctx.wall.c[0], 0.75));
    pen.rect(x0, top, w, h, mix(ctx.wall.c[2], dark(ctx), 0.45)); pen.vline(x, top, h, dark(ctx)); pen.vline(x - 1, top, h, tone(ctx.wall.c[2], 0.9));
    for (let i = 0; i < 4; i++) pen.rect(x0 + 1, top + R((i + 0.5) * h / 4), w - 2, 1, tone(ctx.wall.c[0], 0.8));
    const hz = hex("#ffb64f"); for (let i = 0; i < w; i += 4) { pen.rect(x0 + i, top - 2, 2, 2, hz); pen.rect(x0 + i + 2, top - 2, 2, 2, [20, 20, 24]); }
    pen.rect(x0 - 3, top + R(h * 0.4), 1, 2, accent); pen.rect(x0 + w + 2, top + R(h * 0.4), 1, 2, [255, 90, 70]);
  } else if (style === "round") {
    const r = Math.min(R(w / 2), R(h / 2)), cy = R(yb - r);
    pen.disc(x, cy, r + 2, tone(ctx.wall.c[0], 0.7)); pen.disc(x, cy, r, mix(ctx.wall.c[2], dark(ctx), 0.35)); pen.disc(x, cy, R(r * 0.7), mix(ctx.wall.c[1], dark(ctx), 0.3));
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI; pen.line(R(x + Math.cos(a) * r * 0.9), R(cy + Math.sin(a) * r * 0.9), R(x - Math.cos(a) * r * 0.9), R(cy - Math.sin(a) * r * 0.9), ctx.wall.c[2]); }
    pen.disc(x, cy, Math.max(2, R(r * 0.22)), ctx.lampColor); pen.rect(x0 - 3, yb - 3, w + 6, 3, tone(ctx.wall.c[0], 0.8));
  } else if (style === "curtain") {
    pen.rect(x0 - 2, top - 3, w + 4, 4, ctx.accent); pen.rect(x0, top, w, h, hole);
    for (let i = 0; i < R(w / 2); i++) { const edge = i / (w / 2), cw = R(w * 0.34 * (1 - 0.4 * Math.sin(i))); void edge; void cw; }
    const cl = ctx.wall.c[2], cd = ctx.wall.c[1];
    for (let i = 0; i < R(w * 0.36); i++) { const c = ((i >> 1) & 1) ? cl : cd; pen.rect(x0 + i, top, 1, h - (i % 3), c); pen.rect(x0 + w - 1 - i, top, 1, h - ((i + 1) % 3), c); }
  } else if (style === "organic") {
    pen.ellipse(x, R(yb - h / 2), R(w / 2) + 2, R(h / 2) + 1, ctx.wall.c[2]); pen.ellipse(x, R(yb - h / 2), R(w / 2), R(h / 2), hole);
    for (let i = -2; i <= 2; i++) pen.line(R(x + i * w * 0.18), top, R(x + i * w * 0.1), R(top + h * 0.35), ctx.wall.c[2]);
    pen.glow(x, R(yb - h / 2), w * 0.5, accent, 0.2);
  } else { // portal
    pen.ellipse(x, R(yb - h / 2), R(w / 2) + 2, R(h / 2) + 2, tone(ctx.accent, 0.6)); pen.ellipse(x, R(yb - h / 2), R(w / 2), R(h / 2), hole);
    for (let i = 1; i <= 4; i++) pen.ellipse(x, R(yb - h / 2), R(w / 2 * (i / 4.6)), R(h / 2 * (i / 4.6)), mix(accent, ctx.lampColor, i / 5), 0.55, false);
    pen.glow(x, R(yb - h / 2), w * 0.8, accent, 0.28);
  }
  if (open && style !== "portal" && style !== "organic") pen.glow(x, R(yb - h * 0.4), w * 0.7, accent, 0.07);
  void f;
}

function altar(pen, ctx, x, yb, w, h) {
  const x0 = R(x - w / 2);
  pen.rect(x0 - 2, yb - 3, w + 4, 3, stone(ctx, 0.4)); pen.rect(x0, yb - R(h * 0.55), w, R(h * 0.55) - 3, stone(ctx, 0.55)); pen.rect(x0 - 2, yb - R(h * 0.65), w + 4, 3, stone(ctx, 0.8));
  pen.vline(x0, yb - R(h * 0.55), R(h * 0.55) - 3, stone(ctx, 0.85));
  pen.rect(x - 2, yb - R(h * 0.4), 5, 2, ctx.accent); pen.rect(x, yb - R(h * 0.48), 1, 6, ctx.accent);
  for (const dx of [-R(w * 0.38), R(w * 0.38)]) { pen.rect(x + dx - 1, yb - R(h * 0.65) - 5, 3, 5, [214, 200, 178]); pen.ellipse(x + dx, yb - R(h * 0.65) - 7, 1, 2, ctx.lampColor); pen.glow(x + dx, yb - R(h * 0.65) - 7, 11, ctx.lampColor, 0.4); }
  pen.glow(x, yb - R(h * 0.8), w * 0.7, ctx.accent, 0.3);
}

function consoleBank(pen, ctx, x, yb, w, h) {
  const x0 = R(x - w / 2), body = tone(ctx.wall.c[1], 0.8), c = ctx.accent;
  pen.rect(x0, yb - R(h * 0.5), w, R(h * 0.5), body); pen.rect(x0, yb - R(h * 0.5), w, 2, ctx.wall.c[2]);
  const n = Math.max(2, R(w / 14));
  for (let i = 0; i < n; i++) {
    const sx = x0 + 2 + R((i * (w - 4)) / n), sw = R((w - 4) / n) - 2, sh = R(h * 0.4);
    pen.rect(sx, yb - R(h * 0.5) - sh, sw, sh, tone(ctx.wall.c[0], 0.55)); pen.rect(sx + 1, yb - R(h * 0.5) - sh + 1, sw - 2, sh - 2, tone(c, 0.35 + 0.12 * (i % 3)));
    for (let k = 0; k < 3; k++) pen.hline(sx + 2, yb - R(h * 0.5) - sh + 3 + k * 3, Math.max(2, sw - 5 - ((i + k) % 3) * 2), mix(c, WHITE, 0.3));
    pen.px(sx + 2, yb - R(h * 0.25), (i & 1) ? [255, 90, 70] : c);
  }
  pen.glow(x, yb - R(h * 0.6), w * 0.8, c, 0.3);
}

function orbPedestal(pen, ctx, x, yb, w, h) {
  pen.rect(R(x - w / 4), yb - R(h * 0.45), R(w / 2), R(h * 0.45), stone(ctx, 0.5)); pen.rect(R(x - w / 3), yb - 3, R(w * 0.66), 3, stone(ctx, 0.7)); pen.rect(R(x - w / 3), yb - R(h * 0.45) - 2, R(w * 0.66), 3, stone(ctx, 0.8));
  const r = Math.max(4, R(h * 0.22)), cy = yb - R(h * 0.45) - r - 3;
  pen.glow(x, cy, r * 3.2, ctx.accent, 0.45); pen.disc(x, cy, r, tone(ctx.accent, 0.7)); pen.disc(x, cy, r - 1, ctx.accent); pen.disc(x - 1, cy - 1, Math.max(1, R(r / 3)), WHITE);
}

function chest(pen, ctx, x, yb, w, h, crate = false) {
  const x0 = R(x - w / 2), wood = crate ? tone(ctx.wall.c[1], 0.9) : [112, 70, 38], band = crate ? ctx.wall.c[2] : [196, 160, 80];
  pen.glow(x, yb - h, w * 0.9, [255, 214, 110], 0.28);
  pen.rect(x0, yb - h, w, h, wood); pen.rect(x0, yb - h, w, 2, tone(wood, 1.35));
  if (!crate) { pen.ellipse(x, yb - h, R(w / 2), 2, tone(wood, 1.2)); pen.rect(x0, yb - R(h * 0.5), w, 1, band); pen.rect(x - 1, yb - R(h * 0.62), 3, 4, band); pen.rect(x0 + 1, yb - h - 2, w - 2, 2, [255, 226, 130]); }
  else { pen.line(x0, yb - h, x0 + w - 1, yb - 1, band); pen.line(x0 + w - 1, yb - h, x0, yb - 1, band); pen.rect(x0 + 1, yb - h - 2, w - 2, 2, ctx.accent); }
  pen.rect(x0, yb - 2, w, 2, tone(wood, 0.6));
}

function gearRing(pen, cx, cy, r, c, teeth = 12) {
  pen.disc(cx, cy, r, c); pen.disc(cx, cy, R(r * 0.55), [10, 8, 10], 0.9);
  for (let i = 0; i < teeth; i++) { const a = (i / teeth) * Math.PI * 2; pen.rect(R(cx + Math.cos(a) * (r + 1)) - 1, R(cy + Math.sin(a) * (r + 1)) - 1, 3, 3, c); }
}

function bossPiece(pen, ctx, x, yb, w, h) {
  const kind = ctx.style.boss, x0 = R(x - w / 2), c = ctx.accent, lampc = ctx.lampColor;
  if (kind === "throne") {
    for (let i = 0; i < 3; i++) pen.rect(x0 - 6 + i * 3, yb - 3 - i * 3, w + 12 - i * 6, 3, stone(ctx, 0.45 + i * 0.12));
    pen.rect(x0 + 4, yb - R(h * 0.9), w - 8, R(h * 0.9) - 9, stone(ctx, 0.35)); pen.rect(x0 + 2, yb - R(h * 0.9) - 2, w - 4, 3, stone(ctx, 0.7));
    pen.rect(x0 + 8, yb - R(h * 0.4), w - 16, 7, stone(ctx, 0.6)); pen.rect(x0 + 1, yb - R(h * 0.55), 5, R(h * 0.4), stone(ctx, 0.55)); pen.rect(x0 + w - 6, yb - R(h * 0.55), 5, R(h * 0.4), stone(ctx, 0.55));
    for (const dx of [-8, 0, 8]) { pen.rect(x + dx - 1, yb - R(h * 0.9) - 6, 3, 5, stone(ctx, 0.85)); }
    pen.disc(x, yb - R(h * 0.7), 3, c); pen.glow(x, yb - R(h * 0.7), 18, c, 0.4);
  } else if (kind === "core") {
    pen.rect(x0 - 4, yb - 4, w + 8, 4, tone(ctx.wall.c[1], 0.8)); pen.rect(x0 - 2, yb - 7, w + 4, 3, ctx.wall.c[2]);
    if (ctx.id === "clockwork") { gearRing(pen, x, yb - R(h * 0.55), R(h * 0.38), tone(lampc, 0.7)); gearRing(pen, x - R(w * 0.34), yb - R(h * 0.25), R(h * 0.18), tone(lampc, 0.55), 8); pen.disc(x, yb - R(h * 0.55), R(h * 0.1), lampc); pen.glow(x, yb - R(h * 0.55), h * 0.7, lampc, 0.35); }
    else {
      const tw = R(w * 0.5), tx = R(x - tw / 2);
      pen.rect(tx, yb - h + 4, tw, h - 11, tone(ctx.wall.c[0], 0.7)); pen.rect(tx + 2, yb - h + 6, tw - 4, h - 15, tone(c, 0.5));
      for (let i = 0; i < 6; i++) pen.hline(tx + 3, yb - h + 8 + i * R((h - 18) / 6), tw - 6, mix(c, WHITE, 0.3 + 0.1 * (i % 3)));
      pen.rect(tx - 2, yb - h + 2, tw + 4, 4, ctx.wall.c[2]); pen.rect(tx - 2, yb - 12, tw + 4, 4, ctx.wall.c[2]); pen.glow(x, yb - R(h * 0.5), h * 0.75, c, 0.5);
    }
  } else if (kind === "gate") {
    pen.rect(x0 - 3, yb - h - 3, w + 6, h + 3, stone(ctx, 0.6)); pen.rect(x0, yb - h, w, h, dark(ctx));
    const half = R(w / 2) - 1;
    pen.rect(x0, yb - h, half, h, mix(ctx.wall.c[1], dark(ctx), 0.25)); pen.rect(x0 + w - half, yb - h, half, h, mix(ctx.wall.c[1], dark(ctx), 0.25));
    pen.vline(x, yb - h, h, c); pen.vline(x - 1, yb - h, h, tone(c, 0.5)); pen.vline(x + 1, yb - h, h, tone(c, 0.5));
    for (const fy of [0.2, 0.5, 0.8]) { pen.rect(x0, yb - R(h * fy), half, 2, ctx.wall.c[2]); pen.rect(x0 + w - half, yb - R(h * fy), half, 2, ctx.wall.c[2]); }
    pen.glow(x, yb - R(h * 0.5), w * 0.8, c, 0.4);
    for (const sx of [-1, 1]) { pen.rect(x + sx * R(w * 0.62) - 2, yb - R(h * 0.7), 5, R(h * 0.7), stone(ctx, 0.5)); pen.disc(x + sx * R(w * 0.62), yb - R(h * 0.72), 3, c); }
  } else { // maw
    pen.ellipse(x, yb - R(h * 0.45), R(w / 2) + 3, R(h * 0.5) + 2, ctx.wall.c[2]); pen.ellipse(x, yb - R(h * 0.45), R(w / 2), R(h * 0.5), dark(ctx));
    for (let i = 0; i < 9; i++) { const tx = x0 + 2 + R((i * (w - 4)) / 8), th = 3 + (i % 3) * 2; for (let k = 0; k < th; k++) { pen.hline(tx - R((th - k) / 3), yb - R(h * 0.95) + 4 + k, Math.max(1, R((th - k) / 1.5)), WHITE, 0.9); pen.hline(tx - R((th - k) / 3), yb - 6 - k, Math.max(1, R((th - k) / 1.5)), WHITE, 0.9); } }
    for (const sx of [-1, 1]) { pen.ellipse(x + sx * R(w * 0.3), yb - R(h * 0.95) - 5, 4, 2, c); pen.px(x + sx * R(w * 0.3), yb - R(h * 0.95) - 5, WHITE); pen.glow(x + sx * R(w * 0.3), yb - R(h * 0.95) - 5, 12, c, 0.5); }
    pen.glow(x, yb - R(h * 0.4), w * 0.5, c, 0.18);
  }
}

function scatter(pen, ctx, x0, x1, y0, y1, n, seedSalt) {
  const dust = hex(ctx.style.dust);
  for (let i = 0; i < n; i++) {
    const hsh = Math.sin((i + 1) * 12.9898 + seedSalt * 78.233) * 43758.5453, fx = hsh - Math.floor(hsh), g = Math.sin((i + 1) * 4.1414 + seedSalt * 9.1) * 9631.7, fy = g - Math.floor(g);
    const x = R(x0 + fx * (x1 - x0)), y = R(y0 + fy * (y1 - y0));
    if (ctx.id === "catacombs" || ctx.id === "ghosttown") { pen.rect(x, y, 3, 1, dust); pen.px(x + 1, y - 1, dust); }
    else if (ctx.id === "scifi" || ctx.id === "arctic") { pen.rect(x, y, 4, 1, tone(ctx.wall.c[2], 0.9)); pen.px(x + 4, y, (i & 1) ? ctx.accent : [255, 90, 70]); }
    else pen.rect(x, y, 2, 1, dust, 0.8);
  }
}

// ---------- sci-fi and catacombs hand-authored extras ----------
function extrasFirst(ctx, draws, kind) {
  const { geo, back } = ctx, P = ctx.project;
  if (ctx.id === "catacombs") {
    // skull niches along the side walls, hanging chains and cobwebs in the upper corners
    for (const side of [-1, 1]) for (const z of kind === "boss" ? [0.5, 0.7] : [0.62]) {
      const p = P(side * geo.HW, 0.9, geo.Z0 * z), s = ctx.unit(geo.Z0 * z);
      draws.push((pen) => { pen.rect(R(p.x - s * 0.25), R(p.y - s * 0.3), R(s * 0.5), R(s * 0.6), dark(ctx)); pen.disc(p.x, p.y + 1, Math.max(1, R(s * 0.14)), [150, 140, 128]); });
    }
    draws.push((pen) => { for (const side of [-1, 1]) for (let i = 0; i < 14; i++) { pen.line(R(VPX + side * (ctx.a + 2)), back.y0 + 1, R(VPX + side * (ctx.a + 2) + side * i * 1.6), back.y0 + 1 - R(i * 0.2), [168, 158, 170], 0.5); } });
  } else if (ctx.id === "scifi") {
    // ceiling pipes and a light strip running down the corridor, hazard stripe on the floor edges
    draws.push((pen) => {
      for (const t of [0.35, 0.7]) for (let z = 0; z < 24; z++) {
        const Z = geo.Z0 * (0.3 + 0.7 * (z / 24)), pa = P(-geo.HW * t, -geo.CH * 0.92, Z), pb = P(-geo.HW * t, -geo.CH * 0.92, Z * 1.03);
        pen.line(R(pa.x), R(pa.y), R(pb.x), R(pb.y + 1), mix([150, 210, 235], dark(ctx), 0.1 + 0.6 * (z / 24)));
        const qa = P(geo.HW * t, -geo.CH * 0.92, Z); pen.px(qa.x, qa.y, mix(ctx.accent, dark(ctx), 0.4 + 0.4 * (z / 24)));
      }
      for (let z = 0; z < 18; z++) { const Z = geo.Z0 * (0.3 + 0.7 * (z / 18)); for (const side of [-1, 1]) { const p = P(side * (geo.HW - 0.05), geo.FH * 0.98, Z); if (z % 2 === 0) pen.rect(R(p.x), R(p.y), 2, 1, [255, 182, 79], 0.9); } }
    });
  }
}

function extrasCine(ctx, draws, kind) {
  if (ctx.id === "catacombs") draws.push((pen) => { for (const sx of [34, 241]) { pen.vline(sx, 0, 8, [96, 88, 100]); pen.disc(sx, 9, 1, [96, 88, 100]); } scatter(pen, ctx, 50, 230, 80, 150, 14, 3); });
  else if (ctx.id === "scifi") draws.push((pen) => { scatter(pen, ctx, 45, 235, 70, 150, 12, 5); });
  else draws.push((pen) => scatter(pen, ctx, 45, 235, 70, 150, 9, 2));
}

// ---------- first-person layouts ----------
function planFirst(ctx) {
  const draws = [], { geo, back } = ctx, P = ctx.project, kind = ctx.kind, U = ctx.unit;
  const bx = VPX, bw = back.x1 - back.x0, bh = back.y1 - back.y0, yb = back.y1;
  // lamps on both side walls, bright pools for the architecture pass
  const lampZ = kind === "boss" ? [0.4, 0.62, 0.84] : kind === "corridor" ? [0.45, 0.78] : [0.62];
  for (const z of lampZ) for (const side of [-1, 1]) {
    const p = P(side * (geo.HW - 0.05), -geo.CH * 0.35, geo.Z0 * z), s = U(geo.Z0 * z) * 0.18;
    addLamp(ctx, draws, R(p.x), R(p.y), Math.max(2, s), R(U(geo.Z0 * z) * 3.8));
  }
  // columns
  const colZ = kind === "boss" ? [0.38, 0.58, 0.8] : kind === "corridor" ? [0.55] : kind === "event" ? [0.66] : [];
  const cols = colZ.slice().reverse();
  for (const z of cols) for (const side of [-1, 1]) {
    const Z = geo.Z0 * z, top = P(side * (geo.HW - 0.55), -geo.CH, Z), bot = P(side * (geo.HW - 0.55), geo.FH, Z);
    draws.push((pen) => column(pen, ctx, top.x, top.y, bot.y, Math.max(3, U(Z) * 0.8)));
  }
  extrasFirst(ctx, draws, kind);
  if (kind === "entry") {
    draws.push((pen) => doorway(pen, ctx, bx, yb, R(bw * 0.62), R(bh * 0.85)));
    draws.push((pen) => { for (let i = 0; i < 3; i++) pen.rect(R(bx - bw * 0.36 + i * 3), yb + 0 - 0, R(bw * 0.72 - i * 6), 1, stone(ctx, 0.3 + 0.1 * i)); });
  } else if (kind === "corridor") {
    draws.push((pen) => doorway(pen, ctx, bx, yb, R(bw * 0.5), R(bh * 0.7)));
  } else if (kind === "event") {
    const p = P(0, geo.FH, geo.Z0 * 0.9), w = R(U(geo.Z0 * 0.9) * 2.4), h = R(U(geo.Z0 * 0.9) * 2.5);
    draws.push((pen) => doorway(pen, ctx, bx, yb, R(bw * 0.22), R(bh * 0.5), ctx.style.door, false));
    light(ctx, R(p.x), R(p.y - h * 0.6), R(w * 1.6), ctx.accent, 0.55);
    const rune = P(0, geo.FH, geo.Z0 * 0.78);
    draws.push((pen) => runeCircle(pen, ctx, R(rune.x), R(rune.y), R(U(geo.Z0 * 0.78) * 2.4), R(U(geo.Z0 * 0.78) * 0.55)));
    draws.push((pen) => (ctx.style.event === "altar" ? altar : ctx.style.event === "console" ? consoleBank : orbPedestal)(pen, ctx, R(p.x), R(p.y), w, h));
  } else if (kind === "boss") {
    const w = R(bw * 0.4), h = R(bh * 0.88);
    light(ctx, bx, R(yb - h * 0.5), R(bw * 0.5), ctx.accent, 0.5);
    draws.push((pen) => bossPiece(pen, ctx, bx, yb, w, h));
    const rune = P(0, geo.FH, geo.Z0 * 0.78);
    draws.push((pen) => runeCircle(pen, ctx, R(rune.x), R(rune.y), R(U(geo.Z0 * 0.78) * 3.4), R(U(geo.Z0 * 0.78) * 0.8), 0.3));
  } else { // vault
    const p = P(0, geo.FH, geo.Z0 * 0.92), w = R(U(geo.Z0 * 0.92) * 2.2), h = R(U(geo.Z0 * 0.92) * 1.4);
    light(ctx, R(p.x), R(p.y - h), R(w * 2), [255, 214, 110], 0.6);
    draws.push((pen) => { for (const dx of [-1, 1]) chest(pen, ctx, R(p.x + dx * w * 0.95), R(p.y), R(w * 0.55), R(h * 0.7), true); chest(pen, ctx, R(p.x), R(p.y), w, h, ctx.style.vault === "crate"); });
  }
  draws.push((pen) => { const a = P(-geo.HW + 0.7, geo.FH, geo.Z0 * 0.6), b = P(geo.HW - 0.7, geo.FH, geo.Z0 * 0.9); scatter(pen, ctx, a.x, b.x, a.y, b.y + 20, kind === "boss" ? 10 : 7, 1); });
  return draws;
}

// ---------- cinematic (elevated spectator) layouts ----------
function planCine(ctx) {
  const draws = [], kind = ctx.kind, top = CINE_TOP, fy = ctx.floorY;
  // lamps on the back wall, braziers on the floor corners
  const lampX = kind === "boss" ? [38, 92, 183, 237] : [60, 215];
  for (const x of lampX) addLamp(ctx, draws, x, 14, 3, 40);
  for (const t of ctx.style.lamp[0] === "strip" ? [] : kind === "boss" ? [0.1, 0.62] : [0.12]) for (const side of [-1, 1]) {
    const y = R(fy(t)), x = R(VPX + side * (ctx.half(y) - 9));
    light(ctx, x, y - 8, 30, ctx.lampColor, 0.6);
    draws.push((pen) => { pen.rect(x - 1, y - 6, 3, 8, [46, 38, 34]); pen.rect(x - 4, y - 8, 9, 2, [86, 74, 66]); lamp(pen, ctx, x, y - 12, 3); });
  }
  // columns at the sides
  if (kind === "corridor" || kind === "event" || kind === "boss") for (const t of kind === "boss" ? [0.3, 0.75] : [0.45]) for (const side of [-1, 1]) {
    const y = R(fy(t)), x = R(VPX + side * (ctx.half(y) - 3));
    draws.push((pen) => column(pen, ctx, x, y - 44 * (0.6 + t * 0.6), y, 10 + t * 5));
  }
  extrasCine(ctx, draws, kind);
  if (kind === "entry") draws.push((pen) => doorway(pen, ctx, VPX, top + 2, 34, 34));
  else if (kind === "corridor") draws.push((pen) => doorway(pen, ctx, VPX, top + 2, 28, 30));
  else if (kind === "event") {
    light(ctx, VPX, top - 6, 36, ctx.accent, 0.5);
    draws.push((pen) => runeCircle(pen, ctx, VPX, R(fy(0.55)), 66, 15, 0.28));
    draws.push((pen) => (ctx.style.event === "altar" ? altar : ctx.style.event === "console" ? consoleBank : orbPedestal)(pen, ctx, VPX, top + 6, 38, 34));
  } else if (kind === "boss") {
    light(ctx, VPX, top - 10, 50, ctx.accent, 0.55);
    draws.push((pen) => runeCircle(pen, ctx, VPX, R(fy(0.6)), 90, 18, 0.28));
    draws.push((pen) => bossPiece(pen, ctx, VPX, top + 6, 50, 38));
  } else {
    light(ctx, VPX, top - 4, 44, [255, 214, 110], 0.6);
    draws.push((pen) => { for (const dx of [-1, 1]) chest(pen, ctx, VPX + dx * 36, top + 8, 18, 12, true); chest(pen, ctx, VPX, top + 8, 30, 18, ctx.style.vault === "crate"); });
  }
  return draws;
}

export function plan(ctx) { return ctx.view === "first" ? planFirst(ctx) : planCine(ctx); }
export { Pen };
void W; void H; void VPY;
