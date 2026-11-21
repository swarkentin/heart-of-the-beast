package httpapi

import (
	"context"
	"encoding/json"
	"errors"
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
		PlayerToken string `json:"playerToken"`
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
	// A heartbeat may be the first client request to observe the terminal room.
	// It must not return that state until the profile award has committed.
	heartbeat := httptest.NewRequest(http.MethodPost, "/rooms/"+created.Room.ID+"/heartbeat", nil)
	heartbeat.Header.Set("Authorization", "Bearer "+created.PlayerToken)
	heartbeat.SetPathValue("id", created.Room.ID)
	heartbeatResponse := httptest.NewRecorder()
	progressionHandler.updatePlayerPresence(heartbeatResponse, heartbeat, false)
	if heartbeatResponse.Code != http.StatusOK {
		t.Fatalf("terminal heartbeat: %d %s", heartbeatResponse.Code, heartbeatResponse.Body.String())
	}
	updated, err := memory.GetProfile(t.Context(), tokenHash(credential))
	if err != nil {
		t.Fatal(err)
	}
	if updated.AdventurerXP != 30 || updated.ClassMastery[game.ClassRanger].Experience != 30 {
		t.Fatalf("heartbeat returned before progression was awarded: %+v", updated)
	}
	// Repeating the award remains safe: the run/profile award key makes it idempotent.
	if err := progressionHandler.awardRunProgress(t.Context(), room); err != nil {
		t.Fatalf("repeat run progress award: %v", err)
	}
	updated, err = memory.GetProfile(t.Context(), tokenHash(credential))
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
		Presence:         map[string]game.PlayerPresence{"player-1": {}},
		Run: &game.Run{
			ID: "failed-run", Phase: game.PhaseFailed,
			Players: map[string]*game.PlayerState{"player-1": {ID: "player-1", ClassBuild: &game.ClassBuildSnapshot{ClassID: game.ClassCleric}}},
			Rooms:   map[string]*game.DungeonRoom{"cleared": {ID: "cleared", Encounter: &game.Encounter{Status: game.EncounterCleared}}},
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
			Rooms:   map[string]*game.DungeonRoom{"uncleared": {ID: "uncleared", Encounter: &game.Encounter{Status: game.EncounterActive}}},
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

// Progress is banked as the run goes, not only when it ends: a player who leaves mid-run keeps what they earned,
// and later awards add only the new experience.
func TestRunProgressIsBankedDuringTheRun(t *testing.T) {
	memory := store.NewMemory()
	credentialHash := tokenHash("fedcba9876543210fedcba9876543210")
	profile, err := memory.GetOrCreateProfile(t.Context(), "mid-run-profile", credentialHash, time.Now().UTC())
	if err != nil {
		t.Fatal(err)
	}
	cleared := func(id string) *game.DungeonRoom {
		return &game.DungeonRoom{ID: id, Encounter: &game.Encounter{Status: game.EncounterCleared}}
	}
	room := &game.Room{
		PlayerProfileIDs: map[string]string{"player-1": profile.ID},
		Presence:         map[string]game.PlayerPresence{"player-1": {}},
		Run: &game.Run{
			ID: "mid-run", Phase: game.PhaseExploring,
			Players: map[string]*game.PlayerState{"player-1": {ID: "player-1", ClassBuild: &game.ClassBuildSnapshot{ClassID: game.ClassRanger}}},
			Rooms:   map[string]*game.DungeonRoom{"a": cleared("a")},
		},
	}
	handler := &Handler{rooms: memory, now: time.Now}
	check := func(want int64, why string) {
		t.Helper()
		if err := handler.awardRunProgress(t.Context(), room); err != nil {
			t.Fatal(err)
		}
		updated, err := memory.GetProfile(t.Context(), credentialHash)
		if err != nil {
			t.Fatal(err)
		}
		if updated.AdventurerXP != want || updated.ClassMastery[game.ClassRanger].Experience != want {
			t.Fatalf("%s: want %d XP, got %+v", why, want, updated)
		}
	}
	check(game.RunXPPerEncounter, "first fight won mid-run")
	check(game.RunXPPerEncounter, "repeat award adds nothing")
	room.Run.Rooms["b"] = cleared("b")
	room.Run.FloorsCleared = 1
	check(2*game.RunXPPerEncounter+game.RunXPPerFloor, "second fight and a floor add only the increase")
	left := time.Now()
	room.Presence["player-1"] = game.PlayerPresence{LeftAt: &left}
	room.Run.Rooms["c"] = cleared("c")
	check(2*game.RunXPPerEncounter+game.RunXPPerFloor, "after leaving, banked progress stays and nothing more is added")
}

// countingAwards counts AwardRunXP calls: each is a database transaction per player in production.
type countingAwards struct {
	*store.Memory
	awards int
	fail   bool
}

func (c *countingAwards) AwardRunXP(ctx context.Context, profileID, runID, playerID, classID string, xp int64, now time.Time) (*store.Profile, error) {
	c.awards++
	if c.fail {
		return nil, errors.New("database unavailable")
	}
	return c.Memory.AwardRunXP(ctx, profileID, runID, playerID, classID, xp, now)
}

// Snapshot polls pass through awardRunProgress many times a second in a party. Once a run's XP is banked, polls
// that earned nothing new must not touch the profile store again; new XP and a failed award still go through.
func TestRunProgressSkipsAwardsWhenNothingNewWasEarned(t *testing.T) {
	memory := &countingAwards{Memory: store.NewMemory()}
	credentialHash := tokenHash("00112233445566778899aabbccddeeff")
	profile, err := memory.GetOrCreateProfile(t.Context(), "poll-profile", credentialHash, time.Now().UTC())
	if err != nil {
		t.Fatal(err)
	}
	room := &game.Room{
		PlayerProfileIDs: map[string]string{"player-1": profile.ID},
		Presence:         map[string]game.PlayerPresence{"player-1": {}},
		Run: &game.Run{
			ID: "poll-run", Phase: game.PhaseExploring,
			Players: map[string]*game.PlayerState{"player-1": {ID: "player-1"}},
			Rooms:   map[string]*game.DungeonRoom{"a": {ID: "a", Encounter: &game.Encounter{Status: game.EncounterCleared}}},
		},
	}
	handler := &Handler{rooms: memory, now: time.Now}
	award := func() {
		t.Helper()
		if err := handler.awardRunProgress(t.Context(), room); err != nil {
			t.Fatal(err)
		}
	}
	for range 5 {
		award()
	}
	if memory.awards != 1 {
		t.Fatalf("five polls with the same XP should bank once, banked %d times", memory.awards)
	}
	room.Run.Rooms["b"] = &game.DungeonRoom{ID: "b", Encounter: &game.Encounter{Status: game.EncounterCleared}}
	memory.fail = true
	if err := handler.awardRunProgress(t.Context(), room); err == nil {
		t.Fatal("a failed award should be reported")
	}
	memory.fail = false
	award()
	award()
	if memory.awards != 3 {
		t.Fatalf("new XP should bank once after the failed attempt is retried, banked %d times in all", memory.awards)
	}
	updated, err := memory.GetProfile(t.Context(), credentialHash)
	if err != nil {
		t.Fatal(err)
	}
	if updated.AdventurerXP != 2*game.RunXPPerEncounter {
		t.Fatalf("want %d XP banked, got %d", 2*game.RunXPPerEncounter, updated.AdventurerXP)
	}
}
