package router

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestHealthCheckHandler(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/health", nil)

	healthCheckHandler(c)

	// Status should be 200 or 503 depending on downstream availability.
	// In test environment without downstream services, expect 503.
	status := w.Code
	if status != http.StatusOK && status != http.StatusServiceUnavailable {
		t.Errorf("expected status 200 or 503, got %d", status)
	}

	// Verify response structure
	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to parse JSON: %v", err)
	}

	// Required top-level fields
	requiredFields := []string{"status", "gateway", "services", "version"}
	for _, field := range requiredFields {
		if _, ok := body[field]; !ok {
			t.Errorf("missing field %q in response", field)
		}
	}
}

func TestHealthCheckResponseStructure(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/health", nil)

	healthCheckHandler(c)

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to parse JSON: %v", err)
	}

	// gateway should always be "ok"
	gateway, ok := body["gateway"].(string)
	if !ok || gateway != "ok" {
		t.Errorf("expected gateway=ok, got %v", body["gateway"])
	}

	// version should be present
	version, ok := body["version"].(string)
	if !ok || version == "" {
		t.Errorf("expected non-empty version, got %v", body["version"])
	}

	// services should contain user and memory keys
	services, ok := body["services"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected services to be an object, got %T", body["services"])
	}

	expectedServiceKeys := []string{"user", "memory"}
	for _, key := range expectedServiceKeys {
		val, exists := services[key]
		if !exists {
			t.Errorf("missing services key %q", key)
		}
		if s, ok := val.(string); !ok || (s != "ok" && s != "unreachable") {
			t.Errorf("services[%q] = %v, want ok or unreachable", key, val)
		}
	}

	// status should be healthy or degraded
	status, ok := body["status"].(string)
	if !ok || (status != "healthy" && status != "degraded") {
		t.Errorf("expected status=healthy|degraded, got %v", body["status"])
	}
}
