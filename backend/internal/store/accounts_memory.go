package store

import (
	"context"
	"sort"
	"time"
)

func identityKey(provider, subject string) string { return provider + "\x00" + subject }

func (m *Memory) SaveSignIn(_ context.Context, signIn SignIn, now time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for key, existing := range m.signIns {
		if !existing.ExpiresAt.After(now) {
			delete(m.signIns, key)
		}
	}
	if _, exists := m.signIns[signIn.StateHash]; exists {
		return ErrConflict
	}
	m.signIns[signIn.StateHash] = signIn
	return nil
}

func (m *Memory) GetSignIn(_ context.Context, stateHash string) (*SignIn, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	signIn, ok := m.signIns[stateHash]
	if !ok {
		return nil, ErrNotFound
	}
	return &signIn, nil
}

func (m *Memory) SetSignInIdentity(_ context.Context, stateHash, subject, username string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	signIn, ok := m.signIns[stateHash]
	if !ok {
		return ErrNotFound
	}
	signIn.Subject, signIn.Username = subject, username
	m.signIns[stateHash] = signIn
	return nil
}

func (m *Memory) DeleteSignIn(_ context.Context, stateHash string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.signIns, stateHash)
	return nil
}

func (m *Memory) ProfileIDForIdentity(_ context.Context, provider, subject string) (string, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	identity, ok := m.identities[identityKey(provider, subject)]
	if !ok {
		return "", ErrNotFound
	}
	return identity.profileID, nil
}

func (m *Memory) LinkIdentity(_ context.Context, provider, subject, username, profileID string, now time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, exists := m.identities[identityKey(provider, subject)]; exists {
		return ErrConflict
	}
	for _, identity := range m.identities {
		if identity.profileID == profileID && identity.provider == provider {
			return ErrConflict
		}
	}
	m.identities[identityKey(provider, subject)] = memoryIdentity{provider: provider, profileID: profileID, username: username, linkedAt: now.UTC()}
	return nil
}

func (m *Memory) AddProfileCredential(_ context.Context, profileID, credentialHash string, _ time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, exists := m.profiles[credentialHash]; exists {
		return ErrConflict
	}
	for _, profile := range m.profiles {
		if profile.ID == profileID {
			m.profiles[credentialHash] = profile
			return nil
		}
	}
	return ErrNotFound
}

func (m *Memory) GetProfileByID(_ context.Context, profileID string) (*Profile, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	for _, profile := range m.profiles {
		if profile.ID == profileID {
			return cloneProfile(profile)
		}
	}
	return nil, ErrNotFound
}

func (m *Memory) LinkedAccounts(_ context.Context, profileID string) ([]LinkedAccount, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	accounts := []LinkedAccount{}
	for _, identity := range m.identities {
		if identity.profileID != profileID {
			continue
		}
		accounts = append(accounts, LinkedAccount{Provider: identity.provider, Username: identity.username, LinkedAt: identity.linkedAt})
	}
	sort.Slice(accounts, func(i, j int) bool { return accounts[i].Provider < accounts[j].Provider })
	return accounts, nil
}
