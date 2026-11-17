package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/game"
	"github.com/swarkentin/heart-of-the-beast/backend/internal/store"
)

// Skills unlock with class mastery, and the server reads mastery from the profile that joined the room: a
// client cannot put a skill it has not earned on its bar.
func TestSkillLoadoutIsValidatedAgainstProfileMastery(t *testing.T) {
	memory := store.NewMemory()
	handler := NewHandler(memory)
	credential := "0123456789abcdef0123456789abcdef"

	createRoom := httptest.NewRequest(http.MethodPost, "/rooms", nil)
	createRoom.Header.Set("X-Guest-Profile-Credential", credential)
	created := httptest.NewRecorder()
	handler.ServeHTTP(created, createRoom)
	if created.Code != http.StatusCreated {
		t.Fatalf("create room: %d %s", created.Code, created.Body.String())
	}
	var session struct {
		Room        struct{ ID, OwnerPlayerID string } `json:"room"`
		PlayerToken string                             `json:"playerToken"`
	}
	if err := json.Unmarshal(created.Body.Bytes(), &session); err != nil {
		t.Fatal(err)
	}
	room, err := memory.Get(t.Context(), session.Room.ID)
	if err != nil {
		t.Fatal(err)
	}
	// 250 cleric XP is mastery 3: Prayer of Mending (2) and Rejuvenate (3) are earned, Holy Fire (5) is not.
	if _, err := memory.AwardRunXP(t.Context(), room.PlayerProfileIDs[session.Room.OwnerPlayerID], "earlier-run", session.Room.OwnerPlayerID, game.ClassCleric, 250, time.Now().UTC()); err != nil {
		t.Fatal(err)
	}
	post := func(path, body string, withProfile bool) *httptest.ResponseRecorder {
		request := httptest.NewRequest(http.MethodPost, "/rooms/"+session.Room.ID+path, strings.NewReader(body))
		request.Header.Set("Authorization", "Bearer "+session.PlayerToken)
		if withProfile {
			request.Header.Set("X-Guest-Profile-Credential", credential)
		}
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		return response
	}
	loadouts := func(response *httptest.ResponseRecorder) map[string][]string {
		var payload struct {
			PlayerLoadouts map[string][]string `json:"playerLoadouts"`
		}
		_ = json.Unmarshal(response.Body.Bytes(), &payload)
		return payload.PlayerLoadouts
	}

	if response := post("/loadout", `{"skillIds":["cleric.smite"]}`, true); response.Code != http.StatusConflict {
		t.Fatalf("a loadout needs a class first: %d", response.Code)
	}
	// A remembered bar sent with the class is used when every skill in it is earned.
	response := post("/class", `{"classId":"cleric","skillIds":["cleric.smite","cleric.rejuvenate","skill.defend"]}`, true)
	if response.Code != http.StatusOK || strings.Join(loadouts(response)[session.Room.OwnerPlayerID], ",") != "cleric.smite,cleric.rejuvenate,skill.defend" {
		t.Fatalf("class with remembered bar: %d %s", response.Code, response.Body.String())
	}
	if response := post("/loadout", `{"skillIds":["cleric.smite","cleric.holy-fire"]}`, true); response.Code != http.StatusConflict {
		t.Fatalf("Holy Fire is locked at mastery 3: %d %s", response.Code, response.Body.String())
	}
	response = post("/loadout", `{"skillIds":["cleric.smite","cleric.prayer-of-mending"]}`, true)
	if response.Code != http.StatusOK || len(loadouts(response)[session.Room.OwnerPlayerID]) != 2 {
		t.Fatalf("an earned bar should save: %d %s", response.Code, response.Body.String())
	}
	// Without the profile, the server only trusts mastery 1, and the stored bar it no longer allows is dropped.
	response = post("/class", `{"classId":"cleric"}`, false)
	if response.Code != http.StatusOK || loadouts(response)[session.Room.OwnerPlayerID] != nil {
		t.Fatalf("without a profile the mastery-2 bar should be dropped: %d %s", response.Code, response.Body.String())
	}
}
