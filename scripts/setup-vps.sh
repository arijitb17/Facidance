#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  scripts/setup-vps.sh
#  Run ONCE on a fresh Ubuntu 22.04 / Debian 12 VPS.
#  Usage:  bash setup-vps.sh YOUR_DOMAIN.com
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

DOMAIN="${1:?Usage: $0 YOUR_DOMAIN.com}"
APP_DIR="/opt/facidance"
DEPLOY_USER="deploy"

echo "══════════════════════════════════════════"
echo "  Facidance VPS Setup — $DOMAIN"
echo "══════════════════════════════════════════"

# ─── 1. System packages ───────────────────────────────────────
apt-get update -y
apt-get install -y curl git ufw fail2ban

# ─── 2. Docker ───────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi

# ─── 3. Firewall ─────────────────────────────────────────────
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
echo "✅ Firewall configured"

# ─── 4. Deploy user ──────────────────────────────────────────
if ! id "$DEPLOY_USER" &>/dev/null; then
  useradd -m -s /bin/bash "$DEPLOY_USER"
  usermod -aG docker "$DEPLOY_USER"
  echo "✅ Created user: $DEPLOY_USER"
fi

# ─── 5. App directory ────────────────────────────────────────
mkdir -p "$APP_DIR"
chown "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"
echo "✅ App dir: $APP_DIR"

# ─── 6. Clone repo ───────────────────────────────────────────
echo ""
echo "📋  Next: clone your repo into $APP_DIR"
echo "    sudo -u $DEPLOY_USER git clone https://github.com/YOUR_ORG/YOUR_REPO.git $APP_DIR"

# ─── 7. .env reminder ────────────────────────────────────────
echo ""
echo "📋  Next: copy and fill the .env"
echo "    cp $APP_DIR/.env.production.template $APP_DIR/.env"
echo "    nano $APP_DIR/.env"

# ─── 8. SSL — initial cert (nginx must be DOWN first) ────────
echo ""
echo "📋  Once .env is filled and nginx is NOT running, get SSL cert:"
echo ""
echo "    docker compose -f $APP_DIR/docker-compose.prod.yml run --rm certbot \\"
echo "      certonly --webroot --webroot-path=/var/www/certbot \\"
echo "      --email your@email.com --agree-tos --no-eff-email \\"
echo "      -d $DOMAIN -d www.$DOMAIN"
echo ""
echo "    Then start everything:"
echo "    cd $APP_DIR && docker compose -f docker-compose.prod.yml up -d"

echo ""
echo "══════════════════════════════════════════"
echo "  VPS base setup DONE ✅"
echo "══════════════════════════════════════════"