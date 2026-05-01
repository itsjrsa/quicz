---
icon: lucide/download
---

# Install

## Requirements

- Node.js 20+
- npm 9+
- (Optional) Docker + Docker Compose for containerised deployment

## Docker

```bash
cp .env.example .env
# Edit .env with your values
docker compose up -d
```

The app will be available at <http://localhost:3000>.

## Local development

1. Clone the repository:

   ```bash
   git clone https://github.com/itsjrsa/quicz.git
   cd quicz
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy the environment file and set your values:

   ```bash
   cp .env.example .env
   ```

4. (Optional) Run migrations — they run automatically on server start:

   ```bash
   npm run db:migrate
   ```

5. Start the development server:

   ```bash
   npm run dev
   ```

   Open <http://localhost:3000>.

## Serving to your network

Quicz binds to all interfaces by default — no configuration needed. Participants on the same LAN or Wi-Fi can join once you open the admin panel via your machine's LAN IP rather than `localhost`.

### 1. Find your LAN IP

=== "macOS"

    ```bash
    ipconfig getifaddr en0   # Wi-Fi
    # or
    ipconfig getifaddr en1   # Ethernet
    ```

=== "Linux"

    ```bash
    hostname -I | awk '{print $1}'
    ```

=== "Windows"

    ```powershell
    ipconfig
    ```

    Look for `IPv4 Address` under your active adapter.

### 2. Open the admin panel via that IP

Instead of `http://localhost:3000/admin`, browse to your LAN IP — for example `http://192.168.1.42:3000/admin`. The QR code shown in the presenter view is built from the URL you used to open the admin panel, so it will then encode the LAN URL, and participants on the same network can scan it from their phones.

### 3. Allow the firewall through

First launch may trigger a firewall prompt:

- **macOS** — allow incoming connections to `node` when System Settings asks.
- **Windows** — allow `node.exe` through Windows Defender Firewall when prompted.
- **Linux (`ufw`)** — `sudo ufw allow 3000/tcp` if a firewall is enabled.

### Caveats

- **HTTP only.** LAN access is plain HTTP. The admin session cookie is marked `Secure` in production builds, so production-grade LAN deployments need a reverse proxy (Caddy, nginx, Traefik) with a self-signed or [`mkcert`](https://github.com/FiloSottile/mkcert)-issued certificate. The dev server relaxes this automatically.
- **Same network only.** Participants must be on the same Wi-Fi or LAN as the admin's machine. There is no NAT traversal or relay.
- **Stable IP helps.** If your DHCP lease changes mid-event, distributed QR codes stop resolving. Reserve a static IP for the admin machine in your router to avoid this.
