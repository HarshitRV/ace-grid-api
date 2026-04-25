#!/bin/bash
set -e

# ── Ace Grid API - Zero-Downtime Deploy Script ────────────────────────────────
# Usage: npm run deploy

PROJECT_DIR="/home/harshitrvpi/code/pro/ace-grid-api"
APP_NAME="acegridapi"

echo "🔨 Building..."
cd "$PROJECT_DIR"
npm run build

echo ""

# Check if PM2 process exists
if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
    echo "♻️  Reloading $APP_NAME (zero-downtime)..."
    pm2 reload ecosystem.config.cjs --update-env
else
    echo "🚀 Starting $APP_NAME for the first time..."
    pm2 start ecosystem.config.cjs
    pm2 save
fi

echo ""
echo "✅ Deploy complete!"
pm2 info "$APP_NAME" --no-color | head -25
