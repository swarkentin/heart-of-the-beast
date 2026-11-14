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
	mu    sync.RWMutex
	rooms map[string][]byte
}

func NewMemory() *Memory {
	return &Memory{rooms: make(map[string][]byte)}
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
