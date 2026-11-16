package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/game"
	"github.com/swarkentin/heart-of-the-beast/backend/internal/store"
)

func TestRunProgressionAwardsProfileAndClassMasteryOnce(t *testing.T) {
	memory := store.NewMemory()
	handler := NewHandler(memory)
	credential := "0123456789abcdef0123456789abcdef"

	profileRequest := httptest.NewRequest(http.MethodPost, "/profile", nil)
	profileRequest.Header.Set("Authorization", "Bearer "+credential)
	profileResponse := httptest.NewRecorder()
	handler.ServeHTTP(profileResponse, profileRequest)
	if profileResponse.Code != http.StatusOK {
		t.Fatalf("create profile: %d %s", profileResponse.Code, profileResponse.Body.String())
	}
	var profile store.Profile
	if err := json.Unmarshal(profileResponse.Body.Bytes(), &profile); err != nil {
		t.Fatal(err)
	}

	createRoom := httptest.NewRequest(http.MethodPost, "/rooms", nil)
	createRoom.Header.Set("X-Guest-Profile-Credential", credential)
	roomResponse := httptest.NewRecorder()
	handler.ServeHTTP(roomResponse, createRoom)
	if roomResponse.Code != http.StatusCreated {
		t.Fatalf("create room: %d %s", roomResponse.Code, roomResponse.Body.String())
	}
	var created struct {
		Room struct {
			ID            string `json:"id"`
			OwnerPlayerID string `json:"ownerPlayerId"`
		} `json:"room"`
	}
	if err := json.Unmarshal(roomResponse.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	room, err := memory.Get(t.Context(), created.Room.ID)
	if err != nil {
		t.Fatal(err)
	}
	if room.PlayerProfileIDs[created.Room.OwnerPlayerID] != profile.ID {
		t.Fatalf("room player was not linked to profile: %+v", room.PlayerProfileIDs)
	}

	now := time.Date(2026, 11, 16, 12, 0, 0, 0, time.UTC)
	room.Run = &game.Run{
		ID: "run-progression-test", Phase: game.PhaseCompleted,
		Players: map[string]*game.PlayerState{
			created.Room.OwnerPlayerID: {
				ID:         created.Room.OwnerPlayerID,
				ClassBuild: &game.ClassBuildSnapshot{ClassID: game.ClassRanger},
			},
		},
		Rooms: map[string]*game.DungeonRoom{
			"cleared": {ID: "cleared", Encounter: &game.Encounter{Status: game.EncounterCleared}},
		},
	}
	if err := memory.Save(t.Context(), room, room.Version); err != nil {
		t.Fatal(err)
	}

	progressionHandler := &Handler{rooms: memory, now: func() time.Time { return now }}
	for i := 0; i < 2; i++ {
		if err := progressionHandler.awardRunProgress(t.Context(), room); err != nil {
			t.Fatalf("award run progress attempt %d: %v", i+1, err)
		}
	}
	updated, err := memory.GetProfile(t.Context(), tokenHash(credential))
	if err != nil {
		t.Fatal(err)
	}
	if updated.AdventurerXP != 30 || updated.AdventurerLevel != 1 {
		t.Fatalf("unexpected adventurer progression: %+v", updated)
	}
	mastery := updated.ClassMastery[game.ClassRanger]
	if mastery.Experience != 30 || mastery.Level != 1 {
		t.Fatalf("unexpected ranger mastery: %+v", mastery)
	}
}

func TestFailedRunAwardsProgressForClearedEncounters(t *testing.T) {
	memory := store.NewMemory()
	credentialHash := tokenHash("abcdef0123456789abcdef0123456789")
	profile, err := memory.GetOrCreateProfile(t.Context(), "failed-run-profile", credentialHash, time.Now().UTC())
	if err != nil {
		t.Fatal(err)
	}
	room := &game.Room{
		PlayerProfileIDs: map[string]string{"player-1": profile.ID},
		Presence: map[string]game.PlayerPresence{"player-1": {}},
		Run: &game.Run{
			ID: "failed-run", Phase: game.PhaseFailed,
			Players: map[string]*game.PlayerState{"player-1": {ID: "player-1", ClassBuild: &game.ClassBuildSnapshot{ClassID: game.ClassCleric}}},
			Rooms: map[string]*game.DungeonRoom{"cleared": {ID: "cleared", Encounter: &game.Encounter{Status: game.EncounterCleared}}},
		},
	}
	handler := &Handler{rooms: memory, now: time.Now}
	if err := handler.awardRunProgress(t.Context(), room); err != nil {
		t.Fatal(err)
	}
	updated, err := memory.GetProfile(t.Context(), credentialHash)
	if err != nil {
		t.Fatal(err)
	}
	if updated.AdventurerXP != 10 || updated.ClassMastery[game.ClassCleric].Experience != 10 {
		t.Fatalf("failed run should retain progress from a cleared encounter: %+v", updated)
	}
}

func TestRunWithoutClearedEncountersDoesNotAwardProgress(t *testing.T) {
	memory := store.NewMemory()
	credentialHash := tokenHash("0123456789abcdef0123456789abcdef")
	profile, err := memory.GetOrCreateProfile(t.Context(), "empty-run-profile", credentialHash, time.Now().UTC())
	if err != nil {
		t.Fatal(err)
	}
	room := &game.Room{
		PlayerProfileIDs: map[string]string{"player-1": profile.ID},
		Run: &game.Run{
			ID: "empty-run", Phase: game.PhaseFailed,
			Players: map[string]*game.PlayerState{"player-1": {ID: "player-1"}},
			Rooms: map[string]*game.DungeonRoom{"uncleared": {ID: "uncleared", Encounter: &game.Encounter{Status: game.EncounterActive}}},
		},
	}
	handler := &Handler{rooms: memory, now: time.Now}
	if err := handler.awardRunProgress(t.Context(), room); err != nil {
		t.Fatal(err)
	}
	updated, err := memory.GetProfile(t.Context(), credentialHash)
	if err != nil {
		t.Fatal(err)
	}
	if updated.AdventurerXP != 0 || len(updated.ClassMastery) != 0 {
		t.Fatalf("run without a cleared encounter should not award progression: %+v", updated)
	}
}
