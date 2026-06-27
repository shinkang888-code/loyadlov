# Loyard — Vercel Production 환경변수 동기화 (.env 기준)
# 사용: powershell -ExecutionPolicy Bypass -File scripts/vercel-env-sync.ps1
# SERVICE_ROLE_KEY는 Supabase Dashboard > Settings > API 에서 별도 추가

$ErrorActionPreference = "Stop"
$Scope = "shinkang888-codes-projects"
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

function Read-DotEnv([string]$Path) {
  $map = @{}
  if (-not (Test-Path $Path)) { return $map }
  Get-Content $Path | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
    if ($_ -match '^\s*([^=]+)=(.*)$') {
      $k = $matches[1].Trim()
      $v = $matches[2].Trim().Trim('"').Trim("'")
      if ($v) { $map[$k] = $v }
    }
  }
  return $map
}

$envMap = Read-DotEnv (Join-Path $Root ".env")
$envMap["APP_URL"] = "https://loyadbeta-omega.vercel.app"

$keys = @(
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_PROJECT_ID",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_PROJECT_ID",
  "APP_URL"
)

Write-Host "==> Vercel env sync (production)" -ForegroundColor Cyan
foreach ($key in $keys) {
  $val = $envMap[$key]
  if (-not $val) {
    Write-Host "  skip $key (empty)" -ForegroundColor Yellow
    continue
  }
  Write-Host "  add $key"
  $val | vercel env add $key production --scope $Scope --force 2>&1 | Out-Null
}

Write-Host "완료. SERVICE_ROLE_KEY는 Dashboard에서 수동 추가 후 재배포하세요." -ForegroundColor Green
