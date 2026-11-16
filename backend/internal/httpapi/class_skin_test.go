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

// The server, not the client, decides which armour tiers and dyes a player has
// earned: it reads class mastery from the profile that joined the room.
func TestClassSkinChoiceIsValidatedAgainstProfileMastery(t *testing.T) {
	memory := store.NewMemory()
	handler := NewHandler(memory)
	credential := "fedcba9876543210fedcba9876543210"

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
	// 650 ranger XP is mastery 7: armour up to tier 4 and the ember and frost dyes.
	if _, err := memory.AwardRunXP(t.Context(), room.PlayerProfileIDs[session.Room.OwnerPlayerID], "earlier-run", session.Room.OwnerPlayerID, game.ClassRanger, 650, time.Now().UTC()); err != nil {
		t.Fatal(err)
	}

	choose := func(body string, withProfile bool) (*httptest.ResponseRecorder, map[string]game.PlayerSkin) {
		request := httptest.NewRequest(http.MethodPost, "/rooms/"+session.Room.ID+"/class", strings.NewReader(body))
		request.Header.Set("Authorization", "Bearer "+session.PlayerToken)
		if withProfile {
			request.Header.Set("X-Guest-Profile-Credential", credential)
		}
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		var payload struct {
			PlayerSkins map[string]game.PlayerSkin `json:"playerSkins"`
		}
		_ = json.Unmarshal(response.Body.Bytes(), &payload)
		return response, payload.PlayerSkins
	}

	response, skins := choose(`{"classId":"ranger"}`, true)
	if response.Code != http.StatusOK || skins[session.Room.OwnerPlayerID] != (game.PlayerSkin{Tier: 4, Variant: "heraldic"}) {
		t.Fatalf("an unspecified look should wear the best unlocked armour: %d %+v", response.Code, skins)
	}
	if response, skins = choose(`{"classId":"ranger","tier":2,"variant":"frost"}`, true); response.Code != http.StatusOK || skins[session.Room.OwnerPlayerID] != (game.PlayerSkin{Tier: 2, Variant: "frost"}) {
		t.Fatalf("an earned lower tier and dye should be wearable: %d %+v", response.Code, skins)
	}
	for _, locked := range []string{`{"classId":"ranger","tier":5}`, `{"classId":"ranger","tier":1,"variant":"dusk"}`, `{"classId":"cleric","tier":2}`} {
		if response, _ = choose(locked, true); response.Code != http.StatusConflict {
			t.Fatalf("%s should be locked: %d %s", locked, response.Code, response.Body.String())
		}
	}
	if response, _ = choose(`{"classId":"ranger","tier":3}`, false); response.Code != http.StatusConflict {
		t.Fatalf("without the profile credential only the starting look is available: %d", response.Code)
	}
	if response, skins = choose(`{"classId":"ranger"}`, false); response.Code != http.StatusOK || skins[session.Room.OwnerPlayerID] != game.DefaultPlayerSkin() {
		t.Fatalf("without a profile the class still works in its starting look: %d %+v", response.Code, skins)
	}
}
