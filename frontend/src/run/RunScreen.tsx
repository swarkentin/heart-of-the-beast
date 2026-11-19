import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { traitTags } from "./traits.ts";
import type { ApiCombatEvent, ApiCommand, ApiDungeonRoom, ApiEnemy, ApiProfile, ApiRoom, ApiRun, ApiVote, PlayerSession } from "../api";
import { cooldownLabel, cooldownLeft, SKILL_DEFEND, skillCommand, type Skill } from "../combatAbilities";
import { GameShell, Icon, SharedMenu, SkillIcon, SkillLoadout, type LobbyCatalog } from "../lobby";
import type { PartyImpact } from "../monsters/EnemyStage";
import { enemyX } from "../monsters/layout";
import { backdropRef, themeTitle } from "../scenes";
import { Camp, ExpeditionResult, FloorStatus } from "./Camp";
import { relabel, useCombatLog, type LogLine } from "./log";
import { NO_FX, PartyCard, type CardFx } from "./PartyCard";
import { themeVars } from "../uiTheme";
import { DungeonIntro } from "./DungeonIntro";
import { interruptTarget } from "./interrupts.ts";
import { Celebrations } from "./Celebration";
import { progressReport } from "./progress.ts";
import { buildParty, partyLabels, seatParty } from "./party";
import { Scene, type SceneEnemy } from "./Scene";
import "./run.css";

// The run screen. Everything has one home:
//   borders      the party (you are always top-left)
//   viewport     the room, its enemies and what they are about to do
//   bottom-left  the log of what happened
//   bottom-right what you can do right now (combat actions, path votes, room choices, descent, run over)

type Props = {
  snapshot: ApiRoom; run: ApiRun; room: ApiDungeonRoom; session: PlayerSession | null; spectator: boolean;
  catalog: LobbyCatalog | null; profile: ApiProfile | null; busy: boolean; error: string; isHost: boolean; audioControls: ReactNode; onSaveName: (name: string) => Promise<void>; onRefreshProfile: () => Promise<ApiProfile>;
  onCommand: (command: ApiCommand) => Promise<boolean>; onLeave: () => void; onReturnToLobby: () => void;
};
/** One button on the skill bar. A skill that targets an ally or a fallen adventurer has no command until one is picked. */
type ActionDef = { key: string; skill: Skill; label: string; hint: string; details: string; tone: string; disabled: boolean; cooldown: number; ready: boolean; command?: ApiCommand; pick?: "ally" | "fallen" };

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
    traits: traitTags(enemy),
  };
}

/** The opening of a skill rule ("Taunt", "Guard 5 more"), short enough for a button. */
function firstClause(rules: string) { return rules.split(/[.:;,]/)[0].trim(); }

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

export function RunScreen({ snapshot, run, room, session, spectator, catalog, profile, busy, error, isHost, audioControls, onSaveName, onRefreshProfile, onCommand, onLeave, onReturnToLobby }: Props) {
  const selfId = spectator ? "" : session?.playerId ?? "";
  const [view, setView] = useState<"player" | "cast">(spectator ? "cast" : "player");
  const [target, setTarget] = useState("");
  const [pending, setPending] = useState<{ round: number; key: string } | null>(null);
  const [focused, setFocused] = useState("");
  const [fx, setFx] = useState<Record<string, CardFx>>({});
  // A skill waiting for its target portrait, and whether the between-dungeons skill picker is open.
  const [armed, setArmed] = useState("");
  const [loadoutOpen, setLoadoutOpen] = useState(false);
  const [herbsOpen, setHerbsOpen] = useState(false);
  const [introOpen, setIntroOpen] = useState(false);
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
  const eventVote = exploring ? run.eventVote : undefined;
  const descentVote = run.phase === "intermission" ? run.interFloorVote : undefined;
  const camp = run.phase === "intermission" ? run.camp : undefined;
  const now = useNow(Boolean(round || navigationVote || eventVote || descentVote || camp?.deadline), (round?.deadline ?? "") + (navigationVote?.deadline ?? "") + (eventVote?.deadline ?? "") + (descentVote?.deadline ?? "") + (camp?.deadline ?? ""));
  const roundDeadline = round ? new Date(round.deadline).getTime() : 0;
  const roundTotal = round ? Math.max(1, Math.round((roundDeadline - new Date(round.startedAt).getTime()) / 1000)) : 8;
  const remainingMs = round ? Math.max(0, roundDeadline - now) : 0;
  const seconds = Math.ceil(remainingMs / 1000);
  const myAction = round && selfId ? round.actions[selfId] : undefined;
  const waitingOn = round ? eligible.filter(member => !round.actions[member.id]).length : 0;
  const lockedKey = myAction ? (myAction.action === "defend" ? SKILL_DEFEND : myAction.skill ?? "") : pending && pending.round === round?.number ? pending.key : "";
  const canAct = Boolean(acting && round && self?.alive && !lockedKey && remainingMs > 0 && !busy);
  useEffect(() => { setPending(null); setArmed(""); }, [round?.number]);
  // If the timer runs out the server defends for you. Say so on the Defend button itself: it flashes over the last
  // seconds, then shows as pressed while the round resolves.
  const undecided = Boolean(acting && round && self?.alive && !lockedKey);
  const autoSoon = undecided && remainingMs > 0 && seconds <= 3;
  const shownKey = lockedKey || (undecided && remainingMs <= 0 ? SKILL_DEFEND : "");

  // ---- log -------------------------------------------------------------------------------------------------------
  const labels = partyLabels(party);
  // What the run did for lasting progress, once it is over. The profile seen while the run was live tells the stale
  // profile apart from the one the server updated at the end.
  const liveProfile = useRef<ApiProfile | null>(null);
  if (!gameOver && profile) liveProfile.current = profile;
  const runClassId = player?.classBuild?.classId;
  const refreshedProgressRun = useRef("");
  useEffect(() => {
    // The server only exposes a terminal room after its idempotent progression award has committed.
    // No XP means no profile write is expected, so there is nothing to refresh.
    if (!gameOver || spectator || !snapshot.runProgress?.xp || refreshedProgressRun.current === run.id) return;
    refreshedProgressRun.current = run.id;
    void onRefreshProfile().catch(() => {
      // The award is durable; a later profile load can recover if this read fails transiently.
    });
  }, [gameOver, spectator, run.id, snapshot.runProgress?.xp, onRefreshProfile]);
  const report = useMemo(() => gameOver ? progressReport({
    runId: run.id, progress: snapshot.runProgress, before: liveProfile.current, after: profile, spectator: !selfId,
    classId: runClassId, className: catalog?.classes.find(item => item.id === runClassId)?.name,
    rewards: catalog?.profileRewards ?? [], skills: catalog?.skills ?? [], xpPerLevel: catalog?.profileXpPerLevel,
  }) : { lines: [], celebrations: [] }, [gameOver, run.id, snapshot.runProgress, profile, selfId, runClassId, catalog]);
  const notes = useMemo(() => [
    { key: "room:" + run.id + ":" + room.id, text: "ENTERED " + room.name.toUpperCase() },
    ...(room.event?.resolved && room.event.result ? [{ key: "event:" + room.id + ":" + room.event.id, text: room.event.result }] : []),
    ...report.lines,
  ], [run.id, room.id, room.name, room.event?.resolved, room.event?.result, room.event?.id, report.lines]);
  const log = useCombatLog(events, notes);
  // Keep the log pinned to its newest line. Keyed on the array itself, not its length: once the log is full at
  // LOG_LIMIT, new lines push old ones out and the length stops changing. The observer re-pins when the box resizes.
  // New lines glide into view (instantly for players who ask for reduced motion); resizes snap so the box never lags.
  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: el.scrollHeight, behavior: still ? "auto" : "smooth" });
  }, [log]);
  useEffect(() => {
    const el = logRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => { el.scrollTop = el.scrollHeight; });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ---- portrait reactions, in step with the stage ------------------------------------------------------------------
  useEffect(() => () => timers.current.forEach(timer => window.clearTimeout(timer)), []);
  const onPartyImpact = useCallback((impact: PartyImpact) => {
    const id = ++popId.current;
    const pop = { id, text: impact.effect === "damage" ? "-" + impact.amount : impact.effect === "heal" ? "+" + impact.amount : "BLOCK " + impact.amount, tone: impact.effect };
    setFx(all => { const current = all[impact.playerId] ?? NO_FX; return { ...all, [impact.playerId]: { hurt: current.hurt + (impact.effect === "damage" ? 1 : 0), heal: current.heal + (impact.effect === "heal" ? 1 : 0), pops: [...current.pops.slice(-3), pop] } }; });
    timers.current.push(window.setTimeout(() => setFx(all => all[impact.playerId] ? { ...all, [impact.playerId]: { ...all[impact.playerId], pops: all[impact.playerId].pops.filter(item => item.id !== id) } } : all), 1300));
  }, []);

  const labelsFor = (id: string) => { const member = party.find(item => item.id === id); return member ? "P" + member.position + " " + member.className : "your ally"; };
  const classId = player?.classBuild?.classId;
  const mastery = Math.max(1, snapshot.playerMastery?.[selfId] ?? 1);
  // Skills change only at the camp between two dungeons (when the party votes on the next one).
  const canChangeSkills = Boolean(acting && camp && (camp.choices?.length ?? 0) > 0 && classId && self?.alive);
  const banner = gameOver ? { text: run.phase === "completed" ? "VICTORY" : "THE PARTY HAS FALLEN", tone: run.phase === "completed" ? "good" : "bad" } : undefined;

  // ---- combat actions: the player's skill bar ------------------------------------------------------------------------
  const skillById = useMemo(() => new Map((catalog?.skills ?? []).map(skill => [skill.id, skill])), [catalog?.skills]);
  const cooldowns = player?.classCombat?.cooldowns;
  const fallen = party.filter(member => !member.alive && !member.isSelf && member.online);
  const actions: ActionDef[] = [];
  if (round && player) {
    const n = round.number, opening = interruptTarget(living, livingTarget?.id);
    for (const id of player.skills ?? []) {
      const skill = skillById.get(id);
      if (!skill) continue;
      const left = cooldownLeft(cooldowns, id);
      const interrupts = skill.effects?.some(effect => effect.kind === "interrupt") ?? false;
      // An interrupt goes to whichever enemy is telegraphing an interruptible move, so the button can say so.
      const foe = interrupts && opening ? opening : livingTarget, foeName = foe?.name ?? "no target";
      let hint = "", command: ApiCommand | undefined, pick: ActionDef["pick"], disabled = left > 0;
      switch (skill.target) {
        case "enemy":
          hint = !foe ? "No enemy" : interrupts && foe.interruptible ? "Cancels " + (foe.id === livingTarget?.id ? "" : foeName + "'s ") + (foe.rawIntent?.label ?? "its move") : "→ " + foeName;
          disabled ||= !foe;
          command = foe ? skillCommand(skill, n, foe.id) : undefined;
          break;
        case "all_enemies": hint = "Every enemy"; command = skillCommand(skill, n); break;
        case "party": hint = "Whole party"; command = skillCommand(skill, n); break;
        case "self": hint = id === SKILL_DEFEND ? "Block " + (player.guardReduction || 4) + "+ damage" : firstClause(skill.rules); command = skillCommand(skill, n); break;
        case "ally":
          hint = eligible.length > 1 ? "Pick a portrait" : "Yourself";
          if (eligible.length > 1) pick = "ally"; else command = skillCommand(skill, n, selfId);
          break;
        case "fallen":
          hint = fallen.length === 0 ? "No one has fallen" : fallen.length === 1 ? "Revive " + (labelsFor(fallen[0].id)) : "Pick a fallen ally";
          disabled ||= fallen.length === 0;
          if (fallen.length === 1) command = skillCommand(skill, n, fallen[0].id); else pick = "fallen";
          break;
      }
      actions.push({ key: id, skill, label: skill.name, hint: left > 0 ? "Ready in " + left : hint, details: /cooldown|recovers|once/i.test(skill.rules) ? skill.rules : skill.rules + " " + cooldownLabel(skill) + ".", tone: interrupts ? "control" : skill.tone, disabled, cooldown: left, ready: interrupts && skill.target === "enemy" && Boolean(opening) && left === 0, command, pick });
    }
  }
  const send = (key: string, command: ApiCommand) => {
    if (!round) return;
    navigator.vibrate?.(12);
    setArmed("");
    setPending({ round: round.number, key });
    void onCommand(command).then(ok => { if (!ok) setPending(null); });
  };
  const act = (action: ActionDef) => {
    if (!canAct || action.disabled || !round) return;
    if (action.command) { send(action.key, action.command); return; }
    // Pressing an ally skill again casts it on yourself; otherwise it waits for a portrait.
    if (armed === action.key && action.pick === "ally") { send(action.key, skillCommand(action.skill, round.number, selfId)); return; }
    setArmed(armed === action.key ? "" : action.key);
  };
  const armedAction = actions.find(action => action.key === armed);
  const aid = (memberId: string) => {
    if (!canAct || !armedAction || !round) return;
    send(armedAction.key, skillCommand(armedAction.skill, round.number, memberId));
  };
  const cycleTarget = (step: number) => { if (living.length < 2) return; const index = Math.max(0, living.findIndex(enemy => enemy.id === livingTarget?.id)); setTarget(living[(index + step + living.length) % living.length].id); };

  // Number keys choose an action; arrow keys change the target.
  const keys = useRef({ act, cycleTarget, actions, enabled: false });
  keys.current = { act, cycleTarget, actions, enabled: acting && combat && !introOpen };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const state = keys.current, el = event.target as HTMLElement | null;
      if (!state.enabled || event.metaKey || event.ctrlKey || event.altKey || (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (event.key === "Escape") setArmed("");
      else if (/^[1-9]$/.test(event.key)) { const action = state.actions[Number(event.key) - 1]; if (action) { event.preventDefault(); state.act(action); } }
      else if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); state.cycleTarget(event.key === "ArrowLeft" ? -1 : 1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---- votes -------------------------------------------------------------------------------------------------------
  const exitsOpen = exploring && (!room.event || room.event.resolved);
  const navigation = voteState(navigationVote, now);
  const eventDecision = voteState(eventVote, now);
  const descent = voteState(descentVote, now);
  const votesFor = (vote: ApiVote | undefined, choice: string) => eligible.filter(member => vote?.votes?.[member.id] === choice).length;
  const spectatorLink = session?.spectatorToken ? window.location.origin + window.location.pathname + "#spectate=" + encodeURIComponent(session.roomId + ":" + session.spectatorToken) : "";

  const focusedAction = actions.find(action => action.key === focused);
  const timerLabel = !round ? "" : armedAction && !lockedKey ? (armedAction.pick === "fallen" ? "PICK A FALLEN ALLY TO REVIVE" : "PICK A PORTRAIT · PRESS AGAIN FOR YOURSELF") : lockedKey ? (waitingOn > 0 ? "LOCKED IN · WAITING FOR " + waitingOn + " MORE" : "LOCKED IN · RESOLVING") : !self?.alive ? "YOU ARE DOWN · THE PARTY FIGHTS ON" : remainingMs <= 0 ? "TIME UP · DEFENDING" : seconds <= 3 ? "AUTO-DEFEND IN " + seconds : "CHOOSE YOUR ACTION";

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
        <div className={"rn-actions rn-actions-" + Math.max(1, actions.length)}>{actions.map((action, index) => <button key={action.key} type="button"
          className={"rn-act rn-act-" + action.tone + (shownKey === action.key ? " rn-act-chosen" : shownKey ? " rn-act-passed" : autoSoon && action.key === SKILL_DEFEND ? " rn-act-auto" : "") + (armed === action.key ? " rn-act-armed" : "") + (action.cooldown > 0 ? " rn-act-cooling" : "") + (action.ready && !shownKey ? " rn-act-opening" : "")}
          onClick={() => act(action)} onPointerEnter={() => setFocused(action.key)} onPointerLeave={() => setFocused("")} onFocus={() => setFocused(action.key)} onBlur={() => setFocused("")}
          disabled={!shownKey && (!canAct || action.disabled)} aria-disabled={Boolean(shownKey) || undefined} aria-pressed={shownKey === action.key || armed === action.key} title={action.label + ": " + action.details}>
          <kbd aria-hidden="true">{index + 1}</kbd>
          <span className="rn-act-icon"><SkillIcon skill={action.skill} size={2} />{action.cooldown > 0 ? <b className="rn-act-cd" aria-label={"ready in " + action.cooldown + " rounds"}>{action.cooldown}</b> : null}</span>
          <span><strong>{action.label}</strong><small>{lockedKey === action.key ? "LOCKED IN" : shownKey === action.key ? "AUTOMATIC" : armed === action.key ? (action.pick === "fallen" ? "Pick a fallen ally" : "Pick a portrait") : autoSoon && action.key === SKILL_DEFEND ? "Automatic in " + seconds : action.hint}</small></span>
        </button>)}</div>
        <p className="rn-inspect" aria-live="polite">{focusedAction ? <><b>{focusedAction.label}</b> {focusedAction.details}</> : "Keys 1–" + actions.length + " use a skill · ◀ ▶ change target · one skill per round"}</p>
      </> : <p className="px-copy">{spectator ? "Spectating. The party is choosing its actions." : "Cast view is read-only. Switch to the player view to act."}</p>}
    </div>;
  } else if (camp) {
    const campSeconds = camp.deadline ? Math.max(0, Math.ceil((new Date(camp.deadline).getTime() - now) / 1000)) : 0;
    const campTotal = camp.deadline ? Math.max(1, Math.round((new Date(camp.deadline).getTime() - new Date(camp.startedAt).getTime()) / 1000)) : 0;
    const campDone = eligible.filter(member => camp.stage === "boon" ? camp.boonChoices?.[member.id] : camp.stage === "game" ? camp.game?.players[member.id]?.done !== false : camp.stage === "crossroads" ? camp.votes?.[member.id] : camp.ready?.[member.id]).length;
    command = <Camp camp={camp} run={run} selfId={selfId} acting={acting && Boolean(self?.alive)} spectator={spectator} busy={busy} onCommand={onCommand}
      onChangeSkills={canChangeSkills ? () => setLoadoutOpen(true) : undefined}
      timer={camp.deadline ? <div className="rn-timer" role="timer"><strong>{camp.stage === "boon" ? "BOONS" : camp.stage === "game" ? "CAMP GAME" : camp.stage === "crossroads" ? "DUNGEON VOTE" : "CAMP SHOP"} · {campDone}/{eligible.length} {camp.stage === "boon" ? "CLAIMED" : camp.stage === "game" ? "DONE" : camp.stage === "crossroads" ? "IN" : "READY"}</strong><TimerBar seconds={Math.ceil(campSeconds * 15 / campTotal)} total={15} urgent={campSeconds <= 5} /><b>{campSeconds}s</b></div> : null} />;
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
    const mine = eventVote?.votes?.[selfId];
    const cast = eligible.filter(member => eventVote?.votes?.[member.id]).length;
    command = <div className="rn-context">
      <p className="px-eyebrow">{room.roomType === "reward" ? "TREASURE" : "DISCOVERY"}</p>
      <h2>{room.event.title}</h2>
      <p className="px-copy">{room.event.description}</p>
      {eventDecision ? <div className="rn-timer" role="timer"><strong>PARTY DECISION · {cast}/{eligible.length} VOTED · TIES RANDOM</strong><TimerBar seconds={Math.min(15, eventDecision.seconds)} total={15} urgent={eventDecision.seconds <= 3} /><b>{eventDecision.seconds}s</b></div> : null}
      {acting ? <div className="rn-choices">{room.event.choices.map(choice => <button key={choice.id} className={"rn-choice" + (mine === choice.id ? " rn-choice-mine" : "")} onClick={() => void onCommand({ type: "choose_event", choiceId: choice.id })} disabled={busy || Boolean(eventDecision && eventDecision.remainingMs <= 0)}><Icon id="focus" size={2} /><span><strong>{choice.label}</strong><small>{choice.description}</small></span>{eventVote ? <em>{votesFor(eventVote, choice.id)} {mine === choice.id ? "· YOURS" : ""}</em> : null}</button>)}</div> : <p className="px-label">THE PARTY IS DECIDING</p>}
    </div>;
  } else {
    const mine = navigationVote?.votes?.[selfId];
    command = <div className="rn-context">
      <p className="px-eyebrow">{room.cleared ? "ROOM CLEARED" : "EXPLORING"}</p>
      <h2>{exitsOpen && room.exits.length > 0 ? "Choose a path" : room.name}</h2>
      {room.event?.resolved ? <p className="px-copy">{room.event.result || "The party moves on."}</p> : null}
      {navigation ? <div className="rn-timer" role="timer"><strong>PATH VOTE · {eligible.filter(member => navigationVote?.votes?.[member.id]).length}/{eligible.length} IN · TIES RANDOM</strong><TimerBar seconds={Math.min(10, navigation.seconds)} total={10} urgent={navigation.seconds <= 3} /><b>{navigation.seconds}s</b></div> : null}
      {exitsOpen ? <div className="rn-choices">{room.exits.map(exit => <button key={exit.id} className={"rn-choice" + (mine === exit.id ? " rn-choice-mine" : "")} onClick={() => void onCommand({ type: "choose_exit", exitId: exit.id })} disabled={!acting || busy || Boolean(navigation && navigation.remainingMs <= 0)} aria-label={"Vote for " + exit.label}><Icon id="agility" size={2} /><span><strong>{exit.label}</strong><small>{exit.description || "Enter this path"}</small></span>{navigationVote ? <em>{votesFor(navigationVote, exit.id)} {mine === exit.id ? "· YOURS" : ""}</em> : null}</button>)}</div> : null}
    </div>;
  }

  const kitFor = (classId?: string) => {
    const definition = catalog?.classes.find(item => item.id === classId);
    if (!definition) return undefined;
    return [catalog?.classPassives.find(item => item.id === definition.passiveId)].filter(item => item !== undefined).map(item => ({ name: item.name, description: item.description }));
  };
  // A card that has a whole border to itself also explains the class kit.
  const cardProps = (member: (typeof party)[number], order: number) => ({ member, order, displayName: member.isSelf ? profile?.displayName : undefined, kit: party.length <= 2 ? kitFor(member.classId) : undefined, fx: fx[member.id] ?? NO_FX, onHerbs: () => setHerbsOpen(open => !open), aid: armedAction && canAct ? { label: armedAction.label.toUpperCase(), disabled: false, fallen: armedAction.pick === "fallen" } : undefined, onAid: aid });
  const order = (id: string) => Math.max(0, [seats.left[0], seats.right[0], seats.left[1], seats.right[1]].findIndex(member => member?.id === id));

  return <GameShell status="" className={"rn-screen rn-party-" + Math.max(1, Math.min(4, party.length))} style={themeVars(room.themeId || run.themeId)}
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
      {herbsOpen ? <section className="rn-herb-panel px-panel" aria-label="Party Healing Herb supplies">
        <header><div><span className="px-label">PARTY SUPPLIES</span><strong>HEALING HERBS</strong></div><button type="button" className="px-button px-button-small" onClick={() => setHerbsOpen(false)} aria-label="Close herb supplies">CLOSE</button></header>
        <ul>{party.map(member => <li key={member.id} className={member.isSelf ? "rn-herb-self" : ""}>
          <span><b>{member.isSelf ? "YOU" : "P" + member.position + " · " + member.className}</b><small>{member.health}/{member.maxHealth} HP</small></span>
          <strong><Icon id="life" size={1} /> ×{member.healingHerbs}</strong>
        </li>)}</ul>
        {acting && self?.alive && !spectator ? <button type="button" className="px-button px-button-primary rn-herb-use" onClick={() => { void onCommand({ type: "use_consumable", choiceId: "healing-herb" }).then(ok => { if (ok) setHerbsOpen(false); }); }} disabled={busy || !player || (player.consumables?.["healing-herb"] ?? 0) <= 0 || player.health >= player.maxHealth}>
          <Icon id="life" size={1} /> USE A HERB ON YOURSELF · {player?.consumables?.["healing-herb"] ?? 0} LEFT
        </button> : null}
      </section> : null}
      <div className="rn-console">
        <section className="px-panel rn-log" aria-label="Combat log"><h2 className="px-label">LOG</h2><ol ref={logRef} role="log" aria-live="polite" tabIndex={0}>{log.length === 0 ? <li className="rn-log-line rn-log-system"><span>Nothing has happened yet.</span></li> : log.map(line => <LogText key={line.key} line={line} labels={labels} />)}</ol></section>
        <section className="px-panel rn-command" aria-label="Your options">
          {!gameOver && (player?.gold !== undefined || (run.floorModifiers?.length ?? 0) > 0) ? <FloorStatus gold={spectator ? undefined : player?.gold ?? 0} modifiers={camp ? [] : run.floorModifiers ?? []} /> : null}
          {command}{error ? <p className="px-error" role="alert">{error}</p> : null}</section>
      </div>
    </div>

    {loadoutOpen && canChangeSkills && classId && catalog ? <SkillLoadout classId={classId} className={catalog.classes.find(item => item.id === classId)?.name ?? "Adventurer"} catalog={catalog.skills} mastery={mastery} initial={player?.skills ?? []} busy={busy}
      title="Change your skills" note="Between dungeons you can swap skills for the next one. Mastery earned on this run unlocks new skills once it ends."
      onSave={ids => { void onCommand({ type: "set_loadout", skillIds: ids }).then(ok => { if (ok) setLoadoutOpen(false); }); }} onClose={() => setLoadoutOpen(false)} /> : null}
    <Celebrations items={report.celebrations} theme={room.themeId || run.themeId} />
    {run.briefing ? <DungeonIntro briefing={run.briefing} run={run} runId={run.id} active={!gameOver} onOpenChange={setIntroOpen} /> : null}
  </GameShell>;
}
