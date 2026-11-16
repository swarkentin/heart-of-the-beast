// Per-theme room styling: surface patterns, palettes, light fixtures and the signature props of each room kind.
// A style is pure data; painter.mjs and props.mjs turn it into pixels. Catacombs and Sci-Fi additionally have
// hand-authored props (see props.mjs); the other nine themes get their own palette, patterns and prop variants.
//
//   wall / floor / ceil : [pattern, [dark, mid, light]]
//   fog                 : colour distant surfaces fade to
//   lamp                : [fixture, glow colour]   fixture = torch | strip | bulb
//   door                : arch | blast | curtain | round | organic | portal
//   event               : altar | console | orb          (shrine / discovery rooms)
//   boss                : throne | core | gate | maw      (set piece at the back of the boss hall)
//   vault               : chest | crate                   (reward rooms)
//   accent              : second light colour (runes, status lights, spectral glow)
export const KINDS = ["entry", "corridor", "event", "boss", "vault"];
export const VIEWS = ["first", "cinema"];

export const styles = {
  catacombs: { wall: ["block", ["#17131f", "#342b3f", "#5c4f68"]], floor: ["flag", ["#17131b", "#3b3238", "#6c5d5c"]], ceil: ["block", ["#0c0a12", "#1b1624", "#2d2538"]], fog: [16, 10, 28], lamp: ["torch", "#ffae55"], door: "arch", event: "altar", boss: "throne", vault: "chest", accent: "#7dffd9", dust: "#c9b3a0" },
  scifi: { wall: ["panel", ["#0b1424", "#1a3250", "#3b6a8c"]], floor: ["grate", ["#070d18", "#15263a", "#2b5272"]], ceil: ["panel", ["#070d18", "#122238", "#27425e"]], fog: [8, 18, 46], lamp: ["strip", "#7fe9ff"], door: "blast", event: "console", boss: "core", vault: "crate", accent: "#8bff5a", dust: "#bfe9ff" },
  mobster: { wall: ["plank", ["#170d12", "#3b1d26", "#6e3a3c"]], floor: ["checker", ["#171214", "#312729", "#5a4c44"]], ceil: ["plank", ["#0b0709", "#1c1014", "#2c1a1c"]], fog: [26, 12, 30], lamp: ["bulb", "#ffc266"], door: "round", event: "orb", boss: "throne", vault: "crate", accent: "#ffb347", dust: "#d8c4a0" },
  sunken: { wall: ["block", ["#06202c", "#104356", "#2f808a"]], floor: ["wave", ["#07202a", "#14505e", "#3b8e8e"]], ceil: ["wave", ["#041620", "#0b3342", "#165a68"]], fog: [6, 24, 52], lamp: ["bulb", "#5ef0ff"], door: "arch", event: "orb", boss: "maw", vault: "chest", accent: "#a8fff0", dust: "#9be8ee" },
  clockwork: { wall: ["panel", ["#24150b", "#54351a", "#a2742f"]], floor: ["checker", ["#1a110a", "#47311a", "#8c6428"]], ceil: ["panel", ["#150d07", "#32200f", "#5a3b1a"]], fog: [38, 20, 12], lamp: ["bulb", "#ffbd5a"], door: "round", event: "console", boss: "core", vault: "crate", accent: "#ffe08a", dust: "#e8c88a" },
  carnival: { wall: ["stripe", ["#24102c", "#74204f", "#e45c8c"]], floor: ["checker", ["#1a0c24", "#4a2060", "#8a4a9a"]], ceil: ["stripe", ["#12081a", "#341446", "#5a2670"]], fog: [34, 14, 58], lamp: ["bulb", "#ff6ad5"], door: "curtain", event: "orb", boss: "gate", vault: "chest", accent: "#fff0a0", dust: "#ffd0ec" },
  jungle: { wall: ["organic", ["#06141a", "#0f3a30", "#22805a"]], floor: ["organic", ["#07181a", "#124634", "#2a8a58"]], ceil: ["organic", ["#040f12", "#0a2a24", "#14503c"]], fog: [4, 26, 34], lamp: ["bulb", "#7dffe0"], door: "organic", event: "orb", boss: "maw", vault: "chest", accent: "#ff9ae0", dust: "#b8ffe8" },
  dreamscape: { wall: ["wave", ["#140c2e", "#3a2072", "#7e4cc6"]], floor: ["checker", ["#100a26", "#2e1a5a", "#6a4aa8"]], ceil: ["wave", ["#0a0618", "#1e1040", "#3a2272"]], fog: [28, 14, 64], lamp: ["bulb", "#ff8fd8"], door: "portal", event: "orb", boss: "gate", vault: "chest", accent: "#a8f0ff", dust: "#ffd8ff" },
  arctic: { wall: ["ice", ["#0a1626", "#1f4a6a", "#72aecb"]], floor: ["ice", ["#09121f", "#1b3f5e", "#5e9ab8"]], ceil: ["panel", ["#060e1a", "#102a42", "#244c6a"]], fog: [10, 24, 52], lamp: ["strip", "#d8f8ff"], door: "blast", event: "console", boss: "core", vault: "crate", accent: "#ff8a5a", dust: "#e8fbff" },
  ghosttown: { wall: ["plank", ["#1c110c", "#46301f", "#80593a"]], floor: ["plank", ["#150e09", "#3a2a1a", "#6a4a2c"]], ceil: ["plank", ["#0e0805", "#241810", "#3a2818"]], fog: [42, 22, 14], lamp: ["torch", "#ffc266"], door: "arch", event: "altar", boss: "gate", vault: "chest", accent: "#7dffd0", dust: "#d6c0a0" },
  wasteland: { wall: ["panel", ["#18130d", "#493a22", "#8c6c3a"]], floor: ["dirt", ["#14100a", "#3a2e1a", "#6e5630"]], ceil: ["panel", ["#0d0a07", "#2a2012", "#4a3a20"]], fog: [38, 28, 16], lamp: ["torch", "#ffb347"], door: "blast", event: "console", boss: "throne", vault: "crate", accent: "#9be84a", dust: "#d8c08a" },
};

// Per-kind room geometry for the first-person view, in world tiles. HW/CH/FH are the half-width, ceiling height
// above the eye and floor depth below it; k is the screen scale; Z0 the distance to the back wall.
export const GEOMETRY = {
  entry: { HW: 3.0, CH: 3.0, FH: 2.2, k: 11, Z0: 10 },
  corridor: { HW: 4.0, CH: 3.4, FH: 2.4, k: 11, Z0: 14 },
  event: { HW: 5.5, CH: 3.8, FH: 2.6, k: 11, Z0: 10 },
  boss: { HW: 7.5, CH: 4.8, FH: 3.2, k: 11, Z0: 12 },
  vault: { HW: 4.2, CH: 3.2, FH: 2.4, k: 11, Z0: 8 },
};
