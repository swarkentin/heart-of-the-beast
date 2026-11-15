import { useEffect, useState } from "react";
import { AudioControls, useGameAudio } from "./audio";
import { EnemyStage } from "./monsters/EnemyStage";

type Action = "strike" | "guard" | "interrupt";
type View = "player" | "cast";
type Enemy = { id: string; name: string; hp: number; maxHp: number; intent: string; intentTarget: string; damage: number; interruptible: boolean; x: number; sprite?: string; rawIntent?: ApiEnemyIntent };
type RoomId = string;
type Room = { id: RoomId; name: string; floor: string; description: string; exits: RoomId[] };
const rooms: Record<RoomId, Room> = {
  "watcher-hall": { id: "watcher-hall", name: "The Watcher's Hall", floor: "01", description: "The dead stir beneath the old watchfires.", exits: ["reliquary", "flooded-crossing"] },
  reliquary: { id: "reliquary", name: "The Silent Reliquary", floor: "02", description: "Dusty alcoves hold the remains of forgotten kings.", exits: ["warden-gate"] },
  "flooded-crossing": { id: "flooded-crossing", name: "The Drowned Crossing", floor: "02", description: "Black water ripples around a half-submerged causeway.", exits: ["watcher-hall", "warden-gate"] },
  "warden-gate": { id: "warden-gate", name: "The Warden's Gate", floor: "03", description: "A sealed iron gate hums with a cold, green light.", exits: ["reliquary", "flooded-crossing"] },
};
const actions: { id: Action; label: string; hint: string; glyph: string }[] = [
  { id: "strike", label: "Strike", hint: "10 damage", glyph: "⚔" },
  { id: "guard", label: "Defend", hint: "Block up to 6 damage", glyph: "⬟" },
  { id: "interrupt", label: "Interrupt", hint: "Cancel a marked enemy move", glyph: "✦" },
];

type ApiEnemyIntent = { kind: string; label: string; damage: number; heal?: number; targetPlayerId?: string; targetAll?: boolean; interruptible?: boolean };
type ApiEnemy = { id: string; name: string; behavior?: string; sprite?: string; turnsTaken: number; health: number; maxHealth: number; intent?: ApiEnemyIntent };
type ApiCombatEvent = { round: number; kind: string; message: string; effect?: "damage" | "heal" | "block"; targetId?: string; targetType?: "enemy" | "player"; amount?: number };
type ApiExit = { id: string; destination: string; label: string; description?: string };
type ApiEventChoice = { id: string; label: string; description: string };
type ApiRoomEvent = { id: string; title: string; description: string; choices: ApiEventChoice[]; resolved: boolean; result?: string };
type ApiDungeonRoom = { id: string; name: string; floor?: string; roomType?: string; description: string; exits: ApiExit[]; encounter?: { status: string; enemies: ApiEnemy[] }; event?: ApiRoomEvent; cleared: boolean };

type ApiStats = { power: number; focus: number; agility: number };
type ApiPlayer = { id: string; health: number; maxHealth: number; archetype: string; experience: number; level: number; talentPoints: number; talents: string[]; stats: ApiStats; strikeDamage?: number; guardReduction?: number };
type TalentChoice = { id: string; archetype: string; name: string; description: string; tier: number; requires?: string };
const archetypes = [
  { id: "support", name: "Support", description: "Control enemy plans, create openings, and help the whole party." },
  { id: "damage", name: "Damage", description: "Exploit openings and specialize in taking dangerous enemies down quickly." },
  { id: "tank", name: "Tank", description: "Absorb pressure, hold enemy attention, and protect the party." },
];
const talentChoices: TalentChoice[] = [
  { id: "support-disruption", archetype: "support", name: "Disruption", description: "Interrupts deal 4 additional damage.", tier: 1 },
  { id: "support-protective-ward", archetype: "support", name: "Protective Ward", description: "All party members block 2 additional damage when defending.", tier: 1 },
  { id: "support-expose-weakness", archetype: "support", name: "Expose Weakness", description: "Deal 4 extra damage to enemies with a telegraphed move.", tier: 2, requires: "support-disruption" },
  { id: "support-rallying-cry", archetype: "support", name: "Rallying Cry", description: "All living party members recover 2 health after clearing an encounter.", tier: 2, requires: "support-protective-ward" },
  { id: "damage-heavy-hands", archetype: "damage", name: "Heavy Hands", description: "Attacks deal 3 additional damage.", tier: 1 },
  { id: "damage-precision", archetype: "damage", name: "Precision", description: "Attacks deal 2 additional damage.", tier: 1 },
  { id: "damage-opportunist", archetype: "damage", name: "Opportunist", description: "Deal 4 extra damage to enemies with a telegraphed move.", tier: 2, requires: "damage-precision" },
  { id: "damage-counterstrike", archetype: "damage", name: "Counterstrike", description: "Interrupts deal 4 additional damage.", tier: 2, requires: "damage-heavy-hands" },
  { id: "tank-bulwark", archetype: "tank", name: "Bulwark", description: "+6 maximum health.", tier: 1 },
  { id: "tank-braced-stance", archetype: "tank", name: "Braced Stance", description: "Defend blocks 3 additional damage.", tier: 1 },
  { id: "tank-thorns", archetype: "tank", name: "Thorns", description: "Reflect 2 damage when struck.", tier: 2, requires: "tank-bulwark" },
  { id: "tank-unyielding", archetype: "tank", name: "Unyielding", description: "Defend blocks 3 additional damage.", tier: 2, requires: "tank-braced-stance" },
];
const levelThresholds = [0, 50, 100, 200, 325];
function archetypeName(id?: string) { return archetypes.find(item => item.id === id)?.name || "Adventurer"; }
function xpProgress(player: ApiPlayer) {
  const current = levelThresholds[player.level - 1] ?? 325;
  const next = levelThresholds[player.level] ?? current;
  return { current: Math.max(0, player.experience - current), needed: Math.max(0, next - current), percent: next > current ? Math.min(100, Math.max(0, (player.experience - current) / (next - current) * 100)) : 100 };
}

type ApiCombatRound = { number: number; startedAt: string; deadline: string; actions: Record<string, { type: string; action: string; targetId?: string }> };
type ApiNavigationVote = { startedAt: string; deadline: string; votes: Record<string, string> };
type VoteStatus = { remainingSeconds: number; progressPercent: number; submittedCount: number; eligibleCount: number; voteCounts: Record<string, number>; selectedExit?: string };
type ApiRun = { id: string; phase: "lobby" | "combat" | "exploring" | "intermission" | "completed" | "failed"; depth?: number; maxDepth?: number; musicIntensity?: number; pendingInterFloorChoice?: boolean; interFloorVote?: ApiNavigationVote; currentRoomId: string; rooms: Record<string, ApiDungeonRoom>; players: Record<string, ApiPlayer>; flags?: Record<string, boolean>; combatRound?: ApiCombatRound; navigationVote?: ApiNavigationVote; lastCombatEvents?: ApiCombatEvent[] };
type ApiPresence = { status: "online" | "disconnected" | "left"; lastSeenAt: string; leftAt?: string };
type ApiRoom = { id: string; code: string; ownerPlayerId: string; playerIds: string[]; playerArchetypes?: Record<string, string>; playerClasses?: Record<string, string>; presence?: Record<string, ApiPresence>; run?: ApiRun; version: number };
type ApiClass = { id: string; archetypeId: string; name: string; description: string; startingStats: { health: number; power: number; focus: number; agility: number }; startingEquipment: string[]; signatureAbilityId: string; passiveId: string };
type ApiAvailability = { classId: string; initiallyAvailable: boolean; unlockPolicyId?: string };
type ApiNamedRule = { id: string; name: string; description: string };
type ProgressionCatalog = { classes: ApiClass[]; classAvailability: ApiAvailability[]; classAbilities: ApiNamedRule[]; classPassives: ApiNamedRule[]; equipment: { id: string; name: string; slot: string }[] };
type PlayerSession = { roomId: string; playerId: string; playerToken: string; spectatorToken?: string };
type SpectatorAccess = { roomId: string; token: string };
const SESSION_KEY = "heart-of-the-beast.player-session";

async function apiRequest<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", "Bearer " + token);
  const response = await fetch("/api" + path, { ...init, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Request failed (" + response.status + ")");
  return payload as T;
}

function readSpectatorAccess(): SpectatorAccess | null {
  if (typeof window === "undefined" || !window.location.hash.startsWith("#spectate=")) return null;
  try {
    const value = decodeURIComponent(window.location.hash.slice("#spectate=".length));
    const separator = value.indexOf(":");
    if (separator <= 0) return null;
    return { roomId: value.slice(0, separator), token: value.slice(separator + 1) };
  } catch {
    return null;
  }
}

function visualRoomId(id: string): RoomId {
  if (id === "entry") return "watcher-hall";
  if (id === "warden") return "warden-gate";
  return id;
}

function visualEnemy(enemy: ApiEnemy, index: number, count: number, playerIds: string[]): Enemy {
  const intent = enemy.intent;
  const targetIndex = intent?.targetPlayerId ? playerIds.indexOf(intent.targetPlayerId) + 1 : 0;
  const intentTarget = intent?.targetAll ? "TARGET: ALL ADVENTURERS" : targetIndex > 0 ? "TARGET: ADVENTURER " + targetIndex : "NO TARGET";
  const intentLabel = intent ? intent.label + " · " + intent.damage + " DMG" + (intent.heal ? " · HEALS " + intent.heal : "") : "No intent";
  return { id: enemy.id, name: enemy.name, hp: enemy.health, maxHp: enemy.maxHealth, intent: intentLabel, intentTarget, damage: intent?.damage ?? 0, interruptible: Boolean(intent?.interruptible), x: count === 1 ? 550 : 550 + (index - (count - 1) / 2) * (count === 2 ? 240 : 220), sprite: enemy.sprite, rawIntent: intent };
}


function Bar({ value, max }: { value: number; max: number }) {
  return <span className="bar"><i style={{ width: (Math.max(0, value) / max * 100) + "%" }} /></span>;
}

function ClassPortrait({ classId, archetype, name }: { classId: string; archetype: string; name: string }) {
  const palettes: Record<string, { cloth: string; trim: string; metal: string; light: string }> = {
    bulwark: { cloth: "#3d625a", trim: "#d6b477", metal: "#9ba7a0", light: "#80c5a5" }, juggernaut: { cloth: "#743f3b", trim: "#e49a58", metal: "#756c68", light: "#ef9c65" }, spellguard: { cloth: "#405477", trim: "#9fbcdb", metal: "#9ba7a0", light: "#94d9ec" }, assassin: { cloth: "#633f64", trim: "#d99cae", metal: "#857d8a", light: "#e390b2" }, arcanist: { cloth: "#4b477d", trim: "#c9a8e8", metal: "#8a86a0", light: "#c8a4ff" }, ranger: { cloth: "#496447", trim: "#c3ad74", metal: "#8d9280", light: "#a6d679" }, cleric: { cloth: "#887145", trim: "#f0d79c", metal: "#b8b5a6", light: "#f5da83" }, tactician: { cloth: "#425c70", trim: "#d1a878", metal: "#8c9aa1", light: "#84d1d0" }, beastcaller: { cloth: "#49654e", trim: "#c3a66a", metal: "#879789", light: "#9cda89" },
  };
  const p = palettes[classId] || palettes[archetype] || palettes.bulwark;
  const mage = classId === "arcanist" || classId === "spellguard" || classId === "cleric";
  const hood = classId === "assassin" || classId === "ranger" || classId === "beastcaller";
  return <svg className="class-portrait-art" viewBox="0 0 220 230" role="img" aria-label={name + " character portrait"} shapeRendering="crispEdges">
    <rect width="220" height="230" fill="#171a23"/><path d="M12 190h196v28H12zM24 38h16v112H24zM180 38h16v112h-16z" fill="#39343b"/><path d="M18 58h184M18 146h184" stroke="#755b43" strokeWidth="6"/>
    <path d="M43 205v-42l26-25h82l26 25v42z" fill={p.cloth}/><path d="M65 158l45-20 45 20-13 47H78z" fill={p.metal}/><path d="M84 148h52v54H84z" fill={p.cloth}/><path d="M75 165h70v10H75zM99 140h22v62H99z" fill={p.trim}/>
    <path d="M72 74h76v60H72z" fill="#d5b49a"/><path d="M65 64h90v22H65zM72 52h76v22H72z" fill={hood ? p.cloth : p.metal}/>{hood ? <path d="M66 64h20v72h-20zM128 64h28v72h-28z" fill={p.cloth}/> : <path d="M72 52h76v10H72zM62 75h96v12H62z" fill={p.trim}/>}
    <path d="M86 94h10v10H86zM124 94h10v10h-10z" fill={p.light}/><path d="M100 116h20v7h-20z" fill="#704d48"/><path d="M43 155h28v50H43zM149 155h28v50h-28z" fill={p.cloth}/>
    {mage ? <><path d="M184 77h8v128h-8z" fill="#9a7651"/><path d="M176 66h24v24h-24z" fill={p.light}/><path d="M182 57h12v42h-12z" fill="#f0d79c"/></> : <><path d="M187 101h10v104h-10z" fill="#9a7651"/><path d="M176 98h32v12h-32zM184 84h16v12h-16z" fill={p.metal}/></>}
    <path d="M18 218h184" stroke={p.trim} strokeWidth="4"/><text x="110" y="227" textAnchor="middle" fill="#f0d2a8" fontSize="8" fontFamily="monospace">{name.toUpperCase()}</text>
  </svg>;
}

function SkillIcon({ id }: { id: string }) {
  const kind = /heal|renewal|recovery|companion|nature/i.test(id) ? "life" : /shield|ward|guard|resolve/i.test(id) ? "guard" : /fire|element|arcane|focus/i.test(id) ? "arcane" : /interrupt|pin|command|disrupt/i.test(id) ? "control" : "strike";
  return <span className={"skill-icon skill-icon-" + kind} aria-hidden="true"><svg viewBox="0 0 32 32"><path d={kind === "guard" ? "M16 3 27 7v8c0 7-5 11-11 14C10 26 5 22 5 15V7z" : kind === "life" ? "M16 27S4 20 4 11c0-6 8-9 12-2 4-7 12-4 12 2 0 9-12 16-12 16z" : kind === "arcane" ? "m16 2 3 9 9 5-9 4-3 10-4-10-9-4 9-5z" : kind === "control" ? "M6 6 25 25M22 5 8 24M3 16h26M16 3v26" : "M21 3 9 16l7 1-5 12 13-16-8-1z"} fill="currentColor" stroke="#17151b" strokeWidth="2" strokeLinejoin="round"/></svg></span>;
}

function CombatImpacts({ events, enemies, playerId, view }: { events: ApiCombatEvent[]; enemies: Enemy[]; playerId: string; view: "player" | "cast" }) {
  const visible = events.filter(event => event.effect && (event.amount ?? 0) > 0 && (event.targetType === "enemy" || event.targetType === "player"));
  return <div className="combat-impacts" aria-live="polite" aria-label="Combat effects">
    {visible.map((event, index) => {
      const isEnemy = event.targetType === "enemy";
      if (!isEnemy && view === "player" && event.targetId !== playerId) return null;
      const enemyIndex = enemies.findIndex(enemy => enemy.id === event.targetId);
      if (isEnemy && enemyIndex < 0) return null;
      const left = isEnemy
        ? (view === "player" ? enemies[enemyIndex].x / 11 : (enemyIndex === 0 ? 33 : 67))
        : 50;
      const top = isEnemy ? (view === "player" ? 53 : 34) : (view === "player" ? 79 : 62);
      const label = event.effect === "heal" ? "+" + event.amount
        : event.effect === "block" ? "BLOCKED " + event.amount
        : "−" + event.amount;
      return <span key={event.round + "-" + event.kind + "-" + event.targetId + "-" + index}
        className={"combat-impact combat-impact-" + event.effect}
        style={{ left: left + "%", top: top + "%" }}>{label}</span>;
    })}
  </div>;
}

function PlayerView({ enemies, target, onTarget, room, exits, onNavigate, voteStatus, impacts, playerId }: { enemies: Enemy[]; target: string; onTarget: (id: Enemy["id"]) => void; room: Room; exits: { id: string; destination: RoomId; label: string; description?: string }[]; onNavigate: (id: string) => void; voteStatus?: VoteStatus; impacts: ApiCombatEvent[]; playerId: string }) {
  return <div className={"scene player-scene room-" + room.id}>
    <svg className="scene-art" viewBox="0 0 1100 620" role="img" aria-label={"First-person view of " + room.name}>
      <defs>
        <linearGradient id="wall" x2="0" y2="1"><stop stopColor="#34303a"/><stop offset="1" stopColor="#171922"/></linearGradient>
        <linearGradient id="floor" x2="0" y2="1"><stop stopColor="#8a7059"/><stop offset="1" stopColor="#211f27"/></linearGradient>
        <radialGradient id="torch"><stop stopColor="#f6a34f" stopOpacity=".8"/><stop offset="1" stopColor="#d87536" stopOpacity="0"/></radialGradient>
        <pattern id="brick" width="100" height="58" patternUnits="userSpaceOnUse"><path d="M0 1H100M0 29H100M50 0V29M0 29V58" fill="none" stroke="#0d1018" strokeOpacity=".55" strokeWidth="5"/></pattern>
        <pattern id="tiles" width="130" height="70" patternUnits="userSpaceOnUse"><path d="M2 2h62l8 32H10zM76 2h52v32H82zM10 40h65v28H3zM83 40h44v28H80z" fill="#9c8065" fillOpacity=".13" stroke="#171820" strokeWidth="4"/></pattern>
      </defs>
      <rect width="1100" height="620" fill="#11131b"/>
      <path d="M0 0H1100V400L760 255H340L0 400Z" fill="url(#wall)"/><path d="M0 0H1100V400L760 255H340L0 400Z" fill="url(#brick)"/>
      <path d="M0 400L340 255H760L1100 400V620H0Z" fill="url(#floor)"/><path d="M0 400L340 255H760L1100 400V620H0Z" fill="url(#tiles)"/>
      <path d="M0 400L340 255H760L1100 400" fill="none" stroke="#b19372" strokeOpacity=".5" strokeWidth="7"/>
      <path d="M120 0V370L370 260V0M980 0V370L730 260V0" fill="#10131b" stroke="#514239" strokeWidth="13"/>
      <path d="M160 0V350L390 265V0M940 0V350L710 265V0" fill="#20202a" stroke="#3c3637" strokeWidth="8"/>
      <path d="M405 0V248Q550 210 695 248V0" fill="#0e121b" stroke="#665343" strokeWidth="12"/>
      <ellipse cx="120" cy="220" rx="180" ry="180" fill="url(#torch)"/><ellipse cx="980" cy="220" rx="180" ry="180" fill="url(#torch)"/>
      <g fill="#ffbd67"><path d="M112 160h16v-48h12v48h16v12h-44zM952 160h16v-48h12v48h16v12h-44z"/><path d="M134 112l-12 32h24zM974 112l-12 32h24z"/></g>
      <path d="M0 510L420 390M1100 510L680 390M0 580L470 430M1100 580L630 430" stroke="#c5a17c" strokeOpacity=".16" strokeWidth="4"/>
      <g transform="translate(550 0)" shapeRendering="crispEdges">
        <path d="M-190 620l22-78 62-44h-40l-48 36-38 86zM190 620l-22-78-62-44h40l48 36 38 86z" fill="#293943"/>
        <path d="M-170 620l18-72 46-36 42 0 12 108zM170 620l-18-72-46-36-42 0-12 108z" fill="#53636a"/>
        <path d="M-120 620l15-60 45-20 60 20 15 60zM120 620l-15-60-45-20-60 20-15 60z" fill="#8d735d"/>
      </g>
      <EnemyStage key={room.id} view="player" enemies={enemies} events={impacts} target={target} onTarget={onTarget} />
    </svg>
    {exits.length > 0 ? <div className="scene-exits" aria-label="Available paths">{voteStatus ? <div className="path-vote-status" role="timer"><strong>PARTY PATH VOTE</strong><b>{voteStatus.remainingSeconds}s</b><small>{voteStatus.submittedCount}/{voteStatus.eligibleCount} VOTED · TIES RANDOM</small><div className="path-vote-progress"><i style={{ width: voteStatus.progressPercent + "%" }} /></div></div> : null}{exits.map((exit,index)=><button key={exit.id} className={"scene-exit scene-exit-"+(exits.length===1?"center":index===0?"left":"right")+(voteStatus?.selectedExit===exit.id?" scene-exit-selected":"")} onClick={()=>onNavigate(exit.id)} disabled={Boolean(voteStatus && voteStatus.remainingSeconds <= 0)} aria-label={"Vote for "+exit.label}><span className="exit-chevron">{exits.length===1?"↑":index===0?"↖":"↗"}</span><strong>{exit.label}</strong><small>{exit.description || (voteStatus ? (voteStatus.voteCounts[exit.id] || 0)+" VOTES" : "ENTER PATH")}</small>{voteStatus ? <i>{(voteStatus.voteCounts[exit.id] || 0)+" VOTES"+(voteStatus.selectedExit===exit.id?" · YOUR VOTE":"")}</i> : null}</button>)}</div> : null}
    <div className="scene-vignette"/>
    <div className="scene-location"><span>◆</span> {room.name.toUpperCase()} <i>·</i> {room.floor}</div>
    <div className="enemy-intents">{enemies.filter(e=>e.hp>0).map(e=><button key={e.id} className={"intent "+(target===e.id?"intent-active":"")} onClick={()=>onTarget(e.id)}><span className="intent-dot"/><span>{e.name}</span><b>{e.intent}</b><small>{e.intentTarget}{e.interruptible ? " · INTERRUPTIBLE" : ""}</small></button>)}</div>
    <CombatImpacts events={impacts} enemies={enemies} playerId={playerId} view="player" />
    <div className="scene-hint">THE WAYFARER'S VIEW · {room.description.toUpperCase()}</div>
  </div>;
}

function CastView({ enemies, playerHp, playerMaxHp, room, exits, voteStatus, impacts, depth }: { enemies: Enemy[]; playerHp: number; playerMaxHp: number; room: Room; depth: number; exits: { id: string; destination: RoomId; label: string; description?: string }[]; voteStatus?: VoteStatus; impacts: ApiCombatEvent[] }) {
  return <div className={"scene cast-scene room-" + room.id}>
    <svg className="scene-art" viewBox="0 0 1100 620" role="img" aria-label={"Cinematic elevated view of " + room.name}>
      <defs><linearGradient id="castfloor" x2="0" y2="1"><stop stopColor="#4b3d39"/><stop offset="1" stopColor="#171923"/></linearGradient><pattern id="casttiles" width="120" height="70" patternUnits="userSpaceOnUse"><path d="M2 2h56v30H2zM64 2h54v30H64zM2 38h56v30H2zM64 38h54v30H64z" fill="#9d8065" fillOpacity=".15" stroke="#171820" strokeWidth="4"/></pattern></defs>
      <rect width="1100" height="620" fill="#11131b"/><path d="M0 0H1100V620H0Z" fill="url(#castfloor)"/><path d="M0 0H1100V620H0Z" fill="url(#casttiles)"/>
      <path d="M0 0H1100V85H0zM0 535H1100V620H0z" fill="#0b0e16" opacity=".8"/>
      <path d="M120 90L980 90M120 530L980 530M120 90V530M980 90V530" stroke="#92765d" strokeWidth="12" opacity=".65"/>
      <g fill="#e18b4d" opacity=".7"><circle cx="130" cy="115" r="16"/><circle cx="970" cy="115" r="16"/><circle cx="130" cy="505" r="16"/><circle cx="970" cy="505" r="16"/></g>
      <g key={impacts.reduce((latest, event) => event.effect === "damage" && event.targetType === "player" ? Math.max(latest, event.round) : latest, 0)} className={impacts.some(event => event.effect === "damage" && event.targetType === "player") ? "cast-player-hit" : ""} transform="translate(550 370)" shapeRendering="crispEdges"><ellipse cy="38" rx="65" ry="17" fill="#080a10" opacity=".8"/><path d="M-28-50h56v85h-56z" fill="#53636a"/><path d="M-23-84h46v40h-46z" fill="#c59d78"/><path d="M-28-92h56v13h-56z" fill="#49342d"/><path d="M-22 32h19v30h-19zM4 32h19v30H4z" fill="#38313a"/><text y="94" textAnchor="middle" fill="#f0d2a8" fontSize="20">THE WAYFARER</text></g>
      <EnemyStage key={room.id} view="cast" enemies={enemies} events={impacts} />
    </svg>
    <div className="scene-vignette"/>
    <div className="enemy-intents">{enemies.filter(e => e.hp > 0).map(e => <div key={e.id} className="intent"><span className="intent-dot"/><span>{e.name}</span><b>{e.intent}</b><small>{e.intentTarget}{e.interruptible ? " · INTERRUPTIBLE" : ""}</small></div>)}</div>
    {exits.length > 0 ? <div className="cast-exits" aria-label="Available paths">{voteStatus ? <div className="path-vote-status" role="timer"><strong>PARTY PATH VOTE</strong><b>{voteStatus.remainingSeconds}s</b><small>{voteStatus.submittedCount}/{voteStatus.eligibleCount} VOTED · TIES RANDOM</small><div className="path-vote-progress"><i style={{ width: voteStatus.progressPercent + "%" }} /></div></div> : null}{exits.map((exit, index) => <div key={exit.id} className={"cast-exit cast-exit-" + (exits.length === 1 ? "center" : index === 0 ? "left" : "right")}><span>{exits.length === 1 ? "↑" : index === 0 ? "↖" : "↗"}</span><strong>{exit.label}</strong><small>{exit.description || "AVAILABLE PATH"}</small>{voteStatus ? <small>{(voteStatus.voteCounts[exit.id] || 0)+" VOTES"}</small> : null}</div>)}</div> : null}
    <div className="scene-location"><span>◆</span> {room.name.toUpperCase()} <i>·</i> SPECTATOR CAMERA</div>
    <div className="cast-overlay"><strong>THE FORGOTTEN CATACOMBS</strong><span>FLOOR {String(depth).padStart(2, "0")} · PARTY RUN</span><div className="cast-health">WAYFARER <Bar value={playerHp} max={playerMaxHp}/><b>{playerHp}/{playerMaxHp}</b></div></div>
    <CombatImpacts events={impacts} enemies={enemies} playerId="" view="cast" />
    <div className="scene-hint">CINEMATIC PARTY VIEW · LIVE ENCOUNTER</div>
  </div>;
}

export default function App() {
  const [spectatorAccess] = useState<SpectatorAccess | null>(readSpectatorAccess);
  const [session, setSession] = useState<PlayerSession | null>(() => {
    if (typeof window === "undefined" || readSpectatorAccess()) return null;
    try { return JSON.parse(window.localStorage.getItem(SESSION_KEY) || "null") as PlayerSession | null; }
    catch { return null; }
  });
  const [snapshot, setSnapshot] = useState<ApiRoom | null>(null);
  const [view, setView] = useState<View>(spectatorAccess ? "cast" : "player");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [, setMessage] = useState("Create a room to begin your run.");
  const [shareCopied, setShareCopied] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [progressionOpen, setProgressionOpen] = useState(false);
  const [selectedTalentId, setSelectedTalentId] = useState("");
  const [classCatalog, setClassCatalog] = useState<ProgressionCatalog | null>(null);
  const [previewClassId, setPreviewClassId] = useState("");
  const [skillTreeOpen, setSkillTreeOpen] = useState(false);

  const spectator = Boolean(spectatorAccess);
  const roomId = spectatorAccess?.roomId || session?.roomId;
  const token = spectatorAccess?.token || session?.playerToken;
  const run = snapshot?.run;
  const serverRoom = run?.rooms[run.currentRoomId];
  const roomIdForView = serverRoom ? visualRoomId(serverRoom.id) : "watcher-hall";
  const fallbackRoom: Room = { id: roomIdForView, name: "The Forgotten Catacombs", floor: "01", description: "", exits: [] };
  const room: Room = { ...(rooms[roomIdForView] || fallbackRoom), name: serverRoom?.name || rooms[roomIdForView]?.name || fallbackRoom.name, floor: serverRoom?.floor || rooms[roomIdForView]?.floor || fallbackRoom.floor, description: serverRoom?.description || rooms[roomIdForView]?.description || fallbackRoom.description };
  const enemies = (serverRoom?.encounter?.enemies || []).map((enemy, index, all) => visualEnemy(enemy, index, all.length, snapshot?.playerIds ?? []));
  const playerId = session?.playerId || snapshot?.ownerPlayerId || snapshot?.playerIds[0];
  const player = playerId ? run?.players[playerId] : undefined;
  const selectedClassId = snapshot?.playerClasses?.[session?.playerId || ""];
  const focusedClassId = previewClassId || selectedClassId || classCatalog?.classes.find(item => classCatalog.classAvailability.find(value => value.classId === item.id)?.initiallyAvailable)?.id || "";
  const focusedClass = classCatalog?.classes.find(item => item.id === focusedClassId);
  const isHost = Boolean(session && snapshot && session.playerId === snapshot.ownerPlayerId);
  const playerHp = player?.health ?? 30;
  const playerMaxHp = player?.maxHealth ?? 30;
  const exits: ApiExit[] = serverRoom?.exits || [];
  const livingTarget = enemies.find(enemy => enemy.id === target && enemy.hp > 0) || enemies.find(enemy => enemy.hp > 0);
  const gameOver = run?.phase === "completed" || run?.phase === "failed";
  const actionSubmitted = Boolean(playerId && run?.combatRound?.actions?.[playerId]);
  const roundActionCount = run?.combatRound ? Object.keys(run.combatRound.actions).length : 0;
  const roundDeadline = run?.combatRound ? new Date(run.combatRound.deadline).getTime() : 0;
  const remainingMs = run?.phase === "combat" && roundDeadline ? Math.max(0, roundDeadline - clockNow) : 0;
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const roundTimePercent = run?.combatRound ? Math.max(0, Math.min(100, remainingMs / Math.max(1, roundDeadline - new Date(run.combatRound.startedAt).getTime()) * 100)) : 0;
  const navigationVote = run?.navigationVote;
  const navigationDeadline = navigationVote ? new Date(navigationVote.deadline).getTime() : 0;
  const navigationRemainingMs = run?.phase === "exploring" && navigationDeadline ? Math.max(0, navigationDeadline - clockNow) : 0;
  const navigationRemainingSeconds = Math.ceil(navigationRemainingMs / 1000);
  const navigationTimePercent = navigationVote ? Math.max(0, Math.min(100, navigationRemainingMs / Math.max(1, navigationDeadline - new Date(navigationVote.startedAt).getTime()) * 100)) : 0;
  const eligibleVoterIds = (snapshot?.playerIds ?? []).filter(id => snapshot?.presence?.[id]?.status !== "left" && (run?.players[id]?.health ?? 0) > 0);
  const livingPlayerCount = eligibleVoterIds.length;
  const voteCounts = exits.reduce((counts, exit) => { counts[exit.id] = eligibleVoterIds.filter(id => navigationVote?.votes?.[id] === exit.id).length; return counts; }, {} as Record<string, number>);
  const voteStatus: VoteStatus | undefined = navigationVote ? { remainingSeconds: navigationRemainingSeconds, progressPercent: navigationTimePercent, submittedCount: eligibleVoterIds.filter(id => Boolean(navigationVote.votes[id])).length, eligibleCount: livingPlayerCount, voteCounts, selectedExit: session?.playerId ? navigationVote.votes[session.playerId] : undefined } : undefined;
  const exploring = run?.phase === "exploring";
  const availableExits = exploring && (!serverRoom?.event || serverRoom.event.resolved) ? exits.map(exit => ({ ...exit, destination: visualRoomId(exit.destination) })) : [];
  const spectatorLink = session?.spectatorToken ? window.location.origin + window.location.pathname + "#spectate=" + encodeURIComponent(session.roomId + ":" + session.spectatorToken) : "";
  const audio = useGameAudio(roomIdForView, run?.phase ?? "lobby", playerHp, enemies.map(enemy => ({ id: enemy.id, hp: enemy.hp })), run?.lastCombatEvents ?? [], snapshot?.version ?? 0, run?.musicIntensity ?? 1);

  useEffect(() => {
    if (!spectator && run?.phase === "exploring" && (player?.talentPoints ?? 0) > 0) {
      setProgressionOpen(true);
      setSelectedTalentId("");
    }
  }, [run?.phase, player?.level, player?.talentPoints, spectator]);

  useEffect(() => {
    if (!(run?.phase === "combat" && run.combatRound) && !(run?.phase === "exploring" && run.navigationVote) && !(run?.phase === "intermission" && run.interFloorVote)) return;
    setClockNow(Date.now());
    const timer = window.setInterval(() => setClockNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [run?.phase, run?.combatRound?.number, run?.combatRound?.deadline, run?.navigationVote?.deadline, run?.interFloorVote?.deadline]);

  useEffect(() => {
    if (!roomId || !token) return;
    let active = true;
    const load = async () => {
      try {
        const next = await apiRequest<ApiRoom>(spectator ? "/spectate/" + roomId : "/rooms/" + roomId, token);
        if (active) {
          setSnapshot(current => !current || next.version >= current.version ? next : current);
          setError("");
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load room");
      }
    };
    void load();
    const timer = window.setInterval(() => { void load(); }, 1500);
    return () => { active = false; window.clearInterval(timer); };
  }, [roomId, token, spectator]);

  useEffect(() => {
    if (run || spectator || !snapshot) return;
    let active = true;
    void apiRequest<ProgressionCatalog>("/progression").then(value => { if (active) setClassCatalog(value); }).catch(err => { if (active) setError(err instanceof Error ? err.message : "Unable to load class choices"); });
    return () => { active = false; };
  }, [Boolean(run), spectator, snapshot?.id]);

  useEffect(() => {
    if (!session || spectator) return;
    let active = true;
    const heartbeat = async () => {
      try {
        const next = await apiRequest<ApiRoom>("/rooms/" + session.roomId + "/heartbeat", session.playerToken, { method: "POST" });
        if (active) setSnapshot(current => !current || next.version >= current.version ? next : current);
      } catch {
        // Snapshot polling continues during a temporary disconnect; the server
        // marks the player disconnected only after the heartbeat grace period.
      }
    };
    void heartbeat();
    const timer = window.setInterval(() => { void heartbeat(); }, 10000);
    return () => { active = false; window.clearInterval(timer); };
  }, [session?.roomId, session?.playerToken, spectator]);

  useEffect(() => {
    if (livingTarget && target !== livingTarget.id) setTarget(livingTarget.id);
  }, [livingTarget?.id, target]);

  async function createRun() {
    setBusy(true); setError("");
    try {
      const created = await apiRequest<{ room: ApiRoom; playerToken: string; spectatorToken: string }>("/rooms", undefined, { method: "POST" });
      const nextSession = { roomId: created.room.id, playerId: created.room.ownerPlayerId, playerToken: created.playerToken, spectatorToken: created.spectatorToken };
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
      setSnapshot(created.room);
      setMessage("Room created. Share the invite code and start when everyone is ready.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the room");
    } finally { setBusy(false); }
  }

  async function joinRoom() {
    setBusy(true); setError("");
    try {
      const joined = await apiRequest<{ room: ApiRoom; playerId: string; playerToken: string }>("/rooms/join", undefined, { method: "POST", body: JSON.stringify({ code: joinCode.trim() }) });
      const nextSession = { roomId: joined.room.id, playerId: joined.playerId, playerToken: joined.playerToken };
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
      setSnapshot(joined.room);
      setMessage("Joined the room. Waiting for the host to start the run.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join the room");
    } finally { setBusy(false); }
  }


  async function selectClass(classId: string) {
    if (!session || busy || run) return;
    setBusy(true); setError("");
    try {
      const next = await apiRequest<ApiRoom>("/rooms/" + session.roomId + "/class", session.playerToken, { method: "POST", body: JSON.stringify({ classId }) });
      setSnapshot(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not select class");
    } finally { setBusy(false); }
  }

  async function acceptTalentChoice() {
    if (!selectedTalentId || !session || busy || spectator) return;
    setBusy(true); setError("");
    try {
      const next = await apiRequest<ApiRoom>("/rooms/" + session.roomId + "/talents", session.playerToken, { method: "POST", body: JSON.stringify({ talentId: selectedTalentId }) });
      setSnapshot(next);
      setProgressionOpen(false);
      setSelectedTalentId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not choose talent");
    } finally { setBusy(false); }
  }

  async function startRun() {
    if (!session || !isHost || busy) return;
    setBusy(true); setError("");
    try {
      const started = await apiRequest<ApiRoom>("/rooms/" + session.roomId + "/start", session.playerToken, { method: "POST" });
      setSnapshot(started);
      setMessage("The party has entered the catacombs.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the run");
    } finally { setBusy(false); }
  }

  async function returnToLobby() {
    if (!session || !isHost || busy) return;
    setBusy(true); setError("");
    try {
      const lobby = await apiRequest<ApiRoom>("/rooms/" + session.roomId + "/return-to-lobby", session.playerToken, { method: "POST" });
      setSnapshot(lobby);
      setMessage("The party is back in the lobby. Your room and invite code are unchanged.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not return to the lobby");
    } finally { setBusy(false); }
  }


  async function leaveRoom() {
    if (!session || busy) return;
    setBusy(true); setError("");
    try {
      await apiRequest<ApiRoom>("/rooms/" + session.roomId + "/leave", session.playerToken, { method: "POST" });
      window.localStorage.removeItem(SESSION_KEY);
      setSession(null);
      setSnapshot(null);
      setMessage("You left the party.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not leave the room");
    } finally { setBusy(false); }
  }

  async function sendCommand(command: { type: string; round?: number; action?: string; targetId?: string; exitId?: string; choiceId?: string }) {
    if (!session || busy) return;
    setBusy(true); setError("");
    try {
      const next = await apiRequest<ApiRoom>("/rooms/" + session.roomId + "/commands", session.playerToken, { method: "POST", body: JSON.stringify(command) });
      setSnapshot(next);
      if (command.type === "choose_exit" && next.run?.navigationVote?.votes?.[session.playerId]) setMessage("Path vote submitted. Waiting for the party…");
      else if (command.type === "choose_exit" && next.run?.currentRoomId !== run?.currentRoomId) setMessage("The party enters the next chamber.");
      else if (command.type === "choose_exit") setMessage("Path vote submitted.");
      else if (command.type === "choose_event") setMessage("The party's choice takes effect.");
      else if (next.run?.phase === "combat" && next.run.combatRound?.actions?.[session.playerId]) setMessage("Action locked in. Waiting for the rest of the party…");
      else setMessage(command.action === "defend" ? "You brace for the incoming attack." : "Your attack strikes true.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Command failed");
      try {
        const latest = await apiRequest<ApiRoom>("/rooms/" + session.roomId, session.playerToken);
        setSnapshot(latest);
      } catch { /* Keep the original command error visible. */ }
    } finally {
      setBusy(false);
    }
  }

  function play(action: Action) {
    if (action === "guard") void sendCommand({ type: "combat", round: run?.combatRound?.number ?? 0, action: "defend" });
    else if (livingTarget && action === "interrupt" && livingTarget.interruptible) void sendCommand({ type: "combat", round: run?.combatRound?.number ?? 0, action: "interrupt", targetId: livingTarget.id });
    else if (livingTarget) void sendCommand({ type: "combat", round: run?.combatRound?.number ?? 0, action: "attack", targetId: livingTarget.id });
  }

  function shareSpectatorLink() {
    if (!session?.spectatorToken) return;
    void navigator.clipboard.writeText(spectatorLink).then(() => setShareCopied(true)).catch(() => setError("Clipboard access was blocked. You can copy the spectator URL from the address bar after opening it."));
  }

  if (!roomId || !token) {
    return <main className="game-screen lobby-screen">
      <header className="game-topline"><a className="game-brand" href="#" aria-label="Heart of the Beast"><span>H</span> HEART OF THE BEAST</a><div className="run-status"><i/> LOCAL DEVELOPMENT</div></header>
      <section className="lobby-panel lobby-create-panel">
        <p style={{ letterSpacing: ".18em", color: "#d8a76e" }}>THE FORGOTTEN CATACOMBS</p>
        <h1 style={{ fontSize: 34, margin: "12px 0" }}>Gather your party</h1>
        <p style={{ lineHeight: 1.6, color: "#c7b9a8" }}>Create a room and invite up to three friends, or join an existing lobby with its six-character code. No account required.</p>
        <button className="turn-button lobby-create-button" onClick={() => void createRun()} disabled={busy}>{busy ? "CREATING ROOM…" : "CREATE ROOM"} <span>↗</span></button>
        <div style={{ margin: "28px 0", borderTop: "1px solid #51463e" }}/>
        <label htmlFor="join-code" style={{ display: "block", color: "#d8a76e", letterSpacing: ".12em", marginBottom: 10 }}>JOIN A PARTY</label>
        <div className="lobby-join-row">
          <input id="join-code" value={joinCode} onChange={event => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} placeholder="6-CHARACTER CODE" maxLength={6} autoComplete="off" style={{ flex: "1 1 220px", minWidth: 0, padding: "13px 14px", background: "#0f1118", border: "1px solid #625246", color: "#f1e5d5", letterSpacing: ".2em", fontSize: 18 }} />
          <button className="turn-button" onClick={() => void joinRoom()} disabled={busy || joinCode.length !== 6}>JOIN ROOM <span>↗</span></button>
        </div>
        {error ? <p role="alert" style={{ color: "#f08f7e" }}>{error}</p> : null}
      </section>
    </main>;
  }

  if (!snapshot) {
    return <main className="game-screen"><header className="game-topline"><a className="game-brand" href="#"><span>H</span> HEART OF THE BEAST</a><div className="run-status"><i/> CONNECTING</div></header><p role="status" style={{ padding: 32, color: "#f1e5d5" }}>{error || "Connecting to the room…"}</p></main>;
  }

  if (!run || !serverRoom) {
    return <main className="game-screen lobby-screen">
      <header className="game-topline"><a className="game-brand" href="#"><span>H</span> HEART OF THE BEAST</a><div className="run-status"><i/> PARTY LOBBY</div></header>
      <section className="lobby-panel party-lobby-panel">
        <p style={{ letterSpacing: ".18em", color: "#d8a76e" }}>ROOM {snapshot.code}</p>
        <h1 style={{ fontSize: 34, margin: "12px 0" }}>The party is gathering</h1>
        <p style={{ color: "#c7b9a8" }}>Share this code with friends. Up to four players can join before the host starts the run.</p>
        <div style={{ padding: 18, margin: "20px 0", background: "#0f1118", border: "1px solid #625246", fontSize: 30, letterSpacing: ".28em", textAlign: "center" }}>{snapshot.code}</div>
        <h2 style={{ fontSize: 18 }}>Adventurers ({snapshot.playerIds.filter(id => snapshot.presence?.[id]?.status !== "left").length}/4)</h2>
        <ul className="party-roster">{snapshot.playerIds.map((id, index) => <li key={id}><span>{id === snapshot.ownerPlayerId ? "HOST" : "ADVENTURER"} {index + 1}{session?.playerId === id ? " · YOU" : ""}</span><strong>{classCatalog?.classes.find(item => item.id === snapshot.playerClasses?.[id])?.name || "Choosing a class"}</strong><i>{snapshot.presence?.[id]?.status?.toUpperCase() || "UNKNOWN"}</i></li>)}</ul>
        <div className="class-picker class-picker-compact">
          <div className="class-picker-heading"><div className="progression-eyebrow">CREATE YOUR ADVENTURER</div><h2>Choose your path</h2><p>Every class can survive the catacombs. Pick the one whose way of fighting feels like yours.</p></div>
          {!classCatalog ? <p role="status">Preparing the class roster…</p> : <>
            <div className="class-roster-label">AVAILABLE TO PLAY</div>
            <div className="class-selection-layout">
              <div className="class-roster-grid" aria-label="Choose a class">{classCatalog.classes.filter(item => classCatalog.classAvailability.find(value => value.classId === item.id)?.initiallyAvailable || item.id === selectedClassId).map(item => <button key={item.id} className={"class-roster-choice" + (item.id === focusedClassId ? " selected" : "")} onClick={() => setPreviewClassId(item.id)} aria-pressed={item.id === focusedClassId}><span className={"class-roster-swatch swatch-" + item.archetypeId} aria-hidden="true">✦</span><span><strong>{item.name}</strong><small>{item.archetypeId}</small></span>{item.id === selectedClassId ? <i>CHOSEN</i> : null}</button>)}</div>
              {focusedClass ? (() => {
                const ability = classCatalog.classAbilities.find(value => value.id === focusedClass.signatureAbilityId);
                const passive = classCatalog.classPassives.find(value => value.id === focusedClass.passiveId);
                const equipmentNames = focusedClass.startingEquipment.map(id => classCatalog.equipment.find(value => value.id === id)?.name || id);
                return <section className="class-detail" aria-live="polite">
                  <div className="class-detail-portrait"><ClassPortrait classId={focusedClass.id} archetype={focusedClass.archetypeId} name={focusedClass.name}/><div className="portrait-caption"><span>{focusedClass.archetypeId.toUpperCase()} PATH</span><strong>{focusedClass.name}</strong></div></div>
                  <div className="class-detail-copy"><div className="class-detail-title"><div><span className="progression-eyebrow">MEET YOUR ADVENTURER</span><h3>{focusedClass.name}</h3></div><span className="class-classification">{focusedClass.archetypeId.toUpperCase()}</span></div><p className="class-detail-description">{focusedClass.description}</p>
                    <div className="class-detail-stats">{[["VITALITY", focusedClass.startingStats.health], ["POWER", focusedClass.startingStats.power], ["FOCUS", focusedClass.startingStats.focus], ["AGILITY", focusedClass.startingStats.agility]].map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div>
                    <div className="class-skills"><article><SkillIcon id={focusedClass.signatureAbilityId}/><div><span>SIGNATURE SKILL</span><strong>{ability?.name || "Signature ability"}</strong><small>{ability?.description}</small></div></article><article><SkillIcon id={focusedClass.passiveId}/><div><span>ALWAYS WITH YOU</span><strong>{passive?.name || "Passive trait"}</strong><small>{passive?.description}</small></div></article></div>
                    <p className="class-gear"><b>STARTING GEAR</b> {equipmentNames.join(" · ")}</p>
                    <div className="class-detail-actions"><button className="tree-preview-button" onClick={() => setSkillTreeOpen(true)}>VIEW TALENT TREE <span>↗</span></button><button className="choose-class-button" onClick={() => void selectClass(focusedClass.id)} disabled={busy || focusedClass.id === selectedClassId}>{busy ? "SAVING…" : focusedClass.id === selectedClassId ? "YOUR CHOSEN PATH" : "CHOOSE THIS CLASS"}</button></div>
                  </div>
                </section>;
              })() : <p>No classes are available yet.</p>}
            </div>
            {classCatalog.classAvailability.some(value => !value.initiallyAvailable) ? <><div className="class-roster-label locked-label">UNLOCKABLE PATHS</div><div className="locked-class-list">{classCatalog.classes.filter(item => !classCatalog.classAvailability.find(value => value.classId === item.id)?.initiallyAvailable && item.id !== selectedClassId).map(item => <div className="locked-class" key={item.id}><span>LOCKED</span><strong>{item.name}</strong><small>{item.description} Unlock requirement will be shown here.</small></div>)}</div></> : null}
          </>}
        </div>
        {skillTreeOpen && focusedClass ? <div className="progression-backdrop" role="presentation"><section className="progression-modal class-tree-modal" role="dialog" aria-modal="true" aria-labelledby="class-tree-title"><div className="progression-modal-heading"><div><span className="progression-eyebrow">{focusedClass.name.toUpperCase()} · {focusedClass.archetypeId.toUpperCase()} PATH</span><h2 id="class-tree-title">Talent path preview</h2><p>These are the current shared {focusedClass.archetypeId} talents. Class-specific trees are planned next.</p></div><button className="progression-close" onClick={() => setSkillTreeOpen(false)} aria-label="Close talent tree preview">×</button></div><div className="talent-tree class-tree-preview">{[1, 2].map(tier => <div className="talent-tier" key={tier}><div className="talent-tier-label">{tier === 1 ? "FOUNDATION" : "SPECIALIZATION"}</div><div className="talent-tier-nodes">{talentChoices.filter(talent => talent.archetype === focusedClass.archetypeId && talent.tier === tier).map(talent => <div className="talent-node class-tree-node" key={talent.id}><span>TIER {talent.tier}</span><strong>{talent.name}</strong><small>{talent.description}</small>{talent.requires ? <i>FOLLOWS {talentChoices.find(value => value.id === talent.requires)?.name}</i> : <i>AVAILABLE FIRST</i>}</div>)}</div></div>)}</div><div className="class-tree-footer">Choose a talent between encounters as your adventurer grows.</div></section></div> : null}
        {isHost ? <button className="turn-button" onClick={() => void startRun()} disabled={busy || snapshot.playerIds.some(id => snapshot.presence?.[id]?.status !== "left" && !snapshot.playerClasses?.[id])}>{busy ? "STARTING…" : "BEGIN THE ADVENTURE"} <span>GO</span></button> : <p role="status" style={{ color: "#d8a76e" }}>Choose your class. The host can begin once every adventurer is ready.</p>}
        <button className="turn-button" onClick={() => void leaveRoom()} disabled={busy}>LEAVE PARTY</button>
        {error ? <p role="alert" style={{ color: "#f08f7e" }}>{error}</p> : null}
      </section>
    </main>;
  }

  return <main className="game-screen">
    <header className="game-topline">
      <a className="game-brand" href="#" aria-label="Heart of the Beast"><span>H</span> HEART OF THE BEAST</a>
      <div className="run-status"><i/> {spectator ? "SPECTATING" : "SERVER-AUTHORITATIVE RUN"} <b>·</b> FLOOR {String(run.depth ?? 1).padStart(2, "0")}</div>
      <AudioControls settings={audio.settings} onEnable={() => { void audio.enable(); }} onChange={audio.updateSettings} />
      {!spectator ? <div className="view-switch" aria-label="Presentation view"><button className={view === "player" ? "selected" : ""} onClick={() => setView("player")}>PLAYER</button><button className={view === "cast" ? "selected" : ""} onClick={() => setView("cast")}>SPECTATOR / CAST</button></div> : <div className="view-switch"><button className="selected">SPECTATOR / CAST</button></div>}
    </header>
    {!spectator && <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", flexWrap: "wrap", gap: 16, padding: "8px 24px" }}>{session?.spectatorToken ? <><a href={spectatorLink} target="_blank" rel="noreferrer" style={{ color: "#d8a76e" }}>OPEN SPECTATOR VIEW</a><button className="turn-button" onClick={shareSpectatorLink}>{shareCopied ? "SPECTATOR LINK COPIED" : "COPY SPECTATOR LINK"} <span>↗</span></button></> : null}<button className="turn-button" onClick={() => void leaveRoom()} disabled={busy}>LEAVE PARTY</button></div>}
    <section className="play-area">
      {view === "player" && !spectator
        ? <PlayerView enemies={enemies} target={livingTarget?.id || target} onTarget={setTarget} room={room} exits={availableExits} onNavigate={(exitId: string) => void sendCommand({ type: "choose_exit", exitId })} voteStatus={voteStatus} impacts={run?.lastCombatEvents || []} playerId={playerId || ""} />
        : <CastView enemies={enemies} playerHp={playerHp} playerMaxHp={playerMaxHp} depth={run.depth ?? 1} room={room} exits={availableExits} voteStatus={voteStatus} impacts={run?.lastCombatEvents || []} />}
      {serverRoom?.event ? <section className="room-event-panel" aria-live="polite">
        <div className="room-event-heading"><span>{serverRoom.event.resolved ? "DECISION RECORDED" : serverRoom.roomType === "reward" ? "TREASURE" : "DISCOVERY"}</span><h2>{serverRoom.event.title}</h2></div>
        <p>{serverRoom.event.description}</p>
        {serverRoom.event.resolved
          ? <div className="room-event-result">{serverRoom.event.result || "The party moves on."}</div>
          : !spectator && view === "player"
            ? <div className="room-event-choices">{serverRoom.event.choices.map(choice => <button key={choice.id} onClick={() => void sendCommand({ type: "choose_event", choiceId: choice.id })} disabled={busy}><strong>{choice.label}</strong><small>{choice.description}</small></button>)}</div>
            : <div className="room-event-result">THE PARTY IS DECIDING</div>}
      </section> : null}
      {run.phase === "intermission" ? <section className="room-event-panel" aria-live="polite">
        <div className="room-event-heading"><span>FLOOR {run.depth ?? 1} CLEARED · DESCENT {(run.depth ?? 1) + 1} OF {run.maxDepth ?? 3}</span><h2>Choose how to prepare</h2></div>
        <p>The party has a moment before descending. Recover now, or carry a small permanent advantage deeper into the catacombs.</p>
        <p>{run.interFloorVote ? "Party vote · " + Object.keys(run.interFloorVote.votes || {}).length + "/" + livingPlayerCount + " submitted · " + Math.max(0, Math.ceil((new Date(run.interFloorVote.deadline).getTime() - clockNow) / 1000)) + "s remaining" : "Choose how the whole party prepares for the next floor."}</p>
        {!spectator && view === "player" ? <div className="room-event-choices">
          <button onClick={() => void sendCommand({ type: "choose_inter_floor", choiceId: "restore" })} disabled={busy}><strong>{run.interFloorVote?.votes?.[playerId || ""] === "restore" ? "✓ Restore health · YOUR VOTE" : "Restore health"}</strong><small>Every living adventurer recovers up to 10 health. {Object.values(run.interFloorVote?.votes || {}).filter(choice => choice === "restore").length} votes.</small></button>
          <button onClick={() => void sendCommand({ type: "choose_inter_floor", choiceId: "perk" })} disabled={busy}><strong>{run.interFloorVote?.votes?.[playerId || ""] === "perk" ? "✓ Take a run perk · YOUR VOTE" : "Take a run perk"}</strong><small>Every adventurer gains +1 Strike damage and +1 Guard for the rest of the run. {Object.values(run.interFloorVote?.votes || {}).filter(choice => choice === "perk").length} votes.</small></button>
        </div> : <div className="room-event-result">THE PARTY IS CHOOSING ITS DESCENT · RESTORE {Object.values(run.interFloorVote?.votes || {}).filter(choice => choice === "restore").length} · PERK {Object.values(run.interFloorVote?.votes || {}).filter(choice => choice === "perk").length}</div>}
      </section> : null}
      <div className="player-hud"><div className="hero-token">{(player?.archetype || "damage").slice(0, 1).toUpperCase()}</div><div className="hero-vitals"><div className="hero-name">ADVENTURER {snapshot.playerIds.indexOf(playerId || "") + 1} <span>LV {player?.level ?? 1} · {archetypeName(player?.archetype).toUpperCase()}</span></div><div className="hero-health"><Bar value={playerHp} max={playerMaxHp}/><strong>{playerHp}<i>/{playerMaxHp}</i></strong></div><div className="xp-label"><span>RUN XP</span><b>{player?.experience ?? 0} / {levelThresholds[player?.level ?? 1] ?? "MAX"}</b></div><div className="xp-track"><i style={{ width: (player ? xpProgress(player).percent : 0) + "%" }}/></div></div><div className="run-stats"><span>POW <b>{player?.stats?.power ?? 0}</b></span><span>FOC <b>{player?.stats?.focus ?? 0}</b></span><span>AGI <b>{player?.stats?.agility ?? 0}</b></span></div></div>
      {!spectator && exploring && player && progressionOpen ? <div className="progression-backdrop" role="presentation">
        <section className="progression-modal" role="dialog" aria-modal="true" aria-labelledby="progression-title">
          <div className="progression-modal-heading"><div><span className="progression-eyebrow">LEVEL {player.level} · RUN PROGRESSION</span><h2 id="progression-title">Choose your next talent</h2><p>{archetypeName(player.archetype)} · {player.talentPoints} point{player.talentPoints === 1 ? "" : "s"} available. Browse both branches before committing.</p></div><button className="progression-close" onClick={() => setProgressionOpen(false)} aria-label="Close talent selection">×</button></div>
          <div className="talent-tree">{[1,2].map(tier => <div className="talent-tier" key={tier}><div className="talent-tier-label">{tier === 1 ? "FOUNDATION" : "SPECIALIZATION"}</div><div className="talent-tier-nodes">{talentChoices.filter(talent => talent.archetype === player.archetype && talent.tier === tier).map(talent => {
            const chosen = player.talents?.includes(talent.id);
            const locked = player.level < talent.tier + 1 || Boolean(talent.requires && !player.talents?.includes(talent.requires));
            const selected = selectedTalentId === talent.id;
            return <button key={talent.id} className={"talent-node" + (chosen ? " chosen" : "") + (locked ? " locked" : "") + (selected ? " selected" : "")} onClick={() => !chosen && !locked && setSelectedTalentId(talent.id)} disabled={chosen || busy}>
              <span>{chosen ? "LEARNED" : locked ? "LOCKED" : "TIER " + tier}</span><strong>{talent.name}</strong><small>{talent.description}</small>{talent.requires ? <i>Requires {talentChoices.find(item => item.id === talent.requires)?.name}</i> : <i>{tier === 1 ? "Available now" : "Unlocks at level 3"}</i>}
            </button>;
          })}</div></div>)}</div>
          <div className="talent-inspector">{selectedTalentId ? <><strong>{talentChoices.find(talent => talent.id === selectedTalentId)?.name}</strong><span>{talentChoices.find(talent => talent.id === selectedTalentId)?.description}</span></> : <span>Select a talent to preview its effect. Your choice is not saved until you accept.</span>}</div>
          <div className="progression-modal-actions"><button className="progression-secondary" onClick={() => { setProgressionOpen(false); setSelectedTalentId(""); }}>Decide later</button><button className="progression-accept" onClick={() => void acceptTalentChoice()} disabled={!selectedTalentId || busy}>{busy ? "SAVING…" : "ACCEPT TALENT"}</button></div>
        </section>
      </div> : null}
      {view === "player" && !spectator
        ? <>{run.phase === "combat" ? <><div className="action-dock"><div className="action-target-hint">YOUR ACTIONS · TARGET: {livingTarget?.name || "NONE"} · STRIKE / INTERRUPT HIT THAT ENEMY · DEFEND PROTECTS YOU</div><div className={"combat-timer" + (remainingSeconds <= 3 && remainingMs > 0 ? " combat-timer-urgent" : "") + (actionSubmitted ? " combat-timer-waiting" : "")} role="timer" aria-label={remainingMs > 0 ? remainingSeconds + " seconds remaining in combat round" : "Combat round resolving"}><div className="combat-timer-heading"><strong>{actionSubmitted ? "ACTION LOCKED · WAITING FOR PARTY" : remainingMs > 0 ? "TIME TO ACT" : "ROUND RESOLVING"}</strong><span>ROUND {run.combatRound?.number ?? 1} · {roundActionCount}/{livingPlayerCount} READY</span><b>{remainingMs > 0 ? remainingSeconds + "s" : "—"}</b></div><div className="combat-timer-track"><i style={{ width: roundTimePercent + "%" }} /></div></div>{actions.filter(action => action.id !== "interrupt" || Boolean(livingTarget?.interruptible)).map(action => <button key={action.id} className={"move-button move-" + action.id} onClick={() => play(action.id)} disabled={busy || actionSubmitted || remainingMs <= 0 || (!livingTarget && action.id === "strike") || (action.id === "interrupt" && !livingTarget?.interruptible)}><span className="move-glyph">{action.glyph}</span><span className="move-label">{action.label}<small>{action.hint}</small></span></button>)}</div></> : null}
          {gameOver ? <div className="action-dock"><button className="turn-button" onClick={() => void returnToLobby()} disabled={busy}>{busy ? "RETURNING TO LOBBY…" : "RETURN TO LOBBY"} <span>↗</span></button></div> : null}
        </>
        : null}
      {gameOver ? <div className="event-message" role="status">{run.phase === "completed" ? "THE CATACOMBS ARE CLEARED — VICTORY" : "THE PARTY HAS FALLEN — RUN OVER"}</div> : null}
      <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 12, padding: "8px 16px", color: "#c7b9a8", fontSize: 12, letterSpacing: ".08em" }}>PARTY · {snapshot.playerIds.map((id, index) => <span key={id}>{id === snapshot.ownerPlayerId ? "HOST" : "PLAYER"} {index + 1}{id === playerId ? " (YOU)" : ""} · {snapshot.presence?.[id]?.status?.toUpperCase() || "UNKNOWN"}</span>)}</div>
      {error ? <div className="event-message" role="alert" style={{ color: "#f08f7e" }}>{error}</div> : null}
    </section>
    <footer className="game-foot"><span>THE FORGOTTEN CATACOMBS</span><span>{spectator ? "INDEPENDENT SPECTATOR · READ-ONLY" : view === "player" ? "PLAYER VIEW · SERVER-VALIDATED COMMANDS" : "SPECTATOR VIEW · READ-ONLY PRESENTATION"}</span></footer>
  </main>;
}
