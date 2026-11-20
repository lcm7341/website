# one-time setup for the analytics service, runs ON the ec2 box:
#   ssh -i ./WebsiteKey.pem ec2-user@98.85.40.144 'bash -s' < server/setup_server.sh
# safe to run again. after this, push_to_site.sh keeps analytics.mjs up to date.
set -e

mkdir -p ~/analytics/data
[ -f ~/analytics/analytics.mjs ] || { echo "copy server/analytics.mjs to ~/analytics/ first"; exit 1; }

# dev panel password + settings, readable by root only
if [ ! -f /etc/leviminton-analytics.env ]; then
  TOKEN=$(openssl rand -base64 24 | tr "+/" "-_" | tr -d "=")
  printf "DEV_PANEL_TOKEN=%s\nDATA_DIR=/home/ec2-user/analytics/data\nPORT=8787\nHOST=127.0.0.1\n" "$TOKEN" |
    sudo tee /etc/leviminton-analytics.env >/dev/null
  sudo chmod 600 /etc/leviminton-analytics.env
fi

sudo tee /etc/systemd/system/leviminton-analytics.service >/dev/null <<'UNIT'
[Unit]
Description=leviminton.com analytics
After=network.target

[Service]
User=ec2-user
WorkingDirectory=/home/ec2-user/analytics
EnvironmentFile=/etc/leviminton-analytics.env
ExecStart=/usr/bin/node /home/ec2-user/analytics/analytics.mjs
Restart=always
RestartSec=5
MemoryMax=128M

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable --now leviminton-analytics
sleep 1
systemctl is-active leviminton-analytics
curl -s localhost:8787/api/health && echo

# nginx: send /api/ to the service, inside the https server block
CONF=/etc/nginx/conf.d/default.conf
if ! grep -q "127.0.0.1:8787" "$CONF"; then
  BACKUP=/home/ec2-user/default.conf.bak-$(date +%Y%m%d%H%M%S)
  sudo cp "$CONF" "$BACKUP"
  echo "nginx config backed up to $BACKUP"
  sudo python3 - "$CONF" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
anchor = "    location / {\n\troot /var/www/html;"
assert s.count(anchor) == 1, "couldn't find the location / block, add the /api/ block by hand"
block = """    location /api/ {
        proxy_pass http://127.0.0.1:8787;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Host $host;
        client_max_body_size 8k;
    }

"""
open(p, "w").write(s.replace(anchor, block + anchor))
PY
  if ! sudo nginx -t; then
    echo "nginx config test failed, restoring backup"
    sudo cp "$BACKUP" "$CONF"
    exit 1
  fi
  sudo systemctl reload nginx
fi

# nginx: browsers must re-check index.html, otherwise after a deploy they keep running the
# old app (which redirects routes it doesn't know, like /dev, back home)
if ! grep -q "location = /index.html" "$CONF"; then
  BACKUP=/home/ec2-user/default.conf.bak-$(date +%Y%m%d%H%M%S)
  sudo cp "$CONF" "$BACKUP"
  echo "nginx config backed up to $BACKUP"
  sudo python3 - "$CONF" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
anchor = "    location / {\n\troot /var/www/html;"
assert s.count(anchor) == 1, "couldn't find the location / block"
block = """    location = /index.html {
        root /var/www/html;
        add_header Cache-Control "no-cache";
    }

"""
open(p, "w").write(s.replace(anchor, block + anchor))
PY
  if ! sudo nginx -t; then
    echo "nginx config test failed, restoring backup"
    sudo cp "$BACKUP" "$CONF"
    exit 1
  fi
  sudo systemctl reload nginx
fi

echo
echo "dev panel password:"
sudo grep DEV_PANEL_TOKEN /etc/leviminton-analytics.env | cut -d= -f2
