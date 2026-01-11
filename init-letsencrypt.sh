#!/bin/bash

# init-letsencrypt.sh - Initialize Let's Encrypt certificates for fisoft.app
# Run this script on the VPS before starting the full docker-compose

set -e

DOMAIN="fisoft.app"
EMAIL="fisoft.tr@gmail.com"
STAGING=0 # Set to 1 for testing (avoids rate limits)

echo "### Creating required directories..."
mkdir -p ./certbot/conf
mkdir -p ./certbot/www

echo "### Downloading recommended TLS parameters..."
curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > ./certbot/conf/options-ssl-nginx.conf
curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > ./certbot/conf/ssl-dhparams.pem

echo "### Creating dummy certificate for $DOMAIN..."
mkdir -p ./certbot/conf/live/$DOMAIN
docker compose run --rm --entrypoint "\
  openssl req -x509 -nodes -newkey rsa:4096 -days 1 \
    -keyout '/etc/letsencrypt/live/$DOMAIN/privkey.pem' \
    -out '/etc/letsencrypt/live/$DOMAIN/fullchain.pem' \
    -subj '/CN=localhost'" certbot

echo "### Starting nginx..."
docker compose up --force-recreate -d nginx

echo "### Deleting dummy certificate for $DOMAIN..."
docker compose run --rm --entrypoint "\
  rm -Rf /etc/letsencrypt/live/$DOMAIN && \
  rm -Rf /etc/letsencrypt/archive/$DOMAIN && \
  rm -Rf /etc/letsencrypt/renewal/$DOMAIN.conf" certbot

echo "### Requesting Let's Encrypt certificate for $DOMAIN..."

# Construct certbot command
if [ $STAGING != "0" ]; then staging_arg="--staging"; fi

docker compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $staging_arg \
    --email $EMAIL \
    --domain $DOMAIN \
    --domain www.$DOMAIN \
    --rsa-key-size 4096 \
    --agree-tos \
    --no-eff-email \
    --force-renewal" certbot

echo "### Reloading nginx..."
docker compose exec nginx nginx -s reload

echo "### Done! SSL certificate installed for $DOMAIN"
