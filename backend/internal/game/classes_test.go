package game

import (
	"errors"
	"strings"
	"testing"
	"time"
)

func TestClassCatalogIsValidAndContainsNineInitialClasses(t *testing.T) {
	if err := ValidateCatalog(); err != nil {
		t.Fatalf("validate catalog: %v", err)
	}
	if got := len(ClassCatalog()); got != 9 {
		t.Fatalf("expected nine classes, got %d", got)
	}
	for _, definition := range ClassCatalog() {
		if !ClassAvailableToPlayer(definition.ID, nil) {
			t.Errorf("initial class %q should be available", definition.ID)
		}
	}
}

func TestValidateClassCatalogRejectsDuplicateIDsAndBrokenReferences(t *testing.T) {
	archetypes := ArchetypeCatalog()
	classes := ClassCatalog()
	passives := ClassPassiveCatalog()
	equipment := EquipmentCatalog()
	availability := ClassAvailabilityCatalog()

	duplicate := append([]ClassDefinition(nil), classes...)
	duplicate = append(duplicate, classes[0])
	if err := ValidateClassCatalog(archetypes, duplicate, passives, equipment, availability); err == nil {
		t.Fatal("expected duplicate class ID to fail validation")
	}

	broken := append([]ClassDefinition(nil), classes...)
	broken[0].PassiveID = "missing.passive"
	if err := ValidateClassCatalog(archetypes, broken, passives, equipment, availability); err == nil {
		t.Fatal("expected missing passive reference to fail validation")
	}

	locked := ClassAvailabilityCatalog()
	locked[0].InitiallyAvailable = false
	locked[0].UnlockPolicyID = "unlock.test"
	if err := ValidateClassCatalog(archetypes, classes, passives, equipment, locked); err != nil {
		t.Fatalf("locked class with policy should validate: %v", err)
	}
}

func TestSelectClassDerivesArchetypeAndBuildsServerOwnedStartingStats(t *testing.T) {
	now := time.Date(2026, 11, 15, 12, 0, 0, 0, time.UTC)
	room := &Room{
		PlayerIDs: []string{"player-1"},
		Presence:  map[string]PlayerPresence{"player-1": {LastSeenAt: now}},
	}
	if err := SelectClass(room, "player-1", ClassArcanist); err != nil {
		t.Fatalf("select class: %v", err)
	}
	if room.PlayerClasses["player-1"] != ClassArcanist || room.PlayerArchetypes["player-1"] != "damage" {
		t.Fatalf("class selection did not persist class and derived archetype: %+v", room)
	}
	build, err := StartingBuildForClass(room.PlayerClasses["player-1"])
	if err != nil {
		t.Fatal(err)
	}
	if build.MaxHealth != 41 || build.Stats.Focus != 4 || len(build.EquipmentIDs) != 3 {
		t.Fatalf("unexpected server starting build: %+v", build)
	}
}

func TestEveryClassReceivesFiftyPercentMoreStartingHealth(t *testing.T) {
	want := map[string]int{
		ClassBulwark: 54, ClassJuggernaut: 57, ClassSpellguard: 51,
		ClassAssassin: 42, ClassArcanist: 41, ClassRanger: 45,
		ClassCleric: 48, ClassTactician: 47, ClassBeastcaller: 45,
	}
	for _, definition := range ClassCatalog() {
		if got := definition.StartingStats.Health; got != want[definition.ID] {
			t.Errorf("%s starting health = %d, want %d", definition.ID, got, want[definition.ID])
		}
		build, err := StartingBuildForClass(definition.ID)
		if err != nil { t.Fatalf("build %s: %v", definition.ID, err) }
		if build.MaxHealth != want[definition.ID] {
			t.Errorf("%s max health = %d, want %d", definition.ID, build.MaxHealth, want[definition.ID])
		}
	}
}

func TestSelectClassRejectsUnknownLockedAndUnauthorizedSelection(t *testing.T) {
	now := time.Now().UTC()
	room := &Room{
		PlayerIDs: []string{"player-1"},
		Presence:  map[string]PlayerPresence{"player-1": {LastSeenAt: now}},
	}
	if err := SelectClass(room, "player-1", "not-a-class"); !errors.Is(err, ErrInvalidClass) {
		t.Fatalf("expected unknown class rejection, got %v", err)
	}
	if err := SelectClassWithUnlocks(room, "player-1", ClassBulwark, []string{}); err != nil {
		t.Fatalf("initial class should be selectable: %v", err)
	}

	lockedAvailability := append([]ClassAvailability(nil), classAvailabilityCatalog...)
	lockedAvailability[0] = ClassAvailability{ClassID: ClassBulwark, InitiallyAvailable: false, UnlockPolicyID: "unlock.test"}
	original := classAvailabilityCatalog
	classAvailabilityCatalog = lockedAvailability
	defer func() { classAvailabilityCatalog = original }()

	if ClassAvailableToPlayer(ClassBulwark, nil) {
		t.Fatal("expected class to be locked")
	}
	if err := SelectClassWithUnlocks(room, "player-1", ClassBulwark, nil); !errors.Is(err, ErrClassLocked) {
		t.Fatalf("expected locked class rejection, got %v", err)
	}
	if err := SelectClassWithUnlocks(room, "player-1", ClassBulwark, []string{ClassBulwark}); err != nil {
		t.Fatalf("explicit unlock should permit selection: %v", err)
	}
}

func TestStartRunSnapshotsSelectedClassBuild(t *testing.T) {
	now := time.Date(2026, 11, 15, 12, 0, 0, 0, time.UTC)
	room := &Room{
		PlayerIDs:        []string{"player-1"},
		PlayerClasses:    map[string]string{"player-1": ClassBulwark},
		PlayerArchetypes: map[string]string{"player-1": "tank"},
		Presence:         map[string]PlayerPresence{"player-1": {LastSeenAt: now}},
	}
	if err := StartRun(room, "run-1", now); err != nil {
		t.Fatalf("start run: %v", err)
	}
	player := room.Run.Players["player-1"]
	if player.ClassBuild == nil || player.ClassBuild.ClassID != ClassBulwark || player.MaxHealth != 54 || player.ClassBuild.DefinitionVersion != ClassDefinitionVersion {
		t.Fatalf("class build was not snapshotted: %+v", player)
	}
	if player.Archetype != "tank" || player.Stats.Power != 2 {
		t.Fatalf("class stats/archetype were not applied: %+v", player)
	}
}

func TestStartRunGivesEachAdventurerTheirChosenSkills(t *testing.T) {
	now := time.Date(2026, 11, 15, 12, 0, 0, 0, time.UTC)
	room := &Room{
		PlayerIDs:        []string{"player-1", "player-2"},
		PlayerClasses:    map[string]string{"player-1": ClassCleric, "player-2": ClassRanger},
		PlayerArchetypes: map[string]string{"player-1": "support", "player-2": "damage"},
		Presence:         map[string]PlayerPresence{"player-1": {LastSeenAt: now}, "player-2": {LastSeenAt: now}},
	}
	SetPlayerMastery(room, "player-1", 3)
	chosen := []string{"cleric.smite", "cleric.rejuvenate", SkillDefend}
	if err := SetPlayerLoadout(room, "player-1", chosen); err != nil {
		t.Fatalf("set loadout: %v", err)
	}
	if err := StartRun(room, "run-1", now); err != nil {
		t.Fatalf("start run: %v", err)
	}
	if got := room.Run.Players["player-1"].Skills; strings.Join(got, ",") != strings.Join(chosen, ",") {
		t.Fatalf("cleric skills = %v, want %v", got, chosen)
	}
	if got := room.Run.Players["player-2"].Skills; strings.Join(got, ",") != strings.Join(DefaultLoadout(ClassRanger, 1), ",") {
		t.Fatalf("ranger without a chosen bar should get the default one, got %v", got)
	}
}
