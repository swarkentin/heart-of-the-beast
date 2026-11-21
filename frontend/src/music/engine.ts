// The live music engine. It owns the AudioContext, keeps exactly one "layer" (a cue's mixer, bed and scheduled
// bars) audible at steady state, and crossfades to a new layer when the cue changes instead of restarting anything.
import { cueKey } from "./cue.ts";
import { generateBar, makePlan, placeOf } from "./score.ts";
import type { Plan } from "./score.ts";
import { createLayerBus, createMasterChain, playEffect as playEffectOn, playStinger, scheduleEvents, startBed } from "./synth.ts";
import type { Bed, LayerBus, MasterChain } from "./synth.ts";
import type { EffectKind, MusicCue, Part, Section, ThemeId } from "./types.ts";

export interface Volumes {
  muted: boolean;
  master: number;
  music: number;
  effects: number;
}

interface Layer {
  key: string;
  plan: Plan;
  bus: LayerBus;
  bed: Bed;
  /** Absolute context time at which the next bar to schedule begins. */
  nextTime: number;
  bar: number;
  cue: MusicCue;
}

/** Where the score is right now, for the sound test's display. */
export interface Position {
  cue: MusicCue;
  plan: Plan;
  bar: number;
  section: Section;
  barInSection: number;
}

const LOOKAHEAD = 0.45;
const TICK_MS = 100;
/** Entering fights should hit on the beat and quickly; everything else blends over a couple of bars' worth of seconds. */
const URGENT = new Set(["combat", "miniboss", "boss"]);

export class MusicEngine {
  private ctx: AudioContext | null = null;
  private chain: MasterChain | null = null;
  private layer: Layer | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private pending: MusicCue | null = null;
  /** The cue the game asked for; the sound test's override plays instead while it is set. */
  private gameCue: MusicCue | null = null;
  private override: MusicCue | null = null;
  private mutes: ReadonlySet<Part> = new Set();
  private volumes: Volumes = { muted: false, master: 0.72, music: 0.48, effects: 0.72 };
  private lastEffectAt = new Map<string, number>();
  private listeners = new Set<() => void>();

  /** Calls listener whenever the audio context starts, suspends or is interrupted. Returns an unsubscribe. */
  onStateChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  get running(): boolean {
    return this.ctx !== null && this.ctx.state === "running";
  }

  get currentKey(): string | null {
    return this.layer?.key ?? null;
  }

  /** The output analyser (for a visualiser), once audio has started. */
  get analyser(): AnalyserNode | null {
    return this.chain?.analyser ?? null;
  }

  /** The bar that is sounding now, and where it sits in the song. */
  position(): Position | null {
    const ctx = this.ctx;
    const layer = this.layer;
    if (!ctx || !layer || !Number.isFinite(layer.nextTime)) return null;
    const ahead = Math.max(0, Math.ceil((layer.nextTime - ctx.currentTime) / layer.plan.barSec));
    const bar = Math.max(layer.plan.entryBar, layer.bar - ahead);
    const place = placeOf(layer.plan, bar);
    return { cue: layer.cue, plan: layer.plan, bar, section: place.section, barInSection: place.inSection };
  }

  /**
   * Must be called from a user gesture (browser autoplay rules): mobile browsers only let a context start inside
   * the handler of a tap, click or key, so everything up to resume() runs synchronously. Applies any cue that
   * arrived earlier. Safe to call again whenever the context is not running, such as after the phone backgrounded the page.
   */
  async enable(): Promise<void> {
    // iOS mutes Web Audio with the ringer switch unless the page asks for playback audio (Safari 17+).
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (session && session.type !== "playback") { try { session.type = "playback"; } catch { /* unsupported */ } }
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.ctx.onstatechange = () => this.listeners.forEach(listener => listener());
      this.chain = createMasterChain(this.ctx);
      this.applyVolumes();
    }
    if (this.ctx.state !== "running") {
      // Older iOS only unlocks once a sound has started inside the gesture: a one-sample silent buffer is enough.
      try { const source = this.ctx.createBufferSource(); source.buffer = this.ctx.createBuffer(1, 1, 22050); source.connect(this.ctx.destination); source.start(0); } catch { /* not needed */ }
      try { await this.ctx.resume(); } catch { return; }
      this.listeners.forEach(listener => listener());
    }
    if (!this.timer) this.timer = setInterval(() => this.tick(), TICK_MS);
    if (this.pending) {
      const cue = this.pending;
      this.pending = null;
      this.play(cue);
    }
  }

  setVolumes(volumes: Volumes): void {
    this.volumes = volumes;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.chain) return;
    const t = this.ctx.currentTime;
    const { muted, master, music, effects } = this.volumes;
    this.chain.master.gain.setTargetAtTime(muted ? 0 : master, t, 0.05);
    this.chain.music.gain.setTargetAtTime(music, t, 0.05);
    this.chain.effects.gain.setTargetAtTime(effects, t, 0.05);
  }

  /** The game's cue. While the sound test overrides the music it is remembered and resumes when the override ends. */
  setCue(cue: MusicCue): void {
    this.gameCue = cue;
    if (!this.override) this.play(cue);
  }

  /** The sound test: play this cue instead of the game's, or (null) hand the music back to the game. */
  setOverride(cue: MusicCue | null): void {
    this.override = cue;
    if (cue) this.play(cue);
    else {
      this.setMutes(new Set());
      if (this.gameCue) this.play(this.gameCue);
    }
  }

  /** Silences mixer parts (the sound test's channel toggles). Applies to the playing layer and to later ones. */
  setMutes(mutes: ReadonlySet<Part>): void {
    this.mutes = new Set(mutes);
    if (this.ctx && this.layer) this.layer.bus.setMutes(this.mutes, this.ctx.currentTime);
  }

  /** Switches the score. Same cue identity is a no-op; otherwise the old layer fades out as the new one fades in. */
  private play(cue: MusicCue): void {
    const ctx = this.ctx;
    if (!ctx || !this.chain || ctx.state !== "running") {
      this.pending = cue;
      return;
    }
    const key = cueKey(cue);
    if (this.layer?.key === key) return;
    const plan = makePlan(cue);
    const previous = this.layer;
    const now = ctx.currentTime;
    const urgent = URGENT.has(cue.state);
    let start = now + 0.05;
    if (previous && Number.isFinite(previous.nextTime)) {
      // Quantise to the old score's grid: the next beat for fights, the next bar otherwise.
      const barSec = previous.plan.barSec;
      const barStart = previous.nextTime - barSec;
      const grid = urgent ? barSec / 4 : barSec;
      const elapsed = Math.max(0, now + 0.05 - barStart);
      start = Math.min(barStart + Math.ceil(elapsed / grid) * grid, now + (urgent ? 1.2 : barSec + 0.1));
      start = Math.max(start, now + 0.05);
    }
    const fade = urgent ? 0.35 : previous ? 1.6 : 1.2;
    const bus = createLayerBus(ctx, this.chain.music, plan, this.mutes);
    bus.out.gain.setValueAtTime(0.0001, start);
    bus.out.gain.linearRampToValueAtTime(1, start + fade);
    const bed = startBed(ctx, bus.parts.fx, plan, start, fade);
    const layer: Layer = { key, plan, bus, bed, nextTime: start, bar: plan.entryBar, cue };
    this.layer = layer;
    if (previous) this.retire(previous, start, fade);
    if ((cue.state === "victory" || cue.state === "defeat") && previous?.cue.state !== cue.state) playStinger(ctx, bus, plan, cue.state, start);
    this.tick();
  }

  private retire(layer: Layer, at: number, fade: number): void {
    const gain = layer.bus.out.gain;
    gain.cancelScheduledValues(at);
    gain.setValueAtTime(Math.max(0.0001, gain.value), at);
    gain.linearRampToValueAtTime(0.0001, at + fade);
    layer.bed.stop(at, fade);
    layer.nextTime = Infinity; // scheduler stops feeding it; bars already queued ring out under the fade
    const ctx = this.ctx;
    window.setTimeout(() => layer.bus.dispose(), Math.max(0, (at + fade - (ctx?.currentTime ?? 0)) * 1000) + 3000);
  }

  private tick(): void {
    const ctx = this.ctx;
    const layer = this.layer;
    if (!ctx || !layer || ctx.state !== "running") return;
    // If the timer was starved (background tab) skip whole bars rather than burst-scheduling the past.
    if (layer.nextTime < ctx.currentTime - 0.1) {
      const missed = Math.ceil((ctx.currentTime - layer.nextTime) / layer.plan.barSec);
      layer.bar += missed;
      layer.nextTime += missed * layer.plan.barSec;
    }
    while (layer.nextTime < ctx.currentTime + LOOKAHEAD) {
      scheduleEvents(ctx, layer.bus, generateBar(layer.plan, layer.bar), layer.nextTime);
      layer.nextTime += layer.plan.barSec;
      layer.bar += 1;
    }
  }

  /** One-shot flavoured sound effect. Identical triggers within 40ms are dropped so a burst of events cannot stack. */
  playEffect(kind: EffectKind, theme: ThemeId): void {
    const ctx = this.ctx;
    if (!ctx || !this.chain || ctx.state !== "running" || this.volumes.muted) return;
    const id = `${kind}|${theme}`;
    const now = ctx.currentTime;
    if (now - (this.lastEffectAt.get(id) ?? -1) < 0.04) return;
    this.lastEffectAt.set(id, now);
    playEffectOn(ctx, this.chain.effects, kind, theme, now + 0.01);
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.layer = null;
    const ctx = this.ctx;
    this.ctx = null;
    this.chain = null;
    if (ctx) void ctx.close().catch(() => undefined);
  }
}
