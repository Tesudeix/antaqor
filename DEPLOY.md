# Antaqor - Digital Ocean Deployment Guide

**Server IP:** `68.183.184.111`

---

## STEP 1: Push Code to GitHub

On your local machine (where you built the app):

```bash
cd /Users/antaqor/Documents/projects/Antaqor

git init
git add -A
git commit -m "Initial commit - Antaqor community app"

# Create repo on GitHub first, then:
git remote add origin https://github.com/YOUR_USERNAME/antaqor.git
git branch -M main
git push -u origin main
```

---

## STEP 2: SSH Into Your Droplet

```bash
ssh root@68.183.184.111
```

If this is your first time, accept the fingerprint by typing `yes`.

---

## STEP 3: Run the Server Setup Script

This installs Node.js 20, MongoDB 7, PM2, Nginx, firewall, and swap.

```bash
# Download and run the setup script
cd /tmp
curl -O https://raw.githubusercontent.com/YOUR_USERNAME/antaqor/main/scripts/deploy.sh
bash deploy.sh
```

Or if you haven't pushed to GitHub yet, paste the script contents manually:

```bash
# Copy scripts/deploy.sh content and run it
nano /tmp/deploy.sh
# Paste the script, save with Ctrl+X, Y, Enter
bash /tmp/deploy.sh
```

Wait for it to finish. You should see:

```
=========================================
  SERVER SETUP COMPLETE
=========================================
  Node.js: v20.x.x
  MongoDB: running on 127.0.0.1:27017
  ...
```

---

## STEP 4: Clone Your App

```bash
cd /var/www/antaqor
git clone https://github.com/YOUR_USERNAME/antaqor.git .
```

If the repo is private, use a personal access token:

```bash
git clone https://YOUR_TOKEN@github.com/YOUR_USERNAME/antaqor.git .
```

---

## STEP 5: Create Environment File

Generate a secure secret and create the `.env.local` file:

```bash
cd /var/www/antaqor

cat > .env.local << 'EOF'
MONGODB_URI=mongodb://127.0.0.1:27017/antaqor
NEXTAUTH_SECRET=REPLACE_THIS
NEXTAUTH_URL=http://68.183.184.111
EOF
```

Now generate and set the actual secret:

```bash
SECRET=$(openssl rand -base64 32)
sed -i "s|REPLACE_THIS|$SECRET|" .env.local
```

Verify it looks correct:

```bash
cat .env.local
```

You should see:

```
MONGODB_URI=mongodb://127.0.0.1:27017/antaqor
NEXTAUTH_SECRET=aB3kLm9x...  (long random string)
NEXTAUTH_URL=http://68.183.184.111
```

---

## STEP 6: Install Dependencies & Build

```bash
cd /var/www/antaqor

npm install

npm run build
```

The build should complete with output like:

```
Route (app)
┌ ○ /
├ ƒ /api/auth/[...nextauth]
├ ƒ /api/posts
...
```

Create the logs directory:

```bash
mkdir -p /var/www/antaqor/logs
```

---

## STEP 7: Start the App with PM2

```bash
cd /var/www/antaqor

pm2 start ecosystem.config.js
```

Verify it's running:

```bash
pm2 status
```

You should see:

```
┌────┬──────────┬─────────┬──────┬───────┬──────────┐
│ id │ name     │ mode    │ ↺    │ status│ cpu      │
├────┼──────────┼─────────┼──────┼───────┼──────────┤
│ 0  │ antaqor  │ fork    │ 0    │ online│ 0%       │
└────┴──────────┴─────────┴──────┴───────┴──────────┘
```

Make PM2 auto-start on reboot:

```bash
pm2 save
pm2 startup
```

PM2 will print a command -- copy and run it. Example:

```bash
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root
```

Test the app is responding:

```bash
curl http://127.0.0.1:3000
```

You should see HTML output. If you see an error, check logs:

```bash
pm2 logs antaqor --lines 50
```

---

## STEP 8: Configure Nginx

Copy the nginx config:

```bash
cp /var/www/antaqor/nginx.conf /etc/nginx/sites-available/antaqor
```

Enable the site and disable the default:

```bash
ln -sf /etc/nginx/sites-available/antaqor /etc/nginx/sites-enabled/antaqor
rm -f /etc/nginx/sites-enabled/default
```

Test the config:

```bash
nginx -t
```

You should see:

```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

Restart Nginx:

```bash
systemctl restart nginx
```

---

## STEP 9: Test It

Open your browser and go to:

```
http://68.183.184.111
```

You should see the Antaqor community home page.

Try:
- Sign up at `http://68.183.184.111/auth/signup`
- Create a post
- Like and comment

---

## STEP 10: Verify MongoDB Is Secure

MongoDB should only listen on localhost (not exposed to internet). Verify:

```bash
cat /etc/mongod.conf | grep bindIp
```

Should show: `bindIp: 127.0.0.1`

If it shows `0.0.0.0`, fix it:

```bash
sed -i 's/bindIp: 0.0.0.0/bindIp: 127.0.0.1/' /etc/mongod.conf
systemctl restart mongod
```

---

## STEP 11: Verify Firewall

```bash
ufw status
```

Should show:

```
Status: active

To             Action      From
--             ------      ----
22/tcp         ALLOW       Anywhere
80/tcp         ALLOW       Anywhere
443/tcp        ALLOW       Anywhere
```

Only SSH, HTTP, and HTTPS are open. MongoDB (27017) is NOT exposed.

---

## Updating the App (Future Deploys)

SSH into the server and run:

```bash
ssh root@68.183.184.111

cd /var/www/antaqor
git pull
npm install
npm run build
pm2 restart antaqor
```

---

## Useful Commands

| Command | What it does |
|---|---|
| `pm2 status` | Check if app is running |
| `pm2 logs antaqor` | View app logs (live) |
| `pm2 logs antaqor --lines 100` | View last 100 log lines |
| `pm2 restart antaqor` | Restart the app |
| `pm2 stop antaqor` | Stop the app |
| `pm2 monit` | Real-time CPU/memory monitor |
| `systemctl status nginx` | Check Nginx status |
| `systemctl restart nginx` | Restart Nginx |
| `systemctl status mongod` | Check MongoDB status |
| `mongosh` | Open MongoDB shell |
| `df -h` | Check disk space |
| `free -h` | Check memory/swap |
| `htop` | System resource monitor |

---

## Adding a Domain Name (Optional)

If you buy a domain (e.g., `antaqor.com`):

**1. Point DNS to your droplet:**
- Go to your domain registrar
- Add an A record: `@` -> `68.183.184.111`
- Add an A record: `www` -> `68.183.184.111`

**2. Update Nginx config:**

```bash
nano /etc/nginx/sites-available/antaqor
```

Change the `server_name` line:

```
server_name antaqor.com www.antaqor.com;
```

```bash
nginx -t && systemctl restart nginx
```

**3. Update the app environment:**

```bash
nano /var/www/antaqor/.env.local
```

Change NEXTAUTH_URL:

```
NEXTAUTH_URL=https://antaqor.com
```

```bash
cd /var/www/antaqor && npm run build && pm2 restart antaqor
```

**4. Install SSL (free with Let's Encrypt):**

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d antaqor.com -d www.antaqor.com
```

Follow the prompts. Certbot auto-configures Nginx for HTTPS.

Auto-renew is set up automatically. Test it:

```bash
certbot renew --dry-run
```

---

## Troubleshooting

### App won't start

```bash
cd /var/www/antaqor
pm2 logs antaqor --lines 50
# Check for errors in the output
```

Common fix: re-check `.env.local` values.

### "502 Bad Gateway" in browser

The app isn't running or crashed.

```bash
pm2 status
# If status is "errored":
pm2 restart antaqor
pm2 logs antaqor
```

### MongoDB connection error

```bash
systemctl status mongod
# If it's not running:
systemctl start mongod
```

### Port 3000 already in use

```bash
lsof -i :3000
# Kill the process if needed:
kill -9 <PID>
pm2 restart antaqor
```

### Out of memory (app crashes randomly)

Check if swap exists:

```bash
free -h
```

If swap is 0, create it:

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### Check everything is running

```bash
systemctl status nginx    # Should be "active (running)"
systemctl status mongod   # Should be "active (running)"
pm2 status                # Should show "online"
curl http://127.0.0.1:3000  # Should return HTML
```
