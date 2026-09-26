# Stable Diffusion WebUI Automatic Installation Script
Write-Host "Stable Diffusion WebUI Automatic Installation Script" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""

# [1/5] Check Git installation
Write-Host "[1/5] Checking Git installation..." -ForegroundColor Yellow
try {
    $gitVersion = git --version
    Write-Host "Git installation confirmed: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "Git is not installed. Please install from https://git-scm.com/download/win" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host ""

# [2/5] Check Python 3.12 installation
Write-Host "[2/5] Checking Python 3.12 installation..." -ForegroundColor Yellow
try {
    $pythonVersion = py -3.12 --version
    Write-Host "Python 3.12 installation confirmed: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "Python 3.12 is not installed." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host ""

# [3/5] Download Stable Diffusion WebUI
Write-Host "[3/5] Downloading Stable Diffusion WebUI..." -ForegroundColor Yellow
if (-not (Test-Path "stable-diffusion-webui")) {
    git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui.git
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Git download failed!" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host "Stable Diffusion WebUI download completed!" -ForegroundColor Green
} else {
    Write-Host "Already downloaded." -ForegroundColor Yellow
}
Write-Host ""

# [4/5] Modify WebUI configuration file
Write-Host "[4/5] Modifying WebUI configuration file..." -ForegroundColor Yellow
Set-Location stable-diffusion-webui

if (-not (Test-Path "webui-user.bat")) {
    Write-Host "webui-user.bat file not found." -ForegroundColor Red
    Set-Location ..
    Read-Host "Press Enter to exit"
    exit 1
}

# Create webui-user-setup.bat
$setupContent = @"
@echo off
set PYTHON=py -3.12
set GIT=git
set VENV_DIR=venv
set COMMANDLINE_ARGS=--api --listen --port 7860
call webui.bat
"@

$setupContent | Out-File -FilePath "webui-user-setup.bat" -Encoding ASCII
Write-Host "WebUI configuration completed!" -ForegroundColor Green
Write-Host ""

# [5/5] Installation completed
Write-Host "[5/5] Installation completed!" -ForegroundColor Green
Write-Host ""
Write-Host "To start WebUI, run the following commands:" -ForegroundColor Cyan
Write-Host "cd stable-diffusion-webui" -ForegroundColor White
Write-Host "webui-user-setup.bat" -ForegroundColor White
Write-Host ""
Write-Host "This process may take 10-30 minutes on first run" -ForegroundColor Yellow
Write-Host ""

Set-Location ..
Read-Host "Press Enter to exit"