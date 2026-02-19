#!/bin/bash
# =============================================================================
# Wotti - התקנה ראשונית על VPS
# מריצים פעם אחת על השרת (או דרך SSH) כדי למשוך את הקוד מ-GitHub ולהריץ.
# =============================================================================

set -e

REPO_URL="https://github.com/depaxton/Wotti.git"
INSTALL_DIR="/root/Wotti"
NODE_VERSION="20"

echo "--- Wotti VPS Setup ---"
echo ""

# 1. התקנת Node.js אם חסר
if ! command -v node &>/dev/null; then
  echo "📦 Node.js not found. Installing Node.js ${NODE_VERSION}..."
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt-get install -y nodejs
  echo "✅ Node.js $(node -v) installed."
else
  echo "✅ Node.js already installed: $(node -v)"
fi

# 2. התקנת git אם חסר
if ! command -v git &>/dev/null; then
  echo "📦 Installing git..."
  apt-get update -qq && apt-get install -y git
  echo "✅ Git installed."
else
  echo "✅ Git already installed: $(git --version)"
fi

# 2b. תלויות ל-Chromium (Puppeteer/WhatsApp Web) על לינוקס
if [ -f /etc/debian_version ]; then
  echo "📦 Installing Chromium dependencies for headless browser..."
  apt-get update -qq
  apt-get install -y -qq \
    ca-certificates fonts-liberation libappindicator3-1 libasound2 libatk-bridge2.0-0 \
    libatk1.0-0 libcups2 libdbus-1-3 libgdk-pixbuf2.0-0 libnspr4 libnss3 \
    libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 xdg-utils 2>/dev/null || true
  echo "✅ Chromium dependencies done."
fi

# 3. תיקיית הפרויקט
mkdir -p "$(dirname "$INSTALL_DIR")"
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "📥 Repository already exists at $INSTALL_DIR. Pulling latest..."
  cd "$INSTALL_DIR"
  git fetch origin main
  git reset --hard origin/main
else
  echo "📥 Cloning repository from GitHub..."
  git clone "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# 4. התקנת תלויות
echo "📦 Installing npm dependencies..."
npm install

# 5. PM2 לניהול התהליך (התקנה גלובלית אם חסר)
if ! command -v pm2 &>/dev/null; then
  echo "📦 Installing PM2..."
  npm install -g pm2
  echo "✅ PM2 installed."
else
  echo "✅ PM2 already installed."
fi

# 6. קבצי תצורה (אופציונלי – אם אין)
if [ ! -f "$INSTALL_DIR/config/gemini-config.json" ]; then
  echo "⚠️  config/gemini-config.json not found."
  echo "   Create it with: {\"apiKey\": \"YOUR_GEMINI_API_KEY\"}"
  echo "   Or set environment: export GEMINI_API_KEY=your_key"
fi

# 7. הפעלת האפליקציה עם PM2
cd "$INSTALL_DIR"
echo "🚀 Starting Wotti with PM2..."
pm2 delete whatsapp-bot 2>/dev/null || true
PORT=${PORT:-5000} pm2 start npm --name "whatsapp-bot" -- start

pm2 save
pm2 startup 2>/dev/null || true

echo ""
echo "--- ✅ Setup complete ---"
echo "  App directory: $INSTALL_DIR"
echo "  Start/stop:    pm2 start whatsapp-bot  /  pm2 stop whatsapp-bot"
echo "  Logs:          pm2 logs whatsapp-bot"
echo "  Status:        pm2 status"
echo ""
echo "  Open in browser: http://YOUR_VPS_IP:${PORT}"
echo "  (Replace YOUR_VPS_IP with 187.77.87.208 or your domain)"
echo ""
