package httpapi

import (
    "context"
    "strings"

    "github.com/swarkentin/heart-of-the-beast/backend/internal/game"
    "github.com/swarkentin/heart-of-the-beast/backend/internal/store"
)

type enemyBeforeKill struct {
    health int
    kill store.EnemyKill
    roomID string
}

func snapshotEnemyKills(room *game.Room) map[string]enemyBeforeKill {
    result := map[string]enemyBeforeKill{}
    if room == nil || room.Run == nil { return result }
    for roomID, dungeonRoom := range room.Run.Rooms {
        if dungeonRoom == nil || dungeonRoom.Encounter == nil { continue }
        for _, enemy := range dungeonRoom.Encounter.Enemies {
            key := enemy.DefinitionID
            if key == "" { key = enemy.SpriteID }
            if key == "" { key = strings.ToLower(strings.TrimSpace(enemy.Name)) }
            theme := dungeonRoom.ThemeID
            if theme == "" { theme = room.Run.ThemeID }
            elite := dungeonRoom.RoomType == "boss" || dungeonRoom.RoomType == "miniboss" || dungeonRoom.RoomType == "lair"
            result[roomID+":"+enemy.ID] = enemyBeforeKill{
                health: enemy.Health, roomID: roomID,
                kill: store.EnemyKill{EnemyKey: key, Name: enemy.Name, ThemeID: theme, SpriteID: enemy.SpriteID, Elite: elite},
            }
        }
    }
    return result
}

// awardNewEnemyKills runs only after the room transition has been persisted.
// The profile repository deduplicates each enemy instance, so retries and
// reconnects cannot inflate lifetime kill counts.
func (h *Handler) awardNewEnemyKills(ctx context.Context, room *game.Room, before map[string]enemyBeforeKill) error {
    if room == nil || room.Run == nil { return nil }
    bestiary, ok := h.rooms.(store.BestiaryRepository)
    if !ok { return nil }
    after := snapshotEnemyKills(room)
    for key, previous := range before {
        current, exists := after[key]
        if !exists || previous.health <= 0 || current.health > 0 { continue }
        roomID := previous.roomID
        enemyID := strings.TrimPrefix(key, roomID+":")
        for _, playerID := range room.PlayerIDs {
            if room.Presence[playerID].LeftAt != nil { continue }
            profileID := room.PlayerProfileIDs[playerID]
            if profileID == "" { continue }
            if err := bestiary.RecordEnemyKill(ctx, profileID, room.Run.ID, enemyID, previous.kill, h.now().UTC()); err != nil {
                return err
            }
        }
    }
    return nil
}
