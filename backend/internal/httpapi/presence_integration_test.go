package httpapi

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/swarkentin/heart-of-the-beast/backend/internal/store"
	"github.com/swarkentin/heart-of-the-beast/backend/migrations"
)

// TestPostgresPlayerPresenceLifecycle exercises the public HTTP contract against
// PostgreSQL. CI supplies an isolated service database; local runs can opt in
// with TEST_DATABASE_URL. Time is injected so disconnect transitions are instant.
func TestPostgresPlayerPresenceLifecycle(t *testing.T) {
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
	// A second application must be a no-op, matching overlapping Render startups.
	if err := migrations.Apply(t.Context(), db); err != nil {
		t.Fatalf("reapply embedded migrations: %v", err)
	}

	now := time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC)
	handler := NewHandlerWithClock(store.NewPostgres(db), func() time.Time { return now })
	request := func(method, path, token string, body []byte) *httptest.ResponseRecorder {
		recorder := httptest.NewRecorder()
		req := httptest.NewRequest(method, path, bytes.NewReader(body))
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		handler.ServeHTTP(recorder, req)
		return recorder
	}

	created := request(http.MethodPost, "/rooms", "", nil)
	if created.Code != http.StatusCreated {
		t.Fatalf("create room: %d %s", created.Code, created.Body.String())
	}
	var host struct {
		Room struct {
			ID   string `json:"id"`
			Code string `json:"code"`
		} `json:"room"`
		PlayerToken    string `json:"playerToken"`
		SpectatorToken string `json:"spectatorToken"`
	}
	if err := json.Unmarshal(created.Body.Bytes(), &host); err != nil {
		t.Fatal(err)
	}
	if host.Room.ID == "" || host.PlayerToken == "" || host.SpectatorToken == "" {
		t.Fatal("create response omitted room credentials")
	}
	defer db.Exec("DELETE FROM rooms WHERE id = $1", host.Room.ID)

	joinBody, _ := json.Marshal(map[string]string{"code": host.Room.Code})
	joined := request(http.MethodPost, "/rooms/join", "", joinBody)
	if joined.Code != http.StatusCreated {
		t.Fatalf("join room: %d %s", joined.Code, joined.Body.String())
	}
	var guest struct {
		PlayerID    string `json:"playerId"`
		PlayerToken string `json:"playerToken"`
	}
	if err := json.Unmarshal(joined.Body.Bytes(), &guest); err != nil {
		t.Fatal(err)
	}
	if guest.PlayerID == "" || guest.PlayerToken == "" {
		t.Fatal("join response omitted guest credentials")
	}

	readPresence := func(recorder *httptest.ResponseRecorder) map[string]playerPresenceResponse {
		t.Helper()
		var snapshot roomResponse
		if err := json.Unmarshal(recorder.Body.Bytes(), &snapshot); err != nil {
			t.Fatal(err)
		}
		return snapshot.Presence
	}
	snapshot := request(http.MethodGet, "/rooms/"+host.Room.ID, host.PlayerToken, nil)
	if snapshot.Code != http.StatusOK {
		t.Fatalf("initial snapshot: %d %s", snapshot.Code, snapshot.Body.String())
	}
	presence := readPresence(snapshot)
	if presence[guest.PlayerID].Status != "online" {
		t.Fatalf("guest should start online, got %q", presence[guest.PlayerID].Status)
	}

	// Keep the host alive while advancing beyond the guest's heartbeat timeout.
	now = now.Add(presenceTimeout + time.Second)
	if heartbeat := request(http.MethodPost, "/rooms/"+host.Room.ID+"/heartbeat", host.PlayerToken, nil); heartbeat.Code != http.StatusOK {
		t.Fatalf("host heartbeat: %d %s", heartbeat.Code, heartbeat.Body.String())
	}
	snapshot = request(http.MethodGet, "/rooms/"+host.Room.ID, host.PlayerToken, nil)
	presence = readPresence(snapshot)
	if presence[guest.PlayerID].Status != "disconnected" {
		t.Fatalf("guest should be disconnected after timeout, got %q", presence[guest.PlayerID].Status)
	}

	// The same guest credentials restore presence; no new identity is created.
	reconnected := request(http.MethodPost, "/rooms/"+host.Room.ID+"/heartbeat", guest.PlayerToken, nil)
	if reconnected.Code != http.StatusOK {
		t.Fatalf("guest reconnect heartbeat: %d %s", reconnected.Code, reconnected.Body.String())
	}
	presence = readPresence(reconnected)
	if presence[guest.PlayerID].Status != "online" {
		t.Fatalf("guest should return online, got %q", presence[guest.PlayerID].Status)
	}

	// Spectator access remains independent and read-only.
	spectated := request(http.MethodGet, "/spectate/"+host.Room.ID, host.SpectatorToken, nil)
	if spectated.Code != http.StatusOK {
		t.Fatalf("spectator snapshot: %d %s", spectated.Code, spectated.Body.String())
	}
	if _, exists := readPresence(spectated)[guest.PlayerID]; !exists {
		t.Fatal("spectator snapshot should include party presence")
	}
	command := request(http.MethodPost, "/rooms/"+host.Room.ID+"/commands", host.SpectatorToken, []byte(`{"type":"combat","action":"attack","targetId":"sentinel"}`))
	if command.Code != http.StatusUnauthorized {
		t.Fatalf("spectator command should be rejected, got %d", command.Code)
	}

	left := request(http.MethodPost, "/rooms/"+host.Room.ID+"/leave", guest.PlayerToken, nil)
	if left.Code != http.StatusOK {
		t.Fatalf("guest leave: %d %s", left.Code, left.Body.String())
	}
	if status := readPresence(left)[guest.PlayerID].Status; status != "left" {
		t.Fatalf("guest should be left, got %q", status)
	}
	if revoked := request(http.MethodPost, "/rooms/"+host.Room.ID+"/heartbeat", guest.PlayerToken, nil); revoked.Code != http.StatusUnauthorized {
		t.Fatalf("left guest token should be revoked, got %d", revoked.Code)
	}

	// Reload through a fresh handler to prove leave state and token revocation
	// were persisted, then verify the freed lobby slot can be reused.
	reloaded := NewHandlerWithClock(store.NewPostgres(db), func() time.Time { return now })
	persisted := httptest.NewRecorder()
	get := httptest.NewRequest(http.MethodGet, "/rooms/"+host.Room.ID, nil)
	get.Header.Set("Authorization", "Bearer "+host.PlayerToken)
	reloaded.ServeHTTP(persisted, get)
	if persisted.Code != http.StatusOK {
		t.Fatalf("reload room: %d %s", persisted.Code, persisted.Body.String())
	}
	var persistedSnapshot roomResponse
	if err := json.Unmarshal(persisted.Body.Bytes(), &persistedSnapshot); err != nil {
		t.Fatal(err)
	}
	if persistedSnapshot.Presence[guest.PlayerID].Status != "left" {
		t.Fatalf("left state was not persisted: %+v", persistedSnapshot.Presence[guest.PlayerID])
	}
	replacement := request(http.MethodPost, "/rooms/join", "", joinBody)
	if replacement.Code != http.StatusCreated {
		t.Fatalf("freed slot should accept a replacement: %d %s", replacement.Code, replacement.Body.String())
	}
}

func TestPostgresGuestProfilePersistsAcrossHandlers(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set TEST_DATABASE_URL to run PostgreSQL integration tests")
	}
	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		t.Fatalf("connect to integration database: %v", err)
	}
	if err := migrations.Apply(t.Context(), db); err != nil {
		t.Fatalf("apply embedded migrations: %v", err)
	}

	credential := "0123456789abcdef0123456789abcdef"
	hash := tokenHash(credential)
	defer db.Exec("DELETE FROM player_profiles WHERE credential_hash = $1", hash)
	handler := NewHandler(store.NewPostgres(db))
	request := func(target http.Handler, method string) *httptest.ResponseRecorder {
		recorder := httptest.NewRecorder()
		req := httptest.NewRequest(method, "/profile", nil)
		req.Header.Set("Authorization", "Bearer "+credential)
		target.ServeHTTP(recorder, req)
		return recorder
	}
	created := request(handler, http.MethodPost)
	if created.Code != http.StatusOK {
		t.Fatalf("create profile: %d %s", created.Code, created.Body.String())
	}
	var first store.Profile
	if err := json.Unmarshal(created.Body.Bytes(), &first); err != nil {
		t.Fatal(err)
	}
	restartedHandler := NewHandler(store.NewPostgres(db))
	loaded := request(restartedHandler, http.MethodGet)
	if loaded.Code != http.StatusOK {
		t.Fatalf("load profile after handler restart: %d %s", loaded.Code, loaded.Body.String())
	}
	var second store.Profile
	if err := json.Unmarshal(loaded.Body.Bytes(), &second); err != nil {
		t.Fatal(err)
	}
	if first.ID != second.ID || second.AdventurerLevel != 1 {
		t.Fatalf("profile did not persist: first=%+v second=%+v", first, second)
	}
}

func TestPostgresRunProgressionAwardIsIdempotent(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set TEST_DATABASE_URL to run PostgreSQL integration tests")
	}
	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		t.Fatalf("connect to integration database: %v", err)
	}
	if err := migrations.Apply(t.Context(), db); err != nil {
		t.Fatalf("apply embedded migrations: %v", err)
	}

	profiles := store.NewPostgres(db)
	credentialHash := tokenHash("0123456789abcdef0123456789abcdef")
	profile, err := profiles.GetOrCreateProfile(t.Context(), "progression-test-profile", credentialHash, time.Now().UTC())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Exec("DELETE FROM player_profiles WHERE id = $1", profile.ID)

	for i := 0; i < 2; i++ {
		if _, err := profiles.AwardRunXP(t.Context(), profile.ID, "progression-test-run", "player-1", "ranger", 50, time.Now().UTC()); err != nil {
			t.Fatalf("award attempt %d: %v", i+1, err)
		}
	}
	updated, err := profiles.GetProfile(t.Context(), credentialHash)
	if err != nil {
		t.Fatal(err)
	}
	if updated.AdventurerXP != 50 || updated.ClassMastery["ranger"].Experience != 50 {
		t.Fatalf("duplicate run award changed progression more than once: %+v", updated)
	}
}

func TestPostgresProgressionAwardsPersistMilestoneUnlocks(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set TEST_DATABASE_URL to run PostgreSQL integration tests")
	}
	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		t.Fatalf("connect to integration database: %v", err)
	}
	if err := migrations.Apply(t.Context(), db); err != nil {
		t.Fatalf("apply embedded migrations: %v", err)
	}

	profiles := store.NewPostgres(db)
	credentialHash := tokenHash("profile-reward-integration-credential")
	profile, err := profiles.GetOrCreateProfile(t.Context(), "profile-reward-integration", credentialHash, time.Now().UTC())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Exec("DELETE FROM player_profiles WHERE id = $1", profile.ID)

	for _, runID := range []string{"reward-run-one", "reward-run-two", "reward-run-three", "reward-run-four"} {
		if _, err := profiles.AwardRunXP(t.Context(), profile.ID, runID, "player-1", "ranger", 30, time.Now().UTC()); err != nil {
			t.Fatalf("award %s: %v", runID, err)
		}
	}
	updated, err := profiles.GetProfile(t.Context(), credentialHash)
	if err != nil {
		t.Fatal(err)
	}
	if updated.AdventurerLevel != 2 || updated.ClassMastery["ranger"].Level != 2 {
		t.Fatalf("profile and class mastery should reach rank two: %+v", updated)
	}
	unlocked := make(map[string]bool, len(updated.UnlockedCosmetics))
	for _, id := range updated.UnlockedCosmetics {
		unlocked[id] = true
	}
	if !unlocked["title.catacomb-wayfinder"] || !unlocked["title.mastery.ranger"] || len(unlocked) != 2 {
		t.Fatalf("expected two persistent milestone rewards, got %#v", updated.UnlockedCosmetics)
	}
}
