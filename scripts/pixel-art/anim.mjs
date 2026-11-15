// Pose library. Every creature rig reads the same named pose parameters, so a
// move kind ("slash", "cast", "roar" ...) animates any creature that supports it.
// Hand offsets (aLx.. etc.) are in px at scale 1 relative to the rest position;
// +x is the viewer's right, -y is up. The rig multiplies by its scale.
export const POSE0 = {
  bob: 0, sx: 0, crouch: 0, lean: 0, twist: 0, jaw: 0, glow: 0.7, squash: 0, wave: 0, spread: 0,
  aLx: 0, aLy: 0, aRx: 0, aRy: 0, wL: 0, wR: 0, reach: 0, open: 0, rear: 0, shake: 0,
};
const lerp = (a, b, f) => a + (b - a) * f, sm = (f) => f * f * (3 - 2 * f);

export function keyPose(keys, t) {
  const full = (o) => ({ ...POSE0, ...o });
  if (t <= keys[0][0]) return full(keys[0][1]);
  for (let i = 0; i + 1 < keys.length; i++) {
    const [t0, a] = keys[i], [t1, b] = keys[i + 1];
    if (t <= t1) { const f = sm((t - t0) / (t1 - t0)), A = full(a), B = full(b), o = {}; for (const k in POSE0) o[k] = lerp(A[k], B[k], f); return o; }
  }
  return full(keys[keys.length - 1][1]);
}

// Frame t = i/(n-1). Attack/special peak (impact) lands on frame 3 of 6.
export const MOVES = {
  slash: [[0, {}], [0.4, { aRx: 9, aRy: -24, wR: 45, lean: -2, crouch: 1, twist: 3, aLx: -2, glow: 0.8 }], [0.6, { aRx: -12, aRy: 16, wR: -80, lean: 4, crouch: 4, twist: -4, reach: 1, aLy: 3, glow: 1 }], [0.8, { aRx: -9, aRy: 10, wR: -62, lean: 2, crouch: 3, twist: -2, reach: 0.4 }], [1, {}]],
  smash: [[0, {}], [0.4, { aLy: -27, aRy: -27, aLx: -4, aRx: 4, lean: -3, crouch: -1, spread: 0.4 }], [0.6, { aLy: 16, aRy: 16, aLx: 3, aRx: -3, lean: 5, crouch: 5, reach: 1, glow: 1 }], [0.8, { aLy: 12, aRy: 12, lean: 3, crouch: 4, reach: 0.5 }], [1, {}]],
  lunge: [[0, {}], [0.4, { lean: -4, crouch: 2, jaw: 0.6, aLy: -6, aRy: -6, aLx: -5, aRx: 5, rear: 1 }], [0.6, { lean: 7, crouch: 3, jaw: 1, reach: 1, aLy: 8, aRy: 8, aLx: 4, aRx: -4, glow: 1 }], [0.8, { lean: 4, jaw: 0.4, reach: 0.4 }], [1, {}]],
  claw: [[0, {}], [0.4, { aLx: -8, aLy: -22, aRx: 8, aRy: -8, lean: -2, twist: 2, spread: 0.5 }], [0.6, { aLx: 10, aLy: 14, aRx: -2, aRy: -2, lean: 4, twist: -3, reach: 1, glow: 1 }], [0.8, { aLx: 6, aLy: 8, aRx: -10, aRy: 12, lean: 3, twist: 2, reach: 0.5 }], [1, {}]],
  shoot: [[0, {}], [0.4, { aRx: -6, aRy: -16, lean: -1, crouch: 1, wR: 0, glow: 0.9 }], [0.6, { aRx: -6, aRy: -20, lean: -2, wR: -8, reach: 1, glow: 1, shake: 1 }], [0.8, { aRx: -6, aRy: -17, wR: -4, shake: -1 }], [1, {}]],
  spit: [[0, {}], [0.4, { lean: -5, jaw: 0.5, crouch: 2, glow: 0.9 }], [0.6, { lean: 6, jaw: 1, reach: 1, crouch: 3, glow: 1 }], [0.8, { lean: 3, jaw: 0.7, reach: 0.5 }], [1, {}]],
  slam: [[0, {}], [0.4, { rear: 1, squash: -0.2, aLy: -14, aRy: -14, crouch: -2 }], [0.6, { rear: -0.4, squash: 0.25, aLy: 12, aRy: 12, reach: 1, crouch: 5, glow: 1 }], [0.8, { squash: 0.1, crouch: 3, reach: 0.4 }], [1, {}]],
  cast: [[0, {}], [0.4, { aLx: -7, aLy: -20, aRx: 7, aRy: -20, lean: -1, glow: 1, spread: 0.3 }], [0.6, { aLx: -4, aLy: -26, aRx: 4, aRy: -26, lean: 2, glow: 1, reach: 1, spread: 0.6 }], [0.8, { aLx: -5, aLy: -22, aRx: 5, aRy: -22, glow: 1, reach: 0.6 }], [1, {}]],
  roar: [[0, {}], [0.4, { lean: -5, jaw: 1, spread: 0.4, crouch: 2, aLx: -4, aRx: 4, aLy: -10, aRy: -10 }], [0.6, { lean: -4, jaw: 1, spread: 0.5, crouch: 1, shake: 1, glow: 1, aLx: -5, aRx: 5, aLy: -16, aRy: -16 }], [0.8, { lean: -2, jaw: 0.8, spread: 0.3, shake: -1, glow: 1 }], [1, {}]],
  summon: [[0, {}], [0.4, { aLx: -8, aLy: 8, aRx: 8, aRy: 8, crouch: 2, glow: 0.9, spread: 0.5 }], [0.6, { aLx: -10, aLy: -24, aRx: 10, aRy: -24, crouch: -1, glow: 1, spread: 1, reach: 1 }], [0.8, { aLx: -8, aLy: -18, aRx: 8, aRy: -18, glow: 1, spread: 0.7 }], [1, {}]],
  guard: [[0, {}], [0.4, { aLx: 9, aLy: -10, aRx: -9, aRy: -10, crouch: 2, lean: 1 }], [0.6, { aLx: 11, aLy: -14, aRx: -11, aRy: -14, crouch: 3, glow: 1, shake: 1 }], [0.8, { aLx: 10, aLy: -12, aRx: -10, aRy: -12, crouch: 2 }], [1, {}]],
  wail: [[0, {}], [0.4, { lean: -4, jaw: 0.7, spread: 0.6, glow: 0.9, aLx: -6, aRx: 6, aLy: -8, aRy: -8 }], [0.6, { lean: -2, jaw: 1, spread: 1, glow: 1, shake: 1, aLx: -9, aRx: 9, aLy: -14, aRy: -14, reach: 1 }], [0.8, { jaw: 0.8, spread: 0.8, glow: 1, shake: -1 }], [1, {}]],
  vent: [[0, {}], [0.4, { open: 0.5, rear: 0.6, crouch: 1, shake: 1 }], [0.6, { open: 1, rear: 1, crouch: -1, glow: 1, shake: -1, reach: 1 }], [0.8, { open: 0.8, rear: 0.5, shake: 1 }], [1, {}]],
  spin: [[0, {}], [0.4, { twist: -6, spread: 0.6, crouch: 1, aLx: -8, aRx: 8 }], [0.6, { twist: 6, spread: 1, glow: 1, reach: 1, aLx: -12, aRx: 12, aLy: -4, aRy: -4 }], [0.8, { twist: -4, spread: 0.7 }], [1, {}]],
  hit: [[0, { shake: 2, lean: -3, crouch: 1, glow: 1, jaw: 0.5, aLy: -3, aRy: -3 }], [1, { shake: -1, lean: -1, jaw: 0.3 }]],
  death: [[0, { lean: -3, jaw: 0.8, shake: 1, glow: 1 }], [0.35, { lean: -5, crouch: 3, jaw: 1, aLy: 6, aRy: 6, spread: 0.5, glow: 0.7, shake: -1 }], [1, { lean: -7, crouch: 12, aLy: 14, aRy: 14, jaw: 1, glow: 0, squash: -0.5 }]],
};

/** Pose for animation `anim` ("idle", "hit", "attack", "special", "death") at frame i of n. */
export function poseFor(anim, kind, i, n) {
  const t = n > 1 ? i / (n - 1) : 0;
  if (anim === "idle") {
    const ph = (i / n) * Math.PI * 2, s = Math.sin(ph), c = Math.cos(ph);
    return { ...POSE0, bob: s * 1.1, aLy: -s * 0.8, aRy: -s * 0.8, aLx: -c * 0.6, aRx: c * 0.6, glow: 0.65 + 0.3 * s, wave: ph, jaw: Math.max(0, s) * 0.15, wL: s * 3, wR: -s * 3, squash: s * 0.05, spread: 0.1 * s };
  }
  const keys = MOVES[anim === "hit" ? "hit" : anim === "death" ? "death" : kind];
  if (!keys) throw new Error("unknown move kind " + kind);
  return { ...keyPose(keys, t), wave: t * Math.PI * 2 };
}
