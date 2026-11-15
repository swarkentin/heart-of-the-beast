package game

import "testing"

func TestClassPassiveEffectCatalogValidatesAllAuthoredPassives(t *testing.T) {
	if err := ValidateClassPassiveEffectCatalog(classPassives, defaultClassPassiveEffectCatalog); err != nil {
		t.Fatalf("default class passive catalog should validate: %v", err)
	}
	if got, want := len(defaultClassPassiveEffectCatalog.Definitions), len(classPassives); got != want {
		t.Fatalf("catalog definitions = %d, want one for each of %d passives", got, want)
	}
}

func TestClassPassiveEffectCatalogRejectsInvalidDefinitions(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(*ClassPassiveEffectCatalog)
	}{
		{name: "duplicate ID", mutate: func(c *ClassPassiveEffectCatalog) { c.Definitions[1].EffectID = c.Definitions[0].EffectID }},
		{name: "unknown trigger", mutate: func(c *ClassPassiveEffectCatalog) { c.Definitions[1].Trigger = "on_sunrise" }},
		{name: "unknown bonus", mutate: func(c *ClassPassiveEffectCatalog) { c.Definitions[1].Bonus = "luck" }},
		{name: "missing intent kinds", mutate: func(c *ClassPassiveEffectCatalog) { c.Definitions[2].IntentKinds = nil }},
		{name: "invalid health threshold", mutate: func(c *ClassPassiveEffectCatalog) { c.Definitions[1].HealthThresholdPercent = 101 }},
		{name: "negative magnitude", mutate: func(c *ClassPassiveEffectCatalog) { c.Definitions[1].Amount = -1 }},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			catalog := newClassPassiveEffectCatalog()
			test.mutate(&catalog)
			if err := catalog.Validate(classPassives); err == nil {
				t.Fatal("invalid passive effect catalog should be rejected")
			}
		})
	}
}

func TestClassPassiveCatalogTriggerHelpersUseDefinitions(t *testing.T) {
	for _, test := range []struct {
		classID string
		trigger ClassPassiveTrigger
		want    bool
	}{
		{classID: ClassBulwark, trigger: ClassPassiveTriggerHeavyGuard, want: true},
		{classID: ClassBulwark, trigger: ClassPassiveTriggerCompanionInstinct, want: false},
		{classID: ClassBeastcaller, trigger: ClassPassiveTriggerCompanionInstinct, want: true},
	} {
		definition, ok := findClass(test.classID)
		if !ok {
			t.Fatalf("missing class %q", test.classID)
		}
		build, err := StartingBuildForClass(test.classID)
		if err != nil {
			t.Fatal(err)
		}
		player := newPlayerStateForClass("player-1", definition)
		player.ClassBuild = &build
		if got := classPassiveHasTrigger(player, test.trigger); got != test.want {
			t.Errorf("%s trigger %s = %t, want %t", test.classID, test.trigger, got, test.want)
		}
	}
}
