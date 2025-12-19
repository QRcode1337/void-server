# Void Server - Update Script for Windows
# Supports both git repos and zip downloads.

$ErrorActionPreference = "Stop"

$RepoUrl = "https://github.com/ClawedCode/void-server"

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

function Write-ErrorMsg {
    param([string]$Message)
    Write-Host "✖ " -ForegroundColor Red -NoNewline
    Write-Host $Message
}

# Get script directory and change to it
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Header "Void Server Update"

# Stop and delete PM2 services (ensures fresh config on restart)
Write-Step "Stopping services..."
pm2 delete void-server void-client 2>$null

# Stop old Docker containers (migration from Docker-only to hybrid)
Write-Step "Stopping old Docker containers..."
docker compose down --remove-orphans 2>$null
# Explicitly stop void-server container if it exists (handles different compose project names)
docker stop void-server 2>$null
docker rm void-server 2>$null

$RestoreStash = $false

# Check if this is a git repo or zip download
if (Test-Path ".git") {
    # Git repo - use git pull
    Write-Step "Detected git repository"

    # Auto-stash uncommitted changes
    $gitStatus = git status --porcelain 2>$null

    if ($gitStatus) {
        Write-Step "Stashing local changes..."
        $stashResult = git stash push -m "void-update-auto-stash" --include-untracked 2>&1
        if ($LASTEXITCODE -eq 0) {
            $RestoreStash = $true
            Write-Success "Changes stashed"
        } else {
            Write-Warning "Could not stash changes, continuing anyway..."
        }
    }

    Write-Step "Pulling latest code..."
    git pull --rebase
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorMsg "Failed to pull latest code"
        exit 1
    }
} else {
    # Zip download - fetch latest release
    Write-Step "Detected zip installation (no .git directory)"
    Write-Step "Downloading latest release..."

    # Get latest release tag from GitHub API
    try {
        $releaseInfo = Invoke-RestMethod -Uri "https://api.github.com/repos/ClawedCode/void-server/releases/latest"
        $latestTag = $releaseInfo.tag_name
    } catch {
        Write-ErrorMsg "Could not fetch latest release version"
        exit 1
    }

    Write-Success "Latest version: $latestTag"

    # Download and extract to temp directory
    $tempDir = New-Item -ItemType Directory -Path ([System.IO.Path]::GetTempPath()) -Name "void-update-$(Get-Random)"
    $zipUrl = "$RepoUrl/archive/refs/tags/$latestTag.zip"
    $zipPath = Join-Path $tempDir "release.zip"

    Write-Step "Downloading $zipUrl..."
    Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath

    Write-Step "Extracting..."
    Expand-Archive -Path $zipPath -DestinationPath $tempDir -Force

    # Find extracted directory
    $extractedDir = Get-ChildItem -Path $tempDir -Directory | Where-Object { $_.Name -like "void-server-*" } | Select-Object -First 1

    if (-not $extractedDir) {
        Write-ErrorMsg "Could not find extracted directory"
        Remove-Item -Recurse -Force $tempDir
        exit 1
    }

    # Preserve data directory
    $dataBackup = $null
    if (Test-Path "data") {
        Write-Step "Preserving data directory..."
        $dataBackup = Join-Path $tempDir "data_backup"
        Move-Item -Path "data" -Destination $dataBackup
    }

    # Preserve .env file
    $envBackup = $null
    if (Test-Path ".env") {
        Write-Step "Preserving .env file..."
        $envBackup = Join-Path $tempDir ".env_backup"
        Copy-Item -Path ".env" -Destination $envBackup
    }

    # Copy new files
    Write-Step "Updating files..."
    Get-ChildItem -Path $extractedDir.FullName | ForEach-Object {
        if ($_.Name -ne "data" -and $_.Name -ne ".env") {
            Copy-Item -Path $_.FullName -Destination $ScriptDir -Recurse -Force
        }
    }

    # Restore data directory
    if ($dataBackup -and (Test-Path $dataBackup)) {
        Move-Item -Path $dataBackup -Destination "data"
        Write-Success "Data directory restored"
    }

    # Restore .env file
    if ($envBackup -and (Test-Path $envBackup)) {
        Move-Item -Path $envBackup -Destination ".env"
        Write-Success ".env file restored"
    }

    # Cleanup
    Remove-Item -Recurse -Force $tempDir
    Write-Success "Updated to $latestTag"
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

# Restore stashed changes (git only)
if ($RestoreStash) {
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
