// The sound test: a jukebox for every piece of music and every sound effect in the game, unlocked by player
// progression (and always unlocked when the game runs locally, for development). It drives the game's own music
// engine through an override, so closing it crossfades straight back into whatever the game was playing.
import { useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SoundContext, soundStatus, soundTest } from "./audio";
import { isCapstone } from "./music/cue";
import { profileFor } from "./music/profiles";
import { EFFECT_KINDS, PART_LABELS, PARTS, THEME_IDS } from "./music/types";
import type { Depth, EffectKind, MusicCue, MusicState, Part, ThemeId } from "./music/types";
import type { Position } from "./music/engine";
import "./sound-test.css";

type ProfileProgress = {
  adventurerLevel: number;
  classMastery: Record<string, { level: number; experience: number }>;
};

/** The sound test opens at Adventurer Rank 3 or with one mastery point; the castles' music needs rank 6 or three points. */
export const SOUND_TEST_UNLOCK = { rank: 3, mastery: 1 } as const;
export const CASTLE_MUSIC_UNLOCK = { rank: 6, mastery: 3 } as const;

/** Local development (the Vite dev server, or a build served from this machine) has every track unlocked. */
export function isLocalGame(): boolean {
  if (typeof window === "undefined") return false;
  const dev = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true;
  const host = window.location.hostname;
  return dev || host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1" || host.endsWith(".localhost");
}

export function masteryPoints(profile: ProfileProgress | null | undefined): number {
  return Object.values(profile?.classMastery ?? {}).reduce((sum, mastery) => sum + Math.max(0, (mastery.level || 1) - 1), 0);
}

const meets = (profile: ProfileProgress | null | undefined, need: { rank: number; mastery: number }) =>
  isLocalGame() || (!!profile && (profile.adventurerLevel >= need.rank || masteryPoints(profile) >= need.mastery));

const STATE_TRACKS: { state: MusicState; name: string }[] = [
  { state: "exploration", name: "Exploration" },
  { state: "event", name: "Respite" },
  { state: "combat", name: "Battle" },
  { state: "miniboss", name: "Elite battle" },
  { state: "victory", name: "Victory" },
  { state: "defeat", name: "Defeat" },
];
const EFFECT_NAMES: Record<EffectKind, string> = { impact: "Hit", block: "Block", magic: "Spell", heal: "Heal", defeat: "Enemy falls", door: "Door", encounter: "Ambush", victory: "Room cleared", failure: "Party falls", rankUp: "Rank up", masteryUp: "Mastery up" };
const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

const words = (id: string) => id.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
const title = (id: string) => words(id).replace(/\b\w/g, c => c.toUpperCase());
const keyName = (hz: number) => NOTE_NAMES[((Math.round(12 * Math.log2(hz / 440)) % 12) + 12 + 9) % 12];
const scaleName = (scale: string) => words(scale).replace("pent ", "pentatonic ");

function trackName(cue: MusicCue): string {
  if (cue.state === "title") return "Heart of the Beast";
  if (cue.state === "party") return "Gathering the Party";
  if (cue.state === "boss" && cue.boss) return title(cue.boss) + (cue.phase === 2 ? " · Phase II" : "");
  return STATE_TRACKS.find(t => t.state === cue.state)?.name ?? title(cue.state);
}

function NowPlaying({ position }: { position: Position | null }) {
  if (!position) return <div className="px-sound-now"><strong>Choose a track</strong><small>Everything here is the music and sound the game really plays, synthesised live.</small></div>;
  const { cue, plan } = position;
  const menu = cue.state === "title" || cue.state === "party";
  const profile = profileFor(cue.theme);
  const voices = [plan.voices.lead, plan.voices.counter, plan.voices.arp, plan.voices.bass, plan.voices.pad];
  const boss = cue.boss ? profile.bosses[cue.boss] : undefined;
  return <div className="px-sound-now">
    <span className="px-eyebrow">{menu ? "MAIN THEME" : profile.name.toUpperCase()}</span>
    <strong>{trackName(cue)}</strong>
    <small>{boss?.note ?? (menu ? (cue.state === "title" ? "A heartbeat, a horn and then the whole orchestra." : "The moment before the descent: it builds, drops and builds again.") : profile.character)}</small>
    <dl>
      <div><dt>KEY</dt><dd>{keyName(plan.rootHz)} {scaleName(plan.scale)}</dd></div>
      <div><dt>TEMPO</dt><dd>{Math.round(plan.bpm)} bpm</dd></div>
      <div><dt>SECTION</dt><dd>{position.section} · bar {position.barInSection + 1}</dd></div>
      <div><dt>ENERGY</dt><dd>{Math.round(plan.energy * 100)}%</dd></div>
    </dl>
    <small className="px-sound-voices">{[...new Set(voices)].map(words).join(" · ")}</small>
  </div>;
}

/** A pixel spectrum of the game's output. */
function Visualiser({ active }: { active: boolean }) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const data = new Uint8Array(256);
    const draw = () => {
      frame = requestAnimationFrame(draw);
      const el = canvas.current;
      const analyser = soundTest.analyser();
      if (!el || !analyser) return;
      const g = el.getContext("2d");
      if (!g) return;
      analyser.getByteFrequencyData(data);
      const bars = 32;
      const cell = el.width / bars;
      g.clearRect(0, 0, el.width, el.height);
      for (let b = 0; b < bars; b += 1) {
        // Log-spaced bins, so the bass does not take half the display.
        const lo = Math.floor(2 * Math.pow(analyser.frequencyBinCount / 2, b / bars));
        const hi = Math.max(lo + 1, Math.floor(2 * Math.pow(analyser.frequencyBinCount / 2, (b + 1) / bars)));
        let peak = 0;
        for (let i = lo; i < hi && i < data.length; i += 1) peak = Math.max(peak, data[i]);
        const blocks = Math.round((peak / 255) * 10);
        for (let y = 0; y < blocks; y += 1) {
          g.fillStyle = y >= 8 ? "#e0533f" : y >= 5 ? "#d6a64d" : "#7fc58a";
          g.fillRect(b * cell + 1, el.height - (y + 1) * (el.height / 10) + 1, cell - 2, el.height / 10 - 2);
        }
      }
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [active]);
  return <canvas ref={canvas} className="px-sound-visualiser" width={320} height={64} aria-hidden="true" />;
}

/** The sound test panel: usable inside the menu dialog or as the standalone ?audio-preview page. */
export function SoundTestPanel({ profile, onClose, standalone = false }: { profile?: ProfileProgress | null; onClose?: () => void; standalone?: boolean }) {
  const sound = useContext(SoundContext);
  const [theme, setTheme] = useState<ThemeId>("catacombs");
  const [depth, setDepth] = useState<Depth>(2);
  const [phase, setPhase] = useState<1 | 2>(1);
  const [cue, setCue] = useState<MusicCue | null>(null);
  const [mutes, setMutes] = useState<ReadonlySet<Part>>(new Set());
  const [position, setPosition] = useState<Position | null>(null);
  const castles = meets(profile, CASTLE_MUSIC_UNLOCK);
  const locked = (id: ThemeId) => isCapstone(id) && !castles;
  const status = sound ? soundStatus(sound) : "on";

  useEffect(() => {
    const timer = window.setInterval(() => setPosition(cue ? soundTest.position() : null), 250);
    return () => window.clearInterval(timer);
  }, [cue]);
  // Leaving the sound test hands the music back to the game.
  useEffect(() => () => soundTest.stop(), []);

  const play = (next: Omit<MusicCue, "variant" | "roomId" | "depth"> & { depth?: Depth }) => {
    const full: MusicCue = { depth, variant: "default", roomId: "sound-test", ...next };
    if (full.state === "boss" && phase === 2) full.phase = 2;
    setCue(full);
    void soundTest.start().then(() => { soundTest.setMutes(mutes); soundTest.play(full); });
  };
  // Changing intensity or phase re-cues what is playing.
  const replay = (patch: { depth?: Depth; phase?: 1 | 2 }) => {
    if (!cue || cue.state === "title" || cue.state === "party") return;
    const next: MusicCue = { ...cue, depth: patch.depth ?? cue.depth };
    const p = patch.phase ?? phase;
    if (next.state === "boss" && p === 2) next.phase = 2; else delete next.phase;
    setCue(next);
    soundTest.play(next);
  };
  const toggle = (part: Part) => {
    const next = new Set(mutes);
    if (next.has(part)) next.delete(part); else next.add(part);
    setMutes(next);
    soundTest.setMutes(next);
  };
  const stop = () => { setCue(null); soundTest.stop(); };
  const effect = (kind: EffectKind) => { void soundTest.start().then(() => soundTest.effect(kind, theme)); };
  const isPlaying = (c: Partial<MusicCue>) => !!cue && cue.state === c.state && (c.state === "title" || c.state === "party" || (cue.theme === c.theme && cue.boss === c.boss));
  const profileOfTheme = profileFor(theme);

  return <>
    {status !== "on" && sound ? <div className="px-sound-warning" role="status">
      <span>{status === "muted" ? "The game sound is muted." : status === "off" ? "Sound is turned off." : "Tap to let the browser play sound."}</span>
      <button type="button" className="px-button px-button-small" onClick={sound.toggle}>TURN SOUND ON</button>
    </div> : null}
    <div className="px-sound-deck">
      <NowPlaying position={position} />
      <div className="px-sound-screen"><Visualiser active={!!cue} /><button type="button" className="px-button px-button-small" onClick={stop} disabled={!cue}>■ STOP</button></div>
    </div>
    <div className="px-sound-body">
      <section>
        <h3 className="px-sound-heading">MAIN THEMES</h3>
        <div className="px-sound-tracks">
          {([["title", "Heart of the Beast", "Title screen"], ["party", "Gathering the Party", "Party lobby"]] as const).map(([state, name, where]) =>
            <button type="button" key={state} className="px-sound-track" aria-pressed={isPlaying({ state })} onClick={() => play({ theme: "catacombs", state })}><strong>{name}</strong><small>{where}</small></button>)}
        </div>
      </section>
      <section>
        <h3 className="px-sound-heading">DUNGEON</h3>
        <div className="px-sound-themes" role="group" aria-label="Dungeon theme">
          {THEME_IDS.map(id => <button type="button" key={id} className="px-sound-theme" aria-pressed={theme === id} disabled={locked(id)} onClick={() => setTheme(id)} title={locked(id) ? `Locked: Adventurer Rank ${CASTLE_MUSIC_UNLOCK.rank} or ${CASTLE_MUSIC_UNLOCK.mastery} mastery points` : profileFor(id).name}>
            {locked(id) ? "🔒 " : isCapstone(id) ? "♛ " : ""}{profileFor(id).name.replace(/^The /, "")}
          </button>)}
        </div>
        {!castles ? <p className="px-sound-hint">♛ The castles' music unlocks at Adventurer Rank {CASTLE_MUSIC_UNLOCK.rank} or with {CASTLE_MUSIC_UNLOCK.mastery} mastery points.</p> : null}
        <p className="px-sound-hint">{profileOfTheme.character}</p>
        <div className="px-sound-controls">
          <span>FLOOR INTENSITY</span>
          {([1, 2, 3] as const).map(d => <button type="button" key={d} className="px-button px-button-small" aria-pressed={depth === d} onClick={() => { setDepth(d); replay({ depth: d }); }}>{["SHALLOW", "DEEPER", "DEEPEST"][d - 1]}</button>)}
          <span>BOSS</span>
          {([1, 2] as const).map(p => <button type="button" key={p} className="px-button px-button-small" aria-pressed={phase === p} onClick={() => { setPhase(p); replay({ phase: p }); }}>{p === 1 ? "PHASE I" : "PHASE II"}</button>)}
        </div>
        <div className="px-sound-tracks">
          {STATE_TRACKS.map(t => <button type="button" key={t.state} className="px-sound-track" aria-pressed={isPlaying({ state: t.state, theme })} onClick={() => play({ theme, state: t.state })}><strong>{t.name}</strong><small>{profileOfTheme.name}</small></button>)}
          {Object.entries(profileOfTheme.bosses).map(([id, boss]) => <button type="button" key={id} className="px-sound-track px-sound-boss" aria-pressed={isPlaying({ state: "boss", theme, boss: id })} onClick={() => play({ theme, state: "boss", boss: id })} title={boss.note}><strong>☠ {title(id)}</strong><small>{boss.note}</small></button>)}
        </div>
      </section>
      <section>
        <h3 className="px-sound-heading">MIXER</h3>
        <div className="px-sound-mixer" role="group" aria-label="Mute or unmute parts of the music">
          {PARTS.map(part => <button type="button" key={part} className="px-sound-channel" aria-pressed={!mutes.has(part)} onClick={() => toggle(part)}><i aria-hidden="true" />{PART_LABELS[part]}</button>)}
        </div>
      </section>
      <section>
        <h3 className="px-sound-heading">SOUND EFFECTS · {profileOfTheme.name.toUpperCase()}</h3>
        <div className="px-sound-effects">
          {EFFECT_KINDS.map(kind => <button type="button" key={kind} className="px-button px-button-small" onClick={() => effect(kind)}>{EFFECT_NAMES[kind]}</button>)}
        </div>
      </section>
    </div>
    {onClose || standalone ? <footer className="px-visual-foot">
      <span>{isLocalGame() ? "Running locally: everything is unlocked." : "Closing the sound test returns to the game's music."}</span>
      {onClose ? <button type="button" className="px-button" onClick={onClose}>DONE</button> : null}
    </footer> : null}
  </>;
}

/** The menu entry: opens the sound test, or shows what unlocks it. */
export function SoundTestButton({ profile }: { profile?: ProfileProgress | null }) {
  const [open, setOpen] = useState(false);
  const unlocked = meets(profile, SOUND_TEST_UNLOCK);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.dataset.visualSettingsOpen = "true";
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previousOverflow;
      delete document.documentElement.dataset.visualSettingsOpen;
      window.removeEventListener("keydown", close);
    };
  }, [open]);
  if (!profile && !isLocalGame()) return null;
  const dialog = open ? <div className="px-backdrop px-visual-backdrop" role="presentation" onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}>
    <section className="px-panel px-visual-dialog px-sound-dialog" role="dialog" aria-modal="true" aria-labelledby="px-sound-title">
      <header className="px-visual-head">
        <div><p className="px-eyebrow">THE SOUND OF THE BEAST</p><h2 id="px-sound-title">Sound test</h2></div>
        <button type="button" className="px-button px-button-small" onClick={() => setOpen(false)} aria-label="Close sound test">CLOSE ✕</button>
      </header>
      <SoundTestPanel profile={profile} onClose={() => setOpen(false)} />
    </section>
  </div> : null;
  return <>
    <button type="button" className="px-button px-button-small" disabled={!unlocked} onClick={event => { event.currentTarget.closest("details")?.removeAttribute("open"); setOpen(true); }}
      title={unlocked ? "Listen to every track and sound effect" : `Unlocks at Adventurer Rank ${SOUND_TEST_UNLOCK.rank} or with ${SOUND_TEST_UNLOCK.mastery} mastery point`}>
      {unlocked ? "SOUND TEST" : `🔒 SOUND TEST · RANK ${SOUND_TEST_UNLOCK.rank}`}
    </button>
    {dialog ? createPortal(<div className="px-portal">{dialog}</div>, document.body) : null}
  </>;
}

