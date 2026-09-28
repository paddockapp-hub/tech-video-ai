@echo off
chcp 65001 >nul
echo Stable Diffusion WebUI 자동 설치 스크립트
echo ================================================
echo.

echo [1/5] Git 설치 확인...
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo Git이 설치되지 않았습니다. https://git-scm.com/download/win 에서 설치해주세요.
    pause
    exit /b 1
)
echo Git 설치 확인 완료!
echo.

echo [2/5] Python 3.12 설치 확인...
py -3.12 --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python 3.12이 설치되지 않았습니다.
    pause
    exit /b 1
)
echo Python 3.12 설치 확인 완료!
echo.

echo [3/5] Stable Diffusion WebUI 다운로드...
if not exist "stable-diffusion-webui" (
    git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui.git
    if %errorlevel% neq 0 (
        echo Git 다운로드 실패!
        pause
        exit /b 1
    )
    echo Stable Diffusion WebUI 다운로드 완료!
) else (
    echo 이미 다운로드되어 있습니다.
)
echo.

echo [4/5] WebUI 설정 파일 수정...
cd stable-diffusion-webui

if not exist "webui-user.bat" (
    echo webui-user.bat 파일이 없습니다.
    cd ..
    pause
    exit /b 1
)

echo webui-user.bat 수정 중...
echo @echo off > webui-user-setup.bat
echo set PYTHON=py -3.12 >> webui-user-setup.bat
echo set GIT=git >> webui-user-setup.bat
echo set VENV_DIR=venv >> webui-user-setup.bat
echo set COMMANDLINE_ARGS=--api --listen --port 7860 >> webui-user-setup.bat
echo call webui.bat >> webui-user-setup.bat

echo WebUI 설정 완료!
echo.

echo [5/5] WebUI 첫 실행...
echo 이 과정은 첫 실행 시 시간이 오래 걸릴 수 있습니다 (10-30분)
echo.
echo WebUI를 시작하려면 아래 명령어를 실행하세요:
echo cd stable-diffusion-webui
echo webui-user-setup.bat
echo.
echo 설치 완료!
pause