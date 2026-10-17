$ErrorActionPreference = "Stop"

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    Write-Error "cloudflared is required. Install Cloudflare Tunnel, reopen PowerShell, and run this script again."
}

python -m src.ollama_tunnel
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
