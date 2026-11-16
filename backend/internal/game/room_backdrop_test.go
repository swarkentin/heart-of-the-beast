package game

import (
	"image/png"
	"os"
	"path/filepath"
	"testing"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/art"
)

// This table is the spec the frontend mirrors in frontend/src/scenes/backdrop.ts.
func TestRoomBackdropKindRule(t *testing.T) {
	for _, tc := range []struct {
		id, roomType string
		want         art.RoomKind
	}{
		{"entry", "encounter", art.RoomKindEntry},
		{"d2-entry", "encounter", art.RoomKindEntry},
		{"left", "encounter", art.RoomKindCorridor},
		{"d1-guard", "encounter", art.RoomKindCorridor},
		{"shrine", "event", art.RoomKindEvent},
		{"d3-shrine", "event", art.RoomKindEvent},
		{"warden", "boss", art.RoomKindBoss},
		{"d1-miniboss", "miniboss", art.RoomKindBoss},
		{"reliquary", "reward", art.RoomKindVault},
		{"mystery", "", art.RoomKindCorridor},
	} {
		if got := RoomBackdropKind(&DungeonRoom{ID: tc.id, RoomType: tc.roomType}); got != tc.want {
			t.Errorf("room %q (%q): kind %s, want %s", tc.id, tc.roomType, got, tc.want)
		}
	}
}

// Every room of every playable theme's floors, and of the authored Catacombs start, resolves to a backdrop in the
// art registry whose PNG files exist and are the documented size. A template or topology change that introduces a
// kind of room without a background fails here.
func TestEveryPlayableRoomHasABackdrop(t *testing.T) {
	artRoot := filepath.Join("..", "..", "..", "frontend", "public", "art", "rooms")
	checked := map[string]bool{}
	check := func(themeID string, room *DungeonRoom) {
		theme, err := defaultDungeonThemeCatalog.Theme(themeID)
		if err != nil {
			t.Fatal(err)
		}
		if room.ThemeID != "" && room.ThemeID != themeID {
			t.Errorf("room %s has themeId %q in a %q run", room.ID, room.ThemeID, themeID)
		}
		kind := RoomBackdropKind(room)
		backdrop, ok := art.BackdropFor(theme.Art, kind)
		if !ok {
			t.Errorf("room %s of theme %s is a %s room with no backdrop", room.ID, themeID, kind)
			return
		}
		for _, file := range []string{backdrop.First, backdrop.Cinema} {
			if checked[file] {
				continue
			}
			checked[file] = true
			f, err := os.Open(filepath.Join(artRoot, file))
			if err != nil {
				t.Errorf("backdrop %s: %v (run `npm run art:rooms`)", file, err)
				continue
			}
			config, err := png.DecodeConfig(f)
			_ = f.Close()
			if err != nil || config.Width != 275 || config.Height != 155 {
				t.Errorf("backdrop %s: want a 275x155 PNG, got %dx%d (%v)", file, config.Width, config.Height, err)
			}
		}
	}
	for _, theme := range PlayableDungeonThemes() {
		for seed := uint64(1); seed <= 40; seed++ {
			for depth := 1; depth <= MaximumExpeditionDepth; depth++ {
				_, rooms := generateExpeditionFloor(theme.ID, seed, depth, MaximumExpeditionDepth, 2, nil)
				for _, room := range rooms {
					check(theme.ID, room)
				}
			}
		}
		if err := validateBackdrops(theme); err != nil {
			t.Error(err)
		}
	}
}
