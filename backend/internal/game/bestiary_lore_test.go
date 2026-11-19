package game

import (
	"testing"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/art"
)

func TestEveryMonsterSpriteHasAuthoredBestiaryBackstory(t *testing.T) {
	for _, sprite := range art.Sprites() {
		if lore := BestiaryBackstory(sprite.ID.String()); lore == "" {
			t.Errorf("sprite %q (%s) has no authored bestiary backstory", sprite.ID.String(), sprite.Name)
		}
	}
}

func TestBestiaryBackstoryIsStableAndSpecific(t *testing.T) {
	first := BestiaryBackstory("catacombs/drowned_scout")
	if first == "" {
		t.Fatal("expected drowned scout backstory")
	}
	if first == BestiaryBackstory("catacombs/skeleton_sentinel") {
		t.Fatal("different creatures should not share a backstory")
	}
	if BestiaryBackstory("unknown/creature") != "" {
		t.Fatal("unknown sprite should not receive fabricated lore")
	}
}
