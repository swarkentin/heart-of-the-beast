import { useEffect, useState } from "react";
import { AudioControls, useGameAudio } from "./audio";

type Action = "strike" | "guard" | "interrupt";
type View = "player" | "cast";
type Enemy = { id: string; name: string; hp: number; maxHp: number; intent: string; intentTarget: string; damage: number; interruptible: boolean; x: number };
type RoomId = "watcher-hall" | "reliquary" | "flooded-crossing" | "warden-gate";
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
type ApiEnemy = { id: string; name: string; behavior?: string; turnsTaken: number; health: number; maxHealth: number; intent?: ApiEnemyIntent };
type ApiCombatEvent = { round: number; kind: string; message: string };
type ApiExit = { id: string; destination: string; label: string };
type ApiDungeonRoom = { id: string; name: string; description: string; exits: ApiExit[]; encounter?: { status: string; enemies: ApiEnemy[] }; cleared: boolean };

type ApiStats = { power: number; focus: number; agility: number };
type ApiPlayer = { id: string; health: number; maxHealth: number; archetype: string; experience: number; level: number; talentPoints: number; talents: string[]; stats: ApiStats };
type TalentChoice = { id: string; archetype: string; name: string; description: string; tier: number; requires?: string };
const archetypes = [
  { id: "vanguard", name: "Vanguard", description: "Hold the line with heavy strikes and dependable defense." },
  { id: "rogue", name: "Rogue", description: "Exploit openings, avoid punishment, and strike precisely." },
  { id: "arcanist", name: "Arcanist", description: "Turn focused magic into force and disruption." },
  { id: "warden", name: "Warden", description: "Endure, restore, and protect through the longest fights." },
];
const talentChoices: TalentChoice[] = [
  { id: "vanguard-bulwark", archetype: "vanguard", name: "Bulwark", description: "+4 maximum health; defend blocks 3 more damage.", tier: 1 },
  { id: "vanguard-heavy-hands", archetype: "vanguard", name: "Heavy Hands", description: "Attacks deal 3 additional damage.", tier: 1 },
  { id: "vanguard-rally", archetype: "vanguard", name: "Rally", description: "Recover 4 health after clearing an encounter.", tier: 2, requires: "vanguard-bulwark" },
  { id: "vanguard-counterstrike", archetype: "vanguard", name: "Counterstrike", description: "Interrupts deal 4 damage.", tier: 2, requires: "vanguard-heavy-hands" },
  { id: "rogue-precision", archetype: "rogue", name: "Precision", description: "Attacks deal 2 additional damage.", tier: 1 },
  { id: "rogue-evasion", archetype: "rogue", name: "Evasion", description: "Take 2 less damage from enemy attacks.", tier: 1 },
  { id: "rogue-opportunist", archetype: "rogue", name: "Opportunist", description: "Deal 4 extra damage to enemies with a telegraphed move.", tier: 2, requires: "rogue-precision" },
  { id: "rogue-shadowstep", archetype: "rogue", name: "Shadowstep", description: "Defend blocks 2 additional damage.", tier: 2, requires: "rogue-evasion" },
  { id: "arcanist-embercraft", archetype: "arcanist", name: "Embercraft", description: "Attacks deal 4 additional damage.", tier: 1 },
  { id: "arcanist-disruption", archetype: "arcanist", name: "Disruption", description: "Interrupts deal 4 damage.", tier: 1 },
  { id: "arcanist-overcharge", archetype: "arcanist", name: "Overcharge", description: "Attacks deal 2 additional damage.", tier: 2, requires: "arcanist-embercraft" },
  { id: "arcanist-aether-shield", archetype: "arcanist", name: "Aether Shield", description: "Defend blocks 3 additional damage.", tier: 2, requires: "arcanist-disruption" },
  { id: "warden-vitality", archetype: "warden", name: "Vitality", description: "+6 maximum health.", tier: 1 },
  { id: "warden-restoration", archetype: "warden", name: "Restoration", description: "Recover 6 health after clearing an encounter.", tier: 1 },
  { id: "warden-warding", archetype: "warden", name: "Warding", description: "Defend blocks 3 additional damage.", tier: 2, requires: "warden-vitality" },
  { id: "warden-thorns", archetype: "warden", name: "Thorns", description: "Reflect 2 damage when struck.", tier: 2, requires: "warden-restoration" },
];
const levelThresholds = [0, 50, 100, 200, 325];
function archetypeName(id?: string) { return archetypes.find(item => item.id === id)?.name || "Vanguard"; }
function xpProgress(player: ApiPlayer) {
  const current = levelThresholds[player.level - 1] ?? 325;
  const next = levelThresholds[player.level] ?? current;
  return { current: Math.max(0, player.experience - current), needed: Math.max(0, next - current), percent: next > current ? Math.min(100, Math.max(0, (player.experience - current) / (next - current) * 100)) : 100 };
}

type ApiCombatRound = { number: number; startedAt: string; deadline: string; actions: Record<string, { type: string; action: string; targetId?: string }> };
type ApiNavigationVote = { startedAt: string; deadline: string; votes: Record<string, string> };
type VoteStatus = { remainingSeconds: number; progressPercent: number; submittedCount: number; eligibleCount: number; voteCounts: Record<string, number>; selectedExit?: string };
type ApiRun = { id: string; phase: "lobby" | "combat" | "exploring" | "completed" | "failed"; currentRoomId: string; rooms: Record<string, ApiDungeonRoom>; players: Record<string, ApiPlayer>; combatRound?: ApiCombatRound; navigationVote?: ApiNavigationVote; lastCombatEvents?: ApiCombatEvent[] };
type ApiPresence = { status: "online" | "disconnected" | "left"; lastSeenAt: string; leftAt?: string };
type ApiRoom = { id: string; code: string; ownerPlayerId: string; playerIds: string[]; playerArchetypes?: Record<string, string>; presence?: Record<string, ApiPresence>; run?: ApiRun; version: number };
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
  if (id === "reliquary") return "reliquary";
  if (id === "flooded-crossing") return "flooded-crossing";
  if (id === "warden") return "warden-gate";
  return "watcher-hall";
}

function visualEnemy(enemy: ApiEnemy, index: number, count: number, playerIds: string[]): Enemy {
  const intent = enemy.intent;
  const targetIndex = intent?.targetPlayerId ? playerIds.indexOf(intent.targetPlayerId) + 1 : 0;
  const intentTarget = intent?.targetAll ? "TARGET: ALL ADVENTURERS" : targetIndex > 0 ? "TARGET: ADVENTURER " + targetIndex : "NO TARGET";
  const intentLabel = intent ? intent.label + " · " + intent.damage + " DMG" + (intent.heal ? " · HEALS " + intent.heal : "") : "No intent";
  return { id: enemy.id, name: enemy.name, hp: enemy.health, maxHp: enemy.maxHealth, intent: intentLabel, intentTarget, damage: intent?.damage ?? 0, interruptible: Boolean(intent?.interruptible), x: count === 1 ? 550 : index === 0 ? 430 : 670 };
}


function Bar({ value, max }: { value: number; max: number }) {
  return <span className="bar"><i style={{ width: (Math.max(0, value) / max * 100) + "%" }} /></span>;
}

function EnemyFigure({ enemy, selected, onClick }: { enemy: Enemy; selected: boolean; onClick?: () => void }) {
  const dead = enemy.hp <= 0;
  const boss = enemy.id === "warden";
  const scout = enemy.id === "scout";
  const guardian = enemy.id === "guardian";
  return <g transform={`translate(${enemy.x} 0)`} opacity={dead ? .18 : 1} onClick={onClick} className={onClick && !dead ? "enemy-sprite" : ""}>
    {selected && !dead ? <ellipse cx="0" cy="448" rx={boss ? 112 : 82} ry="15" fill="none" stroke="#e9bd80" strokeWidth="4" strokeDasharray="9 7" /> : null}
    <ellipse cx="0" cy="454" rx={boss ? 82 : 62} ry="14" fill="#080a10" opacity=".8" />
    <g className="enemy-art" shapeRendering="crispEdges">
      {boss ? <>
        <path d="M-70 278h140v145H-70z" fill="#253b43"/><path d="M-86 292h35v108h-35zM51 292h35v108H51z" fill="#42666a"/>
        <path d="M-82 305l-40 75 24 19 55-65M82 305l40 75-24 19-55-65" fill="#416d69"/>
        <path d="M-53 245l-32-38 14-8 35 24M53 245l32-38-14-8-35 24" fill="#5b7770"/>
        <path d="M-51 228h102v84H-51z" fill="#52666b"/><path d="M-61 215h122v25H-61z" fill="#283941"/>
        <path d="M-45 190l-28-38 9-28 26 35 19-22 19 22 19-22 26 22 19-35 9 28-28 38z" fill="#456b69"/>
        <path d="M-37 206h74v54h-74z" fill="#9bafa0"/><path d="M-27 222h15v13h-15zM12 222h15v13H12z" fill="#a8f1ba"/>
        <path d="M-9 241h18v9H-9z" fill="#29383c"/><path d="M-39 261h78v22h-78z" fill="#b0a58d"/>
        <path d="M-53 286h106v22H-53z" fill="#24343a"/><path d="M-28 286h56v52h-56z" fill="#6c8b7e"/>
        <path d="M-43 333h28v93h-28zM15 333h28v93H15z" fill="#3d565b"/>
        <path d="M-51 414h43v25h-43zM8 414h43v25H8z" fill="#b3a58c"/>
        <path d="M-91 286h34v63h-34zM57 286h34v63H57z" fill="#6b8c7c"/>
        <path d="M-104 260h28v35h-28zM76 260h28v35H76z" fill="#273d42"/>
        <path d="M-112 248h15v-34h15v34h15v16h-45z" fill="#79e5a4"/>
      </> : guardian ? <>
        <path d="M-59 280h118v145H-59z" fill="#55505a"/><path d="M-75 298h26v105h-26zM49 298h26v105H49z" fill="#8d7d70"/>
        <path d="M-48 231h96v75h-96z" fill="#77746c"/><path d="M-62 215h124v25H-62z" fill="#3c3940"/>
        <path d="M-50 229l-20-34 18-23 25 31M50 229l20-34-18-23-25 31" fill="#a28c70"/>
        <path d="M-34 250h18v17h-18zM16 250h18v17H16z" fill="#e3a75d"/>
        <path d="M-23 280h46v22h-46z" fill="#b5a38a"/><path d="M-32 308h64v23h-64z" fill="#c3a77b"/>
        <path d="M-42 336h27v86h-27zM15 336h27v86H15z" fill="#625c59"/>
        <path d="M-52 414h42v26h-42zM10 414h42v26H10z" fill="#b8a07d"/>
        <path d="M-74 310l-28 65 19 16 42-59M74 310l28 65-19 16-42-59" fill="#9b8b75"/>
        <path d="M-91 363h18v42h-18zM73 363h18v42H73z" fill="#514c50"/>
      </> : scout ? <>
        <path d="M-44 277h88v147h-88z" fill="#176d69"/><path d="M-59 300h20v98h-20zM39 300h20v98H39z" fill="#23958a"/>
        <path d="M-47 235h94v70h-94z" fill="#278d82"/><path d="M-57 223h114v22H-57z" fill="#124e56"/>
        <path d="M-45 226l-18-29 23-33 40 18 40-18 23 33-18 29z" fill="#155d62"/>
        <path d="M-27 253h15v12h-15zM12 253h15v12H12z" fill="#9cf0c9"/>
        <path d="M-12 272h24v10h-24z" fill="#123f49"/>
        <path d="M-38 314l-38 72 17 14 47-58M38 314l38 72-17 14-47-58" fill="#36a99a"/>
        <path d="M-34 421h27v34h-27zM7 421h27v34H7z" fill="#174e50"/>
        <path d="M-53 194l-17-18 11-15 20 20M53 194l17-18-11-15-20 20" fill="#45b7a3"/>
        <path d="M-46 354h-13v24h13M46 354h13v24H46" fill="#9be2c0"/>
      </> : <>
        <path d="M-39 288h78v132h-78z" fill="#c6a77b"/><path d="M-52 309h18v93h-18zM34 309h18v93H34z" fill="#8d694c"/>
        <path d="M-38 234h76v65h-76z" fill="#e0c99b"/><path d="M-48 222h96v18h-96z" fill="#80664f"/>
        <path d="M-29 253h13v13h-13zM16 253h13v13H16z" fill="#151a20"/>
        <path d="M-34 280h68v13h-68zM-23 294h13v24h-13zM10 294h13v24H10z" fill="#f0dfb7"/>
        <path d="M-28 326h13v13h-13zM15 326h13v13H15zM-28 355h13v13h-13zM15 355h13v13H15z" fill="#f0dfb7"/>
        <path d="M-33 417h25v37h-25zM8 417h25v37H8z" fill="#6e5542"/>
        <path d="M-48 310l-44 77 15 13 54-59M48 310l44 77-15 13-54-59" fill="#c6a77b"/>
        <path d="M-100 385h19v13h-19zM81 385h19v13H81z" fill="#9d815e"/>
        <path d="M-5 302h10v105H-5z" fill="#f2e5c9"/>
      </>}
    </g>
    <g transform="translate(0 175)">
      <rect x="-74" y="0" width="148" height="26" rx="3" fill="#11151d" stroke={selected ? "#e7bd7e" : "#756b65"} strokeWidth="2"/>
      <rect x="-69" y="5" width={138 * enemy.hp / enemy.maxHp} height="16" fill={boss ? "#5ebc91" : scout ? "#42b7a7" : "#b45e53"}/>
      <text x="0" y="-13" textAnchor="middle" fill="#f1e5d5" fontSize="20" fontWeight="bold">{enemy.name}</text>
    </g>
  </g>;
}
function PlayerView({ enemies, target, onTarget, room, exits, onNavigate, voteStatus }: { enemies: Enemy[]; target: string; onTarget: (id: Enemy["id"]) => void; room: Room; exits: { id: string; destination: RoomId; label: string }[]; onNavigate: (id: string) => void; voteStatus?: VoteStatus }) {
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
      {enemies.map(e => <EnemyFigure key={e.id} enemy={e} selected={target === e.id} onClick={() => e.hp > 0 && onTarget(e.id)} />)}
      <g transform="translate(550 0)" shapeRendering="crispEdges">
        <path d="M-190 620l22-78 62-44h-40l-48 36-38 86zM190 620l-22-78-62-44h40l48 36 38 86z" fill="#293943"/>
        <path d="M-170 620l18-72 46-36 42 0 12 108zM170 620l-18-72-46-36-42 0-12 108z" fill="#53636a"/>
        <path d="M-120 620l15-60 45-20 60 20 15 60zM120 620l-15-60-45-20-60 20-15 60z" fill="#8d735d"/>
      </g>
    </svg>
    {exits.length > 0 ? <div className="scene-exits" aria-label="Available paths">{voteStatus ? <div className="path-vote-status" role="timer"><strong>PARTY PATH VOTE</strong><b>{voteStatus.remainingSeconds}s</b><small>{voteStatus.submittedCount}/{voteStatus.eligibleCount} VOTED · TIES RANDOM</small><div className="path-vote-progress"><i style={{ width: voteStatus.progressPercent + "%" }} /></div></div> : null}{exits.map((exit,index)=><button key={exit.id} className={"scene-exit scene-exit-"+(exits.length===1?"center":index===0?"left":"right")+(voteStatus?.selectedExit===exit.id?" scene-exit-selected":"")} onClick={()=>onNavigate(exit.id)} disabled={Boolean(voteStatus && voteStatus.remainingSeconds <= 0)} aria-label={"Vote for "+exit.label}><span className="exit-chevron">{exits.length===1?"↑":index===0?"↖":"↗"}</span><strong>{exit.label}</strong><small>{voteStatus ? (voteStatus.voteCounts[exit.id] || 0)+" VOTES" : "ENTER PATH"}</small>{voteStatus?.selectedExit===exit.id ? <i>YOUR VOTE</i> : null}</button>)}</div> : null}
    <div className="scene-vignette"/>
    <div className="scene-location"><span>◆</span> {room.name.toUpperCase()} <i>·</i> {room.floor}</div>
    <div className="enemy-intents">{enemies.filter(e=>e.hp>0).map(e=><button key={e.id} className={"intent "+(target===e.id?"intent-active":"")} onClick={()=>onTarget(e.id)}><span className="intent-dot"/><span>{e.name}</span><b>{e.intent}</b><small>{e.intentTarget}{e.interruptible ? " · INTERRUPTIBLE" : ""}</small></button>)}</div>
    <div className="scene-hint">THE WAYFARER'S VIEW · {room.description.toUpperCase()}</div>
  </div>;
}

function CastView({ enemies, playerHp, playerMaxHp, room, exits, voteStatus }: { enemies: Enemy[]; playerHp: number; playerMaxHp: number; room: Room; exits: { id: string; destination: RoomId; label: string }[]; voteStatus?: VoteStatus }) {
  return <div className={"scene cast-scene room-" + room.id}>
    <svg className="scene-art" viewBox="0 0 1100 620" role="img" aria-label={"Cinematic elevated view of " + room.name}>
      <defs><linearGradient id="castfloor" x2="0" y2="1"><stop stopColor="#4b3d39"/><stop offset="1" stopColor="#171923"/></linearGradient><pattern id="casttiles" width="120" height="70" patternUnits="userSpaceOnUse"><path d="M2 2h56v30H2zM64 2h54v30H64zM2 38h56v30H2zM64 38h54v30H64z" fill="#9d8065" fillOpacity=".15" stroke="#171820" strokeWidth="4"/></pattern></defs>
      <rect width="1100" height="620" fill="#11131b"/><path d="M0 0H1100V620H0Z" fill="url(#castfloor)"/><path d="M0 0H1100V620H0Z" fill="url(#casttiles)"/>
      <path d="M0 0H1100V85H0zM0 535H1100V620H0z" fill="#0b0e16" opacity=".8"/>
      <path d="M120 90L980 90M120 530L980 530M120 90V530M980 90V530" stroke="#92765d" strokeWidth="12" opacity=".65"/>
      <g fill="#e18b4d" opacity=".7"><circle cx="130" cy="115" r="16"/><circle cx="970" cy="115" r="16"/><circle cx="130" cy="505" r="16"/><circle cx="970" cy="505" r="16"/></g>
      <g transform="translate(550 370)" shapeRendering="crispEdges"><ellipse cy="38" rx="65" ry="17" fill="#080a10" opacity=".8"/><path d="M-28-50h56v85h-56z" fill="#53636a"/><path d="M-23-84h46v40h-46z" fill="#c59d78"/><path d="M-28-92h56v13h-56z" fill="#49342d"/><path d="M-22 32h19v30h-19zM4 32h19v30H4z" fill="#38313a"/><text y="94" textAnchor="middle" fill="#f0d2a8" fontSize="20">THE WAYFARER</text></g>
      {enemies.map((enemy, index) => <g key={enemy.id} transform={`translate(${index === 0 ? 365 : 735} 150) scale(.48)`}>
        <EnemyFigure enemy={{ ...enemy, x: 0 }} selected={false} />
      </g>)}
      <path d="M550 315L365 270M550 315L735 270" stroke="#d6a66e" strokeDasharray="8 8" strokeWidth="3" opacity=".5"/>
    </svg>
    <div className="scene-vignette"/>
    <div className="enemy-intents">{enemies.filter(e => e.hp > 0).map(e => <div key={e.id} className="intent"><span className="intent-dot"/><span>{e.name}</span><b>{e.intent}</b><small>{e.intentTarget}{e.interruptible ? " · INTERRUPTIBLE" : ""}</small></div>)}</div>
    {exits.length > 0 ? <div className="cast-exits" aria-label="Available paths">{voteStatus ? <div className="path-vote-status" role="timer"><strong>PARTY PATH VOTE</strong><b>{voteStatus.remainingSeconds}s</b><small>{voteStatus.submittedCount}/{voteStatus.eligibleCount} VOTED · TIES RANDOM</small><div className="path-vote-progress"><i style={{ width: voteStatus.progressPercent + "%" }} /></div></div> : null}{exits.map((exit, index) => <div key={exit.id} className={"cast-exit cast-exit-" + (exits.length === 1 ? "center" : index === 0 ? "left" : "right")}><span>{exits.length === 1 ? "↑" : index === 0 ? "↖" : "↗"}</span><strong>{exit.label}</strong><small>{voteStatus ? (voteStatus.voteCounts[exit.id] || 0)+" VOTES" : "AVAILABLE PATH"}</small></div>)}</div> : null}
    <div className="scene-location"><span>◆</span> {room.name.toUpperCase()} <i>·</i> SPECTATOR CAMERA</div>
    <div className="cast-overlay"><strong>THE FORGOTTEN CATACOMBS</strong><span>FLOOR {room.floor} · SOLO RUN</span><div className="cast-health">WAYFARER <Bar value={playerHp} max={playerMaxHp}/><b>{playerHp}/{playerMaxHp}</b></div></div>
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

  const spectator = Boolean(spectatorAccess);
  const roomId = spectatorAccess?.roomId || session?.roomId;
  const token = spectatorAccess?.token || session?.playerToken;
  const run = snapshot?.run;
  const serverRoom = run?.rooms[run.currentRoomId];
  const roomIdForView = serverRoom ? visualRoomId(serverRoom.id) : "watcher-hall";
  const room: Room = { ...rooms[roomIdForView], name: serverRoom?.name || rooms[roomIdForView].name, description: serverRoom?.description || rooms[roomIdForView].description };
  const enemies = (serverRoom?.encounter?.enemies || []).map((enemy, index, all) => visualEnemy(enemy, index, all.length, snapshot?.playerIds ?? []));
  const playerId = session?.playerId || snapshot?.ownerPlayerId || snapshot?.playerIds[0];
  const player = playerId ? run?.players[playerId] : undefined;
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
  const availableExits = exploring ? exits.map(exit => ({ ...exit, destination: visualRoomId(exit.destination) })) : [];
  const spectatorLink = session?.spectatorToken ? window.location.origin + window.location.pathname + "#spectate=" + encodeURIComponent(session.roomId + ":" + session.spectatorToken) : "";
  const audio = useGameAudio(roomIdForView, run?.phase ?? "lobby", playerHp, enemies.map(enemy => ({ id: enemy.id, hp: enemy.hp })), run?.lastCombatEvents ?? [], snapshot?.version ?? 0);

  useEffect(() => {
    if (!(run?.phase === "combat" && run.combatRound) && !(run?.phase === "exploring" && run.navigationVote)) return;
    setClockNow(Date.now());
    const timer = window.setInterval(() => setClockNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [run?.phase, run?.combatRound?.number, run?.combatRound?.deadline, run?.navigationVote?.deadline]);

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


  async function selectArchetype(archetype: string) {
    if (!session || busy || run) return;
    setBusy(true); setError("");
    try {
      const next = await apiRequest<ApiRoom>("/rooms/" + session.roomId + "/archetype", session.playerToken, { method: "POST", body: JSON.stringify({ archetype }) });
      setSnapshot(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not select archetype");
    } finally { setBusy(false); }
  }

  async function chooseTalent(talentId: string) {
    if (!session || busy || spectator) return;
    setBusy(true); setError("");
    try {
      const next = await apiRequest<ApiRoom>("/rooms/" + session.roomId + "/talents", session.playerToken, { method: "POST", body: JSON.stringify({ talentId }) });
      setSnapshot(next);
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

  async function sendCommand(command: { type: string; round?: number; action?: string; targetId?: string; exitId?: string }) {
    if (!session || busy) return;
    setBusy(true); setError("");
    try {
      const next = await apiRequest<ApiRoom>("/rooms/" + session.roomId + "/commands", session.playerToken, { method: "POST", body: JSON.stringify(command) });
      setSnapshot(next);
      if (command.type === "choose_exit" && next.run?.navigationVote?.votes?.[session.playerId]) setMessage("Path vote submitted. Waiting for the party…");
      else if (command.type === "choose_exit" && next.run?.currentRoomId !== run?.currentRoomId) setMessage("The party enters the next chamber.");
      else if (command.type === "choose_exit") setMessage("Path vote submitted.");
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
    return <main className="game-screen">
      <header className="game-topline"><a className="game-brand" href="#" aria-label="Heart of the Beast"><span>H</span> HEART OF THE BEAST</a><div className="run-status"><i/> LOCAL DEVELOPMENT</div></header>
      <section style={{ maxWidth: 760, margin: "10vh auto", padding: 32, background: "#171923", border: "1px solid #625246", color: "#f1e5d5" }}>
        <p style={{ letterSpacing: ".18em", color: "#d8a76e" }}>THE FORGOTTEN CATACOMBS</p>
        <h1 style={{ fontSize: 34, margin: "12px 0" }}>Gather your party</h1>
        <p style={{ lineHeight: 1.6, color: "#c7b9a8" }}>Create a room and invite up to three friends, or join an existing lobby with its six-character code. No account required.</p>
        <button className="turn-button" onClick={() => void createRun()} disabled={busy}>{busy ? "CREATING ROOM…" : "CREATE ROOM"} <span>↗</span></button>
        <div style={{ margin: "28px 0", borderTop: "1px solid #51463e" }}/>
        <label htmlFor="join-code" style={{ display: "block", color: "#d8a76e", letterSpacing: ".12em", marginBottom: 10 }}>JOIN A PARTY</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
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
    return <main className="game-screen">
      <header className="game-topline"><a className="game-brand" href="#"><span>H</span> HEART OF THE BEAST</a><div className="run-status"><i/> PARTY LOBBY</div></header>
      <section style={{ maxWidth: 760, margin: "8vh auto", padding: 32, background: "#171923", border: "1px solid #625246", color: "#f1e5d5" }}>
        <p style={{ letterSpacing: ".18em", color: "#d8a76e" }}>ROOM {snapshot.code}</p>
        <h1 style={{ fontSize: 34, margin: "12px 0" }}>The party is gathering</h1>
        <p style={{ color: "#c7b9a8" }}>Share this code with friends. Up to four players can join before the host starts the run.</p>
        <div style={{ padding: 18, margin: "20px 0", background: "#0f1118", border: "1px solid #625246", fontSize: 30, letterSpacing: ".28em", textAlign: "center" }}>{snapshot.code}</div>
        <h2 style={{ fontSize: 18 }}>Adventurers ({snapshot.playerIds.filter(id => snapshot.presence?.[id]?.status !== "left").length}/4)</h2>
        <ul style={{ lineHeight: 2, color: "#d8c8b7" }}>{snapshot.playerIds.map((id, index) => <li key={id}>{id === snapshot.ownerPlayerId ? "HOST" : "PLAYER"} {index + 1} · {archetypeName(snapshot.playerArchetypes?.[id])} · {snapshot.presence?.[id]?.status?.toUpperCase() || "UNKNOWN"} {session?.playerId === id ? "· YOU" : ""}</li>)}</ul>
        <div className="archetype-picker">
          <div className="progression-eyebrow">CHOOSE YOUR RUN ARCHETYPE</div>
          <p>Every archetype can finish the dungeon alone. Your talents will shape it as you level.</p>
          <div className="archetype-grid">{archetypes.map(item => <button key={item.id} className={"archetype-choice" + ((snapshot.playerArchetypes?.[session?.playerId || ""] || "vanguard") === item.id ? " selected" : "")} onClick={() => void selectArchetype(item.id)} disabled={busy || !session}><strong>{item.name}</strong><span>{item.description}</span></button>)}</div>
        </div>
        {isHost ? <button className="turn-button" onClick={() => void startRun()} disabled={busy}>{busy ? "STARTING…" : "START RUN"} <span>↗</span></button> : <p role="status" style={{ color: "#d8a76e" }}>Waiting for the host to start…</p>}
        <button className="turn-button" onClick={() => void leaveRoom()} disabled={busy}>LEAVE PARTY</button>
        {error ? <p role="alert" style={{ color: "#f08f7e" }}>{error}</p> : null}
      </section>
    </main>;
  }

  return <main className="game-screen">
    <header className="game-topline">
      <a className="game-brand" href="#" aria-label="Heart of the Beast"><span>H</span> HEART OF THE BEAST</a>
      <div className="run-status"><i/> {spectator ? "SPECTATING" : "SERVER-AUTHORITATIVE RUN"} <b>·</b> FLOOR {room.floor}</div>
      <AudioControls settings={audio.settings} onEnable={() => { void audio.enable(); }} onChange={audio.updateSettings} />
      {!spectator ? <div className="view-switch" aria-label="Presentation view"><button className={view === "player" ? "selected" : ""} onClick={() => setView("player")}>PLAYER</button><button className={view === "cast" ? "selected" : ""} onClick={() => setView("cast")}>SPECTATOR / CAST</button></div> : <div className="view-switch"><button className="selected">SPECTATOR / CAST</button></div>}
    </header>
    {!spectator && <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", flexWrap: "wrap", gap: 16, padding: "8px 24px" }}>{session?.spectatorToken ? <><a href={spectatorLink} target="_blank" rel="noreferrer" style={{ color: "#d8a76e" }}>OPEN SPECTATOR VIEW</a><button className="turn-button" onClick={shareSpectatorLink}>{shareCopied ? "SPECTATOR LINK COPIED" : "COPY SPECTATOR LINK"} <span>↗</span></button></> : null}<button className="turn-button" onClick={() => void leaveRoom()} disabled={busy}>LEAVE PARTY</button></div>}
    <section className="play-area">
      {view === "player" && !spectator
        ? <PlayerView enemies={enemies} target={livingTarget?.id || target} onTarget={setTarget} room={room} exits={availableExits} onNavigate={(exitId: string) => void sendCommand({ type: "choose_exit", exitId })} voteStatus={voteStatus} />
        : <CastView enemies={enemies} playerHp={playerHp} playerMaxHp={playerMaxHp} room={room} exits={availableExits} voteStatus={voteStatus} />}
      <div className="player-hud"><div className="hero-token">{(player?.archetype || "vanguard").slice(0, 1).toUpperCase()}</div><div className="hero-vitals"><div className="hero-name">ADVENTURER {snapshot.playerIds.indexOf(playerId || "") + 1} <span>LV {player?.level ?? 1} · {archetypeName(player?.archetype).toUpperCase()}</span></div><div className="hero-health"><Bar value={playerHp} max={playerMaxHp}/><strong>{playerHp}<i>/{playerMaxHp}</i></strong></div><div className="xp-label"><span>RUN XP</span><b>{player?.experience ?? 0} / {levelThresholds[player?.level ?? 1] ?? "MAX"}</b></div><div className="xp-track"><i style={{ width: (player ? xpProgress(player).percent : 0) + "%" }}/></div></div><div className="run-stats"><span>POW <b>{player?.stats?.power ?? 0}</b></span><span>FOC <b>{player?.stats?.focus ?? 0}</b></span><span>AGI <b>{player?.stats?.agility ?? 0}</b></span></div></div>
      {!spectator && exploring && player && (player.talentPoints > 0 || (player.talents?.length ?? 0) > 0) ? <section className="talent-panel">
        <div className="talent-panel-heading"><div><span className="progression-eyebrow">LEVEL {player.level} · {player.talentPoints > 0 ? "TALENT POINT AVAILABLE" : "YOUR RUN BUILD"}</span><h2>Shape your path</h2><p>{archetypeName(player.archetype)} talents · {player.talentPoints > 0 ? player.talentPoints + " point" + (player.talentPoints === 1 ? "" : "s") + " to spend" : "No unspent points"}</p></div><div className="talent-point-count">{player.talentPoints}</div></div>
        <div className="talent-grid">{talentChoices.filter(talent => talent.archetype === player.archetype).map(talent => {
          const chosen = player.talents?.includes(talent.id);
          const locked = player.level < talent.tier + 1 || Boolean(talent.requires && !player.talents?.includes(talent.requires));
          return <button key={talent.id} className={"talent-choice" + (chosen ? " chosen" : "")} onClick={() => void chooseTalent(talent.id)} disabled={busy || player.talentPoints <= 0 || chosen || locked}><span>{talent.tier === 1 ? "TIER I" : "TIER II"}</span><strong>{talent.name}</strong><small>{talent.description}</small>{chosen ? <i>LEARNED</i> : locked ? <i>LOCKED</i> : player.talentPoints > 0 ? <i>CHOOSE TALENT</i> : <i>NEED POINT</i>}</button>;
        })}</div>
      </section> : null}
      {view === "player" && !spectator
        ? <>{run.phase === "combat" ? <><div className="action-dock"><div className={"combat-timer" + (remainingSeconds <= 3 && remainingMs > 0 ? " combat-timer-urgent" : "") + (actionSubmitted ? " combat-timer-waiting" : "")} role="timer" aria-label={remainingMs > 0 ? remainingSeconds + " seconds remaining in combat round" : "Combat round resolving"}><div className="combat-timer-heading"><strong>{actionSubmitted ? "ACTION LOCKED · WAITING FOR PARTY" : remainingMs > 0 ? "TIME TO ACT" : "ROUND RESOLVING"}</strong><span>ROUND {run.combatRound?.number ?? 1} · {roundActionCount}/{livingPlayerCount} READY</span><b>{remainingMs > 0 ? remainingSeconds + "s" : "—"}</b></div><div className="combat-timer-track"><i style={{ width: roundTimePercent + "%" }} /></div></div>{actions.filter(action => action.id !== "interrupt" || Boolean(livingTarget?.interruptible)).map(action => <button key={action.id} className={"move-button move-" + action.id} onClick={() => play(action.id)} disabled={busy || actionSubmitted || remainingMs <= 0 || (!livingTarget && action.id === "strike") || (action.id === "interrupt" && !livingTarget?.interruptible)}><span className="move-glyph">{action.glyph}</span><span className="move-label">{action.label}<small>{action.hint}</small></span></button>)}</div></> : null}
          {gameOver ? <div className="action-dock"><button className="turn-button" onClick={() => { window.localStorage.removeItem(SESSION_KEY); setSession(null); setSnapshot(null); setMessage("Create another run."); }} >START ANOTHER RUN <span>↗</span></button></div> : null}
        </>
        : null}
      {gameOver ? <div className="event-message" role="status">{run.phase === "completed" ? "THE CATACOMBS ARE CLEARED — VICTORY" : "THE PARTY HAS FALLEN — RUN OVER"}</div> : null}
      <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 12, padding: "8px 16px", color: "#c7b9a8", fontSize: 12, letterSpacing: ".08em" }}>PARTY · {snapshot.playerIds.map((id, index) => <span key={id}>{id === snapshot.ownerPlayerId ? "HOST" : "PLAYER"} {index + 1}{id === playerId ? " (YOU)" : ""} · {snapshot.presence?.[id]?.status?.toUpperCase() || "UNKNOWN"}</span>)}</div>
      {error ? <div className="event-message" role="alert" style={{ color: "#f08f7e" }}>{error}</div> : null}
    </section>
    <footer className="game-foot"><span>THE FORGOTTEN CATACOMBS</span><span>{spectator ? "INDEPENDENT SPECTATOR · READ-ONLY" : view === "player" ? "PLAYER VIEW · SERVER-VALIDATED COMMANDS" : "SPECTATOR VIEW · READ-ONLY PRESENTATION"}</span></footer>
  </main>;
}
