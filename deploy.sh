#!/bin/bash

# --- הגדרות ---
SERVER_IP="187.77.87.208"
SERVER_PATH="/root/Wotti" 

echo "--- 📦 1. Pushing to GitHub ---"
git add .
git commit -m "Auto-deploy: $(date +'%d-%m-%y %H:%M')"
git push origin main

echo "--- 🌐 2. Updating VPS ---"
ssh -tt root@${SERVER_IP} << EOF
    cd ${SERVER_PATH}
    
    # עדכון כתובת ה-Remote במידה והשתנתה
    git remote set-url origin https://github.com/depaxton/Wotti
    
    echo "📥 Fetching updates..."
    git fetch origin main
    
    echo "🎯 Updating ONLY recently changed files (skipping locks)..."
    # סינון קבצי lock ועדכון קבצים אחד-אחד כדי למנוע קריסה של כל התהליך
    git diff --name-only HEAD origin/main | grep -v ".lock" | xargs -n 1 -r git checkout origin/main --
    
    echo "♻️ Restarting Application..."
    # עצירה ומחיקה של כל התהליכים ב-PM2 כדי להתחיל דף חלק
    pm2 delete all || true
    
    # הרצה מחדש באמצעות npm start תחת ניהול של PM2
    pm2 start npm --name "whatsapp-bot" -- start

    exit
EOF

echo "--- ✅ Done! ---"