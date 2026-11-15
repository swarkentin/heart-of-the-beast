package game

import "testing"

func TestDefaultRunEffectCatalogValidates(t *testing.T) {
	if err := defaultRunEffectCatalog.Validate(); err != nil {
		t.Fatalf("default run effect catalog is invalid: %v", err)
	}
	for _, id := range []string{"study_weakness", "rescue_archivist", "ember_charm", "stone_charm", "shrine_ward", "leave"} {
		if _, ok := defaultRunEffectCatalog.Effect(id); !ok {
			t.Errorf("missing run effect definition %q", id)
		}
	}
}

func TestRunEffectCatalogRejectsInvalidDefinitions(t *testing.T) {
	catalog := RunEffectCatalog{Definitions: []RunEffectDefinition{
		{ID: "bad", Kind: RunEffectPartyStrike, Amount: -1, FlagID: "bad"},
	}}
	if err := catalog.Validate(); err == nil {
		t.Fatal("expected negative effect amount to be rejected")
	}
	catalog = RunEffectCatalog{Definitions: []RunEffectDefinition{
		{ID: "duplicate", Kind: RunEffectNone},
		{ID: "duplicate", Kind: RunEffectNone},
	}}
	if err := catalog.Validate(); err == nil {
		t.Fatal("expected duplicate effect IDs to be rejected")
	}
}

func TestStudyWeaknessEffectProvidesWardenOnlyStrikeBonus(t *testing.T) {
	run := &Run{Flags: map[string]bool{}}
	if got := defaultRunEffectCatalog.StrikeBonus(run, "warden"); got != 0 {
		t.Fatalf("unearned Warden bonus = %d, want 0", got)
	}
	if !applyRoomEventEffect(&Room{Run: run}, "study_weakness") {
		t.Fatal("study weakness effect should resolve")
	}
	if got := defaultRunEffectCatalog.StrikeBonus(run, "warden"); got != 2 {
		t.Fatalf("Warden bonus = %d, want 2", got)
	}
	if got := defaultRunEffectCatalog.StrikeBonus(run, "entry"); got != 0 {
		t.Fatalf("bonus outside Warden room = %d, want 0", got)
	}
}
