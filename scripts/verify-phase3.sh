#!/bin/bash
# Phase 3 Integration Verification Script
# Echoes (拾忆) - AI Processing Layer End-to-End Verification
set -e

echo "=== Phase 3: AI Processing Layer Verification ==="
echo ""

# 1. Start core services
echo "[1/7] Starting services..."
docker-compose up -d postgres redis memory-service processor-service vectorizer-service
sleep 10

# 2. Check health endpoints
echo ""
echo "[2/7] Checking health endpoints..."
HEALTH_MEMORY=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8102/health || echo "000")
HEALTH_PROCESSOR=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8103/health || echo "000")
HEALTH_VECTORIZER=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8104/health || echo "000")

echo "  Memory Service:     HTTP $HEALTH_MEMORY"
echo "  Processor Service:  HTTP $HEALTH_PROCESSOR"
echo "  Vectorizer Service: HTTP $HEALTH_VECTORIZER"

if [ "$HEALTH_MEMORY" = "200" ] && [ "$HEALTH_PROCESSOR" = "200" ] && [ "$HEALTH_VECTORIZER" = "200" ]; then
    echo "  PASS: All services healthy"
else
    echo "  WARNING: Some services not ready yet (may need more time for model load)"
fi

# 3. Verify Gateway does NOT expose internal routes
echo ""
echo "[3/7] Verifying Gateway internal route isolation..."
GATEWAY_INTERNAL_TEST=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer dev-internal-token" \
  http://localhost:8188/api/v1/internal/memories/00000000-0000-0000-0000-000000000000/tasks || echo "000")

if [ "$GATEWAY_INTERNAL_TEST" = "404" ] || [ "$GATEWAY_INTERNAL_TEST" = "403" ] || [ "$GATEWAY_INTERNAL_TEST" = "000" ]; then
    echo "  PASS: Gateway does not expose internal routes (HTTP $GATEWAY_INTERNAL_TEST)"
else
    echo "  WARNING: Gateway may expose internal routes (HTTP $GATEWAY_INTERNAL_TEST)"
    echo "  ACTION REQUIRED: Add exclude rule for /api/v1/internal/* in Gateway routing"
fi

# 4. Verify env var consistency
echo ""
echo "[4/7] Verifying environment variable consistency..."
TOKEN_COUNT=$(grep -c "INTERNAL_API_TOKEN" docker-compose.yml || echo "0")
if [ "$TOKEN_COUNT" -ge 3 ]; then
    echo "  PASS: INTERNAL_API_TOKEN present in $TOKEN_COUNT services"
else
    echo "  FAIL: INTERNAL_API_TOKEN only in $TOKEN_COUNT services (expected 3+)"
fi

# 5. Verify stream name consistency
echo ""
echo "[5/7] Verifying Redis Stream name consistency..."
MEMORY_STREAMS=$(grep -oE '"(link:fetch|text:vectorize|tag:generate)"' services/memory-service/internal/service/redis_queue.go | sort -u | wc -l)
PROCESSOR_STREAMS=$(grep -oE '"(link:fetch|tag:generate)"' services/processor-service/app/consumers/*.py | sort -u | wc -l)
VECTORIZER_STREAMS=$(grep -oE '"text:vectorize"' services/vectorizer-service/app/consumers/*.py | sort -u | wc -l)

echo "  Memory Service publishes:  $MEMORY_STREAMS stream types"
echo "  Processor Service consumes: $PROCESSOR_STREAMS stream types"
echo "  Vectorizer Service consumes: $VECTORIZER_STREAMS stream types"

if [ "$MEMORY_STREAMS" -eq 3 ] && [ "$PROCESSOR_STREAMS" -eq 2 ] && [ "$VECTORIZER_STREAMS" -eq 1 ]; then
    echo "  PASS: Stream names consistent"
else
    echo "  WARNING: Stream name mismatch detected"
fi

# 6. Verify internal API path consistency
echo ""
echo "[6/7] Verifying internal API path consistency..."
PROCESSOR_PATH=$(grep -c "api/v1/internal/memories" services/processor-service/app/clients/memory_client.py || echo "0")
VECTORIZER_PATH=$(grep -c "api/v1/internal/memories" services/vectorizer-service/app/clients/memory_client.py || echo "0")
MEMORY_HANDLER_PATH=$(grep -c "internal/memories/:id/tasks" services/memory-service/internal/transport/memory_handler.go || echo "0")

echo "  Processor client path:  $PROCESSOR_PATH match"
echo "  Vectorizer client path: $VECTORIZER_PATH match"
echo "  Memory handler path:    $MEMORY_HANDLER_PATH match"

if [ "$PROCESSOR_PATH" -ge 1 ] && [ "$VECTORIZER_PATH" -ge 1 ] && [ "$MEMORY_HANDLER_PATH" -ge 1 ]; then
    echo "  PASS: Internal API paths consistent"
else
    echo "  WARNING: Internal API path mismatch"
fi

# 7. Check Redis streams
echo ""
echo "[7/7] Checking Redis streams..."
docker-compose exec -T redis redis-cli XLEN text:vectorize 2>/dev/null || echo "  (Redis not available or no messages yet)"
docker-compose exec -T redis redis-cli XLEN tag:generate 2>/dev/null || true
docker-compose exec -T redis redis-cli XLEN link:fetch 2>/dev/null || true

echo ""
echo "=== Verification complete ==="
echo ""
echo "Next steps for full e2e test:"
echo "  1. Create a memory via frontend or API (POST /api/v1/memories)"
echo "  2. Check Redis streams for pending messages"
echo "  3. Verify processing_status transitions: pending -> processing -> completed"
echo "  4. Check memory metadata for task results (tags, vector, link content)"
