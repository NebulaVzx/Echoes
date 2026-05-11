# Phase 13 Validation Architecture

## Test Framework Mapping

### Frontend (Next.js)
| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 + React Testing Library 14.2.1 |
| Config | `web/jest.config.js` (or package.json) |
| Quick run | `cd web && npm test -- --testNamePattern="Constellation"` |
| Full suite | `cd web && npm test` |
| Build check | `cd web && npm run build` |

### Backend (Go)
| Property | Value |
|----------|-------|
| Framework | Go testing (built-in) |
| Quick run | `cd services/memory-service && go test ./... -run TestConstellation` |
| Full suite | `cd services/memory-service && go test ./...` |
| Build check | `cd services/memory-service && go build ./...` |

## Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | Test File (Wave 0) |
|--------|----------|-----------|-------------------|-------------------|
| CONST-01 | Force graph renders with nodes and links | unit | `jest components/constellation/ConstellationGraph.test.tsx` | `web/components/constellation/__tests__/ConstellationGraph.test.tsx` |
| CONST-02 | Nodes colored by tag, starred has glow | unit | `jest components/constellation/ConstellationGraph.test.tsx` | `web/components/constellation/__tests__/ConstellationGraph.test.tsx` |
| CONST-03 | Click node triggers explore panel | unit | `jest components/constellation/GraphInteractions.test.tsx` | `web/components/constellation/__tests__/GraphInteractions.test.tsx` |
| CONST-04 | Mobile renders simplified view | e2e | `playwright test tests/constellation-mobile.spec.ts` | `web/e2e/constellation-mobile.spec.ts` |
| EXPLORE-01 | API returns 5-8 related memories | integration | `go test ./... -run TestExplore` | `services/memory-service/internal/service/memory_service_test.go` |
| EXPLORE-02 | LLM reason cached in memory_relations | integration | `go test ./... -run TestRelationCache` | `services/memory-service/internal/repository/relation_repository_test.go` |
| EXPLORE-03 | Breadcrumb tracks drill path | unit | `jest hooks/useExplorePath.test.ts` | `web/components/constellation/hooks/__tests__/useExplorePath.test.ts` |
| EXPLORE-04 | Deep-linking via URL query params | e2e | `playwright test tests/explore-deep-link.spec.ts` | `web/e2e/explore-deep-link.spec.ts` |

## Wave 0 Test File Definitions

The following test files must be created BEFORE implementation (TDD-style) or alongside implementation:

### Frontend Unit Tests
1. `web/components/constellation/__tests__/ConstellationGraph.test.tsx`
   - Renders without crashing
   - nodeCanvasObject uses node.color directly (not recomputing)
   - Hover highlights connected nodes
   - Click triggers onNodeClick callback

2. `web/components/constellation/__tests__/GraphControls.test.tsx`
   - Zoom in/out/reset buttons fire callbacks
   - Filter input fires onFilter callback
   - Does not mutate original graph data

3. `web/components/constellation/__tests__/ExplorePanel.test.tsx`
   - Renders loading state
   - Renders related memory cards with similarity badge
   - Breadcrumb navigation fires callbacks

4. `web/components/constellation/hooks/__tests__/useConstellationData.test.ts`
   - Fetches constellation data on mount
   - loadMore appends nodes (with offset)
   - Computes node colors in transform (not in graph component)

5. `web/components/constellation/hooks/__tests__/useExplorePath.test.ts`
   - push adds to path
   - navigateTo truncates path
   - clear empties path

### Backend Integration Tests
6. `services/memory-service/internal/repository/relation_repository_test.go`
   - Save and retrieve relation reason
   - Consistent ordering for source/target
   - Returns ErrRelationNotFound on miss

7. `services/memory-service/internal/service/memory_service_test.go`
   - GetConstellation returns nodes + edges
   - Explore returns related memories with reasons
   - LLM failure returns default reason (non-blocking)

### E2E Tests
8. `web/e2e/constellation.spec.ts`
   - /constellation page loads graph
   - Node click opens explore panel (desktop)
   - "探索更远" button loads more nodes

9. `web/e2e/explore.spec.ts`
   - /explore?id={id} loads with memory detail
   - Related memories shown with similarity and reason
   - Drill-down updates breadcrumb

## Manual Verification Checklist

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start services: `make dev-start` | All containers healthy |
| 2 | Apply migration: `make migrate` | 005_memory_relations.sql applied |
| 3 | Create 3+ memories with tags | Memories visible in timeline |
| 4 | Wait for vectorization | processing_status = 'completed' |
| 5 | Navigate to /constellation | Graph renders with colored nodes |
| 6 | Hover a node | Connected nodes and edges highlight |
| 7 | Click node (desktop) | RightPanel opens with explore content |
| 8 | Click related memory | Drill-down to new center, breadcrumb updates |
| 9 | Click "探索更远" | More nodes load, hasMore updates |
| 10 | Press +/-, 0, f, Esc | Zoom, reset, fit, deselect work |
| 11 | Resize to mobile (< 768px) | Node click navigates to /explore |
| 12 | Test API: `curl /api/v1/memories/{id}/explore` | Returns results with similarity + reason |
