// Skill icons: one 16x16 cell per skill, authored as material maps exactly like the interface icons in ui.mjs
// and shaded by the same engine, so the skill bar reads as part of the same kit. Keys are skill IDs from
// backend/internal/game/skills.go; a Go test checks that every skill in the catalog has a cell here.
import { Canvas, Img } from "./engine.mjs";
import { ICONS, UI_THEME } from "./ui.mjs";

const MATS = {
  R: "#c0504a", r: "#7a2626", S: "#9aa2b8", G: "#dcae52", W: "#7a5540", B: "#e3d9bd", L: "#6fae5a", P: "#9a7fe0", C: "#6fc4d6", K: "#2a2440", T: "#7fd14a", N: "#9a6a3e", o: "#e0602c",
  g: { color: "#ffe08a", emissive: true, glowR: 1 }, c: { color: "#8fe6f0", emissive: true, glowR: 1 }, v: { color: "#c9a4ff", emissive: true, glowR: 1 },
  f: { color: "#ffa040", emissive: true, glowR: 1 }, I: { color: "#cdeeff", emissive: true, glowR: 1 }, Y: { color: "#fff27a", emissive: true, glowR: 1 }, H: { color: "#fff2c4", emissive: true, glowR: 1 },
};

export const SKILL_ICONS = {
  "skill.defend": ICONS.guard,
  "skill.strike": ICONS.strike,

  // Bulwark: steel, gold and the tower shield.
  "bulwark.mace-strike": ["", "........S.S", ".......SSSSS", "......SSGSS", ".......SSSSS", "......W.S.S", ".....W", "....W", "...W", "..W", ".GG", ".G"],
  "bulwark.shield-wall": [".SSSSSSSSSS", ".SGGGGGGGGS", ".SGCCCCCCGS", ".SGCCGGCCGS", ".SGCGGGGCGS", ".SGCCGGCCGS", ".SGCCGGCCGS", ".SGCCCCCCGS", ".SGGGGGGGGS", "..SSGGGGSS", "....SSSS"],
  "bulwark.challenge": ["", "R....SS....R", ".R..SGGS..R", "...SGGGGS", "RR.SGRRGS.RR", "...SGGGGS", ".R..SGGS..R", "R....SS....R"],
  "bulwark.shield-bash": ["", "..........g", ".SSSSS..g.g.g", ".SGGGS...ggg", ".SGCGS.ggggggg", ".SGCGS...ggg", ".SGGGS..g.g.g", "..SGS.......g", "...S"],
  "bulwark.intervene": ["", "........BB", "..SSSS..BB", ".SGGGGS.BBB", ".SGCCGS.BBB", ".SGCCGS.B.B", ".SGGGGS.B.B", "..SGGS", "...SS"],
  "bulwark.rallying-banner": ["", ".W", ".WRRRRRRR", ".WRRGRRRR", ".WRGGGRRR", ".WRRGRRRR", ".WRRRRRR", ".W", ".W", ".W", "GGG"],
  "bulwark.spiked-bulwark": ["", "S...S...S", ".SSSSSSSS", "SSGGGGGGSS", ".SGCCCCGS", "SSGCCCCGSS", ".SGCCCCGS", "SSGGGGGGSS", "..SGGGGS", "S..SSSS..S"],
  "bulwark.shield-slam": ["..g...g...g", ".ggg.ggg.ggg", "..g...g...g", "", "...SSSSSS", "..SGGGGGGS", "..SGCCCCGS", "..SGCCCCGS", "...SGGGGS", "....SSSS"],
  "bulwark.last-stand": [".SSSSSSSSSS", ".SGGGGKGGGS", ".SGRRKRRRGS", ".SRRRKRRRRS", ".SRRRRKRRRS", ".SGRRRKRRGS", "..SGRRRRGS", "...SGRRGS", "....SGGS", ".....SS"],
  "bulwark.unbroken-citadel": ["", ".S.S.S.S.S", ".SSSSSSSSS", "..SSSSSSS", "..SSvvvSS", "..SSvKvSS", "..SSSKSSS", "..SSSSSSS", ".SSSSSSSSS", ".GGGGGGGGG"],

  // Juggernaut: the great hammer, blood and fury.
  "juggernaut.hammer-swing": ["", "..SSSSSSSS", "..SSSSSSSS", "..SSGGGGSS", "..SSSSSSSS", "......W", "......W", "......W", "......W", "......W", ".....GGG"],
  "juggernaut.reckoning": ["", "....RRRR", "...R....R", "..R......R", ".RRR.....R", "..R......R", "..........R", "....SSSS.R", "...SSSSSSR", "...SBSBSS", "....SSSS"],
  "juggernaut.brutal-sweep": ["", "...gggggg", ".gg......gg", "g..........g", "g", ".g", "..SS", "...SSS", "....WW", ".....WW"],
  "juggernaut.blood-frenzy": ["", ".BB.....BB", ".BBB...BBB", "..BBB.BBB", "...BBBBB", "....RRR", "...RRRRR", "..RRRrRRR", "..RRrrRRR", "...RRRRR", "....RRR"],
  "juggernaut.intimidating-roar": ["", "R...BBBB...R", ".R.BKKKKB.R", "R..BKRRKB..R", ".R.BKKKKB.R", "R...BBBB...R", "....B..B"],
  "juggernaut.headbutt": ["", "...SSSS..g", "..SSSSSS.g.g", ".SSSSSSSSggg", ".SSKKSSSS.g.g", ".SSSSSSSS..g", "..SSSSSS", "..SS..SS"],
  "juggernaut.unstoppable": ["", "B..........B", "BB........BB", ".BB......BB", "..BBRRRRBB", "...RRRRRR", "...RKRRKR", "...RRRRRR", "....RRRR", "....RggR"],
  "juggernaut.earthshaker": ["", "...S..S..S", "....S.S.S", "", ".WWWWKWWWWW", ".WWWKKKWWWW", ".WWKWWWKWWW", ".WKWWWWWKWW", ".WWWWWWWWWW"],
  "juggernaut.rampage": ["", "SS........SS", "SSS......SSS", ".SSW....WSS", "...W....W", "....W..W", ".....WW", "....W..W", "...W....W", "..W......W", "RRR......RRR"],
  "juggernaut.colossal-wrath": ["..f...f...f", ".fff.fff.fff", ".ffffffffff", "..SSSSSSSS", "..SBSBSBSS", "..SSSSSSSS", "..SSSSSSSS", "...SSSSSS", "....SSSS", "....SSSS"],

  // Spellguard: etched steel and violet runes.
  "spellguard.rune-cut": ["", "..........SS", ".........SSS", "........SvS", ".......SvS", "......SvS", ".....SvS", "..G.SSS", "..GGSS", "...GG", "..W.GG", ".W"],
  "spellguard.runic-ward": ["", "....vvvv", "..vv....vv", ".v...c....v", ".v..ccc...v", "v...c.c....v", ".v..ccc...v", ".v...c....v", "..vv....vv", "....vvvv"],
  "spellguard.spell-break": ["", "....vv.vv", "..vv..K..vv", ".v...K....v", ".v..K.....v", ".....K", ".v....K...v", ".v.....K..v", "..vv..K.vv", "....vv.vv"],
  "spellguard.aegis-link": ["", "", ".SSS....SSS", ".SvS....SvS", ".SvSccccSvS", ".SvS....SvS", ".SvS....SvS", "..S......S"],
  "spellguard.arcane-rebuke": ["", ".....v", "..v..v..v", "...v.v.v", "....vvv", "vvvvvcvvvvv", "....vvv", "...v.v.v", "..v..v..v", ".....v"],
  "spellguard.sigil-of-binding": ["", "S.S.S.S.S.S", ".S.......S", "..S.vvv.S", "...vv.vv", "...v.c.v", "...vv.vv", "..S.vvv.S", ".S.......S", "S.S.S.S.S.S"],
  "spellguard.mirror-ward": ["", "....GGGG", "...GCCCCG", "..GCcCCCCG", "..GCCcCCCG", "..GCCCcCCG", "..GCCCCcCG", "...GCCCCG", "....GGGG", ".....GG", "....GGGG"],
  "spellguard.nullfield": ["", "...RRRRR", "..R.....R", ".R.vv...RR", ".R..vv.R.R", ".R...vR..R", ".R..R.vv.R", ".RR....vvR", "..R.....R", "...RRRRR"],
  "spellguard.runeblade-storm": ["", "..S......S", "...S....S", "....v..v", ".SS..vv..SS", "...vv..vv", ".SS..vv..SS", "....v..v", "...S....S", "..S......S"],
  "spellguard.starforged-aegis": [".....g", "....ggg", "..ggggggg", "...ggggg", "...gg.gg", "..vvvvvvv", ".vv.....vv", "v.........v", "v.........v", "SSSSSSSSSSS"],

  // Assassin: blades, shadow and blood.
  "assassin.twin-slash": ["", "........g..g", ".......g..g", "......g..g", ".....g..g", "....g..g", "...g..g", "..g..g", ".g..g"],
  "assassin.exploit-weakness": ["", ".....S", "...SSSSS", "..S..S..S", ".S...S...S", "SSSSSRSSSSS", ".S...S...S", "..S..S..S", "...SSSSS", ".....S"],
  "assassin.smoke-step": ["", "....KK", "..KKPPKK", ".KPPPPPPK..KK", ".KPPPPPPPKKPPK", "..KPPPPPPPPPK", "...KKPPPPPKK", ".....KKKKK", "", "..B..B", ".BB..BB"],
  "assassin.throat-jab": ["", "...........g", "....SSSSS.g.g", "...SSSSSSS.g", "...SBSBSSS", "...SSSSSS", "....SSSS", "....WWW"],
  "assassin.rupture": ["", "...........S", "..........SS", ".........SS", "........SS", ".......SS", "...G..SS", "...GGSS.R", "....GG..R", "...W.G.RRR", "..W....RRR", "........R"],
  "assassin.fan-of-knives": ["", "S....S....S", ".S...S...S", "..S..S..S", "...S.S.S", "", "....GGG", "...GGGGG"],
  "assassin.ambush": ["", "..KKKKKKKK", ".KKKKKKKKKK", "KKKKKKKKKKKK", "KKggKKKKggKK", "KKKggKKggKKK", "KKKKKKKKKKKK", ".KKKKKKKKKK", "..KK.SS.KK", "....SSSS"],
  "assassin.mark-for-death": ["", "R..BBBBB..R", ".RBBBBBBBR", "..RBBBBBR", ".BKRBBBRKB", ".BKKRBRKKB", ".BBBBRBBBB", "..BBRBRBB", "...RBBBR", "..R.B.B.R"],
  "assassin.death-blossom": ["", ".....R", "....RRR", ".RR.RRR.RR", ".RRRRTRRRR", "..RRTTTRR", ".RRRRTRRRR", ".RR.RRR.RR", "....RRR", ".....R"],
  "assassin.assassinate": ["......g", ".....gSg", ".....SSS", ".....SSS", ".....SSS", ".....SSS", ".....SSS", "...GGGGGGG", "......W", "......W", ".....GGG"],

  // Arcanist: fire, frost, lightning and raw arcana.
  "arcanist.arcane-bolt": ["", ".......vvvv", "......vvccvv", ".v...vvcccvv", "..vvvvvcccvv", ".v...vvcccvv", "......vvccvv", ".......vvvv"],
  "arcanist.fireball": ["", "....f", "..f.ff..f", "...ffff.f", "..fffffff", ".ffoooofff", ".ffogggoff", ".ffogggoff", "..ffoooff", "...fffff"],
  "arcanist.frost-surge": ["", ".....I", "..I..I..I", "...I.I.I", "....III", "IIIIIcIIIII", "....III", "...I.I.I", "..I..I..I", ".....I"],
  "arcanist.ignite": ["", ".....f", ".....ff", "....fff", "...ffoff", "...foggf", "..ffoggff", "..fooggof", "...fooof", ".WWWWWWWWW"],
  "arcanist.chain-lightning": ["", "YY", ".YY......YY", "..YY....YY", "...YYYYYY", "....YY", "...YY", "..YYYYYY", ".......YY", "........YY"],
  "arcanist.mana-shield": ["", ".vvvvvvvvv", ".vcccccccv", ".vcvvvvvcv", ".vcvcccvcv", ".vcvcccvcv", "..vcvvvcv", "...vcccv", "....vcv", ".....v"],
  "arcanist.deep-freeze": ["", ".IIIIIIIIII", ".ICCCCCCCCI", ".ICKKCCKKCI", ".ICCCCCCCCI", ".ICCKKKKCCI", ".ICCCCCCCCI", ".IIIIIIIIII"],
  "arcanist.empowerment": ["", ".....v", "....vcv", "...vc.cv", "..v.....v", ".....v", "....vcv", "...vc.cv", "..v.....v", ".....P", "....PPP"],
  "arcanist.meteor": ["f", ".ff", "..fff", "...ffWWW", "....fWWWWW", "....WWKWWW", "....WWWWKW", ".....WWWW", "", "..o.o..o"],
  "arcanist.time-warp": ["", ".GGGGGGGGG", "..BvvvvvB", "...BvvvB", "....BvB", ".....B", "....BcB", "...BcccB", "..BcccccB", ".GGGGGGGGG"],

  // Ranger: arrows, the bow and the wild.
  "ranger.quick-shot": ["", ".........SS", "........SSS", ".......WSS", "......W", ".....W", "....W", "...W", "RRW", "RR", ".R"],
  "ranger.pinning-shot": ["", "...RRR", "....R", "....W", "....W", "....W", "....W", "....S", "...SSS", ".KKKSKKK", ".KKKKKKK"],
  "ranger.aimed-shot": ["", ".....g", "...g.g.g", "..g..g..g", ".....g", ".gggg.gggg", ".....g", "..g..g..g", "...g.g.g", ".....g"],
  "ranger.volley": ["", ".R...R...R", ".W...W...W", ".W...W...W", ".W...W...W", ".W...W...W", "SSS.SSS.SSS", ".S...S...S"],
  "ranger.hunters-mark": ["", "", "...RRRRR", "..R.....R", ".R..BBB..R", "R..BBKBB..R", ".R..BBB..R", "..R.....R", "...RRRRR"],
  "ranger.barbed-arrow": ["", "......S", ".....SSS", "....S.S.S", "...S..S..S", "......W", "......W", "......W", "..R...W", "..R..RRR", ".RRR.R.R"],
  "ranger.concussive-shot": ["g...g", ".g.g", "g.g.g", "..SSS", "..SSS", "...W", "...W", "...W", "...W", "..RWR", "..R.R"],
  "ranger.camouflage": ["", "......LL", "....LLLLL", "..LLLLLLLL", ".LLLLKLLLL", ".LLLKLLLL", ".LLKLLLL", "..KLLLL", ".K", "K"],
  "ranger.arrow-storm": ["R.R.R.R.R.R", "W.W.W.W.W.W", "W.W.W.W.W.W", "S.S.S.S.S.S", "", ".R.R.R.R.R", ".W.W.W.W.W", ".W.W.W.W.W", ".S.S.S.S.S"],
  "ranger.heartseeker": ["", "..RR...RR", ".RRRR.RRRR", "SRRBRRRRRRWW", "SSRRRRRRRWW", ".RRRRRRRR", "..RRRRRR", "...RRRR", "....RR"],

  // Cleric: holy light, the green of healing, gold.
  "cleric.smite": ["", "....HHH", "....HHH", ".....H", ".....H", "..H..H..H", "...H.H.H", "....HHH", ".HHHHHHHHH"],
  "cleric.renewal": ["", "....LLL", "....LgL", "....LgL", ".LLLLgLLLL", ".LgggggggL", ".LLLLgLLLL", "....LgL", "....LgL", "....LLL"],
  "cleric.sanctuary": ["", "...GGGGG", "..G.....G", "", "....HHH", "...H.H.H", "..H..H..H", ".H...H...H", ".GGGGGGGGG"],
  "cleric.prayer-of-mending": ["", "...RR.RR", "...RRRRR", "....RRR", ".....R", ".RR.RR.RR.RR", ".RRRRR.RRRRR", "..RRR...RRR", "...R.....R"],
  "cleric.rejuvenate": ["", "......g", ".....ggg", "......g..LL", ".......LLLL", "..LL..LLLL", ".LLLL.L", "..LLLL", "....L", "....L", ".WWWWWW"],
  "cleric.holy-fire": ["", ".....H", "....HH", "...HgH", "...HggH", "..HggggH", "..HgHHgH", "..HgHHgH", "...HHHH", "....HH"],
  "cleric.silence": ["", "..R.......R", "...R.....R", "....R...R", "..BBBRBBB", ".BRRRRRRRB", ".BRKKRKKRB", ".BRRRRRRRB", "..BBRBRBB", "...R...R", "..R.....R"],
  "cleric.divine-aegis": ["", "B.........B", "BB.SSSSS.BB", ".BBSHHHSBB", "..BSHGHSB", "...SHHHS", "....SHS", ".....S"],
  "cleric.purifying-light": ["H.........H", ".H...H...H", "..H..H..H", "...HHHHH", "HHHHHgHHHHH", "...HHHHH", "..H..H..H", ".H...H...H", "H.........H"],
  "cleric.resurrection": ["", "....GGG", "...G...G", "...G...G", "....GGG", ".GGGGGGGGG", ".....G", ".....G", ".....G", "....GGG"],

  // Tactician: the rapier, the command and the plan.
  "tactician.rapier-thrust": ["", "..........S", ".........S", "........S", ".......S", "......S", "..GG.S", "...GGG", "...GWG", "..W.G", ".W"],
  "tactician.commanding-strike": ["", "...R", "...RG", "...RGG", "...RGGG", "...RGGGG", "...RGGG", "...RGG", "...RG", "...R"],
  "tactician.countermand": ["", "...RRRRR", "..RRRRRRR", ".RRRRRRRRR", ".RBBBBBBBR", ".RBBBBBBBR", ".RRRRRRRRR", "..RRRRRRR", "...RRRRR"],
  "tactician.rally": ["g...S...g", "...SSS", "g..SSS..g", "...SSS", "...SSS", "...SSS", ".GGGGGGG", "....W", "....W", "...GGG"],
  "tactician.coordinated-assault": ["", "S.........S", ".S.......S", "..S.....S", "...S...S", ".....R", "....RRR", ".....R", ".....S", ".....S", ".....S"],
  "tactician.disarm": ["", "R.......SR", ".R.....SR", "..R...SR", "...R.SR", "....RR", "...SRR", "..GG..R", ".GG....R", ".W......R"],
  "tactician.war-horn": ["", "", "........BB", ".......BBB", "WW....BBBB", "WWBBBBBBBB", ".WWBBBBBBB", "..WWW.BBBB", ".......BBB", "........BB"],
  "tactician.battle-plan": ["", ".WWWWWWWWW", "WBBBBBBBBBW", ".BKBBRBBB", ".BBKBRBKB", ".BBBKBKBB", ".BRBBKBBB", ".BBBBBBBB", "WBBBBBBBBBW", ".WWWWWWWWW"],
  "tactician.exploit-the-gap": ["", ".SSSS..SSSS", ".SSSS..SSSS", ".SS......SS", ".SSSSggSSSS", ".SSS.gg.SSS", ".SSSS..SSSS", ".SSSS..SSSS"],
  "tactician.checkmate": [".....G", "....GGG", ".....G", "...GGGGG", "....GGG", "....GGG", "....GGG", "...GGGGG", "..GGGGGGG", "..GGGGGGG"],

  // Beastcaller: fur, claws and growing things.
  "beastcaller.maul": ["", "..R...R...R", "..R...R...R", "...R...R...R", "...R...R...R", "....R...R...R", "....R...R...R", ".....R...R"],
  "beastcaller.pounce": ["", "..NN....NN", "..NN.NN.NN", ".....NN", "...NNNNNN", "..NNNNNNNN", "..NNNNNNNN", "...NNNNNN", "....NNNN"],
  "beastcaller.bristle-guard": ["", "..N.N.N.N.N", "...NNNNNNN", "..NNNNNNNNN", ".NNBNNNNNBNN", ".NNNNNNNNNNN", "..SSSSSSSSS", "..SGGGGGGGS", "...SSSSSSS"],
  "beastcaller.rending-claws": ["", "..B...B...B", "..B...B...B", "...B...B...B", "...R...R...R", "....R...R...R", "....R...R...R", "...........R"],
  "beastcaller.pack-howl": ["........GG", ".......G..G", ".......G", "........GG", "..N", "..NN", ".NNNN", "NNBNNN", "NNNNNNN", ".NNNNNNN", "..NNNNNN"],
  "beastcaller.mending-spores": ["..g...g", "....g...g", "..RRRRRRR", ".RRBRRRBRR", "RRRRRRRRRRR", "....BBB", "....BBB", "....BBB", "...BBBBB"],
  "beastcaller.stampede": ["", "B.........B", "BB.......BB", ".BNNNNNNNB", "..NNNNNNN", "..NKNNNKN", "..NNNNNNN", "...NNNNN", "...NBBBN", "....NNN", ".W.W...W.W", "W.W.....W.W"],
  "beastcaller.hamstring": ["", "....BB", "...BBBB", "....BB", "....BB", "..R.BB", "...RBB", "....RR", "....BBR", "....BB.R", "...BBBB", "....BB"],
  "beastcaller.alpha-strike": ["", "NNNNNNNNNNN", "NKNNNNNNNKN", "NNNNNNNNNNN", ".BNNNNNNNB", ".BBNNNNNBB", "..BKKKKKB", "..B.....B", "...BBBBB"],
  "beastcaller.spirit-of-the-wild": ["c.c.....c.c", ".cc.....cc", "..c.....c", "..ccLLLcc", "...LLLLL", "..LLcLcLL", "..LLLLLLL", "...LLLLL", "....LLL", "....L.L"],
};

export const SKILL_ICON_ORDER = Object.keys(SKILL_ICONS);

/** One row of 16x16 cells in SKILL_ICON_ORDER. */
export function skillIconSheet() {
  const sheet = new Img(SKILL_ICON_ORDER.length * 16, 16);
  SKILL_ICON_ORDER.forEach((id, n) => {
    const rows = SKILL_ICONS[id];
    if (rows.length > 15 || rows.some((row) => row.length > 15)) throw new Error(`skill icon ${id} does not fit its 16x16 cell`);
    const c = new Canvas(16, 16, MATS, UI_THEME), parts = {};
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === ".") return;
      if (!(ch in MATS)) throw new Error(`skill icon ${id}: unknown material ${ch}`);
      c.pid = parts[ch] ??= Object.keys(parts).length + 1;
      c.px(x + 1, y + 1, ch);
    }));
    sheet.blit(c.render({ glowR: 1 }), n * 16, 0);
  });
  return sheet;
}
