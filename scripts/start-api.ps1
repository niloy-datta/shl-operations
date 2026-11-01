$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$configPath = Join-Path $repoRoot '.env'
if (-not (Test-Path -LiteralPath $configPath)) { throw 'Copy .env.example to .env and configure the local API first.' }
foreach ($line in Get-Content -LiteralPath $configPath) {
    if ($line -match '^([A-Z][A-Z0-9_]*)=(.*)$') {
        [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2].Trim(), 'Process')
    }
}
$mavenCommand = Get-Command mvn.cmd -ErrorAction SilentlyContinue
if ($mavenCommand) { $mavenPath = $mavenCommand.Source }
else {
    $wrapperRoot = Join-Path $env:USERPROFILE '.m2/wrapper/dists'
    $mavenPath = Get-ChildItem -LiteralPath $wrapperRoot -Filter mvn.cmd -Recurse -ErrorAction SilentlyContinue |
        Select-Object -First 1 -ExpandProperty FullName
}
if (-not $mavenPath) { throw 'Install Java 21 and Maven 3.9+, then put mvn on PATH.' }
Push-Location (Join-Path $repoRoot 'apps/api')
try { & $mavenPath -B spring-boot:run '-Dspring-boot.run.arguments=--debug=false'; exit $LASTEXITCODE }
finally { Pop-Location }
