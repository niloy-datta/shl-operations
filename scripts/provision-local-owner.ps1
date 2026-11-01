param(
    [Parameter(Mandatory=$true)][guid]$SupabaseUserId,
    [Parameter(Mandatory=$true)][ValidatePattern('^[A-Za-z0-9._-]{3,80}$')][string]$Username
)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$config = Get-Content -LiteralPath (Join-Path $repoRoot '.env')
if (-not ($config -contains 'DB_URL=jdbc:postgresql://localhost:55433/northstar')) {
    throw 'This helper only provisions the default isolated local database on port 55433.'
}
$sql = @'
BEGIN;
SELECT pg_advisory_xact_lock(78120401);
INSERT INTO staff_users(id,username,role,enabled,supabase_user_id,mfa_required)
SELECT :'identity'::uuid, :'username', 'ADMIN', true, :'identity'::uuid, true
WHERE NOT EXISTS (SELECT 1 FROM staff_users WHERE role='ADMIN' AND enabled=true)
ON CONFLICT DO NOTHING;
SELECT username,role,enabled,mfa_required FROM staff_users WHERE supabase_user_id=:'identity'::uuid;
COMMIT;
'@
$dockerArgs = @('exec','-i','northstar-postgres','psql','-U','postgres','-d','northstar','-v','ON_ERROR_STOP=1','-v',"identity=$SupabaseUserId",'-v',"username=$Username")
if (Get-Command docker.exe -ErrorAction SilentlyContinue) { $sql | docker.exe @dockerArgs }
else { $sql | wsl.exe -d Ubuntu -- docker @dockerArgs }
if ($LASTEXITCODE -ne 0) { throw 'Local owner provisioning failed. No existing administrator was replaced.' }
