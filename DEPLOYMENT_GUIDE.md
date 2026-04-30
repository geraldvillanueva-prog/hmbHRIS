# HMB HRIS – Deployment Guide
## How to Run This on a Server and Connect to a Domain

---

## What's Included

| File | Purpose |
|------|---------|
| `server.js` | Node.js backend — handles all data, login, and database |
| `db/hris.db` | SQLite database — auto-created on first run |
| `public/index.html` | Login page (all users see this first) |
| `public/admin.html` | Full HRIS system (HR Admin only) |
| `public/employee.html` | Time In/Out portal (Employees only) |
| `package.json` | Node.js dependencies list |

---

## Step 1 — Install Node.js on Your Server

Your server needs Node.js version 18 or higher.

**On Ubuntu/Debian (VPS or cloud server):**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Verify: `node --version` should show v20.x or higher.

---

## Step 2 — Upload Files to Your Server

Upload the entire `hmb-hris` folder to your server.
Recommended location: `/var/www/hmb-hris`

Using FileZilla, WinSCP, or SCP:
```bash
scp -r hmb-hris/ user@your-server-ip:/var/www/
```

---

## Step 3 — Install Dependencies

```bash
cd /var/www/hmb-hris
npm install
```

This installs: Express, SQLite, bcryptjs, express-session.

---

## Step 4 — Run the Server

**Test run (temporary):**
```bash
node server.js
```
You should see: `🚀 HMB HRIS Server running on http://localhost:3000`

**For production (runs permanently, auto-restarts):**
```bash
npm install -g pm2
pm2 start server.js --name hmb-hris
pm2 startup       # auto-start on server reboot
pm2 save
```

---

## Step 5 — Connect to a Domain with Nginx

Install Nginx:
```bash
sudo apt install nginx
```

Create a site config:
```bash
sudo nano /etc/nginx/sites-available/hmb-hris
```

Paste this (replace `yourdomain.com` with your actual domain):
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/hmb-hris /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Step 6 — Add HTTPS (Free SSL with Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Follow the prompts. Your site will now be at `https://yourdomain.com`.

---

## Step 7 — Point Your Domain to the Server

In your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.):
- Add an **A Record**: `@` → your server's IP address
- Add an **A Record**: `www` → your server's IP address
- Wait 10–60 minutes for DNS to propagate

---

## Default Login Credentials

| Account | Username | Password | Access |
|---------|----------|----------|--------|
| HR Admin | `admin` | `admin123` | Full HRIS system |

⚠️ **Change the admin password immediately after first login** (go to User Accounts → Reset Password).

---

## How to Create Employee Accounts

1. Login as admin → go to **User Accounts**
2. Click **Create Account**
3. Set Role = **Employee**
4. Link to the employee record
5. Give them the username/password
6. Employees go to `yourdomain.com` → choose **Employee** tab → login
7. They will only see the **Time In/Out** portal

---

## Where Data is Stored

All data is in: `/var/www/hmb-hris/db/hris.db`

This is a SQLite database file. **Back it up regularly:**
```bash
cp /var/www/hmb-hris/db/hris.db /backup/hris_$(date +%Y%m%d).db
```

You can also use the **Export Backup** button in the admin panel to download a JSON backup anytime.

---

## Security Recommendations

1. Change the default admin password immediately
2. Change the session secret in `server.js` line: `secret: 'hmb-hris-secret-2024'`
3. Enable HTTPS (Step 6 above)
4. Keep regular database backups
5. If using a VPS, set up a firewall: `sudo ufw allow 'Nginx Full'`

---

## Recommended Hosting Options (Philippines)

| Option | Cost | Notes |
|--------|------|-------|
| DigitalOcean Droplet | ~$6/mo | Most reliable, easy setup |
| Vultr | ~$6/mo | Good for PH region |
| AWS Lightsail | ~$5/mo | Amazon reliability |
| Hostinger VPS | ~$4/mo | Cheaper option |
| Railway.app | Free tier | Easy deploy, good for testing |

---

## Troubleshooting

**Port already in use:**
```bash
PORT=3001 node server.js
```

**Database permission error:**
```bash
chmod 755 /var/www/hmb-hris/db/
```

**Check server logs:**
```bash
pm2 logs hmb-hris
```

---

## Summary of User Roles

```
yourdomain.com/           ← Login page (everyone)
    ↓ Admin login         → /admin.html (full HRIS)
    ↓ Employee login      → /employee.html (Time In/Out only)
```
