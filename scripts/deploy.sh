#!/bin/bash
set -e

# ============================================
# Antaqor - Digital Ocean Droplet Setup
# Server: 68.183.184.111
# Run as root: bash deploy.sh
# ============================================

APP_DIR="/var/www/antaqor"
APP_USER="antaqor"

echo ""
echo "========================================="
echo "  Antaqor Server Setup - 68.183.184.111"
echo "========================================="
echo ""

# -------------------------------------------
# STEP 1: System update + essential packages
# -------------------------------------------
echo "[1/9] Updating system..."
export DEBIAN_FRONTEND=noninteractive
apt update && apt upgrade -y
apt install -y curl wget git build-essential software-properties-common ufw fail2ban

# -------------------------------------------
# STEP 2: Create app user (non-root)
# -------------------------------------------
echo "[2/9] Creating app user..."
if ! id "$APP_USER" &>/dev/null; then
    adduser --disabled-password --gecos "" $APP_USER
    usermod -aG sudo $APP_USER
fi

# -------------------------------------------
# STEP 3: Configure firewall (UFW)
# -------------------------------------------
echo "[3/9] Configuring firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable
echo "  Firewall: SSH(22), HTTP(80), HTTPS(443) open"

# -------------------------------------------
# STEP 4: Install Node.js 20 LTS
# -------------------------------------------
echo "[4/9] Installing Node.js 20..."
if ! command -v node &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi
echo "  Node: $(node -v) | npm: $(npm -v)"

# -------------------------------------------
# STEP 5: Install MongoDB 7
# -------------------------------------------
echo "[5/9] Installing MongoDB 7..."
if ! command -v mongod &>/dev/null; then
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
        gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
    echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
        tee /etc/apt/sources.list.d/mongodb-org-7.0.list
    apt update
    apt install -y mongodb-org
fi
systemctl start mongod
systemctl enable mongod
echo "  MongoDB: $(mongod --version | head -1)"

# -------------------------------------------
# STEP 6: Install PM2
# -------------------------------------------
echo "[6/9] Installing PM2..."
npm install -g pm2
echo "  PM2: $(pm2 -v)"

# -------------------------------------------
# STEP 7: Install & configure Nginx
# -------------------------------------------
echo "[7/9] Installing Nginx..."
apt install -y nginx
systemctl enable nginx
echo "  Nginx: $(nginx -v 2>&1)"

# -------------------------------------------
# STEP 8: Setup app directory
# -------------------------------------------
echo "[8/9] Setting up app directory..."
mkdir -p $APP_DIR/logs
chown -R $APP_USER:$APP_USER $APP_DIR

# -------------------------------------------
# STEP 9: Configure swap (for 1GB droplets)
# -------------------------------------------
echo "[9/9] Configuring swap..."
if [ ! -f /swapfile ]; then
    fallocate -l 1G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "  Swap: 1GB enabled"
else
    echo "  Swap: already exists"
fi

echo ""
echo "========================================="
echo "  SERVER SETUP COMPLETE"
echo "========================================="
echo ""
echo "  Node.js: $(node -v)"
echo "  MongoDB: running on 127.0.0.1:27017"
echo "  PM2:     $(pm2 -v)"
echo "  Nginx:   active"
echo "  Firewall: ports 22, 80, 443"
echo "  Swap:    1GB"
echo ""
echo "  Next: deploy your app code."
echo "  See DEPLOY.md for step-by-step."
echo "========================================="
