# Secure Ollama tunnel (Windows)

The tunnel gateway keeps Ollama bound to `127.0.0.1:11434`; it does not expose
Ollama's unauthenticated port directly. A Cloudflare Quick Tunnel forwards only
the authenticated Ollama API routes through a local gateway.

## One-command setup

From the repository root, run this in a new PowerShell window:

```powershell
.\scripts\start-preview-tunnel.ps1
```

The command verifies the local Ollama model, then prompts for a newly rotated
ElevenLabs API key using hidden input and a voice ID. It saves them only to the
ignored local `.env`, generates a strong tunnel token, and starts the
authenticated Cloudflare Quick Tunnel. It does not print the API key or token.
Once the tunnel URL is ready, it copies the complete Preview environment block
to the clipboard automatically. Paste that block into Vercel → Project →
Settings → Environment Variables, selecting Preview for each variable.

Keep the PowerShell window open. After adding the variables, redeploy the
Preview deployment from Vercel. When deployment completes, run this in another
PowerShell window to verify both services without printing credentials:

```powershell
python -m scripts.verify_remote_services
```

The check returns success only when Ollama `/api/tags` is HTTP 200 JSON and
contains the configured model, and ElevenLabs `/v1/voices` is HTTP 200 JSON
containing the configured voice. If the Quick Tunnel restarts, the URL changes:
copy the new Preview block from the setup command again and redeploy Preview.

Use a newly rotated ElevenLabs key here. A key previously pasted into a chat
should be revoked; this setup never reads it from the conversation.

## Manual setup (optional)

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

## Start the tunnel manually

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
