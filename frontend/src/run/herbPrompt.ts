/** How strongly the combat HUD should call attention to a usable healing herb. */
export function herbPromptLevel(health: number, maxHealth: number, herbs: number): "none" | "hint" | "urgent" {
  if (herbs <= 0 || maxHealth <= 0 || health <= 0 || health >= maxHealth * 0.6) return "none";
  return health <= maxHealth * 0.3 ? "urgent" : "hint";
}
