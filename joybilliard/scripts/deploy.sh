#!/bin/bash
# JoyBilliard Deployment Script
# Target: 178.128.104.98 (DigitalOcean)
# Port: 4000

SERVER="178.128.104.98"
USER="root"
APP_DIR="/var/www/joybilliard"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== JoyBilliard Deployment ==="
echo "Server: $SERVER"
echo "App Dir: $APP_DIR"
echo ""

# Step 1: Setup server directories and install dependencies
echo "[1/5] Setting up server..."
ssh ${USER}@${SERVER} << 'ENDSSH'
# Install Node.js if not present
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# Install MongoDB if not present
if ! command -v mongod &> /dev/null; then
  curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
  echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] http://repo.mongodb.org/apt/debian bookworm/mongodb-org/7.0 main" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
  apt-get update
  apt-get install -y mongodb-org
  systemctl start mongod
  systemctl enable mongod
fi

# Install PM2 if not present
if ! command -v pm2 &> /dev/null; then
  npm install -g pm2
fi

# Create app directory
mkdir -p ${APP_DIR}/logs
ENDSSH

# Step 2: Sync files to server
echo "[2/5] Uploading files..."
rsync -avz --exclude='node_modules' --exclude='.env' --exclude='logs' \
  "${PROJECT_DIR}/" ${USER}@${SERVER}:${APP_DIR}/

# Step 3: Install dependencies on server
echo "[3/5] Installing dependencies..."
ssh ${USER}@${SERVER} << ENDSSH
cd ${APP_DIR}
npm install --production

# Create .env if not exists
if [ ! -f .env ]; then
  cat > .env << 'EOF'
PORT=4000
MONGODB_URI=mongodb://127.0.0.1:27017/joybilliard
EOF
fi
ENDSSH

# Step 4: Seed database
echo "[4/5] Seeding database..."
ssh ${USER}@${SERVER} "cd ${APP_DIR} && node scripts/seed.js"

# Step 5: Start/restart with PM2
echo "[5/5] Starting application..."
ssh ${USER}@${SERVER} << ENDSSH
cd ${APP_DIR}
pm2 delete joybilliard 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true
ENDSSH

echo ""
echo "=== Deployment Complete ==="
echo "JoyBilliard is running at: http://${SERVER}:4000"
echo ""
