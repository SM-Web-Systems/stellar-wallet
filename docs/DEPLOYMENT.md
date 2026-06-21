# Deployment Guide

## Current Production Setup

Server: AWS EC2 (af-south-1, Cape Town), ARM64 (Graviton), Ubuntu 24.04 LTS
IP: 13.245.39.194
Domain: ammawallet.com (Cloudflare DNS)

Services:
- Fastify API on port 3001, managed by PM2
- PostgreSQL on port 5432, managed by systemd
- Nginx on ports 80/443, managed by systemd
- SSL managed by Lets Encrypt via Certbot with auto-renewal

---

## Deployment Steps

1. Pull latest code: cd ~/amma-wallet and git pull origin main
2. Install dependencies: cd packages/backend and npm install, then cd packages/web-app and npm install
3. Run database migrations: cd packages/backend and npx drizzle-kit push
4. Build frontend: cd packages/web-app and npm run build
5. Restart backend: pm2 restart amma-backend
6. Verify: curl https://ammawallet.com/health

---

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| DATABASE_URL | PostgreSQL connection string | postgresql://user:pass@localhost:5432/db |
| JWT_SECRET | Access token signing key | random-64-char-string |
| JWT_REFRESH_SECRET | Refresh token signing key | random-64-char-string |
| STELLAR_NETWORK | testnet or public | testnet |
| HORIZON_URL | Stellar Horizon URL | https://horizon-testnet.stellar.org |
| WEB_APP_URL | Frontend URL | https://ammawallet.com |
| API_BASE_URL | Backend URL | https://ammawallet.com |
| PORT | API port | 3001 |

### SMTP

| Variable | Description |
|----------|-------------|
| SMTP_HOST | SMTP server hostname |
| SMTP_PORT | SMTP port (587 for TLS) |
| SMTP_USER | SMTP username |
| SMTP_PASS | SMTP password or app password |
| SMTP_FROM | Sender display name and email |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| PLATFORM_FEE_PERCENT | Fee on swaps (percent) | 0 |
| PLATFORM_WALLET | Stellar public key for fees | none |
| PLATFORM_SECRET | Stellar secret for fee bumps | none |
| TURNSTILE_SECRET_KEY | Cloudflare Turnstile secret | none |

---

## Backups

Automated daily at 3 AM via cron:
pg_dump -U stellarwallet stellarwallet | gzip > ~/backups/stellarwallet_DATE.sql.gz

Rotation: backups older than 30 days are deleted daily at 4 AM.

Manual backup:
PGPASSWORD=yourpass pg_dump -U stellarwallet -h localhost stellarwallet | gzip > ~/backups/manual_DATE.sql.gz

Restore:
gunzip -c ~/backups/file.sql.gz | PGPASSWORD=yourpass psql -U stellarwallet -h localhost stellarwallet

---

## Monitoring

PM2 commands:
- pm2 status -- process status
- pm2 logs amma-backend -- real-time logs
- pm2 monit -- CPU/memory monitor

Health endpoint: curl https://ammawallet.com/health
Returns: { "status": "ok", "network": "testnet", "timestamp": "..." }

---

## Switching to Mainnet

1. Update .env: STELLAR_NETWORK=public and HORIZON_URL=https://horizon.stellar.org
2. Create new platform wallet on mainnet
3. Update PLATFORM_WALLET and PLATFORM_SECRET
4. Clear token database (testnet tokens do not exist on mainnet): TRUNCATE tokens CASCADE; DELETE FROM sync_state;
5. Restart backend -- token indexer will re-populate from mainnet
6. Test thoroughly before announcing

---

## Nginx Configuration Summary

Port 443 with SSL (Lets Encrypt certificates).
/api/ and /docs and /health proxy to 127.0.0.1:3001.
All other paths serve static files from packages/web-app/dist/ with fallback to /index.html for SPA routing.
