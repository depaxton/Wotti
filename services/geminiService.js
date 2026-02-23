/**
 * Gemini AI Service
 * 
 * שירות הליבה לאינטראקציה עם Gemini API
 * כל הפונקציונליות הקשורה ל-AI צריכה להיות מיושמת כאן
 * 
 * שימוש ב-System Instructions לפי ה-API הרשמי של Google Gemini
 * https://ai.google.dev/gemini-api/docs/models
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getApiKey,
  DEFAULT_MODEL,
  DEFAULT_TEMPERATURE,
  DEFAULT_TOP_P,
  DEFAULT_TOP_K,
  DEFAULT_MAX_TOKENS,
  DEFAULT_CANDIDATE_COUNT,
  DEFAULT_STOP_SEQUENCES,
  DEFAULT_RESPONSE_MIME_TYPE,
  isConfigured
} from '../config/geminiConfig.js';
import { logInfo, logError, logWarn } from '../utils/logger.js';
import { processAiResponse } from './aiCommandMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let genAI = null;
let model = null;

const INSTRUCTIONS_FILE = path.join(__dirname, '../utils/gemini_instructions.json');

/** Placeholder בטקסט ההוראות - יוחלף אוטומטית בתאריך/שעה נוכחיים */
const DATETIME_PLACEHOLDER = '{{CURRENT_DATETIME}}';

/**
 * מחזיר תאריך ושעה מדויקים לפורמט קריא ל-AI.
 * משתמש ב-UTC + שעון ישראל לעקביות ולרלוונטיות מקומית.
 * @returns {string} מחרוזת תאריך/שעה
 */
function getCurrentDateTimeContext() {
  const now = new Date();
  const iso = now.toISOString();
  const local = now.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
  return `${iso} (שעון ישראל: ${local})`;
}

/**
 * מזריק הקשר תאריך/שעה להוראות - כך ש-Gemini תמיד יודעת את הזמן המדויק.
 * תומך בשני מצבים: placeholder {{CURRENT_DATETIME}} או הוספה אוטומטית בתחילה.
 * @param {string} instructions - הוראות בסיס
 * @returns {string} הוראות עם הקשר זמן
 */
function injectDateTimeContext(instructions) {
  const base = (instructions || '').trim();
  const datetime = getCurrentDateTimeContext();
  // החלפת placeholder אם המשתמש הוסיף אותו בהוראות, אחרת הוספה בתחילה
  if (base.includes(DATETIME_PLACEHOLDER)) {
    return base.split(DATETIME_PLACEHOLDER).join(datetime);
  }
  return `[הקשר זמן]\nהתאריך והשעה המדויקים כרגע: ${datetime}\n\n${base}`;
}

/**
 * Initialize Gemini AI client
 * @returns {boolean} True if initialized successfully, false otherwise
 */
function initializeGemini() {
  try {
    if (!isConfigured()) {
      logWarn('⚠️ Gemini API key not configured. Please set GEMINI_API_KEY environment variable or create config/gemini-config.json');
      return false;
    }

    genAI = new GoogleGenerativeAI(getApiKey());
    model = genAI.getGenerativeModel({ model: DEFAULT_MODEL });
    
    logInfo('✅ Gemini AI initialized successfully');
    return true;
  } catch (error) {
    logError('❌ Failed to initialize Gemini AI:', error);
    return false;
  }
}

/**
 * יצירת מודל עם System Instructions
 * לפי ה-API הרשמי של Google Gemini
 * @param {string} instructions - הוראות המערכת
 * @returns {object} מודל Gemini עם הוראות מערכת
 */
function getModelWithSystemInstructions(instructions) {
  if (!genAI) {
    initializeGemini();
  }
  
  const modelConfig = {
    model: DEFAULT_MODEL
  };
  
  // הוספת System Instructions אם יש
  if (instructions && instructions.trim()) {
    modelConfig.systemInstruction = {
      parts: [{ text: instructions }]
    };
  }
  
  return genAI.getGenerativeModel(modelConfig);
}

/**
 * יצירת generationConfig עם כל ההגדרות מ-config
 * @param {object} options - אפשרויות נוספות (עלולות לדרוס את ברירת המחדל)
 * @returns {object} generationConfig מוכן לשימוש
 */
function buildGenerationConfig(options = {}) {
  const generationConfig = {
    temperature: options.temperature ?? DEFAULT_TEMPERATURE,
    maxOutputTokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
  };

  // הוספת Top-P אם מוגדר
  if (options.topP !== undefined || DEFAULT_TOP_P !== undefined) {
    generationConfig.topP = options.topP ?? DEFAULT_TOP_P;
  }

  // הוספת Top-K אם מוגדר
  if (options.topK !== undefined || DEFAULT_TOP_K !== undefined) {
    generationConfig.topK = options.topK ?? DEFAULT_TOP_K;
  }

  // הוספת Candidate Count אם מוגדר
  if (options.candidateCount !== undefined || DEFAULT_CANDIDATE_COUNT !== undefined) {
    generationConfig.candidateCount = options.candidateCount ?? DEFAULT_CANDIDATE_COUNT;
  }

  // הוספת Stop Sequences אם מוגדר
  if (options.stopSequences !== undefined || DEFAULT_STOP_SEQUENCES !== undefined) {
    generationConfig.stopSequences = options.stopSequences ?? DEFAULT_STOP_SEQUENCES;
  }

  // הוספת Response MIME Type אם מוגדר
  if (options.responseMimeType !== undefined || DEFAULT_RESPONSE_MIME_TYPE !== undefined) {
    generationConfig.responseMimeType = options.responseMimeType ?? DEFAULT_RESPONSE_MIME_TYPE;
  }

  return generationConfig;
}

/**
 * Generate text using Gemini AI
 * @param {string} prompt - The prompt to send to the model
 * @param {object} options - Optional configuration
 * @returns {Promise<{success: boolean, text?: string, error?: string}>}
 */
export async function generateText(prompt, options = {}) {
  try {
    if (!genAI) {
      if (!initializeGemini()) {
        return { success: false, error: 'Gemini AI not initialized. Please configure API key.' };
      }
    }

    if (!prompt || typeof prompt !== 'string') {
      return { success: false, error: 'Invalid prompt provided' };
    }

    // קריאה מחדש של ההוראות לפני כל הודעה + הזרקת תאריך/שעה עדכניים
    const instructions = injectDateTimeContext(getInstructionsSync());
    
    // יצירת מודל עם System Instructions
    const modelToUse = getModelWithSystemInstructions(instructions);

    // בניית generationConfig עם כל ההגדרות
    const generationConfig = buildGenerationConfig(options);

    const result = await modelToUse.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig,
    });

    const response = await result.response;
    let text = response.text();
    const processed = await processAiResponse(text, options.context || {});
    text = processed.text;

    return { success: true, text };
  } catch (error) {
    logError('❌ Error generating text with Gemini:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Generate text with conversation history
 * משתמש ב-System Instructions לפי ה-API הרשמי של Google Gemini
 * @param {Array} history - Array of {role: 'user'|'model', text: string}
 * @param {string} newPrompt - New user prompt
 * @param {object} options - Optional configuration
 * @returns {Promise<{success: boolean, text?: string, history?: Array, error?: string}>}
 */
export async function generateWithHistory(history = [], newPrompt, options = {}) {
  try {
    if (!genAI) {
      if (!initializeGemini()) {
        return { success: false, error: 'Gemini AI not initialized. Please configure API key.' };
      }
    }

    // קריאה מחדש של ההוראות לפני כל הודעה + הזרקת תאריך/שעה עדכניים
    const instructions = injectDateTimeContext(getInstructionsSync());

    // ניקוי ההיסטוריה - Gemini מצפה שתתחיל עם role 'user'
    let cleanedHistory = [...history];
    while (cleanedHistory.length > 0 && cleanedHistory[0].role === 'model') {
      cleanedHistory.shift();
    }
    
    // המרת ההיסטוריה לפורמט של Gemini
    const historyToUse = cleanedHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    }));

    // יצירת מודל עם System Instructions
    const modelToUse = getModelWithSystemInstructions(instructions);

    // בניית generationConfig עם כל ההגדרות
    const generationConfig = buildGenerationConfig(options);

    // יצירת שיחה עם ההיסטוריה
    const chat = modelToUse.startChat({
      history: historyToUse,
      generationConfig,
    });

    const result = await chat.sendMessage(newPrompt);

    const response = await result.response;
    let text = response.text();
    const processed = await processAiResponse(text, options.context || {});
    text = processed.text;

    // עדכון ההיסטוריה - ללא ההוראות כי הן נשלחות כ-System Instructions
    const updatedHistory = [
      ...history,
      { role: 'user', text: newPrompt },
      { role: 'model', text },
    ];

    return { success: true, text, history: updatedHistory };
  } catch (error) {
    logError('❌ Error generating text with history:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Analyze text (sentiment, summary, etc.)
 * @param {string} text - Text to analyze
 * @param {string} analysisType - Type of analysis (sentiment, summary, keywords, etc.)
 * @returns {Promise<{success: boolean, result?: any, error?: string}>}
 */
export async function analyzeText(text, analysisType = 'summary') {
  try {
    let prompt = '';
    
    switch (analysisType) {
      case 'sentiment':
        prompt = `Analyze the sentiment of the following text and respond with JSON format: {sentiment: "positive|negative|neutral", confidence: 0-1, explanation: "brief explanation"}\n\nText: ${text}`;
        break;
      case 'summary':
        prompt = `Provide a concise summary of the following text:\n\n${text}`;
        break;
      case 'keywords':
        prompt = `Extract the main keywords from the following text and respond with a JSON array:\n\nText: ${text}`;
        break;
      default:
        prompt = `Analyze the following text: ${text}`;
    }

    const result = await generateText(prompt);
    return result;
  } catch (error) {
    logError('❌ Error analyzing text:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get available models
 * @returns {Promise<{success: boolean, models?: Array, error?: string}>}
 */
export async function getAvailableModels() {
  try {
    if (!genAI) {
      if (!initializeGemini()) {
        return { success: false, error: 'Gemini AI not initialized' };
      }
    }

    // Available Gemini models (verified via API)
    const models = [
      'gemini-1.5-flash',        // Fast and efficient, stable version
      'gemini-1.5-flash-8b',     // Lite version with higher quotas (recommended for high volume)
      'gemini-2.5-flash',        // Latest flash version
      'gemini-2.5-pro',          // More capable, better for complex tasks
      'gemini-3-flash-preview',  // Experimental flash version
    ];

    return { success: true, models };
  } catch (error) {
    logError('❌ Error getting models:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Save Gemini instructions
 * @param {string} instructions - The instructions text
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function saveInstructions(instructions) {
  try {
    const data = {
      instructions: instructions || '',
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(INSTRUCTIONS_FILE, JSON.stringify(data, null, 2), 'utf8');
    logInfo('✅ Gemini instructions saved successfully');
    return { success: true };
  } catch (error) {
    logError('❌ Error saving instructions:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get Gemini instructions
 * @returns {Promise<{success: boolean, instructions?: string, error?: string}>}
 */
export async function getInstructions() {
  try {
    if (fs.existsSync(INSTRUCTIONS_FILE)) {
      const data = JSON.parse(fs.readFileSync(INSTRUCTIONS_FILE, 'utf8'));
      return { success: true, instructions: data.instructions || '' };
    }
    return { success: true, instructions: '' };
  } catch (error) {
    logError('❌ Error loading instructions:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get Gemini instructions synchronously (for use in other functions)
 * @returns {string}
 */
export function getInstructionsSync() {
  try {
    if (fs.existsSync(INSTRUCTIONS_FILE)) {
      const data = JSON.parse(fs.readFileSync(INSTRUCTIONS_FILE, 'utf8'));
      return data.instructions || '';
    }
    return '';
  } catch (error) {
    logError('❌ Error loading instructions:', error);
    return '';
  }
}

/**
 * Get Gemini instructions metadata synchronously (including updatedAt timestamp)
 * @returns {{instructions: string, updatedAt: string|null}}
 */
export function getInstructionsMetadataSync() {
  try {
    if (fs.existsSync(INSTRUCTIONS_FILE)) {
      const data = JSON.parse(fs.readFileSync(INSTRUCTIONS_FILE, 'utf8'));
      return {
        instructions: data.instructions || '',
        updatedAt: data.updatedAt || null
      };
    }
    return { instructions: '', updatedAt: null };
  } catch (error) {
    logError('❌ Error loading instructions metadata:', error);
    return { instructions: '', updatedAt: null };
  }
}

// Initialize on module load
initializeGemini();

/**
 * Re-initialize Gemini with current API key (e.g. after user saved new key in settings).
 * @returns {boolean} True if initialized successfully
 */
export function reinitialize() {
  genAI = null;
  model = null;
  return initializeGemini();
}

export function isInitialized() {
  return !!model;
}

