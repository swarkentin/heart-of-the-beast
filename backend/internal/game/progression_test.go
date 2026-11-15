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
	if player.Experience != 3*EncounterExperienceReward || player.Level != 1 || player.TalentPoints != 0 {
		t.Fatalf("early encounters should not immediately level a new character: %+v", player)
	}
	grantEncounterExperience(room, 4)
	if player.Experience != 4*EncounterExperienceReward || player.Level != 2 || player.TalentPoints != 1 {
		t.Fatalf("four regular encounters should earn the first level: %+v", player)
	}
	if player.MaxHealth != 34 || player.Health != 30 || player.Stats.Power != 1 {
		t.Fatalf("level 2 stat growth is wrong: %+v", player)
	}

	for i := 0; i < 5; i++ {
		grantEncounterExperience(room, i+5)
	}
	if player.Experience != 9*EncounterExperienceReward || player.Level != 3 || player.TalentPoints != 2 {
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

func TestChooseTalentChecksArchetypeLevelAndPrerequisite(t *testing.T) {
	room := progressionRoom()
	player := newPlayerState("player-1", "tank")
	player.Level = 2
	player.TalentPoints = 1
	player.Health = 20
	room.Run = &Run{Phase: PhaseExploring, Players: map[string]*PlayerState{"player-1": player}}

	if err := ChooseTalent(room, "player-1", "damage-heavy-hands"); !errors.Is(err, ErrInvalidTalent) {
		t.Fatalf("expected archetype mismatch, got %v", err)
	}
	if err := ChooseTalent(room, "player-1", "tank-thorns"); !errors.Is(err, ErrTalentLocked) {
		t.Fatalf("expected tier/prerequisite lock, got %v", err)
	}
	if err := ChooseTalent(room, "player-1", "tank-bulwark"); err != nil {
		t.Fatalf("choose Bulwark: %v", err)
	}
	if player.MaxHealth != 36 || player.Health != 20 || player.TalentPoints != 0 {
		t.Fatalf("Bulwark did not apply its health bonus: %+v", player)
	}
	if err := ChooseTalent(room, "player-1", "tank-bulwark"); !errors.Is(err, ErrNoTalentPoints) {
		t.Fatalf("expected no points after spending, got %v", err)
	}

	player.Level = 3
	player.TalentPoints = 1
	if err := ChooseTalent(room, "player-1", "tank-thorns"); err != nil {
		t.Fatalf("choose Thorns after Bulwark: %v", err)
	}
	if bonusesFor(player).ReflectDamage != 2 {
		t.Fatalf("Thorns effect missing: %+v", bonusesFor(player))
	}
}

func TestSupportTalentsBenefitTheWholeLivingParty(t *testing.T) {
	room := progressionRoom()
	support := newPlayerState("player-1", "support")
	ally := newPlayerState("player-2", "damage")
	ally.Health = 20
	room.PlayerIDs = append(room.PlayerIDs, "player-2")
	room.Presence["player-2"] = PlayerPresence{LastSeenAt: time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC)}
	support.Talents = []string{"support-protective-ward", "support-rallying-cry"}
	room.Run = &Run{Players: map[string]*PlayerState{"player-1": support, "player-2": ally}}

	bonuses := partyBonusesFor(room)
	if bonuses.PartyGuardReduction != 2 || bonuses.PartyEncounterHeal != 2 {
		t.Fatalf("support party auras missing: %+v", bonuses)
	}
	support.Health = 0
	bonuses = partyBonusesFor(room)
	if bonuses.PartyGuardReduction != 0 || bonuses.PartyEncounterHeal != 0 {
		t.Fatalf("downed support should not maintain party auras: %+v", bonuses)
	}
}
