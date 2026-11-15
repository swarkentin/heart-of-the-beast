package art

import (
	"encoding/json"
	"image/png"
	"os"
	"path/filepath"
	"testing"
)

// artRoot is the frontend directory the art pipeline writes to, relative to this package.
const artRoot = "../../../frontend/public/art/monsters"

type manifestFile struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Tagline   string `json:"tagline"`
	Creatures []struct {
		ID    string `json:"id"`
		Name  string `json:"name"`
		Tier  string `json:"tier"`
		Sheet string `json:"sheet"`
		Frame struct {
			W int `json:"w"`
			H int `json:"h"`
		} `json:"frame"`
	} `json:"creatures"`
}

type indexFile struct {
	Themes []struct {
		ID       string `json:"id"`
		Manifest string `json:"manifest"`
	} `json:"themes"`
}

func readJSON(t *testing.T, path string, into any) {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("%v (run `npm run art:build`)", err)
	}
	if err := json.Unmarshal(data, into); err != nil {
		t.Fatalf("%s: %v", path, err)
	}
}

// The generated Go registry must describe exactly the sprites the pipeline wrote to disk: same themes, same
// creatures, real PNG sheets whose size is six columns by five animation rows of the declared frame size.
func TestRegistryMatchesArtOnDisk(t *testing.T) {
	var index indexFile
	readJSON(t, filepath.Join(artRoot, "index.json"), &index)

	wantSprites := 0
	for _, entry := range index.Themes {
		var manifest manifestFile
		readJSON(t, filepath.Join(artRoot, entry.Manifest), &manifest)
		theme, ok := themeByID(manifest.ID)
		if !ok {
			t.Errorf("theme %q is on disk but missing from the Go registry (run `npm run art:build`)", manifest.ID)
			continue
		}
		if theme.Name != manifest.Name || theme.Tagline != manifest.Tagline {
			t.Errorf("theme %q: registry says %q/%q, manifest says %q/%q", manifest.ID, theme.Name, theme.Tagline, manifest.Name, manifest.Tagline)
		}
		for _, creature := range manifest.Creatures {
			wantSprites++
			sprite, ok := spriteByID(manifest.ID + "/" + creature.ID)
			if !ok {
				t.Errorf("sprite %s/%s is on disk but missing from the Go registry", manifest.ID, creature.ID)
				continue
			}
			if sprite.Theme != theme.ID || sprite.Name != creature.Name || sprite.Sheet != creature.Sheet || sprite.Boss != (creature.Tier == "boss") || sprite.FrameSize != creature.Frame.W || creature.Frame.W != creature.Frame.H {
				t.Errorf("sprite %s/%s: registry %+v disagrees with manifest %+v", manifest.ID, creature.ID, sprite, creature)
			}
			file, err := os.Open(filepath.Join(artRoot, creature.Sheet))
			if err != nil {
				t.Errorf("sprite %s/%s: %v", manifest.ID, creature.ID, err)
				continue
			}
			config, err := png.DecodeConfig(file)
			_ = file.Close()
			if err != nil {
				t.Errorf("sprite %s/%s: sheet is not a valid PNG: %v", manifest.ID, creature.ID, err)
				continue
			}
			if config.Width != 6*sprite.FrameSize || config.Height != 5*sprite.FrameSize {
				t.Errorf("sprite %s/%s: sheet is %dx%d, want %dx%d", manifest.ID, creature.ID, config.Width, config.Height, 6*sprite.FrameSize, 5*sprite.FrameSize)
			}
		}
	}
	if len(sprites) != wantSprites {
		t.Errorf("registry has %d sprites but %d are on disk (stale sprites_gen.go?)", len(sprites), wantSprites)
	}
	if len(themes) != len(index.Themes) {
		t.Errorf("registry has %d themes but %d are on disk", len(themes), len(index.Themes))
	}
}

func TestIdentifiersAreUniqueAndResolve(t *testing.T) {
	seen := map[SpriteID]bool{}
	for _, sprite := range sprites {
		if seen[sprite.ID] {
			t.Errorf("duplicate sprite %s", sprite.ID)
		}
		seen[sprite.ID] = true
		if sprite.ID.String() != sprite.Theme.String()+"/"+sprite.CreatureID {
			t.Errorf("sprite id %q does not match theme %q and creature %q", sprite.ID, sprite.Theme, sprite.CreatureID)
		}
		if !KnownTheme(sprite.Theme) || !Known(sprite.ID) {
			t.Errorf("sprite %s is not resolvable", sprite.ID)
		}
		if parsed, ok := ParseSprite(sprite.ID.String()); !ok || parsed != sprite.ID {
			t.Errorf("sprite %s does not round-trip through ParseSprite", sprite.ID)
		}
	}
}

func TestZeroAndForgedIDsAreUnknown(t *testing.T) {
	if Known(SpriteID{}) || KnownTheme(ThemeID{}) {
		t.Fatal("the zero ids must not resolve to art")
	}
	if _, ok := ParseSprite("catacombs/does_not_exist"); ok {
		t.Fatal("an unbuilt sprite must not parse")
	}
}

func themeByID(id string) (Theme, bool) {
	for _, theme := range themes {
		if theme.ID.id == id {
			return theme, true
		}
	}
	return Theme{}, false
}

func spriteByID(id string) (Sprite, bool) {
	for _, sprite := range sprites {
		if sprite.ID.id == id {
			return sprite, true
		}
	}
	return Sprite{}, false
}
