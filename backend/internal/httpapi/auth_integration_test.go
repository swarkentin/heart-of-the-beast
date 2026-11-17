package httpapi

import (
	"database/sql"
	"net/http"
	"os"
	"testing"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/swarkentin/heart-of-the-beast/backend/internal/store"
	"github.com/swarkentin/heart-of-the-beast/backend/migrations"
)

// TestPostgresDiscordSignIn runs the sign-in flow against PostgreSQL so the
// credential, identity and sign-in tables are exercised (ADR 0034).
func TestPostgresDiscordSignIn(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set TEST_DATABASE_URL to run PostgreSQL integration tests")
	}
	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := migrations.Apply(t.Context(), db); err != nil {
		t.Fatalf("apply embedded migrations: %v", err)
	}

	// The database is shared between runs, so every identity is unique.
	random := func() string {
		value, err := randomToken(32)
		if err != nil {
			t.Fatal(err)
		}
		return value
	}
	discordUser := random()[:18]
	h := newAuthHarnessWith(t, store.NewPostgres(db), map[string]string{"link": discordUser, "again": discordUser, "switch": discordUser, "keep": discordUser, "take": discordUser})

	deviceA := random()
	profileA := h.guest(deviceA)
	if code, body := h.complete(deviceA, "link", h.start(deviceA)); code != http.StatusOK || body["status"] != "linked" {
		t.Fatalf("link: %d %v", code, body)
	}
	if code, body := h.complete(deviceA, "again", h.start(deviceA)); code != http.StatusOK || body["status"] != "linked" {
		t.Fatalf("repeat: %d %v", code, body)
	}
	_, loaded := h.call(http.MethodGet, "/profile", deviceA, nil)
	if accounts := loaded["accounts"].([]any); len(accounts) != 1 {
		t.Fatalf("accounts: %v", loaded["accounts"])
	}

	// A fresh device switches without asking; its new credential resumes the account.
	deviceB := random()
	h.guest(deviceB)
	code, body := h.complete(deviceB, "switch", h.start(deviceB))
	if code != http.StatusOK || body["status"] != "switched" {
		t.Fatalf("switch: %d %v", code, body)
	}
	switched := body["credential"].(string)
	for _, method := range []string{http.MethodPost, http.MethodGet} {
		if code, resumed := h.call(method, "/profile", switched, nil); code != http.StatusOK || resumed["id"] != profileA {
			t.Fatalf("%s resumed: %d %v", method, code, resumed)
		}
	}
	if code, renamed := h.call(http.MethodPatch, "/profile", switched, map[string]string{"displayName": "Shared"}); code != http.StatusOK || renamed["id"] != profileA {
		t.Fatalf("rename via switched credential: %d %v", code, renamed)
	}

	// A device with progress is asked first.
	deviceC := random()
	profileC := h.guest(deviceC)
	if _, err := h.repo.AwardRunXP(t.Context(), profileC, random(), "player-1", "warden", 25, h.now); err != nil {
		t.Fatal(err)
	}
	state := h.start(deviceC)
	if _, body := h.complete(deviceC, "keep", state); body["status"] != "conflict" {
		t.Fatalf("expected conflict: %v", body)
	}
	if _, body := h.call(http.MethodPost, "/auth/discord/resolve", deviceC, map[string]string{"state": state, "choice": "abort"}); body["status"] != "aborted" {
		t.Fatalf("abort: %v", body)
	}
	if _, kept := h.call(http.MethodGet, "/profile", deviceC, nil); kept["id"] != profileC {
		t.Fatalf("abort changed profile: %v", kept)
	}
	state = h.start(deviceC)
	if _, body := h.complete(deviceC, "take", state); body["status"] != "conflict" {
		t.Fatalf("expected conflict again: %v", body)
	}
	code, body = h.call(http.MethodPost, "/auth/discord/resolve", deviceC, map[string]string{"state": state, "choice": "use-account"})
	if code != http.StatusOK || body["status"] != "switched" || body["profile"].(map[string]any)["id"] != profileA {
		t.Fatalf("use account: %d %v", code, body)
	}
}
