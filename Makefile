.PHONY: help dev-start dev-stop dev-logs migrate build test clean

# Echoes (拾忆) - Development Commands
# Usage: make <target>

help: ## Show this help message
	@echo "Echoes (拾忆) - Available Commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

dev-start: ## Start all services with Docker Compose
	@echo "Starting Echoes development environment..."
	docker-compose up -d
	@echo "Waiting for services to be healthy..."
	@sleep 5
	@echo "Services ready:"
	@echo "  Web:       http://localhost:3000"
	@echo "  API:       http://localhost:8080"
	@echo "  Postgres:  localhost:5432"
	@echo "  Redis:     localhost:6379"
	@echo "  MinIO:     http://localhost:9001"

dev-stop: ## Stop all services
	@echo "Stopping Echoes services..."
	docker-compose down

dev-logs: ## View logs from all services
	docker-compose logs -f

dev-logs-gateway: ## View gateway service logs
	docker-compose logs -f gateway

dev-logs-user: ## View user service logs
	docker-compose logs -f user-service

dev-logs-memory: ## View memory service logs
	docker-compose logs -f memory-service

dev-logs-processor: ## View processor service logs
	docker-compose logs -f processor-service

dev-logs-vectorizer: ## View vectorizer service logs
	docker-compose logs -f vectorizer-service

dev-logs-db: ## View database logs
	docker-compose logs -f postgres

migrate: ## Run database migrations
	@echo "Running database migrations..."
	@docker exec -i echoes-postgres psql -U echoes_user -d echoes -f /docker-entrypoint-initdb.d/001_init.sql || \
		echo "Database not ready. Run 'make dev-start' first."

migrate-psql: ## Connect to database with psql
	@docker exec -it echoes-postgres psql -U echoes_user -d echoes

build: ## Build all service images
	docker-compose build

build-web: ## Build web frontend
	cd web && npm run build

test: ## Run all tests
	@echo "Running tests for all services..."
	cd services/gateway && go test ./...
	cd services/user-service && go test ./...
	cd services/memory-service && go test ./...
	cd services/processor-service && python -m pytest
	cd services/vectorizer-service && python -m pytest
	cd web && npm test

test-gateway: ## Run gateway tests
	cd services/gateway && go test ./...

test-user: ## Run user service tests
	cd services/user-service && go test ./...

test-memory: ## Run memory service tests
	cd services/memory-service && go test ./...

test-web: ## Run web frontend tests
	cd web && npm test

clean: ## Remove all containers, volumes, and images
	@echo "Cleaning up all Docker resources..."
	docker-compose down -v --rmi all

clean-data: ## Remove data volumes only (keep images)
	docker-compose down -v

fmt-go: ## Format Go code
	cd services/gateway && gofmt -w .
	cd services/user-service && gofmt -w .
	cd services/memory-service && gofmt -w .

fmt-web: ## Format web code
	cd web && npm run lint:fix

proto: ## Generate gRPC code from proto files (future use)
	@echo "Proto generation not yet configured"

# Service-specific development commands
dev-gateway: ## Run gateway service locally (requires Go)
	cd services/gateway && go run cmd/main.go

dev-user: ## Run user service locally (requires Go)
	cd services/user-service && go run cmd/main.go

dev-memory: ## Run memory service locally (requires Go)
	cd services/memory-service && go run cmd/main.go

dev-processor: ## Run processor service locally (requires Python)
	cd services/processor-service && uvicorn app.main:app --reload --port 8003

dev-vectorizer: ## Run vectorizer service locally (requires Python)
	cd services/vectorizer-service && uvicorn app.main:app --reload --port 8004

dev-web: ## Run web frontend locally (requires Node.js)
	cd web && npm run dev
