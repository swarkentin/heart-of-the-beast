import { useCallback, useEffect, useRef, useState } from "react";

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

class GameAudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private effects: GainNode | null = null;
  private sceneNodes: AudioNode[] = [];
  private musicTimer: number | null = null;
  private noteIndex = 0;

  async enable(settings: AudioSettings) {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.music = this.context.createGain();
      this.effects = this.context.createGain();
      this.music.connect(this.master);
      this.effects.connect(this.master);
      this.master.connect(this.context.destination);
    }
    await this.context.resume();
    this.setVolumes(settings);
  }

  setVolumes(settings: AudioSettings) {
    if (!this.context || !this.master || !this.music || !this.effects) return;
    const now = this.context.currentTime;
    this.master.gain.setTargetAtTime(!settings.enabled || settings.muted ? 0 : settings.master, now, 0.04);
    this.music.gain.setTargetAtTime(settings.music, now, 0.04);
    this.effects.gain.setTargetAtTime(settings.effects, now, 0.025);
  }

  startScene(room: string, combat: boolean) {
    if (!this.context || !this.music || !this.effects) return;
    this.stopScene();
    const context = this.context;
    const flooded = room === "flooded-crossing";
    const gate = room === "warden-gate";
    const root = gate ? 38.89 : flooded ? 55 : 73.42;
    const padFilter = context.createBiquadFilter();
    padFilter.type = "lowpass";
    padFilter.frequency.value = flooded ? 190 : gate ? 260 : 330;
    padFilter.Q.value = 0.7;
    padFilter.connect(this.music);
    this.sceneNodes.push(padFilter);

    [root, root * 1.5, root * 2].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = index === 0 ? "triangle" : "sine";
      oscillator.frequency.value = frequency;
      oscillator.detune.value = index === 1 ? -4 : index === 2 ? 5 : 0;
      gain.gain.value = index === 0 ? 0.18 : index === 1 ? 0.11 : 0.045;
      oscillator.connect(gain);
      gain.connect(padFilter);
      oscillator.start();
      this.sceneNodes.push(oscillator, gain);
    });

    // A soft, filtered noise bed gives the room a little air without becoming static.
    const ambience = context.createBufferSource();
    const noise = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
    const channel = noise.getChannelData(0);
    for (let i = 0; i < channel.length; i += 1) channel[i] = (Math.random() * 2 - 1) * 0.22;
    ambience.buffer = noise;
    ambience.loop = true;
    const ambienceFilter = context.createBiquadFilter();
    ambienceFilter.type = "lowpass";
    ambienceFilter.frequency.value = flooded ? 420 : 700;
    const ambienceGain = context.createGain();
    ambienceGain.gain.value = flooded ? 0.13 : 0.075;
    ambience.connect(ambienceFilter);
    ambienceFilter.connect(ambienceGain);
    ambienceGain.connect(this.music);
    ambience.start();
    this.sceneNodes.push(ambience, ambienceFilter, ambienceGain);

    this.noteIndex = 0;
    const motif = flooded ? [220, 261.63, 293.66, 261.63, 196, 220] : gate ? [155.56, 185, 207.65, 185, 138.59, 155.56] : [293.66, 349.23, 392, 349.23, 261.63, 293.66];
    const playMusicNote = () => {
      if (!this.context || !this.music) return;
      const note = motif[this.noteIndex % motif.length];
      this.noteIndex += 1;
      this.tone(note, combat ? 1.45 : 1.7, combat ? "triangle" : "sine", combat ? 0.065 : 0.035, this.music, -8);
      if (combat) {
        // A warmer, more audible pulse gives combat forward motion without losing the low drone.
        this.tone(root * 2, 0.34, "triangle", 0.14, this.music, -3);
        if (this.noteIndex % 2 === 0) this.tone(root * 3, 0.2, "sine", 0.075, this.music, 4, 0.12);
      }
    };
    this.musicTimer = window.setInterval(playMusicNote, combat ? 2100 : 3100);
    playMusicNote();
    if (combat) this.tone(root, 0.65, "triangle", 0.12, this.music, -12);
  }

  stopScene() {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
    for (const node of this.sceneNodes) {
      try {
        if (node instanceof OscillatorNode || node instanceof AudioBufferSourceNode) node.stop();
        node.disconnect();
      } catch { /* A node may already have stopped. */ }
    }
    this.sceneNodes = [];
  }

  effect(name: "impact" | "block" | "magic" | "defeat" | "door" | "encounter" | "victory" | "failure") {
    if (!this.context || !this.effects) return;
    const effects = this.effects;
    if (name === "impact") {
      // A weapon hit should read as crack + body + weight, not a pitched "boop".
      this.noiseBurst(0.045, 3200, 0.28);
      this.crunch(0.075, 0.3);
      this.sweep(125, 48, 0.14, "triangle", 0.3);
      this.noiseBurst(0.095, 620, 0.16);
    } else if (name === "block") {
      this.noiseBurst(0.12, 850, 0.12);
      this.tone(185, 0.14, "triangle", 0.18, effects, -10);
      this.tone(740, 0.07, "sine", 0.08, effects, -12);
    } else if (name === "magic") {
      this.sweep(310, 920, 0.34, "sine", 0.16);
      this.noiseBurst(0.24, 2400, 0.07);
    } else if (name === "defeat") {
      this.noiseBurst(0.28, 520, 0.2);
      this.sweep(180, 48, 0.42, "sawtooth", 0.18);
    } else if (name === "door") {
      this.noiseBurst(0.38, 480, 0.11);
      this.sweep(110, 54, 0.45, "triangle", 0.13);
    } else if (name === "encounter") {
      this.tone(110, 0.5, "triangle", 0.18, effects, -8);
      this.tone(164.81, 0.65, "sine", 0.1, effects, -12);
    } else if (name === "victory") {
      [293.66, 369.99, 440].forEach((frequency, index) => this.tone(frequency, 0.8, "sine", 0.12, effects, -5 + index * 2, index * 0.08));
    } else if (name === "failure") {
      this.sweep(220, 55, 0.9, "triangle", 0.17);
    }
  }

  private tone(frequency: number, duration: number, type: OscillatorType, volume: number, destination: AudioNode, cents = 0, delay = 0) {
    if (!this.context) return;
    const context = this.context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.detune.value = cents;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  private sweep(from: number, to: number, duration: number, type: OscillatorType, volume: number) {
    if (!this.context || !this.effects) return;
    const context = this.context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, now);
    oscillator.frequency.exponentialRampToValueAtTime(to, now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.effects);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
  }

  private crunch(duration: number, volume: number) {
    if (!this.context || !this.effects) return;
    const context = this.context;
    const source = context.createBufferSource();
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i += 1) {
      const decay = Math.pow(1 - i / samples.length, 2.4);
      // A short, noisy scrape gives the hit a gritty edge instead of a rounded synth "bloop".
      samples[i] = (Math.random() * 2 - 1) * decay;
    }
    source.buffer = buffer;
    const band = context.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.setValueAtTime(1850, context.currentTime);
    band.frequency.exponentialRampToValueAtTime(780, context.currentTime + duration);
    band.Q.value = 0.72;
    const shaper = context.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < curve.length; i += 1) {
      const x = (i * 2) / (curve.length - 1) - 1;
      curve[i] = Math.tanh(x * 3.8);
    }
    shaper.curve = curve;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, context.currentTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    source.connect(band);
    band.connect(shaper);
    shaper.connect(gain);
    gain.connect(this.effects);
    source.start();
    source.stop(context.currentTime + duration + 0.02);
  }

  private noiseBurst(duration: number, cutoff: number, volume: number) {
    if (!this.context || !this.effects) return;
    const context = this.context;
    const source = context.createBufferSource();
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i += 1) samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length);
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.effects);
    source.start();
    source.stop(context.currentTime + duration + 0.02);
  }
}

const engine = new GameAudioEngine();

export function useGameAudio(scene: string, phase: string, playerHealth: number, enemyHealths: { id: string; hp: number }[], events: { round: number; kind: string; message: string }[], version: number) {
  const [settings, setSettings] = useState<AudioSettings>(readSettings);
  const previous = useRef<{ scene: string; phase: string; playerHealth: number; enemies: Record<string, number>; events: string[]; version: number } | null>(null);

  const enable = useCallback(async () => {
    const next = { ...settings, enabled: true, muted: false };
    setSettings(next);
    await engine.enable(next);
    engine.startScene(scene, phase === "combat");
  }, [settings, scene, phase]);

  const updateSettings = useCallback((patch: Partial<AudioSettings>) => {
    setSettings(current => {
      const next = { ...current, ...patch };
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...next, enabled: false }));
      engine.setVolumes(next);
      return next;
    });
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    engine.setVolumes(settings);
  }, [settings]);

  // Browsers require a user gesture before Web Audio can start. Keep sound
  // enabled by default, then resume it on the first interaction without an
  // extra "enable sound" step.
  useEffect(() => {
    if (!settings.enabled) return;
    let activated = false;
    const activate = () => {
      if (activated) return;
      activated = true;
      void engine.enable(settings).then(() => engine.startScene(scene, phase === "combat"));
    };
    window.addEventListener("pointerdown", activate, { once: true, capture: true });
    window.addEventListener("keydown", activate, { once: true, capture: true });
    return () => {
      window.removeEventListener("pointerdown", activate, true);
      window.removeEventListener("keydown", activate, true);
    };
  }, [settings.enabled, scene, phase]);

  useEffect(() => {
    if (settings.enabled) engine.startScene(scene, phase === "combat");
  }, [scene, phase, settings.enabled]);

  useEffect(() => {
    const before = previous.current;
    const enemies = Object.fromEntries(enemyHealths.map(enemy => [enemy.id, enemy.hp]));
    const eventKeys = events.map(event => event.round + ":" + event.kind + ":" + event.message);
    if (settings.enabled && before && version !== before.version) {
      if (scene !== before.scene) engine.effect("door");
      else {
        const freshEvents = events.filter((_, index) => !before.events.includes(eventKeys[index]));
        const kinds = new Set(freshEvents.map(event => event.kind));
        if (kinds.has("player_attack") || kinds.has("enemy_attack")) engine.effect("impact");
        if (kinds.has("player_defend")) engine.effect("block");
        if (kinds.has("player_interrupt") || kinds.has("enemy_heal")) engine.effect("magic");
        if (kinds.has("enemy_defeated")) engine.effect("defeat");
        if (kinds.has("victory") || (phase === "completed" && before.phase !== "completed")) engine.effect("victory");
        if (kinds.has("defeat") || (phase === "failed" && before.phase !== "failed")) engine.effect("failure");
        if (freshEvents.length === 0 && phase === "combat" && before.phase !== "combat") engine.effect("encounter");
        if (freshEvents.length === 0 && playerHealth < before.playerHealth) engine.effect("impact");
        if (freshEvents.length === 0 && enemyHealths.some(enemy => enemy.hp < (before.enemies[enemy.id] ?? enemy.hp))) {
          const defeated = enemyHealths.some(enemy => enemy.hp <= 0 && (before.enemies[enemy.id] ?? 0) > 0);
          engine.effect(defeated ? "defeat" : "impact");
        }
      }
    }
    previous.current = { scene, phase, playerHealth, enemies, events: eventKeys, version };
  }, [scene, phase, playerHealth, enemyHealths, events, version, settings.enabled]);

  return { settings, enable, updateSettings };
}

export function AudioControls({ settings, onEnable, onChange }: {
  settings: AudioSettings;
  onEnable: () => void;
  onChange: (patch: Partial<AudioSettings>) => void;
}) {
  return <details className="audio-controls">
    <summary aria-label="Audio settings">♫ SOUND {settings.enabled && !settings.muted ? "ON" : "OFF"}</summary>
    <div className="audio-panel">
      <div className="audio-panel-heading"><strong>THE SOUND OF THE CATACOMBS</strong><button onClick={() => settings.enabled ? onChange({ enabled: false }) : onEnable()}>{settings.enabled ? "TURN SOUND OFF" : "TURN SOUND ON"}</button><button onClick={() => onChange({ muted: !settings.muted })}>{settings.muted ? "UNMUTE" : "MUTE"}</button></div>
      {([
        ["master", "MASTER"],
        ["music", "MUSIC"],
        ["effects", "EFFECTS"],
      ] as const).map(([key, label]) => <label key={key}><span>{label}</span><input type="range" min="0" max="1" step="0.01" value={settings[key]} onChange={event => onChange({ [key]: Number(event.target.value) })} /></label>)}
      <small>Original synthesized audio · adjust to taste</small>
    </div>
  </details>;
}
