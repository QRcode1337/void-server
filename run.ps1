# Void Server - Run Script for Windows
# Prefers Docker, falls back to PM2/native if Docker unavailable.

$ErrorActionPreference = "Stop"

# Get script directory and change to it
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

function Test-DockerAvailable {
    $docker = Get-Command docker -ErrorAction SilentlyContinue
    if (-not $docker) {
        return $false
    }
    try {
        $null = docker info 2>$null
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

function Start-Docker {
    Write-Host "▶ " -ForegroundColor Green -NoNewline
    Write-Host "Building latest Docker image..."
    docker compose build

    Write-Host "▶ " -ForegroundColor Green -NoNewline
    Write-Host "Starting Void Server with Docker..."
    docker compose up -d

    Write-Host ""
    docker compose ps

    Write-Host ""
    Write-Host "Void Server is running with Docker!" -ForegroundColor Green
    Write-Host ""
    Write-Host "  App:     http://localhost:4420"
    Write-Host "  Neo4j:   http://localhost:4421"
    Write-Host ""
    Write-Host "Streaming logs (Ctrl+C to exit)..." -ForegroundColor Cyan
    Write-Host ""
    docker compose logs -f
}

function Start-Native {
    $pid = npx pm2 pid void-server 2>$null

    if ($pid) {
        Write-Host "▶ " -ForegroundColor Green -NoNewline
        Write-Host "Void Server is already running. Restarting..."
        npx pm2 restart ecosystem.config.js
    } else {
        Write-Host "▶ " -ForegroundColor Green -NoNewline
        Write-Host "Starting Void Server..."
        npx pm2 start ecosystem.config.js
    }

    Write-Host ""
    npx pm2 status

    Write-Host ""
    Write-Host "Void Server is running!" -ForegroundColor Green
    Write-Host ""
    Write-Host "  API:     http://localhost:4401"
    Write-Host "  Client:  http://localhost:4480"
    Write-Host ""
    Write-Host "Streaming logs (Ctrl+C to exit)..." -ForegroundColor Cyan
    Write-Host ""
    npx pm2 logs
}

# Main
if (Test-DockerAvailable) {
    Start-Docker
} else {
    Write-Host "Docker not available, using PM2..." -ForegroundColor Yellow
    Start-Native
}
