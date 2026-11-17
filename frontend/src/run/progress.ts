// What a finished run did for the adventurer's lasting progress: the XP it earned, where it came from, and any rank,
// mastery, skill or cosmetic it unlocked. Pure, so it runs under node --test.
import type { ApiProfile, ApiRunProgress } from "../api";
import type { LogTone } from "./logLines.ts";

type Standing = Pick<ApiProfile, "adventurerXp" | "classMastery">;
type Reward = { id: string; name: string; category: string; profileLevel?: number; classId?: string; classMasteryLevel?: number };
type SkillInfo = { id: string; name: string; classId?: string; masteryLevel: number };

export type ProgressLine = { key: string; tone: LogTone; text: string };
/** A level gained, to be celebrated on screen. `unlocks` names what it opened up. */
export type Celebration = { key: string; kind: "rank" | "mastery"; title: string; level: number; unlocks: string[] };
export type ProgressReport = { lines: ProgressLine[]; celebrations: Celebration[] };

export type ProgressInput = {
  runId: string;
  progress?: ApiRunProgress;
  /** The profile while the run was live, if this screen saw it. Used only to tell a stale profile from an updated one. */
  before: Standing | null;
  /** The latest profile. */
  after: Standing | null;
  classId?: string;
  className?: string;
  rewards: readonly Reward[];
  skills: readonly SkillInfo[];
  xpPerLevel?: number;
  spectator?: boolean;
};

const plural = (n: number, one: string, many: string) => n + " " + (n === 1 ? one : many);

/** Where the XP came from, in words: "6 fights won, 2 floors cleared, 1 dungeon conquered and the victory bonus". */
export function progressSources(progress: ApiRunProgress): string {
  const parts = [plural(progress.encounters, "fight won", "fights won")];
  if (progress.floors > 0) parts.push(plural(progress.floors, "floor cleared", "floors cleared"));
  if (progress.dungeons > 0) parts.push(plural(progress.dungeons, "dungeon conquered", "dungeons conquered"));
  if (progress.completionBonus) parts.push("the victory bonus");
  return parts.length === 1 ? parts[0] : parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
}

export function progressReport(input: ProgressInput): ProgressReport {
  const { runId, progress, before, after, classId, className = "Class", rewards, skills, spectator } = input;
  const perLevel = Math.max(1, input.xpPerLevel ?? 100);
  const levelOf = (xp: number) => Math.floor(Math.max(0, xp) / perLevel) + 1;
  const toNext = (xp: number) => perLevel - (Math.max(0, xp) % perLevel);
  const key = (part: string) => "progress:" + runId + ":" + part;
  if (!progress || progress.xp <= 0) return { lines: [{ key: key("none"), tone: "system", text: "No lasting XP this time: win a fight to earn some." }], celebrations: [] };

  const sources = progressSources(progress);
  if (spectator) return { lines: [{ key: key("xp"), tone: "good", text: "Each adventurer earns " + progress.xp + " XP for " + sources + "." }], celebrations: [] };
  const lines: ProgressLine[] = [{ key: key("xp"), tone: "good", text: "You earn " + progress.xp + " XP for " + sources + "." }];
  // Wait for the profile the server updated at the end of the run; the one from before it would read as no progress.
  if (!after || (before && after.adventurerXp < before.adventurerXp + progress.xp)) return { lines, celebrations: [] };

  const celebrations: Celebration[] = [];
  const rankAfter = levelOf(after.adventurerXp), rankBefore = levelOf(after.adventurerXp - progress.xp);
  const rankRewards = rewards.filter(reward => !reward.classId && reward.profileLevel && reward.profileLevel > rankBefore && reward.profileLevel <= rankAfter).map(reward => reward.name);
  if (rankAfter > rankBefore) {
    lines.push({ key: key("rank"), tone: "good", text: "RANK UP! Adventurer Rank " + rankAfter + "." });
    celebrations.push({ key: key("rank"), kind: "rank", title: "ADVENTURER RANK", level: rankAfter, unlocks: rankRewards });
  }
  lines.push({ key: key("rank-next"), tone: "info", text: "Adventurer Rank " + rankAfter + ": " + toNext(after.adventurerXp) + " XP to Rank " + (rankAfter + 1) + "." });

  const mastery = classId ? after.classMastery?.[classId] : undefined;
  if (classId && mastery) {
    const masteryAfter = levelOf(mastery.experience), masteryBefore = levelOf(mastery.experience - progress.xp);
    const newSkills = skills.filter(skill => skill.classId === classId && skill.masteryLevel > masteryBefore && skill.masteryLevel <= masteryAfter).map(skill => skill.name);
    const looks = rewards.filter(reward => reward.classId === classId && reward.classMasteryLevel && reward.classMasteryLevel > masteryBefore && reward.classMasteryLevel <= masteryAfter);
    if (masteryAfter > masteryBefore) {
      lines.push({ key: key("mastery"), tone: "good", text: "MASTERY UP! " + className + " Mastery " + masteryAfter + "." });
      celebrations.push({ key: key("mastery"), kind: "mastery", title: className.toUpperCase() + " MASTERY", level: masteryAfter, unlocks: [...newSkills.map(name => "Skill: " + name), ...looks.map(reward => reward.name)] });
    }
    lines.push({ key: key("mastery-next"), tone: "info", text: className + " Mastery " + masteryAfter + ": " + toNext(mastery.experience) + " XP to Mastery " + (masteryAfter + 1) + "." });
    if (newSkills.length > 0) lines.push({ key: key("skills"), tone: "good", text: "New " + (newSkills.length === 1 ? "skill" : "skills") + " to put on your bar: " + newSkills.join(", ") + "." });
    for (const reward of looks) lines.push({ key: key("reward:" + reward.id), tone: "good", text: "Unlocked " + (reward.category === "armor" ? "armour" : reward.category) + ": " + reward.name + "." });
  }
  for (const name of rankRewards) lines.push({ key: key("reward:" + name), tone: "good", text: "Unlocked: " + name + "." });
  return { lines, celebrations };
}
