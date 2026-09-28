# Git Installation Helper
Write-Host "Git Installation Helper" -ForegroundColor Green
Write-Host "====================" -ForegroundColor Green
Write-Host ""

Write-Host "Git is required to download Stable Diffusion WebUI." -ForegroundColor Yellow
Write-Host ""
Write-Host "Please install Git from the following link:" -ForegroundColor Cyan
Write-Host "https://git-scm.com/download/win" -ForegroundColor White
Write-Host ""
Write-Host "After installation, run this script again:" -ForegroundColor Yellow
Write-Host "powershell -ExecutionPolicy Bypass -File install_stable_diffusion.ps1" -ForegroundColor White
Write-Host ""

# Check if winget is available for automatic installation
Write-Host "Alternatively, you can install Git automatically using winget:" -ForegroundColor Cyan
Write-Host "winget install Git.Git" -ForegroundColor White
Write-Host ""

try {
    $wingetAvailable = Get-Command winget -ErrorAction SilentlyContinue
    if ($wingetAvailable) {
        $install = Read-Host "Do you want to install Git automatically using winget? (Y/N)"
        if ($install -eq "Y" -or $install -eq "y") {
            Write-Host "Installing Git using winget..." -ForegroundColor Yellow
            winget install Git.Git
            Write-Host "Git installation completed!" -ForegroundColor Green
            Write-Host "Please restart your terminal and run the installation script again." -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "winget is not available for automatic installation." -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Press Enter to exit"