# Google Drive 등 비-NTFS 경로에서 로컬 개발 환경을 C: 드라이브에 준비합니다.
# 사용: npm run setup:dev  또는  powershell -File scripts/setup-dev.ps1

$ErrorActionPreference = "Stop"
$DevRoot = "C:\Users\user\dev\loyadbeta"
$RepoUrl = "https://github.com/shinkang888-code/loyadbeta.git"

Write-Host "==> Loyard 로컬 개발 환경 (C: 드라이브)" -ForegroundColor Cyan

if (-not (Test-Path $DevRoot)) {
  Write-Host "클론: $RepoUrl -> $DevRoot"
  git clone $RepoUrl $DevRoot
} else {
  Write-Host "업데이트: $DevRoot"
  Set-Location $DevRoot
  git pull origin main
}

Set-Location $DevRoot
Write-Host "의존성 설치 (npm ci)..."
npm ci

Write-Host ""
Write-Host "완료. 아래에서 개발 서버를 실행하세요:" -ForegroundColor Green
Write-Host "  cd $DevRoot"
Write-Host "  npm run dev"
Write-Host ""
Write-Host "Google Drive 워크스페이스에서 코드를 수정한 뒤, C: 클론에서 git pull 하거나 변경사항을 커밋/푸시하세요."
