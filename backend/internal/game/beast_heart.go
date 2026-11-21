package game

// The Heart of the Beast (ADR 0040) is the shared objective behind every run. Its health is one pool for every
// party on the server and survives across runs; the server's store keeps it (store.BeastHeartRepository). The game
// only reports what a run did to it: each fight against the heart appends a HeartStrike, and the HTTP layer banks
// each strike once.
//
// The heart encounter itself (rarely in place of a dungeon boss, or forced by an expensive shop item, round-limited
// and unbeatable) is the next step; see ADR 0040. Until then no run records strikes.

// BeastHeartInitialHealth is the size of the shared pool when a server first starts. It lives in the store after
// that, so retuning it is a data change, not a deploy.
const BeastHeartInitialHealth int64 = 1_000_000

// HeartStrike is the damage one party dealt the heart in one fight before it withdrew.
type HeartStrike struct {
	EncounterID string `json:"encounterId"`
	Damage      int64  `json:"damage"`
}

// RecordHeartStrike notes a fight against the heart on the run, at most once per encounter.
func RecordHeartStrike(run *Run, encounterID string, damage int64) {
	if run == nil || encounterID == "" || damage <= 0 {
		return
	}
	for _, strike := range run.HeartStrikes {
		if strike.EncounterID == encounterID {
			return
		}
	}
	run.HeartStrikes = append(run.HeartStrikes, HeartStrike{EncounterID: encounterID, Damage: damage})
}
