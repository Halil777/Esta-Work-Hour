#!/bin/bash
set -e

echo "=== Work-Hour Deploy ==="

# Stop system nginx if running (Docker will use port 80)
if systemctl is-active --quiet nginx 2>/dev/null; then
    echo "--> Stopping system nginx (Docker will use port 80)..."
    sudo systemctl stop nginx
    sudo systemctl disable nginx
fi

# Stop PM2 if running
if command -v pm2 &>/dev/null; then
    echo "--> Stopping PM2 processes..."
    pm2 stop all 2>/dev/null || true
fi

echo "--> Pulling latest code..."
git pull

echo "--> Building and starting all services..."
docker compose up --build -d

echo "--> Cleaning up unused images..."
docker image prune -f

SERVER_IP=$(hostname -I | awk '{print $1}')
echo ""
echo "=== Done! ==="
echo "  Tenant Admin -> http://$SERVER_IP"
echo "  Super Admin  -> http://$SERVER_IP:8080"
echo "  Backend API  -> http://$SERVER_IP/api"
