package store

import (
	"context"
	"sort"
	"time"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/game"
)

type memoryHeartStrike struct {
	record        HeartStrikeRecord
	damage        int64
	contributions map[string]HeartContribution
	struckAt      time.Time
}

func (m *Memory) BeastHeart(_ context.Context) (BeastHeart, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return BeastHeart{MaxHealth: game.BeastHeartInitialHealth, Damage: m.heartDamage, Strikes: int64(len(m.heartStrikes)), UpdatedAt: m.heartUpdated}, nil
}

func (m *Memory) RecordHeartStrike(_ context.Context, record HeartStrikeRecord, now time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.heartStrikes == nil {
		m.heartStrikes = map[string]*memoryHeartStrike{}
	}
	key := record.RunID + "\x00" + record.EncounterID
	strike := m.heartStrikes[key]
	if strike == nil {
		strike = &memoryHeartStrike{contributions: map[string]HeartContribution{}, struckAt: now.UTC()}
		m.heartStrikes[key] = strike
	}
	strike.record.RunID, strike.record.EncounterID, strike.record.ThemeID, strike.record.Dungeon = record.RunID, record.EncounterID, record.ThemeID, record.Dungeon
	strike.record.DrivenOff = strike.record.DrivenOff || record.DrivenOff
	for _, contribution := range record.Contributions {
		previous := strike.contributions[contribution.Contributor]
		if delta := contribution.Damage - previous.Damage; delta > 0 {
			strike.damage += delta
			m.heartDamage += delta
			strike.contributions[contribution.Contributor] = contribution
		}
	}
	m.heartUpdated = now.UTC()
	return nil
}

func (m *Memory) HeartLeaderboard(_ context.Context, limit int) (HeartLeaderboard, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	name := func(profileID string) string {
		for _, profile := range m.profiles {
			if profile.ID == profileID && profile.DisplayName != "" {
				return profile.DisplayName
			}
		}
		return "Adventurer"
	}
	players := map[string]*HeartPlayerScore{}
	board := HeartLeaderboard{Players: []HeartPlayerScore{}, Parties: []HeartPartyScore{}}
	for _, strike := range m.heartStrikes {
		party := HeartPartyScore{RunID: strike.record.RunID, ThemeID: strike.record.ThemeID, Dungeon: strike.record.Dungeon, Damage: strike.damage, DrivenOff: strike.record.DrivenOff, At: strike.struckAt}
		contributions := make([]HeartContribution, 0, len(strike.contributions))
		for _, contribution := range strike.contributions {
			contributions = append(contributions, contribution)
		}
		sort.Slice(contributions, func(i, j int) bool { return contributions[i].Damage > contributions[j].Damage })
		for _, contribution := range contributions {
			if contribution.Contributor == HeartPartyContributor {
				continue
			}
			party.Names = append(party.Names, name(contribution.ProfileID))
			if contribution.ProfileID == "" {
				continue
			}
			score := players[contribution.ProfileID]
			if score == nil {
				score = &HeartPlayerScore{ProfileID: contribution.ProfileID, Name: name(contribution.ProfileID)}
				players[contribution.ProfileID] = score
			}
			score.Damage += contribution.Damage
			score.Fights++
		}
		board.Parties = append(board.Parties, party)
	}
	for _, score := range players {
		board.Players = append(board.Players, *score)
	}
	sort.Slice(board.Players, func(i, j int) bool {
		return board.Players[i].Damage > board.Players[j].Damage || board.Players[i].Damage == board.Players[j].Damage && board.Players[i].Name < board.Players[j].Name
	})
	sort.Slice(board.Parties, func(i, j int) bool {
		return board.Parties[i].Damage > board.Parties[j].Damage || board.Parties[i].Damage == board.Parties[j].Damage && board.Parties[i].At.Before(board.Parties[j].At)
	})
	board.Players = board.Players[:min(limit, len(board.Players))]
	board.Parties = board.Parties[:min(limit, len(board.Parties))]
	return board, nil
}
