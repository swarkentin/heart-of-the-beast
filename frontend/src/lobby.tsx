import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import "./lobby.css";

// Title, connecting, party lobby and class selection screens. All art comes from
// scripts/pixel-art (heroes and the interface kit) so these screens share the bestiary's look.

export type LobbyClass = { id: string; archetypeId: string; name: string; description: string; startingStats: { health: number; power: number; focus: number; agility: number }; startingEquipment: string[]; signatureAbilityId: string; passiveId: string };
export type LobbyNamedRule = { id: string; name: string; description: string };
export type LobbyProfileReward = { id: string; name: string; description: string; category: string; profileLevel?: number; classId?: string; classMasteryLevel?: number };
export type LobbyProfile = { displayName: string; adventurerXp: number; adventurerLevel: number; classMastery: Record<string, { experience: number; level: number }>; unlockedCosmetics: string[] };
/** A class look: armour tier (1-6) and colour variant. Both unlock with class mastery; the server validates them. */
export type HeroSkin = { tier: number; variant: string };
export type LobbySkinTier = { tier: number; rank: string; name: string; description: string; masteryLevel: number };
export type LobbySkinVariant = { id: string; name: string; description: string; masteryLevel: number };
export type LobbySkinCatalog = { classes: { classId: string; tiers: LobbySkinTier[] }[]; variants: LobbySkinVariant[] };
export type LobbyCatalog = { classes: LobbyClass[]; classAvailability: { classId: string; initiallyAvailable: boolean; unlockPolicyId?: string }[]; classAbilities: LobbyNamedRule[]; classPassives: LobbyNamedRule[]; equipment: { id: string; name: string; slot: string }[]; profileRewards: LobbyProfileReward[]; classSkins?: LobbySkinCatalog };
export type LobbyTalent = { id: string; archetype: string; name: string; description: string; tier: number; requires?: string };
export type LobbyRoom = { code: string; ownerPlayerId: string; playerIds: string[]; playerClasses?: Record<string, string>; playerSkins?: Record<string, HeroSkin>; presence?: Record<string, { status: "online" | "disconnected" | "left" }> };

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
// Injected at build time by Vite; empty for local development.
declare const __APP_COMMIT__: string;
const DEPLOY_COMMIT = typeof __APP_COMMIT__ === "string" ? __APP_COMMIT__ : "";

export const DEFAULT_SKIN: HeroSkin = { tier: 1, variant: "heraldic" };
const CLASSIC_SKIN: HeroSkin = { tier: 3, variant: "heraldic" };
/** The look the title screen parades: what every class grows into. */
const ASCENDANT: HeroSkin = { tier: 6, variant: "heraldic" };
// Swatches for the colour variants. Keep in step with VARIANTS in scripts/pixel-art/heroes.mjs
// ("heraldic" is each class's own colours, so it shows the class accent).
const VARIANT_SWATCH: Record<string, [string, string]> = { ember: ["#d07a34", "#8a2f2a"], frost: ["#a9d6ea", "#4d7fa8"], dusk: ["#c08aff", "#3a2f4a"], voidstar: ["#6ffff0", "#1d1638"] };
/** Sheet path (without ".png") under /art/heroes; matches skinPath() in scripts/pixel-art/build-interface.mjs. */
export function heroArt(classId?: string, skin?: HeroSkin) {
  if (!classId || !HERO_ART.has(classId)) return "empty";
  // Rooms from before class looks existed record none: show the classic tier 3 look rather than downgrading them.
  const look = skin ?? CLASSIC_SKIN;
  return classId + "/t" + look.tier + "-" + look.variant;
}
const masteryOf = (profile: LobbyProfile | null | undefined, classId: string) => Math.max(1, profile?.classMastery[classId]?.level || 1);
const sameSkin = (a?: HeroSkin, b?: HeroSkin) => Boolean(a && b && a.tier === b.tier && a.variant === b.variant);
const LOOKS_KEY = "hotb.heroLooks";
function savedLooks(): Record<string, HeroSkin> { try { return JSON.parse(window.localStorage.getItem(LOOKS_KEY) || "{}") as Record<string, HeroSkin>; } catch { return {}; } }
function saveLook(classId: string, skin: HeroSkin) { try { window.localStorage.setItem(LOOKS_KEY, JSON.stringify({ ...savedLooks(), [classId]: skin })); } catch { /* storage unavailable: the look still applies this session */ } }
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
export function HeroSprite({ classId, skin, flourish = 0, hurt = 0, pose = "idle", label }: { classId?: string; skin?: HeroSkin; flourish?: number; hurt?: number; pose?: HeroPose; label?: string }) {
  const art = heroArt(classId, skin);
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

export function Bust({ classId, skin, locked }: { classId?: string; skin?: HeroSkin; locked?: boolean }) {
  return <span className={"px-bust" + (locked ? " px-bust-locked" : "")} aria-hidden="true" style={{ backgroundImage: "url(/art/heroes/" + heroArt(classId, skin) + "-bust.png)" }} />;
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
    <section className="px-panel px-connecting" role="status"><HeroSprite classId="bulwark" skin={{ tier: 3, variant: "heraldic" }} /><p>{message}</p></section>
  </GameShell>;
}

export function SharedMenu({ profile, classes = [], rewards = [], audioControls, actions, onSaveName }: { profile?: LobbyProfile | null; classes?: Pick<LobbyClass, "id" | "name">[]; rewards?: LobbyProfileReward[]; audioControls: ReactNode; actions?: ReactNode; onSaveName?: (name: string) => Promise<void> }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const commitUrl = DEPLOY_COMMIT ? "https://github.com/swarkentin/heart-of-the-beast/commit/" + DEPLOY_COMMIT : "";
  const versionLabel = DEPLOY_COMMIT ? DEPLOY_COMMIT.slice(0, 7) : "development";
  useEffect(() => {
    if (!profileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setProfileOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [profileOpen]);
  return <>
  <details className="px-shared-menu">
    <summary className="px-button px-button-small">MENU</summary>
    <div className="px-panel px-shared-menu-panel">
      <button type="button" className="px-button px-button-small" disabled={!profile} onClick={event => { event.currentTarget.closest("details")?.removeAttribute("open"); setProfileOpen(true); }}>PROFILE & COLLECTION</button>
      <div className="px-menu-audio"><strong className="px-menu-title">SOUND</strong>{audioControls}</div>
      {actions ? <div className="px-menu-context"><span className="px-menu-title">PARTY</span>{actions}</div> : null}
      <div className="px-menu-about">
        <strong className="px-menu-title">ABOUT THIS BUILD</strong>
        <span>Version: {versionLabel}</span>
        {commitUrl ? <a href={commitUrl} target="_blank" rel="noreferrer">VIEW GITHUB COMMIT</a> : null}
        <a href="https://github.com/swarkentin/heart-of-the-beast/issues/new" target="_blank" rel="noreferrer">REPORT AN ISSUE</a>
      </div>
    </div>
  </details>
  {profileOpen && profile ? <div className="px-backdrop px-profile-backdrop" role="presentation" onClick={event => { if (event.target === event.currentTarget) setProfileOpen(false); }}>
    <section className="px-panel px-profile-dialog" role="dialog" aria-modal="true" aria-labelledby="px-profile-title">
      <header className="px-profile-dialog-head"><div><p className="px-eyebrow">PROFILE</p><h2 id="px-profile-title">Adventurer collection</h2></div><button type="button" className="px-button px-button-small" onClick={() => setProfileOpen(false)} autoFocus>CLOSE</button></header>
      <ProfileSummary profile={profile} classes={classes} rewards={rewards} onSaveName={onSaveName} />
    </section>
  </div> : null}
  </>;
}

export function TitleScreen({ busy, error, joinCode, onJoinCode, onCreate, onJoin, profile, classes = [], rewards = [], audioControls, onSaveName }: { busy: boolean; error: string; joinCode: string; onJoinCode: (value: string) => void; onCreate: () => void; onJoin: () => void; profile?: LobbyProfile | null; classes?: Pick<LobbyClass, "id" | "name">[]; rewards?: LobbyProfileReward[]; audioControls: ReactNode; onSaveName?: (name: string) => Promise<void> }) {
  const commitUrl = DEPLOY_COMMIT ? "https://github.com/swarkentin/heart-of-the-beast/commit/" + DEPLOY_COMMIT : "";
  const versionLabel = DEPLOY_COMMIT ? DEPLOY_COMMIT.slice(0, 7) : "development";
  return <GameShell status="READY" tools={<SharedMenu profile={profile} classes={classes} rewards={rewards} audioControls={audioControls} onSaveName={onSaveName} />}>
    <section className="px-title">
      <div className="px-title-crest"><Torch /><span className="px-emblem px-emblem-large" aria-hidden="true" /><Torch /></div>
      <p className="px-eyebrow">THE FORGOTTEN CATACOMBS</p>
      <h1 className="px-wordmark">HEART <small>OF THE</small> BEAST</h1>
      <p className="px-lede">A dungeon crawl for one to four. Pick a hero, descend together, and see who makes it back.</p>
      <div className="px-parade" aria-hidden="true"><div className="px-parade-line">{PARADE.map(id => <HeroSprite key={id} classId={id} skin={ASCENDANT} />)}</div></div>
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
    <footer className="px-build-footer">{commitUrl ? <a href={commitUrl} target="_blank" rel="noreferrer">BUILD {versionLabel}</a> : <span>DEVELOPMENT BUILD</span>}</footer>
  </GameShell>;
}

function ProfileSummary({ profile, classes, rewards, onSaveName }: { profile: LobbyProfile; classes: Pick<LobbyClass, "id" | "name">[]; rewards: LobbyProfileReward[]; onSaveName?: (name: string) => Promise<void> }) {
  const [name, setName] = useState(profile.displayName || "Adventurer");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  useEffect(() => setName(profile.displayName || "Adventurer"), [profile.displayName]);
  async function saveName(event: FormEvent) {
    event.preventDefault();
    const clean = name.trim();
    if (!clean || [...clean].length > 18 || !onSaveName) return;
    setSaving(true); setSaveError("");
    try { await onSaveName(clean); } catch (error) { setSaveError(error instanceof Error ? error.message : "Could not save your name"); }
    finally { setSaving(false); }
  }
  const rankXP = profile.adventurerXp % 100;
  const unlockedRewards = profile.unlockedCosmetics.slice().reverse().map(id => rewards.find(reward => reward.id === id)).filter((reward): reward is LobbyProfileReward => Boolean(reward));
  return <section className="px-profile-summary" aria-label="Adventurer progression">
    <form className="px-profile-name" onSubmit={saveName}><label htmlFor="profile-name">ADVENTURER NAME</label><div><input id="profile-name" value={name} maxLength={18} onChange={event => setName(event.target.value)} disabled={saving} /><button className="px-button px-button-small" type="submit" disabled={saving || !name.trim() || name.trim() === profile.displayName}>{saving ? "SAVING..." : "SAVE"}</button></div>{saveError ? <span role="alert" className="px-error">{saveError}</span> : null}</form>
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
        // Earned armour tiers come from the class's armour rewards; tier 1 is always worn.
        const armour = 1 + rewards.filter(reward => reward.category === "armor" && reward.classId === item.id && (mastery.level || 1) >= (reward.classMasteryLevel ?? Infinity)).length;
        return <div className="px-mastery-item" key={item.id}>
          <Bust classId={item.id} skin={{ tier: armour, variant: DEFAULT_SKIN.variant }} />
          <div className="px-mastery-meta"><strong>{item.name}</strong><span>RANK {mastery.level || 1} · ARMOUR T{armour}</span></div>
          <div className="px-mastery-track" role="progressbar" aria-label={item.name + " mastery progress"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={xp}><i style={{ width: xp + "%" }} /></div>
          <span className="px-mastery-xp">{xp}/100 XP</span>
        </div>;
      })}
    </div>
    <div className="px-collection">
      <div className="px-collection-head"><strong>COLLECTION</strong><span>{profile.unlockedCosmetics.length} REWARDS EARNED</span></div>
      {unlockedRewards.length > 0
        ? <ul>{unlockedRewards.map(reward => <li key={reward.id}><span className="px-collection-kind">{reward.category.toUpperCase()}</span><strong>{reward.name}</strong><small>{reward.description}</small></li>)}</ul>
        : <p>{rewards.length === 0 ? "Preparing your collection…" : "Your first title arrives at Adventurer Rank 2 or Class Mastery Rank 2."}</p>}
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

/**
 * Armour tiers and colour variants for one class. Every look can be previewed; only looks the class mastery
 * has earned can be worn, and each locked one says the mastery rank that earns it.
 */
function SkinPicker({ classId, className, accent, tiers, variants, mastery, shown, worn, onPick }: { classId: string; className: string; accent: string; tiers: LobbySkinTier[]; variants: LobbySkinVariant[]; mastery: number; shown: HeroSkin; worn: HeroSkin; onPick: (skin: HeroSkin) => void }) {
  const tier = tiers.find(item => item.tier === shown.tier) ?? tiers[0];
  const variant = variants.find(item => item.id === shown.variant) ?? variants[0];
  const upcoming = [...tiers.map(item => ({ level: item.masteryLevel, label: "Tier " + item.tier + " · " + item.name })), ...variants.map(item => ({ level: item.masteryLevel, label: item.name + " colours" }))].filter(item => item.level > mastery);
  const nextLevel = Math.min(...upcoming.map(item => item.level));
  const next = upcoming.filter(item => item.level === nextLevel);
  const earnedTiers = tiers.filter(item => mastery >= item.masteryLevel).length, earnedVariants = variants.filter(item => mastery >= item.masteryLevel).length;
  return <section className="px-skins" aria-label={className + " appearance"}>
    <div className="px-skins-head"><span className="px-label">ARMOUR &amp; COLOURS</span><span className="px-skins-count">{earnedTiers}/{tiers.length} SETS · {earnedVariants}/{variants.length} COLOURS</span></div>
    <div className="px-skin-tiers" role="radiogroup" aria-label={className + " armour tier"}>
      {tiers.map(item => {
        const locked = mastery < item.masteryLevel, look = { tier: item.tier, variant: shown.variant };
        return <button key={item.tier} type="button" role="radio" aria-checked={item.tier === shown.tier} className={"px-skin-tier" + (item.tier === shown.tier ? " px-skin-on" : "") + (locked ? " px-skin-locked" : "") + (sameSkin(look, worn) ? " px-skin-worn" : "")}
          title={item.name + " (" + item.rank + ")" + (locked ? " · unlocks at mastery rank " + item.masteryLevel : "")} aria-label={"Tier " + item.tier + ", " + item.name + (locked ? ", locked until mastery rank " + item.masteryLevel : "")} onClick={() => onPick(look)}>
          <Bust classId={classId} skin={look} />
          <b>{locked ? <><Icon id="locked" size={1} />M{item.masteryLevel}</> : "T" + item.tier}</b>
        </button>;
      })}
    </div>
    <div className="px-skin-variants" role="radiogroup" aria-label={className + " colours"}>
      {variants.map(item => {
        const locked = mastery < item.masteryLevel, [light, dark] = VARIANT_SWATCH[item.id] ?? [accent, "#2a2440"];
        return <button key={item.id} type="button" role="radio" aria-checked={item.id === shown.variant} className={"px-swatch" + (item.id === shown.variant ? " px-skin-on" : "") + (locked ? " px-skin-locked" : "")}
          style={vars({ "--sw-a": light, "--sw-b": dark })} title={item.name + (locked ? " · unlocks at mastery rank " + item.masteryLevel : "")} aria-label={item.name + (locked ? ", locked until mastery rank " + item.masteryLevel : "")} onClick={() => onPick({ tier: shown.tier, variant: item.id })}>
          <i aria-hidden="true" />{locked ? <Icon id="locked" size={1} /> : null}
        </button>;
      })}
    </div>
    <p className="px-skin-name"><strong>{tier?.name}</strong><span>{tier?.rank.toUpperCase()} · {variant?.name.toUpperCase()}</span></p>
    <p className="px-skin-desc">{tier?.description}</p>
    {next.length > 0
      ? <p className="px-skin-next"><Icon id="locked" size={1} /><span>NEXT AT MASTERY {nextLevel}: {next.map(item => item.label).join(" + ")}</span></p>
      : <p className="px-skin-next px-skin-done"><Icon id="ready" size={1} /><span>EVERY {className.toUpperCase()} LOOK UNLOCKED</span></p>}
  </section>;
}

export function PartyLobby({ room, catalog, playerId, isHost, busy, error, talents, themes = [], themeId = "random", onTheme, profile, audioControls, onSaveName, onSelectClass, onStart, onLeave }: { themes?: { id: string; name: string; tagline: string }[]; themeId?: string; onTheme?: (themeId: string) => void; room: LobbyRoom; catalog: LobbyCatalog | null; playerId: string; isHost: boolean; busy: boolean; error: string; talents: LobbyTalent[]; profile?: LobbyProfile | null; audioControls: ReactNode; onSaveName?: (name: string) => Promise<void>; onSelectClass: (classId: string, skin?: HeroSkin) => void; onStart: () => void; onLeave: () => void }) {
  const [previewClassId, setPreviewClassId] = useState("");
  const [treeOpen, setTreeOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [flourish, setFlourish] = useState(0);
  // Looks being previewed this visit, per class. They may be locked; only earned looks are worn.
  const [previews, setPreviews] = useState<Record<string, HeroSkin>>({});

  const present = room.playerIds.filter(id => room.presence?.[id]?.status !== "left");
  const selectedClassId = room.playerClasses?.[playerId];
  const className = (id?: string) => catalog?.classes.find(item => item.id === id)?.name;
  const isAvailable = (id: string) => Boolean(catalog?.classAvailability.find(value => value.classId === id)?.initiallyAvailable);
  const playable = catalog?.classes.filter(item => isAvailable(item.id) || item.id === selectedClassId) ?? [];
  const locked = catalog?.classes.filter(item => !isAvailable(item.id) && item.id !== selectedClassId) ?? [];
  const focusedClass = playable.find(item => item.id === (previewClassId || selectedClassId)) ?? playable[0];
  const undecided = present.filter(id => !room.playerClasses?.[id]).length;
  const skinCatalog = catalog?.classSkins;
  const tiersFor = (id: string) => skinCatalog?.classes.find(item => item.classId === id)?.tiers ?? [];
  const variants = skinCatalog?.variants ?? [];
  const lookLevel = (id: string, look: HeroSkin) => Math.max(tiersFor(id).find(item => item.tier === look.tier)?.masteryLevel ?? Infinity, variants.find(item => item.id === look.variant)?.masteryLevel ?? Infinity);
  const earned = (id: string, look: HeroSkin) => masteryOf(profile, id) >= lookLevel(id, look);
  const bestLook = (id: string): HeroSkin => ({ tier: Math.max(1, ...tiersFor(id).filter(item => masteryOf(profile, id) >= item.masteryLevel).map(item => item.tier)), variant: DEFAULT_SKIN.variant });
  /** What a class wears: the server's record for your chosen class, else your last look for it, else its best armour. */
  const wornLook = (id: string): HeroSkin => {
    if (id === selectedClassId && room.playerSkins?.[playerId]) return room.playerSkins[playerId];
    const saved = savedLooks()[id];
    return saved && earned(id, saved) ? saved : bestLook(id);
  };
  const shownLook = (id: string) => previews[id] ?? wornLook(id);
  function pickLook(id: string, look: HeroSkin) {
    setPreviews(value => ({ ...value, [id]: look }));
    if (!earned(id, look)) return;
    saveLook(id, look);
    if (id === selectedClassId && !sameSkin(look, room.playerSkins?.[playerId])) onSelectClass(id, look);
  }
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
  const focusedMastery = focusedClass ? profile?.classMastery[focusedClass.id] || { experience: 0, level: 1 } : { experience: 0, level: 1 };
  const focusedMasteryProgress = focusedMastery.experience % 100;
  const focusedLook = focusedClass ? shownLook(focusedClass.id) : DEFAULT_SKIN;
  const focusedLocked = Boolean(focusedClass && skinCatalog && !earned(focusedClass.id, focusedLook));
  const groups = [...ARCHETYPES.map(item => ({ ...item, classes: playable.filter(value => value.archetypeId === item.id) })), { id: "other", name: "Other", icon: "strike" as IconId, blurb: "", classes: playable.filter(value => !ARCHETYPES.some(item => item.id === value.archetypeId)) }].filter(group => group.classes.length > 0);

  return <GameShell status="PARTY LOBBY" tools={<SharedMenu profile={profile} classes={catalog?.classes ?? []} rewards={catalog?.profileRewards ?? []} audioControls={audioControls} onSaveName={onSaveName} actions={<button type="button" className="px-button px-button-small px-button-danger" onClick={onLeave} disabled={busy}>LEAVE PARTY</button>} />}>
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
              <HeroSprite classId={classId} skin={room.playerSkins?.[id]} flourish={you ? flourish : 0} label={className(classId) || "Undecided adventurer"} />
              <div className="px-nameplate">
                <span>{host ? "HOST" : "PLAYER " + (room.playerIds.indexOf(id) + 1)}{you ? " · YOU" : ""}</span>
                <strong>{you && profile ? profile.displayName : className(classId) || "Choosing…"}</strong>
                <em className={"px-presence px-presence-" + status}>{status === "online" ? (classId ? "READY" : "DECIDING") : "OFFLINE"}</em>
              </div>
            </li>;
          })}
          <li className="px-stage-torch" aria-hidden="true"><Torch /></li>
        </ul>
      </div>

      <div className="px-panel px-classes">
        <div className="px-classes-head"><p className="px-eyebrow">CREATE YOUR ADVENTURER</p><h2>Choose your path</h2><p className="px-copy">Every class can survive the catacombs alone. Pick the way of fighting that feels like yours.</p></div>
        {!catalog ? <p className="px-copy" role="status">Preparing the class roster…</p> : !focusedClass ? <p className="px-copy">No classes are available yet.</p> : <div className="px-classes-body">
          <div className="px-roster" aria-label="Choose a class">
            {groups.map(group => <div className="px-roster-group" key={group.id}>
              <div className="px-roster-label"><Icon id={group.icon} size={1} /><b>{group.name.toUpperCase()}</b><span>{group.blurb}</span></div>
              <div className="px-roster-row">{group.classes.map(item => {
                const mastery = profile?.classMastery[item.id] || { experience: 0, level: 1 };
                const progress = mastery.experience % 100;
                return <button key={item.id} className={"px-class" + (item.id === focusedClass.id ? " px-class-focused" : "") + (item.id === selectedClassId ? " px-class-chosen" : "")} style={vars({ "--accent": ACCENTS[item.id] || "#d6a64d" })} onClick={() => setPreviewClassId(item.id)} aria-pressed={item.id === focusedClass.id}>
                  <Bust classId={item.id} skin={wornLook(item.id)} />
                  <strong>{item.name}</strong>
                  <span className="px-class-mastery-mini" title={item.name + " mastery rank " + (mastery.level || 1) + ", " + progress + " percent to next rank"} aria-label={item.name + " mastery rank " + (mastery.level || 1) + ", " + progress + " percent progress"}>
                    <b>M{mastery.level || 1}</b><span><span style={vars({ width: progress + "%" })} /></span>
                  </span>
                  {item.id === selectedClassId ? <i><Icon id="ready" size={1} /><span className="px-sr">Your chosen class</span></i> : null}
                </button>;
              })}</div>
            </div>)}
            {locked.length > 0 ? <div className="px-roster-group">
              <div className="px-roster-label"><Icon id="locked" size={1} /><b>LOCKED PATHS</b><span>Earned through play</span></div>
              <div className="px-roster-row">{locked.map(item => <div key={item.id} className="px-class px-class-locked" title={item.description}><Bust classId={item.id} locked /><strong>{item.name}</strong></div>)}</div>
            </div> : null}
          </div>

          <section className="px-detail" aria-live="polite" style={vars({ "--accent": ACCENTS[focusedClass.id] || "#d6a64d" })}>
            <div className={"px-showcase" + (focusedLocked ? " px-showcase-locked" : "")}><div className="px-showcase-floor" /><HeroSprite key={focusedClass.id} classId={focusedClass.id} skin={focusedLook} flourish={focusedClass.id === selectedClassId ? flourish : 0} label={focusedClass.name + " hero"} />
              {focusedLocked ? <span className="px-showcase-lock"><Icon id="locked" size={1} />MASTERY {lookLevel(focusedClass.id, focusedLook)}</span> : null}
            </div>
            <div className="px-detail-copy">
              <div className="px-detail-title"><h3>{focusedClass.name}</h3><span className="px-chip">{archetype ? <Icon id={archetype.icon} size={1} /> : null}{(archetype?.name || focusedClass.archetypeId).toUpperCase()}</span></div>
              <div className="px-selected-mastery"><strong>CLASS MASTERY · RANK {focusedMastery.level || 1}</strong><span>{focusedMasteryProgress}/100 XP TO NEXT RANK</span><div role="progressbar" aria-label={focusedClass.name + " mastery progress"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={focusedMasteryProgress}><i style={{ width: focusedMasteryProgress + "%" }} /></div></div>
              <p className="px-copy">{focusedClass.description}</p>
              <dl className="px-stats">
                <div><dt><Icon id="vitality" />Vitality</dt><dd><b>{focusedClass.startingStats.health}</b></dd></div>
                <div><dt><Icon id="power" />Power</dt><dd><b>{focusedClass.startingStats.power}</b><Pips value={focusedClass.startingStats.power} /></dd></div>
                <div><dt><Icon id="focus" />Focus</dt><dd><b>{focusedClass.startingStats.focus}</b><Pips value={focusedClass.startingStats.focus} /></dd></div>
                <div><dt><Icon id="agility" />Agility</dt><dd><b>{focusedClass.startingStats.agility}</b><Pips value={focusedClass.startingStats.agility} /></dd></div>
              </dl>
            </div>
            {tiersFor(focusedClass.id).length > 0 ? <SkinPicker classId={focusedClass.id} className={focusedClass.name} accent={ACCENTS[focusedClass.id] || "#d6a64d"} tiers={tiersFor(focusedClass.id)} variants={variants} mastery={masteryOf(profile, focusedClass.id)} shown={focusedLook} worn={wornLook(focusedClass.id)} onPick={look => pickLook(focusedClass.id, look)} /> : null}
            <div className="px-skills">
              <article><Icon id={skillIcon(focusedClass.signatureAbilityId)} size={3} /><div><span className="px-label">SIGNATURE SKILL</span><strong>{ability?.name || "Signature ability"}</strong><p>{ability?.description}</p></div></article>
              <article><Icon id={skillIcon(focusedClass.passiveId)} size={3} /><div><span className="px-label">ALWAYS WITH YOU</span><strong>{passive?.name || "Passive trait"}</strong><p>{passive?.description}</p></div></article>
            </div>
            <p className="px-gear"><span className="px-label">STARTING GEAR</span>{gear.join(" · ")}</p>
            <div className="px-detail-actions">
              <button className="px-button" onClick={() => setTreeOpen(true)}>TALENT TREE</button>
              <button className="px-button px-button-primary" onClick={() => onSelectClass(focusedClass.id, skinCatalog ? (focusedLocked ? wornLook(focusedClass.id) : focusedLook) : undefined)} disabled={busy || focusedClass.id === selectedClassId}>{focusedClass.id === selectedClassId ? "YOUR CHOSEN PATH" : busy ? "SAVING…" : "CHOOSE " + focusedClass.name.toUpperCase()}</button>
            </div>
          </section>
        </div>}
      </div>

      <div className="px-panel px-depart">
        <p className="px-copy" role="status">{isHost
          ? undecided > 0 ? (undecided === 1 ? "One adventurer is" : undecided + " adventurers are") + " still choosing a class." : "Everyone is ready. Choose a dungeon and begin."
          : selectedClassId ? "You are ready. Waiting for the host to begin." : "Choose your class. The host can begin once everyone is ready."}</p>
        {isHost && themes.length > 0 ? <label className="px-dungeon"><span className="px-label">DUNGEON</span>
          <select value={themeId} onChange={event => onTheme?.(event.target.value)} disabled={busy}>
            <option value="random">Surprise us (random dungeon)</option>
            {themes.map(theme => <option key={theme.id} value={theme.id}>{theme.name}</option>)}
          </select>
          <small>{themes.find(theme => theme.id === themeId)?.tagline ?? "Four to six floors, a camp between each, and a boss at the bottom."}</small>
        </label> : null}
        <div className="px-depart-actions">
          <button className="px-button px-button-danger" onClick={onLeave} disabled={busy}>LEAVE PARTY</button>
          {isHost ? <button className="px-button px-button-primary px-button-large" onClick={onStart} disabled={busy || undecided > 0}>{busy ? "PLEASE WAIT…" : "BEGIN THE ADVENTURE"}</button> : null}
        </div>
        {error ? <p className="px-error" role="alert">{error}</p> : null}
      </div>
    </section>

    {treeOpen && focusedClass ? <div className="px-backdrop" role="presentation" onClick={event => { if (event.target === event.currentTarget) setTreeOpen(false); }}>
      <section className="px-panel px-tree" role="dialog" aria-modal="true" aria-labelledby="class-tree-title">
        <div className="px-tree-head"><Bust classId={focusedClass.id} skin={focusedLook} /><div><p className="px-eyebrow">{focusedClass.name.toUpperCase()} · {focusedClass.archetypeId.toUpperCase()} PATH</p><h2 id="class-tree-title">Talent path preview</h2><p className="px-copy">Spend a talent point between encounters as you level. These are the shared {focusedClass.archetypeId} talents; class-specific trees come later.</p></div><button className="px-button px-button-small" onClick={() => setTreeOpen(false)} aria-label="Close talent tree preview" autoFocus>CLOSE</button></div>
        <div className="px-tree-tiers">{[1, 2].map(tier => <div className="px-tree-tier" key={tier}>
          <div className="px-label">{tier === 1 ? "TIER 1 · FOUNDATION" : "TIER 2 · SPECIALIZATION"}</div>
          {talents.filter(talent => talent.archetype === focusedClass.archetypeId && talent.tier === tier).map(talent => <div className="px-tree-node" key={talent.id}><Icon id={skillIcon(talent.id + " " + talent.name)} /><div><strong>{talent.name}</strong><p>{talent.description}</p><span className="px-label">{talent.requires ? "FOLLOWS " + (talents.find(value => value.id === talent.requires)?.name || "").toUpperCase() : "AVAILABLE FIRST"}</span></div></div>)}
        </div>)}</div>
      </section>
    </div> : null}
  </GameShell>;
}
