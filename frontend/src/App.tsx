import { useCallback, useEffect, useState, type ReactElement } from "react";
import { AccountContext, adoptCredential, completeDiscordSignIn, resolveDiscordSignIn, SignInConflictDialog, startDiscordSignIn, takeDiscordCallback, type SignInConflict, type SignInResult } from "./account";
import { apiRequest, PROFILE_CREDENTIAL_KEY, type ApiCommand, type ApiProfile, type ApiRoom, type ApiTheme, type PlayerSession, type SpectatorAccess } from "./api";
import { AudioControls, SoundContext, useGameAudio } from "./audio";
import { ConnectingScreen, PartyLobby, TitleScreen, type HeroSkin, type LobbyCatalog } from "./lobby";
import { deriveMusicCue } from "./music/cue";
import { RunScreen } from "./run/RunScreen";

// Session, polling and commands. The screens themselves live in lobby.tsx and run/.

const SESSION_KEY = "heart-of-the-beast.player-session";
// Read once at load: Discord returns here after sign-in (ADR 0034).
const DISCORD_CALLBACK = takeDiscordCallback();
let discordCallbackStarted = false;

function createProfileCredential(): string {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
}

function readSpectatorAccess(): SpectatorAccess | null {
  if (typeof window === "undefined" || !window.location.hash.startsWith("#spectate=")) return null;
  try {
    const value = decodeURIComponent(window.location.hash.slice("#spectate=".length));
    const separator = value.indexOf(":");
    if (separator <= 0) return null;
    return { roomId: value.slice(0, separator), token: value.slice(separator + 1) };
  } catch {
    return null;
  }
}

export default function App() {
  const [spectatorAccess] = useState<SpectatorAccess | null>(readSpectatorAccess);
  const [session, setSession] = useState<PlayerSession | null>(() => {
    if (typeof window === "undefined" || readSpectatorAccess()) return null;
    try { return JSON.parse(window.localStorage.getItem(SESSION_KEY) || "null") as PlayerSession | null; }
    catch { return null; }
  });
  const [snapshot, setSnapshot] = useState<ApiRoom | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [classCatalog, setClassCatalog] = useState<LobbyCatalog | null>(null);
  const [themes, setThemes] = useState<ApiTheme[]>([]);
  const [chosenTheme, setChosenTheme] = useState("random");
  useEffect(() => { void apiRequest<{ themes: ApiTheme[] }>("/themes").then(result => setThemes(result.themes ?? [])).catch(() => undefined); }, []);
  const [profile, setProfile] = useState<ApiProfile | null>(null);
  const [discordEnabled, setDiscordEnabled] = useState(false);
  const [accountNotice, setAccountNotice] = useState(DISCORD_CALLBACK && "error" in DISCORD_CALLBACK ? DISCORD_CALLBACK.error : "");
  const [signInConflict, setSignInConflict] = useState<SignInConflict | null>(null);
  const [conflictBusy, setConflictBusy] = useState(false);
  const [conflictError, setConflictError] = useState("");
  useEffect(() => { void apiRequest<{ providers: string[] }>("/auth/providers").then(result => setDiscordEnabled((result.providers ?? []).includes("discord"))).catch(() => undefined); }, []);

  function reloadProfile() {
    const credential = window.localStorage.getItem(PROFILE_CREDENTIAL_KEY);
    if (!credential) return;
    void apiRequest<ApiProfile>("/profile", credential, { method: "POST" }).then(setProfile).catch(() => { /* A later visit can retry loading the profile. */ });
  }

  function applySignIn(result: SignInResult) {
    if (result.status === "linked") {
      setProfile(result.profile);
      setAccountNotice("Signed in with Discord. This profile now follows you to any device you sign in on.");
    } else if (result.status === "switched") {
      adoptCredential(result.credential);
      setProfile(result.profile);
      setAccountNotice("Signed in with Discord. This device now uses your Discord profile.");
    } else if (result.status === "conflict") {
      setConflictError("");
      setSignInConflict(result);
      reloadProfile();
    } else {
      setAccountNotice("Kept this device's progress. Your Discord account was not used.");
      reloadProfile();
    }
  }

  async function chooseSignIn(choice: "abort" | "use-account") {
    if (!signInConflict) return;
    setConflictBusy(true); setConflictError("");
    try {
      const result = await resolveDiscordSignIn(signInConflict.state, choice);
      setSignInConflict(null);
      applySignIn(result);
    } catch (err) {
      // Keeping this device's progress never needs the server, so it always closes the dialog.
      if (choice === "abort") setSignInConflict(null);
      else setConflictError(err instanceof Error ? err.message : "Could not use the Discord profile");
    } finally { setConflictBusy(false); }
  }

  useEffect(() => {
    if (!DISCORD_CALLBACK || !("code" in DISCORD_CALLBACK)) return;
    if (discordCallbackStarted) return;
    discordCallbackStarted = true;
    void completeDiscordSignIn(DISCORD_CALLBACK.code, DISCORD_CALLBACK.state)
      .then(applySignIn)
      .catch(err => { setAccountNotice(err instanceof Error ? err.message : "Discord sign-in failed"); reloadProfile(); });
  }, []);

  useEffect(() => {
    // Returning from Discord: the sign-in effect above loads the right profile.
    if (DISCORD_CALLBACK && "code" in DISCORD_CALLBACK) return;
    let active = true;
    try {
      let credential = window.localStorage.getItem(PROFILE_CREDENTIAL_KEY);
      if (!credential) {
        credential = createProfileCredential();
        window.localStorage.setItem(PROFILE_CREDENTIAL_KEY, credential);
      }
      void apiRequest<ApiProfile>("/profile", credential, { method: "POST" })
        .then(value => { if (active) setProfile(value); })
        .catch(err => { if (active) setError(err instanceof Error ? err.message : "Unable to load adventurer profile"); });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to initialize adventurer profile");
    }
    return () => { active = false; };
  }, []);

  const spectator = Boolean(spectatorAccess);
  const roomId = spectatorAccess?.roomId || session?.roomId;
  const token = spectatorAccess?.token || session?.playerToken;
  const run = snapshot?.run;
  const serverRoom = run?.rooms[run.currentRoomId];
  const playerId = session?.playerId || snapshot?.ownerPlayerId || snapshot?.playerIds[0];
  const playerHp = (playerId ? run?.players[playerId]?.health : undefined) ?? 30;
  const isHost = Boolean(session && snapshot && session.playerId === snapshot.ownerPlayerId);
  const musicCue = run ? deriveMusicCue(run) : { ...deriveMusicCue(undefined), theme: roomId ? "jungle" as const : "catacombs" as const, state: roomId ? "party" as const : "title" as const };
  const audio = useGameAudio(musicCue, run?.phase ?? "lobby", playerHp, (serverRoom?.encounter?.enemies ?? []).map(enemy => ({ id: enemy.id, hp: enemy.health })), run?.lastCombatEvents ?? [], snapshot?.version ?? 0);
  const audioControls = <AudioControls settings={audio.settings} running={audio.running} onEnable={() => { void audio.enable(); }} onChange={audio.updateSettings} title={audio.title} />;
  const sound = { settings: audio.settings, running: audio.running, toggle: audio.toggle };
  const accountState = { discordEnabled, canSignIn: !session && !spectator, startDiscord: startDiscordSignIn };
  const withSound = (screen: ReactElement) => <SoundContext.Provider value={sound}><AccountContext.Provider value={accountState}>
    {screen}
    {accountNotice ? <div className="px-panel px-account-toast" role="status"><span>{accountNotice}</span><button type="button" className="px-button px-button-small" onClick={() => setAccountNotice("")}>OK</button></div> : null}
    {signInConflict ? <SignInConflictDialog conflict={signInConflict} busy={conflictBusy} error={conflictError} onChoose={choice => void chooseSignIn(choice)} /> : null}
  </AccountContext.Provider></SoundContext.Provider>;
  // A round resolves on the server at its deadline and only a snapshot reveals it, so poll faster while one is running.
  const pollMs = run?.phase === "combat" ? 750 : 1500;

  useEffect(() => {
    if (!roomId || !token) return;
    let active = true;
    const load = async () => {
      try {
        const next = await apiRequest<ApiRoom>(spectator ? "/spectate/" + roomId : "/rooms/" + roomId, token);
        if (active) {
          setSnapshot(current => !current || next.version >= current.version ? next : current);
          setError("");
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load room");
      }
    };
    void load();
    const timer = window.setInterval(() => { void load(); }, pollMs);
    return () => { active = false; window.clearInterval(timer); };
  }, [roomId, token, spectator, pollMs]);

  const refreshProgressProfile = useCallback(async (): Promise<ApiProfile> => {
    const credential = window.localStorage.getItem(PROFILE_CREDENTIAL_KEY);
    if (!credential) throw new Error("Profile credential is unavailable");
    const value = await apiRequest<ApiProfile>("/profile", credential);
    setProfile(value);
    return value;
  }, []);

  // Refresh lifetime bestiary data as soon as the server reports a defeat, so
  // the profile's Stats tab is current without waiting for the run to end.
  const bestiaryRefreshKey = (run?.lastCombatEvents ?? []).filter(event => event.kind === "enemy_defeated").map(event => event.round + ":" + event.message).join("|");
  useEffect(() => {
    if (!bestiaryRefreshKey) return;
    void refreshProgressProfile().catch(() => { /* A later profile open or run refresh can retry. */ });
  }, [bestiaryRefreshKey, refreshProgressProfile]);

  useEffect(() => {
    if (classCatalog) return;
    let active = true;
    void apiRequest<LobbyCatalog>("/progression").then(value => { if (active) setClassCatalog(value); }).catch(err => { if (active) setError(err instanceof Error ? err.message : "Unable to load class choices"); });
    return () => { active = false; };
  }, [classCatalog]);

  useEffect(() => {
    if (!session || spectator) return;
    let active = true;
    const heartbeat = async () => {
      try {
        const next = await apiRequest<ApiRoom>("/rooms/" + session.roomId + "/heartbeat", session.playerToken, { method: "POST" });
        if (active) setSnapshot(current => !current || next.version >= current.version ? next : current);
      } catch {
        // Snapshot polling continues during a temporary disconnect; the server
        // marks the player disconnected only after the heartbeat grace period.
      }
    };
    void heartbeat();
    const timer = window.setInterval(() => { void heartbeat(); }, 10000);
    return () => { active = false; window.clearInterval(timer); };
  }, [session?.roomId, session?.playerToken, spectator]);

  async function createRun() {
    setBusy(true); setError("");
    try {
      const created = await apiRequest<{ room: ApiRoom; playerToken: string; spectatorToken: string }>("/rooms", undefined, { method: "POST" });
      const nextSession = { roomId: created.room.id, playerId: created.room.ownerPlayerId, playerToken: created.playerToken, spectatorToken: created.spectatorToken };
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
      setSnapshot(created.room);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the room");
    } finally { setBusy(false); }
  }

  async function saveProfileName(name: string) {
    const credential = window.localStorage.getItem(PROFILE_CREDENTIAL_KEY);
    if (!credential) throw new Error("Profile credential is unavailable. Reload and try again.");
    const updated = await apiRequest<ApiProfile>("/profile", credential, { method: "PATCH", body: JSON.stringify({ displayName: name }) });
    setProfile(updated);
  }

  async function joinRoom() {
    setBusy(true); setError("");
    try {
      const joined = await apiRequest<{ room: ApiRoom; playerId: string; playerToken: string }>("/rooms/join", undefined, { method: "POST", body: JSON.stringify({ code: joinCode.trim() }) });
      const nextSession = { roomId: joined.room.id, playerId: joined.playerId, playerToken: joined.playerToken };
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
      setSnapshot(joined.room);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join the room");
    } finally { setBusy(false); }
  }

  async function selectClass(classId: string, skin?: HeroSkin, skillIds?: string[]) {
    if (!session || busy || run) return;
    setBusy(true); setError("");
    try {
      const body = { classId, ...(skin ? { tier: skin.tier, variant: skin.variant } : {}), ...(skillIds?.length ? { skillIds } : {}) };
      const next = await apiRequest<ApiRoom>("/rooms/" + session.roomId + "/class", session.playerToken, { method: "POST", body: JSON.stringify(body) });
      setSnapshot(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not select class");
    } finally { setBusy(false); }
  }

  /** Saves the lobby skill bar; the server checks every skill against the profile's class mastery. */
  async function saveLoadout(skillIds: string[]): Promise<boolean> {
    if (!session || busy || run || spectator) return false;
    setBusy(true); setError("");
    try {
      setSnapshot(await apiRequest<ApiRoom>("/rooms/" + session.roomId + "/loadout", session.playerToken, { method: "POST", body: JSON.stringify({ skillIds }) }));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save those skills");
      return false;
    } finally { setBusy(false); }
  }

  async function startRun() {
    if (!session || !isHost || busy) return;
    setBusy(true); setError("");
    try {
      const themeId = new URLSearchParams(window.location.search).get("theme") || chosenTheme;
      const started = await apiRequest<ApiRoom>("/rooms/" + session.roomId + "/start", session.playerToken, {
        method: "POST",
        body: themeId ? JSON.stringify({ themeId }) : undefined,
      });
      setSnapshot(started);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the run");
    } finally { setBusy(false); }
  }

  async function returnToLobby() {
    if (!session || !isHost || busy) return;
    setBusy(true); setError("");
    try {
      const lobby = await apiRequest<ApiRoom>("/rooms/" + session.roomId + "/return-to-lobby", session.playerToken, { method: "POST" });
      setSnapshot(lobby);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not return to the lobby");
    } finally { setBusy(false); }
  }

  async function leaveRoom() {
    if (!session || busy) return;
    setBusy(true); setError("");
    try {
      await apiRequest<ApiRoom>("/rooms/" + session.roomId + "/leave", session.playerToken, { method: "POST" });
      window.localStorage.removeItem(SESSION_KEY);
      setSession(null);
      setSnapshot(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not leave the room");
    } finally { setBusy(false); }
  }

  async function sendCommand(command: ApiCommand): Promise<boolean> {
    if (!session || busy) return false;
    setBusy(true); setError("");
    try {
      setSnapshot(await apiRequest<ApiRoom>("/rooms/" + session.roomId + "/commands", session.playerToken, { method: "POST", body: JSON.stringify(command) }));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Command failed");
      try { setSnapshot(await apiRequest<ApiRoom>("/rooms/" + session.roomId, session.playerToken)); } catch { /* Keep the original command error visible. */ }
      return false;
    } finally { setBusy(false); }
  }

  if (!roomId || !token) {
    return withSound(<TitleScreen busy={busy} error={error} joinCode={joinCode} onJoinCode={setJoinCode} onCreate={() => void createRun()} onJoin={() => void joinRoom()} profile={profile} classes={classCatalog?.classes ?? []} rewards={classCatalog?.profileRewards ?? []} audioControls={audioControls} onSaveName={saveProfileName} />);
  }

  if (!snapshot) {
    return withSound(<ConnectingScreen message={error || "Connecting to the room…"} />);
  }

  if (!run || !serverRoom) {
    return withSound(<PartyLobby room={snapshot} catalog={classCatalog} playerId={session?.playerId || ""} isHost={isHost} busy={busy} error={error} themes={themes} themeId={chosenTheme} onTheme={setChosenTheme} profile={profile} audioControls={audioControls} onSaveName={saveProfileName} onSelectClass={(classId, skin, skillIds) => void selectClass(classId, skin, skillIds)} onSaveLoadout={saveLoadout} onStart={() => void startRun()} onLeave={() => void leaveRoom()} />);
  }

  return withSound(<RunScreen snapshot={snapshot} run={run} room={serverRoom} session={session} spectator={spectator} catalog={classCatalog} profile={profile} busy={busy} error={error} isHost={isHost} audioControls={audioControls} onSaveName={saveProfileName} onRefreshProfile={refreshProgressProfile}
    onCommand={sendCommand} onLeave={() => void leaveRoom()} onReturnToLobby={() => void returnToLobby()} />);
}
