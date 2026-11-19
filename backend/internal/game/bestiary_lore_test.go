package game

import "testing"

func TestEveryMonsterCatalogEntryHasAuthoredBestiaryBackstory(t *testing.T) {
	for id, monster := range defaultMonsterCatalog.Monsters {
		spriteID := monster.Sprite.String()
		if lore := BestiaryBackstory(spriteID); lore == "" {
			t.Errorf("monster %q (%s) has no authored bestiary backstory", id, spriteID)
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
