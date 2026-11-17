package game

import (
	"fmt"
	"strings"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/art"
)

// RoomBackdropKind says which pixel-art background a room is shown against: the kind of room, not the room itself.
// The same rule is mirrored by frontend/src/scenes/backdrop.ts; room_backdrop_test.go pins the table both follow.
//
//	id ends in "entry"             -> entry     (the run's or floor's starting room)
//	roomType boss | miniboss       -> boss
//	roomType event                 -> event     (shrines, discoveries)
//	roomType reward                -> vault
//	anything else (encounter)      -> corridor
func RoomBackdropKind(room *DungeonRoom) art.RoomKind {
	switch {
	case strings.HasSuffix(room.ID, "entry"):
		return art.RoomKindEntry
	case room.RoomType == "boss" || room.RoomType == "miniboss" || room.RoomType == "lair":
		return art.RoomKindBoss
	case room.RoomType == "event":
		return art.RoomKindEvent
	case room.RoomType == "reward":
		return art.RoomKindVault
	default:
		return art.RoomKindCorridor
	}
}

// floorRoomKinds are the kinds generated floors produce; every playable theme needs a backdrop for each.
var floorRoomKinds = []art.RoomKind{art.RoomKindEntry, art.RoomKindCorridor, art.RoomKindEvent, art.RoomKindBoss, art.RoomKindVault}

// validateBackdrops checks that the theme has pixel-art backgrounds for every kind of room its floors contain.
func validateBackdrops(theme DungeonThemeDefinition) error {
	for _, kind := range floorRoomKinds {
		if _, ok := art.BackdropFor(theme.Art, kind); !ok {
			return fmt.Errorf("playable theme %q has no %s room background in the art registry", theme.ID, kind)
		}
	}
	return nil
}
