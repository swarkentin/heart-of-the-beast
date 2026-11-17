/** The elemental look of an effect: which palette a spell, projectile or burst is drawn in. */
export type Element = "physical" | "frost" | "fire" | "acid" | "shock" | "spectral" | "arcane";

export type ElementColors = { core: string; mid: string; edge: string; dark: string };

export const ELEMENT_COLORS: Record<Element, ElementColors> = {
  physical: { core: "#ffffff", mid: "#ffe3a3", edge: "#e0a24a", dark: "#7a4a1e" },
  frost: { core: "#ffffff", mid: "#bff4ff", edge: "#5fc2f0", dark: "#2a6fb0" },
  fire: { core: "#fff3b0", mid: "#ffb347", edge: "#e8591a", dark: "#7a1f10" },
  acid: { core: "#eaffb0", mid: "#9be84a", edge: "#4fa82a", dark: "#1f5a1a" },
  shock: { core: "#ffffff", mid: "#fff58a", edge: "#7ad7ff", dark: "#2a52c4" },
  spectral: { core: "#f1ffff", mid: "#9ff0ff", edge: "#8a7dff", dark: "#3a2a7a" },
  arcane: { core: "#ffffff", mid: "#e8b8ff", edge: "#b05cff", dark: "#4a1d8a" },
};

/** The element a theme's spell-like moves default to when the move's name does not say. */
const THEME_ELEMENT: Record<string, Element> = {
  catacombs: "spectral",
  scifi: "shock",
  mobster: "physical",
  sunken: "frost",
  clockwork: "fire",
  carnival: "arcane",
  jungle: "acid",
  dreamscape: "arcane",
  arctic: "frost",
  ghosttown: "spectral",
  wasteland: "fire",
  noir: "physical",
  arcade: "shock",
  eldritch: "arcane",
  infernal: "fire",
};

const KEYWORDS: [RegExp, Element][] = [
  [/frost|ice|rime|freez|glacier|glacial|cryo|snow|whiteout|avalanche|chill/, "frost"],
  [/fire|flame|molotov|furnace|burn|scald|torch|steam|pressure|exhaust|boiler|blast/, "fire"],
  [/acid|caustic|corros|toxic|spore|nectar|ooze|sugar|sac|geyser|spew|spit|ink/, "acid"],
  [/soul|spectral|ghost|haunt|grave|dead|specter|lullaby|dread|nightmare|wail|siren|hanged|drown|oath|archivist/, "spectral"],
  [/arc |arc$|shock|lightning|pulse|spark|discharge|lance|barrage|alarm|suppression|zap/, "shock"],
];

/** Spell-like moves take their theme's element; physical moves stay physical unless the move name says otherwise. */
const SPELL_MOVES = new Set(["cast", "wail", "roar", "summon", "vent", "spit"]);

export function elementFor(themeId: string | undefined, label: string, move: string | undefined): Element {
  const text = label.toLowerCase();
  for (const [pattern, element] of KEYWORDS) if (pattern.test(text)) return element;
  if (move && SPELL_MOVES.has(move)) return (themeId && THEME_ELEMENT[themeId]) || "arcane";
  return "physical";
}
