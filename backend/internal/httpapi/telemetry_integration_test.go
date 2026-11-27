package httpapi

import (
	"database/sql"
	"encoding/json"
	"os"
	"testing"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/swarkentin/heart-of-the-beast/backend/migrations"
)

func TestPostgresRunTelemetryCapturesVersionedSnapshotsAndTerminalRecord(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set TEST_DATABASE_URL to run PostgreSQL integration tests")
	}
	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(4)
	if err := db.Ping(); err != nil {
		t.Fatalf("connect to integration database: %v", err)
	}
	if err := migrations.Apply(t.Context(), db); err != nil {
		t.Fatalf("apply embedded migrations: %v", err)
	}

	const roomID = "telemetry-integration-room"
	const runID = "telemetry-integration-run"
	defer db.ExecContext(t.Context(), "DELETE FROM rooms WHERE id = $1", roomID)
	defer db.ExecContext(t.Context(), "DELETE FROM run_telemetry_runs WHERE run_id = $1", runID)
	defer db.ExecContext(t.Context(), "DELETE FROM run_telemetry_events WHERE run_id = $1", runID)

	started := time.Date(2026, 11, 20, 12, 0, 0, 0, time.UTC)
	ended := started.Add(90 * time.Second)
	run := map[string]any{
		"id": runID, "phase": "combat", "startedAt": started, "seed": 42,
		"themeId": "catacombs", "depth": 3, "floorsCleared": 2,
		"encountersCleared": 4, "players": map[string]any{"player-1": map[string]any{"level": 3}},
		"lastCombatEvents": []any{map[string]any{"kind": "hit", "amount": 7}},
	}
	state := map[string]any{
		"run":               run,
		"updatedAt":         started,
		"playerProfileIds":  map[string]string{"player-1": "pseudonymous-profile"},
		"playerClasses":     map[string]string{"player-1": "ranger"},
		"playerArchetypes":  map[string]string{"player-1": "scout"},
		"playerLoadouts":    map[string][]string{"player-1": {"skill.strike"}},
		"playerTokenHashes": map[string]string{"player-1": "must-not-be-copied"},
	}
	encoded, err := json.Marshal(state)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(t.Context(), `
		INSERT INTO rooms (id, code, version, state, created_at)
		VALUES ($1, $2, 0, $3::jsonb, $4)
	`, roomID, "TELEM1", encoded, started); err != nil {
		t.Fatalf("create room: %v", err)
	}

	// The first versioned update starts the run and creates its first snapshot.
	run["phase"] = "combat"
	state["run"] = run
	encoded, _ = json.Marshal(state)
	if _, err := db.ExecContext(t.Context(), "UPDATE rooms SET state = $2::jsonb, version = 1 WHERE id = $1", roomID, encoded); err != nil {
		t.Fatalf("record active snapshot: %v", err)
	}
	// A heartbeat-style update without a version increment must not create a telemetry event.
	state["updatedAt"] = started.Add(time.Second)
	encoded, _ = json.Marshal(state)
	if _, err := db.ExecContext(t.Context(), "UPDATE rooms SET state = $2::jsonb WHERE id = $1", roomID, encoded); err != nil {
		t.Fatal(err)
	}
	var events int
	if err := db.QueryRowContext(t.Context(), "SELECT count(*) FROM run_telemetry_events WHERE run_id = $1", runID).Scan(&events); err != nil {
		t.Fatal(err)
	}
	if events != 1 {
		t.Fatalf("expected one versioned snapshot, got %d", events)
	}

	run["phase"] = "completed"
	run["completedAt"] = ended
	state["run"] = run
	state["updatedAt"] = ended
	encoded, _ = json.Marshal(state)
	if _, err := db.ExecContext(t.Context(), "UPDATE rooms SET state = $2::jsonb, version = 2 WHERE id = $1", roomID, encoded); err != nil {
		t.Fatalf("record terminal snapshot: %v", err)
	}
	// A later versioned save of the terminal room must not create a second run record.
	if _, err := db.ExecContext(t.Context(), "UPDATE rooms SET version = 3 WHERE id = $1", roomID); err != nil {
		t.Fatal(err)
	}
	var records int
	var outcome string
	var durationMS int64
	var snapshot []byte
	if err := db.QueryRowContext(t.Context(), `
		SELECT count(*), max(outcome), max(duration_ms), max(run_snapshot::text)::jsonb
		FROM run_telemetry_runs WHERE run_id = $1
	`, runID).Scan(&records, &outcome, &durationMS, &snapshot); err != nil {
		t.Fatal(err)
	}
	if records != 1 || outcome != "completed" || durationMS != 90000 {
		t.Fatalf("unexpected terminal telemetry: records=%d outcome=%q duration=%d", records, outcome, durationMS)
	}
	if !json.Valid(snapshot) {
		t.Fatalf("terminal run snapshot is not valid JSON: %s", snapshot)
	}
	var payload string
	if err := db.QueryRowContext(t.Context(), "SELECT payload::text FROM run_telemetry_events WHERE run_id = $1 AND room_version = 1", runID).Scan(&payload); err != nil {
		t.Fatal(err)
	}
	// Token hashes are deliberately excluded from the telemetry projection.
	if containsText(payload, "must-not-be-copied") {
		t.Fatalf("event payload leaked a player token hash: %s", payload)
	}
}

func containsText(value, needle string) bool {
	for i := 0; i+len(needle) <= len(value); i++ {
		if value[i:i+len(needle)] == needle {
			return true
		}
	}
	return false
}
