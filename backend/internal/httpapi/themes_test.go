package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/game"
	"github.com/swarkentin/heart-of-the-beast/backend/internal/store"
)

type themedRunRoom struct {
	Room struct {
		ID  string `json:"id"`
		Run *struct {
			ThemeID       string `json:"themeId"`
			CurrentRoomID string `json:"currentRoomId"`
			Rooms         map[string]struct {
				ThemeID string `json:"themeId"`
			} `json:"rooms"`
		} `json:"run"`
	} `json:"room"`
	PlayerToken string `json:"playerToken"`
}

func startThemedRun(t *testing.T, body string) (*httptest.ResponseRecorder, themedRunRoom) {
	t.Helper()
	handler := NewHandler(store.NewMemory())
	create := httptest.NewRecorder()
	handler.ServeHTTP(create, httptest.NewRequest(http.MethodPost, "/rooms", nil))
	if create.Code != http.StatusCreated {
		t.Fatalf("create room: %d %s", create.Code, create.Body.String())
	}
	var created themedRunRoom
	if err := json.Unmarshal(create.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	var reader *bytes.Buffer
	if body != "" {
		reader = bytes.NewBufferString(body)
	}
	var start *http.Request
	if reader == nil {
		start = httptest.NewRequest(http.MethodPost, "/rooms/"+created.Room.ID+"/start", nil)
	} else {
		start = httptest.NewRequest(http.MethodPost, "/rooms/"+created.Room.ID+"/start", reader)
	}
	start.Header.Set("Authorization", "Bearer "+created.PlayerToken)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, start)
	var started themedRunRoom
	_ = json.Unmarshal(response.Body.Bytes(), &started.Room)
	return response, started
}

func TestStartRunWithoutBodyDefaultsToCatacombs(t *testing.T) {
	response, started := startThemedRun(t, "")
	if response.Code != http.StatusOK || started.Room.Run == nil || started.Room.Run.ThemeID != "catacombs" || started.Room.Run.CurrentRoomID != "d1-entry" {
		t.Fatalf("default start: %d %s", response.Code, response.Body.String())
	}
}

func TestStartRunCanChooseAPlayableTheme(t *testing.T) {
	response, started := startThemedRun(t, `{"themeId":"scifi"}`)
	if response.Code != http.StatusOK || started.Room.Run == nil {
		t.Fatalf("scifi start: %d %s", response.Code, response.Body.String())
	}
	run := started.Room.Run
	if run.ThemeID != "scifi" || run.CurrentRoomID != "d1-entry" || run.Rooms["d1-entry"].ThemeID != "scifi" {
		t.Fatalf("scifi run snapshot: %+v", run)
	}
}

func TestStartRunCanLetTheServerChooseATheme(t *testing.T) {
	response, started := startThemedRun(t, `{"themeId":"random"}`)
	if response.Code != http.StatusOK || started.Room.Run == nil {
		t.Fatalf("random start: %d %s", response.Code, response.Body.String())
	}
	run := started.Room.Run
	if run.ThemeID == "" || run.ThemeID == "random" || run.Rooms["d1-entry"].ThemeID != run.ThemeID {
		t.Fatalf("random run snapshot: %+v", run)
	}
}

func TestEveryListedThemeStarts(t *testing.T) {
	for _, theme := range game.PlayableDungeonThemes() {
		response, started := startThemedRun(t, `{"themeId":"`+theme.ID+`"}`)
		if response.Code != http.StatusOK || started.Room.Run == nil || started.Room.Run.ThemeID != theme.ID {
			t.Errorf("%s start: %d", theme.ID, response.Code)
		}
	}
}

func TestStartRunRejectsUnknownAndMalformedThemes(t *testing.T) {
	for name, body := range map[string]string{"unknown": `{"themeId":"atlantis"}`, "malformed": `{"themeId":`} {
		response, _ := startThemedRun(t, body)
		if response.Code != http.StatusBadRequest {
			t.Errorf("%s: status %d, want 400 (%s)", name, response.Code, response.Body.String())
		}
	}
}

func TestThemesEndpointListsPlayableThemes(t *testing.T) {
	handler := NewHandler(store.NewMemory())
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/themes", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("themes: %d", response.Code)
	}
	var body struct {
		DefaultThemeID string `json:"defaultThemeId"`
		RandomThemeID  string `json:"randomThemeId"`
		Themes         []struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"themes"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	ids := []string{}
	for _, theme := range body.Themes {
		ids = append(ids, theme.ID)
		if theme.Name == "" {
			t.Errorf("theme %q has no name", theme.ID)
		}
	}
	if body.DefaultThemeID != "catacombs" || body.RandomThemeID != "random" || strings.Join(ids, ",") != "catacombs,scifi,mobster,sunken,clockwork,carnival,jungle,dreamscape,arctic,ghosttown,wasteland" {
		t.Fatalf("themes = %v default=%q", ids, body.DefaultThemeID)
	}
}
