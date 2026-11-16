import { useCallback, useEffect, useRef, useState } from "react";
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

  // Browsers require a user gesture before Web Audio can start. Keep sound enabled by default, then start it on
  // the first interaction; the engine applies whatever cue is current at that moment.
  useEffect(() => {
    if (!settings.enabled) return;
    let activated = false;
    const activate = () => {
      if (activated) return;
      activated = true;
      void engine.enable().then(() => { applyVolumes(settings); engine.setCue(cueRef.current); });
    };
    window.addEventListener("pointerdown", activate, { once: true, capture: true });
    window.addEventListener("keydown", activate, { once: true, capture: true });
    return () => {
      window.removeEventListener("pointerdown", activate, true);
      window.removeEventListener("keydown", activate, true);
    };
  }, [settings]);

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

  return { settings, enable, updateSettings, title: `THE SOUND OF ${profileFor(cue.theme).name.toUpperCase()}` };
}

export function AudioControls({ settings, onEnable, onChange, title = "THE SOUND OF THE CATACOMBS" }: {
  settings: AudioSettings;
  onEnable: () => void;
  onChange: (patch: Partial<AudioSettings>) => void;
  title?: string;
}) {
  return <details className="audio-controls">
    <summary aria-label="Audio settings">♫ SOUND {settings.enabled && !settings.muted ? "ON" : "OFF"}</summary>
    <div className="audio-panel">
      <div className="audio-panel-heading"><strong>{title}</strong><button onClick={() => settings.enabled ? onChange({ enabled: false }) : onEnable()}>{settings.enabled ? "TURN SOUND OFF" : "TURN SOUND ON"}</button><button onClick={() => onChange({ muted: !settings.muted })}>{settings.muted ? "UNMUTE" : "MUTE"}</button></div>
      {([
        ["master", "MASTER"],
        ["music", "MUSIC"],
        ["effects", "EFFECTS"],
      ] as const).map(([key, label]) => <label key={key}><span>{label}</span><input type="range" min="0" max="1" step="0.01" value={settings[key]} onChange={event => onChange({ [key]: Number(event.target.value) })} /></label>)}
      <small>Original synthesized audio · adjust to taste</small>
    </div>
  </details>;
}
