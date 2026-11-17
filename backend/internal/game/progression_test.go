package game

import (
	"errors"
	"testing"
	"time"
)

func progressionRoom() *Room {
	now := time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC)
	return &Room{
		ID: "room", PlayerIDs: []string{"player-1"},
		Presence: map[string]PlayerPresence{"player-1": {LastSeenAt: now}},
	}
}

func TestEncounterExperienceLevelsAndImprovesStats(t *testing.T) {
	room := progressionRoom()
	player := newPlayerState("player-1", "tank")
	room.Run = &Run{CurrentRoomID: "entry", Players: map[string]*PlayerState{"player-1": player}}

	for i := 0; i < 3; i++ {
		grantEncounterExperience(room, i+1)
	}
	if player.Experience != 3*EncounterExperienceReward || player.Level != 1 {
		t.Fatalf("early encounters should not immediately level a new character: %+v", player)
	}
	grantEncounterExperience(room, 4)
	if player.Experience != 4*EncounterExperienceReward || player.Level != 2 {
		t.Fatalf("four regular encounters should earn the first level: %+v", player)
	}
	if player.MaxHealth != 34 || player.Health != 30 || player.Stats.Power != 1 {
		t.Fatalf("level 2 stat growth is wrong: %+v", player)
	}

	for i := 0; i < 5; i++ {
		grantEncounterExperience(room, i+5)
	}
	if player.Experience != 9*EncounterExperienceReward || player.Level != 3 {
		t.Fatalf("the next level should require a sustained run of encounters: %+v", player)
	}
	if player.Stats.Focus != 2 {
		t.Fatalf("level 3 should increase focus by 2, got %+v", player.Stats)
	}
}

func TestBossEncounterGrantsMoreExperienceThanRegularEncounter(t *testing.T) {
	room := progressionRoom()
	player := newPlayerState("player-1", "tank")
	room.Run = &Run{
		CurrentRoomID: "boss",
		Rooms:         map[string]*DungeonRoom{"boss": {ID: "boss", RoomType: "boss"}},
		Players:       map[string]*PlayerState{"player-1": player},
	}

	grantEncounterExperience(room, 1)
	if player.Experience != BossExperienceReward || player.Experience <= EncounterExperienceReward {
		t.Fatalf("boss should grant a larger but bounded XP reward: %+v", player)
	}
	if player.Level != 1 {
		t.Fatalf("a single boss reward should not immediately level a new character: %+v", player)
	}
}

func TestEncounterExperienceIncludesDownedPlayersButDoesNotReviveThem(t *testing.T) {
	room := progressionRoom()
	player := newPlayerState("player-1", "tank")
	player.Health = 0
	room.Run = &Run{CurrentRoomID: "entry", Players: map[string]*PlayerState{"player-1": player}}

	grantEncounterExperience(room, 1)
	if player.Experience != EncounterExperienceReward || player.Level != 1 {
		t.Fatalf("participating downed player should receive encounter XP: %+v", player)
	}
	if player.Health != 0 || player.MaxHealth != 30 {
		t.Fatalf("level-up must not revive a downed player: %+v", player)
	}
}

func TestSelectArchetypeOnlyBeforeRun(t *testing.T) {
	room := progressionRoom()
	if err := SelectArchetype(room, "player-1", "support"); err != nil {
		t.Fatalf("select archetype: %v", err)
	}
	if room.PlayerArchetypes["player-1"] != "support" {
		t.Fatalf("archetype was not saved: %#v", room.PlayerArchetypes)
	}
	if err := SelectArchetype(room, "player-1", "unknown"); !errors.Is(err, ErrInvalidArchetype) {
		t.Fatalf("expected invalid archetype, got %v", err)
	}
	room.Run = &Run{}
	if err := SelectArchetype(room, "player-1", "damage"); !errors.Is(err, ErrArchetypeLocked) {
		t.Fatalf("expected locked archetype, got %v", err)
	}
}
