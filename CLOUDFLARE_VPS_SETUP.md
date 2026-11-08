# Ollama on a VPS with Cloudflare Access

This deployment keeps Ollama bound to loopback on the VPS. Cloudflare Tunnel
connects to `http://127.0.0.1:11434`; no inbound firewall rule for port 11434
is needed or should be created. Cloudflare Access must require a Service Auth
policy for the Ollama hostname.

## Keep Ollama private and restart it automatically

Install Ollama and download the model on the VPS. Create the systemd override:

```bash
sudo systemctl edit ollama
```

Add the contents of [`deploy/systemd/ollama.conf`](deploy/systemd/ollama.conf),
then apply and verify the listener:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ollama
sudo systemctl restart ollama
sudo systemctl status ollama --no-pager
sudo ss -ltnp | grep ':11434'
```

The listener must show `127.0.0.1:11434` or `[::1]:11434`, not `0.0.0.0`,
`[::]`, or a public interface. Do not open port 11434 in the VPS firewall or
cloud-provider security group.

## Configure a named Cloudflare Tunnel

Create a named tunnel in Cloudflare Zero Trust and add its public hostname
(for example, `ollama.example.com`) to the tunnel. Configure the tunnel ingress
from [`deploy/cloudflared/config.yml.example`](deploy/cloudflared/config.yml.example)
so the hostname's service is `http://127.0.0.1:11434`. Keep the tunnel
credentials file readable only by the `cloudflared` service account.

In Cloudflare Zero Trust, create a Service Auth policy for the Ollama hostname
and issue a Service Token. Do not make the Ollama hostname public without this
Access policy. Requests from this app use Cloudflare's
`CF-Access-Client-Id` and `CF-Access-Client-Secret` headers only over HTTPS and
only when the request hostname exactly matches `OLLAMA_BASE_URL`.

Install the systemd unit from
[`deploy/systemd/cloudflared-ollama.service`](deploy/systemd/cloudflared-ollama.service)
as `/etc/systemd/system/cloudflared-ollama.service`. Ensure the executable path
in `ExecStart` matches `command -v cloudflared` on the VPS, then install the
Cloudflare config at `/etc/cloudflared/config.yml`. Create the dedicated
service account if it does not already exist and grant it read access to the
config and tunnel credentials:

```bash
getent passwd cloudflared >/dev/null || \
  sudo useradd --system --home-dir /var/lib/cloudflared \
    --shell /usr/sbin/nologin cloudflared
sudo chown cloudflared:cloudflared /etc/cloudflared/config.yml \
  /etc/cloudflared/<CLOUDFLARE_TUNNEL_UUID>.json
sudo chmod 600 /etc/cloudflared/<CLOUDFLARE_TUNNEL_UUID>.json
```

Start and enable the tunnel:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now cloudflared-ollama
sudo systemctl status cloudflared-ollama --no-pager
```

Both Ollama and the tunnel use `Restart=always`; the tunnel unit requires the
Ollama service and waits for network availability.

## Configure Vercel Production

In Vercel → Project → Settings → Environment Variables, create these **Production**
variables, using the real hostname and the Cloudflare-generated Service Token
values. Enter secret values directly in Vercel; do not put them in Git, chat,
or logs.

```env
OLLAMA_BASE_URL=https://ollama.<YOUR_DOMAIN>
OLLAMA_MODEL=llama3.2:latest
CF_ACCESS_CLIENT_ID=<Cloudflare Access service token client ID>
CF_ACCESS_CLIENT_SECRET=<Cloudflare Access service token client secret>
```

Redeploy Production after saving the variables. Run
`python -m scripts.verify_remote_services` from an authorized environment with
the same variables configured to check the actual Ollama version, tags JSON,
and installed model. The verifier prints sanitized status only.

This repository cannot create the VPS, Cloudflare tunnel/hostname/Access
policy, or Vercel Production variables without access to those accounts. The
files here are deployable templates; placeholders must be replaced on the VPS
and in the provider dashboards.
