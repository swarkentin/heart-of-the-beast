// Developer audition page: open the app with ?audio-preview to hear every theme x state x depth, each boss
// treatment, the run-ending stingers and the per-theme effects. Not linked from the game UI.
import { useRef, useState } from "react";
import { cueKey } from "./cue";
import { MusicEngine } from "./engine";
import { profileFor } from "./profiles";
import { EFFECT_KINDS, MUSIC_STATES, THEME_IDS } from "./types";
import type { Depth, MusicCue, MusicState, ThemeId } from "./types";

const VOLUMES = { muted: false, master: 0.72, music: 0.48, effects: 0.72 };

export function AudioPreview() {
  const engine = useRef<MusicEngine | null>(null);
  if (!engine.current) engine.current = new MusicEngine();
  const [depth, setDepth] = useState<Depth>(1);
  const [variant, setVariant] = useState("default");
  const [playing, setPlaying] = useState("");

  const play = async (theme: ThemeId, state: MusicState, boss?: string) => {
    const e = engine.current!;
    await e.enable();
    e.setVolumes(VOLUMES);
    const cue: MusicCue = { theme, state, depth, variant: profileFor(theme).variants[variant] ? variant : "default", roomId: "preview", ...(boss ? { boss } : {}) };
    e.setCue(cue);
    setPlaying(cueKey(cue));
  };
  const effect = async (kind: (typeof EFFECT_KINDS)[number], theme: ThemeId) => {
    const e = engine.current!;
    await e.enable();
    e.setVolumes(VOLUMES);
    e.playEffect(kind, theme);
  };
  const stop = () => { engine.current?.dispose(); engine.current = new MusicEngine(); setPlaying(""); };

  return <main style={{ fontFamily: "monospace", padding: 16, color: "#ddd", background: "#111", minHeight: "100vh" }}>
    <h1>Audio audition</h1>
    <p>Click any cell to hear it. Switching cells crossfades exactly as in the game. Depth and the catacombs room apply to the next click.</p>
    <p>
      Depth: {([1, 2, 3] as const).map(d => <button key={d} aria-pressed={depth === d} onClick={() => setDepth(d)}>{d}</button>)}{" "}
      Catacombs room: {["default", "flooded", "gate"].map(v => <button key={v} aria-pressed={variant === v} onClick={() => setVariant(v)}>{v}</button>)}{" "}
      <button onClick={stop}>STOP</button> <span data-testid="playing">{playing}</span>
    </p>
    {THEME_IDS.map(theme => {
      const profile = profileFor(theme);
      return <section key={theme} style={{ marginBottom: 14 }}>
        <h2>{profile.name} <small>{profile.scale} · {profile.bpm} bpm</small></h2>
        <div>{MUSIC_STATES.map(state => <button key={state} onClick={() => void play(theme, state)}>{state}</button>)}</div>
        <div>Bosses: {Object.entries(profile.bosses).map(([id, boss]) => <button key={id} title={boss.note} onClick={() => void play(theme, "boss", id)}>{id}</button>)}</div>
        <div>Effects: {EFFECT_KINDS.map(kind => <button key={kind} onClick={() => void effect(kind, theme)}>{kind}</button>)}</div>
      </section>;
    })}
  </main>;
}
