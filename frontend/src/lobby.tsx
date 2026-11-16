import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import "./lobby.css";

// Title, connecting, party lobby and class selection screens. All art comes from
// scripts/pixel-art (heroes and the interface kit) so these screens share the bestiary's look.

export type LobbyClass = { id: string; archetypeId: string; name: string; description: string; startingStats: { health: number; power: number; focus: number; agility: number }; startingEquipment: string[]; signatureAbilityId: string; passiveId: string };
export type LobbyNamedRule = { id: string; name: string; description: string };
export type LobbyProfile = { adventurerXp: number; adventurerLevel: number; classMastery: Record<string, { experience: number; level: number }> };
export type LobbyCatalog = { classes: LobbyClass[]; classAvailability: { classId: string; initiallyAvailable: boolean; unlockPolicyId?: string }[]; classAbilities: LobbyNamedRule[]; classPassives: LobbyNamedRule[]; equipment: { id: string; name: string; slot: string }[] };
export type LobbyTalent = { id: string; archetype: string; name: string; description: string; tier: number; requires?: string };
export type LobbyRoom = { code: string; ownerPlayerId: string; playerIds: string[]; playerClasses?: Record<string, string>; presence?: Record<string, { status: "online" | "disconnected" | "left" }> };

// Keep in step with scripts/pixel-art/heroes.mjs and ICON_ORDER in scripts/pixel-art/ui.mjs.
const HERO_ART = new Set(["bulwark", "juggernaut", "spellguard", "assassin", "arcanist", "ranger", "cleric", "tactician", "beastcaller"]);
const PARADE = ["spellguard", "ranger", "juggernaut", "cleric", "bulwark", "arcanist", "tactician", "assassin", "beastcaller"];
export const ICONS = ["vitality", "power", "focus", "agility", "strike", "guard", "life", "arcane", "control", "damage", "support", "host", "ready", "waiting", "locked", "poison", "empower", "ward", "down", "threat", "offline"] as const;
export type IconId = (typeof ICONS)[number];
const ACCENTS: Record<string, string> = { bulwark: "#8fe6c4", juggernaut: "#ff9a4d", spellguard: "#8fd6ff", assassin: "#ff8fc0", arcanist: "#c9a4ff", ranger: "#b6e87a", cleric: "#ffe08a", tactician: "#8ee0dc", beastcaller: "#a6e88f" };
const ARCHETYPES: { id: string; name: string; icon: IconId; blurb: string }[] = [
  { id: "tank", name: "Tank", icon: "guard", blurb: "Hold the line" },
  { id: "damage", name: "Damage", icon: "damage", blurb: "End fights fast" },
  { id: "support", name: "Support", icon: "support", blurb: "Lift the party" },
];
const MAX_PARTY = 4;

const heroArt = (classId?: string) => (classId && HERO_ART.has(classId) ? classId : "empty");
const vars = (values: Record<string, string | number>) => values as unknown as CSSProperties;

export function Icon({ id, size = 2 }: { id: IconId; size?: number }) {
  return <span className="px-icon" aria-hidden="true" style={vars({ "--i": ICONS.indexOf(id), "--n": ICONS.length, "--s": size })} />;
}

/** Looping body language. Status overlays (StatusFx) are layered on top of it. */
export type HeroPose = "idle" | "injured" | "poisoned" | "down";
export type StatusFxKind = "heal" | "guard" | "ward" | "buff" | "poison" | "sleep";

/**
 * Animated hero sprite. `pose` picks the looping row; bumping `flourish` or `hurt` plays that one-shot once
 * and returns to the pose.
 */
export function HeroSprite({ classId, flourish = 0, hurt = 0, pose = "idle", label }: { classId?: string; flourish?: number; hurt?: number; pose?: HeroPose; label?: string }) {
  const art = heroArt(classId);
  const [playing, setPlaying] = useState<"" | "flourish" | "hurt">("");
  useEffect(() => { if (flourish > 0 && art !== "empty") setPlaying("flourish"); }, [flourish, art]);
  useEffect(() => { if (hurt > 0 && art !== "empty") setPlaying("hurt"); }, [hurt, art]);
  // Reduced motion disables the animation, so animationend never fires: always fall back to the pose.
  useEffect(() => { if (!playing) return; const timer = window.setTimeout(() => setPlaying(""), 900); return () => window.clearTimeout(timer); }, [playing, flourish, hurt]);
  return <span className={"px-hero" + (art === "empty" ? " px-hero-empty" : " px-hero-" + pose) + (playing ? " px-hero-" + playing : "")} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}
    style={{ backgroundImage: "url(/art/heroes/" + art + ".png)" }} onAnimationEnd={() => setPlaying("")} />;
}

/** One status overlay, sized to sit exactly over a HeroSprite in the same positioned box. */
export function StatusFx({ kind }: { kind: StatusFxKind }) {
  return <span className={"px-statusfx px-statusfx-" + kind} aria-hidden="true" />;
}

export function Bust({ classId, locked }: { classId?: string; locked?: boolean }) {
  return <span className={"px-bust" + (locked ? " px-bust-locked" : "")} aria-hidden="true" style={{ backgroundImage: "url(/art/heroes/" + heroArt(classId) + "-bust.png)" }} />;
}

function Torch() { return <span className="px-torch" aria-hidden="true" />; }

export function GameShell({ status, children, className, center, tools }: { status: string; children: ReactNode; className?: string; center?: ReactNode; tools?: ReactNode }) {
  return <main className={"px-screen" + (className ? " " + className : "")}>
    <header className="px-topbar">
      <a className="px-brand" href="#" aria-label="Heart of the Beast"><span className="px-emblem" aria-hidden="true" /><span>HEART OF THE BEAST</span></a>
      {center}
      {tools ? <div className="px-tools">{tools}</div> : <div className="px-status"><i aria-hidden="true" />{status}</div>}
    </header>
    {children}
  </main>;
}

export function ConnectingScreen({ message }: { message: string }) {
  return <GameShell status="CONNECTING">
    <section className="px-panel px-connecting" role="status"><HeroSprite classId="bulwark" /><p>{message}</p></section>
  </GameShell>;
}

export function TitleScreen({ busy, error, joinCode, onJoinCode, onCreate, onJoin, profileLevel, profile, classes = [] }: { busy: boolean; error: string; joinCode: string; onJoinCode: (value: string) => void; onCreate: () => void; onJoin: () => void; profileLevel?: number; profile?: LobbyProfile | null; classes?: Pick<LobbyClass, "id" | "name">[] }) {
  return <GameShell status={profileLevel ? "ADVENTURER RANK " + profileLevel : "PREPARING PROFILE"}>
    <section className="px-title">
      <div className="px-title-crest"><Torch /><span className="px-emblem px-emblem-large" aria-hidden="true" /><Torch /></div>
      <p className="px-eyebrow">THE FORGOTTEN CATACOMBS</p>
      <h1 className="px-wordmark">HEART <small>OF THE</small> BEAST</h1>
      <p className="px-lede">A dungeon crawl for one to four. Pick a hero, descend together, and see who makes it back.</p>
      <div className="px-parade" aria-hidden="true"><div className="px-parade-line">{PARADE.map(id => <HeroSprite key={id} classId={id} />)}</div></div>
    </section>
    <section className="px-panel px-title-actions" aria-label="Start playing">
      <div className="px-title-create">
        <h2>Gather your party</h2>
        <p>Open a room and invite up to three friends, or brave it alone.</p>
        <button className="px-button px-button-primary px-button-large" onClick={onCreate} disabled={busy}>{busy ? "OPENING…" : "CREATE ROOM"}</button>
      </div>
      <div className="px-title-or" aria-hidden="true"><span>OR</span></div>
      <form className="px-title-join" onSubmit={event => { event.preventDefault(); if (!busy && joinCode.length === 6) onJoin(); }}>
        <h2><label htmlFor="join-code">Join a party</label></h2>
        <p>Enter the six-character code your host shared.</p>
        <div className="px-join-row">
          <input id="join-code" className="px-input" value={joinCode} onChange={event => onJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} placeholder="······" maxLength={6} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
          <button type="submit" className="px-button" disabled={busy || joinCode.length !== 6}>JOIN</button>
        </div>
      </form>
      {error ? <p className="px-error" role="alert">{error}</p> : null}
    </section>
    {profile ? <ProfileSummary profile={profile} classes={classes} /> : null}
  </GameShell>;
}

function ProfileSummary({ profile, classes }: { profile: LobbyProfile; classes: Pick<LobbyClass, "id" | "name">[] }) {
  const rankXP = profile.adventurerXp % 100;
  return <section className="px-panel px-profile-summary" aria-label="Adventurer progression">
    <div className="px-profile-head">
      <div><p className="px-eyebrow">YOUR ADVENTURER</p><strong className="px-profile-rank">RANK {profile.adventurerLevel}</strong></div>
      <span className="px-profile-xp">{rankXP}/100 XP TO NEXT RANK</span>
    </div>
    <div className="px-profile-track" role="progressbar" aria-label="Adventurer rank progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={rankXP}><i style={{ width: rankXP + "%" }} /></div>
    <div className="px-mastery-heading"><strong>CLASS MASTERY</strong><span>Progress follows the class you play</span></div>
    <div className="px-mastery-grid">
      {classes.map(item => {
        const mastery = profile.classMastery[item.id] || { experience: 0, level: 1 };
        const xp = mastery.experience % 100;
        return <div className="px-mastery-item" key={item.id}>
          <div className="px-mastery-meta"><strong>{item.name}</strong><span>RANK {mastery.level || 1}</span></div>
          <div className="px-mastery-track" role="progressbar" aria-label={item.name + " mastery progress"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={xp}><i style={{ width: xp + "%" }} /></div>
          <span className="px-mastery-xp">{xp}/100 XP</span>
        </div>;
      })}
    </div>
  </section>;
}

function skillIcon(id: string): IconId {
  if (/heal|renewal|recovery|companion|nature/i.test(id)) return "life";
  if (/shield|ward|guard|resolve|resist/i.test(id)) return "guard";
  if (/fire|element|arcane|focus/i.test(id)) return "arcane";
  if (/interrupt|pin|command|disrupt/i.test(id)) return "control";
  return "strike";
}

function Pips({ value, max = 4 }: { value: number; max?: number }) {
  return <span className="px-pips" aria-hidden="true">{Array.from({ length: Math.max(max, value) }, (_, index) => <i key={index} className={index < value ? "on" : ""} />)}</span>;
}

export function PartyLobby({ room, catalog, playerId, isHost, busy, error, talents, profile, onSelectClass, onStart, onLeave }: { room: LobbyRoom; catalog: LobbyCatalog | null; playerId: string; isHost: boolean; busy: boolean; error: string; talents: LobbyTalent[]; profile?: LobbyProfile | null; onSelectClass: (classId: string) => void; onStart: () => void; onLeave: () => void }) {
  const [previewClassId, setPreviewClassId] = useState("");
  const [treeOpen, setTreeOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [flourish, setFlourish] = useState(0);

  const present = room.playerIds.filter(id => room.presence?.[id]?.status !== "left");
  const selectedClassId = room.playerClasses?.[playerId];
  const className = (id?: string) => catalog?.classes.find(item => item.id === id)?.name;
  const isAvailable = (id: string) => Boolean(catalog?.classAvailability.find(value => value.classId === id)?.initiallyAvailable);
  const playable = catalog?.classes.filter(item => isAvailable(item.id) || item.id === selectedClassId) ?? [];
  const locked = catalog?.classes.filter(item => !isAvailable(item.id) && item.id !== selectedClassId) ?? [];
  const focusedClass = playable.find(item => item.id === (previewClassId || selectedClassId)) ?? playable[0];
  const undecided = present.filter(id => !room.playerClasses?.[id]).length;
  const slots: (string | null)[] = [...present.slice(0, MAX_PARTY), ...Array<null>(Math.max(0, MAX_PARTY - present.length)).fill(null)];

  // Celebrate a confirmed choice: the chosen hero plays their signature move.
  useEffect(() => { if (selectedClassId) setFlourish(value => value + 1); }, [selectedClassId]);
  useEffect(() => { if (!copied) return; const timer = window.setTimeout(() => setCopied(false), 1800); return () => window.clearTimeout(timer); }, [copied]);
  useEffect(() => {
    if (!treeOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setTreeOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [treeOpen]);

  const ability = focusedClass ? catalog?.classAbilities.find(value => value.id === focusedClass.signatureAbilityId) : undefined;
  const passive = focusedClass ? catalog?.classPassives.find(value => value.id === focusedClass.passiveId) : undefined;
  const gear = focusedClass ? focusedClass.startingEquipment.map(id => catalog?.equipment.find(value => value.id === id)?.name || id) : [];
  const archetype = ARCHETYPES.find(item => item.id === focusedClass?.archetypeId);
  const groups = [...ARCHETYPES.map(item => ({ ...item, classes: playable.filter(value => value.archetypeId === item.id) })), { id: "other", name: "Other", icon: "strike" as IconId, blurb: "", classes: playable.filter(value => !ARCHETYPES.some(item => item.id === value.archetypeId)) }].filter(group => group.classes.length > 0);

  return <GameShell status="PARTY LOBBY">
    <section className="px-lobby">
      <div className="px-panel px-camp">
        <div className="px-camp-head">
          <div>
            <p className="px-eyebrow">THE FORGOTTEN CATACOMBS</p>
            <h1>The party is gathering</h1>
            <p className="px-copy">Share the room code. Up to four adventurers can join before the host begins.</p>
          </div>
          <div className="px-code">
            <span className="px-label">ROOM CODE</span>
            <strong aria-label={"Room code " + room.code.split("").join(" ")}>{room.code}</strong>
            <button className="px-button px-button-small" onClick={() => { void navigator.clipboard?.writeText(room.code).then(() => setCopied(true)).catch(() => undefined); }}>{copied ? "COPIED" : "COPY"}</button>
          </div>
        </div>
        <h2 className="px-label px-camp-count">ADVENTURERS {present.length}/{MAX_PARTY}</h2>
        <ul className="px-stage">
          <li className="px-stage-torch" aria-hidden="true"><Torch /></li>
          {slots.map((id, index) => {
            if (!id) return <li key={"empty-" + index} className="px-slot px-slot-empty"><HeroSprite /><div className="px-nameplate"><span>OPEN SLOT</span><strong>Awaiting hero</strong></div></li>;
            const classId = room.playerClasses?.[id], status = room.presence?.[id]?.status || "online", you = id === playerId, host = id === room.ownerPlayerId;
            return <li key={id} className={"px-slot" + (you ? " px-slot-you" : "") + (status !== "online" ? " px-slot-away" : "")} style={vars({ "--accent": ACCENTS[classId || ""] || "#d6a64d" })}>
              {host ? <span className="px-slot-crown" title="Host"><Icon id="host" size={1} /></span> : null}
              <HeroSprite classId={classId} flourish={you ? flourish : 0} label={className(classId) || "Undecided adventurer"} />
              <div className="px-nameplate">
                <span>{host ? "HOST" : "PLAYER " + (room.playerIds.indexOf(id) + 1)}{you ? " · YOU" : ""}</span>
                <strong>{className(classId) || "Choosing…"}</strong>
                <em className={"px-presence px-presence-" + status}>{status === "online" ? (classId ? "READY" : "DECIDING") : "OFFLINE"}</em>
              </div>
            </li>;
          })}
          <li className="px-stage-torch" aria-hidden="true"><Torch /></li>
        </ul>
      </div>

      {profile ? <ProfileSummary profile={profile} classes={catalog?.classes ?? []} /> : null}

      <div className="px-panel px-classes">
        <div className="px-classes-head"><p className="px-eyebrow">CREATE YOUR ADVENTURER</p><h2>Choose your path</h2><p className="px-copy">Every class can survive the catacombs alone. Pick the way of fighting that feels like yours.</p></div>
        {!catalog ? <p className="px-copy" role="status">Preparing the class roster…</p> : !focusedClass ? <p className="px-copy">No classes are available yet.</p> : <div className="px-classes-body">
          <div className="px-roster" aria-label="Choose a class">
            {groups.map(group => <div className="px-roster-group" key={group.id}>
              <div className="px-roster-label"><Icon id={group.icon} size={1} /><b>{group.name.toUpperCase()}</b><span>{group.blurb}</span></div>
              <div className="px-roster-row">{group.classes.map(item => <button key={item.id} className={"px-class" + (item.id === focusedClass.id ? " px-class-focused" : "") + (item.id === selectedClassId ? " px-class-chosen" : "")} style={vars({ "--accent": ACCENTS[item.id] || "#d6a64d" })} onClick={() => setPreviewClassId(item.id)} aria-pressed={item.id === focusedClass.id}>
                <Bust classId={item.id} /><strong>{item.name}</strong>{item.id === selectedClassId ? <i><Icon id="ready" size={1} /><span className="px-sr">Your chosen class</span></i> : null}
              </button>)}</div>
            </div>)}
            {locked.length > 0 ? <div className="px-roster-group">
              <div className="px-roster-label"><Icon id="locked" size={1} /><b>LOCKED PATHS</b><span>Earned through play</span></div>
              <div className="px-roster-row">{locked.map(item => <div key={item.id} className="px-class px-class-locked" title={item.description}><Bust classId={item.id} locked /><strong>{item.name}</strong></div>)}</div>
            </div> : null}
          </div>

          <section className="px-detail" aria-live="polite" style={vars({ "--accent": ACCENTS[focusedClass.id] || "#d6a64d" })}>
            <div className="px-showcase"><div className="px-showcase-floor" /><HeroSprite key={focusedClass.id} classId={focusedClass.id} flourish={focusedClass.id === selectedClassId ? flourish : 0} label={focusedClass.name + " hero"} /></div>
            <div className="px-detail-copy">
              <div className="px-detail-title"><h3>{focusedClass.name}</h3><span className="px-chip">{archetype ? <Icon id={archetype.icon} size={1} /> : null}{(archetype?.name || focusedClass.archetypeId).toUpperCase()}</span></div>
              <p className="px-copy">{focusedClass.description}</p>
              <dl className="px-stats">
                <div><dt><Icon id="vitality" />Vitality</dt><dd><b>{focusedClass.startingStats.health}</b></dd></div>
                <div><dt><Icon id="power" />Power</dt><dd><b>{focusedClass.startingStats.power}</b><Pips value={focusedClass.startingStats.power} /></dd></div>
                <div><dt><Icon id="focus" />Focus</dt><dd><b>{focusedClass.startingStats.focus}</b><Pips value={focusedClass.startingStats.focus} /></dd></div>
                <div><dt><Icon id="agility" />Agility</dt><dd><b>{focusedClass.startingStats.agility}</b><Pips value={focusedClass.startingStats.agility} /></dd></div>
              </dl>
            </div>
            <div className="px-skills">
              <article><Icon id={skillIcon(focusedClass.signatureAbilityId)} size={3} /><div><span className="px-label">SIGNATURE SKILL</span><strong>{ability?.name || "Signature ability"}</strong><p>{ability?.description}</p></div></article>
              <article><Icon id={skillIcon(focusedClass.passiveId)} size={3} /><div><span className="px-label">ALWAYS WITH YOU</span><strong>{passive?.name || "Passive trait"}</strong><p>{passive?.description}</p></div></article>
            </div>
            <p className="px-gear"><span className="px-label">STARTING GEAR</span>{gear.join(" · ")}</p>
            <div className="px-detail-actions">
              <button className="px-button" onClick={() => setTreeOpen(true)}>TALENT TREE</button>
              <button className="px-button px-button-primary" onClick={() => onSelectClass(focusedClass.id)} disabled={busy || focusedClass.id === selectedClassId}>{focusedClass.id === selectedClassId ? "YOUR CHOSEN PATH" : busy ? "SAVING…" : "CHOOSE " + focusedClass.name.toUpperCase()}</button>
            </div>
          </section>
        </div>}
      </div>

      <div className="px-panel px-depart">
        <p className="px-copy" role="status">{isHost
          ? undecided > 0 ? (undecided === 1 ? "One adventurer is" : undecided + " adventurers are") + " still choosing a class." : "Everyone is ready. The catacombs await."
          : selectedClassId ? "You are ready. Waiting for the host to begin." : "Choose your class. The host can begin once everyone is ready."}</p>
        <div className="px-depart-actions">
          <button className="px-button px-button-danger" onClick={onLeave} disabled={busy}>LEAVE PARTY</button>
          {isHost ? <button className="px-button px-button-primary px-button-large" onClick={onStart} disabled={busy || undecided > 0}>{busy ? "PLEASE WAIT…" : "BEGIN THE ADVENTURE"}</button> : null}
        </div>
        {error ? <p className="px-error" role="alert">{error}</p> : null}
      </div>
    </section>

    {treeOpen && focusedClass ? <div className="px-backdrop" role="presentation" onClick={event => { if (event.target === event.currentTarget) setTreeOpen(false); }}>
      <section className="px-panel px-tree" role="dialog" aria-modal="true" aria-labelledby="class-tree-title">
        <div className="px-tree-head"><Bust classId={focusedClass.id} /><div><p className="px-eyebrow">{focusedClass.name.toUpperCase()} · {focusedClass.archetypeId.toUpperCase()} PATH</p><h2 id="class-tree-title">Talent path preview</h2><p className="px-copy">Spend a talent point between encounters as you level. These are the shared {focusedClass.archetypeId} talents; class-specific trees come later.</p></div><button className="px-button px-button-small" onClick={() => setTreeOpen(false)} aria-label="Close talent tree preview" autoFocus>CLOSE</button></div>
        <div className="px-tree-tiers">{[1, 2].map(tier => <div className="px-tree-tier" key={tier}>
          <div className="px-label">{tier === 1 ? "TIER 1 · FOUNDATION" : "TIER 2 · SPECIALIZATION"}</div>
          {talents.filter(talent => talent.archetype === focusedClass.archetypeId && talent.tier === tier).map(talent => <div className="px-tree-node" key={talent.id}><Icon id={skillIcon(talent.id + " " + talent.name)} /><div><strong>{talent.name}</strong><p>{talent.description}</p><span className="px-label">{talent.requires ? "FOLLOWS " + (talents.find(value => value.id === talent.requires)?.name || "").toUpperCase() : "AVAILABLE FIRST"}</span></div></div>)}
        </div>)}</div>
      </section>
    </div> : null}
  </GameShell>;
}
