$ErrorActionPreference = "Stop"

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    Write-Error "cloudflared is not installed or is not on PATH. Install Cloudflare Tunnel, reopen PowerShell, and retry."
}

python -m scripts.prepare_preview
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
