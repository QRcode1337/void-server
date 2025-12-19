# Void Server - Update Script for Windows
# Pull latest code, update dependencies, and restart services.

$ErrorActionPreference = "Stop"

function Write-Header {
    param([string]$Message)
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
    Write-Host "  $Message" -ForegroundColor Blue
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
    Write-Host ""
}

function Write-Step {
    param([string]$Message)
    Write-Host "▶ " -ForegroundColor Green -NoNewline
    Write-Host $Message
}

function Write-Success {
    param([string]$Message)
    Write-Host "✔ " -ForegroundColor Green -NoNewline
    Write-Host $Message
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠ " -ForegroundColor Yellow -NoNewline
    Write-Host $Message
}

function Write-Error {
    param([string]$Message)
    Write-Host "✖ " -ForegroundColor Red -NoNewline
    Write-Host $Message
}

# Get script directory and change to it
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Header "Void Server Update"

# Auto-stash uncommitted changes
$stashed = $false
$gitStatus = git status --porcelain 2>$null

if ($gitStatus) {
    Write-Step "Stashing local changes..."

    $stashResult = git stash push -m "void-update-auto-stash" --include-untracked 2>&1
    if ($LASTEXITCODE -eq 0) {
        $stashed = $true
        Write-Success "Changes stashed"
    } else {
        Write-Warning "Could not stash changes, trying git stash --all..."
        $stashResult = git stash --all 2>&1
        if ($LASTEXITCODE -eq 0) {
            $stashed = $true
            Write-Success "Changes stashed"
        } else {
            Write-Error "Failed to stash changes. Please commit or discard your changes first."
            exit 1
        }
    }
}

# Stop and delete PM2 services (ensures fresh config on restart)
Write-Step "Stopping services..."
pm2 delete void-server void-client 2>$null

# Stop old Docker containers (migration from Docker-only to hybrid)
Write-Step "Stopping old Docker containers..."
docker compose down 2>$null

# Pull latest code
Write-Step "Pulling latest code..."
git pull --rebase
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to pull latest code"
    exit 1
}

# Start fresh infrastructure containers
Write-Step "Starting infrastructure containers..."
docker compose pull
docker compose up -d

# Update npm dependencies
Write-Step "Updating server dependencies..."
npm install

Write-Step "Updating client dependencies..."
Push-Location client
npm install
Pop-Location

Write-Step "Rebuilding client..."
npm run build --prefix client

# Start PM2 with fresh config
Write-Step "Starting services..."
pm2 start ecosystem.config.js

Write-Host ""
pm2 status

# Restore stashed changes
if ($stashed) {
    Write-Step "Restoring stashed changes..."
    $popResult = git stash pop 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Could not auto-restore stash. Run 'git stash pop' manually."
    }
}

Write-Header "Update Complete!"

Write-Host "Void Server has been updated and restarted." -ForegroundColor Green
Write-Host ""
Write-Host "  App:     http://localhost:4420"
Write-Host "  Neo4j:   http://localhost:7474"
Write-Host "  IPFS:    http://localhost:5001"
Write-Host "  Ollama:  http://localhost:11434"
Write-Host ""
