#!/bin/bash
# Echoes Mood Backfill Script (Unix wrapper)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "Starting mood backfill..."
python3 scripts/backfill_mood.py "$@"
echo "Backfill complete."
