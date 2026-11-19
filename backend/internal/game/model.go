package game

import "time"

type RunPhase string

const (
	PhaseLobby        RunPhase = "lobby"
	PhaseCombat       RunPhase = "combat"
	PhaseExploring    RunPhase = "exploring"
	PhaseIntermission RunPhase = "intermission"
	PhaseCompleted    RunPhase = "completed"
	PhaseFailed       RunPhase = "failed"
)

type EncounterStatus string

const (
	EncounterActive  EncounterStatus = "active"
	EncounterCleared EncounterStatus = "cleared"
)

type Room struct {
	ID               string                `json:"id"`
	Code             string                `json:"code"`
	OwnerPlayerID    string                `json:"ownerPlayerId"`
	PlayerIDs        []string              `json:"playerIds"`
	PlayerArchetypes map[string]string     `json:"playerArchetypes,omitempty"`
	PlayerClasses    map[string]string     `json:"playerClasses,omitempty"`
	PlayerSkins      map[string]PlayerSkin `json:"playerSkins,omitempty"`
	// PlayerLoadouts are the skill bars chosen in the lobby. PlayerMastery is the server's record of each
	// player's mastery in their selected class, read from their profile, which decides the skills they may pick.
	PlayerLoadouts     map[string][]string       `json:"playerLoadouts,omitempty"`
	PlayerMastery      map[string]int            `json:"playerMastery,omitempty"`
	PlayerTokenHashes  map[string]string         `json:"playerTokenHashes"`
	PlayerProfileIDs   map[string]string         `json:"playerProfileIds,omitempty"`
	Presence           map[string]PlayerPresence `json:"presence,omitempty"`
	SpectatorTokenHash string                    `json:"spectatorTokenHash"`
	Run                *Run                      `json:"run,omitempty"`
	Version            int64                     `json:"version"`
	CreatedAt          time.Time                 `json:"createdAt"`
	UpdatedAt          time.Time                 `json:"updatedAt"`
}

type PlayerPresence struct {
	LastSeenAt time.Time  `json:"lastSeenAt"`
	LeftAt     *time.Time `json:"leftAt,omitempty"`
}

type Run struct {
	ID string `json:"id"`
	// ThemeID is the dungeon theme (see DungeonThemeCatalog) of the whole run. Runs persisted before themes
	// existed lack it and are Forgotten Catacombs; use Theme() rather than reading the field directly.
	ThemeID        string `json:"themeId,omitempty"`
	Seed           uint64 `json:"seed,omitempty"`
	Depth          int    `json:"depth,omitempty"`
	MaxDepth       int    `json:"maxDepth,omitempty"`
	MusicIntensity int    `json:"musicIntensity,omitempty"`
	// Cheated marks a run whose rewards are forfeited after using IDKFA.
	Cheated bool `json:"cheated,omitempty"`
	// Generator is the version of the rules the run was started under. Zero is a run persisted before
	// expeditions (three floors, a restore-or-perk choice between them); ExpeditionGenerator runs have exactly four generated floors, floor modifiers, gold, and a camp between floors.
	Generator int `json:"generator,omitempty"`
	// Dungeon counts the dungeons of the expedition, starting at 1 (0 on a run that has only seen its first).
	// DungeonsCleared is how many dungeon bosses the party has beaten.
	Dungeon         int `json:"dungeon,omitempty"`
	DungeonsCleared int `json:"dungeonsCleared,omitempty"`
	// DungeonThemes lists the theme of every dungeon the expedition has entered, in order, for the expedition
	// map. Runs saved before it existed lack the dungeons they had already entered.
	DungeonThemes []string `json:"dungeonThemes,omitempty"`
	// FloorsCleared counts floor bosses beaten across the whole expedition: how far the party got. Rank is the
	// title that distance earned, set when the expedition ends.
	FloorsCleared int `json:"floorsCleared,omitempty"`
	// EncountersCleared counts every fight won. Rooms of finished dungeons are dropped, so this is the record.
	EncountersCleared int    `json:"encountersCleared,omitempty"`
	Rank              string `json:"rank,omitempty"`
	// DungeonModifiers came with the dungeon the party voted for and hold on every one of its floors.
	DungeonModifiers []ActiveFloorModifier `json:"dungeonModifiers,omitempty"`
	// FloorModifiers are the level-wide debuffs and perks in force on the current floor.
	FloorModifiers []ActiveFloorModifier `json:"floorModifiers,omitempty"`
	// Briefing describes the dungeon the party is in; clients show it as an intro on entering it.
	Briefing *DungeonBriefing `json:"briefing,omitempty"`
	// Camp is the respite between two floors of an expedition: a mini-game, then a shop.
	Camp                    *Camp                   `json:"camp,omitempty"`
	PendingInterFloorChoice bool                    `json:"pendingInterFloorChoice,omitempty"`
	InterFloorVote          *NavigationVote         `json:"interFloorVote,omitempty"`
	Phase                   RunPhase                `json:"phase"`
	CurrentRoomID           string                  `json:"currentRoomId"`
	Rooms                   map[string]*DungeonRoom `json:"rooms"`
	Players                 map[string]*PlayerState `json:"players"`
	Flags                   map[string]bool         `json:"flags,omitempty"`
	StartedAt               time.Time               `json:"startedAt"`
	CompletedAt             *time.Time              `json:"completedAt,omitempty"`
	CombatRoundNumber       int                     `json:"combatRoundNumber"`
	CombatRound             *CombatRound            `json:"combatRound,omitempty"`
	NavigationVote          *NavigationVote         `json:"navigationVote,omitempty"`
	EventVote               *RoomEventVote          `json:"eventVote,omitempty"`
	LastCombatEvents        []CombatEvent           `json:"lastCombatEvents,omitempty"`
}

type NavigationVote struct {
	StartedAt time.Time         `json:"startedAt"`
	Deadline  time.Time         `json:"deadline"`
	Votes     map[string]string `json:"votes"`
}

type RoomEventVote struct {
	EventID   string            `json:"eventId"`
	StartedAt time.Time         `json:"startedAt"`
	Deadline  time.Time         `json:"deadline"`
	Votes     map[string]string `json:"votes"`
}

type ClassCombatState struct {
	DamageTakenLastRound int  `json:"damageTakenLastRound,omitempty"`
	DamageTakenThisRound int  `json:"damageTakenThisRound,omitempty"`
	GuardBonus           int  `json:"guardBonus,omitempty"`
	Ward                 int  `json:"ward,omitempty"`
	WardReflect          int  `json:"wardReflect,omitempty"`
	ResolveReady         bool `json:"resolveReady,omitempty"`
	ArcaneCharges        int  `json:"arcaneCharges,omitempty"`
	// Cooldowns is how many more rounds each recovering skill is unavailable. Every fight starts with all ready.
	Cooldowns map[string]int `json:"cooldowns,omitempty"`
	// Empower is bonus damage on the next damaging skill. Thorns reflects damage to attackers this round.
	Empower int `json:"empower,omitempty"`
	Thorns  int `json:"thorns,omitempty"`
	// Regen heals at the end of each of the next RegenRounds rounds.
	Regen       int `json:"regen,omitempty"`
	RegenRounds int `json:"regenRounds,omitempty"`
	// OathSpent records that the Undying Oath boon has saved its owner this fight.
	OathSpent bool `json:"oathSpent,omitempty"`
}

type PlayerState struct {
	ID             string              `json:"id"`
	Health         int                 `json:"health"`
	MaxHealth      int                 `json:"maxHealth"`
	StrikeDamage   int                 `json:"strikeDamage"`
	GuardReduction int                 `json:"guardReduction"`
	Guarding       bool                `json:"guarding,omitempty"`
	Archetype      string              `json:"archetype"`
	ClassBuild     *ClassBuildSnapshot `json:"classBuild,omitempty"`
	ClassCombat    ClassCombatState    `json:"classCombat,omitempty"`
	Experience     int                 `json:"experience"`
	Level          int                 `json:"level"`
	Stats          PlayerStats         `json:"stats"`
	// Skills is the player's combat bar for this run, in slot order.
	Skills []string `json:"skills,omitempty"`
	// Consumables is the adventurer carried supply, keyed by stable catalog ID.
	Consumables map[string]int `json:"consumables,omitempty"`
	// Gold is earned by clearing encounters and playing camp mini-games, and spent at the camp shop.
	Gold int `json:"gold,omitempty"`
	// Items are the IDs of the shop items the player has bought this run, in order.
	Items []string `json:"items,omitempty"`
	// Boons are the IDs of the boons (boons.go) the player has claimed from capstone bosses, in order.
	Boons []string `json:"boons,omitempty"`
}

type DungeonRoom struct {
	ID string `json:"id"`
	// ThemeID is the room's dungeon theme, which drives its art and music. Empty means Forgotten Catacombs.
	ThemeID     string     `json:"themeId,omitempty"`
	Name        string     `json:"name"`
	Floor       string     `json:"floor"`
	RoomType    string     `json:"roomType"`
	Description string     `json:"description"`
	Exits       []Exit     `json:"exits"`
	Encounter   *Encounter `json:"encounter,omitempty"`
	Event       *RoomEvent `json:"event,omitempty"`
	Cleared     bool       `json:"cleared"`
}

type RoomEvent struct {
	ID          string        `json:"id"`
	Title       string        `json:"title"`
	Description string        `json:"description"`
	Choices     []EventChoice `json:"choices"`
	Resolved    bool          `json:"resolved"`
	Result      string        `json:"result,omitempty"`
}

type EventChoice struct {
	ID          string `json:"id"`
	Label       string `json:"label"`
	Description string `json:"description"`
	Effect      string `json:"effect"`
}

type Exit struct {
	ID          string `json:"id"`
	Destination string `json:"destination"`
	Label       string `json:"label"`
	Description string `json:"description,omitempty"`
}

type Encounter struct {
	DefinitionID     string          `json:"definitionId,omitempty"`
	ModifierAssigned bool            `json:"modifierAssigned,omitempty"`
	Budget           int             `json:"budget,omitempty"`
	Status           EncounterStatus `json:"status"`
	Enemies          []Enemy         `json:"enemies"`
}

type EnemyIntent struct {
	Kind           string `json:"kind"`
	Label          string `json:"label"`
	Damage         int    `json:"damage"`
	Heal           int    `json:"heal,omitempty"`
	TargetPlayerID string `json:"targetPlayerId,omitempty"`
	TargetAll      bool   `json:"targetAll,omitempty"`
	Interruptible  bool   `json:"interruptible,omitempty"`
}

type Enemy struct {
	ID                string `json:"id"`
	Modifier          string `json:"modifier,omitempty"`
	ModifierTriggered bool   `json:"modifierTriggered,omitempty"`
	DefinitionID      string `json:"definitionId,omitempty"`
	Name              string `json:"name"`
	Behavior          string `json:"behavior,omitempty"`
	// SpriteID is "<theme>/<creature>" for the pixel-art sheet at /art/monsters/<SpriteID>.png. Runs persisted
	// before art existed lack it; clients must fall back to a placeholder.
	SpriteID     string       `json:"sprite,omitempty"`
	TurnsTaken   int          `json:"turnsTaken"`
	Health       int          `json:"health"`
	MaxHealth    int          `json:"maxHealth"`
	MarkedDamage int          `json:"markedDamage,omitempty"`
	Intent       *EnemyIntent `json:"intent,omitempty"`
	// Mechanics are the boss mechanics (see boss_mechanics.go) this enemy uses. Only dungeon bosses have any.
	Mechanics []string `json:"mechanics,omitempty"`
	// Barrier absorbs basic-attack damage before health. Every other skill pierces it.
	Barrier int `json:"barrier,omitempty"`
	// Enraged is set once, when an enraging boss falls to low health. DamageBonus then raises every hit.
	Enraged     bool `json:"enraged,omitempty"`
	DamageBonus int  `json:"damageBonus,omitempty"`
	// SummonMonsterID and SummonsLeft drive the summon mechanic. Summoned marks the reinforcements themselves.
	SummonMonsterID string `json:"summonMonsterId,omitempty"`
	SummonsLeft     int    `json:"summonsLeft,omitempty"`
	Summoned        bool   `json:"summoned,omitempty"`
	// BarrierLabel and CataclysmLabel name the boss's barrier and cataclysm in telegraphs and the log.
	BarrierLabel   string `json:"barrierLabel,omitempty"`
	CataclysmLabel string `json:"cataclysmLabel,omitempty"`
	// Capstone mechanics (capstone.go). AnchorMonsterID and AnchorWavesLeft drive the anchor mechanic, and Anchor
	// marks the anchors themselves; Anchored is set while a living anchor protects the boss. RebirthLabel names a
	// boss's second life and Reborn records that it has used it. LegionMonsterID is the servant a legion boss
	// calls, Calls counts the servants it has called, and DevourIn is how many turns until it next feeds on them.
	AnchorMonsterID string `json:"anchorMonsterId,omitempty"`
	AnchorWavesLeft int    `json:"anchorWavesLeft,omitempty"`
	Anchor          bool   `json:"anchor,omitempty"`
	Anchored        bool   `json:"anchored,omitempty"`
	RebirthLabel    string `json:"rebirthLabel,omitempty"`
	Reborn          bool   `json:"reborn,omitempty"`
	LegionMonsterID string `json:"legionMonsterId,omitempty"`
	Calls           int    `json:"calls,omitempty"`
	DevourIn        int    `json:"devourIn,omitempty"`
	Devoured        int    `json:"devoured,omitempty"`
	// Stun is how many coming turns the enemy loses (a boss is staggered instead and hits for half).
	Stun int `json:"stun,omitempty"`
	// Bleed is damage taken at the end of each of the next BleedRounds rounds.
	Bleed       int `json:"bleed,omitempty"`
	BleedRounds int `json:"bleedRounds,omitempty"`
	// TauntedBy is the adventurer this enemy's single-target moves are forced onto for TauntRounds more turns.
	TauntedBy   string `json:"tauntedBy,omitempty"`
	TauntRounds int    `json:"tauntRounds,omitempty"`
	// Traits are the monster's traits (monster_traits.go). Shield is what a warder's shield has left to absorb,
	// Phased marks a phasing monster's half-damage turn, FuseIn counts the turns until a fuse detonates, Split
	// marks a splitting monster that has split (or is the copy), and Avenged an avenger that has sworn vengeance.
	Traits  []MonsterTrait `json:"traits,omitempty"`
	Shield  int            `json:"shield,omitempty"`
	Phased  bool           `json:"phased,omitempty"`
	FuseIn  int            `json:"fuseIn,omitempty"`
	Split   bool           `json:"split,omitempty"`
	Avenged bool           `json:"avenged,omitempty"`
}

type CombatEvent struct {
	Round      int    `json:"round"`
	Kind       string `json:"kind"`
	Message    string `json:"message"`
	Effect     string `json:"effect,omitempty"`
	TargetID   string `json:"targetId,omitempty"`
	TargetType string `json:"targetType,omitempty"`
	Amount     int    `json:"amount,omitempty"`
	Critical   bool   `json:"critical,omitempty"`
	// ActorID is the player who took the action, when the event is a player's action.
	ActorID string `json:"actorId,omitempty"`
	// Auto marks an action the server chose because the player did not act before the round deadline.
	Auto bool `json:"auto,omitempty"`
}

type Command struct {
	Type     string `json:"type"`
	Round    int    `json:"round,omitempty"`
	ExitID   string `json:"exitId,omitempty"`
	ChoiceID string `json:"choiceId,omitempty"`
	Action   string `json:"action,omitempty"`
	Mode     string `json:"mode,omitempty"`
	TargetID string `json:"targetId,omitempty"`
	// Skill is the skill a "skill" combat action uses. SkillIDs is the new bar of a "set_loadout" command.
	Skill    string   `json:"skill,omitempty"`
	SkillIDs []string `json:"skillIds,omitempty"`
}

type CombatRound struct {
	Number    int                `json:"number"`
	StartedAt time.Time          `json:"startedAt"`
	Deadline  time.Time          `json:"deadline"`
	Actions   map[string]Command `json:"actions"`
}
