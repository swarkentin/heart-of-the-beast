// The room API as the browser sees it: snapshot types and the one request helper.

export type ApiEnemyIntent = { kind: string; label: string; damage: number; heal?: number; targetPlayerId?: string; targetAll?: boolean; interruptible?: boolean };
export type ApiEnemy = { id: string; name: string; behavior?: string; sprite?: string; turnsTaken: number; health: number; maxHealth: number; markedDamage?: number; stun?: number; bleed?: number; bleedRounds?: number; tauntedBy?: string; intent?: ApiEnemyIntent; mechanics?: string[]; barrier?: number; enraged?: boolean; summoned?: boolean; traits?: ApiMonsterTrait[]; shield?: number; phased?: boolean; fuseIn?: number; split?: boolean; avenged?: boolean; anchor?: boolean; anchored?: boolean; rebirthLabel?: string; reborn?: boolean; devourIn?: number; devoured?: number; damageBonus?: number };
export type ApiMonsterTrait = { kind: string; amount?: number; every?: number; label?: string };
/** `actorId` names the acting player on player actions; `auto` marks an action the server chose at the round deadline. */
export type ApiCombatEvent = { round: number; kind: string; message: string; effect?: "damage" | "heal" | "block"; targetId?: string; targetType?: "enemy" | "player"; amount?: number; actorId?: string; auto?: boolean };
export type ApiExit = { id: string; destination: string; label: string; description?: string };
export type ApiEventChoice = { id: string; label: string; description: string };
export type ApiRoomEvent = { id: string; title: string; description: string; choices: ApiEventChoice[]; resolved: boolean; result?: string };
export type ApiDungeonRoom = { id: string; themeId?: string; name: string; floor?: string; roomType?: string; description: string; exits: ApiExit[]; encounter?: { status: string; enemies: ApiEnemy[] }; event?: ApiRoomEvent; cleared: boolean };
export type ApiStats = { power: number; focus: number; agility: number };
export type ApiClassCombat = { guardBonus?: number; ward?: number; wardReflect?: number; resolveReady?: boolean; arcaneCharges?: number; cooldowns?: Record<string, number>; empower?: number; thorns?: number; regen?: number; regenRounds?: number };
export type ApiPlayer = { id: string; health: number; maxHealth: number; archetype: string; classBuild?: { classId: string; passiveId: string }; classCombat?: ApiClassCombat; guarding?: boolean; experience: number; level: number; skills?: string[]; stats: ApiStats; strikeDamage?: number; guardReduction?: number; gold?: number; items?: string[]; boons?: string[] };
export type ApiCombatAction = { type: string; action: string; skill?: string; targetId?: string };
export type ApiCombatRound = { number: number; startedAt: string; deadline: string; actions: Record<string, ApiCombatAction> };
export type ApiVote = { startedAt: string; deadline: string; votes: Record<string, string> };
/** A level-wide rule in force on one floor of an expedition. */
export type ApiFloorModifier = { id: string; name: string; description: string; kind: "debuff" | "perk" };
/** One adventurer's copy of the camp mini-game. `chests` holds -1 for a shut chest, 0 for the mimic, else gold. */
export type ApiMinigamePlay = { index: number; done: boolean; gold: number; pot: number; rolls?: number[]; chests?: number[]; sequence?: string[]; answer?: string[]; result?: string };
export type ApiMinigame = { kind: "dice" | "chests" | "echo"; name: string; rules: string; depth: number; players: Record<string, ApiMinigamePlay> };
export type ApiShopItem = { id: string; name: string; description: string; kind: string; amount?: number; price: number; repeatable?: boolean };
/** The respite at a dungeon's midpoint and between dungeons: a mini-game for gold, a vote for the next dungeon (between dungeons only), then a shop. `deadline` is absent for a party of one. */
/** One of the two dungeons offered after a dungeon boss; its modifiers hold on every floor of it. */
export type ApiDungeonChoice = { themeId: string; name: string; tagline: string; floors: number; modifiers: ApiFloorModifier[]; capstone?: boolean };
/** A boon a capstone boss offers: it changes how its owner fights for the rest of the run. */
export type ApiBoon = { id: string; name: string; description: string; repeatable?: boolean };
/** `boon` comes first after a capstone boss; `boonOnly` marks a camp that is nothing but the boon choice. */
export type ApiCamp = { stage: "boon" | "game" | "crossroads" | "shop"; boonOffers?: Record<string, ApiBoon[]>; boonChoices?: Record<string, string>; boonOnly?: boolean; nextMaxDepth?: number; choices?: ApiDungeonChoice[]; votes?: Record<string, string>; nextThemeId?: string; startedAt: string; deadline?: string; game?: ApiMinigame; offers?: ApiShopItem[]; purchases?: Record<string, string[]>; ready?: Record<string, boolean>; nextDepth: number; nextModifiers?: ApiFloorModifier[] };
export type ApiTheme = { id: string; name: string; tagline: string };
/** The intro a party sees on entering a dungeon: a voice from above, what lives below and the boss dossier. */
export type ApiBriefing = { dungeon: number; themeId: string; name: string; tagline: string; narrator: string; lines: string[]; floors: number; threats?: string[]; boss: string; bossLair: string; advice?: string[]; modifiers?: ApiFloorModifier[] };
export type ApiRun = { id: string; themeId?: string; phase: "lobby" | "combat" | "exploring" | "intermission" | "completed" | "failed"; depth?: number; maxDepth?: number; musicIntensity?: number; generator?: number; dungeon?: number; dungeonsCleared?: number; dungeonThemes?: string[]; floorsCleared?: number; rank?: string; floorModifiers?: ApiFloorModifier[]; camp?: ApiCamp; pendingInterFloorChoice?: boolean; interFloorVote?: ApiVote; currentRoomId: string; rooms: Record<string, ApiDungeonRoom>; players: Record<string, ApiPlayer>; flags?: Record<string, boolean>; combatRound?: ApiCombatRound; navigationVote?: ApiVote; lastCombatEvents?: ApiCombatEvent[]; briefing?: ApiBriefing };
export type ApiPresence = { status: "online" | "disconnected" | "left"; lastSeenAt: string; leftAt?: string };
/** The lasting XP a finished run earned each adventurer who stayed to its end, and where it came from. */
export type ApiRunProgress = { xp: number; encounters: number; floors: number; dungeons: number; completionBonus?: number };
export type ApiRoom = { id: string; code: string; ownerPlayerId: string; playerIds: string[]; playerArchetypes?: Record<string, string>; playerClasses?: Record<string, string>; playerSkins?: Record<string, { tier: number; variant: string }>; playerLoadouts?: Record<string, string[]>; playerMastery?: Record<string, number>; presence?: Record<string, ApiPresence>; run?: ApiRun; runProgress?: ApiRunProgress; version: number };
export type ApiCommand = { type: string; round?: number; action?: string; skill?: string; targetId?: string; exitId?: string; choiceId?: string; skillIds?: string[] };
export type ApiLinkedAccount = { provider: string; username: string; linkedAt: string };
export type ApiProfile = { id: string; displayName: string; adventurerXp: number; adventurerLevel: number; classMastery: Record<string, { experience: number; level: number }>; unlockedCosmetics: string[]; accounts?: ApiLinkedAccount[]; createdAt: string; updatedAt: string };
export type PlayerSession = { roomId: string; playerId: string; playerToken: string; spectatorToken?: string };
export type SpectatorAccess = { roomId: string; token: string };

export const PROFILE_CREDENTIAL_KEY = "heart-of-the-beast.profile-credential";

function guestProfileCredential(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let credential = window.localStorage.getItem(PROFILE_CREDENTIAL_KEY);
    if (!credential) {
      const bytes = new Uint8Array(32);
      window.crypto.getRandomValues(bytes);
      credential = Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
      window.localStorage.setItem(PROFILE_CREDENTIAL_KEY, credential);
    }
    return credential;
  } catch {
    return null;
  }
}

export async function apiRequest<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", "Bearer " + token);
  // Joining links the room seat to the profile; choosing a class or a skill bar reads its mastery to unlock
  // armour tiers, dyes and skills.
  if (path === "/rooms" || path === "/rooms/join" || path.endsWith("/class") || path.endsWith("/loadout")) {
    const profileCredential = guestProfileCredential();
    if (profileCredential) headers.set("X-Guest-Profile-Credential", profileCredential);
  }
  const response = await fetch("/api" + path, { ...init, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Request failed (" + response.status + ")");
  return payload as T;
}
