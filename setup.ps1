# Void Server - Setup Script for Windows
# Run this to bootstrap the project. Safe to run multiple times (idempotent).
# Prefers Docker installation, falls back to native if Docker unavailable.

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

function Write-Skip {
    param([string]$Message)
    Write-Host "○ " -ForegroundColor Cyan -NoNewline
    Write-Host "$Message " -NoNewline
    Write-Host "(already done)" -ForegroundColor Cyan
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

function Prompt-YesNo {
    param(
        [string]$Prompt,
        [string]$Default = "n"
    )

    if ($Default -eq "y") {
        $options = "[Y/n]"
    } else {
        $options = "[y/N]"
    }

    $response = Read-Host "$Prompt $options"
    if ([string]::IsNullOrWhiteSpace($response)) {
        $response = $Default
    }

    return $response -match "^[Yy]$"
}

function Test-WingetAvailable {
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    return $null -ne $winget
}

function Test-DockerAvailable {
    $docker = Get-Command docker -ErrorAction SilentlyContinue
    if (-not $docker) {
        return $false
    }
    # Check if Docker daemon is running
    try {
        $null = docker info 2>$null
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

function Start-DockerSetup {
    Write-Header "Starting with Docker Compose"

    Write-Step "Pulling latest images and starting containers..."
    docker compose pull
    docker compose up -d --build

    Write-Host ""
    Write-Success "Void Server is running with Docker!"
    Write-Host ""
    Write-Host "  App:     http://localhost:4420"
    Write-Host "  Neo4j:   http://localhost:4421"
    Write-Host ""
    Write-Host "Commands:" -ForegroundColor Cyan
    Write-Host "  docker compose logs -f    View logs"
    Write-Host "  docker compose restart    Restart services"
    Write-Host "  docker compose down       Stop services"
    Write-Host ""
    Write-Host "Streaming logs (Ctrl+C to exit)..." -ForegroundColor Cyan
    Write-Host ""
    docker compose logs -f
    exit 0
}

function Install-NodeJS {
    Write-Step "Installing Node.js..."

    $installed = $false

    if (Test-WingetAvailable) {
        Write-Step "Using winget to install Node.js..."
        # Try different package IDs (winget IDs can vary)
        $packageIds = @("OpenJS.NodeJS.LTS", "OpenJS.NodeJS", "nodejs.nodejs")

        foreach ($packageId in $packageIds) {
            Write-Step "Trying package: $packageId"
            winget install $packageId --accept-package-agreements --accept-source-agreements 2>$null
            if ($LASTEXITCODE -eq 0) {
                $installed = $true
                break
            }
        }

        if ($installed) {
            # Refresh PATH
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
            Write-Success "Node.js installed successfully"
            Write-Warning "You may need to restart your terminal for PATH changes to take effect."
            return
        } else {
            Write-Warning "winget installation failed. Falling back to browser download..."
        }
    }

    # Fallback to browser download
    Write-Step "Opening Node.js download page..."
    Start-Process "https://nodejs.org/en/download/"
    Write-Host ""
    Write-Host "Please download and install Node.js LTS, then run this script again." -ForegroundColor Yellow
    exit 1
}

function Install-Neo4j {
    Write-Step "Installing Neo4j..."

    # Neo4j is not reliably available via winget, go straight to download
    Write-Step "Opening Neo4j Desktop download page..."
    Start-Process "https://neo4j.com/download/"
    Write-Host ""
    Write-Host "Please download and install Neo4j Desktop, then:" -ForegroundColor Yellow
    Write-Host "  1. Create a new project" -ForegroundColor Yellow
    Write-Host "  2. Add a local database" -ForegroundColor Yellow
    Write-Host "  3. Start the database" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Default credentials: neo4j / neo4j (you'll be prompted to change)" -ForegroundColor Cyan
    return $false
}

function Start-Neo4jService {
    Write-Step "Starting Neo4j..."

    # Try Windows service
    $service = Get-Service -Name "neo4j" -ErrorAction SilentlyContinue
    if ($service) {
        Start-Service -Name "neo4j" -ErrorAction SilentlyContinue
        Write-Success "Neo4j service started"
        return
    }

    # Try neo4j console command
    $neo4j = Get-Command neo4j -ErrorAction SilentlyContinue
    if ($neo4j) {
        Start-Process -FilePath "neo4j" -ArgumentList "console" -WindowStyle Minimized
        Write-Success "Neo4j started in background"
        return
    }

    Write-Warning "Please start Neo4j manually using Neo4j Desktop or the neo4j command"
}

# Get script directory and change to it
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Header "Void Server Setup"

Write-Step "Detected OS: Windows"

# Check for Docker first (preferred installation method)
Write-Step "Checking for Docker..."

if (Test-DockerAvailable) {
    Write-Success "Docker is installed and running"
    Write-Host ""
    Write-Host "Docker detected!" -ForegroundColor Green -NoNewline
    Write-Host " This is the recommended way to run Void Server."
    Write-Host "It includes Neo4j and all dependencies in containers."
    Write-Host ""

    if (Prompt-YesNo "Would you like to run with Docker? (Recommended)" "y") {
        Start-DockerSetup
    } else {
        Write-Step "Continuing with native installation..."
    }
} else {
    Write-Warning "Docker not detected or not running"
    Write-Host ""
    Write-Host "Docker Desktop is the easiest way to run Void Server."
    Write-Host "It includes Neo4j and all dependencies with a single command."
    Write-Host ""
    Write-Host "Download Docker Desktop: " -NoNewline
    Write-Host "https://www.docker.com/products/docker-desktop/" -ForegroundColor Cyan
    Write-Host ""

    if (Prompt-YesNo "Would you like to install Docker Desktop? (Opens download page)" "y") {
        Start-Process "https://www.docker.com/products/docker-desktop/"
        Write-Host ""
        Write-Warning "After installing Docker Desktop, run this script again."
        Write-Host ""

        if (-not (Prompt-YesNo "Continue with native installation instead?" "n")) {
            exit 0
        }
    }
    Write-Step "Continuing with native installation..."
}

Write-Host ""

# Check prerequisites for native installation
Write-Step "Checking prerequisites..."

# Check git
$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) {
    Write-Error "git is not installed."
    Write-Host "         Install from: " -NoNewline
    Write-Host "https://git-scm.com/download/win" -ForegroundColor Cyan
    Write-Host "         Or with winget: " -NoNewline
    Write-Host "winget install Git.Git" -ForegroundColor Cyan
    exit 1
}

# Check Node.js
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Warning "Node.js is not installed."
    Write-Host ""

    if (Prompt-YesNo "Would you like to install Node.js automatically?" "y") {
        Install-NodeJS

        # Re-check after install
        $node = Get-Command node -ErrorAction SilentlyContinue
        if (-not $node) {
            Write-Error "Node.js installation may require a terminal restart."
            Write-Host "Please restart your terminal and run this script again." -ForegroundColor Yellow
            exit 1
        }
    } else {
        Write-Error "Node.js is required. Please install Node.js 18+ and try again."
        Write-Host "         Download from: " -NoNewline
        Write-Host "https://nodejs.org/" -ForegroundColor Cyan
        exit 1
    }
}

$nodeVersion = (node -v) -replace 'v', '' -split '\.' | Select-Object -First 1
if ([int]$nodeVersion -lt 18) {
    Write-Warning "Node.js version $nodeVersion detected. Version 18+ recommended."

    if (Prompt-YesNo "Would you like to upgrade Node.js?" "y") {
        Install-NodeJS
    }
}

# Check npm
$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npm) {
    Write-Error "npm is not installed. Please install npm and try again."
    exit 1
}

$nodeVer = node -v
$npmVer = npm -v
Write-Success "Node.js $nodeVer, npm $npmVer"

# Check for Neo4j (optional)
$neo4jInstalled = $false
$neo4j = Get-Command neo4j -ErrorAction SilentlyContinue
$cypherShell = Get-Command cypher-shell -ErrorAction SilentlyContinue
$neo4jService = Get-Service -Name "neo4j" -ErrorAction SilentlyContinue

if ($neo4j) {
    $neo4jInstalled = $true
    Write-Success "Neo4j found"
} elseif ($cypherShell) {
    $neo4jInstalled = $true
    Write-Success "Neo4j found (via cypher-shell)"
} elseif ($neo4jService) {
    $neo4jInstalled = $true
    Write-Success "Neo4j service detected"
} elseif (Test-Path "$env:PROGRAMFILES\Neo4j*") {
    $neo4jInstalled = $true
    Write-Success "Neo4j installation detected"
} else {
    Write-Warning "Neo4j not detected. Memory features require Neo4j."
    Write-Host ""

    if (Prompt-YesNo "Would you like to install Neo4j automatically?" "y") {
        if (Install-Neo4j) {
            $neo4jInstalled = $true

            if (Prompt-YesNo "Would you like to start Neo4j now?" "y") {
                Start-Neo4jService
                Write-Host ""
                Write-Warning "Default Neo4j credentials: neo4j / neo4j"
                Write-Warning "You'll be prompted to change the password on first login."
                Write-Host "         Neo4j Browser: " -NoNewline
                Write-Host "http://localhost:7474" -ForegroundColor Cyan
                Write-Host ""
            }
        }
    } else {
        Write-Warning "Skipping Neo4j installation. Memory features will be disabled."
        Write-Host "         Install later from: " -NoNewline
        Write-Host "https://neo4j.com/download/" -ForegroundColor Cyan
    }
}

# Install server dependencies
$serverModulesExists = Test-Path "node_modules"
$packageJsonTime = (Get-Item "package.json").LastWriteTime
$nodeModulesTime = if ($serverModulesExists) { (Get-Item "node_modules").LastWriteTime } else { [DateTime]::MinValue }

if ($serverModulesExists -and $nodeModulesTime -gt $packageJsonTime) {
    Write-Skip "Server dependencies installed"
} else {
    Write-Step "Installing server dependencies..."
    npm install --silent 2>$null
    Write-Success "Server dependencies installed"
}

# Install client dependencies
$clientModulesExists = Test-Path "client/node_modules"
$clientPackageTime = (Get-Item "client/package.json").LastWriteTime
$clientModulesTime = if ($clientModulesExists) { (Get-Item "client/node_modules").LastWriteTime } else { [DateTime]::MinValue }

if ($clientModulesExists -and $clientModulesTime -gt $clientPackageTime) {
    Write-Skip "Client dependencies installed"
} else {
    Write-Step "Installing client dependencies..."
    Push-Location client
    npm install --silent 2>$null
    Pop-Location
    Write-Success "Client dependencies installed"
}

# Install plugin dependencies
$pluginCount = 0
Get-ChildItem -Path "plugins" -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $pluginDir = $_.FullName
    $pluginName = $_.Name
    $pluginPackage = Join-Path $pluginDir "package.json"

    if (Test-Path $pluginPackage) {
        $pluginModules = Join-Path $pluginDir "node_modules"
        $pluginModulesExists = Test-Path $pluginModules
        $pluginPackageTime = (Get-Item $pluginPackage).LastWriteTime
        $pluginModulesTime = if ($pluginModulesExists) { (Get-Item $pluginModules).LastWriteTime } else { [DateTime]::MinValue }

        if ($pluginModulesExists -and $pluginModulesTime -gt $pluginPackageTime) {
            Write-Skip "Plugin $pluginName dependencies installed"
        } else {
            Write-Step "Installing $pluginName dependencies..."
            Push-Location $pluginDir
            npm install --silent 2>$null
            Pop-Location
            Write-Success "Plugin $pluginName dependencies installed"
        }
        $script:pluginCount++
    }
}

if ($pluginCount -eq 0) {
    Write-Skip "No plugins with dependencies"
}

# Create necessary directories
@("logs", "config", "plugins") | ForEach-Object {
    if (-not (Test-Path $_)) {
        New-Item -ItemType Directory -Path $_ | Out-Null
        Write-Step "Created $_/"
    }
}

# Initialize config files
if (-not (Test-Path "config/plugins.json")) {
    Write-Step "Creating default plugin config..."
    "{}" | Out-File -FilePath "config/plugins.json" -Encoding utf8
} else {
    Write-Skip "Plugin config exists"
}

if (-not (Test-Path "config/secrets-allowlist.json")) {
    Write-Step "Creating secrets allowlist..."
    @"
{
  "description": "Allowlist for secret scanning false positives",
  "version": "1.0.0",
  "patterns": [],
  "files": [],
  "hashes": []
}
"@ | Out-File -FilePath "config/secrets-allowlist.json" -Encoding utf8
} else {
    Write-Skip "Secrets allowlist exists"
}

# PM2 setup
Write-Header "Starting Services with PM2"

# Stop any existing instances
Write-Step "Stopping existing instances..."
npx pm2 delete ecosystem.config.js 2>$null
# Ignore errors from pm2 delete

# Start with PM2
Write-Step "Starting void-server (4401) and void-client dev (4480)..."
npx pm2 start ecosystem.config.js --env development

# Save PM2 process list
Write-Step "Saving PM2 process list..."
npx pm2 save

# Show status
Write-Host ""
npx pm2 status

# Summary
Write-Header "Setup Complete!"

Write-Host "Void Server is running!" -ForegroundColor Green
Write-Host ""
Write-Host "  API:     http://localhost:4401"
Write-Host "  Client:  http://localhost:4480 (Vite dev server with HMR)"
if ($neo4jInstalled) {
    Write-Host "  Neo4j:   http://localhost:7474"
}
Write-Host ""
Write-Host "Commands:" -ForegroundColor Cyan
Write-Host "  npm run logs      View logs"
Write-Host "  npm run status    Check status"
Write-Host "  npm run restart   Restart services"
Write-Host "  npm run stop      Stop services"
Write-Host ""
Write-Host "Streaming logs (Ctrl+C to exit)..." -ForegroundColor Cyan
Write-Host ""
npx pm2 logs
