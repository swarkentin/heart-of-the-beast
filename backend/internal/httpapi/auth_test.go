package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/store"
)

// fakeDiscord answers the token exchange and user lookup. Each authorization
// code maps to a Discord user ID.
func fakeDiscord(t *testing.T, users map[string]string) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/oauth2/token":
			id, secret, _ := r.BasicAuth()
			if id != "client" || secret != "secret" {
				http.Error(w, "bad client", http.StatusUnauthorized)
				return
			}
			_ = r.ParseForm()
			userID, ok := users[r.PostForm.Get("code")]
			if !ok || r.PostForm.Get("redirect_uri") != "https://game.test/auth/discord/callback" {
				http.Error(w, `{"error":"invalid_grant"}`, http.StatusBadRequest)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]string{"access_token": "token-" + userID, "token_type": "Bearer"})
		case "/users/@me":
			userID := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer token-")
			_ = json.NewEncoder(w).Encode(map[string]string{"id": userID, "username": "user" + userID, "global_name": "Player " + userID})
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(server.Close)
	return server
}

type authHarness struct {
	t       *testing.T
	handler http.Handler
	repo    store.ProfileRepository
	now     time.Time
}

func newAuthHarness(t *testing.T, users map[string]string) *authHarness {
	return newAuthHarnessWith(t, store.NewMemory(), users)
}

func newAuthHarnessWith(t *testing.T, repo interface {
	store.Repository
	store.ProfileRepository
}, users map[string]string) *authHarness {
	discord := fakeDiscord(t, users)
	h := &authHarness{t: t, repo: repo, now: time.Date(2026, 11, 17, 12, 0, 0, 0, time.UTC)}
	h.handler = NewHandlerWithOptions(repo, Options{
		Now: func() time.Time { return h.now },
		Discord: &DiscordConfig{
			ClientID: "client", ClientSecret: "secret", RedirectURI: "https://game.test/auth/discord/callback",
			AuthorizeURL: "https://discord.test/authorize", APIBase: discord.URL,
		},
	})
	return h
}

func (h *authHarness) call(method, path, credential string, body any) (int, map[string]any) {
	h.t.Helper()
	var reader *bytes.Reader
	if body != nil {
		encoded, _ := json.Marshal(body)
		reader = bytes.NewReader(encoded)
	} else {
		reader = bytes.NewReader(nil)
	}
	req := httptest.NewRequest(method, path, reader)
	if credential != "" {
		req.Header.Set("Authorization", "Bearer "+credential)
	}
	res := httptest.NewRecorder()
	h.handler.ServeHTTP(res, req)
	var payload map[string]any
	_ = json.Unmarshal(res.Body.Bytes(), &payload)
	return res.Code, payload
}

func (h *authHarness) guest(credential string) string {
	h.t.Helper()
	code, profile := h.call(http.MethodPost, "/profile", credential, nil)
	if code != http.StatusOK {
		h.t.Fatalf("create guest: %d %v", code, profile)
	}
	return profile["id"].(string)
}

// start begins a sign-in and returns the state Discord would echo back.
func (h *authHarness) start(credential string) string {
	h.t.Helper()
	code, body := h.call(http.MethodPost, "/auth/discord/start", credential, nil)
	if code != http.StatusOK {
		h.t.Fatalf("start sign-in: %d %v", code, body)
	}
	parsed, err := url.Parse(body["url"].(string))
	if err != nil {
		h.t.Fatal(err)
	}
	query := parsed.Query()
	if query.Get("client_id") != "client" || query.Get("scope") != "identify" || query.Get("redirect_uri") != "https://game.test/auth/discord/callback" {
		h.t.Fatalf("unexpected authorize URL: %s", parsed)
	}
	return query.Get("state")
}

func (h *authHarness) complete(credential, discordCode, state string) (int, map[string]any) {
	return h.call(http.MethodPost, "/auth/discord/complete", credential, map[string]string{"code": discordCode, "state": state})
}

func credentialOf(seed string) string { return strings.Repeat(seed, 64/len(seed)) }

func TestDiscordSignInIsDisabledWithoutConfiguration(t *testing.T) {
	handler := NewHandler(store.NewMemory())
	req := httptest.NewRequest(http.MethodGet, "/auth/providers", nil)
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	if res.Code != http.StatusOK || !strings.Contains(res.Body.String(), `"providers":[]`) {
		t.Fatalf("providers: %d %s", res.Code, res.Body.String())
	}
	req = httptest.NewRequest(http.MethodPost, "/auth/discord/start", nil)
	req.Header.Set("Authorization", "Bearer "+credentialOf("a"))
	res = httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	if res.Code != http.StatusNotFound {
		t.Fatalf("start without config: %d", res.Code)
	}
}

func TestDiscordSignInLinksThenSwitchesOtherDevices(t *testing.T) {
	h := newAuthHarness(t, map[string]string{"code-1": "111", "code-2": "111", "code-3": "111"})
	if code, body := h.call(http.MethodGet, "/auth/providers", "", nil); code != http.StatusOK || len(body["providers"].([]any)) != 1 {
		t.Fatalf("providers: %d %v", code, body)
	}

	// Device A: first sign-in links its guest profile to the Discord account.
	deviceA := credentialOf("a")
	profileA := h.guest(deviceA)
	code, body := h.complete(deviceA, "code-1", h.start(deviceA))
	if code != http.StatusOK || body["status"] != "linked" {
		t.Fatalf("first sign-in: %d %v", code, body)
	}
	_, loaded := h.call(http.MethodGet, "/profile", deviceA, nil)
	accounts := loaded["accounts"].([]any)
	if len(accounts) != 1 || accounts[0].(map[string]any)["provider"] != "discord" || accounts[0].(map[string]any)["username"] != "Player 111" {
		t.Fatalf("linked accounts not shown: %v", loaded["accounts"])
	}

	// Signing in again on the same device is a no-op.
	if code, body := h.complete(deviceA, "code-2", h.start(deviceA)); code != http.StatusOK || body["status"] != "linked" {
		t.Fatalf("repeat sign-in: %d %v", code, body)
	}

	// Device B has a fresh guest profile with no progress: it switches silently.
	deviceB := credentialOf("b")
	if h.guest(deviceB) == profileA {
		t.Fatal("devices started with the same profile")
	}
	code, body = h.complete(deviceB, "code-3", h.start(deviceB))
	if code != http.StatusOK || body["status"] != "switched" {
		t.Fatalf("second device: %d %v", code, body)
	}
	newCredential := body["credential"].(string)
	if body["profile"].(map[string]any)["id"] != profileA {
		t.Fatalf("switched to the wrong profile: %v", body["profile"])
	}
	// The new credential resumes the account's profile, including via POST /profile.
	for _, method := range []string{http.MethodGet, http.MethodPost} {
		if code, resumed := h.call(method, "/profile", newCredential, nil); code != http.StatusOK || resumed["id"] != profileA {
			t.Fatalf("%s /profile with switched credential: %d %v", method, code, resumed)
		}
	}
}

func TestDiscordSignInAsksBeforeReplacingLocalProgress(t *testing.T) {
	h := newAuthHarness(t, map[string]string{"link": "222", "try-1": "222", "try-2": "222"})
	deviceA := credentialOf("a")
	profileA := h.guest(deviceA)
	if code, body := h.complete(deviceA, "link", h.start(deviceA)); body["status"] != "linked" {
		t.Fatalf("link: %d %v", code, body)
	}

	// Device B has earned XP as a guest.
	deviceB := credentialOf("b")
	profileB := h.guest(deviceB)
	if _, err := h.repo.AwardRunXP(context.Background(), profileB, "run-1", "player-1", "warden", 40, h.now); err != nil {
		t.Fatal(err)
	}

	state := h.start(deviceB)
	code, body := h.complete(deviceB, "try-1", state)
	if code != http.StatusOK || body["status"] != "conflict" || body["credential"] != nil {
		t.Fatalf("expected conflict: %d %v", code, body)
	}
	local := body["local"].(map[string]any)
	if local["adventurerXp"].(float64) != 40 || local["linked"] != false {
		t.Fatalf("local summary: %v", local)
	}

	// Abort keeps device B's guest profile and links nothing.
	if code, body := h.call(http.MethodPost, "/auth/discord/resolve", deviceB, map[string]string{"state": state, "choice": "abort"}); code != http.StatusOK || body["status"] != "aborted" {
		t.Fatalf("abort: %d %v", code, body)
	}
	_, stillGuest := h.call(http.MethodGet, "/profile", deviceB, nil)
	if stillGuest["id"] != profileB || len(stillGuest["accounts"].([]any)) != 0 {
		t.Fatalf("abort changed the profile: %v", stillGuest)
	}
	// The aborted state cannot be reused.
	if code, _ := h.call(http.MethodPost, "/auth/discord/resolve", deviceB, map[string]string{"state": state, "choice": "use-account"}); code != http.StatusBadRequest {
		t.Fatalf("reused state: %d", code)
	}

	// Trying again and choosing the account switches device B to profile A.
	state = h.start(deviceB)
	if _, body := h.complete(deviceB, "try-2", state); body["status"] != "conflict" {
		t.Fatalf("second attempt: %v", body)
	}
	// Another browser cannot resolve this device's sign-in.
	if code, _ := h.call(http.MethodPost, "/auth/discord/resolve", deviceA, map[string]string{"state": state, "choice": "use-account"}); code != http.StatusBadRequest {
		t.Fatalf("foreign resolve: %d", code)
	}
	code, body = h.call(http.MethodPost, "/auth/discord/resolve", deviceB, map[string]string{"state": state, "choice": "use-account"})
	if code != http.StatusOK || body["status"] != "switched" || body["profile"].(map[string]any)["id"] != profileA {
		t.Fatalf("use account: %d %v", code, body)
	}
}

func TestDiscordSignInRejectsForeignExpiredAndBadStates(t *testing.T) {
	h := newAuthHarness(t, map[string]string{"good": "333"})
	deviceA, deviceB := credentialOf("a"), credentialOf("b")
	h.guest(deviceA)
	h.guest(deviceB)

	state := h.start(deviceA)
	if code, _ := h.complete(deviceB, "good", state); code != http.StatusBadRequest {
		t.Fatalf("state used by another browser: %d", code)
	}
	if code, _ := h.complete(deviceA, "good", "not-a-real-state-not-a-real-state-0000"); code != http.StatusBadRequest {
		t.Fatalf("unknown state: %d", code)
	}
	if code, _ := h.complete(deviceA, "unknown-code", state); code != http.StatusBadRequest {
		t.Fatalf("rejected code: %d", code)
	}
	// A rejected code consumes the state.
	if code, _ := h.complete(deviceA, "good", state); code != http.StatusBadRequest {
		t.Fatalf("state reused after rejection: %d", code)
	}

	state = h.start(deviceA)
	h.now = h.now.Add(signInLifetime + time.Second)
	if code, _ := h.complete(deviceA, "good", state); code != http.StatusBadRequest {
		t.Fatalf("expired state: %d", code)
	}
	if code, _ := h.call(http.MethodPost, "/auth/discord/start", "short", nil); code != http.StatusUnauthorized {
		t.Fatalf("missing credential: %d", code)
	}
}
