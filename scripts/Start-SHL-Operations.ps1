# SHL Operations OS: localhost launcher for Windows PowerShell 5.1+ / PowerShell 7+
# This script does not modify the GitHub repository or any existing .env file.
$ErrorActionPreference = 'Stop'

function New-SecureHex([int] $Bytes = 32) {
    $buffer = New-Object byte[] $Bytes
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($buffer) }
    finally { $rng.Dispose() }
    return [System.BitConverter]::ToString($buffer).Replace('-', '').ToLowerInvariant()
}

function Require-Command([string] $Name, [string] $InstallTip) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name is missing. $InstallTip"
    }
}

try {
    Require-Command 'git' 'Install Git for Windows: https://git-scm.com/downloads/win'
    Require-Command 'docker' 'Install Docker Desktop: https://www.docker.com/products/docker-desktop/'

    & docker info --format '{{.ServerVersion}}' *> $null
    if ($LASTEXITCODE -ne 0) {
        throw 'Docker Engine is not running. Open Docker Desktop, wait until it starts, then rerun this script.'
    }

    & docker compose version
    if ($LASTEXITCODE -ne 0) { throw 'Docker Compose is missing. Update Docker Desktop.' }

    $projectsDir = Join-Path $HOME 'Projects'
    $repoPath = Join-Path $projectsDir 'shl-operations'
    New-Item -ItemType Directory -Force -Path $projectsDir | Out-Null

    if (-not (Test-Path -LiteralPath $repoPath)) {
        Write-Host 'Cloning niloy-datta/shl-operations...' -ForegroundColor Cyan
        & git clone 'https://github.com/niloy-datta/shl-operations.git' $repoPath
        if ($LASTEXITCODE -ne 0) { throw 'Git clone failed. Check your internet connection and GitHub access.' }
    }
    elseif (-not (Test-Path -LiteralPath (Join-Path $repoPath '.git'))) {
        throw "Target folder exists but is not a Git repository: $repoPath"
    }
    else {
        Write-Host 'Updating the existing local checkout (no forced reset)...' -ForegroundColor Cyan
        & git -C $repoPath pull --ff-only
        if ($LASTEXITCODE -ne 0) { throw 'Git update failed; check your local changes before retrying.' }
    }

    Push-Location $repoPath
    try {
        if (-not (Test-Path -LiteralPath '.env')) {
            $example = Get-Content -LiteralPath '.env.example' -Raw
            $configured = $example.Replace('replace-with-a-long-random-password', (New-SecureHex))
            $configured = $configured.Replace('replace-with-a-unique-long-random-password', (New-SecureHex))
            $configured = $configured.Replace('replace-with-64-hex-characters-before-enabling-mfa', (New-SecureHex))
            $envFile = Join-Path $repoPath '.env'
            [System.IO.File]::WriteAllText($envFile, $configured, (New-Object System.Text.UTF8Encoding($false)))
            Write-Host 'Created .env with unique random passwords and MFA encryption key.' -ForegroundColor Green
        }
        else {
            Write-Host 'Existing .env preserved. Check it contains real passwords, not example placeholders.' -ForegroundColor Yellow
        }

        Write-Host 'Building and starting PostgreSQL, Spring Boot API and Next.js web app...' -ForegroundColor Cyan
        & docker compose up --build --wait --wait-timeout 360
        if ($LASTEXITCODE -ne 0) {
            throw 'Docker Compose failed. Diagnose with: docker compose logs --tail=100 db api web'
        }

        Write-Host ''
        Write-Host 'SHL Operations OS started successfully!' -ForegroundColor Green
        Write-Host 'URL: http://localhost:3000'
        Write-Host 'Admin username: admin (unless you changed .env)'
        Write-Host "Admin password: see BOOTSTRAP_ADMIN_PASSWORD in $repoPath\.env"
        Write-Host 'Do not commit or share the .env file or load real SHL data into this development system.' -ForegroundColor Yellow
        Start-Process 'http://localhost:3000'
    }
    finally { Pop-Location }
}
catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}