import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ApiCombatEvent, ApiCommand, ApiDungeonRoom, ApiEnemy, ApiProfile, ApiRoom, ApiRun, ApiVote, PlayerSession, TalentChoice } from "../api";
import { getSignatureAbility, partySupportCommand, signatureCommand, type SignatureMode } from "../combatAbilities";
import { GameShell, Icon, SharedMenu, type IconId, type LobbyCatalog } from "../lobby";
import type { PartyImpact } from "../monsters/EnemyStage";
import { enemyX } from "../monsters/layout";
import { backdropRef, themeTitle } from "../scenes";
import { Camp, ExpeditionResult, FloorStatus } from "./Camp";
import { relabel, useCombatLog, type LogLine } from "./log";
import { NO_FX, PartyCard, type CardFx } from "./PartyCard";
import { archetypeName, buildParty, partyLabels, seatParty } from "./party";
import { Scene, type SceneEnemy } from "./Scene";
import "./run.css";

// The run screen. Everything has one home:
//   borders      the party (you are always top-left)
//   viewport     the room, its enemies and what they are about to do
//   bottom-left  the log of what happened
//   bottom-right what you can do right now (combat actions, path votes, room choices, descent, run over)

type Props = {
  snapshot: ApiRoom; run: ApiRun; room: ApiDungeonRoom; session: PlayerSession | null; spectator: boolean;
  catalog: LobbyCatalog | null; profile: ApiProfile | null; talents: TalentChoice[]; busy: boolean; error: string; isHost: boolean; audioControls: ReactNode; onSaveName: (name: string) => Promise<void>;
  onCommand: (command: ApiCommand) => Promise<boolean>; onChooseTalent: (talentId: string) => Promise<boolean>; onLeave: () => void; onReturnToLobby: () => void;
};
type ActionDef = { key: string; label: string; hint: string; details: string; icon: IconId; tone: "strike" | "guard" | "control" | "signature"; disabled: boolean; command: ApiCommand };

function sceneEnemy(enemy: ApiEnemy, index: number, count: number, playerIds: string[], selfId: string): SceneEnemy {
  const intent = enemy.intent;
  const targetIndex = intent?.targetPlayerId ? playerIds.indexOf(intent.targetPlayerId) + 1 : 0;
  return {
    id: enemy.id, name: enemy.name + (enemy.enraged ? " · ENRAGED" : "") + ((enemy.barrier ?? 0) > 0 ? " · BARRIER " + enemy.barrier : ""), hp: enemy.health, maxHp: enemy.maxHealth, sprite: enemy.sprite, rawIntent: intent,
    x: enemyX("player", count, index),
    intentMove: intent ? intent.label : "No move ready",
    intentEffect: intent ? intent.damage + " DMG" + (intent.heal ? " · HEALS " + intent.heal : "") : "",
    intentTarget: intent?.targetAll ? "→ WHOLE PARTY" : intent?.targetPlayerId && intent.targetPlayerId === selfId ? "→ YOU" : targetIndex > 0 ? "→ P" + targetIndex : "",
    interruptible: Boolean(intent?.interruptible),
  };
}

/** A clock that only ticks while a deadline is running. */
function useNow(active: boolean, restartKey: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [active, restartKey]);
  return now;
}

function voteState(vote: ApiVote | undefined, now: number) {
  if (!vote) return undefined;
  const deadline = new Date(vote.deadline).getTime(), started = new Date(vote.startedAt).getTime();
  const remainingMs = Math.max(0, deadline - now);
  return { remainingMs, seconds: Math.ceil(remainingMs / 1000), percent: Math.max(0, Math.min(100, remainingMs / Math.max(1, deadline - started) * 100)) };
}

function TimerBar({ seconds, total, urgent }: { seconds: number; total: number; urgent: boolean }) {
  return <span className={"rn-timer-bar" + (urgent ? " rn-timer-urgent" : "")} aria-hidden="true">{Array.from({ length: total }, (_, index) => <i key={index} className={index < seconds ? "on" : ""} />)}</span>;
}

function LogText({ line, labels }: { line: LogLine; labels: Record<number, string> }) {
  const parts = (line.tone === "system" ? line.text : relabel(line.text, labels)).split(/(\d+ (?:bonus |reflected |interrupt )?(?:damage|health|XP))/);
  return <li className={"rn-log-line rn-log-" + line.tone}>{line.tone === "auto" ? <Icon id="waiting" size={1} /> : null}<span>{parts.map((part, index) => index % 2 ? <b key={index}>{part}</b> : part)}</span></li>;
}

export function RunScreen({ snapshot, run, room, session, spectator, catalog, profile, talents, busy, error, isHost, audioControls, onSaveName, onCommand, onChooseTalent, onLeave, onReturnToLobby }: Props) {
  const selfId = spectator ? "" : session?.playerId ?? "";
  const [view, setView] = useState<"player" | "cast">(spectator ? "cast" : "player");
  const [target, setTarget] = useState("");
  const [pending, setPending] = useState<{ round: number; key: string } | null>(null);
  const [focused, setFocused] = useState("");
  const [fx, setFx] = useState<Record<string, CardFx>>({});
  const [talentOpen, setTalentOpen] = useState(false);
  const [talentId, setTalentId] = useState("");
  const [copied, setCopied] = useState(false);
  const popId = useRef(0);
  const timers = useRef<number[]>([]);
  const logRef = useRef<HTMLOListElement | null>(null);

  const combat = run.phase === "combat";
  const exploring = run.phase === "exploring";
  const gameOver = run.phase === "completed" || run.phase === "failed";
  const acting = !spectator && view === "player";
  const events: ApiCombatEvent[] = run.lastCombatEvents ?? [];
  const player = selfId ? run.players[selfId] : undefined;

  const enemies = useMemo(() => (room.encounter?.enemies ?? []).map((enemy, index, all) => sceneEnemy(enemy, index, all.length, snapshot.playerIds, selfId)), [room.encounter?.enemies, snapshot.playerIds, selfId]);
  const living = enemies.filter(enemy => enemy.hp > 0);
  const livingTarget = living.find(enemy => enemy.id === target) ?? living[0];
  useEffect(() => { if (livingTarget && target !== livingTarget.id) setTarget(livingTarget.id); }, [livingTarget?.id, target]);

  const party = buildParty(snapshot, run, selfId, catalog, enemies);
  const seats = seatParty(party);
  const self = party.find(member => member.isSelf);
  const eligible = party.filter(member => member.alive && snapshot.presence?.[member.id]?.status !== "left");

  // ---- deadlines -------------------------------------------------------------------------------------------------
  const round = combat ? run.combatRound : undefined;
  const navigationVote = exploring ? run.navigationVote : undefined;
  const descentVote = run.phase === "intermission" ? run.interFloorVote : undefined;
  const camp = run.phase === "intermission" ? run.camp : undefined;
  const now = useNow(Boolean(round || navigationVote || descentVote || camp?.deadline), (round?.deadline ?? "") + (navigationVote?.deadline ?? "") + (descentVote?.deadline ?? "") + (camp?.deadline ?? ""));
  const roundDeadline = round ? new Date(round.deadline).getTime() : 0;
  const roundTotal = round ? Math.max(1, Math.round((roundDeadline - new Date(round.startedAt).getTime()) / 1000)) : 8;
  const remainingMs = round ? Math.max(0, roundDeadline - now) : 0;
  const seconds = Math.ceil(remainingMs / 1000);
  const myAction = round && selfId ? round.actions[selfId] : undefined;
  const waitingOn = round ? eligible.filter(member => !round.actions[member.id]).length : 0;
  const lockedKey = myAction ? (myAction.action === "attack" ? "strike" : myAction.action === "defend" ? "guard" : myAction.action === "interrupt" ? "interrupt" : "sig" + (myAction.mode ? ":" + myAction.mode : "")) : pending && pending.round === round?.number ? pending.key : "";
  const canAct = Boolean(acting && round && self?.alive && !lockedKey && remainingMs > 0 && !busy);
  useEffect(() => { setPending(null); }, [round?.number]);
  // If the timer runs out the server defends for you. Say so on the Defend button itself: it flashes over the last
  // seconds, then shows as pressed while the round resolves.
  const undecided = Boolean(acting && round && self?.alive && !lockedKey);
  const autoSoon = undecided && remainingMs > 0 && seconds <= 3;
  const shownKey = lockedKey || (undecided && remainingMs <= 0 ? "guard" : "");

  // ---- log -------------------------------------------------------------------------------------------------------
  const labels = partyLabels(party);
  const notes = useMemo(() => [
    { key: "room:" + run.id + ":" + room.id, text: "ENTERED " + room.name.toUpperCase() },
    ...(room.event?.resolved && room.event.result ? [{ key: "event:" + room.id + ":" + room.event.id, text: room.event.result }] : []),
  ], [run.id, room.id, room.name, room.event?.resolved, room.event?.result, room.event?.id]);
  const log = useCombatLog(events, notes);
  useEffect(() => { const el = logRef.current; if (el) el.scrollTop = el.scrollHeight; }, [log.length]);

  // ---- portrait reactions, in step with the stage ------------------------------------------------------------------
  useEffect(() => () => timers.current.forEach(timer => window.clearTimeout(timer)), []);
  const onPartyImpact = useCallback((impact: PartyImpact) => {
    const id = ++popId.current;
    const pop = { id, text: impact.effect === "damage" ? "-" + impact.amount : impact.effect === "heal" ? "+" + impact.amount : "BLOCK " + impact.amount, tone: impact.effect };
    setFx(all => { const current = all[impact.playerId] ?? NO_FX; return { ...all, [impact.playerId]: { hurt: current.hurt + (impact.effect === "damage" ? 1 : 0), heal: current.heal + (impact.effect === "heal" ? 1 : 0), pops: [...current.pops.slice(-3), pop] } }; });
    timers.current.push(window.setTimeout(() => setFx(all => all[impact.playerId] ? { ...all, [impact.playerId]: { ...all[impact.playerId], pops: all[impact.playerId].pops.filter(item => item.id !== id) } } : all), 1300));
  }, []);

  const banner = gameOver ? { text: run.phase === "completed" ? "VICTORY" : "THE PARTY HAS FALLEN", tone: run.phase === "completed" ? "good" : "bad" } : undefined;

  // ---- combat actions ----------------------------------------------------------------------------------------------
  const signatureAbilityId = player?.classBuild?.signatureAbilityId || catalog?.classes.find(item => item.id === player?.classBuild?.classId)?.signatureAbilityId;
  const signature = getSignatureAbility(signatureAbilityId);
  const signatureName = catalog?.classAbilities.find(item => item.id === signatureAbilityId)?.name || "Signature";
  // Rounds until the signature ability can be used again (Renewal recovers for a few rounds after each cast).
  const cooldown = player?.classCombat?.abilityCooldown ?? 0;
  const recovering = cooldown > 0 ? "Ready in " + cooldown + (cooldown === 1 ? " round" : " rounds") : "";
  const aidLabel = combat && acting && signature ? (signature.id === "ability.renewal" ? "RENEW" : signature.id === "ability.companion-command" ? "GUARD" : "") : "";
  const actions: ActionDef[] = [];
  if (round && player) {
    const n = round.number, foe = livingTarget, foeName = foe?.name ?? "no target";
    const strike = (player.strikeDamage ?? 10) + player.stats.power;
    actions.push({ key: "strike", label: "Strike", hint: foe ? strike + "+ damage" : "No enemy to hit", details: "Hit " + foeName + " for at least " + strike + " damage.", icon: "power", tone: "strike", disabled: !foe, command: { type: "combat", round: n, action: "attack", targetId: foe?.id } });
    actions.push({ key: "guard", label: "Defend", hint: "Block " + (player.guardReduction || 6) + "+ damage", details: "Brace: the next hit against you is reduced by at least " + (player.guardReduction || 6) + ". This is also what happens if the timer runs out.", icon: "guard", tone: "guard", disabled: false, command: { type: "combat", round: n, action: "defend" } });
    actions.push({ key: "interrupt", label: "Interrupt", hint: foe?.interruptible ? "Cancel " + (foe.rawIntent?.label ?? "its move") : "Nothing to interrupt", details: foe?.interruptible ? "Stop " + foeName + " from using " + (foe.rawIntent?.label ?? "its move") + " this round." : "Only moves marked CAN BE INTERRUPTED can be cancelled. Pick an enemy that shows that mark.", icon: "control", tone: "control", disabled: !foe?.interruptible, command: { type: "combat", round: n, action: "interrupt", targetId: foe?.id } });
    if (signature) {
      const make = (mode: SignatureMode | "", label: string, hint: string, icon: IconId, needsFoe: boolean, allyId = ""): ActionDef => ({ key: "sig" + (mode ? ":" + mode : ""), label, hint: recovering || hint, details: signature.details, icon, tone: "signature", disabled: (needsFoe && !foe) || cooldown > 0, command: signatureCommand(signature, n, mode, foe?.id ?? "", allyId) });
      if (signature.id === "ability.elemental-surge") { actions.push(make("fire", "Fire Surge", "More damage", "arcane", true)); actions.push(make("frost", "Frost Surge", "Less damage, cancels its move", "control", true)); }
      else if (signature.id === "ability.companion-command") { actions.push(make("attack", "Pet: Attack", "Companion strikes", "strike", true)); actions.push(make("defend", "Pet: Guard", "Guard yourself, or pick an ally", "guard", false, selfId)); actions.push(make("disrupt", "Pet: Disrupt", "Stop or weaken its move", "control", true)); }
      else if (signature.id === "ability.renewal") actions.push(make("", "Renewal", "Heal yourself, or pick an ally", "life", false, selfId));
      else actions.push(make("", signatureName, signature.summary, signature.target === "enemy" ? "strike" : "ward", signature.target === "enemy"));
    }
  }
  const act = (action: ActionDef) => {
    if (!canAct || action.disabled || !round) return;
    navigator.vibrate?.(12);
    setPending({ round: round.number, key: action.key });
    void onCommand(action.command).then(ok => { if (!ok) setPending(null); });
  };
  const aid = (memberId: string) => {
    if (!canAct || !signature || !round || cooldown > 0) return;
    navigator.vibrate?.(12);
    setPending({ round: round.number, key: signature.id === "ability.companion-command" ? "sig:defend" : "sig" });
    void onCommand(partySupportCommand(signature, round.number, memberId)).then(ok => { if (!ok) setPending(null); });
  };
  const cycleTarget = (step: number) => { if (living.length < 2) return; const index = Math.max(0, living.findIndex(enemy => enemy.id === livingTarget?.id)); setTarget(living[(index + step + living.length) % living.length].id); };

  // Number keys choose an action; arrow keys change the target.
  const keys = useRef({ act, cycleTarget, actions, enabled: false });
  keys.current = { act, cycleTarget, actions, enabled: acting && combat && !talentOpen };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const state = keys.current, el = event.target as HTMLElement | null;
      if (!state.enabled || event.metaKey || event.ctrlKey || event.altKey || (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (/^[1-9]$/.test(event.key)) { const action = state.actions[Number(event.key) - 1]; if (action) { event.preventDefault(); state.act(action); } }
      else if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); state.cycleTarget(event.key === "ArrowLeft" ? -1 : 1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---- talents -----------------------------------------------------------------------------------------------------
  useEffect(() => { if (!spectator && exploring && (player?.talentPoints ?? 0) > 0) { setTalentOpen(true); setTalentId(""); } }, [exploring, player?.level, player?.talentPoints, spectator]);

  // ---- votes -------------------------------------------------------------------------------------------------------
  const exitsOpen = exploring && (!room.event || room.event.resolved);
  const navigation = voteState(navigationVote, now);
  const descent = voteState(descentVote, now);
  const votesFor = (vote: ApiVote | undefined, choice: string) => eligible.filter(member => vote?.votes?.[member.id] === choice).length;
  const spectatorLink = session?.spectatorToken ? window.location.origin + window.location.pathname + "#spectate=" + encodeURIComponent(session.roomId + ":" + session.spectatorToken) : "";

  const focusedAction = actions.find(action => action.key === focused);
  const timerLabel = !round ? "" : lockedKey ? (waitingOn > 0 ? "LOCKED IN · WAITING FOR " + waitingOn + " MORE" : "LOCKED IN · RESOLVING") : !self?.alive ? "YOU ARE DOWN · THE PARTY FIGHTS ON" : remainingMs <= 0 ? "TIME UP · DEFENDING" : seconds <= 3 ? "AUTO-DEFEND IN " + seconds : "CHOOSE YOUR ACTION";

  let command: ReactNode;
  if (gameOver) {
    command = <div className="rn-context">
      <p className="px-eyebrow">{run.phase === "completed" ? "RUN COMPLETE" : "RUN OVER"}</p>
      <h2>{run.phase === "completed" ? "The dungeon is cleared" : "The party has fallen"}</h2>
      {run.generator ? <ExpeditionResult run={run} /> : null}
      <p className="px-copy">{spectator ? "The host can take the party back to the lobby." : isHost ? "Take the party back to the lobby to choose classes and go again." : "Waiting for the host to return the party to the lobby."}</p>
      {!spectator && isHost ? <div className="rn-choices"><button className="px-button px-button-primary" onClick={onReturnToLobby} disabled={busy}>{busy ? "RETURNING…" : "RETURN TO LOBBY"}</button></div> : null}
    </div>;
  } else if (combat && round) {
    command = <div className="rn-combat">
      <div className={"rn-timer" + (lockedKey ? " rn-timer-locked" : "")} role="timer" aria-label={remainingMs > 0 ? seconds + " seconds left in round " + round.number : "Round " + round.number + " resolving"}>
        <strong>{acting ? timerLabel : "ROUND " + round.number + " · " + (eligible.length - waitingOn) + "/" + eligible.length + " READY"}</strong>
        <TimerBar seconds={seconds} total={roundTotal} urgent={seconds <= 3 && !lockedKey} />
        <b>{remainingMs > 0 ? seconds + "s" : "…"}</b>
      </div>
      {acting ? <>
        <div className="rn-target">
          <span className="px-label">ROUND {round.number} · TARGET</span>
          <button type="button" className="rn-target-step" onClick={() => cycleTarget(-1)} disabled={living.length < 2} aria-label="Previous target">◀</button>
          <strong>{livingTarget?.name ?? "NONE"}</strong>
          <button type="button" className="rn-target-step" onClick={() => cycleTarget(1)} disabled={living.length < 2} aria-label="Next target">▶</button>
        </div>
        <div className={"rn-actions rn-actions-" + actions.length}>{actions.map((action, index) => <button key={action.key} type="button"
          className={"rn-act rn-act-" + action.tone + (shownKey === action.key ? " rn-act-chosen" : shownKey ? " rn-act-passed" : autoSoon && action.key === "guard" ? " rn-act-auto" : "")}
          onClick={() => act(action)} onPointerEnter={() => setFocused(action.key)} onPointerLeave={() => setFocused("")} onFocus={() => setFocused(action.key)} onBlur={() => setFocused("")}
          disabled={!shownKey && (!canAct || action.disabled)} aria-disabled={Boolean(shownKey) || undefined} aria-pressed={shownKey === action.key} title={action.details}>
          <kbd aria-hidden="true">{index + 1}</kbd><Icon id={action.icon} size={2} />
          <span><strong>{action.label}</strong><small>{lockedKey === action.key ? "LOCKED IN" : shownKey === action.key ? "AUTOMATIC" : autoSoon && action.key === "guard" ? "Automatic in " + seconds : action.hint}</small></span>
        </button>)}</div>
        <p className="rn-inspect" aria-live="polite">{focusedAction ? focusedAction.details : aidLabel ? "Keys 1–" + actions.length + " choose · ◀ ▶ change target · select a portrait to " + aidLabel.toLowerCase() + " an ally" : "Keys 1–" + actions.length + " choose · ◀ ▶ change target · one action per round"}</p>
      </> : <p className="px-copy">{spectator ? "Spectating. The party is choosing its actions." : "Cast view is read-only. Switch to the player view to act."}</p>}
    </div>;
  } else if (camp) {
    const campSeconds = camp.deadline ? Math.max(0, Math.ceil((new Date(camp.deadline).getTime() - now) / 1000)) : 0;
    const campTotal = camp.deadline ? Math.max(1, Math.round((new Date(camp.deadline).getTime() - new Date(camp.startedAt).getTime()) / 1000)) : 0;
    const campDone = eligible.filter(member => camp.stage === "game" ? camp.game?.players[member.id]?.done !== false : camp.stage === "crossroads" ? camp.votes?.[member.id] : camp.ready?.[member.id]).length;
    command = <Camp camp={camp} run={run} selfId={selfId} acting={acting && Boolean(self?.alive)} spectator={spectator} busy={busy} onCommand={onCommand}
      timer={camp.deadline ? <div className="rn-timer" role="timer"><strong>{camp.stage === "game" ? "CAMP GAME" : camp.stage === "crossroads" ? "DUNGEON VOTE" : "CAMP SHOP"} · {campDone}/{eligible.length} {camp.stage === "game" ? "DONE" : camp.stage === "crossroads" ? "IN" : "READY"}</strong><TimerBar seconds={Math.ceil(campSeconds * 15 / campTotal)} total={15} urgent={campSeconds <= 5} /><b>{campSeconds}s</b></div> : null} />;
  } else if (run.phase === "intermission") {
    const mine = descentVote?.votes?.[selfId];
    command = <div className="rn-context">
      <p className="px-eyebrow">FLOOR {run.depth ?? 1} CLEARED · DESCENT {(run.depth ?? 1) + 1} OF {run.maxDepth ?? 3}</p>
      <h2>Choose how to prepare</h2>
      {descent ? <div className="rn-timer" role="timer"><strong>PARTY VOTE · {Object.keys(descentVote?.votes ?? {}).length}/{eligible.length} IN</strong><TimerBar seconds={Math.min(10, descent.seconds)} total={10} urgent={descent.seconds <= 3} /><b>{descent.seconds}s</b></div> : null}
      <div className="rn-choices">
        <button className={"rn-choice" + (mine === "restore" ? " rn-choice-mine" : "")} onClick={() => void onCommand({ type: "choose_inter_floor", choiceId: "restore" })} disabled={!acting || busy}><Icon id="life" size={2} /><span><strong>Restore health</strong><small>Every living adventurer recovers up to 10 health.</small></span><em>{votesFor(descentVote, "restore")} {mine === "restore" ? "· YOURS" : ""}</em></button>
        <button className={"rn-choice" + (mine === "perk" ? " rn-choice-mine" : "")} onClick={() => void onCommand({ type: "choose_inter_floor", choiceId: "perk" })} disabled={!acting || busy}><Icon id="empower" size={2} /><span><strong>Take a run perk</strong><small>+1 Strike damage and +1 Guard for everyone, for the rest of the run.</small></span><em>{votesFor(descentVote, "perk")} {mine === "perk" ? "· YOURS" : ""}</em></button>
      </div>
    </div>;
  } else if (room.event && !room.event.resolved) {
    command = <div className="rn-context">
      <p className="px-eyebrow">{room.roomType === "reward" ? "TREASURE" : "DISCOVERY"}</p>
      <h2>{room.event.title}</h2>
      <p className="px-copy">{room.event.description}</p>
      {acting ? <div className="rn-choices">{room.event.choices.map(choice => <button key={choice.id} className="rn-choice" onClick={() => void onCommand({ type: "choose_event", choiceId: choice.id })} disabled={busy}><Icon id="focus" size={2} /><span><strong>{choice.label}</strong><small>{choice.description}</small></span></button>)}</div> : <p className="px-label">THE PARTY IS DECIDING</p>}
    </div>;
  } else {
    const mine = navigationVote?.votes?.[selfId];
    command = <div className="rn-context">
      <p className="px-eyebrow">{room.cleared ? "ROOM CLEARED" : "EXPLORING"}</p>
      <h2>{exitsOpen && room.exits.length > 0 ? "Choose a path" : room.name}</h2>
      {room.event?.resolved ? <p className="px-copy">{room.event.result || "The party moves on."}</p> : null}
      {navigation ? <div className="rn-timer" role="timer"><strong>PATH VOTE · {eligible.filter(member => navigationVote?.votes?.[member.id]).length}/{eligible.length} IN · TIES RANDOM</strong><TimerBar seconds={Math.min(10, navigation.seconds)} total={10} urgent={navigation.seconds <= 3} /><b>{navigation.seconds}s</b></div> : null}
      {exitsOpen ? <div className="rn-choices">{room.exits.map(exit => <button key={exit.id} className={"rn-choice" + (mine === exit.id ? " rn-choice-mine" : "")} onClick={() => void onCommand({ type: "choose_exit", exitId: exit.id })} disabled={!acting || busy || Boolean(navigation && navigation.remainingMs <= 0)} aria-label={"Vote for " + exit.label}><Icon id="agility" size={2} /><span><strong>{exit.label}</strong><small>{exit.description || "Enter this path"}</small></span>{navigationVote ? <em>{votesFor(navigationVote, exit.id)} {mine === exit.id ? "· YOURS" : ""}</em> : null}</button>)}</div> : null}
      {!spectator && (player?.talentPoints ?? 0) > 0 ? <div className="rn-choices"><button className="px-button px-button-primary" onClick={() => { setTalentOpen(true); setTalentId(""); }}>CHOOSE A TALENT ({player?.talentPoints})</button></div> : null}
    </div>;
  }

  const kitFor = (classId?: string) => {
    const definition = catalog?.classes.find(item => item.id === classId);
    if (!definition) return undefined;
    return [catalog?.classAbilities.find(item => item.id === definition.signatureAbilityId), catalog?.classPassives.find(item => item.id === definition.passiveId)].filter(item => item !== undefined).map(item => ({ name: item.name, description: item.description }));
  };
  // A card that has a whole border to itself also explains the class kit.
  const cardProps = (member: (typeof party)[number], order: number) => ({ member, order, displayName: member.isSelf ? profile?.displayName : undefined, kit: party.length <= 2 ? kitFor(member.classId) : undefined, fx: fx[member.id] ?? NO_FX, aid: aidLabel ? { label: aidLabel, disabled: !canAct || cooldown > 0 } : undefined, onAid: aid });
  const order = (id: string) => Math.max(0, [seats.left[0], seats.right[0], seats.left[1], seats.right[1]].findIndex(member => member?.id === id));

  return <GameShell status="" className={"rn-screen rn-party-" + Math.max(1, Math.min(4, party.length))}
    center={<div className="rn-location"><b>{room.name}</b><span>{(run.dungeon ?? 1) > 1 ? "DUNGEON " + run.dungeon + " · " : ""}{camp ? "CAMP BELOW FLOOR " + (run.depth ?? 1) : "FLOOR " + String(run.depth ?? 1).padStart(2, "0")}{run.maxDepth ? " OF " + String(run.maxDepth).padStart(2, "0") : ""} · {themeTitle(room.themeId || run.themeId)}{spectator ? " · SPECTATING" : ""}</span></div>}
    tools={<>
      {!spectator ? <button type="button" className="px-button px-button-small rn-view-switch" onClick={() => setView(view === "player" ? "cast" : "player")} aria-pressed={view === "cast"}>{view === "player" ? "CAST VIEW" : "PLAYER VIEW"}</button> : null}
      <SharedMenu profile={profile} classes={catalog?.classes ?? []} rewards={catalog?.profileRewards ?? []} audioControls={audioControls} onSaveName={onSaveName} actions={<>
        {!spectator ? <button type="button" className="px-button px-button-small" onClick={() => setView(view === "player" ? "cast" : "player")}>{view === "player" ? "CAST VIEW" : "PLAYER VIEW"}</button> : null}
        {spectatorLink ? <><button type="button" className="px-button px-button-small" onClick={() => { void navigator.clipboard?.writeText(spectatorLink).then(() => setCopied(true)).catch(() => undefined); }}>{copied ? "LINK COPIED" : "COPY SPECTATOR LINK"}</button><a className="px-button px-button-small" href={spectatorLink} target="_blank" rel="noreferrer">OPEN SPECTATOR VIEW</a></> : null}
        {!spectator ? <button type="button" className="px-button px-button-small px-button-danger" onClick={onLeave} disabled={busy}>LEAVE PARTY</button> : null}
      </>} />
    </>}>
    <div className="rn-board">
      <aside className="rn-side rn-side-left" aria-label="Party">{seats.left.map(member => <PartyCard key={member.id} {...cardProps(member, order(member.id))} />)}</aside>
      <section className="rn-view" aria-label="Encounter">
        <Scene view={acting ? "player" : "cast"} roomId={room.id} roomName={room.name} backdrop={backdropRef({ id: room.id, roomType: room.roomType, themeId: room.themeId }, run.themeId)} enemies={enemies} events={events} party={party}
          target={livingTarget?.id ?? ""} onTarget={acting && combat ? setTarget : undefined} onPartyImpact={onPartyImpact} banner={banner} />
      </section>
      {seats.right.length > 0 ? <aside className="rn-side rn-side-right" aria-label="Party">{seats.right.map(member => <PartyCard key={member.id} {...cardProps(member, order(member.id))} />)}</aside> : null}
      <div className="rn-console">
        <section className="px-panel rn-log" aria-label="Combat log"><h2 className="px-label">LOG</h2><ol ref={logRef} role="log" aria-live="polite" tabIndex={0}>{log.length === 0 ? <li className="rn-log-line rn-log-system"><span>Nothing has happened yet.</span></li> : log.map(line => <LogText key={line.key} line={line} labels={labels} />)}</ol></section>
        <section className="px-panel rn-command" aria-label="Your options">
          {!gameOver && (player?.gold !== undefined || (run.floorModifiers?.length ?? 0) > 0) ? <FloorStatus gold={spectator ? undefined : player?.gold ?? 0} modifiers={camp ? [] : run.floorModifiers ?? []} /> : null}
          {command}{error ? <p className="px-error" role="alert">{error}</p> : null}</section>
      </div>
    </div>

    {talentOpen && player && !spectator ? <div className="px-backdrop" role="presentation">
      <section className="px-panel px-tree" role="dialog" aria-modal="true" aria-labelledby="talent-title">
        <div className="px-tree-head rn-talent-head"><div><p className="px-eyebrow">LEVEL {player.level} · {archetypeName(player.archetype).toUpperCase()} · {player.talentPoints} POINT{player.talentPoints === 1 ? "" : "S"}</p><h2 id="talent-title">Choose your next talent</h2><p className="px-copy">Select a talent to commit a point. Nothing is saved until you accept.</p></div><button className="px-button px-button-small" onClick={() => setTalentOpen(false)} aria-label="Close talent selection">CLOSE</button></div>
        <div className="px-tree-tiers">{[1, 2].map(tier => <div className="px-tree-tier" key={tier}>
          <div className="px-label">{tier === 1 ? "TIER 1 · FOUNDATION" : "TIER 2 · SPECIALIZATION"}</div>
          {talents.filter(talent => talent.archetype === player.archetype && talent.tier === tier).map(talent => {
            const known = player.talents?.includes(talent.id), locked = player.level < talent.tier + 1 || Boolean(talent.requires && !player.talents?.includes(talent.requires));
            return <button key={talent.id} type="button" className={"px-tree-node rn-talent" + (talentId === talent.id ? " rn-talent-on" : "") + (known ? " rn-talent-known" : "") + (locked ? " rn-talent-locked" : "")} onClick={() => setTalentId(talent.id)} disabled={known || locked || busy} aria-pressed={talentId === talent.id}>
              <Icon id={known ? "ready" : locked ? "locked" : "empower"} /><div><strong>{talent.name}</strong><p>{talent.description}</p><span className="px-label">{known ? "LEARNED" : talent.requires ? "REQUIRES " + (talents.find(item => item.id === talent.requires)?.name ?? "").toUpperCase() : tier === 1 ? "AVAILABLE NOW" : "UNLOCKS AT LEVEL 3"}</span></div>
            </button>;
          })}
        </div>)}</div>
        <div className="rn-talent-actions"><button className="px-button" onClick={() => { setTalentOpen(false); setTalentId(""); }}>DECIDE LATER</button><button className="px-button px-button-primary" disabled={!talentId || busy} onClick={() => { void onChooseTalent(talentId).then(ok => { if (ok) { setTalentOpen(false); setTalentId(""); } }); }}>{busy ? "SAVING…" : "ACCEPT TALENT"}</button></div>
      </section>
    </div> : null}
  </GameShell>;
}
