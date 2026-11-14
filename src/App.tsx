import { useState } from "react";

type Action = "strike" | "bolt" | "guard";
type EnemyId = "scout" | "acolyte";

type Enemy = {
  id: EnemyId;
  name: string;
  title: string;
  hp: number;
  maxHp: number;
  intent: string;
  damage: number;
  kind: "scout" | "acolyte";
};

const initialEnemies: Enemy[] = [
  { id: "scout", name: "Crypt Stalker", title: "Bone scout", hp: 48, maxHp: 48, intent: "Raking claws", damage: 12, kind: "scout" },
  { id: "acolyte", name: "Ashen Acolyte", title: "Soul binder", hp: 62, maxHp: 62, intent: "Soul spark", damage: 9, kind: "acolyte" },
];

const actionDetails: Record<Action, { label: string; detail: string; damage: number }> = {
  strike: { label: "Quick strike", detail: "A reliable blade attack", damage: 24 },
  bolt: { label: "Ember bolt", detail: "A focused burst of fire", damage: 34 },
  guard: { label: "Brace", detail: "Reduce incoming damage this round", damage: 0 },
};

function HealthBar({ value, max, tone = "health" }: { value: number; max: number; tone?: "health" | "enemy" }) {
  const percent = Math.max(0, (value / max) * 100);
  return (
    <div className={`health-track ${tone}`} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={tone === "health" ? "Health" : "Enemy health"}>
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}

function RoomScene({ enemies, selectedTarget, onTarget }: { enemies: Enemy[]; selectedTarget: EnemyId; onTarget: (id: EnemyId) => void }) {
  return (
    <div className="scene-wrap">
      <svg className="room-scene" viewBox="0 0 960 510" role="img" aria-label="Pixel-art catacomb chamber. Your adventurer faces two undead enemies across a torchlit stone floor." preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="wall" x2="0" y2="1"><stop stopColor="#34303a"/><stop offset="1" stopColor="#171a22"/></linearGradient>
          <linearGradient id="floor" x2="0" y2="1"><stop stopColor="#51443e"/><stop offset="1" stopColor="#211f25"/></linearGradient>
          <radialGradient id="torchGlow"><stop stopColor="#e69a4c" stopOpacity=".52"/><stop offset="1" stopColor="#e69a4c" stopOpacity="0"/></radialGradient>
          <filter id="softGlow"><feGaussianBlur stdDeviation="14"/></filter>
        </defs>
        <rect width="960" height="510" fill="#11141b"/>
        <path d="M0 0H960V330L480 265 0 330Z" fill="url(#wall)"/>
        <path d="M0 330L480 265 960 330V510H0Z" fill="url(#floor)"/>
        <path d="M0 330L480 265 960 330" fill="none" stroke="#746052" strokeWidth="5"/>
        <ellipse cx="175" cy="174" rx="155" ry="120" fill="url(#torchGlow)" filter="url(#softGlow)"/>
        <ellipse cx="790" cy="170" rx="155" ry="120" fill="url(#torchGlow)" filter="url(#softGlow)"/>
        <g opacity=".72" fill="#161820" stroke="#62534b" strokeWidth="8">
          <path d="M82 52H174V330H82Z"/><path d="M786 52H878V330H786Z"/>
          <path d="M64 50H192V78H64Z"/><path d="M768 50H896V78H768Z"/>
        </g>
        <g fill="#a36d3f">
          <rect x="118" y="112" width="18" height="42"/><rect x="822" y="112" width="18" height="42"/>
        </g>
        <g fill="#ffc16a">
          <path d="M127 94l-13 25h26Z"/><path d="M831 94l-13 25h26Z"/>
        </g>
        <g opacity=".22" stroke="#b99b7d" strokeWidth="2">
          {Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${i * 120 - 20} 345L${i * 120 + 80} 510`} />)}
          <path d="M0 390L960 390M0 448L960 448"/>
        </g>
        <g opacity=".35" fill="#b49a7b">
          <rect x="340" y="110" width="280" height="12"/><rect x="370" y="140" width="220" height="7"/>
        </g>
        <g transform="translate(470 62)">
          <path d="M0 0h20v20H0zM20 0h20v20H20zM40 0h20v20H40z" fill="#6d3032"/>
          <path d="M20 20h20v20H20zM40 20h20v20H40z" fill="#a94a3c"/>
          <path d="M20 40h20v20H20z" fill="#d27b4c"/>
        </g>
        <g transform="translate(235 285)">
          <ellipse cx="0" cy="112" rx="58" ry="13" fill="#0c0e13" opacity=".65"/>
          <g shapeRendering="crispEdges">
            <rect x="-18" y="20" width="36" height="52" fill="#344b54"/>
            <rect x="-25" y="28" width="12" height="42" fill="#58717a"/><rect x="13" y="28" width="12" height="42" fill="#58717a"/>
            <rect x="-17" y="4" width="34" height="26" fill="#d7a878"/>
            <rect x="-22" y="-1" width="44" height="13" fill="#4d332b"/>
            <rect x="-22" y="12" width="9" height="14" fill="#4d332b"/><rect x="13" y="12" width="9" height="14" fill="#4d332b"/>
            <rect x="-12" y="13" width="5" height="5" fill="#24212a"/><rect x="7" y="13" width="5" height="5" fill="#24212a"/>
            <rect x="-18" y="70" width="15" height="34" fill="#463b39"/><rect x="3" y="70" width="15" height="34" fill="#463b39"/>
            <rect x="-23" y="100" width="22" height="10" fill="#24232a"/><rect x="1" y="100" width="22" height="10" fill="#24232a"/>
            <rect x="22" y="30" width="8" height="62" fill="#a8a0a0"/><path d="M18 27l8-15 8 15Z" fill="#d8d1c5"/>
            <rect x="-34" y="36" width="10" height="10" fill="#b7a08a"/>
          </g>
        </g>
        {enemies.map((enemy, index) => {
          const x = index === 0 ? 640 : 790;
          const dead = enemy.hp <= 0;
          return (
            <g key={enemy.id} transform={`translate(${x} 300)`} opacity={dead ? .22 : 1} onClick={() => !dead && onTarget(enemy.id)} className={!dead ? "scene-target" : ""}>
              <ellipse cx="0" cy="105" rx="47" ry="11" fill="#0c0e13" opacity=".65"/>
              {selectedTarget === enemy.id && !dead && <ellipse cx="0" cy="58" rx="57" ry="70" fill="none" stroke="#e5b56b" strokeWidth="3" strokeDasharray="7 6"/>}
              {enemy.kind === "scout" ? (
                <g shapeRendering="crispEdges">
                  <rect x="-20" y="25" width="40" height="55" fill="#777b79"/>
                  <rect x="-28" y="33" width="12" height="39" fill="#a6aaa0"/><rect x="16" y="33" width="12" height="39" fill="#a6aaa0"/>
                  <rect x="-20" y="2" width="40" height="31" fill="#c2c0ad"/>
                  <rect x="-25" y="-5" width="50" height="12" fill="#8e958f"/>
                  <rect x="-13" y="13" width="8" height="7" fill="#d77b54"/><rect x="6" y="13" width="8" height="7" fill="#d77b54"/>
                  <rect x="-18" y="80" width="14" height="22" fill="#686d6b"/><rect x="4" y="80" width="14" height="22" fill="#686d6b"/>
                  <path d="M-26 28l-20 22 8 8 24-18M26 28l20 22-8 8-24-18" fill="#c2c0ad"/>
                </g>
              ) : (
                <g shapeRendering="crispEdges">
                  <path d="M-24 22h48v65h-48z" fill="#453c50"/><path d="M-30 30h10v45h-10zM20 30h10v45h-10z" fill="#75627e"/>
                  <path d="M-20 2h40v32h-40z" fill="#b7a3a0"/><path d="M-25 0h50v10h-50z" fill="#443748"/>
                  <rect x="-12" y="14" width="7" height="7" fill="#9fe0d4"/><rect x="6" y="14" width="7" height="7" fill="#9fe0d4"/>
                  <path d="M-18 87h14v17h-14zM4 87h14v17H4z" fill="#453c50"/>
                  <path d="M0 42l-10 20h20z" fill="#9fe0d4" opacity=".9"/>
                  <path d="M-34 38l-14 30 8 4 19-25M34 38l14 30-8 4-19-25" fill="#b7a3a0"/>
                </g>
              )}
              <rect x="-38" y="-30" width="76" height="8" fill="#171820" stroke="#a18c77" strokeWidth="1"/>
              <rect x="-36" y="-28" width={Math.max(0, 72 * enemy.hp / enemy.maxHp)} height="4" fill="#b95d50"/>
              <text x="0" y="-39" textAnchor="middle" fill="#e8ddca" fontSize="13" fontWeight="700">{enemy.name}</text>
            </g>
          );
        })}
        <rect x="22" y="22" width="174" height="30" rx="4" fill="#151821" opacity=".82" stroke="#63574e"/>
        <text x="36" y="42" fill="#d9c5a7" fontSize="13" letterSpacing="2">CATACOMB · 01</text>
      </svg>
      <div className="scene-caption"><span>THE FORGOTTEN CATACOMBS</span><span>CHAMBER 01 · THE WATCHER'S HALL</span></div>
    </div>
  );
}

export default function App() {
  const [enemies, setEnemies] = useState<Enemy[]>(initialEnemies);
  const [playerHp, setPlayerHp] = useState(100);
  const [action, setAction] = useState<Action>("strike");
  const [target, setTarget] = useState<EnemyId>("scout");
  const [round, setRound] = useState(1);
  const [log, setLog] = useState<string[]>(["The Crypt Stalker and Ashen Acolyte emerge from the gloom.", "Both enemies are watching your next move."]);
  const defeated = enemies.every((enemy) => enemy.hp <= 0);
  const gameOver = playerHp <= 0 || defeated;
  const livingTarget = enemies.find((enemy) => enemy.id === target && enemy.hp > 0) ?? enemies.find((enemy) => enemy.hp > 0);

  function resolveRound() {
    if (gameOver) return;
    let nextEnemies = enemies.map((enemy) => ({ ...enemy }));
    let nextPlayerHp = playerHp;
    const events: string[] = [];

    if (action === "guard") {
      events.push("You brace behind your shield. Incoming damage is reduced.");
    } else if (livingTarget) {
      const damage = actionDetails[action].damage;
      const updated = nextEnemies.find((enemy) => enemy.id === livingTarget.id)!;
      updated.hp = Math.max(0, updated.hp - damage);
      events.push(`You use ${actionDetails[action].label.toLowerCase()} on the ${updated.name} for ${damage} damage.`);
      if (updated.hp === 0) events.push(`The ${updated.name} collapses into the dust.`);
    }

    for (const enemy of nextEnemies) {
      if (enemy.hp <= 0) continue;
      const damage = action === "guard" ? Math.ceil(enemy.damage / 2) : enemy.damage;
      nextPlayerHp = Math.max(0, nextPlayerHp - damage);
      events.push(`${enemy.name} uses ${enemy.intent.toLowerCase()} for ${damage} damage.`);
    }

    setEnemies(nextEnemies);
    setPlayerHp(nextPlayerHp);
    setRound((value) => value + 1);
    setLog((current) => [...events, ...current].slice(0, 5));
    const nextLiving = nextEnemies.find((enemy) => enemy.hp > 0);
    if (nextLiving) setTarget(nextLiving.id);
  }

  function resetEncounter() {
    setEnemies(initialEnemies.map((enemy) => ({ ...enemy })));
    setPlayerHp(100);
    setAction("strike");
    setTarget("scout");
    setRound(1);
    setLog(["The Crypt Stalker and Ashen Acolyte emerge from the gloom.", "Both enemies are watching your next move."]);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Heart of the Beast home"><span className="brand-mark">H</span><span>HEART <i>OF THE</i> BEAST</span></a>
        <div className="topbar-right"><span className="prototype-tag">PLAYTEST BUILD 001</span><span className="connection"><i /> LOCAL SESSION</span></div>
      </header>

      <section className="game-heading">
        <div><p className="eyebrow">THE FORGOTTEN CATACOMBS</p><h1>The Watcher's Hall</h1><p className="subheading">A cold draft slips between the old stones. Something stirs beyond the torchlight.</p></div>
        <div className="run-meta"><span>SOLO EXPEDITION</span><strong>LEVEL 01 <b> / </b> 01</strong></div>
      </section>

      <section className="game-layout">
        <div className="main-column">
          <RoomScene enemies={enemies} selectedTarget={livingTarget?.id ?? target} onTarget={(id) => setTarget(id)} />
          <section className="combat-panel">
            <div className="section-heading"><div><p className="eyebrow">ENCOUNTER</p><h2>Choose your action</h2></div><span className="round-pill">ROUND {round}</span></div>
            <div className="action-grid" role="group" aria-label="Choose a combat action">
              {(["strike", "bolt", "guard"] as Action[]).map((key) => (
                <button key={key} className={`action-card ${action === key ? "selected" : ""}`} onClick={() => setAction(key)} aria-pressed={action === key} disabled={gameOver}>
                  <span className={`action-icon ${key}`}>{key === "strike" ? "⚔" : key === "bolt" ? "✦" : "⬟"}</span>
                  <span className="action-copy"><strong>{actionDetails[key].label}</strong><small>{actionDetails[key].detail}</small></span>
                  <span className="action-value">{key === "guard" ? "½ DMG" : `${actionDetails[key].damage} DMG`}</span>
                </button>
              ))}
            </div>
            {action !== "guard" && (
              <div className="target-row"><span className="target-label">TARGET</span>{enemies.map((enemy) => <button key={enemy.id} className={`target-chip ${target === enemy.id ? "active" : ""}`} disabled={enemy.hp <= 0 || gameOver} onClick={() => setTarget(enemy.id)}>{enemy.name}<span>{enemy.hp <= 0 ? "DEFEATED" : `${enemy.hp} HP`}</span></button>)}</div>
            )}
            <div className="resolve-row"><p>{gameOver ? (defeated ? "The hall falls silent. You survived." : "You have fallen. The catacombs claim another.") : action === "guard" ? "Brace for the enemies' attacks." : `Strike the ${livingTarget?.name ?? "remaining enemy"} before it can act.`}</p><button className="resolve-button" onClick={gameOver ? resetEncounter : resolveRound}>{gameOver ? "PLAY AGAIN" : "RESOLVE TURN"} <span>→</span></button></div>
          </section>
        </div>

        <aside className="side-column">
          <section className="character-card">
            <div className="card-topline"><span className="eyebrow">YOUR ADVENTURER</span><span className="level-chip">LVL 1</span></div>
            <div className="character-row"><div className="portrait"><span>✦</span><b>V</b></div><div><h2>The Wayfarer</h2><p>Vanguard · Human</p></div></div>
            <div className="stat-line"><span>HEALTH</span><strong>{playerHp} <i>/ 100</i></strong></div>
            <HealthBar value={playerHp} max={100} />
            <div className="character-stats"><div><span>POWER</span><b>12</b></div><div><span>ARMOR</span><b>4</b></div><div><span>FOCUS</span><b>8</b></div></div>
          </section>

          <section className="enemy-card">
            <div className="section-heading compact"><div><p className="eyebrow">THREATS</p><h2>Enemy intent</h2></div><span className="threat-count">{enemies.filter((enemy) => enemy.hp > 0).length} ACTIVE</span></div>
            {enemies.map((enemy) => <div className={`enemy-row ${enemy.hp <= 0 ? "is-dead" : ""}`} key={enemy.id}><div className={`enemy-token ${enemy.kind}`}>{enemy.kind === "scout" ? "☠" : "✧"}</div><div className="enemy-info"><strong>{enemy.name}</strong><span>{enemy.hp > 0 ? enemy.intent : "Defeated"}</span><HealthBar value={enemy.hp} max={enemy.maxHp} tone="enemy" /></div><b className="enemy-hp">{enemy.hp}<i>/{enemy.maxHp}</i></b></div>)}
          </section>

          <section className="combat-log">
            <div className="section-heading compact"><div><p className="eyebrow">BATTLE RECORD</p><h2>What's happening</h2></div></div>
            <ol>{log.map((entry, index) => <li key={`${round}-${index}`} className={index === 0 ? "latest" : ""}>{entry}</li>)}</ol>
          </section>
          <p className="prototype-note">PROTOTYPE · COMBAT IS A LOCAL SIMULATION. NO GAME SERVER CONNECTED.</p>
        </aside>
      </section>
      <footer className="footer"><span>HEART OF THE BEAST</span><span>ONE ADVENTURER. ONE MORE CHANCE.</span></footer>
    </main>
  );
}
