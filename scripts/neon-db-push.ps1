# Loyard — Neon DB 마이그레이션 적용
# 사용: npm run db:push
# 사전: neon auth (Neon CLI 로그인)

$ErrorActionPreference = "Stop"
$ProjectId = if ($env:NEON_PROJECT_ID) { $env:NEON_PROJECT_ID } else { "flat-moon-84891358" }
$Root = Split-Path $PSScriptRoot -Parent
$Migration = Join-Path $Root "neon\migrations\001_initial_schema.sql"

Write-Host "==> Neon schema push (project: $ProjectId)" -ForegroundColor Cyan

if (-not (Test-Path $Migration)) {
  Write-Error "Migration file not found: $Migration"
}

$conn = neon connection-string $ProjectId --pooled 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Error "neon connection-string failed. Run: neon auth"
}

Write-Host "Applying $Migration ..."
Get-Content $Migration -Raw | neon sql --project-id $ProjectId --file -

Write-Host "Done." -ForegroundColor Green
