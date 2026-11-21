package httpapi

import (
	"context"
	"net/http"
	"sync"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/game"
	"github.com/swarkentin/heart-of-the-beast/backend/internal/store"
)

// The shared Heart of the Beast (ADR 0040). GET /beast is public: the title screen shows every visitor how close
// all the parties together are to destroying it, and who has hurt it most.

// HeartLeaderboardSize is how many adventurers and parties the high scores list.
const HeartLeaderboardSize = 10

type beastHeartResponse struct {
	MaxHealth   int64                   `json:"maxHealth"`
	Health      int64                   `json:"health"`
	Damage      int64                   `json:"damage"`
	Strikes     int64                   `json:"strikes"`
	UpdatedAt   string                  `json:"updatedAt,omitempty"`
	Leaderboard *store.HeartLeaderboard `json:"leaderboard,omitempty"`
}

func (h *Handler) getBeastHeart(w http.ResponseWriter, r *http.Request) {
	heart := store.BeastHeart{MaxHealth: game.BeastHeartInitialHealth}
	var board *store.HeartLeaderboard
	if repository, ok := h.rooms.(store.BeastHeartRepository); ok {
		var err error
		if heart, err = repository.BeastHeart(r.Context()); err != nil {
			writeError(w, http.StatusInternalServerError, "could not read the heart")
			return
		}
		scores, err := repository.HeartLeaderboard(r.Context(), HeartLeaderboardSize)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not read the heart's high scores")
			return
		}
		board = &scores
	}
	response := beastHeartResponse{MaxHealth: heart.MaxHealth, Health: heart.Health(), Damage: heart.Damage, Strikes: heart.Strikes, Leaderboard: board}
	if !heart.UpdatedAt.IsZero() {
		response.UpdatedAt = heart.UpdatedAt.UTC().Format("2006-01-02T15:04:05Z07:00")
	}
	w.Header().Set("Cache-Control", "public, max-age=15")
	writeJSON(w, http.StatusOK, response)
}

// bankedHeartStrikes remembers the running total this process last banked for each fight, so snapshot polls skip
// the database while nothing has changed.
type bankedHeartStrikes struct{ seen sync.Map }

// awardHeartStrikes banks every fight the run has had with the heart, player by player. Totals only grow and the
// store adds only what is new, so this is safe after every transition; a player who has left keeps their damage.
func (h *Handler) awardHeartStrikes(ctx context.Context, room *game.Room) error {
	if room == nil || room.Run == nil || len(room.Run.HeartStrikes) == 0 {
		return nil
	}
	repository, ok := h.rooms.(store.BeastHeartRepository)
	if !ok {
		return nil
	}
	for _, strike := range room.Run.HeartStrikes {
		key := room.Run.ID + "\x00" + strike.EncounterID
		state := heartBankState{damage: strike.Damage(), drivenOff: strike.DrivenOff}
		if previous, done := h.heartBanked.seen.Load(key); done && previous.(heartBankState) == state {
			continue
		}
		record := store.HeartStrikeRecord{RunID: room.Run.ID, EncounterID: strike.EncounterID, ThemeID: strike.ThemeID, Dungeon: strike.Dungeon, DrivenOff: strike.DrivenOff}
		for playerID, damage := range strike.ByPlayer {
			contribution := store.HeartContribution{Contributor: store.HeartPartyContributor, Damage: damage}
			if playerID != game.HeartPartyKey {
				contribution = store.HeartContribution{Contributor: "player:" + playerID, ProfileID: room.PlayerProfileIDs[playerID], Damage: damage}
			}
			record.Contributions = append(record.Contributions, contribution)
		}
		if err := repository.RecordHeartStrike(ctx, record, h.now().UTC()); err != nil {
			return err
		}
		h.heartBanked.seen.Store(key, state)
	}
	return nil
}

type heartBankState struct {
	damage    int64
	drivenOff bool
}
