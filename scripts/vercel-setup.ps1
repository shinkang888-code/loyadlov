# Loyard — Vercel CLI 프로젝트 연결 + 환경 변수 pull
# 사용: npm run vercel:setup

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

Write-Host "==> Vercel link (loyadlov)" -ForegroundColor Cyan
vercel link --yes --project loyadlov 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Creating new Vercel project..."
  vercel link --yes
}

Write-Host "Pulling env from Vercel..."
vercel env pull .env.local --yes

Write-Host ""
Write-Host "Next: set these in Vercel dashboard or .env.local:" -ForegroundColor Yellow
Write-Host "  DATABASE_URL          (Neon pooled connection string)"
Write-Host "  NEON_AUTH_URL         (Neon Auth base URL)"
Write-Host "  NEON_PROJECT_ID       flat-moon-84891358"
Write-Host "  APP_URL               https://your-vercel-domain.vercel.app"
Write-Host ""
Write-Host "Deploy: npm run vercel:deploy" -ForegroundColor Green
