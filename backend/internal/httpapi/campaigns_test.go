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

type campaignRoom struct {
	Room struct {
		ID            string `json:"id"`
		OwnerPlayerID string `json:"ownerPlayerId"`
		Run           *struct {
			CampaignID string `json:"campaignId"`
			ThemeID    string `json:"themeId"`
		} `json:"run"`
	} `json:"room"`
	PlayerToken string `json:"playerToken"`
}

// newLeaderRoom creates a profile and a room hosted by it.
func newLeaderRoom(t *testing.T, handler http.Handler, credential string) campaignRoom {
	t.Helper()
	profile := httptest.NewRequest(http.MethodPost, "/profile", nil)
	profile.Header.Set("Authorization", "Bearer "+credential)
	handler.ServeHTTP(httptest.NewRecorder(), profile)
	create := httptest.NewRequest(http.MethodPost, "/rooms", nil)
	create.Header.Set("X-Guest-Profile-Credential", credential)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, create)
	var created campaignRoom
	if err := json.Unmarshal(response.Body.Bytes(), &created); err != nil || response.Code != http.StatusCreated {
		t.Fatalf("create room: %d %s", response.Code, response.Body.String())
	}
	return created
}

func startCampaign(handler http.Handler, room campaignRoom, campaignID string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(http.MethodPost, "/rooms/"+room.Room.ID+"/start", bytes.NewBufferString(`{"campaignId":"`+campaignID+`"}`))
	request.Header.Set("Authorization", "Bearer "+room.PlayerToken)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	return response
}

func TestCampaignCatalogIsPublic(t *testing.T) {
	response := httptest.NewRecorder()
	NewHandler(store.NewMemory()).ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/campaigns", nil))
	var body struct {
		Campaigns []game.CampaignDefinition `json:"campaigns"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil || response.Code != http.StatusOK {
		t.Fatalf("campaigns: %d %s", response.Code, response.Body.String())
	}
	if len(body.Campaigns) != len(game.Campaigns()) || len(body.Campaigns[0].Prologue) == 0 {
		t.Fatalf("catalog is missing campaigns or their story: %+v", body.Campaigns)
	}
}

func TestLeaderMustHaveUnlockedTheCampaign(t *testing.T) {
	memory := store.NewMemory()
	handler := NewHandler(memory)
	campaigns := game.Campaigns()
	room := newLeaderRoom(t, handler, "0123456789abcdef0123456789abcdef")
	if response := startCampaign(handler, room, campaigns[1].ID); response.Code != http.StatusForbidden {
		t.Fatalf("locked campaign: %d %s", response.Code, response.Body.String())
	}
	if response := startCampaign(handler, room, "no-such-campaign"); response.Code != http.StatusBadRequest {
		t.Fatalf("unknown campaign: %d %s", response.Code, response.Body.String())
	}
	response := startCampaign(handler, room, campaigns[0].ID)
	var started campaignRoom
	_ = json.Unmarshal(response.Body.Bytes(), &started.Room)
	if response.Code != http.StatusOK || started.Room.Run == nil || started.Room.Run.CampaignID != campaigns[0].ID || started.Room.Run.ThemeID != campaigns[0].Themes[0] {
		t.Fatalf("first campaign: %d %s", response.Code, response.Body.String())
	}

	// Winning the first campaign unlocks the second for this leader.
	stored, err := memory.Get(t.Context(), room.Room.ID)
	if err != nil {
		t.Fatal(err)
	}
	if err := memory.RecordCampaignCompletion(t.Context(), stored.PlayerProfileIDs[stored.OwnerPlayerID], campaigns[0].ID, "won-run", time.Now()); err != nil {
		t.Fatal(err)
	}
	second := newLeaderRoom(t, handler, "0123456789abcdef0123456789abcdef")
	if response := startCampaign(handler, second, campaigns[1].ID); response.Code != http.StatusOK {
		t.Fatalf("unlocked second campaign: %d %s", response.Code, response.Body.String())
	}
}

func TestWonCampaignAwardsEveryRemainingAdventurerOnce(t *testing.T) {
	memory := store.NewMemory()
	credential := "fedcba9876543210fedcba9876543210"
	room := newLeaderRoom(t, NewHandler(memory), credential)
	stored, err := memory.Get(t.Context(), room.Room.ID)
	if err != nil {
		t.Fatal(err)
	}
	campaign := game.Campaigns()[0]
	stored.Run = &game.Run{ID: "won-campaign", CampaignID: campaign.ID, CampaignWon: true, Phase: game.PhaseCompleted,
		Players: map[string]*game.PlayerState{}, Rooms: map[string]*game.DungeonRoom{}}
	handler := &Handler{rooms: memory, now: time.Now}
	for i := 0; i < 3; i++ {
		if err := handler.awardRunProgress(t.Context(), stored); err != nil {
			t.Fatal(err)
		}
		handler.campaignsBanked = bankedCampaigns{} // as if every request reached a fresh process
	}
	profile, err := memory.GetProfile(t.Context(), tokenHash(credential))
	if err != nil {
		t.Fatal(err)
	}
	if record := profile.Campaigns[campaign.ID]; record.Completions != 1 {
		t.Fatalf("trophy was credited %d times, want once", record.Completions)
	}
	if !game.CampaignUnlocked(game.Campaigns()[1].ID, profile.CampaignCompleted) {
		t.Fatal("the trophy did not unlock the next campaign")
	}
}
