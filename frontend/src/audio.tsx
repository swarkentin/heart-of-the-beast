import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { MusicEngine } from "./music/engine";
import { profileFor } from "./music/profiles";
import type { EffectKind, MusicCue, ThemeId } from "./music/types";

export type AudioSettings = {
  enabled: boolean;
  muted: boolean;
  master: number;
  music: number;
  effects: number;
};

const SETTINGS_KEY = "heart-of-the-beast.audio-settings.v2";
const LEGACY_SETTINGS_KEY = "heart-of-the-beast.audio-settings";
const DEFAULT_SETTINGS: AudioSettings = { enabled: true, muted: false, master: 0.72, music: 0.48, effects: 0.72 };

function readSettings(): AudioSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const current = window.localStorage.getItem(SETTINGS_KEY);
    const legacy = !current ? window.localStorage.getItem(LEGACY_SETTINGS_KEY) : null;
    const stored = JSON.parse(current || legacy || "null") as Partial<AudioSettings> | null;
    // The previous version persisted enabled=false only because browsers
    // needed an explicit opt-in each page load; it was not a user preference.
    return stored ? { ...DEFAULT_SETTINGS, ...stored, enabled: current ? stored.enabled ?? true : true } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

const engine = new MusicEngine();

function applyVolumes(settings: AudioSettings) {
  engine.setVolumes({ muted: !settings.enabled || settings.muted, master: settings.master, music: settings.music, effects: settings.effects });
}

/** Per-theme hit/block/heal/spell flavour. Thread-agnostic hook point for combat visuals to trigger sounds directly. */
export type { EffectKind, ThemeId };

export function playEffect(kind: EffectKind, theme: ThemeId) {
  engine.playEffect(kind, theme);
}

export function useGameAudio(cue: MusicCue, phase: string, playerHealth: number, enemyHealths: { id: string; hp: number }[], events: { round: number; kind: string; message: string }[], version: number) {
  const [settings, setSettings] = useState<AudioSettings>(readSettings);
  // Whether the audio context is really playing. Sound can be enabled in settings and still be silent until the
  // browser has seen a gesture, and a phone suspends audio again when the page goes to the background.
  const [running, setRunning] = useState(engine.running);
  useEffect(() => engine.onStateChange(() => setRunning(engine.running)), []);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const previous = useRef<{ roomId: string; phase: string; playerHealth: number; enemies: Record<string, number>; events: string[]; version: number } | null>(null);
  const cueRef = useRef(cue);
  cueRef.current = cue;

  const enable = useCallback(async () => {
    const next = { ...settings, enabled: true, muted: false };
    setSettings(next);
    await engine.enable();
    applyVolumes(next);
    engine.setCue(cueRef.current);
  }, [settings]);

  const updateSettings = useCallback((patch: Partial<AudioSettings>) => {
    setSettings(current => {
      const next = { ...current, ...patch };
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...next, enabled: false }));
      applyVolumes(next);
      return next;
    });
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    applyVolumes(settings);
  }, [settings]);

  // Browsers require a user gesture before Web Audio can start. Sound is enabled by default and starts on the next
  // tap, click or key. Mobile browsers ignore pointerdown/touchstart for this (only the end of a tap counts), so
  // listen for those, and keep listening until the context really runs: a failed attempt, or a phone suspending
  // audio in the background, is retried on the next touch instead of leaving the game silent.
  useEffect(() => {
    if (!settings.enabled || running) return;
    const activate = () => { void engine.enable().then(() => { applyVolumes(settingsRef.current); engine.setCue(cueRef.current); }); };
    const kinds = ["pointerup", "touchend", "click", "keydown"] as const;
    kinds.forEach(kind => window.addEventListener(kind, activate, { capture: true }));
    return () => kinds.forEach(kind => window.removeEventListener(kind, activate, true));
  }, [settings.enabled, running]);

  // The cue is derived from the authoritative snapshot, so a reconnect lands on the right score. The engine ignores
  // cues with an unchanged identity and crossfades otherwise.
  useEffect(() => {
    if (settings.enabled) engine.setCue(cue);
  }, [cue.theme, cue.state, cue.depth, cue.boss, cue.variant, settings.enabled]);

  useEffect(() => {
    const before = previous.current;
    const theme = cue.theme;
    const enemies = Object.fromEntries(enemyHealths.map(enemy => [enemy.id, enemy.hp]));
    const eventKeys = events.map(event => event.round + ":" + event.kind + ":" + event.message);
    if (settings.enabled && before && version !== before.version) {
      if (cue.roomId !== before.roomId) engine.playEffect("door", theme);
      else {
        const freshEvents = events.filter((_, index) => !before.events.includes(eventKeys[index]));
        const kinds = new Set(freshEvents.map(event => event.kind));
        // Hits, blocks, spells, heals and defeats are played by the combat stage (monsters/EnemyStage) at the moment
        // their visuals land, so they are not triggered here. This hook keeps the encounter-level sounds.
        // Run-ending stingers belong to the music engine (they play as part of the victory/defeat cue); only the encounter-clear chime is an effect.
        if (kinds.has("victory")) engine.playEffect("victory", theme);
        if (freshEvents.length === 0 && phase === "combat" && before.phase !== "combat") engine.playEffect("encounter", theme);
        if (freshEvents.length === 0 && playerHealth < before.playerHealth) engine.playEffect("impact", theme);
        if (freshEvents.length === 0 && enemyHealths.some(enemy => enemy.hp < (before.enemies[enemy.id] ?? enemy.hp))) {
          const defeated = enemyHealths.some(enemy => enemy.hp <= 0 && (before.enemies[enemy.id] ?? 0) > 0);
          engine.playEffect(defeated ? "defeat" : "impact", theme);
        }
      }
    }
    previous.current = { roomId: cue.roomId, phase, playerHealth, enemies, events: eventKeys, version };
  }, [cue.roomId, cue.theme, phase, playerHealth, enemyHealths, events, version, settings.enabled]);

  /** One tap: start or unmute the sound, or mute it when it is playing. */
  const toggle = useCallback(() => {
    if (running && settings.enabled && !settings.muted) updateSettings({ muted: true });
    else void enable();
  }, [running, settings.enabled, settings.muted, enable, updateSettings]);

  return { settings, running, enable, toggle, updateSettings, title: `THE SOUND OF ${profileFor(cue.theme).name.toUpperCase()}` };
}

export type SoundState = { settings: AudioSettings; running: boolean; toggle: () => void };
/** The game sound, for controls anywhere in the tree (the top-bar sound button, the title screen prompt). */
export const SoundContext = createContext<SoundState | null>(null);

/** What a player hears right now: "on", "muted", "off" (turned off in settings) or "waiting" (enabled, but the
 * browser has not had the tap it needs to start audio). */
export function soundStatus(sound: SoundState): "on" | "muted" | "off" | "waiting" {
  if (!sound.settings.enabled) return "off";
  if (!sound.running) return "waiting";
  return sound.settings.muted ? "muted" : "on";
}

const SOUND_LABEL = { on: "SOUND ON", muted: "MUTED", off: "SOUND OFF", waiting: "TAP FOR SOUND" } as const;

/** A one-tap sound toggle for the top bar, so turning sound on never means digging through a menu on a phone. */
export function SoundButton({ large = false }: { large?: boolean }) {
  const sound = useContext(SoundContext);
  if (!sound) return null;
  const status = soundStatus(sound);
  if (large && status === "on") return null;
  const playing = status === "on";
  return <button type="button" className={"px-button " + (large ? "px-sound-prompt" : "px-button-small px-sound-button") + " px-sound-" + status} onClick={sound.toggle} aria-pressed={playing} aria-label={playing ? "Mute sound" : "Turn sound on"} title={playing ? "Mute sound" : "Turn sound on"}>
    <span aria-hidden="true">{playing ? "♫" : "♪"}</span><span className="px-sound-text">{large ? "TURN ON SOUND" : SOUND_LABEL[status]}</span>
  </button>;
}

export function AudioControls({ settings, running = true, onEnable, onChange, title = "THE SOUND OF THE CATACOMBS" }: {
  settings: AudioSettings;
  running?: boolean;
  onEnable: () => void;
  onChange: (patch: Partial<AudioSettings>) => void;
  title?: string;
}) {
  return <details className="audio-controls">
    <summary aria-label="Audio settings">♫ SOUND {settings.enabled && running && !settings.muted ? "ON" : "OFF"}</summary>
    <div className="audio-panel">
      <div className="audio-panel-heading"><strong>{title}</strong><button onClick={() => settings.enabled && running ? onChange({ enabled: false }) : onEnable()}>{settings.enabled && running ? "TURN SOUND OFF" : "TURN SOUND ON"}</button><button onClick={() => onChange({ muted: !settings.muted })}>{settings.muted ? "UNMUTE" : "MUTE"}</button></div>
      {([
        ["master", "MASTER"],
        ["music", "MUSIC"],
        ["effects", "EFFECTS"],
      ] as const).map(([key, label]) => <label key={key}><span>{label}</span><input type="range" min="0" max="1" step="0.01" value={settings[key]} onChange={event => onChange({ [key]: Number(event.target.value) })} /></label>)}
      <small>Original synthesized audio · adjust to taste</small>
    </div>
  </details>;
}
