package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

// DiscordConfig enables optional "Sign in with Discord" (ADR 0034). Sign-in is
// off unless the client ID, secret and redirect URI are all configured, so a
// self-hosted server stays guest-only by default.
type DiscordConfig struct {
	ClientID     string
	ClientSecret string
	// RedirectURI is the browser page Discord returns to, for example
	// https://example.com/auth/discord/callback. It must match the URI
	// registered in the Discord developer portal exactly.
	RedirectURI string
	// AuthorizeURL and APIBase are overridable for tests.
	AuthorizeURL string
	APIBase      string
	HTTPClient   *http.Client
}

// DiscordConfigFromEnv reads DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET and
// DISCORD_REDIRECT_URI. It returns nil (sign-in disabled) unless all are set.
func DiscordConfigFromEnv() *DiscordConfig {
	config := &DiscordConfig{
		ClientID:     strings.TrimSpace(os.Getenv("DISCORD_CLIENT_ID")),
		ClientSecret: strings.TrimSpace(os.Getenv("DISCORD_CLIENT_SECRET")),
		RedirectURI:  strings.TrimSpace(os.Getenv("DISCORD_REDIRECT_URI")),
	}
	if config.ClientID == "" || config.ClientSecret == "" || config.RedirectURI == "" {
		return nil
	}
	return config
}

func (c *DiscordConfig) authorizeURL() string {
	if c.AuthorizeURL != "" {
		return c.AuthorizeURL
	}
	return "https://discord.com/oauth2/authorize"
}

func (c *DiscordConfig) apiBase() string {
	if c.APIBase != "" {
		return strings.TrimRight(c.APIBase, "/")
	}
	return "https://discord.com/api/v10"
}

func (c *DiscordConfig) client() *http.Client {
	if c.HTTPClient != nil {
		return c.HTTPClient
	}
	return &http.Client{Timeout: 10 * time.Second}
}

// AuthURL is where the browser goes to approve the sign-in. Only the
// "identify" scope is requested: the game needs a stable user ID and a name.
func (c *DiscordConfig) AuthURL(state string) string {
	query := url.Values{
		"response_type": {"code"},
		"client_id":     {c.ClientID},
		"scope":         {"identify"},
		"state":         {state},
		"redirect_uri":  {c.RedirectURI},
	}
	return c.authorizeURL() + "?" + query.Encode()
}

type discordUser struct {
	ID         string `json:"id"`
	Username   string `json:"username"`
	GlobalName string `json:"global_name"`
}

func (u discordUser) displayName() string {
	if u.GlobalName != "" {
		return u.GlobalName
	}
	return u.Username
}

var errDiscordRejected = errors.New("discord rejected the sign-in")

// Identify exchanges an authorization code for the Discord user it belongs
// to. The access token is used once and never stored.
func (c *DiscordConfig) Identify(ctx context.Context, code string) (discordUser, error) {
	form := url.Values{
		"grant_type":   {"authorization_code"},
		"code":         {code},
		"redirect_uri": {c.RedirectURI},
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, c.apiBase()+"/oauth2/token", strings.NewReader(form.Encode()))
	if err != nil {
		return discordUser{}, err
	}
	request.SetBasicAuth(c.ClientID, c.ClientSecret)
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	request.Header.Set("Accept", "application/json")
	response, err := c.client().Do(request)
	if err != nil {
		return discordUser{}, err
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusBadRequest || response.StatusCode == http.StatusUnauthorized {
		return discordUser{}, errDiscordRejected
	}
	if response.StatusCode != http.StatusOK {
		return discordUser{}, fmt.Errorf("discord token exchange: status %d", response.StatusCode)
	}
	var token struct {
		AccessToken string `json:"access_token"`
		TokenType   string `json:"token_type"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 64<<10)).Decode(&token); err != nil {
		return discordUser{}, err
	}
	if token.AccessToken == "" {
		return discordUser{}, errDiscordRejected
	}

	request, err = http.NewRequestWithContext(ctx, http.MethodGet, c.apiBase()+"/users/@me", nil)
	if err != nil {
		return discordUser{}, err
	}
	request.Header.Set("Authorization", "Bearer "+token.AccessToken)
	request.Header.Set("Accept", "application/json")
	response, err = c.client().Do(request)
	if err != nil {
		return discordUser{}, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return discordUser{}, fmt.Errorf("discord user lookup: status %d", response.StatusCode)
	}
	var user discordUser
	if err := json.NewDecoder(io.LimitReader(response.Body, 64<<10)).Decode(&user); err != nil {
		return discordUser{}, err
	}
	if user.ID == "" {
		return discordUser{}, errors.New("discord user lookup: missing id")
	}
	return user, nil
}
