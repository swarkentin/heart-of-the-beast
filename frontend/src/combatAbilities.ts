export type SignatureTarget = "self" | "enemy" | "player_optional" | "mode_target";
export type SignatureMode = "fire" | "frost" | "attack" | "defend" | "disrupt";

export type SignatureAbility = {
  id: string;
  target: SignatureTarget;
  modes?: readonly SignatureMode[];
  summary: string;
  details: string;
  targetHint: string;
};

// Stable catalog IDs are the source of class identity; the UI only supplies
// the optional choices the authoritative ability handler expects.
export const signatureAbilities: Record<string, SignatureAbility> = {
  "ability.shield-wall": { id: "ability.shield-wall", target: "self", summary: "Brace for the next hit", details: "Brace yourself and gain extra protection against the next hit.", targetHint: "Protects you" },
  "ability.reckoning": { id: "ability.reckoning", target: "enemy", summary: "Counter with damage taken", details: "Strike an enemy for damage based on what you absorbed last round.", targetHint: "Choose an enemy" },
  "ability.runic-ward": { id: "ability.runic-ward", target: "self", summary: "Absorb a hit and reflect damage", details: "Ward yourself against the next hit and reflect damage if it absorbs any.", targetHint: "Protects you" },
  "ability.exploit-weakness": { id: "ability.exploit-weakness", target: "enemy", summary: "Punish a wounded or preparing foe", details: "Deal precision damage, with a bonus against a wounded or preparing enemy.", targetHint: "Choose an enemy" },
  "ability.elemental-surge": { id: "ability.elemental-surge", target: "enemy", modes: ["fire", "frost"], summary: "Fire damage or Frost control", details: "Fire deals stronger damage. Frost deals less damage and cancels the target's current intent.", targetHint: "Choose an enemy" },
  "ability.pinning-shot": { id: "ability.pinning-shot", target: "enemy", summary: "Hit and weaken its current attack", details: "Damage an enemy and reduce the damage of its current telegraphed attack.", targetHint: "Choose an enemy" },
  "ability.renewal": { id: "ability.renewal", target: "player_optional", summary: "Restore health to an ally or yourself", details: "Restore health to yourself or a chosen living ally. Afterwards it needs three rounds to recover before you can cast it again.", targetHint: "Choose a living ally, or Self" },
  "ability.commanding-strike": { id: "ability.commanding-strike", target: "enemy", summary: "Weaken a foe, boost the next party strike", details: "Damage and weaken an enemy; the next party attack against it deals bonus damage.", targetHint: "Choose an enemy" },
  "ability.companion-command": { id: "ability.companion-command", target: "mode_target", modes: ["attack", "defend", "disrupt"], summary: "Command Attack, Defend, or Disrupt", details: "Attack deals damage. Defend grants extra guard. Disrupt cancels an interruptible intent or weakens another.", targetHint: "Attack/Disrupt: enemy · Defend: ally or Self" },
};

export function getSignatureAbility(abilityId?: string) {
  return abilityId && Object.hasOwn(signatureAbilities, abilityId) ? signatureAbilities[abilityId] : undefined;
}

export function signatureTargetId(target: SignatureTarget, mode: SignatureMode | "", enemyId: string, allyId: string) {
  if (target === "enemy" || target === "mode_target" && mode !== "defend") return enemyId;
  if (target === "player_optional" || target === "mode_target" && mode === "defend") return allyId;
  return "";
}

export function signatureCommand(ability: SignatureAbility, round: number, mode: SignatureMode | "", enemyId: string, allyId: string) {
  const targetId = signatureTargetId(ability.target, mode, enemyId, allyId);
  return { type: "combat", round, action: "ability", ...(mode ? { mode } : {}), ...(targetId ? { targetId } : {}) };
}

export function partySupportCommand(ability: SignatureAbility, round: number, allyId: string) {
  const mode: SignatureMode | "" = ability.id === "ability.companion-command" ? "defend" : "";
  return signatureCommand(ability, round, mode, "", allyId);
}
