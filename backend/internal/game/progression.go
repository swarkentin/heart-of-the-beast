package game

import "errors"

var (
	ErrInvalidArchetype = errors.New("unknown archetype")
	ErrArchetypeLocked  = errors.New("archetype can only be changed before the run starts")
	ErrInvalidTalent    = errors.New("talent is not available to this archetype")
	ErrTalentLocked     = errors.New("talent prerequisites are not met")
	ErrNoTalentPoints   = errors.New("no talent points available")
	ErrTalentChosen     = errors.New("talent has already been chosen")
)

const DefaultArchetype = "tank"

type ArchetypeDefinition struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

type TalentDefinition struct {
	ID          string `json:"id"`
	Archetype   string `json:"archetype"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Tier        int    `json:"tier"`
	Requires    string `json:"requires,omitempty"`
}

type PlayerStats struct {
	Power   int `json:"power"`
	Focus   int `json:"focus"`
	Agility int `json:"agility"`
}

type TalentBonuses struct {
	AttackDamage      int
	InterruptDamage   int
	GuardReduction    int
	DamageReduction   int
	AttackVsTelegraph int
	EncounterHeal     int
	ReflectDamage     int
	MaxHealth         int
}

var archetypeCatalog = []ArchetypeDefinition{
	{ID: "support", Name: "Support", Description: "Disrupt enemies, create openings, and help the party stay ahead."},
	{ID: "healer", Name: "Healer", Description: "Keep the party standing through recovery and protective magic."},
	{ID: "tank", Name: "Tank", Description: "Absorb pressure, protect yourself, and punish enemies that strike you."},
}

var talentCatalog = []TalentDefinition{
	{ID: "support-tactical-strike", Archetype: "support", Name: "Tactical Strike", Description: "Attacks deal 2 additional damage.", Tier: 1},
	{ID: "support-disruption", Archetype: "support", Name: "Disruption", Description: "Interrupts deal 4 additional damage.", Tier: 1},
	{ID: "support-expose-weakness", Archetype: "support", Name: "Expose Weakness", Description: "Deal 4 extra damage to enemies with a telegraphed move.", Tier: 2, Requires: "support-tactical-strike"},
	{ID: "support-protective-ward", Archetype: "support", Name: "Protective Ward", Description: "Defend blocks 3 additional damage.", Tier: 2, Requires: "support-disruption"},
	{ID: "healer-vitality", Archetype: "healer", Name: "Vitality", Description: "+6 maximum health.", Tier: 1},
	{ID: "healer-restoration", Archetype: "healer", Name: "Restoration", Description: "Recover 6 health after clearing an encounter.", Tier: 1},
	{ID: "healer-renewal", Archetype: "healer", Name: "Renewal", Description: "Recover 4 additional health after clearing an encounter.", Tier: 2, Requires: "healer-restoration"},
	{ID: "healer-sanctuary", Archetype: "healer", Name: "Sanctuary", Description: "Defend blocks 3 additional damage.", Tier: 2, Requires: "healer-vitality"},
	{ID: "tank-bulwark", Archetype: "tank", Name: "Bulwark", Description: "+6 maximum health.", Tier: 1},
	{ID: "tank-braced-stance", Archetype: "tank", Name: "Braced Stance", Description: "Defend blocks 3 additional damage.", Tier: 1},
	{ID: "tank-thorns", Archetype: "tank", Name: "Thorns", Description: "Reflect 2 damage when struck.", Tier: 2, Requires: "tank-bulwark"},
	{ID: "tank-unyielding", Archetype: "tank", Name: "Unyielding", Description: "Defend blocks 3 additional damage.", Tier: 2, Requires: "tank-braced-stance"},
}

func ArchetypeCatalog() []ArchetypeDefinition {
	return append([]ArchetypeDefinition(nil), archetypeCatalog...)
}

func TalentCatalog() []TalentDefinition {
	return append([]TalentDefinition(nil), talentCatalog...)
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
	return nil
}

func ChooseTalent(room *Room, playerID, talentID string) error {
	if room.Run == nil || room.Run.Phase != PhaseExploring {
		return ErrInvalidPhase
	}
	player := room.Run.Players[playerID]
	if player == nil || room.Presence[playerID].LeftAt != nil {
		return ErrNotPlayer
	}
	if player.TalentPoints <= 0 {
		return ErrNoTalentPoints
	}
	definition, ok := findTalent(talentID)
	if !ok || definition.Archetype != player.Archetype {
		return ErrInvalidTalent
	}
	if contains(player.Talents, talentID) {
		return ErrTalentChosen
	}
	if player.Level < definition.Tier+1 {
		return ErrTalentLocked
	}
	if definition.Requires != "" && !contains(player.Talents, definition.Requires) {
		return ErrTalentLocked
	}

	oldMaxHealthBonus := bonusesFor(player).MaxHealth
	player.Talents = append(player.Talents, talentID)
	player.TalentPoints--
	maxHealthIncrease := bonusesFor(player).MaxHealth - oldMaxHealthBonus
	if maxHealthIncrease > 0 {
		player.MaxHealth += maxHealthIncrease
	}
	return nil
}

func newPlayerState(id, archetype string) *PlayerState {
	if !isArchetype(archetype) {
		archetype = DefaultArchetype
	}
	return &PlayerState{
		ID: id, Health: 30, MaxHealth: 30, Archetype: archetype,
		Level: 1, Talents: []string{},
	}
}

func experienceForNextLevel(level int) int {
	switch level {
	case 1:
		return 50
	case 2:
		return 100
	case 3:
		return 200
	case 4:
		return 325
	default:
		return 0
	}
}

func grantEncounterExperience(room *Room, round int) {
	run := room.Run
	reward := 50
	if run.CurrentRoomID == "warden" {
		reward = 75
	}
	for _, playerID := range room.PlayerIDs {
		player := run.Players[playerID]
		if player == nil || room.Presence[playerID].LeftAt != nil {
			continue
		}
		player.Experience += reward
		addCombatEvent(run, round, "experience", adventurerLabel(room, playerID)+" earns "+itoa(reward)+" XP.")
		for player.Level < 5 {
			next := experienceForNextLevel(player.Level)
			if next == 0 || player.Experience < next {
				break
			}
			player.Level++
			player.TalentPoints++
			switch player.Level {
			case 2:
				player.MaxHealth += 4
				player.Stats.Power++
			case 3:
				player.Stats.Focus += 2
			case 4:
				player.MaxHealth += 4
				player.Stats.Agility++
			case 5:
				player.Stats.Power++
				player.Stats.Focus++
			}
			addCombatEvent(run, round, "level_up", adventurerLabel(room, playerID)+" reaches level "+itoa(player.Level)+"! Choose a talent between encounters.")
		}
	}
}

func bonusesFor(player *PlayerState) TalentBonuses {
	var bonuses TalentBonuses
	for _, id := range player.Talents {
		switch id {
		case "support-tactical-strike":
			bonuses.AttackDamage += 2
		case "support-disruption":
			bonuses.InterruptDamage += 4
		case "support-expose-weakness":
			bonuses.AttackVsTelegraph += 4
		case "support-protective-ward":
			bonuses.GuardReduction += 3
		case "healer-vitality":
			bonuses.MaxHealth += 6
		case "healer-restoration":
			bonuses.EncounterHeal += 6
		case "healer-renewal":
			bonuses.EncounterHeal += 4
		case "healer-sanctuary":
			bonuses.GuardReduction += 3
		case "tank-bulwark":
			bonuses.MaxHealth += 6
		case "tank-braced-stance":
			bonuses.GuardReduction += 3
		case "tank-thorns":
			bonuses.ReflectDamage += 2
		case "tank-unyielding":
			bonuses.GuardReduction += 3
		}
	}
	return bonuses
}

func findTalent(id string) (TalentDefinition, bool) {
	for _, talent := range talentCatalog {
		if talent.ID == id {
			return talent, true
		}
	}
	return TalentDefinition{}, false
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
