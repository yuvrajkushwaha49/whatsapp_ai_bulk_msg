# Ubuntu VPS Production Deployment Guide

This guide outlines the production deployment of **CampaignFlow** on an Ubuntu 22.04 / 24.04 LTS VPS.

---

## 1. System Prerequisites & Dependencies

Update packages and install Node.js 20+, MySQL 8, Redis, and Nginx:

```bash
# Update Ubuntu
sudo apt update && sudo apt upgrade -y

# Install Node.js (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs build-essential

# Install MySQL 8 & Redis
sudo apt install -y mysql-server redis-server nginx git certbot python3-certbot-nginx

# Verify services
sudo systemctl enable --now mysql
sudo systemctl enable --now redis-server
sudo systemctl enable --now nginx
```

---

## 2. Configure MySQL 8 Database

Create the production database and user:

```bash
sudo mysql
```

```sql
CREATE DATABASE campaignflow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'cf_user'@'localhost' IDENTIFIED BY 'StrongProductionPassword_99!';
GRANT ALL PRIVILEGES ON campaignflow.* TO 'cf_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

## 3. Clone Repository & Install Dependencies

```bash
cd /var/www
sudo git clone <YOUR_REPO_URL> campaignflow
sudo chown -R $USER:$USER /var/www/campaignflow
cd /var/www/campaignflow

# Install Backend Dependencies
cd backend
npm install --production=false
cp .env.example .env
nano .env # Set DATABASE_PASSWORD, JWT_SECRET, META credentials

# Run Database Migrations
npm run migrate

# (Optional: Seed initial plans & superadmin)
npm run seed

# Install Frontend Dependencies & Build
cd ../frontend
npm install
npm run build
```

---

## 4. PM2 Process Manager

Install PM2 globally and launch the API cluster and background worker:

```bash
sudo npm install -g pm2

cd /var/www/campaignflow
pm2 start ecosystem.config.cjs

# Enable automatic restart on server reboot
pm2 save
pm2 startup
```

Check status:
```bash
pm2 status
pm2 logs
```

---

## 5. Nginx Reverse Proxy & SSL

Copy the Nginx configuration:

```bash
sudo cp /var/www/campaignflow/nginx.conf /etc/nginx/sites-available/campaignflow
sudo ln -s /etc/nginx/sites-available/campaignflow /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Obtain SSL Certificate
sudo certbot --nginx -d yourdomain.com

sudo systemctl reload nginx
```

---

## 6. Automated Backup Strategy

Create a daily cron job to back up the MySQL database:

```bash
sudo crontab -e
```

Add this line (runs at 02:00 AM daily):
```cron
0 2 * * * mysqldump -u cf_user -pStrongProductionPassword_99! campaignflow | gzip > /var/backups/campaignflow_$(date +\%F).sql.gz
```

---

## 7. Troubleshooting

- **Check API logs:** `pm2 logs campaignflow-api`
- **Check Worker logs:** `pm2 logs campaignflow-worker`
- **Check Nginx access & error logs:** `sudo tail -f /var/log/nginx/error.log`
- **Check Redis queue status:** `redis-cli ping`
