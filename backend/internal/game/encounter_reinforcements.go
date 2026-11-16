package game

import "fmt"

// themeReinforcements are the two minions each dungeon theme sends to join a fight when the party is larger than
// one: a striker first, then a disruptor whose party-wide attacks scale naturally with the party. They are the
// theme's lightest monsters, so a bigger party meets more targets to choose between, not a wall of health.
var themeReinforcements = map[string][2]string{
	"catacombs":  {"scout", "hooded-wraith"},
	"scifi":      {"crab-drone", "sentry-drone"},
	"mobster":    {"goon-gunner", "velvet-viper"},
	"sunken":     {"reef-lurker", "ghost-jelly"},
	"clockwork":  {"windup-scamp", "gilded-dancer"},
	"carnival":   {"jester-cutthroat", "carousel-specter"},
	"jungle":     {"lumen-stalker", "lantern-moth"},
	"dreamscape": {"palm-crawler", "wandering-eye"},
	"arctic":     {"husk-hound", "ice-wraith"},
	"ghosttown":  {"phantom-coyote", "carrion-vulture"},
	"wasteland":  {"rust-hound", "flame-rig"},
}

// reinforcementBudgetCost is the authoring cost of one reinforcement minion.
const reinforcementBudgetCost = 2

// withPartyReinforcements adds a theme's reinforcement slots to an encounter that does not author its own:
//
//   - a boss fight gains the striker for three adventurers and the disruptor for four, so the boss still has a
//     retinue to protect it from a full party;
//   - a single-monster fight gains the striker for two and the disruptor for four (one, two, two, three enemies);
//   - any larger fight gains the striker for two, the disruptor for three and a second striker for four (two,
//     three, four, five enemies for a pair).
//
// The result never exceeds MaxEncounterEnemies.
func withPartyReinforcements(definition EncounterDefinition) EncounterDefinition {
	minions, ok := themeReinforcements[definition.ThemeID]
	if !ok {
		return definition
	}
	for _, spawn := range definition.Enemies {
		if spawn.isReinforcement() {
			return definition
		}
	}
	var joins []EncounterMonsterDefinition
	join := func(partySize int, monsterID string) {
		joins = append(joins, EncounterMonsterDefinition{
			ID:        fmt.Sprintf("reinforcement-%d", len(joins)+1),
			MonsterID: monsterID, BudgetCost: reinforcementBudgetCost, MinPartySize: partySize,
		})
	}
	switch {
	case encounterDefinitionHasBoss(definition):
		join(3, minions[0])
		join(4, minions[1])
	case len(definition.Enemies) == 1:
		join(2, minions[0])
		join(4, minions[1])
	default:
		join(2, minions[0])
		join(3, minions[1])
		join(4, minions[0])
	}
	room := MaxEncounterEnemies - len(definition.Enemies)
	if room < 0 {
		room = 0
	}
	if len(joins) > room {
		joins = joins[:room]
	}
	definition.Enemies = append(append([]EncounterMonsterDefinition(nil), definition.Enemies...), joins...)
	return definition
}

func encounterDefinitionHasBoss(definition EncounterDefinition) bool {
	for _, spawn := range definition.Enemies {
		if monster, err := defaultMonsterCatalog.Monster(spawn.MonsterID); err == nil && monster.Role == MonsterRoleBoss {
			return true
		}
	}
	return false
}
