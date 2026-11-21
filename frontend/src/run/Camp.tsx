// The camp between two floors of an expedition: after a castle boss a boon to claim, then a short mini-game for
// gold, then a shop and a look at what the next floor holds. Between dungeons it also shows the expedition map.
// Everything here is a view of server state; every move is a command.
import { useEffect, useState, type ReactNode } from "react";
import type { ApiBoon, ApiCamp, ApiCommand, ApiFloorModifier, ApiMinigame, ApiMinigamePlay, ApiRun } from "../api";
import { Icon } from "../lobby";
import { ExpeditionMap } from "./ExpeditionMap";

type Send = (command: ApiCommand) => Promise<unknown> | void;

/** Gold and the floor's modifiers, shown above the command panel. Hover or focus a modifier to read its rule. */
export function FloorStatus({ gold, modifiers, children }: { gold?: number; modifiers: ApiFloorModifier[]; children?: ReactNode }) {
  return <div className="rn-status">
    {children}
    {gold !== undefined ? <span className="rn-gold" aria-label={gold + " gold"}>{gold} GOLD</span> : null}
    {modifiers.map(modifier => <span key={modifier.id} className={"rn-mod rn-mod-" + modifier.kind} title={modifier.description} tabIndex={0} aria-label={modifier.name + ": " + modifier.description}>{modifier.kind === "debuff" ? "▼ " : "▲ "}{modifier.name.toUpperCase()}</span>)}
  </div>;
}

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

function Game({ game, selfId, acting, busy, send }: { game: ApiMinigame; selfId: string; acting: boolean; busy: boolean; send: Send }) {
  const play = game.players[selfId];
  const others = Object.values(game.players);
  if (!play) {
    return <p className="px-copy">The party is playing {game.name}. {others.filter(item => item.done).length}/{others.length} finished.</p>;
  }
  const props = { play, acting, busy, send };
  return <>
    <p className="px-copy">{game.rules}</p>
    {game.kind === "dice" ? <Dice {...props} /> : <Chests {...props} />}
    {play.done ? <p className="px-copy" role="status"><b className="rn-pot">+{play.gold} GOLD</b> {play.result} {others.some(item => !item.done) ? "Waiting for the rest of the party." : ""}</p> : null}
  </>;
}

function Boons({ offers, chosen, acting, busy, send }: { offers: ApiBoon[]; chosen?: string; acting: boolean; busy: boolean; send: Send }) {
  return <div className="rn-choices">{offers.map(boon => <button key={boon.id} className={"rn-choice" + (chosen === boon.id ? " rn-choice-mine" : "")} onClick={() => void send({ type: "choose_boon", choiceId: boon.id })} disabled={!acting || busy || Boolean(chosen)} aria-label={"Claim " + boon.name}>
    <Icon id="empower" size={2} />
    <span><strong>{boon.name}</strong><small>{boon.description}</small></span>
    <em>{chosen === boon.id ? "CLAIMED" : ""}</em>
  </button>)}</div>;
}

export function Camp({ camp, run, selfId, acting, spectator, busy, timer, onCommand, onChangeSkills }: { camp: ApiCamp; run: ApiRun; selfId: string; acting: boolean; spectator: boolean; busy: boolean; timer: ReactNode; onCommand: Send; onChangeSkills?: () => void }) {
  const player = selfId ? run.players[selfId] : undefined;
  const gold = player?.gold ?? 0;
  const bought = camp.purchases?.[selfId] ?? [];
  const ready = Boolean(camp.ready?.[selfId]);
  const next = camp.nextModifiers ?? [];
  const floors = camp.nextMaxDepth ?? run.maxDepth;
  const last = camp.nextDepth === floors;
  const between = (camp.choices?.length ?? 0) > 0;
  const chosen = camp.choices?.find(choice => choice.themeId === camp.nextThemeId);
  const myVote = camp.votes?.[selfId];
  const votesFor = (themeId: string) => Object.values(camp.votes ?? {}).filter(vote => vote === themeId).length;
  const castleAhead = camp.choices?.some(choice => choice.capstone) ?? false;
  const myBoons = (player?.boons ?? []).length;
  const boonOffers = camp.boonOffers?.[selfId] ?? [];
  const boonsChosen = Object.keys(camp.boonChoices ?? {}).length;
  const boonsOffered = Object.keys(camp.boonOffers ?? {}).length;
  const where = between ? "DUNGEON " + (run.dungeon || 1) + " CLEARED" : camp.boonOnly ? "FLOOR " + (camp.nextDepth - 1) + " CLEARED" : "HALFWAY DOWN";
  const stage = camp.stage === "boon" ? "BOONS" : camp.stage === "game" ? (camp.game?.name ?? "").toUpperCase() : camp.stage === "crossroads" ? "CROSSROADS" : "SHOP";
  return <div className="rn-context rn-camp">
    <p className="px-eyebrow">{where} · {camp.boonOnly ? "" : "CAMP · "}{stage}</p>
    {timer}
    {between && camp.stage !== "boon" ? <ExpeditionMap run={run} /> : null}
    {camp.stage === "boon" ? <>
      <h2>Claim a boon</h2>
      {boonsOffered > 1 ? <p className="px-label">{boonsChosen}/{boonsOffered} CLAIMED</p> : null}
      {boonOffers.length > 0 ? <Boons offers={boonOffers} chosen={camp.boonChoices?.[selfId]} acting={acting} busy={busy} send={onCommand} /> : <p className="px-label">{spectator ? "THE PARTY IS CHOOSING BOONS" : "WAITING FOR THE PARTY"}</p>}
    </> : camp.stage === "game" && camp.game ? <>
      <h2>A moment of respite</h2>
      <Game game={camp.game} selfId={selfId} acting={acting} busy={busy} send={onCommand} />
    </> : camp.stage === "crossroads" ? <>
      <h2>{castleAhead ? "Choose your castle" : "Choose the next dungeon"}</h2>
      {castleAhead ? <p className="px-copy">The road ends at a castle: harder fights, a boon for every boss.</p> : null}
      <div className="rn-choices">{(camp.choices ?? []).map(choice => <button key={choice.themeId} className={"rn-choice rn-dungeon" + (myVote === choice.themeId ? " rn-choice-mine" : "")} onClick={() => void onCommand({ type: "choose_dungeon", choiceId: choice.themeId })} disabled={!acting || busy} aria-label={"Vote for " + choice.name}>
        <Icon id="agility" size={2} />
        <span><strong>{choice.capstone ? "♜ " : ""}{choice.name} · {choice.floors} FLOORS</strong><small>{choice.tagline}</small>
          {choice.modifiers.length > 0 ? <span className="rn-mod-row">{choice.modifiers.map(modifier => <span key={modifier.id} className={"rn-mod rn-mod-" + modifier.kind} title={modifier.description} tabIndex={0} aria-label={modifier.name + ": " + modifier.description}>{modifier.kind === "debuff" ? "▼ " : "▲ "}{modifier.name.toUpperCase()}</span>)}</span> : null}</span>
        <em>{votesFor(choice.themeId)} {myVote === choice.themeId ? "· YOURS" : ""}</em>
      </button>)}</div>
    </> : <>
      <h2>Spend your gold</h2>
      {myBoons > 0 ? <p className="px-label">YOUR BOONS · {(player?.boons ?? []).map(id => id.replace(/-/g, " ").toUpperCase()).join(" · ")}</p> : null}
      <div className="rn-camp-next">
        <span className="px-label">NEXT: {chosen ? chosen.name.toUpperCase() + " · " : ""}FLOOR {camp.nextDepth} OF {floors}{last ? " · THE DUNGEON BOSS" : ""}</span>
        {next.length === 0 ? null : <span className="rn-mod-row">{next.map(modifier => <span key={modifier.id} className={"rn-mod rn-mod-" + modifier.kind} title={modifier.description} tabIndex={0} aria-label={modifier.name + ": " + modifier.description}>{modifier.kind === "debuff" ? "▼ " : "▲ "}{modifier.name.toUpperCase()}</span>)}</span>}
      </div>
      {acting ? <div className="rn-choices">{(camp.offers ?? []).map(item => {
        const soldOut = !item.repeatable && bought.includes(item.id);
        return <button key={item.id} className="rn-choice" onClick={() => void onCommand({ type: "buy", choiceId: item.id })} disabled={busy || ready || soldOut || gold < item.price}>
          <Icon id={item.kind === "strike" ? "strike" : item.kind === "guard" ? "guard" : item.kind === "ward" ? "ward" : item.kind === "cleanse" ? "arcane" : item.kind === "max_health" ? "vitality" : item.kind === "experience" ? "power" : item.kind === "skill_point" ? "empower" : item.kind === "heart_lure" ? "threat" : "life"} size={2} />
          <span><strong>{item.name}{(item.tier ?? 1) > 1 ? <span className="rn-tier" title={"Tier " + item.tier}> {"I".repeat(item.tier ?? 1)}</span> : null}</strong><small>{item.description}</small></span><em>{soldOut ? "BOUGHT" : item.price + " GOLD"}</em>
        </button>;
      })}</div> : <p className="px-label">{spectator ? "THE PARTY IS SHOPPING" : player && player.health <= 0 ? "YOU ARE DOWN · AN ALLY CAN BUY A REVIVAL DRAUGHT" : "THE PARTY IS SHOPPING"}</p>}
      {onChangeSkills ? <div className="rn-choices"><button className="px-button" onClick={onChangeSkills} disabled={busy || ready}>CHANGE SKILLS FOR THE NEXT DUNGEON</button></div> : null}
      {acting ? <div className="rn-choices"><button className="px-button px-button-primary" onClick={() => void onCommand({ type: "ready" })} disabled={busy || ready}>{ready ? "READY · WAITING FOR THE PARTY" : chosen ? "ENTER " + chosen.name.toUpperCase() : last ? "DESCEND TO THE LAST FLOOR" : "DESCEND TO FLOOR " + camp.nextDepth}</button></div> : null}
    </>}
  </div>;
}

const BEST_KEY = "hotb.best-floors";

/** The end of an expedition: how far the party got, the rank that earned, and this browser's best so far. */
export function ExpeditionResult({ run }: { run: ApiRun }) {
  const floors = run.floorsCleared ?? 0;
  const [best, setBest] = useState<number | null>(null);
  const [record, setRecord] = useState(false);
  useEffect(() => {
    // Storage can be unavailable or throw; the result still shows without a personal best.
    try {
      const stored = Number(window.localStorage.getItem(BEST_KEY + ":" + run.id) ?? window.localStorage.getItem(BEST_KEY) ?? "0") || 0;
      const previous = Number(window.localStorage.getItem(BEST_KEY) ?? "0") || 0;
      if (window.localStorage.getItem(BEST_KEY + ":" + run.id) === null) {
        setRecord(floors > previous);
        window.localStorage.setItem(BEST_KEY + ":" + run.id, String(previous));
        if (floors > previous) window.localStorage.setItem(BEST_KEY, String(floors));
        setBest(Math.max(previous, floors));
      } else {
        setRecord(floors > stored);
        setBest(Math.max(stored, floors));
      }
    } catch { setBest(null); }
  }, [run.id, floors]);
  return <div className="rn-result">
    <p className="rn-pot">{(run.rank ?? "Wanderer").toUpperCase()}</p>
    <p className="px-copy">{floors} floor{floors === 1 ? "" : "s"} cleared · {run.dungeonsCleared ?? 0} dungeon{run.dungeonsCleared === 1 ? "" : "s"} conquered · fell in dungeon {run.dungeon || 1}, floor {run.depth ?? 1}.</p>
    {best !== null ? <p className="px-label">{record ? "NEW PERSONAL BEST · " + floors + " FLOORS" : "YOUR BEST · " + best + " FLOORS. CAN YOU GO DEEPER?"}</p> : null}
  </div>;
}
