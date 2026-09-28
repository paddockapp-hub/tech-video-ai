@echo off
echo ========================================
echo   GPT 로컬 내장 자동 설치 프로그램
echo ========================================
echo.

echo [1/4] Ollama 설치 확인...
where ollama >nul 2>&1
if %errorlevel% neq 0 (
    echo Ollama가 설치되지 않았습니다.
    echo 브라우저가 열립니다. Ollama를 다운로드하고 설치해주세요.
    start https://ollama.ai/download
    echo.
    echo 설치 완료 후 이 스크립트를 다시 실행해주세요.
    pause
    exit /b
) else (
    echo [완료] Ollama가 이미 설치되어 있습니다.
)

echo.
echo [2/4] Llama3.2 모델 다운로드...
echo 이 과정은 몇 분 정도 소요될 수 있습니다.
ollama pull llama3.2
if %errorlevel% neq 0 (
    echo [오류] 모델 다운로드 실패
    pause
    exit /b
)
echo [완료] 모델 다운로드 완료

echo.
echo [3/4] Ollama 서버 시작 확인...
curl -s http://localhost:11434/api/tags >nul 2>&1
if %errorlevel% neq 0 (
    echo Ollama 서버를 시작합니다...
    start ollama serve
    timeout /t 5 /nobreak >nul
)
echo [완료] Ollama 서버가 실행 중입니다

echo.
echo [4/4] 연결 테스트...
curl -s -X POST http://localhost:11434/api/generate -d "{\"model\": \"llama3.2\", \"prompt\": \"Hello\", \"stream\": false}" >nul 2>&1
if %errorlevel% equ 0 (
    echo [완료] GPT 로컬 내장 성공!
) else (
    echo [오류] 연결 실패
    pause
    exit /b
)

echo.
echo ========================================
echo   설치 완료!
echo ========================================
echo.
echo Localhost 주소: http://localhost:11434
echo 프로젝트 경로: %CD%
echo.
echo 이제 다음 명령어로 실행할 수 있습니다:
echo py -3.14 src/main.py example_script.md --mode images
echo.
pause