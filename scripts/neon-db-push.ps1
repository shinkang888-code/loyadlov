# Loyard — Neon DB 마이그레이션 적용
# 사용: npm run db:push
# 사전: vercel env pull .env.vercel  (또는 DATABASE_URL 설정)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$From = if ($args[0]) { $args[0] } else { "" }

Write-Host "==> Neon migrations" -ForegroundColor Cyan

if (-not (Test-Path (Join-Path $Root ".env.vercel")) -and -not $env:DATABASE_URL) {
  Write-Host "Pulling Vercel env..." -ForegroundColor Yellow
  vercel env pull (Join-Path $Root ".env.vercel") --yes | Out-Null
}

$nodeArgs = @("scripts/apply-neon-migrations.mjs")
if ($From) { $nodeArgs += "--from=$From" }

Push-Location $Root
node @nodeArgs
Pop-Location

Write-Host "Verify:" -ForegroundColor Cyan
node (Join-Path $Root "scripts/verify-neon-migration.mjs")

Write-Host "Done." -ForegroundColor Green
