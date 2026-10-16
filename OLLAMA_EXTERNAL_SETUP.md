# Secure Ollama tunnel (Windows)

The tunnel gateway keeps Ollama bound to `127.0.0.1:11434`; it does not expose
Ollama's unauthenticated port directly. A Cloudflare Quick Tunnel forwards only
the authenticated Ollama API routes through a local gateway.

## One-time setup

1. Install Cloudflare Tunnel (`cloudflared`) on the Ollama host:

   ```powershell
   winget install --id Cloudflare.cloudflared --exact
   ```

   Close and reopen PowerShell after installation.

2. In the repository's ignored local `.env`, configure the same strong
   `AUTH_TOKEN` that is available to the deployed application, plus the local
   model:

   ```env
   AUTH_TOKEN=<same random secret in the application runtime; at least 32 characters>
   OLLAMA_MODEL=llama3.2:latest
   ```

   The tunnel refuses to start if the token is missing or shorter than 32
   characters. Do not commit `.env` or put the token in a URL.

## Start the tunnel

From the repository root, run:

```powershell
.\scripts\start-ollama-tunnel.ps1
```

The command first checks the actual local Ollama version and installed model.
When Cloudflare publishes the Quick Tunnel, the script prints only its public
URL. Keep the terminal open while using Ollama; Ctrl+C closes the tunnel and
gateway.

## Connect the deployed runtime

In the Preview environment, set the highest-priority Ollama pair to the
printed URL and the locally verified model:

```env
OLLAMA_BASE_URL_10_3_2=https://<assigned-host>.trycloudflare.com
OLLAMA_MODEL_8_3_2=llama3.2:latest
AUTH_TOKEN=<same secret configured on the Ollama host>
```

Redeploy/restart Preview after changing its environment. The Ollama client
adds the bearer credential only for HTTPS `trycloudflare.com` endpoints; it
does not send `AUTH_TOKEN` to arbitrary configured Ollama hosts. The gateway
requires the credential and allows only `/api/version`, `/api/tags`,
and `/api/generate` for the verified local model with streaming disabled.

Cloudflare Quick Tunnel URLs change when the tunnel restarts. Update
`OLLAMA_BASE_URL_10_3_2` in Preview each time the URL changes. For a stable
production hostname, use a named Cloudflare Tunnel and configure its DNS and
Cloudflare Access policy; do not point a public tunnel directly at port 11434.

## How to verify

The application's Ollama status endpoint probes `/api/version` and
`/api/tags`, requires the configured model to be installed, and reports a
specific failure state rather than marking an unavailable model as connected.
Use that status before starting video generation. The fallback response remains
marked as fallback and is never represented as real Ollama output.
