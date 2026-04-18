#!/bin/bash
# Echoes (拾忆) - macOS/Linux Development Environment Startup Script
# Version: 1.0.0
# Usage: ./dev-start.sh

set -e

echo ""
echo "========================================"
echo "  Echoes (拾忆) - Starting Dev Environment"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo -e "${RED}ERROR: Docker not found.${NC}"
    echo -e "${YELLOW}Please install Docker Desktop or Docker Engine:${NC}"
    echo -e "  https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}ERROR: docker-compose not found.${NC}"
    echo -e "${YELLOW}Docker Desktop includes docker-compose by default.${NC}"
    exit 1
fi

echo -e "${GREEN}Docker found. Checking Docker daemon...${NC}"

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    echo -e "${RED}ERROR: Docker daemon is not running.${NC}"
    echo -e "${YELLOW}Please start Docker first.${NC}"
    exit 1
fi

echo -e "${GREEN}Docker daemon is running.${NC}\n"

# Start services
echo -e "${YELLOW}Starting all Echoes services...${NC}"
echo -e "${YELLOW}This may take a few minutes on first run.${NC}\n"

docker-compose up -d

# Wait for services to be ready
echo -e "\n${YELLOW}Waiting for services to initialize...${NC}"
for i in 10 9 8 7 6 5 4 3 2 1; do
    echo -e "  Starting in ${i} seconds..."
    sleep 1
done

# Display success message
echo -e "\n${GREEN}========================================"
echo -e "  Echoes Environment Ready!"
echo -e "========================================${NC}"
echo -e ""
echo -e "  ${CYAN}Web Frontend:   http://localhost:3000${NC}"
echo -e "  ${CYAN}API Gateway:    http://localhost:8080${NC}"
echo -e "  ${CYAN}PostgreSQL:     localhost:5432${NC}"
echo -e "  ${CYAN}Redis:          localhost:6379${NC}"
echo -e "  ${CYAN}MinIO Console:  http://localhost:9001${NC}"
echo -e ""
echo -e "${YELLOW}Database Credentials:${NC}"
echo -e "  Database: echoes"
echo -e "  User:     echoes_user"
echo -e "  Password: echoes_password"
echo -e ""
echo -e "${YELLOW}Useful Commands:${NC}"
echo -e "  make dev-stop        # Stop all services"
echo -e "  make dev-logs        # View logs"
echo -e "  make migrate         # Run DB migrations"
echo -e ""
echo -e "${MAGENTA}Happy coding!${NC}"
echo -e ""
