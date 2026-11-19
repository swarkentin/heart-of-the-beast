// Pure derivations for the party portraits: who sits where, what each hero looks like, and what the card says.
import type { ApiCombatEvent, ApiRoom, ApiRun } from "../api";
import type { HeroPose, HeroSkin, IconId, LobbyCatalog, StatusFxKind } from "../lobby";

export type PartyStatus = { id: string; icon: IconId; label: string; tone: "good" | "bad" | "info" };
export type PartyThreat = { enemyId: string; enemyName: string; label: string; damage: number; all: boolean };
export type RoundState = "none" | "choosing" | "ready" | "down" | "offline";
export type PartyMember = {
  id: string; position: number; isSelf: boolean; classId?: string; skin?: HeroSkin; className: string; level: number;
  health: number; maxHealth: number; alive: boolean; online: boolean; healingHerbs: number;
  power: number; focus: number; agility: number; xpPercent: number; xpLabel: string;
  pose: HeroPose; overlays: StatusFxKind[]; statuses: PartyStatus[]; threats: PartyThreat[];
  round: RoundState; chosen?: { icon: IconId; label: string }; autoDefended: boolean;
};
export type EnemyLike = { id: string; name: string; hp: number; rawIntent?: { label: string; damage: number; targetPlayerId?: string; targetAll?: boolean } };

export const LEVEL_THRESHOLDS = [0, 60, 150, 275, 425];
/** A hero at or below this share of health shows the injured pose. */
export const INJURED_AT = 0.35;

const ACTION_BADGE: Record<string, { icon: IconId; label: string }> = {
  defend: { icon: "guard", label: "DEFEND" },
  skill: { icon: "ready", label: "SKILL" },
};

/** The badge on a ready portrait: the skill they locked in, by name. */
function chosenBadge(action: { action: string; skill?: string }, catalog: LobbyCatalog | null): { icon: IconId; label: string } | undefined {
  const badge = ACTION_BADGE[action.action];
  const skill = action.skill ? catalog?.skills?.find(item => item.id === action.skill) : undefined;
  return badge && skill ? { ...badge, label: skill.name.toUpperCase() } : badge;
}

export function archetypeName(id?: string) {
  return id === "support" ? "Support" : id === "damage" ? "Damage" : id === "tank" ? "Tank" : "Adventurer";
}

export function buildParty(room: ApiRoom, run: ApiRun, selfId: string, catalog: LobbyCatalog | null, enemies: EnemyLike[]): PartyMember[] {
  const events: ApiCombatEvent[] = run.lastCombatEvents ?? [];
  const combat = run.phase === "combat";
  return room.playerIds.filter(id => room.presence?.[id]?.status !== "left" || run.players[id]).map(id => {
    const player = run.players[id];
    const classId = player?.classBuild?.classId || room.playerClasses?.[id];
    const health = player?.health ?? 0, maxHealth = Math.max(1, player?.maxHealth ?? 1);
    const alive = health > 0;
    const presence = room.presence?.[id]?.status ?? "online";
    const online = presence === "online";
    const cc = player?.classCombat ?? {};
    const statuses: PartyStatus[] = [];
    const overlays: StatusFxKind[] = [];
    if (alive) {
      if (player?.guarding || (cc.guardBonus ?? 0) > 0) { statuses.push({ id: "guard", icon: "guard", label: (cc.guardBonus ?? 0) > 0 ? "GUARD +" + cc.guardBonus : "GUARD", tone: "good" }); overlays.push("guard"); }
      if ((cc.ward ?? 0) > 0) { statuses.push({ id: "ward", icon: "ward", label: "WARD " + cc.ward, tone: "good" }); overlays.push("ward"); }
      if (cc.resolveReady) statuses.push({ id: "resolve", icon: "empower", label: "RESOLVE", tone: "good" });
      if ((cc.arcaneCharges ?? 0) > 0) statuses.push({ id: "charge", icon: "arcane", label: "CHARGE " + cc.arcaneCharges, tone: "good" });
      if ((cc.empower ?? 0) > 0) statuses.push({ id: "empower", icon: "empower", label: "EMPOWER +" + cc.empower, tone: "good" });
      if ((cc.thorns ?? 0) > 0) statuses.push({ id: "thorns", icon: "damage", label: "THORNS " + cc.thorns, tone: "good" });
      if ((cc.regenRounds ?? 0) > 0) { statuses.push({ id: "regen", icon: "life", label: "REGEN " + cc.regen + "×" + cc.regenRounds, tone: "good" }); overlays.push("heal"); }
      if (cc.resolveReady || (cc.arcaneCharges ?? 0) > 0 || (cc.empower ?? 0) > 0) overlays.push("buff");
      if (health / maxHealth <= INJURED_AT) statuses.push({ id: "wounded", icon: "vitality", label: "WOUNDED", tone: "bad" });
    } else {
      statuses.push({ id: "down", icon: "down", label: "DOWN", tone: "bad" });
      overlays.push("sleep");
    }
    if (!online) statuses.push({ id: "offline", icon: "offline", label: presence === "left" ? "LEFT" : "OFFLINE", tone: "info" });
    const action = run.combatRound?.actions?.[id];
    const level = player?.level ?? 1;
    const floor = LEVEL_THRESHOLDS[level - 1] ?? 325, next = LEVEL_THRESHOLDS[level];
    return {
      id, position: room.playerIds.indexOf(id) + 1, isSelf: id === selfId, classId, skin: room.playerSkins?.[id],
      className: catalog?.classes.find(item => item.id === classId)?.name || archetypeName(player?.archetype || room.playerArchetypes?.[id]),
      level, health, maxHealth, alive, online, healingHerbs: player?.consumables?.["healing-herb"] ?? 0,
      power: player?.stats.power ?? 0, focus: player?.stats.focus ?? 0, agility: player?.stats.agility ?? 0,
      xpPercent: player && next ? Math.min(100, Math.max(0, (player.experience - floor) / (next - floor) * 100)) : 100,
      xpLabel: player && next ? player.experience + "/" + next + " XP" : "MAX LEVEL",
      pose: !alive ? "down" : health / maxHealth <= INJURED_AT ? "injured" : "idle",
      overlays, statuses,
      threats: alive && combat ? enemies.filter(enemy => enemy.hp > 0 && enemy.rawIntent && (enemy.rawIntent.targetAll || enemy.rawIntent.targetPlayerId === id)).map(enemy => ({ enemyId: enemy.id, enemyName: enemy.name, label: enemy.rawIntent!.label, damage: enemy.rawIntent!.damage, all: Boolean(enemy.rawIntent!.targetAll) })) : [],
      round: !combat ? "none" : !alive ? "down" : action ? "ready" : !online ? "offline" : "choosing",
      chosen: action ? chosenBadge(action, catalog) : undefined,
      // The previous round's automatic defend stays on the card until that player acts again.
      autoDefended: combat && alive && !action && events.some(event => event.auto && event.actorId === id),
    };
  });
}

/** You first, then reading order across the two borders: left-top, right-top, left-bottom, right-bottom. */
export function seatParty(members: PartyMember[]): { left: PartyMember[]; right: PartyMember[] } {
  const ordered = [...members.filter(member => member.isSelf), ...members.filter(member => !member.isSelf)].slice(0, 4);
  if (ordered.length <= 1) return { left: ordered, right: [] };
  return { left: ordered.filter((_, index) => index % 2 === 0), right: ordered.filter((_, index) => index % 2 === 1) };
}

/** "P2 Arcanist" style labels ("You" for the reader), keyed by the 1-based position the server uses in "Adventurer N". */
export function partyLabels(members: PartyMember[]): Record<number, string> {
  const labels: Record<number, string> = {};
  for (const member of members) labels[member.position] = member.isSelf ? "You" : "P" + member.position + " " + member.className;
  return labels;
}
