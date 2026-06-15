#!/bin/bash
set -e

echo "=== Work-Hour Deploy Script ==="

# Pull latest code
git pull origin main

# Build tenant-admin
echo "--- Building tenant-admin..."
cd tenant-admin
npm install
npm run build
cd ..

# Build super-admin
echo "--- Building super-admin..."
cd super-admin
npm install
npm run build
cd ..

# Start / restart docker
echo "--- Starting Docker services..."
docker compose up -d --build

echo "=== Done ==="
echo "Tenant Admin:  http://161.104.17.113"
echo "Super Admin:   http://161.104.17.113:3001"
echo "Backend API:   http://161.104.17.113:3002/api"
