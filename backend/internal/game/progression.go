package game

import "errors"

var (
	ErrInvalidArchetype = errors.New("unknown archetype")
	ErrArchetypeLocked  = errors.New("archetype can only be changed before the run starts")
)

const (
	DefaultArchetype = "damage"

	EncounterExperienceReward = 18
	BossExperienceReward      = 30
)

type ArchetypeDefinition struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

type PlayerStats struct {
	Power   int `json:"power"`
	Focus   int `json:"focus"`
	Agility int `json:"agility"`
}

var archetypeCatalog = []ArchetypeDefinition{
	{ID: "support", Name: "Support", Description: "Control enemy plans, create openings, and help the whole party."},
	{ID: "damage", Name: "Damage", Description: "Exploit openings and specialize in taking dangerous enemies down quickly."},
	{ID: "tank", Name: "Tank", Description: "Absorb pressure, hold enemy attention, and protect the party."},
}

func ArchetypeCatalog() []ArchetypeDefinition {
	return append([]ArchetypeDefinition(nil), archetypeCatalog...)
}

func SelectArchetype(room *Room, playerID, archetypeID string) error {
	if room.Run != nil {
		return ErrArchetypeLocked
	}
	if !contains(room.PlayerIDs, playerID) || room.Presence[playerID].LeftAt != nil {
		return ErrNotPlayer
	}
	if !isArchetype(archetypeID) {
		return ErrInvalidArchetype
	}
	if room.PlayerArchetypes == nil {
		room.PlayerArchetypes = make(map[string]string)
	}
	room.PlayerArchetypes[playerID] = archetypeID
	if room.PlayerClasses != nil {
		delete(room.PlayerClasses, playerID)
	}
	if room.PlayerSkins != nil {
		delete(room.PlayerSkins, playerID)
	}
	if room.PlayerLoadouts != nil {
		delete(room.PlayerLoadouts, playerID)
	}
	return nil
}

func newPlayerState(id, archetype string) *PlayerState {
	if !isArchetype(archetype) {
		archetype = DefaultArchetype
	}
	return &PlayerState{
		ID: id, Health: 30, MaxHealth: 30, Archetype: archetype,
		Level: 1, Skills: []string{SkillStrike, SkillDefend},
	}
}

// experienceForNextLevel returns the cumulative XP threshold for the next level.
// The original 1–5 curve is preserved; later levels grow by 20% per level so
// players can keep progressing in long, multi-dungeon expeditions without
// making each additional level trivially cheap.
func experienceForNextLevel(level int) int {
	switch level {
	case 1:
		return 60
	case 2:
		return 150
	case 3:
		return 275
	case 4:
		return 425
	}
	if level < 1 {
		return 0
	}

	threshold, step := 425, 150
	for current := 5; current <= level; current++ {
		step = (step*6 + 4) / 5 // ceil(step * 1.2)
		threshold += step
	}
	return threshold
}

func grantEncounterExperience(room *Room, round int) {
	rewardID := "encounter.regular_xp"
	if isBossRoom(room.Run.Rooms[room.Run.CurrentRoomID]) {
		rewardID = "encounter.boss_xp"
	}
	definition, ok := defaultRunRewardCatalog.Reward(rewardID)
	if !ok {
		return
	}
	applyRunReward(room, definition, round, "")
}

func grantExperience(player *PlayerState, room *Room, playerID string, round, amount int) {
	if room == nil || room.Run == nil || room.Run.Cheated {
		return
	}
	transition := resolveExperienceGain(*player, amount)
	player.Experience = transition.Experience
	player.Level = transition.Level
	player.MaxHealth = transition.MaxHealth
	player.StrikeDamage = transition.StrikeDamage
	player.GuardReduction = transition.GuardReduction
	player.Stats = transition.Stats

	addCombatEvent(room.Run, round, "experience", adventurerLabel(room, playerID)+" earns "+itoa(amount)+" XP.")
	for _, level := range transition.LevelUps {
		message := adventurerLabel(room, playerID) + " reaches level " + itoa(level) + " and grows stronger!"
		// Every third level from level 6 onward is a small supply milestone.
		// Respect the normal carried-herb cap; a level-up never overfills inventory.
		if level >= 6 && level%3 == 0 {
			if player.Consumables == nil {
				player.Consumables = make(map[string]int)
			}
			if player.Consumables[ConsumableHealingHerb] < MaxHealingHerbs {
				player.Consumables[ConsumableHealingHerb]++
				message += " They also find a Healing Herb!"
			}
		}
		addCombatEvent(room.Run, round, "level_up", message)
	}
}

func isArchetype(id string) bool {
	for _, archetype := range archetypeCatalog {
		if archetype.ID == id {
			return true
		}
	}
	return false
}

func contains(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}
