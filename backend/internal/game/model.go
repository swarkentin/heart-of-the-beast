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
	ID                 string                    `json:"id"`
	Code               string                    `json:"code"`
	OwnerPlayerID      string                    `json:"ownerPlayerId"`
	PlayerIDs          []string                  `json:"playerIds"`
	PlayerArchetypes   map[string]string         `json:"playerArchetypes,omitempty"`
	PlayerClasses      map[string]string         `json:"playerClasses,omitempty"`
	PlayerClassTiers   map[string]int            `json:"playerClassTiers,omitempty"`
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
	ThemeID                 string                  `json:"themeId,omitempty"`
	Seed                    uint64                  `json:"seed,omitempty"`
	Depth                   int                     `json:"depth,omitempty"`
	MaxDepth                int                     `json:"maxDepth,omitempty"`
	MusicIntensity          int                     `json:"musicIntensity,omitempty"`
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
	LastCombatEvents        []CombatEvent           `json:"lastCombatEvents,omitempty"`
}

type NavigationVote struct {
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
	TalentPoints   int                 `json:"talentPoints"`
	Talents        []string            `json:"talents"`
	Stats          PlayerStats         `json:"stats"`
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
	DefinitionID string          `json:"definitionId,omitempty"`
	Budget       int             `json:"budget,omitempty"`
	Status       EncounterStatus `json:"status"`
	Enemies      []Enemy         `json:"enemies"`
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
	ID           string `json:"id"`
	DefinitionID string `json:"definitionId,omitempty"`
	Name         string `json:"name"`
	Behavior     string `json:"behavior,omitempty"`
	// SpriteID is "<theme>/<creature>" for the pixel-art sheet at /art/monsters/<SpriteID>.png. Runs persisted
	// before art existed lack it; clients must fall back to a placeholder.
	SpriteID     string       `json:"sprite,omitempty"`
	TurnsTaken   int          `json:"turnsTaken"`
	Health       int          `json:"health"`
	MaxHealth    int          `json:"maxHealth"`
	MarkedDamage int          `json:"markedDamage,omitempty"`
	Intent       *EnemyIntent `json:"intent,omitempty"`
}

type CombatEvent struct {
	Round      int    `json:"round"`
	Kind       string `json:"kind"`
	Message    string `json:"message"`
	Effect     string `json:"effect,omitempty"`
	TargetID   string `json:"targetId,omitempty"`
	TargetType string `json:"targetType,omitempty"`
	Amount     int    `json:"amount,omitempty"`
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
}

type CombatRound struct {
	Number    int                `json:"number"`
	StartedAt time.Time          `json:"startedAt"`
	Deadline  time.Time          `json:"deadline"`
	Actions   map[string]Command `json:"actions"`
}
