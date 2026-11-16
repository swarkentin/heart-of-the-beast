package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/game"
	"github.com/swarkentin/heart-of-the-beast/backend/internal/store"
)

func TestHealth(t *testing.T) {
	response := httptest.NewRecorder()
	NewHandler(store.NewMemory()).ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", response.Code)
	}
}

func TestRoomLifecycleAndReadOnlySpectator(t *testing.T) {
	handler := NewHandler(store.NewMemory())
	create := httptest.NewRecorder()
	handler.ServeHTTP(create, httptest.NewRequest(http.MethodPost, "/rooms", nil))
	if create.Code != http.StatusCreated {
		t.Fatalf("create room: %d %s", create.Code, create.Body.String())
	}
	var created struct {
		Room struct {
			ID string `json:"id"`
		} `json:"room"`
		PlayerToken    string `json:"playerToken"`
		SpectatorToken string `json:"spectatorToken"`
	}
	if err := json.Unmarshal(create.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	if created.Room.ID == "" || created.PlayerToken == "" || created.SpectatorToken == "" {
		t.Fatal("create response omitted credentials")
	}

	start := httptest.NewRequest(http.MethodPost, "/rooms/"+created.Room.ID+"/start", nil)
	start.Header.Set("Authorization", "Bearer "+created.PlayerToken)
	startResponse := httptest.NewRecorder()
	handler.ServeHTTP(startResponse, start)
	if startResponse.Code != http.StatusOK {
		t.Fatalf("start run: %d %s", startResponse.Code, startResponse.Body.String())
	}

	spectate := httptest.NewRequest(http.MethodGet, "/spectate/"+created.Room.ID, nil)
	spectate.Header.Set("Authorization", "Bearer "+created.SpectatorToken)
	spectateResponse := httptest.NewRecorder()
	handler.ServeHTTP(spectateResponse, spectate)
	if spectateResponse.Code != http.StatusOK {
		t.Fatalf("spectate: %d %s", spectateResponse.Code, spectateResponse.Body.String())
	}

	invalid := httptest.NewRequest(http.MethodPost, "/rooms/"+created.Room.ID+"/commands", bytes.NewBufferString(`{"type":"combat","round":1,"action":"attack","targetId":"sentinel"}`))
	invalid.Header.Set("Authorization", "Bearer "+created.SpectatorToken)
	invalidResponse := httptest.NewRecorder()
	handler.ServeHTTP(invalidResponse, invalid)
	if invalidResponse.Code != http.StatusUnauthorized {
		t.Fatalf("spectator command should be rejected, got %d", invalidResponse.Code)
	}
}

func TestPlayersCanJoinLobbyAndShareRun(t *testing.T) {
	handler := NewHandler(store.NewMemory())
	create := httptest.NewRecorder()
	handler.ServeHTTP(create, httptest.NewRequest(http.MethodPost, "/rooms", nil))
	if create.Code != http.StatusCreated {
		t.Fatalf("create room: %d %s", create.Code, create.Body.String())
	}
	var host struct {
		Room struct {
			ID            string   `json:"id"`
			Code          string   `json:"code"`
			OwnerPlayerID string   `json:"ownerPlayerId"`
			PlayerIDs     []string `json:"playerIds"`
		} `json:"room"`
		PlayerToken string `json:"playerToken"`
	}
	if err := json.Unmarshal(create.Body.Bytes(), &host); err != nil {
		t.Fatal(err)
	}
	joinBody, _ := json.Marshal(map[string]string{"code": strings.ToLower(host.Room.Code)})
	joined := httptest.NewRecorder()
	handler.ServeHTTP(joined, httptest.NewRequest(http.MethodPost, "/rooms/join", bytes.NewReader(joinBody)))
	if joined.Code != http.StatusCreated {
		t.Fatalf("join room: %d %s", joined.Code, joined.Body.String())
	}
	var guest struct {
		Room struct {
			ID        string   `json:"id"`
			PlayerIDs []string `json:"playerIds"`
		} `json:"room"`
		PlayerID    string `json:"playerId"`
		PlayerToken string `json:"playerToken"`
	}
	if err := json.Unmarshal(joined.Body.Bytes(), &guest); err != nil {
		t.Fatal(err)
	}
	if guest.Room.ID != host.Room.ID || len(guest.Room.PlayerIDs) != 2 || guest.PlayerID == "" || guest.PlayerToken == "" {
		t.Fatalf("unexpected joined response: %+v", guest)
	}

	start := httptest.NewRequest(http.MethodPost, "/rooms/"+host.Room.ID+"/start", nil)
	start.Header.Set("Authorization", "Bearer "+host.PlayerToken)
	started := httptest.NewRecorder()
	handler.ServeHTTP(started, start)
	if started.Code != http.StatusOK {
		t.Fatalf("host start: %d %s", started.Code, started.Body.String())
	}

	get := httptest.NewRequest(http.MethodGet, "/rooms/"+host.Room.ID, nil)
	get.Header.Set("Authorization", "Bearer "+guest.PlayerToken)
	guestSnapshot := httptest.NewRecorder()
	handler.ServeHTTP(guestSnapshot, get)
	if guestSnapshot.Code != http.StatusOK {
		t.Fatalf("guest snapshot: %d %s", guestSnapshot.Code, guestSnapshot.Body.String())
	}

	command := httptest.NewRequest(http.MethodPost, "/rooms/"+host.Room.ID+"/commands", bytes.NewBufferString(attackEntryEnemy(t, started.Body.Bytes(), 1)))
	command.Header.Set("Authorization", "Bearer "+guest.PlayerToken)
	acted := httptest.NewRecorder()
	handler.ServeHTTP(acted, command)
	if acted.Code != http.StatusOK {
		t.Fatalf("guest command: %d %s", acted.Code, acted.Body.String())
	}
}

func TestJoinRejectsStartedFullAndUnknownRooms(t *testing.T) {
	handler := NewHandler(store.NewMemory())
	join := func(code string) *httptest.ResponseRecorder {
		body, _ := json.Marshal(map[string]string{"code": code})
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/rooms/join", bytes.NewReader(body)))
		return response
	}
	if response := join("ABC123"); response.Code != http.StatusNotFound {
		t.Fatalf("unknown code: %d", response.Code)
	}

	create := httptest.NewRecorder()
	handler.ServeHTTP(create, httptest.NewRequest(http.MethodPost, "/rooms", nil))
	var created struct {
		Room struct {
			ID        string   `json:"id"`
			Code      string   `json:"code"`
			PlayerIDs []string `json:"playerIds"`
		} `json:"room"`
		PlayerToken string `json:"playerToken"`
	}
	if err := json.Unmarshal(create.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	for len(created.Room.PlayerIDs) < maxRoomPlayers {
		response := join(created.Room.Code)
		if response.Code != http.StatusCreated {
			t.Fatalf("join before full: %d %s", response.Code, response.Body.String())
		}
		var payload struct {
			Room struct {
				PlayerIDs []string `json:"playerIds"`
			} `json:"room"`
		}
		if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
			t.Fatal(err)
		}
		created.Room.PlayerIDs = payload.Room.PlayerIDs
	}
	if response := join(created.Room.Code); response.Code != http.StatusConflict {
		t.Fatalf("full room should reject join: %d", response.Code)
	}

	start := httptest.NewRequest(http.MethodPost, "/rooms/"+created.Room.ID+"/start", nil)
	start.Header.Set("Authorization", "Bearer "+created.PlayerToken)
	started := httptest.NewRecorder()
	handler.ServeHTTP(started, start)
	if started.Code != http.StatusOK {
		t.Fatalf("start: %d %s", started.Code, started.Body.String())
	}
	if response := join(created.Room.Code); response.Code != http.StatusConflict {
		t.Fatalf("started room should reject join: %d", response.Code)
	}
}

func TestPlayerHeartbeatLeaveAndReconnectPresence(t *testing.T) {
	handler := NewHandler(store.NewMemory())
	create := httptest.NewRecorder()
	handler.ServeHTTP(create, httptest.NewRequest(http.MethodPost, "/rooms", nil))
	var host struct {
		Room struct {
			ID   string `json:"id"`
			Code string `json:"code"`
		} `json:"room"`
		PlayerToken string `json:"playerToken"`
	}
	if err := json.Unmarshal(create.Body.Bytes(), &host); err != nil {
		t.Fatal(err)
	}

	body, _ := json.Marshal(map[string]string{"code": host.Room.Code})
	joined := httptest.NewRecorder()
	handler.ServeHTTP(joined, httptest.NewRequest(http.MethodPost, "/rooms/join", bytes.NewReader(body)))
	var guest struct {
		Room struct {
			Version int64 `json:"version"`
		} `json:"room"`
		PlayerID    string `json:"playerId"`
		PlayerToken string `json:"playerToken"`
	}
	if err := json.Unmarshal(joined.Body.Bytes(), &guest); err != nil {
		t.Fatal(err)
	}

	request := func(path, token string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodPost, path, nil)
		req.Header.Set("Authorization", "Bearer "+token)
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, req)
		return response
	}
	heartbeat := request("/rooms/"+host.Room.ID+"/heartbeat", guest.PlayerToken)
	if heartbeat.Code != http.StatusOK {
		t.Fatalf("heartbeat: %d %s", heartbeat.Code, heartbeat.Body.String())
	}
	var heartbeatSnapshot struct {
		Version int64 `json:"version"`
	}
	if err := json.Unmarshal(heartbeat.Body.Bytes(), &heartbeatSnapshot); err != nil {
		t.Fatal(err)
	}
	if heartbeatSnapshot.Version != guest.Room.Version {
		t.Fatalf("heartbeat should not contend with gameplay versioning: before %d after %d", guest.Room.Version, heartbeatSnapshot.Version)
	}

	leave := request("/rooms/"+host.Room.ID+"/leave", guest.PlayerToken)
	if leave.Code != http.StatusOK {
		t.Fatalf("leave: %d %s", leave.Code, leave.Body.String())
	}
	var left struct {
		Presence map[string]struct {
			Status string `json:"status"`
		} `json:"presence"`
	}
	if err := json.Unmarshal(leave.Body.Bytes(), &left); err != nil {
		t.Fatal(err)
	}
	if left.Presence[guest.PlayerID].Status != "left" {
		t.Fatalf("expected left presence, got %+v", left.Presence[guest.PlayerID])
	}

	get := httptest.NewRequest(http.MethodGet, "/rooms/"+host.Room.ID, nil)
	get.Header.Set("Authorization", "Bearer "+host.PlayerToken)
	snapshot := httptest.NewRecorder()
	handler.ServeHTTP(snapshot, get)
	if snapshot.Code != http.StatusOK {
		t.Fatalf("host snapshot: %d %s", snapshot.Code, snapshot.Body.String())
	}
	if response := request("/rooms/"+host.Room.ID+"/heartbeat", guest.PlayerToken); response.Code != http.StatusUnauthorized {
		t.Fatalf("left player token should be revoked, got %d", response.Code)
	}

	replacement := httptest.NewRecorder()
	handler.ServeHTTP(replacement, httptest.NewRequest(http.MethodPost, "/rooms/join", bytes.NewReader(body)))
	if replacement.Code != http.StatusCreated {
		t.Fatalf("leaving should free a lobby slot: %d %s", replacement.Code, replacement.Body.String())
	}
}

func TestPublicRoomDerivesPresenceFromHeartbeatAge(t *testing.T) {
	now := time.Now().UTC()
	leftAt := now
	room := &game.Room{
		PlayerIDs: []string{"online", "disconnected", "left"},
		Presence: map[string]game.PlayerPresence{
			"online":       {LastSeenAt: now},
			"disconnected": {LastSeenAt: now.Add(-presenceTimeout - time.Second)},
			"left":         {LastSeenAt: now, LeftAt: &leftAt},
		},
	}
	snapshot := publicRoom(room, now)
	if snapshot.Presence["online"].Status != "online" {
		t.Fatalf("expected online status, got %q", snapshot.Presence["online"].Status)
	}
	if snapshot.Presence["disconnected"].Status != "disconnected" {
		t.Fatalf("expected disconnected status, got %q", snapshot.Presence["disconnected"].Status)
	}
	if snapshot.Presence["left"].Status != "left" {
		t.Fatalf("expected left status, got %q", snapshot.Presence["left"].Status)
	}
}

func TestCoopCombatWaitsForPartyAndResolvesThroughHTTP(t *testing.T) {
	now := time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC)
	handler := NewHandlerWithClock(store.NewMemory(), func() time.Time { return now })
	request := func(method, path, token, body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, req)
		return response
	}

	created := request(http.MethodPost, "/rooms", "", "")
	if created.Code != http.StatusCreated {
		t.Fatalf("create room: %d %s", created.Code, created.Body.String())
	}
	var host struct {
		Room struct {
			ID   string `json:"id"`
			Code string `json:"code"`
		} `json:"room"`
		PlayerToken string `json:"playerToken"`
	}
	if err := json.Unmarshal(created.Body.Bytes(), &host); err != nil {
		t.Fatal(err)
	}

	joined := request(http.MethodPost, "/rooms/join", "", `{"code":"`+host.Room.Code+`"}`)
	if joined.Code != http.StatusCreated {
		t.Fatalf("join: %d %s", joined.Code, joined.Body.String())
	}
	var guest struct {
		PlayerToken string `json:"playerToken"`
	}
	if err := json.Unmarshal(joined.Body.Bytes(), &guest); err != nil {
		t.Fatal(err)
	}

	started := request(http.MethodPost, "/rooms/"+host.Room.ID+"/start", host.PlayerToken, "")
	if started.Code != http.StatusOK {
		t.Fatalf("start: %d %s", started.Code, started.Body.String())
	}

	entryEnemy := entryRoom(t, started.Body.Bytes()).Encounter.Enemies[0]
	attack := attackEntryEnemy(t, started.Body.Bytes(), 1)
	guestAction := request(http.MethodPost, "/rooms/"+host.Room.ID+"/commands", guest.PlayerToken, attack)
	if guestAction.Code != http.StatusOK {
		t.Fatalf("guest action: %d %s", guestAction.Code, guestAction.Body.String())
	}
	var pending struct {
		Run struct {
			Rooms map[string]struct {
				Encounter struct {
					Enemies []game.Enemy `json:"enemies"`
				} `json:"encounter"`
			} `json:"rooms"`
		} `json:"run"`
	}
	if err := json.Unmarshal(guestAction.Body.Bytes(), &pending); err != nil {
		t.Fatal(err)
	}
	if got := pending.Run.Rooms["d1-entry"].Encounter.Enemies[0].Health; got != entryEnemy.Health {
		t.Fatalf("guest action resolved before host action: enemy health=%d", got)
	}

	hostAction := request(http.MethodPost, "/rooms/"+host.Room.ID+"/commands", host.PlayerToken, attack)
	if hostAction.Code != http.StatusOK {
		t.Fatalf("host action: %d %s", hostAction.Code, hostAction.Body.String())
	}
	var resolved struct {
		Run game.Run `json:"run"`
	}
	if err := json.Unmarshal(hostAction.Body.Bytes(), &resolved); err != nil {
		t.Fatal(err)
	}
	// Two Strikes land together. The entry guard of a two-player party survives them, so the fight goes on.
	want := entryEnemy.Health - 2*game.PlayerStrikeDamage
	if want <= 0 {
		t.Fatalf("test assumes the entry enemy survives two strikes, health=%d", entryEnemy.Health)
	}
	if got := resolved.Run.Rooms["d1-entry"].Encounter.Enemies[0].Health; resolved.Run.Phase != game.PhaseCombat || got != want || resolved.Run.CombatRound.Number != 2 {
		t.Fatalf("both party actions should resolve together: phase=%s enemy health=%d want %d", resolved.Run.Phase, got, want)
	}
}

func TestHostCanReturnEndedRunToSameLobby(t *testing.T) {
	memory := store.NewMemory()
	handler := NewHandler(memory)
	request := func(method, path, token, body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, req)
		return response
	}

	created := request(http.MethodPost, "/rooms", "", "")
	if created.Code != http.StatusCreated {
		t.Fatalf("create room: %d %s", created.Code, created.Body.String())
	}
	var host struct {
		Room struct {
			ID            string   `json:"id"`
			Code          string   `json:"code"`
			OwnerPlayerID string   `json:"ownerPlayerId"`
			PlayerIDs     []string `json:"playerIds"`
		} `json:"room"`
		PlayerToken string `json:"playerToken"`
	}
	if err := json.Unmarshal(created.Body.Bytes(), &host); err != nil {
		t.Fatal(err)
	}

	joined := request(http.MethodPost, "/rooms/join", "", `{"code":"`+host.Room.Code+`"}`)
	if joined.Code != http.StatusCreated {
		t.Fatalf("join room: %d %s", joined.Code, joined.Body.String())
	}
	var guest struct {
		PlayerID    string `json:"playerId"`
		PlayerToken string `json:"playerToken"`
	}
	if err := json.Unmarshal(joined.Body.Bytes(), &guest); err != nil {
		t.Fatal(err)
	}

	started := request(http.MethodPost, "/rooms/"+host.Room.ID+"/start", host.PlayerToken, "")
	if started.Code != http.StatusOK {
		t.Fatalf("start run: %d %s", started.Code, started.Body.String())
	}
	room, err := memory.Get(t.Context(), host.Room.ID)
	if err != nil {
		t.Fatal(err)
	}
	room.Run.Phase = game.PhaseCompleted
	expectedVersion := room.Version
	room.Version++
	if err := memory.Save(t.Context(), room, expectedVersion); err != nil {
		t.Fatal(err)
	}

	guestReturn := request(http.MethodPost, "/rooms/"+host.Room.ID+"/return-to-lobby", guest.PlayerToken, "")
	if guestReturn.Code != http.StatusForbidden {
		t.Fatalf("non-host should not return the party to the lobby, got %d", guestReturn.Code)
	}

	returned := request(http.MethodPost, "/rooms/"+host.Room.ID+"/return-to-lobby", host.PlayerToken, "")
	if returned.Code != http.StatusOK {
		t.Fatalf("return to lobby: %d %s", returned.Code, returned.Body.String())
	}
	var lobby struct {
		ID            string    `json:"id"`
		Code          string    `json:"code"`
		OwnerPlayerID string    `json:"ownerPlayerId"`
		PlayerIDs     []string  `json:"playerIds"`
		Run           *game.Run `json:"run"`
	}
	if err := json.Unmarshal(returned.Body.Bytes(), &lobby); err != nil {
		t.Fatal(err)
	}
	if lobby.ID != host.Room.ID || lobby.Code != host.Room.Code || lobby.OwnerPlayerID != host.Room.OwnerPlayerID || lobby.Run != nil {
		t.Fatalf("room identity or lobby state was not preserved: %+v", lobby)
	}
	if len(lobby.PlayerIDs) != 2 || lobby.PlayerIDs[0] != host.Room.PlayerIDs[0] || lobby.PlayerIDs[1] != guest.PlayerID {
		t.Fatalf("party membership changed: got %v", lobby.PlayerIDs)
	}

	guestSnapshot := request(http.MethodGet, "/rooms/"+host.Room.ID, guest.PlayerToken, "")
	if guestSnapshot.Code != http.StatusOK {
		t.Fatalf("guest credentials should remain valid in the lobby: %d %s", guestSnapshot.Code, guestSnapshot.Body.String())
	}
	restarted := request(http.MethodPost, "/rooms/"+host.Room.ID+"/start", host.PlayerToken, "")
	if restarted.Code != http.StatusOK {
		t.Fatalf("same party should be able to start another run: %d %s", restarted.Code, restarted.Body.String())
	}
}

// entryRoom returns the first room of the expedition in a start-run response.
func entryRoom(t *testing.T, startBody []byte) *game.DungeonRoom {
	t.Helper()
	var started struct {
		Run *game.Run `json:"run"`
	}
	if err := json.Unmarshal(startBody, &started); err != nil || started.Run == nil {
		t.Fatalf("decode started run: %v %s", err, startBody)
	}
	room := started.Run.Rooms[started.Run.CurrentRoomID]
	if room == nil || room.Encounter == nil || len(room.Encounter.Enemies) == 0 || len(room.Exits) < 2 {
		t.Fatalf("an expedition should start in a fight with a choice of routes: %+v", room)
	}
	return room
}

// attackEntryEnemy is a Strike command against the first enemy of the expedition's entry room.
func attackEntryEnemy(t *testing.T, startBody []byte, round int) string {
	t.Helper()
	body, _ := json.Marshal(map[string]any{"type": "combat", "round": round, "action": "attack", "targetId": entryRoom(t, startBody).Encounter.Enemies[0].ID})
	return string(body)
}
