// Update system configuration
// Centralized configuration for the auto-update system

export const UPDATE_CONFIG = {
  // URL לקובץ version.json על השרת
  // ⚠️ ודא שה-repository הוא PUBLIC כדי שה-URL הזה יעבוד!
  UPDATE_CHECK_URL: process.env.UPDATE_CHECK_URL || "https://raw.githubusercontent.com/depaxton/Wotti/main/version.json",

  // תדירות בדיקה לעדכונים (בדקות)
  UPDATE_CHECK_INTERVAL: parseInt(process.env.UPDATE_CHECK_INTERVAL) || 3,

  // האם עדכונים אוטומטיים מופעלים
  AUTO_UPDATE_ENABLED: process.env.AUTO_UPDATE_ENABLED !== "false",

  // האם להציג התראה לפני עדכון
  SHOW_UPDATE_NOTIFICATION: process.env.SHOW_UPDATE_NOTIFICATION !== "false",

  // תיקייה זמנית להורדות
  UPDATE_TEMP_DIR: "./updates/temp",

  // תיקיית גיבוי
  UPDATE_BACKUP_DIR: "./updates/backup",

  // מספר גיבויים מקסימלי לשמירה
  MAX_BACKUPS: 3,

  // timeout להורדה (במילישניות)
  DOWNLOAD_TIMEOUT: 5 * 60 * 1000, // 5 דקות

  // ניסיונות מקסימליים להורדה
  MAX_DOWNLOAD_ATTEMPTS: 3,

  // האם להריץ npm install לאחר עדכון
  RUN_NPM_INSTALL: true,

  // timeout להפעלה מחדש (במילישניות)
  RESTART_DELAY: 2000, // 2 שניות
};
