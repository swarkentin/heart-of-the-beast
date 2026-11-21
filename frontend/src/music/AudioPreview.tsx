// Developer audition page: open the app with ?audio-preview to get the sound test with everything unlocked,
// without the game around it. Not linked from the game UI (players reach the sound test from the menu).
import { SoundTestPanel } from "../soundTest";
import "../styles.css";
import "../lobby.css";
import "../visual-effects.css";

export function AudioPreview() {
  return <main className="px-sound-page">
    <p className="px-eyebrow">DEVELOPER AUDITION</p>
    <h1 style={{ font: "400 18px/1.4 \"Press Start 2P\", monospace", margin: "4px 0 0" }}>Sound test</h1>
    <SoundTestPanel standalone />
  </main>;
}
