package art

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

const roomsRoot = "../../../frontend/public/art/rooms"

// Every art theme has a backdrop for every room kind, and the registry matches the manifests on disk.
func TestBackdropRegistryIsCompleteAndMatchesDisk(t *testing.T) {
	if len(RoomKinds()) == 0 {
		t.Fatal("no room kinds generated (run `npm run art:rooms`)")
	}
	for _, theme := range Themes() {
		var manifest struct {
			Backdrops []struct{ Kind, First, Cinema string } `json:"backdrops"`
		}
		data, err := os.ReadFile(filepath.Join(roomsRoot, theme.ID.String(), "manifest.json"))
		if err != nil {
			t.Fatalf("theme %s: %v (run `npm run art:rooms`)", theme.ID, err)
		}
		if err := json.Unmarshal(data, &manifest); err != nil {
			t.Fatal(err)
		}
		if len(manifest.Backdrops) != len(RoomKinds()) {
			t.Errorf("theme %s: manifest lists %d backdrops, registry has %d kinds", theme.ID, len(manifest.Backdrops), len(RoomKinds()))
		}
		for _, kind := range RoomKinds() {
			backdrop, ok := BackdropFor(theme.ID, kind)
			if !ok {
				t.Errorf("theme %s has no %s backdrop", theme.ID, kind)
				continue
			}
			for _, file := range []string{backdrop.First, backdrop.Cinema} {
				if _, err := os.Stat(filepath.Join(roomsRoot, file)); err != nil {
					t.Errorf("backdrop %s: %v", file, err)
				}
			}
		}
	}
	if len(Backdrops()) != len(Themes())*len(RoomKinds()) {
		t.Errorf("registry has %d backdrops, want %d themes x %d kinds", len(Backdrops()), len(Themes()), len(RoomKinds()))
	}
	if _, ok := BackdropFor(ThemeID{}, RoomKindEntry); ok {
		t.Error("a forged theme id must not resolve to a backdrop")
	}
	if _, ok := ParseRoomKind("throne-room"); ok {
		t.Error("an unknown kind must not parse")
	}
}
