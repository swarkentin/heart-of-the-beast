package httpapi

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/store"
)

type watchRoom struct {
	handler        http.Handler
	memory         *store.Memory
	id             string
	playerToken    string
	spectatorToken string
}

func newWatchRoom(t *testing.T, startRun bool) watchRoom {
	t.Helper()
	memory := store.NewMemory()
	handler := NewHandler(memory)
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
	room := watchRoom{handler: handler, memory: memory, id: created.Room.ID, playerToken: created.PlayerToken, spectatorToken: created.SpectatorToken}
	if startRun {
		start := httptest.NewRequest(http.MethodPost, "/rooms/"+room.id+"/start", nil)
		start.Header.Set("Authorization", "Bearer "+room.playerToken)
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, start)
		if response.Code != http.StatusOK {
			t.Fatalf("start run: %d %s", response.Code, response.Body.String())
		}
	}
	return room
}

type watchedSnapshot struct {
	Version int64 `json:"version"`
	Run     *struct {
		CombatRound *struct {
			Number int `json:"number"`
		} `json:"combatRound"`
	} `json:"run"`
}

// read GETs the snapshot, waiting for a version past `after` when after >= 0.
func (room watchRoom) read(t *testing.T, path, token string, after int64) (watchedSnapshot, int, time.Duration) {
	t.Helper()
	if after >= 0 {
		path += fmt.Sprintf("?after=%d", after)
	}
	request := httptest.NewRequest(http.MethodGet, path, nil)
	request.Header.Set("Authorization", "Bearer "+token)
	response := httptest.NewRecorder()
	began := time.Now()
	room.handler.ServeHTTP(response, request)
	var snapshot watchedSnapshot
	_ = json.Unmarshal(response.Body.Bytes(), &snapshot)
	return snapshot, response.Code, time.Since(began)
}

func setWaitLimit(t *testing.T, limit time.Duration) {
	t.Helper()
	previous := maxRoomWait
	maxRoomWait = limit
	t.Cleanup(func() { maxRoomWait = previous })
}

func TestRoomReadWithoutAfterReturnsAtOnce(t *testing.T) {
	setWaitLimit(t, 5*time.Second)
	room := newWatchRoom(t, false)
	_, code, took := room.read(t, "/rooms/"+room.id, room.playerToken, -1)
	if code != http.StatusOK || took > time.Second {
		t.Fatalf("plain read: %d after %v", code, took)
	}
}

func TestRoomReadBehindTheCurrentVersionReturnsAtOnce(t *testing.T) {
	setWaitLimit(t, 5*time.Second)
	room := newWatchRoom(t, true)
	snapshot, code, took := room.read(t, "/rooms/"+room.id, room.playerToken, 0)
	if code != http.StatusOK || snapshot.Version == 0 || took > time.Second {
		t.Fatalf("a client behind the room should get it at once: %d v%d after %v", code, snapshot.Version, took)
	}
}

func TestRoomReadWaitsUntilTheLimitWhenNothingChanges(t *testing.T) {
	setWaitLimit(t, 150*time.Millisecond)
	room := newWatchRoom(t, false)
	current, _, _ := room.read(t, "/rooms/"+room.id, room.playerToken, -1)
	snapshot, code, took := room.read(t, "/rooms/"+room.id, room.playerToken, current.Version)
	if code != http.StatusOK || snapshot.Version != current.Version {
		t.Fatalf("unchanged room: %d v%d, want v%d", code, snapshot.Version, current.Version)
	}
	if took < 150*time.Millisecond || took > 2*time.Second {
		t.Fatalf("an unchanged room should answer at the wait limit, answered after %v", took)
	}
}

// The point of waiting: a party member's action reaches every other waiting reader, player or spectator, as
// soon as it is saved, not on their next poll.
func TestWaitingReadersWakeAsSoonAsTheRoomIsSaved(t *testing.T) {
	setWaitLimit(t, 5*time.Second)
	room := newWatchRoom(t, true)
	current, _, _ := room.read(t, "/rooms/"+room.id, room.playerToken, -1)
	type result struct {
		snapshot watchedSnapshot
		code     int
		took     time.Duration
	}
	player, spectator := make(chan result, 1), make(chan result, 1)
	go func() {
		s, c, d := room.read(t, "/rooms/"+room.id, room.playerToken, current.Version)
		player <- result{s, c, d}
	}()
	go func() {
		s, c, d := room.read(t, "/spectate/"+room.id, room.spectatorToken, current.Version)
		spectator <- result{s, c, d}
	}()
	time.Sleep(100 * time.Millisecond)

	body := fmt.Sprintf(`{"type":"combat","round":%d,"action":"defend"}`, current.Run.CombatRound.Number)
	command := httptest.NewRequest(http.MethodPost, "/rooms/"+room.id+"/commands", bytes.NewBufferString(body))
	command.Header.Set("Authorization", "Bearer "+room.playerToken)
	response := httptest.NewRecorder()
	room.handler.ServeHTTP(response, command)
	if response.Code != http.StatusOK {
		t.Fatalf("command: %d %s", response.Code, response.Body.String())
	}
	for name, ch := range map[string]chan result{"player": player, "spectator": spectator} {
		select {
		case got := <-ch:
			if got.code != http.StatusOK || got.snapshot.Version <= current.Version {
				t.Fatalf("%s woke with %d v%d, want a version past v%d", name, got.code, got.snapshot.Version, current.Version)
			}
			if got.took > 2*time.Second {
				t.Fatalf("%s waited %v for a change saved after 100ms", name, got.took)
			}
		case <-time.After(3 * time.Second):
			t.Fatalf("%s was not woken by the save", name)
		}
	}
}

// A round that runs out of time resolves on the server; a waiting reader is woken at its deadline with the
// result, without anyone having to send a request then.
func TestWaitingReadersWakeAtTheRoundDeadline(t *testing.T) {
	setWaitLimit(t, 5*time.Second)
	room := newWatchRoom(t, true)
	stored, err := room.memory.Get(t.Context(), room.id)
	if err != nil {
		t.Fatal(err)
	}
	stored.Run.CombatRound.Deadline = time.Now().UTC().Add(200 * time.Millisecond)
	if err := room.memory.Save(t.Context(), stored, stored.Version); err != nil {
		t.Fatal(err)
	}
	snapshot, code, took := room.read(t, "/rooms/"+room.id, room.playerToken, stored.Version)
	if code != http.StatusOK || snapshot.Version <= stored.Version {
		t.Fatalf("deadline wake: %d v%d, want past v%d", code, snapshot.Version, stored.Version)
	}
	if took < 150*time.Millisecond || took > 2*time.Second {
		t.Fatalf("the read should end at the 200ms round deadline, ended after %v", took)
	}
	if snapshot.Run == nil || snapshot.Run.CombatRound == nil || snapshot.Run.CombatRound.Number < 2 {
		t.Fatalf("the timed-out round should have resolved into the next one: %+v", snapshot.Run)
	}
}

func TestWaitingReadRejectsAnInvalidToken(t *testing.T) {
	setWaitLimit(t, 5*time.Second)
	room := newWatchRoom(t, true)
	if _, code, _ := room.read(t, "/rooms/"+room.id, "not-a-player-token", 1); code != http.StatusUnauthorized {
		t.Fatalf("want 401 for a bad player token, got %d", code)
	}
	if _, code, _ := room.read(t, "/spectate/"+room.id, "not-a-spectator-token", 1); code != http.StatusUnauthorized {
		t.Fatalf("want 401 for a bad spectator token, got %d", code)
	}
}
