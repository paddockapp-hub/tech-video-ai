# GPT 로컬 내장 자동 설치 PowerShell 스크립트

Write-Host "========================================"  -ForegroundColor Green
Write-Host "  GPT 로컬 내장 자동 설치 프로그램"  -ForegroundColor Green
Write-Host "========================================"  -ForegroundColor Green
Write-Host ""

# 1단계: Ollama 설치 확인
Write-Host "[1/4] Ollama 설치 확인..." -ForegroundColor Yellow
$ollamaCheck = Get-Command ollama -ErrorAction SilentlyContinue

if (-not $ollamaCheck) {
    Write-Host "Ollama가 설치되지 않았습니다." -ForegroundColor Red
    Write-Host "브라우저가 열립니다. Ollama를 다운로드하고 설치해주세요." -ForegroundColor Yellow
    Start-Process "https://ollama.ai/download"
    Write-Host ""
    Write-Host "설치 완료 후 이 스크립트를 다시 실행해주세요." -ForegroundColor Yellow
    Read-Host "Enter를 눌러 종료"
    exit
} else {
    Write-Host "[완료] Ollama가 이미 설치되어 있습니다." -ForegroundColor Green
}

Write-Host ""
Write-Host "[2/4] Llama3.2 모델 다운로드..." -ForegroundColor Yellow
Write-Host "이 과정은 몇 분 정도 소요될 수 있습니다." -ForegroundColor Yellow

$modelCheck = ollama list | Select-String "llama3.2"
if ($modelCheck) {
    Write-Host "[완료] Llama3.2 모델이 이미 다운로드되어 있습니다." -ForegroundColor Green
} else {
    ollama pull llama3.2
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[오류] 모델 다운로드 실패" -ForegroundColor Red
        Read-Host "Enter를 눌러 종료"
        exit
    }
    Write-Host "[완료] 모델 다운로드 완료" -ForegroundColor Green
}

Write-Host ""
Write-Host "[3/4] Ollama 서버 시작 확인..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -UseBasicParsing -TimeoutSec 5
    Write-Host "[완료] Ollama 서버가 이미 실행 중입니다." -ForegroundColor Green
} catch {
    Write-Host "Ollama 서버를 시작합니다..." -ForegroundColor Yellow
    Start-Process "ollama" -ArgumentList "serve"
    Start-Sleep -Seconds 5
    Write-Host "[완료] Ollama 서버가 시작되었습니다." -ForegroundColor Green
}

Write-Host ""
Write-Host "[4/4] 연결 테스트..." -ForegroundColor Yellow

try {
    $body = @{
        model = "llama3.2"
        prompt = "Hello"
        stream = $false
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "http://localhost:11434/api/generate" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 30
    
    if ($response.StatusCode -eq 200) {
        Write-Host "[완료] GPT 로컬 내장 성공!" -ForegroundColor Green
    } else {
        Write-Host "[오류] 연결 실패" -ForegroundColor Red
        Read-Host "Enter를 눌러 종료"
        exit
    }
} catch {
    Write-Host "[오류] 연결 테스트 실패: $_" -ForegroundColor Red
    Read-Host "Enter를 눌러 종료"
    exit
}

Write-Host ""
Write-Host "========================================"  -ForegroundColor Green
Write-Host "  설치 완료!"  -ForegroundColor Green
Write-Host "========================================"  -ForegroundColor Green
Write-Host ""
Write-Host "Localhost 주소: http://localhost:11434" -ForegroundColor Cyan
Write-Host "프로젝트 경로: $PWD" -ForegroundColor Cyan
Write-Host ""
Write-Host "이제 다음 명령어로 실행할 수 있습니다:" -ForegroundColor Yellow
Write-Host "py -3.14 src/main.py example_script.md --mode images" -ForegroundColor Cyan
Write-Host ""
Read-Host "Enter를 눌러 종료"