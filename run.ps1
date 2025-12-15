# Void Server - Run Script for Windows
# Start the server and client with PM2.

$ErrorActionPreference = "Stop"

# Get script directory and change to it
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# Check if already running
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
