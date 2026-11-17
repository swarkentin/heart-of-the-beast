import { createContext, useContext, useState } from "react";
import { apiRequest, PROFILE_CREDENTIAL_KEY, type ApiLinkedAccount, type ApiProfile } from "./api";

// Optional "Sign in with Discord" (ADR 0034). Signing in never merges
// profiles: a new Discord account adopts this browser's guest profile, and an
// existing one replaces it. When this browser has its own progress, the
// player chooses between keeping it and using the account.

export const DISCORD_CALLBACK_PATH = "/auth/discord/callback";

export type SignInSummary = { displayName: string; adventurerLevel: number; adventurerXp: number; linked: boolean; username?: string };
export type SignInResult =
  | { status: "linked"; profile: ApiProfile }
  | { status: "switched"; credential: string; profile: ApiProfile }
  | { status: "conflict"; state: string; local: SignInSummary; account: SignInSummary }
  | { status: "aborted" };
export type SignInConflict = Extract<SignInResult, { status: "conflict" }>;

export type AccountState = {
  /** Discord sign-in is configured on this server. */
  discordEnabled: boolean;
  /** Signing in is only offered outside a party, so a room seat never changes profile. */
  canSignIn: boolean;
  startDiscord: () => Promise<void>;
};

export const AccountContext = createContext<AccountState>({ discordEnabled: false, canSignIn: false, startDiscord: async () => undefined });

function credential(): string {
  const value = window.localStorage.getItem(PROFILE_CREDENTIAL_KEY);
  if (!value) throw new Error("Profile credential is unavailable. Reload and try again.");
  return value;
}

export async function startDiscordSignIn(): Promise<void> {
  const { url } = await apiRequest<{ url: string }>("/auth/discord/start", credential(), { method: "POST" });
  window.location.assign(url);
}

/**
 * Reads Discord's redirect back to the game, then puts the address bar back to
 * the title screen so a reload does not replay the one-time code.
 */
export function takeDiscordCallback(): { code: string; state: string } | { error: string } | null {
  if (typeof window === "undefined" || window.location.pathname !== DISCORD_CALLBACK_PATH) return null;
  const params = new URLSearchParams(window.location.search);
  window.history.replaceState(null, "", "/");
  const code = params.get("code"), state = params.get("state");
  if (params.get("error")) return { error: params.get("error") === "access_denied" ? "Discord sign-in was cancelled." : "Discord could not sign you in." };
  if (!code || !state) return { error: "Discord sign-in did not finish. Try again." };
  return { code, state };
}

export function completeDiscordSignIn(code: string, state: string): Promise<SignInResult> {
  return apiRequest<SignInResult>("/auth/discord/complete", credential(), { method: "POST", body: JSON.stringify({ code, state }) });
}

export function resolveDiscordSignIn(state: string, choice: "abort" | "use-account"): Promise<SignInResult> {
  return apiRequest<SignInResult>("/auth/discord/resolve", credential(), { method: "POST", body: JSON.stringify({ state, choice }) });
}

/** Stores the credential the server issued for the account's profile. */
export function adoptCredential(value: string) {
  window.localStorage.setItem(PROFILE_CREDENTIAL_KEY, value);
}

/** The sign-in block at the top of the Profile dialog. */
export function AccountPanel({ accounts }: { accounts?: ApiLinkedAccount[] }) {
  const account = useContext(AccountContext);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const discord = accounts?.find(item => item.provider === "discord");
  if (!discord && !account.discordEnabled) return null;
  async function signIn() {
    setBusy(true); setError("");
    try { await account.startDiscord(); } catch (err) { setError(err instanceof Error ? err.message : "Could not start Discord sign-in"); setBusy(false); }
  }
  return <div className="px-account">
    <span className="px-label">ACCOUNT</span>
    {discord
      ? <p className="px-account-linked"><strong>DISCORD</strong> Signed in as {discord.username || "your Discord account"}. Sign in with Discord on another device to play with this profile there.</p>
      : <>
        <p>Playing as a guest on this device. Sign in with Discord to keep your rank and mastery on every device.</p>
        <button type="button" className="px-button px-button-small px-account-discord" disabled={busy || !account.canSignIn} onClick={() => void signIn()}>{busy ? "OPENING DISCORD…" : "SIGN IN WITH DISCORD"}</button>
        {!account.canSignIn ? <small>Leave your party to sign in.</small> : null}
      </>}
    {error ? <span className="px-error" role="alert">{error}</span> : null}
  </div>;
}

const summaryLine = (summary: SignInSummary) => `${summary.displayName || "Adventurer"} · Rank ${summary.adventurerLevel} · ${summary.adventurerXp} XP`;

/**
 * Asked only when the Discord account already has a profile and this device's
 * guest profile has earned XP or mastery. Nothing is merged.
 */
export function SignInConflictDialog({ conflict, busy, error, onChoose }: { conflict: SignInConflict; busy: boolean; error: string; onChoose: (choice: "abort" | "use-account") => void }) {
  return <div className="px-backdrop px-profile-backdrop" role="presentation">
    <section className="px-panel px-account-dialog" role="alertdialog" aria-modal="true" aria-labelledby="px-account-conflict-title" aria-describedby="px-account-conflict-body">
      <p className="px-eyebrow">DISCORD SIGN-IN</p>
      <h2 id="px-account-conflict-title">This device has its own progress</h2>
      <div id="px-account-conflict-body" className="px-account-compare">
        <div><span className="px-label">ON THIS DEVICE</span><strong>{summaryLine(conflict.local)}</strong></div>
        <div><span className="px-label">DISCORD · {conflict.account.username || "ACCOUNT"}</span><strong>{summaryLine(conflict.account)}</strong></div>
      </div>
      <p>{conflict.local.linked
        ? "Using the Discord account switches this device to that profile. The current profile stays with the account it is linked to."
        : "Using the Discord account switches this device to that profile. The progress on this device is not linked to any account and will be left behind. Profiles are not merged."}</p>
      {error ? <p className="px-error" role="alert">{error}</p> : null}
      <div className="px-account-actions">
        <button type="button" className="px-button" disabled={busy} onClick={() => onChoose("abort")} autoFocus>KEEP THIS DEVICE'S PROGRESS</button>
        <button type="button" className="px-button px-button-primary" disabled={busy} onClick={() => onChoose("use-account")}>USE DISCORD PROFILE</button>
      </div>
    </section>
  </div>;
}
