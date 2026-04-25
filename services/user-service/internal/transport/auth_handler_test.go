package transport

import (
	"testing"
	"time"
)

// resetOAuthStates clears the global oauthStates map for test isolation.
func resetOAuthStates() {
	oauthStateMux.Lock()
	oauthStates = make(map[string]time.Time)
	oauthStateMux.Unlock()
}

// doCleanup performs a single pass of cleaning expired OAuth states.
// Extracted from cleanupOAuthStates for testability.
func doCleanup() {
	oauthStateMux.Lock()
	now := time.Now()
	for state, expiry := range oauthStates {
		if now.After(expiry) {
			delete(oauthStates, state)
		}
	}
	oauthStateMux.Unlock()
}

func TestGenerateState(t *testing.T) {
	defer resetOAuthStates()

	state1 := generateState()
	state2 := generateState()

	if state1 == "" {
		t.Error("generateState() returned empty string")
	}
	if state2 == "" {
		t.Error("generateState() returned empty string")
	}
	if state1 == state2 {
		t.Error("generateState() returned duplicate states")
	}

	// Verify states are stored in the map
	oauthStateMux.Lock()
	_, ok1 := oauthStates[state1]
	_, ok2 := oauthStates[state2]
	oauthStateMux.Unlock()

	if !ok1 {
		t.Errorf("state1 %q not found in oauthStates map", state1)
	}
	if !ok2 {
		t.Errorf("state2 %q not found in oauthStates map", state2)
	}
}

func TestValidateState_Success(t *testing.T) {
	defer resetOAuthStates()

	state := generateState()

	// First validation should succeed
	if !validateState(state) {
		t.Error("validateState() returned false for a valid state")
	}

	// State should now be removed from map
	oauthStateMux.Lock()
	_, ok := oauthStates[state]
	oauthStateMux.Unlock()
	if ok {
		t.Error("validateState() did not remove the state from map")
	}

	// Second validation should fail (already consumed)
	if validateState(state) {
		t.Error("validateState() returned true for a consumed state")
	}
}

func TestValidateState_Expired(t *testing.T) {
	defer resetOAuthStates()

	// Insert an already-expired state directly into the map
	expiredState := "expired-state-123"
	oauthStateMux.Lock()
	oauthStates[expiredState] = time.Now().Add(-1 * time.Minute)
	oauthStateMux.Unlock()

	// Validate should return false for expired state
	if validateState(expiredState) {
		t.Error("validateState() returned true for expired state")
	}

	// Expired state should be deleted from the map
	oauthStateMux.Lock()
	_, ok := oauthStates[expiredState]
	oauthStateMux.Unlock()
	if ok {
		t.Error("validateState() did not remove expired state from map")
	}
}

func TestValidateState_Invalid(t *testing.T) {
	defer resetOAuthStates()

	if validateState("nonexistent-state") {
		t.Error("validateState() returned true for nonexistent state")
	}
}

func TestCleanupOAuthStates(t *testing.T) {
	defer resetOAuthStates()

	// Insert a mix of expired and valid states
	oauthStateMux.Lock()
	oauthStates["expired-1"] = time.Now().Add(-11 * time.Minute)
	oauthStates["expired-2"] = time.Now().Add(-20 * time.Minute)
	oauthStates["valid-1"] = time.Now().Add(5 * time.Minute)
	oauthStates["valid-2"] = time.Now().Add(10 * time.Minute)
	oauthStateMux.Unlock()

	// Run a single cleanup pass
	doCleanup()

	// Verify expired states are gone
	oauthStateMux.Lock()
	_, expired1 := oauthStates["expired-1"]
	_, expired2 := oauthStates["expired-2"]
	_, valid1 := oauthStates["valid-1"]
	_, valid2 := oauthStates["valid-2"]
	count := len(oauthStates)
	oauthStateMux.Unlock()

	if expired1 {
		t.Error("cleanup did not remove expired-1")
	}
	if expired2 {
		t.Error("cleanup did not remove expired-2")
	}
	if !valid1 {
		t.Error("cleanup incorrectly removed valid-1")
	}
	if !valid2 {
		t.Error("cleanup incorrectly removed valid-2")
	}
	if count != 2 {
		t.Errorf("expected 2 remaining states after cleanup, got %d", count)
	}
}
