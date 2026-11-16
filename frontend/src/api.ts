// The room API as the browser sees it: snapshot types and the one request helper.

export type ApiEnemyIntent = { kind: string; label: string; damage: number; heal?: number; targetPlayerId?: string; targetAll?: boolean; interruptible?: boolean };
export type ApiEnemy = { id: string; name: string; behavior?: string; sprite?: string; turnsTaken: number; health: number; maxHealth: number; markedDamage?: number; intent?: ApiEnemyIntent; mechanics?: string[]; barrier?: number; enraged?: boolean; summoned?: boolean };
/** `actorId` names the acting player on player actions; `auto` marks an action the server chose at the round deadline. */
export type ApiCombatEvent = { round: number; kind: string; message: string; effect?: "damage" | "heal" | "block"; targetId?: string; targetType?: "enemy" | "player"; amount?: number; actorId?: string; auto?: boolean };
export type ApiExit = { id: string; destination: string; label: string; description?: string };
export type ApiEventChoice = { id: string; label: string; description: string };
export type ApiRoomEvent = { id: string; title: string; description: string; choices: ApiEventChoice[]; resolved: boolean; result?: string };
export type ApiDungeonRoom = { id: string; themeId?: string; name: string; floor?: string; roomType?: string; description: string; exits: ApiExit[]; encounter?: { status: string; enemies: ApiEnemy[] }; event?: ApiRoomEvent; cleared: boolean };
export type ApiStats = { power: number; focus: number; agility: number };
export type ApiClassCombat = { guardBonus?: number; ward?: number; wardReflect?: number; resolveReady?: boolean; arcaneCharges?: number };
export type ApiPlayer = { id: string; health: number; maxHealth: number; archetype: string; classBuild?: { classId: string; signatureAbilityId: string; passiveId: string }; classCombat?: ApiClassCombat; guarding?: boolean; experience: number; level: number; talentPoints: number; talents: string[]; stats: ApiStats; strikeDamage?: number; guardReduction?: number; gold?: number; items?: string[] };
export type ApiCombatAction = { type: string; action: string; mode?: string; targetId?: string };
export type ApiCombatRound = { number: number; startedAt: string; deadline: string; actions: Record<string, ApiCombatAction> };
export type ApiVote = { startedAt: string; deadline: string; votes: Record<string, string> };
/** A level-wide rule in force on one floor of an expedition. */
export type ApiFloorModifier = { id: string; name: string; description: string; kind: "debuff" | "perk" };
/** One adventurer's copy of the camp mini-game. `chests` holds -1 for a shut chest, 0 for the mimic, else gold. */
export type ApiMinigamePlay = { index: number; done: boolean; gold: number; pot: number; rolls?: number[]; chests?: number[]; sequence?: string[]; answer?: string[]; result?: string };
export type ApiMinigame = { kind: "dice" | "chests" | "echo"; name: string; rules: string; depth: number; players: Record<string, ApiMinigamePlay> };
export type ApiShopItem = { id: string; name: string; description: string; kind: string; amount?: number; price: number; repeatable?: boolean };
/** The respite between two floors: a mini-game for gold, then a shop. `deadline` is absent for a party of one. */
export type ApiCamp = { stage: "game" | "shop"; startedAt: string; deadline?: string; game?: ApiMinigame; offers?: ApiShopItem[]; purchases?: Record<string, string[]>; ready?: Record<string, boolean>; nextDepth: number; nextModifiers?: ApiFloorModifier[] };
export type ApiTheme = { id: string; name: string; tagline: string };
export type ApiRun = { id: string; themeId?: string; phase: "lobby" | "combat" | "exploring" | "intermission" | "completed" | "failed"; depth?: number; maxDepth?: number; musicIntensity?: number; generator?: number; floorModifiers?: ApiFloorModifier[]; camp?: ApiCamp; pendingInterFloorChoice?: boolean; interFloorVote?: ApiVote; currentRoomId: string; rooms: Record<string, ApiDungeonRoom>; players: Record<string, ApiPlayer>; flags?: Record<string, boolean>; combatRound?: ApiCombatRound; navigationVote?: ApiVote; lastCombatEvents?: ApiCombatEvent[] };
export type ApiPresence = { status: "online" | "disconnected" | "left"; lastSeenAt: string; leftAt?: string };
export type ApiRoom = { id: string; code: string; ownerPlayerId: string; playerIds: string[]; playerArchetypes?: Record<string, string>; playerClasses?: Record<string, string>; presence?: Record<string, ApiPresence>; run?: ApiRun; version: number };
export type ApiCommand = { type: string; round?: number; action?: string; mode?: string; targetId?: string; exitId?: string; choiceId?: string };
export type PlayerSession = { roomId: string; playerId: string; playerToken: string; spectatorToken?: string };
export type SpectatorAccess = { roomId: string; token: string };
export type TalentChoice = { id: string; archetype: string; name: string; description: string; tier: number; requires?: string };

export async function apiRequest<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", "Bearer " + token);
  const response = await fetch("/api" + path, { ...init, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Request failed (" + response.status + ")");
  return payload as T;
}
