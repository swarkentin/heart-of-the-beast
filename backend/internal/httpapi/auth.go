package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/store"
)

// Optional sign-in (ADR 0034). The browser keeps using its bearer profile
// credential for everything; signing in only decides which profile that
// credential points at. Profiles are never merged:
//
//   - a Discord account seen for the first time is linked to this device's
//     guest profile;
//   - a Discord account that already owns a profile replaces this device's
//     guest profile. If the guest profile has earned XP or mastery, the player
//     first chooses between keeping it (abort) and using the account.
const (
	providerDiscord = "discord"
	signInLifetime  = 10 * time.Minute
)

type accountSummary struct {
	DisplayName     string `json:"displayName"`
	AdventurerLevel int    `json:"adventurerLevel"`
	AdventurerXP    int64  `json:"adventurerXp"`
	// Linked is true when the profile is already attached to a sign-in, so
	// leaving this device does not lose it.
	Linked   bool   `json:"linked"`
	Username string `json:"username,omitempty"`
}

type signInResponse struct {
	// Status is "linked", "switched", "conflict" or "aborted".
	Status string `json:"status"`
	// Credential replaces the browser's profile credential when Status is
	// "switched".
	Credential string         `json:"credential,omitempty"`
	Profile    *store.Profile `json:"profile,omitempty"`
	// State, Local and Account describe a "conflict" the player must resolve.
	State   string          `json:"state,omitempty"`
	Local   *accountSummary `json:"local,omitempty"`
	Account *accountSummary `json:"account,omitempty"`
}

func authProviders(h *Handler) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		providers := []string{}
		if h.discord != nil {
			providers = append(providers, providerDiscord)
		}
		writeJSON(w, http.StatusOK, map[string][]string{"providers": providers})
	}
}

// accountStores returns the repositories sign-in needs, writing an error if
// sign-in is disabled or unsupported.
func (h *Handler) accountStores(w http.ResponseWriter) (store.ProfileRepository, store.AccountRepository, bool) {
	if h.discord == nil {
		writeError(w, http.StatusNotFound, "Discord sign-in is not enabled on this server")
		return nil, nil, false
	}
	profiles, okProfiles := h.rooms.(store.ProfileRepository)
	accounts, okAccounts := h.rooms.(store.AccountRepository)
	if !okProfiles || !okAccounts {
		writeError(w, http.StatusServiceUnavailable, "profile persistence is unavailable")
		return nil, nil, false
	}
	return profiles, accounts, true
}

func profileCredential(w http.ResponseWriter, r *http.Request) (string, bool) {
	credential := bearer(r)
	if len(credential) < 32 || len(credential) > 256 {
		writeError(w, http.StatusUnauthorized, "a valid guest profile credential is required")
		return "", false
	}
	return credential, true
}

// withAccounts attaches linked sign-ins to a profile response.
func (h *Handler) withAccounts(ctx context.Context, profile *store.Profile) *store.Profile {
	if profile.Accounts == nil {
		profile.Accounts = []store.LinkedAccount{}
	}
	accounts, ok := h.rooms.(store.AccountRepository)
	if !ok {
		return profile
	}
	linked, err := accounts.LinkedAccounts(ctx, profile.ID)
	if err != nil {
		slog.Warn("could not load linked accounts", "error", err)
		return profile
	}
	profile.Accounts = linked
	return profile
}

func (h *Handler) startDiscordSignIn(w http.ResponseWriter, r *http.Request) {
	profiles, accounts, ok := h.accountStores(w)
	if !ok {
		return
	}
	credential, ok := profileCredential(w, r)
	if !ok {
		return
	}
	if _, err := profiles.GetProfile(r.Context(), tokenHash(credential)); err != nil {
		writeError(w, http.StatusNotFound, "guest profile not found")
		return
	}
	state, err := randomToken(32)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not start sign-in")
		return
	}
	now := h.now().UTC()
	if err := accounts.SaveSignIn(r.Context(), store.SignIn{
		StateHash: tokenHash(state), Provider: providerDiscord, CredentialHash: tokenHash(credential), ExpiresAt: now.Add(signInLifetime),
	}, now); err != nil {
		writeError(w, http.StatusInternalServerError, "could not start sign-in")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"url": h.discord.AuthURL(state)})
}

// pendingSignIn loads a sign-in attempt and checks it belongs to the caller
// and is still live.
func (h *Handler) pendingSignIn(w http.ResponseWriter, r *http.Request, accounts store.AccountRepository, credential, state string) (*store.SignIn, bool) {
	if len(state) < 32 || len(state) > 256 {
		writeError(w, http.StatusBadRequest, "this sign-in link is invalid; start again")
		return nil, false
	}
	signIn, err := accounts.GetSignIn(r.Context(), tokenHash(state))
	if err != nil || signIn.Provider != providerDiscord || signIn.CredentialHash != tokenHash(credential) || !signIn.ExpiresAt.After(h.now()) {
		writeError(w, http.StatusBadRequest, "this sign-in has expired or belongs to another browser; start again")
		return nil, false
	}
	return signIn, true
}

func (h *Handler) completeDiscordSignIn(w http.ResponseWriter, r *http.Request) {
	profiles, accounts, ok := h.accountStores(w)
	if !ok {
		return
	}
	credential, ok := profileCredential(w, r)
	if !ok {
		return
	}
	var request struct {
		Code  string `json:"code"`
		State string `json:"state"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 8192)).Decode(&request); err != nil || request.Code == "" {
		writeError(w, http.StatusBadRequest, "a sign-in code and state are required")
		return
	}
	signIn, ok := h.pendingSignIn(w, r, accounts, credential, request.State)
	if !ok {
		return
	}
	if signIn.Subject != "" {
		writeError(w, http.StatusBadRequest, "this sign-in was already used; start again")
		return
	}
	user, err := h.discord.Identify(r.Context(), request.Code)
	if err != nil {
		_ = accounts.DeleteSignIn(r.Context(), signIn.StateHash)
		if errors.Is(err, errDiscordRejected) {
			writeError(w, http.StatusBadRequest, "Discord did not accept this sign-in; start again")
			return
		}
		slog.Warn("discord sign-in failed", "error", err)
		writeError(w, http.StatusBadGateway, "could not reach Discord; try again")
		return
	}

	guest, err := profiles.GetProfile(r.Context(), signIn.CredentialHash)
	if err != nil {
		writeError(w, http.StatusNotFound, "guest profile not found")
		return
	}
	accountProfileID, err := accounts.ProfileIDForIdentity(r.Context(), providerDiscord, user.ID)
	switch {
	case errors.Is(err, store.ErrNotFound):
		// First sign-in with this Discord account: it adopts this device's profile.
		_ = accounts.DeleteSignIn(r.Context(), signIn.StateHash)
		if err := accounts.LinkIdentity(r.Context(), providerDiscord, user.ID, user.displayName(), guest.ID, h.now()); err != nil {
			if errors.Is(err, store.ErrConflict) {
				writeError(w, http.StatusConflict, "this profile is already linked to a different Discord account")
				return
			}
			writeError(w, http.StatusInternalServerError, "could not link Discord account")
			return
		}
		writeJSON(w, http.StatusOK, signInResponse{Status: "linked", Profile: h.withAccounts(r.Context(), guest)})
		return
	case err != nil:
		writeError(w, http.StatusInternalServerError, "could not complete sign-in")
		return
	case accountProfileID == guest.ID:
		_ = accounts.DeleteSignIn(r.Context(), signIn.StateHash)
		writeJSON(w, http.StatusOK, signInResponse{Status: "linked", Profile: h.withAccounts(r.Context(), guest)})
		return
	}

	account, err := accounts.GetProfileByID(r.Context(), accountProfileID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load the account's profile")
		return
	}
	if !guest.HasProgress() {
		_ = accounts.DeleteSignIn(r.Context(), signIn.StateHash)
		h.switchToProfile(w, r, accounts, account)
		return
	}
	// This device has its own progress: let the player choose.
	if err := accounts.SetSignInIdentity(r.Context(), signIn.StateHash, user.ID, user.displayName()); err != nil {
		writeError(w, http.StatusInternalServerError, "could not complete sign-in")
		return
	}
	localLinked := len(h.withAccounts(r.Context(), guest).Accounts) > 0
	writeJSON(w, http.StatusOK, signInResponse{
		Status: "conflict",
		State:  request.State,
		Local:  &accountSummary{DisplayName: guest.DisplayName, AdventurerLevel: guest.AdventurerLevel, AdventurerXP: guest.AdventurerXP, Linked: localLinked},
		Account: &accountSummary{
			DisplayName: account.DisplayName, AdventurerLevel: account.AdventurerLevel, AdventurerXP: account.AdventurerXP,
			Linked: true, Username: user.displayName(),
		},
	})
}

// resolveDiscordSignIn finishes a conflicting sign-in: "abort" keeps this
// device's guest profile untouched, "use-account" switches the device to the
// account's profile and leaves the local guest progress behind.
func (h *Handler) resolveDiscordSignIn(w http.ResponseWriter, r *http.Request) {
	_, accounts, ok := h.accountStores(w)
	if !ok {
		return
	}
	credential, ok := profileCredential(w, r)
	if !ok {
		return
	}
	var request struct {
		State  string `json:"state"`
		Choice string `json:"choice"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&request); err != nil {
		writeError(w, http.StatusBadRequest, "a sign-in state and choice are required")
		return
	}
	if request.Choice != "abort" && request.Choice != "use-account" {
		writeError(w, http.StatusBadRequest, "choice must be abort or use-account")
		return
	}
	signIn, ok := h.pendingSignIn(w, r, accounts, credential, request.State)
	if !ok {
		return
	}
	if signIn.Subject == "" {
		writeError(w, http.StatusBadRequest, "this sign-in has nothing to resolve; start again")
		return
	}
	_ = accounts.DeleteSignIn(r.Context(), signIn.StateHash)
	if request.Choice == "abort" {
		writeJSON(w, http.StatusOK, signInResponse{Status: "aborted"})
		return
	}
	accountProfileID, err := accounts.ProfileIDForIdentity(r.Context(), providerDiscord, signIn.Subject)
	if err != nil {
		writeError(w, http.StatusConflict, "the Discord account is no longer linked; start again")
		return
	}
	account, err := accounts.GetProfileByID(r.Context(), accountProfileID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load the account's profile")
		return
	}
	h.switchToProfile(w, r, accounts, account)
}

// switchToProfile issues this device a new credential for the account's
// profile. The old guest credential and its profile are left as they are.
func (h *Handler) switchToProfile(w http.ResponseWriter, r *http.Request, accounts store.AccountRepository, profile *store.Profile) {
	credential, err := randomToken(32)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not sign in")
		return
	}
	if err := accounts.AddProfileCredential(r.Context(), profile.ID, tokenHash(credential), h.now()); err != nil {
		writeError(w, http.StatusInternalServerError, "could not sign in")
		return
	}
	writeJSON(w, http.StatusOK, signInResponse{Status: "switched", Credential: credential, Profile: h.withAccounts(r.Context(), profile)})
}
