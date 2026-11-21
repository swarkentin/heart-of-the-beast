package store

import (
	"context"
	"time"
)

// BeastHeart is the shared Heart of the Beast (ADR 0040): one health pool for every party, kept across runs.
type BeastHeart struct {
	MaxHealth int64     `json:"maxHealth"`
	Damage    int64     `json:"damage"`
	Strikes   int64     `json:"strikes"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// Health is what is left of the pool. Damage past the pool is kept (so a retune never loses it) but shows as zero.
func (h BeastHeart) Health() int64 {
	if h.Damage >= h.MaxHealth {
		return 0
	}
	return h.MaxHealth - h.Damage
}

// HeartPartyContributor is the contributor for damage no one player dealt.
const HeartPartyContributor = "party"

// HeartContribution is one contributor's running total in one fight. Contributor is unique within the fight;
// ProfileID is empty for the party and for players without a profile.
type HeartContribution struct {
	Contributor string
	ProfileID   string
	Damage      int64
}

// HeartStrikeRecord is a party's fight against the heart as it stands now. Damage totals only grow during a fight.
type HeartStrikeRecord struct {
	RunID         string
	EncounterID   string
	ThemeID       string
	Dungeon       int
	DrivenOff     bool
	Contributions []HeartContribution
}

// HeartPlayerScore is one adventurer's lifetime damage to the heart.
type HeartPlayerScore struct {
	ProfileID string `json:"profileId"`
	Name      string `json:"name"`
	Damage    int64  `json:"damage"`
	Fights    int64  `json:"fights"`
}

// HeartPartyScore is one party's fight against the heart.
type HeartPartyScore struct {
	RunID     string    `json:"runId"`
	Names     []string  `json:"names"`
	ThemeID   string    `json:"themeId,omitempty"`
	Dungeon   int       `json:"dungeon,omitempty"`
	Damage    int64     `json:"damage"`
	DrivenOff bool      `json:"drivenOff"`
	At        time.Time `json:"at"`
}

// HeartLeaderboard is the heart's high scores.
type HeartLeaderboard struct {
	Players []HeartPlayerScore `json:"players"`
	Parties []HeartPartyScore  `json:"parties"`
}

// BeastHeartRepository reads the shared heart and banks parties' fights against it. RecordHeartStrike takes each
// contributor's running total and adds only what is new, so it is safe to call after every transition, retry and
// poll; a fight's first record counts as a new strike.
type BeastHeartRepository interface {
	BeastHeart(context.Context) (BeastHeart, error)
	RecordHeartStrike(ctx context.Context, strike HeartStrikeRecord, now time.Time) error
	HeartLeaderboard(ctx context.Context, limit int) (HeartLeaderboard, error)
}
