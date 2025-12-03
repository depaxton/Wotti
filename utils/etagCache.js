// ETag Cache Utility
// מנהל מטמון ETag עבור בקשות polling חכמות
// מפחית עומס על השרת על ידי שימוש ב-ETag/If-None-Match headers

/**
 * מטמון ETag עבור כל endpoint
 * מפתח: URL של הבקשה, ערך: ETag האחרון
 */
const etagCache = new Map();

/**
 * יוצר hash string מהנתונים עבור ETag
 * @param {any} data - הנתונים ליצירת hash
 * @returns {string} Hash string
 */
function generateETag(data) {
  if (!data) return null;
  
  // יוצר hash פשוט מהנתונים
  const dataString = typeof data === 'string' ? data : JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < dataString.length; i++) {
    const char = dataString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `"${Math.abs(hash).toString(16)}"`;
}

/**
 * מבצע fetch עם תמיכה ב-ETag
 * @param {string} url - URL של הבקשה
 * @param {RequestInit} options - אפשרויות fetch נוספות
 * @returns {Promise<Response>} תגובת השרת
 */
export async function fetchWithETag(url, options = {}) {
  // קבל את ה-ETag האחרון מהמטמון
  const cachedETag = etagCache.get(url);
  
  // הוסף את ה-If-None-Match header אם יש ETag במטמון
  const headers = {
    ...options.headers,
  };
  
  if (cachedETag) {
    headers['If-None-Match'] = cachedETag;
  }
  
  // בצע את הבקשה
  const response = await fetch(url, {
    ...options,
    headers,
  });
  
  // אם השרת החזיר 304 Not Modified, אין צורך לעדכן את המטמון
  if (response.status === 304) {
    return response;
  }
  
  // אם השרת החזיר ETag חדש, עדכן את המטמון
  const newETag = response.headers.get('ETag');
  if (newETag) {
    etagCache.set(url, newETag);
  }
  
  return response;
}

/**
 * מבצע fetch עם ETag ומחזיר את הנתונים רק אם השתנו
 * @param {string} url - URL של הבקשה
 * @param {RequestInit} options - אפשרויות fetch נוספות
 * @returns {Promise<{data: any, changed: boolean, status: number}>} אובייקט עם הנתונים, האם השתנו, וסטטוס
 */
export async function fetchWithETagSmart(url, options = {}) {
  try {
    const response = await fetchWithETag(url, options);
    
    // אם השרת החזיר 304, הנתונים לא השתנו
    if (response.status === 304) {
      return {
        data: null,
        changed: false,
        status: 304,
        response: response
      };
    }
    
    // אם יש שגיאה, החזר אותה
    if (!response.ok) {
      return {
        data: null,
        changed: false,
        status: response.status,
        error: `HTTP error! status: ${response.status}`,
        response: response
      };
    }
    
    // קרא את הנתונים
    const data = await response.json();
    
    return {
      data: data,
      changed: true,
      status: response.status,
      response: response
    };
  } catch (error) {
    return {
      data: null,
      changed: false,
      status: 0,
      error: error.message,
      response: null
    };
  }
}

/**
 * מנקה את המטמון עבור URL מסוים
 * @param {string} url - URL לנקות (אופציונלי, אם לא מוגדר מנקה הכל)
 */
export function clearETagCache(url = null) {
  if (url) {
    etagCache.delete(url);
  } else {
    etagCache.clear();
  }
}

/**
 * מחזיר את ה-ETag הנוכחי עבור URL
 * @param {string} url - URL לבדיקה
 * @returns {string|null} ה-ETag או null אם לא קיים
 */
export function getCachedETag(url) {
  return etagCache.get(url) || null;
}

