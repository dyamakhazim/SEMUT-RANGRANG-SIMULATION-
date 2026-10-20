#!/usr/bin/env bash
# Deploy Semut Rangrang ke VPS Ubuntu dengan nginx.
# Jalankan dari folder repo:  sudo bash deploy/setup.sh sarang.semut.cloud email@kamu.com
set -euo pipefail

DOMAIN="${1:-sarang.semut.cloud}"
EMAIL="${2:-}"
PORT="${PORT:-3100}"
APP_DIR=/opt/semut-rangrang
DATA_DIR=/var/lib/semut-rangrang
ENV_FILE=/etc/semut-rangrang.env
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"

[ "$(id -u)" = 0 ] || { echo "Jalankan pakai sudo."; exit 1; }

echo "==> Node.js 22"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "==> Port $PORT"
if ss -ltn "sport = :$PORT" | grep -q LISTEN && ! systemctl is-active --quiet semut-rangrang; then
  echo "Port $PORT sudah dipakai aplikasi lain. Jalankan ulang dengan PORT=xxxx sudo -E bash deploy/setup.sh ..."; exit 1
fi

echo "==> User & folder"
id semut >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin semut
mkdir -p "$APP_DIR" "$DATA_DIR"
rsync -a --delete --exclude node_modules --exclude data --exclude .git "$SRC_DIR"/ "$APP_DIR"/
cd "$APP_DIR"
npm ci --omit=dev
chown -R semut:semut "$APP_DIR" "$DATA_DIR"

echo "==> Konfigurasi"
if [ ! -f "$ENV_FILE" ]; then
  ADMIN_CODE="BOD-$(openssl rand -hex 4 | tr a-f A-F)"
  printf 'PORT=%s\nDB_FILE=%s/semut.db\nADMIN_CODE=%s\n' "$PORT" "$DATA_DIR" "$ADMIN_CODE" > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
fi

cat > /etc/systemd/system/semut-rangrang.service <<UNIT
[Unit]
Description=Semut Rangrang Office Life
After=network.target

[Service]
User=semut
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/node --no-warnings server/index.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now semut-rangrang
systemctl restart semut-rangrang
sleep 2
curl -fsS "http://127.0.0.1:$(grep ^PORT= "$ENV_FILE" | cut -d= -f2)/health" && echo

echo "==> nginx untuk $DOMAIN"
APP_PORT="$(grep ^PORT= "$ENV_FILE" | cut -d= -f2)"
cat > /etc/nginx/sites-available/semut-rangrang <<NGINX
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 3600s;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/semut-rangrang /etc/nginx/sites-enabled/semut-rangrang
nginx -t
systemctl reload nginx

echo "==> HTTPS (Let's Encrypt)"
command -v certbot >/dev/null || apt-get install -y certbot python3-certbot-nginx
if [ -n "$EMAIL" ]; then
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect
else
  certbot --nginx -d "$DOMAIN" --redirect
fi

echo
echo "Selesai! Game: https://$DOMAIN   Dashboard BOD: https://$DOMAIN/admin"
echo "Kode admin ada di $ENV_FILE (baris ADMIN_CODE)."
