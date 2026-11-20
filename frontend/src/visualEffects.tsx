import { useEffect, useState } from "react";
import "./visual-effects.css";

type ProfileProgress = {
  adventurerLevel: number;
  classMastery: Record<string, { level: number; experience: number }>;
};

type Effect = {
  id: string;
  name: string;
  description: string;
  rank: number;
  mastery: number;
  tag: string;
};

const STORAGE_KEY = "heart-of-the-beast.visual-effect";
const EFFECTS: Effect[] = [
  { id: "none", name: "Clean display", description: "The original game presentation.", rank: 1, mastery: 0, tag: "STANDARD" },
  { id: "scanlines", name: "Scanline overlay", description: "Fine horizontal phosphor lines, like a classic CRT.", rank: 2, mastery: 0, tag: "CRT" },
  { id: "mono", name: "Monochrome", description: "A stark black-and-white terminal display.", rank: 3, mastery: 0, tag: "MONO" },
  { id: "amber", name: "Amber terminal", description: "Warm amber phosphor with a vintage computer glow.", rank: 4, mastery: 1, tag: "1980s" },
  { id: "green", name: "Green phosphor", description: "That unmistakable green-screen mainframe look.", rank: 5, mastery: 2, tag: "TERMINAL" },
  { id: "crt", name: "Curved CRT", description: "Scanlines, soft bloom, vignette and subtle screen curvature.", rank: 6, mastery: 3, tag: "ARCADE" },
  { id: "gameboy", name: "Handheld LCD", description: "Four nostalgic shades of green with a pocket-console feel.", rank: 7, mastery: 4, tag: "HANDHELD" },
  { id: "vhs", name: "VHS tape", description: "Soft focus, chromatic fringing and occasional tape noise.", rank: 8, mastery: 5, tag: "ANALOG" },
  { id: "arcade", name: "Arcade cabinet", description: "Punchier colour, RGB glow and pronounced scanlines.", rank: 9, mastery: 7, tag: "COIN-OP" },
  { id: "film", name: "Old film", description: "Faded colour, subtle grain and a warm cinematic wash.", rank: 10, mastery: 9, tag: "ARCHIVE" },
  { id: "negative", name: "Photo negative", description: "A strange inverted-world look for the truly adventurous.", rank: 12, mastery: 12, tag: "EXPERIMENTAL" },
];

function readSaved(): string {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY) || "none";
    return EFFECTS.some(effect => effect.id === value) ? value : "none";
  } catch { return "none"; }
}

export function VisualEffectsSettings({ profile }: { profile: ProfileProgress }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(readSaved);
  const masteryPoints = Object.values(profile.classMastery).reduce((sum, mastery) => sum + Math.max(0, (mastery.level || 1) - 1), 0);
  const unlocked = (effect: Effect) => profile.adventurerLevel >= effect.rank || masteryPoints >= effect.mastery;

  useEffect(() => {
    document.documentElement.dataset.visualEffect = selected;
    try { window.localStorage.setItem(STORAGE_KEY, selected); } catch { /* Visual preference remains active for this visit. */ }
    return () => { delete document.documentElement.dataset.visualEffect; };
  }, [selected]);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  return <>
    <button type="button" className="px-button px-button-small" onClick={() => setOpen(true)}>VISUAL DISPLAY</button>
    {open ? <div className="px-backdrop px-visual-backdrop" role="presentation" onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="px-panel px-visual-dialog" role="dialog" aria-modal="true" aria-labelledby="px-visual-title">
        <header className="px-visual-head">
          <div><p className="px-eyebrow">PERSONALIZE YOUR ADVENTURE</p><h2 id="px-visual-title">Display filters</h2></div>
          <button type="button" className="px-button px-button-small" onClick={() => setOpen(false)}>CLOSE</button>
        </header>
        <div className="px-visual-progress">
          <span>ADVENTURER RANK {profile.adventurerLevel}</span>
          <span>{masteryPoints} MASTERY POINTS</span>
          <p>Unlock filters as your Adventurer Rank rises or as you master more classes. These are purely visual and never affect gameplay.</p>
        </div>
        <div className="px-visual-grid">
          {EFFECTS.map(effect => {
            const earned = unlocked(effect);
            return <button type="button" key={effect.id} disabled={!earned} aria-pressed={selected === effect.id}
              className={"px-visual-option" + (selected === effect.id ? " selected" : "") + (!earned ? " locked" : "")}
              onClick={() => setSelected(effect.id)}>
              <span className={"px-visual-preview px-visual-preview-" + effect.id}><i /></span>
              <span className="px-visual-option-copy"><strong>{effect.name}</strong><small>{effect.description}</small><em>{earned ? effect.tag + (selected === effect.id ? " · ACTIVE" : "") : "LOCKED · RANK " + effect.rank + " OR " + effect.mastery + " MASTERY POINTS"}</em></span>
              <span className="px-visual-state">{earned ? (selected === effect.id ? "✓" : "○") : "🔒"}</span>
            </button>;
          })}
        </div>
        <footer className="px-visual-foot">Your display choice is saved on this device. Effects are optional and can be switched off at any time.</footer>
      </section>
    </div> : null}
  </>;
}
