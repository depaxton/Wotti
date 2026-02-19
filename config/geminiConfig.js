/**
 * Gemini AI Configuration
 *
 * הגדרות ותצורה של Google Gemini API
 * Make sure to set your API key in the environment variable GEMINI_API_KEY
 * or create a config/gemini-config.json file with: { "apiKey": "your_api_key_here" }
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to load API key from environment variable first
let GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const CONFIG_PATH = path.join(__dirname, "gemini-config.json");

function loadApiKeyFromFile() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
      return config.apiKey || "";
    }
  } catch (error) {
    console.warn("⚠️ Could not load Gemini config file:", error.message);
  }
  return "";
}

// If not in environment, try to load from a local config file
if (!GEMINI_API_KEY) {
  GEMINI_API_KEY = loadApiKeyFromFile();
}

/** Get current API key (for dynamic reload after save from UI) */
export function getApiKey() {
  return GEMINI_API_KEY || "";
}

/**
 * Save API key to config file and update in-memory value.
 * Used when user enters key in AI settings. Environment variable takes precedence on next restart.
 * @param {string} apiKey - The Gemini API key to save
 * @returns {{ success: boolean, error?: string }}
 */
export function setApiKeyAndSave(apiKey) {
  const key = (apiKey || "").trim();
  if (!key) {
    return { success: false, error: "API key is required" };
  }
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ apiKey: key }, null, 2), "utf8");
    GEMINI_API_KEY = key;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Delete API key from config file and clear in-memory value.
 * @returns {{ success: boolean, error?: string }}
 */
export function deleteApiKey() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      fs.unlinkSync(CONFIG_PATH);
    }
    GEMINI_API_KEY = "";
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Default model configuration
// Available models: gemini-1.5-flash, gemini-1.5-flash-8b, gemini-2.5-flash, gemini-2.5-pro, gemini-3-flash-preview
const DEFAULT_MODEL = "gemini-3-flash-preview"; // Lite version with higher quota limits

// Temperature - שליטה ברמת היצירתיות והאקראיות של התגובות
// טווח: 0.0-2.0
// 0.0 = דטרמיניסטי מאוד, תגובות עקביות
// 1.0 = יצירתי ומגוון
// 2.0 = מאוד יצירתי ואקראי
const DEFAULT_TEMPERATURE = 0.4;

// Top-P (Nucleus Sampling) - שליטה על מגוון התגובות
// טווח: 0.0-1.0
// 0.1 = רק המילים הכי סבירות
// 0.9 = מגוון רחב יותר של מילים
// undefined = לא מוגבל (Gemini בוחר אוטומטית)
const DEFAULT_TOP_P = 0.3;

// Top-K - מספר המילים המובילות לבחירה
// טווח: 1-40
// נמוך = תגובות יותר צפויות
// גבוה = תגובות יותר מגוונות
// undefined = לא מוגבל
const DEFAULT_TOP_K = undefined;

// הגבלת טוקנים לפלט - שינוי הערך הזה יגביל את אורך התגובה של Gemini
// טווח מומלץ: 100-8192 (תלוי במודל)
// לדוגמה: 500 = תגובות קצרות, 2048 = תגובות בינוניות, 4096 = תגובות ארוכות
const DEFAULT_MAX_TOKENS = 2000;

// Candidate Count - כמה תגובות חלופיות ליצור
// טווח: 1-8
// 1 = תגובה אחת (ברירת מחדל, מהיר יותר)
// 8 = 8 תגובות אפשריות (איטי יותר, יקר יותר)
const DEFAULT_CANDIDATE_COUNT = 1;

// Stop Sequences - רצפי תווים שיגרמו למודל להפסיק ליצור טקסט
// לדוגמה: ['\n\n', 'END', '###'] - המודל יפסיק כשיראה את הרצפים האלה
const DEFAULT_STOP_SEQUENCES = undefined;

// Safety Settings - הגדרות בטיחות (סינון תוכן)
// אפשרויות: 'BLOCK_NONE', 'BLOCK_ONLY_HIGH', 'BLOCK_MEDIUM_AND_ABOVE', 'BLOCK_LOW_AND_ABOVE'
// או מערך של אובייקטים עם category ו-threshold
const DEFAULT_SAFETY_SETTINGS = undefined;

// Response MIME Type - פורמט התגובה
// אפשרויות: 'text/plain', 'application/json'
const DEFAULT_RESPONSE_MIME_TYPE = "text/plain";

// Max History Messages - כמה הודעות אחרונות לשמור בהקשר
const DEFAULT_MAX_HISTORY_MESSAGES = 60;

export {
  GEMINI_API_KEY,
  DEFAULT_MODEL,
  DEFAULT_TEMPERATURE,
  DEFAULT_TOP_P,
  DEFAULT_TOP_K,
  DEFAULT_MAX_TOKENS,
  DEFAULT_CANDIDATE_COUNT,
  DEFAULT_STOP_SEQUENCES,
  DEFAULT_SAFETY_SETTINGS,
  DEFAULT_RESPONSE_MIME_TYPE,
  DEFAULT_MAX_HISTORY_MESSAGES,
};

// Helper function to check if API key is configured
export function isConfigured() {
  return !!GEMINI_API_KEY;
}
