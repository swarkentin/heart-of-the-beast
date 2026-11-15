package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/game"
	"github.com/swarkentin/heart-of-the-beast/backend/internal/store"
)

func TestNavigationVoteDeadlineAdvancesThroughSnapshotPolling(t *testing.T) {
	now := time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC)
	handler := NewHandlerWithClock(store.NewMemory(), func() time.Time { return now })

	create := httptest.NewRecorder()
	handler.ServeHTTP(create, httptest.NewRequest(http.MethodPost, "/rooms", nil))
	if create.Code != http.StatusCreated {
		t.Fatalf("create room: %d %s", create.Code, create.Body.String())
	}
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

	joinBody, _ := json.Marshal(map[string]string{"code": host.Room.Code})
	join := httptest.NewRecorder()
	handler.ServeHTTP(join, httptest.NewRequest(http.MethodPost, "/rooms/join", bytes.NewReader(joinBody)))
	if join.Code != http.StatusCreated {
		t.Fatalf("join room: %d %s", join.Code, join.Body.String())
	}
	var guest struct {
		PlayerToken string `json:"playerToken"`
	}
	if err := json.Unmarshal(join.Body.Bytes(), &guest); err != nil {
		t.Fatal(err)
	}

	request := func(method, path, token, body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, bytes.NewBufferString(body))
		req.Header.Set("Authorization", "Bearer "+token)
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, req)
		return response
	}

	started := request(http.MethodPost, "/rooms/"+host.Room.ID+"/start", host.PlayerToken, "")
	if started.Code != http.StatusOK {
		t.Fatalf("start run: %d %s", started.Code, started.Body.String())
	}
	for _, player := range []struct {
		token string
	}{{host.PlayerToken}, {guest.PlayerToken}} {
		response := request(http.MethodPost, "/rooms/"+host.Room.ID+"/commands", player.token, `{"type":"combat","round":1,"action":"attack","targetId":"sentinel"}`)
		if response.Code != http.StatusOK {
			t.Fatalf("combat action: %d %s", response.Code, response.Body.String())
		}
	}
	voted := request(http.MethodPost, "/rooms/"+host.Room.ID+"/commands", host.PlayerToken, `{"type":"choose_exit","exitId":"north"}`)
	if voted.Code != http.StatusOK {
		t.Fatalf("submit path vote: %d %s", voted.Code, voted.Body.String())
	}

	now = now.Add(game.NavigationVoteWindow)
	snapshot := request(http.MethodGet, "/rooms/"+host.Room.ID, host.PlayerToken, "")
	if snapshot.Code != http.StatusOK {
		t.Fatalf("poll room after vote deadline: %d %s", snapshot.Code, snapshot.Body.String())
	}
	var result struct {
		Run struct {
			Phase          game.RunPhase `json:"phase"`
			CurrentRoomID  string        `json:"currentRoomId"`
			NavigationVote *game.NavigationVote `json:"navigationVote"`
		} `json:"run"`
	}
	if err := json.Unmarshal(snapshot.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if result.Run.Phase != game.PhaseCombat || result.Run.CurrentRoomID != "reliquary" || result.Run.NavigationVote != nil {
		t.Fatalf("deadline should resolve the submitted vote and transition rooms: %+v", result.Run)
	}
}
