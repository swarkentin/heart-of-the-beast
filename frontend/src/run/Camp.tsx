// The camp between two floors of an expedition: a short mini-game for gold, then a shop and a look at what the
// next floor holds. Everything here is a view of server state; every move is a command.
import { useEffect, useState, type ReactNode } from "react";
import type { ApiCamp, ApiCommand, ApiFloorModifier, ApiMinigame, ApiMinigamePlay, ApiRun } from "../api";
import { Icon } from "../lobby";

type Send = (command: ApiCommand) => Promise<unknown> | void;

/** Gold and the floor's modifiers, shown above the command panel. Hover or focus a modifier to read its rule. */
export function FloorStatus({ gold, modifiers }: { gold?: number; modifiers: ApiFloorModifier[] }) {
  return <div className="rn-status">
    {gold !== undefined ? <span className="rn-gold" aria-label={gold + " gold"}>{gold} GOLD</span> : null}
    {modifiers.map(modifier => <span key={modifier.id} className={"rn-mod rn-mod-" + modifier.kind} title={modifier.description} tabIndex={0} aria-label={modifier.name + ": " + modifier.description}>{modifier.kind === "debuff" ? "▼ " : "▲ "}{modifier.name.toUpperCase()}</span>)}
  </div>;
}

const RUNES = ["sun", "moon", "star", "wave"];
const RUNE_STEP_MS = 800;

function Dice({ play, acting, busy, send }: { play: ApiMinigamePlay; acting: boolean; busy: boolean; send: Send }) {
  const rolls = play.rolls ?? [];
  return <>
    <div className="rn-game-row" aria-label="Dice rolled">{rolls.length === 0 ? <span className="px-label">NO DICE THROWN YET</span> : rolls.map((roll, index) => <span key={index} className={"rn-tile" + (roll === 1 ? " rn-tile-bad" : "")}>{roll}</span>)}<span className="rn-pot">POT {play.pot}</span></div>
    {acting && !play.done ? <div className="rn-game-row">
      <button className="px-button px-button-primary" onClick={() => void send({ type: "minigame", action: "roll" })} disabled={busy}>ROLL</button>
      <button className="px-button" onClick={() => void send({ type: "minigame", action: "bank" })} disabled={busy}>{play.pot > 0 ? "BANK " + play.pot + " GOLD" : "WALK AWAY"}</button>
    </div> : null}
  </>;
}

function Chests({ play, acting, busy, send }: { play: ApiMinigamePlay; acting: boolean; busy: boolean; send: Send }) {
  return <>
    <div className="rn-game-row">{(play.chests ?? []).map((chest, index) => chest < 0
      ? <button key={index} className="rn-tile" onClick={() => void send({ type: "minigame", action: "open", choiceId: String(index) })} disabled={!acting || busy || play.done} aria-label={"Open chest " + (index + 1)}>?</button>
      : <span key={index} className={"rn-tile " + (chest === 0 ? "rn-tile-bad" : "rn-tile-good")}>{chest === 0 ? "MIMIC" : "+" + chest}</span>)}<span className="rn-pot">POT {play.pot}</span></div>
    {acting && !play.done ? <div className="rn-game-row"><button className="px-button" onClick={() => void send({ type: "minigame", action: "bank" })} disabled={busy}>{play.pot > 0 ? "WALK AWAY WITH " + play.pot + " GOLD" : "WALK AWAY"}</button></div> : null}
  </>;
}

function Echo({ play, acting, busy, send }: { play: ApiMinigamePlay; acting: boolean; busy: boolean; send: Send }) {
  const sequence = play.sequence ?? [];
  // The pattern plays once, one rune at a time, then the stones go dark and the player repeats it from memory.
  const [shown, setShown] = useState(0);
  const [answer, setAnswer] = useState<string[]>([]);
  const watching = !play.done && shown <= sequence.length;
  useEffect(() => {
    if (!watching) return;
    const timer = window.setTimeout(() => setShown(value => value + 1), RUNE_STEP_MS);
    return () => window.clearTimeout(timer);
  }, [watching, shown]);
  const lit = watching && shown >= 1 ? sequence[shown - 1] : undefined;
  const press = (rune: string) => {
    const next = [...answer, rune];
    setAnswer(next);
    if (next.length === sequence.length) void send({ type: "minigame", action: "echo", choiceId: next.join(",") });
  };
  if (play.done) {
    return <div className="rn-game-row" aria-label="The pattern">{sequence.map((rune, index) => <span key={index} className={"rn-tile rn-rune-" + rune + (play.answer?.[index] === rune ? "" : " rn-tile-bad")}>{rune.toUpperCase()}</span>)}</div>;
  }
  return <>
    <p className="px-label" aria-live="polite">{watching ? "WATCH · " + Math.min(shown, sequence.length) + "/" + sequence.length : "REPEAT THE PATTERN · " + answer.length + "/" + sequence.length}</p>
    <div className="rn-game-row">{RUNES.map(rune => <button key={rune} className={"rn-tile rn-rune-" + rune + (lit === rune ? " rn-tile-lit" : "")} onClick={() => press(rune)} disabled={!acting || busy || watching || answer.length >= sequence.length}>{rune.toUpperCase()}</button>)}</div>
    {watching ? <span className="px-label" role="status">{lit ? lit.toUpperCase() : "…"}</span> : null}
  </>;
}

function Game({ game, selfId, acting, busy, send }: { game: ApiMinigame; selfId: string; acting: boolean; busy: boolean; send: Send }) {
  const play = game.players[selfId];
  const others = Object.values(game.players);
  if (!play) {
    return <p className="px-copy">The party is playing {game.name}. {others.filter(item => item.done).length}/{others.length} finished.</p>;
  }
  const props = { play, acting, busy, send };
  return <>
    <p className="px-copy">{game.rules}</p>
    {game.kind === "dice" ? <Dice {...props} /> : game.kind === "chests" ? <Chests {...props} /> : <Echo {...props} />}
    {play.done ? <p className="px-copy" role="status"><b className="rn-pot">+{play.gold} GOLD</b> {play.result} {others.some(item => !item.done) ? "Waiting for the rest of the party." : ""}</p> : null}
  </>;
}

export function Camp({ camp, run, selfId, acting, spectator, busy, timer, onCommand }: { camp: ApiCamp; run: ApiRun; selfId: string; acting: boolean; spectator: boolean; busy: boolean; timer: ReactNode; onCommand: Send }) {
  const player = selfId ? run.players[selfId] : undefined;
  const gold = player?.gold ?? 0;
  const bought = camp.purchases?.[selfId] ?? [];
  const ready = Boolean(camp.ready?.[selfId]);
  const next = camp.nextModifiers ?? [];
  const last = camp.nextDepth === run.maxDepth;
  return <div className="rn-context rn-camp">
    <p className="px-eyebrow">FLOOR {run.depth ?? 1} CLEARED · CAMP · {camp.stage === "game" ? (camp.game?.name ?? "").toUpperCase() : "SHOP"}</p>
    {timer}
    {camp.stage === "game" && camp.game ? <>
      <h2>A moment of respite</h2>
      <Game game={camp.game} selfId={selfId} acting={acting} busy={busy} send={onCommand} />
    </> : <>
      <h2>Spend your gold</h2>
      <div className="rn-camp-next">
        <span className="px-label">NEXT: FLOOR {camp.nextDepth} OF {run.maxDepth}{last ? " · THE DUNGEON BOSS" : ""}</span>
        {next.length === 0 ? <span className="px-copy">No modifiers. A clean floor.</span> : <ul>{next.map(modifier => <li key={modifier.id} className={"rn-mod-" + modifier.kind}><b>{modifier.kind === "debuff" ? "▼ " : "▲ "}{modifier.name}.</b> {modifier.description}</li>)}</ul>}
      </div>
      {acting ? <div className="rn-choices">{(camp.offers ?? []).map(item => {
        const soldOut = !item.repeatable && bought.includes(item.id);
        return <button key={item.id} className="rn-choice" onClick={() => void onCommand({ type: "buy", choiceId: item.id })} disabled={busy || ready || soldOut || gold < item.price}>
          <Icon id={item.kind === "strike" ? "strike" : item.kind === "guard" ? "guard" : item.kind === "ward" ? "ward" : item.kind === "cleanse" ? "arcane" : item.kind === "max_health" ? "vitality" : "life"} size={2} />
          <span><strong>{item.name}</strong><small>{item.description}</small></span><em>{soldOut ? "BOUGHT" : item.price + " GOLD"}</em>
        </button>;
      })}</div> : <p className="px-label">{spectator ? "THE PARTY IS SHOPPING" : player && player.health <= 0 ? "YOU ARE DOWN · AN ALLY CAN BUY A REVIVAL DRAUGHT" : "THE PARTY IS SHOPPING"}</p>}
      {acting ? <div className="rn-choices"><button className="px-button px-button-primary" onClick={() => void onCommand({ type: "ready" })} disabled={busy || ready}>{ready ? "READY · WAITING FOR THE PARTY" : last ? "DESCEND TO THE LAST FLOOR" : "DESCEND TO FLOOR " + camp.nextDepth}</button></div> : null}
    </>}
  </div>;
}
