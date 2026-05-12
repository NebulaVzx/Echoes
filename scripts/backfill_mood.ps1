# Echoes Mood Backfill Script (Windows wrapper)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Split-Path -Parent $scriptDir

Set-Location $projectDir

Write-Host "Starting mood backfill..."
python scripts/backfill_mood.py @args
Write-Host "Backfill complete."
