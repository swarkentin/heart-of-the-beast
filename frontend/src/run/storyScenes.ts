// Every scene a story panel can name (ADR 0039, 0041). The server's campaign validation keeps the same list
// (backend/internal/game/campaigns.go, storyArt), and run.test.ts checks that the two agree. The art for each lives in
// prologueArt.tsx (the run prologue's own scenes) and storyArt.tsx (the campaigns' story of Brother Ossic), and the
// type below makes the compiler refuse a scene with no art.

export const STORY_SCENES = [
  "lands", "beast", "masters", "gates", "charge",
  "havoc", "flight", "victory", "beyond",
  "previously", "ossic-gate", "ossic-marked", "clocktower", "gauntlet", "bargain",
  "dreamer", "faces", "alone", "whole-heart", "sacrifice", "deep-eye",
] as const;

export type StoryScene = typeof STORY_SCENES[number];
