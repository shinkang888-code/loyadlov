# Loyard — Supabase 원격 DB 마이그레이션 푸시
# 사용:
#   1) supabase login  (또는 $env:SUPABASE_ACCESS_TOKEN 설정 후 supabase login --token $env:SUPABASE_ACCESS_TOKEN)
#   2) $env:SUPABASE_DB_PASSWORD = "프로젝트 DB 비밀번호"
#   3) powershell -ExecutionPolicy Bypass -File scripts/supabase-db-push.ps1

$ErrorActionPreference = "Stop"
$ProjectRef = "gkujmiunthufnldawgpu"
$Root = Split-Path $PSScriptRoot -Parent

Set-Location $Root

Write-Host "==> Supabase link ($ProjectRef)" -ForegroundColor Cyan
if (-not $env:SUPABASE_DB_PASSWORD) {
  Write-Host "SUPABASE_DB_PASSWORD 환경변수가 없습니다." -ForegroundColor Yellow
  Write-Host "Dashboard > Project Settings > Database > Database password 를 설정하세요."
  $secure = Read-Host "DB 비밀번호 입력" -AsSecureString
  $env:SUPABASE_DB_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  )
}

supabase link --project-ref $ProjectRef --password $env:SUPABASE_DB_PASSWORD --yes

Write-Host "==> 마이그레이션 dry-run" -ForegroundColor Cyan
supabase db push --dry-run --linked

Write-Host "==> 마이그레이션 적용" -ForegroundColor Cyan
supabase db push --linked --yes

Write-Host "완료." -ForegroundColor Green
