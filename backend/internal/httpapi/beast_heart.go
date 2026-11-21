package httpapi

import (
	"context"
	"net/http"
	"sync"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/game"
	"github.com/swarkentin/heart-of-the-beast/backend/internal/store"
)

// The shared Heart of the Beast (ADR 0040). GET /beast is public: the title screen shows every visitor how close
// all the parties together are to destroying it.

type beastHeartResponse struct {
	MaxHealth int64  `json:"maxHealth"`
	Health    int64  `json:"health"`
	Damage    int64  `json:"damage"`
	Strikes   int64  `json:"strikes"`
	UpdatedAt string `json:"updatedAt,omitempty"`
}

func (h *Handler) getBeastHeart(w http.ResponseWriter, r *http.Request) {
	repository, ok := h.rooms.(store.BeastHeartRepository)
	heart := store.BeastHeart{MaxHealth: game.BeastHeartInitialHealth}
	if ok {
		var err error
		if heart, err = repository.BeastHeart(r.Context()); err != nil {
			writeError(w, http.StatusInternalServerError, "could not read the heart")
			return
		}
	}
	response := beastHeartResponse{MaxHealth: heart.MaxHealth, Health: heart.Health(), Damage: heart.Damage, Strikes: heart.Strikes}
	if !heart.UpdatedAt.IsZero() {
		response.UpdatedAt = heart.UpdatedAt.UTC().Format("2006-01-02T15:04:05Z07:00")
	}
	w.Header().Set("Cache-Control", "public, max-age=15")
	writeJSON(w, http.StatusOK, response)
}

// bankedHeartStrikes remembers the strikes this process has already banked, so snapshot polls skip the database.
type bankedHeartStrikes struct{ seen sync.Map }

// awardHeartStrikes banks every strike the run has dealt the heart. The store counts each (run, encounter) once.
func (h *Handler) awardHeartStrikes(ctx context.Context, room *game.Room) error {
	if room == nil || room.Run == nil || len(room.Run.HeartStrikes) == 0 {
		return nil
	}
	repository, ok := h.rooms.(store.BeastHeartRepository)
	if !ok {
		return nil
	}
	for _, strike := range room.Run.HeartStrikes {
		key := room.Run.ID + ":" + strike.EncounterID
		if _, done := h.heartBanked.seen.Load(key); done {
			continue
		}
		if err := repository.RecordHeartStrike(ctx, room.Run.ID, strike.EncounterID, strike.Damage, h.now().UTC()); err != nil {
			return err
		}
		h.heartBanked.seen.Store(key, true)
	}
	return nil
}
