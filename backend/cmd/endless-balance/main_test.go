package main

import (
	"fmt"
	"testing"
)

func TestPartyCompositionsCoverAllSizesAndAreDeterministic(t *testing.T) {
	first := partyCompositions()
	second := partyCompositions()
	if len(first) != 126 {
		t.Fatalf("got %d compositions, want 126", len(first))
	}
	counts := map[int]int{}
	seen := map[string]bool{}
	for i, party := range first {
		if len(party) < 1 || len(party) > 4 {
			t.Fatalf("composition %d has invalid size %d", i, len(party))
		}
		key := fmt.Sprint(party)
		if seen[key] {
			t.Fatalf("duplicate composition %v", party)
		}
		seen[key] = true
		counts[len(party)]++
		if fmt.Sprint(party) != fmt.Sprint(second[i]) {
			t.Fatalf("composition generation is not deterministic at index %d", i)
		}
	}
	if counts[1] != 9 || counts[2] != 45 || counts[3] != 36 || counts[4] != 36 {
		t.Fatalf("unexpected composition distribution: %v", counts)
	}
}
