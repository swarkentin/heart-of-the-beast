package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/swarkentin/heart-of-the-beast/backend/internal/store"
)

func TestGuestProfileCredentialCreatesAndResumesProfile(t *testing.T) {
	handler := NewHandler(store.NewMemory())
	credential := "0123456789abcdef0123456789abcdef"

	request := func(method string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, "/profile", nil)
		req.Header.Set("Authorization", "Bearer "+credential)
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, req)
		return response
	}

	created := request(http.MethodPost)
	if created.Code != http.StatusOK {
		t.Fatalf("create profile: %d %s", created.Code, created.Body.String())
	}
	var first store.Profile
	if err := json.Unmarshal(created.Body.Bytes(), &first); err != nil {
		t.Fatal(err)
	}
	if first.ID == "" || first.AdventurerLevel != 1 || first.ClassMastery == nil || first.UnlockedCosmetics == nil {
		t.Fatalf("profile defaults missing: %+v", first)
	}

	resumed := request(http.MethodPost)
	var second store.Profile
	if resumed.Code != http.StatusOK {
		t.Fatalf("resume profile: %d %s", resumed.Code, resumed.Body.String())
	}
	if err := json.Unmarshal(resumed.Body.Bytes(), &second); err != nil {
		t.Fatal(err)
	}
	if second.ID != first.ID {
		t.Fatalf("repeated bootstrap created a second profile: %q != %q", second.ID, first.ID)
	}

	loaded := request(http.MethodGet)
	if loaded.Code != http.StatusOK {
		t.Fatalf("get profile: %d %s", loaded.Code, loaded.Body.String())
	}
	var third store.Profile
	if err := json.Unmarshal(loaded.Body.Bytes(), &third); err != nil {
		t.Fatal(err)
	}
	if third.ID != first.ID {
		t.Fatalf("get returned another profile: %q != %q", third.ID, first.ID)
	}
}

func TestGuestProfileRequiresCredentialAndDoesNotExposeHash(t *testing.T) {
	handler := NewHandler(store.NewMemory())
	missing := httptest.NewRecorder()
	handler.ServeHTTP(missing, httptest.NewRequest(http.MethodPost, "/profile", nil))
	if missing.Code != http.StatusUnauthorized {
		t.Fatalf("missing credential: got %d", missing.Code)
	}

	req := httptest.NewRequest(http.MethodPost, "/profile", nil)
	req.Header.Set("Authorization", "Bearer 0123456789abcdef0123456789abcdef")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, req)
	if response.Code != http.StatusOK {
		t.Fatalf("create profile: %d %s", response.Code, response.Body.String())
	}
	if strings.Contains(response.Body.String(), "credential") || strings.Contains(response.Body.String(), "hash") {
		t.Fatalf("profile response leaked credential material: %s", response.Body.String())
	}
}

func TestGuestProfileNameIsValidatedAndPersisted(t *testing.T) {
	handler := NewHandler(store.NewMemory())
	credential := "0123456789abcdef0123456789abcdef"
	bootstrap := httptest.NewRequest(http.MethodPost, "/profile", nil)
	bootstrap.Header.Set("Authorization", "Bearer "+credential)
	created := httptest.NewRecorder()
	handler.ServeHTTP(created, bootstrap)
	if created.Code != http.StatusOK {
		t.Fatalf("create profile: %d %s", created.Code, created.Body.String())
	}

	for _, invalid := range []string{"", "1234567890123456789", "bad\nname"} {
		body := `{"displayName":` + `"` + invalid + `"}`
		req := httptest.NewRequest(http.MethodPatch, "/profile", strings.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+credential)
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, req)
		if response.Code != http.StatusBadRequest {
			t.Errorf("invalid name %q: got %d %s", invalid, response.Code, response.Body.String())
		}
	}

	req := httptest.NewRequest(http.MethodPatch, "/profile", strings.NewReader(`{"displayName":"  Crypt Keeper  "}`))
	req.Header.Set("Authorization", "Bearer "+credential)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, req)
	if response.Code != http.StatusOK {
		t.Fatalf("update name: %d %s", response.Code, response.Body.String())
	}
	var updated store.Profile
	if err := json.Unmarshal(response.Body.Bytes(), &updated); err != nil {
		t.Fatal(err)
	}
	if updated.DisplayName != "Crypt Keeper" {
		t.Fatalf("name was not trimmed: %q", updated.DisplayName)
	}

	get := httptest.NewRequest(http.MethodGet, "/profile", nil)
	get.Header.Set("Authorization", "Bearer "+credential)
	loaded := httptest.NewRecorder()
	handler.ServeHTTP(loaded, get)
	var persisted store.Profile
	if err := json.Unmarshal(loaded.Body.Bytes(), &persisted); err != nil {
		t.Fatal(err)
	}
	if persisted.DisplayName != "Crypt Keeper" {
		t.Fatalf("name was not persisted: %q", persisted.DisplayName)
	}
}
