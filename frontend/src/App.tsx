import { useEffect, useState } from "react";

type Action = "strike" | "guard";
type View = "player" | "cast";
type Enemy = { id: string; name: string; hp: number; maxHp: number; intent: string; damage: number; x: number };
const initialEnemies: Enemy[] = [
  { id: "scout", name: "Crypt Stalker", hp: 48, maxHp: 48, intent: "Claw rake", damage: 12, x: 430 },
  { id: "acolyte", name: "Ashen Acolyte", hp: 62, maxHp: 62, intent: "Soul spark", damage: 9, x: 670 },
];
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
  { id: "guard", label: "Defend", hint: "Recover 1 health", glyph: "⬟" },
];

type ApiEnemy = { id: string; name: string; health: number; maxHealth: number };
type ApiExit = { id: string; destination: string; label: string };
type ApiDungeonRoom = { id: string; name: string; description: string; exits: ApiExit[]; encounter?: { status: string; enemies: ApiEnemy[] }; cleared: boolean };
type ApiPlayer = { id: string; health: number; maxHealth: number };
type ApiRun = { id: string; phase: "lobby" | "combat" | "exploring" | "completed"; currentRoomId: string; rooms: Record<string, ApiDungeonRoom>; players: Record<string, ApiPlayer> };
type ApiRoom = { id: string; code: string; ownerPlayerId: string; playerIds: string[]; run?: ApiRun; version: number };
type PlayerSession = { roomId: string; playerToken: string; spectatorToken: string };
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
  if (id === "warden") return "warden-gate";
  return "watcher-hall";
}

function visualEnemy(enemy: ApiEnemy, index: number, count: number): Enemy {
  return { id: enemy.id, name: enemy.name, hp: enemy.health, maxHp: enemy.maxHealth, intent: "Threatens the wayfarer", damage: 0, x: count === 1 ? 550 : index === 0 ? 430 : 670 };
}


function Bar({ value, max }: { value: number; max: number }) {
  return <span className="bar"><i style={{ width: (Math.max(0, value) / max * 100) + "%" }} /></span>;
}

function EnemyFigure({ enemy, selected, onClick }: { enemy: Enemy; selected: boolean; onClick?: () => void }) {
  const dead = enemy.hp <= 0;
  return <g transform={`translate(${enemy.x} 0)`} opacity={dead ? .18 : 1} onClick={onClick} className={onClick && !dead ? "enemy-sprite" : ""}>
    {selected && !dead ? <ellipse cx="0" cy="448" rx="92" ry="15" fill="none" stroke="#e9bd80" strokeWidth="4" strokeDasharray="9 7" /> : null}
    <ellipse cx="0" cy="454" rx="62" ry="14" fill="#080a10" opacity=".8" />
    {enemy.id === "scout" ? <g shapeRendering="crispEdges">
      <path d="M-43 280h86v145h-86z" fill="#737d7b"/><path d="M-52 302h18v100h-18zM34 302h18v100H34z" fill="#a5aaa0"/>
      <path d="M-39 226h78v70h-78z" fill="#c4c4b3"/><path d="M-48 215h96v22h-96z" fill="#858f8a"/>
      <path d="M-24 252h13v13h-13zM11 252h13v13H11z" fill="#e58b5c"/>
      <path d="M-34 420h27v34h-27zM7 420h27v34H7z" fill="#555d5b"/>
      <path d="M-50 310l-55 91 17 12 65-72M50 310l55 91-17 12-65-72" fill="#c0c1b4"/>
    </g> : <g shapeRendering="crispEdges">
      <path d="M-48 285h96v145h-96z" fill="#453d52"/><path d="M-58 310h20v100h-20zM38 310h20v100H38z" fill="#786583"/>
      <path d="M-42 228h84v72h-84z" fill="#b9aaa4"/><path d="M-53 216h106v22h-106z" fill="#453747"/>
      <path d="M-24 250h13v13h-13zM11 250h13v13H11z" fill="#a5e4d9"/>
      <path d="M-34 425h27v30h-27zM7 425h27v30H7z" fill="#41384d"/>
      <path d="M0 295l-25 75h50z" fill="#a5e4d9" opacity=".8"/>
      <path d="M-55 315l-42 82 16 12 55-65M55 315l42 82-16 12-55-65" fill="#b9aaa4"/>
    </g>}
    <g transform="translate(0 175)">
      <rect x="-74" y="0" width="148" height="26" rx="3" fill="#11151d" stroke={selected ? "#e7bd7e" : "#756b65"} strokeWidth="2"/>
      <rect x="-69" y="5" width={138 * enemy.hp / enemy.maxHp} height="16" fill="#b45e53"/>
      <text x="0" y="-13" textAnchor="middle" fill="#f1e5d5" fontSize="20" fontWeight="bold">{enemy.name}</text>
    </g>
  </g>;
}

function PlayerView({ enemies, target, onTarget, room, exits, onNavigate }: { enemies: Enemy[]; target: string; onTarget: (id: Enemy["id"]) => void; room: Room; exits: { id: string; destination: RoomId; label: string }[]; onNavigate: (id: string) => void }) {
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
    {exits.length > 0 ? <div className="scene-exits" aria-label="Available paths">{exits.map((exit,index)=><button key={exit} className={"scene-exit scene-exit-"+(exits.length===1?"center":index===0?"left":"right")} onClick={()=>onNavigate(exit)} aria-label={"Enter "+exit.label}><span className="exit-chevron">{exits.length===1?"↑":index===0?"↖":"↗"}</span><strong>{exit.label}</strong><small>ENTER PATH</small></button>)}</div> : null}\n    <div className="scene-vignette"/>
    <div className="scene-location"><span>◆</span> {room.name.toUpperCase()} <i>·</i> {room.floor}</div>
    <div className="enemy-intents">{enemies.filter(e=>e.hp>0).map(e=><button key={e.id} className={"intent "+(target===e.id?"intent-active":"")} onClick={()=>onTarget(e.id)}><span className="intent-dot"/><span>{e.name}</span><b>{e.intent}</b></button>)}</div>
    <div className="scene-hint">THE WAYFARER'S VIEW · {room.description.toUpperCase()}</div>
  </div>;
}

function CastView({ enemies, playerHp, playerMaxHp, room, exits }: { enemies: Enemy[]; playerHp: number; playerMaxHp: number; room: Room; exits: { id: string; destination: RoomId; label: string }[] }) {
  return <div className={"scene cast-scene room-" + room.id}>
    <svg className="scene-art" viewBox="0 0 1100 620" role="img" aria-label={"Cinematic elevated view of " + room.name}>
      <defs><linearGradient id="castfloor" x2="0" y2="1"><stop stopColor="#4b3d39"/><stop offset="1" stopColor="#171923"/></linearGradient><pattern id="casttiles" width="120" height="70" patternUnits="userSpaceOnUse"><path d="M2 2h56v30H2zM64 2h54v30H64zM2 38h56v30H2zM64 38h54v30H64z" fill="#9d8065" fillOpacity=".15" stroke="#171820" strokeWidth="4"/></pattern></defs>
      <rect width="1100" height="620" fill="#11131b"/><path d="M0 0H1100V620H0Z" fill="url(#castfloor)"/><path d="M0 0H1100V620H0Z" fill="url(#casttiles)"/>
      <path d="M0 0H1100V85H0zM0 535H1100V620H0z" fill="#0b0e16" opacity=".8"/>
      <path d="M120 90L980 90M120 530L980 530M120 90V530M980 90V530" stroke="#92765d" strokeWidth="12" opacity=".65"/>
      <g fill="#e18b4d" opacity=".7"><circle cx="130" cy="115" r="16"/><circle cx="970" cy="115" r="16"/><circle cx="130" cy="505" r="16"/><circle cx="970" cy="505" r="16"/></g>
      <g transform="translate(550 370)" shapeRendering="crispEdges"><ellipse cy="38" rx="65" ry="17" fill="#080a10" opacity=".8"/><path d="M-28-50h56v85h-56z" fill="#53636a"/><path d="M-23-84h46v40h-46z" fill="#c59d78"/><path d="M-28-92h56v13h-56z" fill="#49342d"/><path d="M-22 32h19v30h-19zM4 32h19v30H4z" fill="#38313a"/><text y="94" textAnchor="middle" fill="#f0d2a8" fontSize="20">THE WAYFARER</text></g>
      {enemies.map((e,i)=><g key={e.id} transform={`translate(${i===0?365:735} 210)`} opacity={e.hp<=0?.18:1} shapeRendering="crispEdges">
        <ellipse cy="44" rx="52" ry="13" fill="#080a10"/><path d="M-27-22h54v62h-54z" fill={i===0?"#737d7b":"#51445e"}/><path d="M-25-58h50v40h-50z" fill={i===0?"#c4c4b3":"#b9aaa4"}/><path d="M-13-42h8v8h-8zM7-42h8v8H7z" fill={i===0?"#e58b5c":"#a5e4d9"}/><text y="80" textAnchor="middle" fill="#eee0d0" fontSize="17">{e.name}</text><rect x="-42" y="91" width="84" height="9" fill="#29252c"/><rect x="-42" y="91" width={84*e.hp/e.maxHp} height="9" fill="#b45e53"/>
      </g>)}
      <path d="M550 315L365 270M550 315L735 270" stroke="#d6a66e" strokeDasharray="8 8" strokeWidth="3" opacity=".5"/>
    </svg>
    <div className="scene-vignette"/>
    {exits.length > 0 ? <div className="cast-exits" aria-label="Available paths">{exits.map((exit, index) => <div key={exit.id} className={"cast-exit cast-exit-" + (exits.length === 1 ? "center" : index === 0 ? "left" : "right")}><span>{exits.length === 1 ? "↑" : index === 0 ? "↖" : "↗"}</span><strong>{exit.label}</strong><small>AVAILABLE PATH</small></div>)}</div> : null}
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
  const [message, setMessage] = useState("Create a room to begin your run.");
  const [shareCopied, setShareCopied] = useState(false);

  const spectator = Boolean(spectatorAccess);
  const roomId = spectatorAccess?.roomId || session?.roomId;
  const token = spectatorAccess?.token || session?.playerToken;
  const run = snapshot?.run;
  const serverRoom = run?.rooms[run.currentRoomId];
  const roomIdForView = serverRoom ? visualRoomId(serverRoom.id) : "watcher-hall";
  const room = rooms[roomIdForView];
  const enemies = (serverRoom?.encounter?.enemies || []).map((enemy, index, all) => visualEnemy(enemy, index, all.length));
  const playerId = snapshot?.ownerPlayerId || snapshot?.playerIds[0];
  const player = playerId ? run?.players[playerId] : undefined;
  const playerHp = player?.health ?? 30;
  const playerMaxHp = player?.maxHealth ?? 30;
  const exits: ApiExit[] = serverRoom?.exits || [];
  const livingTarget = enemies.find(enemy => enemy.id === target && enemy.hp > 0) || enemies.find(enemy => enemy.hp > 0);
  const defeated = serverRoom?.cleared ?? false;
  const gameOver = run?.phase === "completed";
  const exploring = run?.phase === "exploring";

  useEffect(() => {
    if (!roomId || !token) return;
    let active = true;
    const load = async () => {
      try {
        const next = await apiRequest<ApiRoom>(spectator ? "/spectate/" + roomId : "/rooms/" + roomId, token);
        if (active) {
          setSnapshot(next);
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
    if (livingTarget && target !== livingTarget.id) setTarget(livingTarget.id);
  }, [livingTarget?.id, target]);

  async function createRun() {
    setBusy(true); setError("");
    try {
      const created = await apiRequest<{ room: ApiRoom; playerToken: string; spectatorToken: string }>("/rooms", undefined, { method: "POST" });
      const nextSession = { roomId: created.room.id, playerToken: created.playerToken, spectatorToken: created.spectatorToken };
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
      const started = await apiRequest<ApiRoom>("/rooms/" + nextSession.roomId + "/start", nextSession.playerToken, { method: "POST" });
      setSnapshot(started);
      setMessage("The run has begun. The server is now authoritative.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the run");
    } finally {
      setBusy(false);
    }
  }

  async function sendCommand(command: { type: string; action?: string; targetId?: string; exitId?: string }) {
    if (!session || busy) return;
    setBusy(true); setError("");
    try {
      const next = await apiRequest<ApiRoom>("/rooms/" + session.roomId + "/commands", session.playerToken, { method: "POST", body: JSON.stringify(command) });
      setSnapshot(next);
      setMessage(command.type === "choose_exit" ? "You enter the next chamber." : command.action === "defend" ? "You steady yourself and recover." : "Your attack strikes true.");
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
    if (action === "guard") void sendCommand({ type: "combat", action: "defend" });
    else if (livingTarget) void sendCommand({ type: "combat", action: "attack", targetId: livingTarget.id });
  }

  function shareSpectatorLink() {
    if (!session) return;
    const link = window.location.origin + window.location.pathname + "#spectate=" + encodeURIComponent(session.roomId + ":" + session.spectatorToken);
    void navigator.clipboard.writeText(link).then(() => setShareCopied(true)).catch(() => setError("Clipboard access was blocked. You can copy the spectator URL from the address bar after opening it."));
  }

  if (!roomId || !token) {
    return <main className="game-screen">
      <header className="game-topline"><a className="game-brand" href="#" aria-label="Heart of the Beast"><span>H</span> HEART OF THE BEAST</a><div className="run-status"><i/> LOCAL DEVELOPMENT</div></header>
      <section style={{ maxWidth: 680, margin: "12vh auto", padding: 32, background: "#171923", border: "1px solid #625246", color: "#f1e5d5" }}>
        <p style={{ letterSpacing: ".18em", color: "#d8a76e" }}>THE FORGOTTEN CATACOMBS</p>
        <h1 style={{ fontSize: 34, margin: "12px 0" }}>Begin a new run</h1>
        <p style={{ lineHeight: 1.6, color: "#c7b9a8" }}>Create a solo room backed by the Go game server and PostgreSQL. Your player view sends commands to the server; a separate spectator link opens a read-only cast view.</p>
        <button className="turn-button" onClick={() => void createRun()} disabled={busy}>{busy ? "CREATING ROOM…" : "CREATE SOLO RUN"} <span>↗</span></button>
        {error ? <p role="alert" style={{ color: "#f08f7e" }}>{error}</p> : null}
      </section>
    </main>;
  }

  if (!snapshot) {
    return <main className="game-screen"><header className="game-topline"><a className="game-brand" href="#"><span>H</span> HEART OF THE BEAST</a><div className="run-status"><i/> CONNECTING</div></header><p role="status" style={{ padding: 32, color: "#f1e5d5" }}>{error || "Connecting to the room…"}</p></main>;
  }

  if (!run || !serverRoom) {
    return <main className="game-screen"><p role="status" style={{ padding: 32, color: "#f1e5d5" }}>{spectator ? "The run has not started yet." : "The room is ready, but the run has not started."}</p>{error ? <p role="alert">{error}</p> : null}</main>;
  }

  return <main className="game-screen">
    <header className="game-topline">
      <a className="game-brand" href="#" aria-label="Heart of the Beast"><span>H</span> HEART OF THE BEAST</a>
      <div className="run-status"><i/> {spectator ? "SPECTATING" : "SERVER-AUTHORITATIVE RUN"} <b>·</b> FLOOR {room.floor}</div>
      {!spectator ? <div className="view-switch" aria-label="Presentation view"><button className={view === "player" ? "selected" : ""} onClick={() => setView("player")}>PLAYER</button><button className={view === "cast" ? "selected" : ""} onClick={() => setView("cast")}>SPECTATOR / CAST</button></div> : <div className="view-switch"><button className="selected">SPECTATOR / CAST</button></div>}
    </header>
    {!spectator && <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 24px" }}><button className="turn-button" onClick={shareSpectatorLink}>{shareCopied ? "SPECTATOR LINK COPIED" : "COPY SPECTATOR LINK"} <span>↗</span></button></div>}
    <section className="play-area">
      {view === "player" && !spectator
        ? <PlayerView enemies={enemies} target={livingTarget?.id || target} onTarget={setTarget} room={room} exits={exits.map(exit => ({ ...exit, destination: visualRoomId(exit.destination) }))} onNavigate={(exitId: string) => void sendCommand({ type: "choose_exit", exitId })} />
        : <CastView enemies={enemies} playerHp={playerHp} playerMaxHp={playerMaxHp} room={room} exits={exits.map(exit => ({ ...exit, destination: visualRoomId(exit.destination) }))} />}
      <div className="player-hud"><div className="hero-token">V</div><div className="hero-vitals"><div className="hero-name">THE WAYFARER <span>LV 01</span></div><div className="hero-health"><Bar value={playerHp} max={playerMaxHp}/><strong>{playerHp}<i>/{playerMaxHp}</i></strong></div></div><div className="round-indicator">STATE <b>{snapshot.version}</b></div></div>
      {view === "player" && !spectator
        ? <>{run.phase === "combat" ? <div className="action-dock">{actions.map(action => <button key={action.id} className={"move-button move-" + action.id} onClick={() => play(action.id)} disabled={busy || !livingTarget && action.id === "strike"}><span className="move-glyph">{action.glyph}</span><span className="move-label">{action.label}<small>{action.hint}</small></span></button>)}</div> : null}
          {exploring ? <div className="action-dock">{exits.map(exit => <button key={exit.id} className="move-button" onClick={() => void sendCommand({ type: "choose_exit", exitId: exit.id })} disabled={busy}><span className="move-glyph">↗</span><span className="move-label">{exit.label}<small>ENTER PATH</small></span></button>)}</div> : null}
          {gameOver ? <div className="action-dock"><button className="turn-button" onClick={() => { window.localStorage.removeItem(SESSION_KEY); setSession(null); setSnapshot(null); setMessage("Create another run."); }} >START ANOTHER RUN <span>↗</span></button></div> : null}
        </>
        : null}
      <div className="event-message" role="status">{gameOver ? "THE CATACOMBS ARE CLEARED — VICTORY" : message}</div>
      {error ? <div className="event-message" role="alert" style={{ color: "#f08f7e" }}>{error}</div> : null}
    </section>
    <footer className="game-foot"><span>THE FORGOTTEN CATACOMBS</span><span>{spectator ? "INDEPENDENT SPECTATOR · READ-ONLY" : view === "player" ? "PLAYER VIEW · SERVER-VALIDATED COMMANDS" : "SPECTATOR VIEW · READ-ONLY PRESENTATION"}</span></footer>
  </main>;
}
