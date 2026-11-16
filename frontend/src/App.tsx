import { useEffect, useState } from "react";
import { apiRequest, type ApiCommand, type ApiProfile, type ApiRoom, type ApiTheme, type PlayerSession, type SpectatorAccess, type TalentChoice } from "./api";
import { AudioControls, useGameAudio } from "./audio";
import { ConnectingScreen, PartyLobby, TitleScreen, type LobbyCatalog } from "./lobby";
import { deriveMusicCue } from "./music/cue";
import { RunScreen } from "./run/RunScreen";

// Session, polling and commands. The screens themselves live in lobby.tsx and run/.

const talentChoices: TalentChoice[] = [
  { id: "support-disruption", archetype: "support", name: "Disruption", description: "Interrupts deal 4 additional damage.", tier: 1 },
  { id: "support-protective-ward", archetype: "support", name: "Protective Ward", description: "All party members block 2 additional damage when defending.", tier: 1 },
  { id: "support-expose-weakness", archetype: "support", name: "Expose Weakness", description: "Deal 4 extra damage to enemies with a telegraphed move.", tier: 2, requires: "support-disruption" },
  { id: "support-rallying-cry", archetype: "support", name: "Rallying Cry", description: "All living party members recover 2 health after clearing an encounter.", tier: 2, requires: "support-protective-ward" },
  { id: "damage-heavy-hands", archetype: "damage", name: "Heavy Hands", description: "Attacks deal 3 additional damage.", tier: 1 },
  { id: "damage-precision", archetype: "damage", name: "Precision", description: "Attacks deal 2 additional damage.", tier: 1 },
  { id: "damage-opportunist", archetype: "damage", name: "Opportunist", description: "Deal 4 extra damage to enemies with a telegraphed move.", tier: 2, requires: "damage-precision" },
  { id: "damage-counterstrike", archetype: "damage", name: "Counterstrike", description: "Interrupts deal 4 additional damage.", tier: 2, requires: "damage-heavy-hands" },
  { id: "tank-bulwark", archetype: "tank", name: "Bulwark", description: "+6 maximum health.", tier: 1 },
  { id: "tank-braced-stance", archetype: "tank", name: "Braced Stance", description: "Defend blocks 3 additional damage.", tier: 1 },
  { id: "tank-thorns", archetype: "tank", name: "Thorns", description: "Reflect 2 damage when struck.", tier: 2, requires: "tank-bulwark" },
  { id: "tank-unyielding", archetype: "tank", name: "Unyielding", description: "Defend blocks 3 additional damage.", tier: 2, requires: "tank-braced-stance" },
];
const SESSION_KEY = "heart-of-the-beast.player-session";
const PROFILE_CREDENTIAL_KEY = "heart-of-the-beast.profile-credential";

function createProfileCredential(): string {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
}

function readInviteRoomId(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("invite")?.trim() ?? "";
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
  const [inviteRoomId] = useState<string>(readInviteRoomId);
  const [session, setSession] = useState<PlayerSession | null>(() => {
    if (typeof window === "undefined" || readSpectatorAccess() || readInviteRoomId()) return null;
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

  useEffect(() => {
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

  useEffect(() => {
    if (!inviteRoomId) return;
    let active = true;
    async function acceptInvite() {
      setBusy(true);
      setError("");
      try {
        const joined = await apiRequest<{ room: ApiRoom; playerId: string; playerToken: string }>("/rooms/join", undefined, {
          method: "POST",
          body: JSON.stringify({ roomId: inviteRoomId }),
        });
        if (!active) return;
        const nextSession = { roomId: joined.room.id, playerId: joined.playerId, playerToken: joined.playerToken };
        window.localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
        setSession(nextSession);
        setSnapshot(joined.room);
        const url = new URL(window.location.href);
        url.searchParams.delete("invite");
        window.history.replaceState({}, "", url.toString());
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Could not join the invited party");
      } finally {
        if (active) setBusy(false);
      }
    }
    void acceptInvite();
    return () => { active = false; };
  }, [inviteRoomId]);

  const spectator = Boolean(spectatorAccess);
  const roomId = spectatorAccess?.roomId || session?.roomId;
  const token = spectatorAccess?.token || session?.playerToken;
  const run = snapshot?.run;
  const serverRoom = run?.rooms[run.currentRoomId];
  const playerId = session?.playerId || snapshot?.ownerPlayerId || snapshot?.playerIds[0];
  const playerHp = (playerId ? run?.players[playerId]?.health : undefined) ?? 30;
  const isHost = Boolean(session && snapshot && session.playerId === snapshot.ownerPlayerId);
  const audio = useGameAudio(deriveMusicCue(run), run?.phase ?? "lobby", playerHp, (serverRoom?.encounter?.enemies ?? []).map(enemy => ({ id: enemy.id, hp: enemy.health })), run?.lastCombatEvents ?? [], snapshot?.version ?? 0);
  const audioControls = <AudioControls settings={audio.settings} onEnable={() => { void audio.enable(); }} onChange={audio.updateSettings} title={audio.title} />;
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

  useEffect(() => {
    if (spectator || (run?.phase !== "completed" && run?.phase !== "failed")) return;
    let active = true;
    const credential = window.localStorage.getItem(PROFILE_CREDENTIAL_KEY);
    if (!credential) return;
    void apiRequest<ApiProfile>("/profile", credential)
      .then(value => { if (active) setProfile(value); })
      .catch(() => { /* A later visit can retry loading the profile. */ });
    return () => { active = false; };
  }, [run?.id, run?.phase, spectator]);

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

  async function selectClass(classId: string) {
    if (!session || busy || run) return;
    setBusy(true); setError("");
    try {
      const next = await apiRequest<ApiRoom>("/rooms/" + session.roomId + "/class", session.playerToken, { method: "POST", body: JSON.stringify({ classId }) });
      setSnapshot(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not select class");
    } finally { setBusy(false); }
  }

  async function chooseTalent(talentId: string): Promise<boolean> {
    if (!talentId || !session || busy || spectator) return false;
    setBusy(true); setError("");
    try {
      setSnapshot(await apiRequest<ApiRoom>("/rooms/" + session.roomId + "/talents", session.playerToken, { method: "POST", body: JSON.stringify({ talentId }) }));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not choose talent");
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
    return <TitleScreen busy={busy} error={error} joinCode={joinCode} onJoinCode={setJoinCode} onCreate={() => void createRun()} onJoin={() => void joinRoom()} profile={profile} classes={classCatalog?.classes ?? []} rewards={classCatalog?.profileRewards ?? []} audioControls={audioControls} onSaveName={saveProfileName} />;
  }

  if (!snapshot) {
    return <ConnectingScreen message={error || "Connecting to the room…"} />;
  }

  if (!run || !serverRoom) {
    return <PartyLobby room={snapshot} catalog={classCatalog} playerId={session?.playerId || ""} isHost={isHost} busy={busy} error={error} talents={talentChoices} themes={themes} themeId={chosenTheme} onTheme={setChosenTheme} profile={profile} audioControls={audioControls} onSaveName={saveProfileName} onSelectClass={classId => void selectClass(classId)} onStart={() => void startRun()} onLeave={() => void leaveRoom()} />;
  }

  return <RunScreen snapshot={snapshot} run={run} room={serverRoom} session={session} spectator={spectator} catalog={classCatalog} profile={profile} talents={talentChoices} busy={busy} error={error} isHost={isHost} audioControls={audioControls} onSaveName={saveProfileName}
    onCommand={sendCommand} onChooseTalent={chooseTalent} onLeave={() => void leaveRoom()} onReturnToLobby={() => void returnToLobby()} />;
}
