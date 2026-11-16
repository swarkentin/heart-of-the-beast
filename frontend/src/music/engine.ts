// The live music engine. It owns the AudioContext, keeps exactly one "layer" (a cue's bed plus its scheduled bars)
// audible at steady state, and crossfades to a new layer when the cue changes instead of restarting anything.
import { cueKey } from "./cue.ts";
import { generateBar, makePlan } from "./score.ts";
import type { Plan } from "./score.ts";
import { createMasterChain, playEffect as playEffectOn, playStinger, scheduleEvents, startBed } from "./synth.ts";
import type { Bed, MasterChain } from "./synth.ts";
import type { EffectKind, MusicCue, ThemeId } from "./types.ts";

export interface Volumes {
  muted: boolean;
  master: number;
  music: number;
  effects: number;
}

interface Layer {
  key: string;
  plan: Plan;
  gain: GainNode;
  bed: Bed;
  /** Absolute context time at which the next bar to schedule begins. */
  nextTime: number;
  bar: number;
  cue: MusicCue;
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
  private volumes: Volumes = { muted: false, master: 0.72, music: 0.48, effects: 0.72 };
  private lastEffectAt = new Map<string, number>();

  get running(): boolean {
    return this.ctx !== null && this.ctx.state === "running";
  }

  get currentKey(): string | null {
    return this.layer?.key ?? null;
  }

  /** Must be called from a user gesture the first time (browser autoplay rules). Applies any cue that arrived earlier. */
  async enable(): Promise<void> {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.chain = createMasterChain(this.ctx);
      this.applyVolumes();
    }
    if (this.ctx.state !== "running") {
      try { await this.ctx.resume(); } catch { return; }
    }
    if (!this.timer) this.timer = setInterval(() => this.tick(), TICK_MS);
    if (this.pending) {
      const cue = this.pending;
      this.pending = null;
      this.setCue(cue);
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

  /** Switches the score. Same cue identity is a no-op; otherwise the old layer fades out as the new one fades in. */
  setCue(cue: MusicCue): void {
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
    if (previous) {
      // Quantise to the old score's grid: the next beat for fights, the next bar otherwise.
      const barSec = previous.plan.barSec;
      const barStart = previous.nextTime - barSec;
      const grid = urgent ? barSec / 4 : barSec;
      const elapsed = Math.max(0, now + 0.05 - barStart);
      start = Math.min(barStart + Math.ceil(elapsed / grid) * grid, now + (urgent ? 1.2 : barSec + 0.1));
      start = Math.max(start, now + 0.05);
    }
    const fade = urgent ? 0.35 : previous ? 1.6 : 1.2;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(1, start + fade);
    gain.connect(this.chain.music);
    const bed = startBed(ctx, gain, plan, start, fade);
    const layer: Layer = { key, plan, gain, bed, nextTime: start, bar: 0, cue };
    this.layer = layer;
    if (previous) this.retire(previous, start, fade);
    if ((cue.state === "victory" || cue.state === "defeat") && previous?.cue.state !== cue.state) playStinger(ctx, gain, plan, cue.state, start);
    this.tick();
  }

  private retire(layer: Layer, at: number, fade: number): void {
    layer.gain.gain.cancelScheduledValues(at);
    layer.gain.gain.setValueAtTime(Math.max(0.0001, layer.gain.gain.value), at);
    layer.gain.gain.linearRampToValueAtTime(0.0001, at + fade);
    layer.bed.stop(at, fade);
    layer.nextTime = Infinity; // scheduler stops feeding it; bars already queued ring out under the fade
    const ctx = this.ctx;
    window.setTimeout(() => {
      try { layer.gain.disconnect(); } catch { /* already gone */ }
    }, Math.max(0, (at + fade - (ctx?.currentTime ?? 0)) * 1000) + 3000);
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
      scheduleEvents(ctx, layer.gain, generateBar(layer.plan, layer.bar), layer.nextTime);
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
