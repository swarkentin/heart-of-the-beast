package store

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"time"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/game"
)

var ErrNotFound = errors.New("room not found")
var ErrConflict = errors.New("room was changed by another command")
var ErrPlayerLeft = errors.New("player has left the room")

type Repository interface {
	Create(context.Context, *game.Room) error
	Get(context.Context, string) (*game.Room, error)
	GetByCode(context.Context, string) (*game.Room, error)
	TouchPlayer(context.Context, string, string, time.Time) error
	Save(context.Context, *game.Room, int64) error
}

type Memory struct {
	mu       sync.RWMutex
	rooms    map[string][]byte
	profiles map[string]*Profile
	awards   map[string]bool
	// runXP is the experience already banked per profile:run key (AwardRunXP adds only the increase).
	runXP map[string]int64
	// Optional sign-in state (ADR 0034). Extra device credentials are extra
	// keys in profiles that point at the same *Profile.
	identities map[string]memoryIdentity
	signIns    map[string]SignIn
	// The shared Heart of the Beast (ADR 0040).
	heartDamage  int64
	heartStrikes map[string]*memoryHeartStrike
	heartUpdated time.Time
}

type memoryIdentity struct {
	provider  string
	profileID string
	username  string
	linkedAt  time.Time
}

func NewMemory() *Memory {
	return &Memory{
		rooms: make(map[string][]byte), profiles: make(map[string]*Profile), awards: make(map[string]bool), runXP: make(map[string]int64),
		identities: make(map[string]memoryIdentity), signIns: make(map[string]SignIn),
	}
}

func cloneRoom(room *game.Room) (*game.Room, error) {
	data, err := json.Marshal(room)
	if err != nil {
		return nil, err
	}
	var copy game.Room
	if err := json.Unmarshal(data, &copy); err != nil {
		return nil, err
	}
	return &copy, nil
}

func (m *Memory) Create(_ context.Context, room *game.Room) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, exists := m.rooms[room.ID]; exists {
		return ErrConflict
	}
	data, err := json.Marshal(room)
	if err != nil {
		return err
	}
	m.rooms[room.ID] = data
	return nil
}

func (m *Memory) Get(_ context.Context, id string) (*game.Room, error) {
	m.mu.RLock()
	data, exists := m.rooms[id]
	m.mu.RUnlock()
	if !exists {
		return nil, ErrNotFound
	}
	var room game.Room
	if err := json.Unmarshal(data, &room); err != nil {
		return nil, err
	}
	return &room, nil
}

func (m *Memory) GetByCode(_ context.Context, code string) (*game.Room, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	for _, data := range m.rooms {
		var room game.Room
		if err := json.Unmarshal(data, &room); err != nil {
			return nil, err
		}
		if room.Code == code {
			return &room, nil
		}
	}
	return nil, ErrNotFound
}

func (m *Memory) TouchPlayer(_ context.Context, roomID, playerID string, seenAt time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	data, exists := m.rooms[roomID]
	if !exists {
		return ErrNotFound
	}
	var room game.Room
	if err := json.Unmarshal(data, &room); err != nil {
		return err
	}
	if _, active := room.PlayerTokenHashes[playerID]; !active {
		return ErrPlayerLeft
	}
	if room.Presence == nil {
		room.Presence = make(map[string]game.PlayerPresence)
	}
	presence := room.Presence[playerID]
	if presence.LeftAt != nil {
		return ErrPlayerLeft
	}
	presence.LastSeenAt = seenAt
	room.Presence[playerID] = presence
	encoded, err := json.Marshal(&room)
	if err != nil {
		return err
	}
	m.rooms[roomID] = encoded
	return nil
}

func (m *Memory) Save(_ context.Context, room *game.Room, expectedVersion int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	data, exists := m.rooms[room.ID]
	if !exists {
		return ErrNotFound
	}
	var current game.Room
	if err := json.Unmarshal(data, &current); err != nil {
		return err
	}
	if current.Version != expectedVersion {
		return ErrConflict
	}
	encoded, err := json.Marshal(room)
	if err != nil {
		return err
	}
	m.rooms[room.ID] = encoded
	return nil
}

func (m *Memory) GetOrCreateProfile(_ context.Context, id, credentialHash string, now time.Time) (*Profile, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if existing := m.profiles[credentialHash]; existing != nil {
		copy, err := cloneProfile(existing)
		return copy, err
	}
	profile := &Profile{
		ID: id, DisplayName: "Adventurer", AdventurerLevel: 1, ClassMastery: map[string]ClassMastery{},
		UnlockedCosmetics: []string{}, CreatedAt: now.UTC(), UpdatedAt: now.UTC(),
	}
	m.profiles[credentialHash] = profile
	return cloneProfile(profile)
}

func (m *Memory) UpdateProfileName(_ context.Context, credentialHash, name string, now time.Time) (*Profile, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	profile := m.profiles[credentialHash]
	if profile == nil {
		return nil, ErrNotFound
	}
	profile.DisplayName = name
	profile.UpdatedAt = now.UTC()
	return cloneProfile(profile)
}

func (m *Memory) GetProfile(_ context.Context, credentialHash string) (*Profile, error) {
	m.mu.RLock()
	profile := m.profiles[credentialHash]
	m.mu.RUnlock()
	if profile == nil {
		return nil, ErrNotFound
	}
	return cloneProfile(profile)
}

func (m *Memory) AwardRunXP(_ context.Context, profileID, runID, playerID, classID string, xp int64, now time.Time) (*Profile, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	key := profileID + ":" + runID
	for _, profile := range m.profiles {
		if profile.ID != profileID {
			continue
		}
		if delta := xp - m.runXP[key]; delta > 0 {
			xp := delta
			profile.AdventurerXP += xp
			profile.AdventurerLevel = game.ProfileLevelFor(profile.AdventurerXP)
			if classID != "" {
				mastery := profile.ClassMastery[classID]
				mastery.Experience += xp
				mastery.Level = game.ProfileLevelFor(mastery.Experience)
				profile.ClassMastery[classID] = mastery
			}
			applyProfileRewardUnlocks(profile)
			profile.UpdatedAt = now.UTC()
			m.runXP[key] += delta
		}
		return cloneProfile(profile)
	}
	return nil, ErrNotFound
}
