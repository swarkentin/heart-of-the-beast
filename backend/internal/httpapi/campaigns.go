package httpapi

import (
	"context"
	"net/http"
	"sync"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/game"
	"github.com/swarkentin/heart-of-the-beast/backend/internal/store"
)

// Campaigns (ADR 0041). GET /campaigns is public: the catalog and its story, so every client tells the same one.
// Which campaigns a player has unlocked comes from their profile's trophies (GET /profile).

type profileByID interface {
	GetProfileByID(context.Context, string) (*store.Profile, error)
}

func listCampaigns(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Cache-Control", "public, max-age=300")
	writeJSON(w, http.StatusOK, map[string]any{"campaigns": game.Campaigns()})
}

// leaderProfile is the profile the room host joined with, or nil.
func (h *Handler) leaderProfile(ctx context.Context, room *game.Room) *store.Profile {
	profiles, ok := h.rooms.(profileByID)
	profileID := room.PlayerProfileIDs[room.OwnerPlayerID]
	if !ok || profileID == "" {
		return nil
	}
	profile, err := profiles.GetProfileByID(ctx, profileID)
	if err != nil {
		return nil
	}
	return profile
}

// campaignUnlockedForLeader applies the rule that it is the party leader who must have unlocked a campaign.
func (h *Handler) campaignUnlockedForLeader(ctx context.Context, room *game.Room, campaignID string) bool {
	profile := h.leaderProfile(ctx, room)
	return game.CampaignUnlocked(campaignID, profile.CampaignCompleted)
}

// bankedCampaigns remembers the won runs this process has already credited to every adventurer.
type bankedCampaigns struct{ runs sync.Map }

// awardCampaignTrophies credits a won campaign to every adventurer who was still in the party at the end. It is
// idempotent in the store, and the process remembers runs it has banked so snapshot polls skip the database.
func (h *Handler) awardCampaignTrophies(ctx context.Context, room *game.Room) error {
	run := room.Run
	if run == nil || !run.CampaignWon || run.Cheated {
		return nil
	}
	if _, done := h.campaignsBanked.runs.Load(run.ID); done {
		return nil
	}
	repository, ok := h.rooms.(store.CampaignRepository)
	if !ok {
		return nil
	}
	for playerID, profileID := range room.PlayerProfileIDs {
		if profileID == "" || room.Presence[playerID].LeftAt != nil {
			continue
		}
		if err := repository.RecordCampaignCompletion(ctx, profileID, run.CampaignID, run.ID, h.now().UTC()); err != nil {
			return err
		}
	}
	h.campaignsBanked.runs.Store(run.ID, true)
	return nil
}
