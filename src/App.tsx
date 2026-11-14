import { useState } from "react";

type Action = "strike" | "bolt" | "guard";
type EnemyId = "scout" | "acolyte";
type Enemy = {
  id: EnemyId; name: string; hp: number; maxHp: number; intent: string;
  damage: number; kind: "scout" | "acolyte";
};

const initialEnemies: Enemy[] = [
  { id: "scout", name: "Crypt Stalker", hp: 48, maxHp: 48, intent: "Claw rake", damage: 12, kind: "scout" },
  { id: "acolyte", name: "Ashen Acolyte", hp: 62, maxHp: 62, intent: "Soul spark", damage: 9, kind: "acolyte" },
];
const actions: { id: Action; label: string; hint: string; damage: number; glyph: string }[] = [
  { id: "strike", label: "Strike", hint: "24 damage", damage: 24, glyph: "⚔" },
  { id: "bolt", label: "Ember", hint: "34 damage", damage: 34, glyph: "✦" },
  { id: "guard", label: "Brace", hint: "Half damage", damage: 0, glyph: "⬟" },
];

function Bar({ value, max, enemy = false }: { value: number; max: number; enemy?: boolean }) {
  return <span className={"bar" + (enemy ? " enemy-bar" : "")}><i style={{ width: (Math.max(0, value) / max * 100) + "%" }} /></span>;
}

function PixelScene({ enemies, target, onTarget }: { enemies: Enemy[]; target: EnemyId; onTarget: (id: EnemyId) => void }) {
  return (
    <div className="scene">
      <svg className="scene-art" viewBox="0 0 1100 660" role="img" aria-label="A torchlit pixel-art catacomb. Your wayfarer faces two undead creatures." preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="stonewall" x2="0" y2="1"><stop stopColor="#34303a"/><stop offset="1" stopColor="#171922"/></linearGradient>
          <linearGradient id="stonefloor" x2="0" y2="1"><stop stopColor="#655346"/><stop offset="1" stopColor="#28252a"/></linearGradient>
          <radialGradient id="warmth"><stop stopColor="#f6a34f" stopOpacity=".72"/><stop offset="1" stopColor="#d87536" stopOpacity="0"/></radialGradient>
          <pattern id="brick" width="112" height="64" patternUnits="userSpaceOnUse">
            <path d="M0 1H112M0 32H112M56 0V32M0 32V64" fill="none" stroke="#0e1118" strokeOpacity=".48" strokeWidth="5"/>
            <path d="M5 5H50M62 37H106" stroke="#aaa0a0" strokeOpacity=".08" strokeWidth="2"/>
          </pattern>
          <pattern id="flagstone" width="150" height="76" patternUnits="userSpaceOnUse">
            <path d="M2 2H72L80 36H10ZM82 3H148V37H88ZM10 42H78V73H3ZM86 43H146V72H84Z" fill="#87715e" fillOpacity=".12" stroke="#171820" strokeWidth="5"/>
            <path d="M18 10l22 2m60 0l30 1M20 51l30 1" stroke="#b9a18a" strokeOpacity=".14" strokeWidth="2"/>
          </pattern>
          <filter id="glow"><feGaussianBlur stdDeviation="20"/></filter>
        </defs>
        <rect width="1100" height="660" fill="#11131b"/>
        <path d="M0 0H1100V410L550 310 0 410Z" fill="url(#stonewall)"/>
        <path d="M0 0H1100V410L550 310 0 410Z" fill="url(#brick)" opacity=".85"/>
        <path d="M0 410L550 310 1100 410V660H0Z" fill="url(#stonefloor)"/>
        <path d="M0 410L550 310 1100 410V660H0Z" fill="url(#flagstone)"/>
        <path d="M0 410L550 310 1100 410" stroke="#9b8069" strokeOpacity=".45" strokeWidth="8" fill="none"/>
        <path d="M320 0V330Q550 240 780 330V0" fill="#10131b" opacity=".65"/>
        <path d="M350 0V305Q550 225 750 305V0" fill="#24232c" stroke="#655347" strokeWidth="12"/>
        <path d="M382 0V276Q550 210 718 276V0" fill="#11151d" stroke="#403a3a" strokeWidth="8"/>
        <g opacity=".45" fill="#b6a08a"><path d="M42 70h120v12H42zM42 90h84v5H42zM930 86h125v10H930zM970 105h85v5h-85z"/></g>
        <g>
          <ellipse cx="145" cy="220" rx="190" ry="175" fill="url(#warmth)" filter="url(#glow)"/>
          <ellipse cx="955" cy="220" rx="190" ry="175" fill="url(#warmth)" filter="url(#glow)"/>
          <path d="M116 172h16v-44h12v44h16v10h-44zM936 172h16v-44h12v44h16v10h-44z" fill="#4b3a32"/>
          <path d="M137 128l-12 28h24zM957 128l-12 28h24z" fill="#ffbd67"/>
          <rect x="132" y="151" width="10" height="22" fill="#e7783e"/><rect x="952" y="151" width="10" height="22" fill="#e7783e"/>
        </g>
        <g fill="#171922" opacity=".9">
          <path d="M0 350h65v60H0zM68 330h40v80H68zM1000 340h100v70h-100zM955 365h42v45h-42z"/>
          <path d="M180 394l18-35 18 35zM840 395l24-50 24 50z"/>
        </g>
        <g fill="#a18a73" opacity=".28">
          <path d="M55 475l28-7 16 10-22 8zM275 560l38-9 18 12-42 8zM865 485l24-10 20 8-28 10zM1010 590l30-12 18 10-34 12z"/>
        </g>
        <g transform="translate(245 0)" shapeRendering="crispEdges">
          <ellipse cx="0" cy="548" rx="68" ry="16" fill="#080a10" opacity=".7"/>
          <path d="M-30 390h60v112h-60z" fill="#354d58"/><path d="M-38 410h14v76h-14zM24 410h14v76H24z" fill="#607982"/>
          <path d="M-24 360h48v42h-48z" fill="#c59d78"/><path d="M-30 350h60v17h-60zM-27 365h10v29h-10zM17 365h10v29H17z" fill="#49342d"/>
          <path d="M-13 377h8v7h-8zM6 377h8v7H6z" fill="#211e24"/>
          <path d="M-25 500h21v42h-21zM4 500h21v42H4z" fill="#4b4140"/>
          <path d="M-31 540h29v12h-29zM2 540h30v12H2z" fill="#25232a"/>
          <path d="M29 414h9v113h-9zM23 405l11-20 11 20z" fill="#c7b8a1"/>
          <path d="M-40 420h12v20h-12z" fill="#a88e77"/>
          <path d="M-28 401h56" stroke="#9c795a" strokeWidth="5"/>
        </g>
        {enemies.map((enemy, index) => {
          const x = index === 0 ? 690 : 875;
          const dead = enemy.hp <= 0;
          return (
            <g key={enemy.id} transform={"translate(" + x + " 0)"} opacity={dead ? .18 : 1} className={!dead ? "enemy-sprite" : ""} onClick={() => !dead && onTarget(enemy.id)}>
              <ellipse cx="0" cy="548" rx="58" ry="14" fill="#080a10" opacity=".75"/>
              {target === enemy.id && !dead ? <path d="M-64 548l12-8 12 8 12-8 12 8 12-8 12 8 12-8 12 8" fill="none" stroke="#f2c17e" strokeWidth="4"/> : null}
              {enemy.kind === "scout" ? (
                <g shapeRendering="crispEdges">
                  <path d="M-28 397h56v115h-56z" fill="#747d7b"/><path d="M-36 418h14v65h-14zM22 418h14v65H22z" fill="#a5aaa0"/>
                  <path d="M-25 360h50v48h-50z" fill="#c4c4b3"/><path d="M-31 353h62v15h-62z" fill="#858f8a"/>
                  <path d="M-16 380h9v8h-9zM8 380h9v8H8z" fill="#e58b5c"/>
                  <path d="M-25 510h20v32h-20zM5 510h20v32H5z" fill="#555d5b"/>
                  <path d="M-30 540h28v12h-28zM2 540h30v12H2z" fill="#25262b"/>
                  <path d="M-35 421l-30 48 10 10 39-36M35 421l30 48-10 10-39-36" fill="#c0c1b4"/>
                </g>
              ) : (
                <g shapeRendering="crispEdges">
                  <path d="M-32 395h64v120h-64z" fill="#453d52"/><path d="M-40 420h14v75h-14zM26 420h14v75H26z" fill="#786583"/>
                  <path d="M-28 356h56v50h-56z" fill="#b9aaa4"/><path d="M-35 350h70v15h-70z" fill="#453747"/>
                  <path d="M-16 375h9v9h-9zM8 375h9v9H8z" fill="#a5e4d9"/>
                  <path d="M-22 515h18v29h-18zM4 515h18v29H4z" fill="#41384d"/>
                  <path d="M-28 540h28v12h-28zM2 540h28v12H2z" fill="#25232a"/>
                  <path d="M0 410l-15 42h30z" fill="#a5e4d9" opacity=".85"/>
                  <path d="M-38 425l-24 48 10 8 34-39M38 425l24 48-10 8-34-39" fill="#b9aaa4"/>
                </g>
              )}
              <g transform="translate(0 320)">
                <rect x="-54" y="0" width="108" height="24" rx="3" fill="#11151d" stroke={target === enemy.id ? "#e7bd7e" : "#756b65"} strokeWidth="2"/>
                <rect x="-50" y="4" width={100 * enemy.hp / enemy.maxHp} height="16" fill="#a9534b"/>
                <text x="0" y="-10" textAnchor="middle" fill="#f1e5d5" fontSize="17" fontWeight="bold">{enemy.name}</text>
              </g>
            </g>
          );
        })}
        <g opacity=".7" fill="#c6a987"><path d="M510 590h80v5h-80zM530 605h45v4h-45z"/></g>
      </svg>
      <div className="scene-vignette" />
      <div className="scene-location"><span className="location-mark">◆</span> THE WATCHER'S HALL <i>·</i> 01</div>
      <div className="enemy-intents">
        {enemies.filter(e => e.hp > 0).map(e => <button key={e.id} className={"intent " + (target === e.id ? "intent-active" : "")} onClick={() => onTarget(e.id)}><span className="intent-dot" />{e.name}<b>{e.intent}</b></button>)}
      </div>
      <div className="scene-hint">SELECT AN ENEMY · CHOOSE YOUR MOVE</div>
    </div>
  );
}

export default function App() {
  const [enemies, setEnemies] = useState<Enemy[]>(initialEnemies);
  const [playerHp, setPlayerHp] = useState(100);
  const [target, setTarget] = useState<EnemyId>("scout");
  const [round, setRound] = useState(1);
  const [message, setMessage] = useState("The dead stir in the torchlight.");
  const defeated = enemies.every(e => e.hp <= 0);
  const gameOver = playerHp <= 0 || defeated;
  const livingTarget = enemies.find(e => e.id === target && e.hp > 0) || enemies.find(e => e.hp > 0);

  function play(action: Action) {
    if (gameOver) return;
    const next = enemies.map(e => ({ ...e }));
    let hp = playerHp;
    const events: string[] = [];
    if (action === "guard") events.push("You brace behind your shield.");
    else if (livingTarget) {
      const damage = action === "strike" ? 24 : 34;
      const foe = next.find(e => e.id === livingTarget.id)!;
      foe.hp = Math.max(0, foe.hp - damage);
      events.push(foe.name + " takes " + damage + " damage.");
      if (foe.hp === 0) events.push(foe.name + " crumbles into dust.");
    }
    next.forEach(e => {
      if (e.hp > 0) {
        const incoming = action === "guard" ? Math.ceil(e.damage / 2) : e.damage;
        hp = Math.max(0, hp - incoming);
        events.push(e.name + " attacks for " + incoming + ".");
      }
    });
    setEnemies(next);
    setPlayerHp(hp);
    setRound(n => n + 1);
    setMessage(events.join("  ·  "));
    const nextTarget = next.find(e => e.hp > 0);
    if (nextTarget) setTarget(nextTarget.id);
  }

  function reset() {
    setEnemies(initialEnemies.map(e => ({ ...e })));
    setPlayerHp(100);
    setTarget("scout");
    setRound(1);
    setMessage("The dead stir in the torchlight.");
  }

  return (
    <main className="game-screen">
      <header className="game-topline">
        <a className="game-brand" href="#" aria-label="Heart of the Beast"><span>H</span> HEART OF THE BEAST</a>
        <div className="run-status"><i /> SOLO RUN <b>·</b> FLOOR 01</div>
        <button className="menu-button" aria-label="Open game menu" onClick={() => setMessage("The game menu will be added in a later prototype.")}>•••</button>
      </header>

      <section className="play-area">
        <PixelScene enemies={enemies} target={livingTarget?.id || target} onTarget={setTarget} />
        <div className="player-hud">
          <div className="hero-token">V</div>
          <div className="hero-vitals">
            <div className="hero-name">THE WAYFARER <span>LV 01</span></div>
            <div className="hero-health"><Bar value={playerHp} max={100} /><strong>{playerHp}<i>/100</i></strong></div>
          </div>
          <div className="round-indicator">ROUND <b>{round}</b></div>
        </div>
        <div className="action-dock">
          {actions.map(a => <button key={a.id} className={"move-button move-" + a.id} onClick={() => gameOver ? reset() : play(a.id)} disabled={gameOver && !defeated && a.id !== "strike"}>
            <span className="move-glyph">{a.glyph}</span><span className="move-label">{gameOver ? (defeated ? "Play again" : "Fallen") : a.label}<small>{gameOver ? (defeated ? "Restart encounter" : " ") : a.hint}</small></span>
          </button>)}
          <button className="turn-button" onClick={gameOver ? reset : () => play("strike")}>{gameOver ? "RESTART" : "QUICK STRIKE"} <span>↗</span></button>
        </div>
        <div className={"event-message" + (gameOver ? " event-final" : "")} role="status">{gameOver ? (defeated ? "THE HALL IS SILENT — VICTORY" : "YOU HAVE FALLEN") : message}</div>
      </section>
      <footer className="game-foot"><span>THE FORGOTTEN CATACOMBS</span><span>SELECT AN ENEMY IN THE SCENE TO CHANGE TARGET</span></footer>
    </main>
  );
}
