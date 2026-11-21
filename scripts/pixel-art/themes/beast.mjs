// The Heart of the Beast (ADR 0040). Not a dungeon theme: a single unique boss that can take the place of any
// dungeon's boss. Its health in a run is a boss's; every point of damage it takes also comes off one shared pool
// that every party on the server fights. unique: true exempts it from the per-theme roster rules in verify.mjs.
import { tentacle } from "../kit.mjs";

/** A hovering, beating heart: two lobes over a tapering ventricle, great vessels above, veins trailing below, and a
 * rift of light where its core shows through. Everything swells with the beat (p.glow) and lunges with the pose. */
function heart(c, p, s) {
  const u = s, beat = 1 + 0.07 * Math.max(0, p.glow) + 0.05 * (p.squash || 0);
  const cx = c.cx + (p.sx + p.shake * 0.8) * u, cy = c.floor - 40 * u + p.bob * 1.6 * u + p.crouch * 0.5 * u - p.reach * 2 * u;
  const R = 17 * u * beat;
  // Veins trailing down to the floor, and the great vessels rising out of the top.
  for (let i = 0; i < 5; i++) {
    const f = i / 4 - 0.5;
    tentacle(c, cx + f * 22 * u, cy + 18 * u, (14 + (2 - Math.abs(i - 2)) * 3) * u, 3.2 * u, "vein", { wave: p.wave, amp: 2.2 * u, phase: i * 1.4, dx: f * 0.6, dy: 1, curl: f * 0.3 });
  }
  for (const [k, len, th] of [[-0.55, 11, 6], [0.15, 14, 7], [0.7, 10, 5]]) {
    tentacle(c, cx + k * 18 * u, cy - R * 0.6, len * u, th * u, "vessel", { wave: p.wave * 0.6, amp: 1.2 * u, phase: k * 3, dx: k * 0.7 + (p.spread || 0) * k, dy: -1, curl: k * 0.4, tip: "flesh" });
  }
  // The body: two lobes and the ventricle that narrows to the apex.
  c.part().ell(cx - R * 0.55, cy - R * 0.15, R * 0.78, R * 0.72, "flesh");
  c.part().ell(cx + R * 0.55, cy - R * 0.15, R * 0.78, R * 0.72, "flesh");
  c.part().poly([[cx - R * 1.3, cy], [cx + R * 1.3, cy], [cx + R * 0.35, cy + R * 1.35], [cx, cy + R * 1.6], [cx - R * 0.35, cy + R * 1.35]], "flesh");
  c.part().ell(cx + R * 0.45, cy + R * 0.55, R * 0.7, R * 0.55, "fleshD");
  c.part().ell(cx - R * 0.75, cy - R * 0.45, R * 0.3, R * 0.2, "shine");
  // Arteries over the surface.
  c.part().line(cx - R * 0.2, cy - R * 0.7, cx - R * 0.4, cy + R * 0.9, "vein", 1.6 * u, 1 * u);
  c.part().line(cx - R * 0.35, cy + R * 0.1, cx - R * 0.95, cy + R * 0.45, "vein", 1.2 * u, 0.8 * u);
  c.part().line(cx + R * 0.3, cy - R * 0.4, cx + R * 0.85, cy + R * 0.2, "vein", 1.2 * u, 0.8 * u);
  // The rift: a split down the middle where the core glows through, wider as the heart opens (jaw).
  const open = 0.35 + (p.jaw || 0) * 0.65;
  c.part().poly([[cx + R * 0.05, cy - R * 0.55], [cx + R * 0.05 + 2.4 * u * open, cy], [cx - R * 0.05, cy + R * 0.9], [cx - R * 0.05 - 2.4 * u * open, cy + R * 0.2]], "void");
  c.part().poly([[cx + R * 0.05, cy - R * 0.4], [cx + R * 0.05 + 1.2 * u * open, cy], [cx - R * 0.05, cy + R * 0.7], [cx - R * 0.05 - 1.2 * u * open, cy + R * 0.2]], "core");
  return { s, cx, floor: c.floor, top: cy - R * 1.8, chest: { x: cx, y: cy }, hL: { x: cx - R * 1.2, y: cy }, hR: { x: cx + R * 1.2, y: cy }, mouth: { x: cx, y: cy + R * 0.2 }, head: { x: cx, y: cy, r: R }, vent: { x: cx, y: cy - R } };
}

export default {
  id: "beast", name: "The Heart of the Beast", tagline: "The heart that beats beneath every land", unique: true,
  bg: "#0a0208", shadow: [20, 4, 10], light: [255, 214, 214], fxc: ["#ff3a5a", "#ffd0d6"],
  palette: ["#5e0f1f", "#a3192e", "#ff6f7d", "#ff3a5a"],
  mats: {
    void: "#0a0208", flesh: "#a3192e", fleshD: "#6e0f20", shine: "#ff8a96", vein: "#3a0a24", vessel: "#7a1830",
    core: { color: "#ff3a5a", emissive: true, pulse: true },
  },
  creatures: [
    {
      id: "heart_of_the_beast", tier: "boss", name: "The Heart of the Beast", role: "Unique boss; the Beast's own heart, fought by every party at once. It never dies in one run: drive it off",
      attack: "lunge", special: "roar", death: "dissolve",
      attackName: "Arterial lash", specialName: "Heartquake", fx: { attack: ["stream", "burst"], special: ["ring", "shock"] },
      draw: (c, p, s) => heart(c, p, s),
    },
  ],
};
