// Character sprites for rooms with someone in them (ADR 0038): the shopkeeper behind the camp stall, and the keepers
// who wait in vaults with a deal. Each is a character grid: one letter per art pixel, "." for transparent, colours
// from the palette. Eyes are listed separately so they can blink.

export type Sprite = { rows: readonly string[]; palette: Record<string, string> };
export type Character = { body: Sprite; eyes: [number, number][]; skin: string; float?: boolean; ghost?: boolean };

const K = "#1a0f08";

// ---- The shopkeeper: a travelling merchant in a plumed hat, waist-up behind the counter ------------------------

export const SHOPKEEPER: Character = {
  skin: "#e8b48a",
  eyes: [[10, 12], [14, 12]],
  body: {
    palette: {
      K, H: "#3b2a5a", h: "#5a4384", Y: "#f2c94c", F: "#d94f4f", f: "#ff9a8a",
      S: "#e8b48a", s: "#c48a62", e: K, D: "#e6e0d2", d: "#b3ab9c", m: "#8a3a2a",
      C: "#2f6b5a", c: "#4a9a80", G: "#f2c94c", W: "#f4ead6", R: "#b8323a", r: "#7a1e26", p: "#f0907a",
    },
    rows: [
      "...............KK.......",
      "..............KfFK......",
      "..............KfFK......",
      "........KKKKKKKfFK......",
      ".......KhhhhhhKfFK......",
      ".......KhhhhhhhKK.......",
      ".......KhHHHHHHHK.......",
      ".......KYYYYYYYYK.......",
      "...KKKKKHHHHHHHHKKKKK...",
      "..KHhHHHHHHHHHHHHHHhHK..",
      "...KKKKKKKKKKKKKKKKKK...",
      "........KSSSSSSSK.......",
      "........KSSSSSSSK.......",
      "........KpSSsSSpK.......",
      "........KDSSsSSDK.......",
      ".......KDDDmmmDDDK......",
      ".......KDDDDDDDDDK......",
      "......KRRDDdDdDDRRK.....",
      ".....KCRrRDDDDDRrRCK....",
      "....KCCCRRKDDDKRRCCCK...",
      "...KCCcCGCCKdKCCGCcCCK..",
      "...KCcCCGCCCWCCCGCCcCK..",
      "..KCCcCCGCCCWCCCGCCcCCK.",
      "..KCcCCCGCCCYCCCGCCCcCK.",
      "..KCCcCCGCCCWCCCGCCcCCK.",
      "..KCcCCCGCCCYCCCGCCCcCK.",
      "..KSSKCCGCCCWCCCGCCKSSK.",
      "..KSsKKKKKKKKKKKKKKKsSK.",
    ],
  },
};

export const LANTERN: Sprite = {
  palette: { K, i: "#5d5868", Y: "#ffe08a", y: "#f2a33c" },
  rows: [
    "..K..",
    ".KiK.",
    "KiiiK",
    "KYyYK",
    "KyYyK",
    "KYyYK",
    "KiiiK",
    ".KKK.",
  ],
};

export const WARES_SHELF: Sprite = {
  palette: {
    K, b: "#4a2a12", B: "#6a3e1a", r: "#c0392b", R: "#ff7a6b", u: "#2d6fc0", U: "#7ab8ff", g: "#2f9a4a", G: "#8fe6a0",
    p: "#f4ead6", P: "#c9b48a", s: "#8a8494", S: "#cfd6e0", y: "#f2c94c", o: "#b86bff",
  },
  rows: [
    "..KK.....KK..........KK....KKK....",
    ".KrrK...KuuK...KKK..KggK..KoooK...",
    ".KRrK...KUuK..KpPpK.KGgK..KoyoK...",
    ".KrrK...KuuK..KpPpK.KggK...KKK....",
    "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "...KSK....KK....KyyK......KSSK....",
    "..KSsSK..KyyK..KyyyyK....KSssSK...",
    "..KSsSK..KyyK..KyyyyK....KSssSK...",
    "...KsK...KKKK...KKKK......KSSK....",
    "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  ],
};

export const COIN: Sprite = { palette: { K, Y: "#f2c94c", y: "#fff2a8" }, rows: [".KKK.", "KYyYK", "KyYYK", "KYYYK", ".KKK."] };

// ---- Vault keepers ---------------------------------------------------------------------------------------------

export const VAULT_KEEPERS: Record<string, Character> = {
  // The warden: the vault's own ghost, a hooded spirit with a lantern of cold fire.
  warden: {
    skin: "#bfe6ff", float: true, ghost: true,
    eyes: [[6, 5], [9, 5]],
    body: {
      palette: { K: "#0d2233", c: "#6fb0c9", C: "#3d6f8a", w: "#bfe6ff", e: "#e8fbff", l: "#8fffe0", L: "#3dd6b0", i: "#5d5868" },
      rows: [
        ".....KKKKK......",
        "....KCCCCCK.....",
        "...KCcccccCK....",
        "...KCKKKKKCK....",
        "...KCKwwwKCK....",
        "...KCKwwwwKCK...",
        "...KCKKKKKKCK...",
        "..KCcCCCCCCcCK..",
        "..KCcCCCCCCCcCK.",
        ".KCccCCCCCCCcCKi",
        ".KCcCCCCCCCCcCKi",
        ".KCcCCCCCCCCwwKK",
        ".KCcCCCCCCCKlLlK",
        ".KCcCCCCCCCKLlLK",
        ".KCcCCCCCCCCKKK.",
        "..KCcCCCCCCcCK..",
        "..KCcCCCCCCcCK..",
        "..KcCcCCCCcCcK..",
        "...KcKcCcKcK....",
        "....K.KcK.K.....",
        ".......K........",
      ],
    },
  },
  // The Blood Broker: a smiling stranger in a red frock coat and tall hat, ledger open.
  broker: {
    skin: "#efd9c8",
    eyes: [[6, 7], [8, 7]],
    body: {
      palette: { K, H: "#1c1424", h: "#3a2c48", r: "#b8323a", R: "#7a1e26", S: "#efd9c8", s: "#c9a892", e: K, m: "#7a1e26", W: "#f4ead6", p: "#f4ead6", P: "#c9b48a", G: "#f2c94c" },
      rows: [
        "....KKKKKKK.....",
        "....KHHHHHK.....",
        "....KHhHHHK.....",
        "....KHhHHHK.....",
        "....KrrrrrK.....",
        "..KKKHHHHHKKK...",
        "....KSSSSSK.....",
        "....KSSSSSK.....",
        "....KSmmmSK.....",
        ".....KSSSK......",
        "...KrrKWKrrK....",
        "..KrRrrWrrRrK...",
        "..KrRrGWGrRrKKK.",
        ".KrrRrrWrrRKpPpK",
        ".KrRRrGWGrRKpPpK",
        ".KSKRrrWrrRKpPpK",
        "..K.KrrWrrRrKKK.",
        "....KrRrRrRrK...",
        "....KrRrKrRrK...",
        "....KRrK.KrRK...",
        "....KHHK.KHHK...",
        "...KHHHK.KHHHK..",
      ],
    },
  },
  // The Grinning Gambler: a horned imp with a fan of cards and a wide grin.
  gambler: {
    skin: "#d9503f",
    eyes: [[5, 6], [8, 6]],
    body: {
      palette: { K, r: "#d9503f", R: "#9a2e24", h: "#f4ead6", e: "#ffe08a", m: "#1a0f08", t: "#f4ead6", w: "#f4ead6", c: "#c0392b", b: "#2d4a8a", G: "#f2c94c", v: "#3a2c48" },
      rows: [
        "..KK......KK....",
        "..KhK....KhK....",
        "...KhK..KhK.....",
        "....KrrrrK......",
        "...KrrrrrrK.....",
        "...KrrrrrrK.....",
        "...KrrrrrrK.....",
        "...KrmtmtmK.....",
        "....KrrrrK......",
        "...KKvvvvKK.....",
        "..KrKvGGvKrK....",
        ".KrrKvvvvKrKKKK.",
        ".KrKKvvvvKKwcwbK",
        ".KK.KvvvvK.KwcwK",
        "....KvvvvK.KwbwK",
        "....KrK.KrK.KKK.",
        "....KrK.KrK.....",
        "...KRrK.KRrK....",
        "...KKK...KKK....",
      ],
    },
  },
  // The Masked Alchemist: a beaked mask, a brown cloak and two flasks, one bubbling.
  alchemist: {
    skin: "#e6dcc4",
    eyes: [[6, 5], [8, 5]],
    body: {
      palette: { K, H: "#3a2a1a", h: "#5a4026", m: "#e6dcc4", M: "#b3a88f", e: "#ffe08a", C: "#6a4a2a", c: "#8a6a40", g: "#4adf6a", G: "#b8ffc8", r: "#c0392b", R: "#ff7a6b", w: "#c9b48a" },
      rows: [
        "....KKKKKK......",
        "...KHHHHHHK.....",
        "..KHhhhhhhHK....",
        ".KKKKKKKKKKKK...",
        "....KmmmmmK.....",
        "....KmmmmMK.....",
        "....KmmmmmmMK...",
        "....KmmmMMMMMK..",
        ".....KMMKKKKK...",
        "...KKCCCCCKK....",
        "..KCcCCCCCCcK...",
        ".KCcCCCCCCCCcK..",
        "KwKCCCCCCCCCKwK.",
        "KGKCCCCCCCCCKRK.",
        "KgKCCCCCCCCCKrK.",
        "KgKCCCCCCCCCKrK.",
        ".KKCCCCCCCCCKK..",
        "..KcCCCCCCCcK...",
        "..KCcCCCCCcCK...",
        "..KKKKKKKKKKK...",
      ],
    },
  },
  // The Ghost Armourer: a pale smith in a leather apron, hammer raised over an anvil that is not there.
  armourer: {
    skin: "#c8f0d8", ghost: true,
    eyes: [[5, 4], [7, 4]],
    body: {
      palette: { K: "#0d2a1a", g: "#c8f0d8", G: "#8ac8a4", a: "#6a4a2a", A: "#8a6a40", i: "#8a8494", I: "#cfd6e0", e: "#0d2a1a", w: "#6a4a2a", b: "#e6f4ea" },
      rows: [
        "..............KK",
        ".............KIIK",
        "....KKKKK....KIIK",
        "...KgggggK....KK.",
        "...KgggggK....Kw.",
        "...KgggggK....Kw.",
        "...KbbbbbK...Kw..",
        "....KbbbK....Kw..",
        "..KKgggggKK.Kw...",
        ".KgGKaaaKgGKgK...",
        ".KgKaAAAaKgggK...",
        ".KgKaAaAaKKK.....",
        ".KgKaAAAaK.......",
        ".KGKaAaAaK.......",
        "..K.aAAAaK.......",
        "...KaaaaaK.......",
        "...KgK.KgK.......",
        "...KgK.KgK.......",
        "..KGgK.KgGK......",
        "..KKK...KKK......",
      ],
    },
  },
  // The Hollow Merchant: a robe around nothing, two lights for eyes, gold in one hand and a charm in the other.
  merchant: {
    skin: "#0a0612",
    eyes: [[6, 5], [9, 5]],
    body: {
      palette: { K, P: "#2b1d3a", p: "#4a3466", v: "#0a0612", e: "#ffe08a", Y: "#f2c94c", y: "#fff2a8", o: "#b86bff", O: "#e2b8ff" },
      rows: [
        ".....KKKKK......",
        "....KPPPPPK.....",
        "...KPpPPPpPK....",
        "...KPKKKKKPK....",
        "...KPKvvvKPK....",
        "...KPKvvvvKPK...",
        "...KPKvvvvKPK...",
        "...KPPKKKKPPK...",
        "..KPpPPPPPPpPK..",
        ".KPpPPPPPPPPpPK.",
        "KYKpPPPPPPPPpKOK",
        "KyKPPPPPPPPPPKoK",
        "KYKpPPPPPPPPpKOK",
        ".KKPPPPPPPPPPKK.",
        "..KpPPPPPPPPpK..",
        "..KPpPPPPPPpPK..",
        "..KpPPPPPPPPpK..",
        "..KPPpPPPPpPPK..",
        "..KKKKKKKKKKKK..",
      ],
    },
  },
};
