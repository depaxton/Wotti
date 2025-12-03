// ETag Helper Utility for Backend
// יוצר ETag headers ומטפל ב-If-None-Match requests

import crypto from 'crypto';

/**
 * יוצר ETag hash מהנתונים
 * @param {any} data - הנתונים ליצירת hash
 * @returns {string} ETag string (עם quotes)
 */
export function generateETag(data) {
  if (!data) return null;
  
  // המר את הנתונים ל-string
  const dataString = typeof data === 'string' ? data : JSON.stringify(data);
  
  // יצירת hash MD5 מהנתונים
  const hash = crypto.createHash('md5').update(dataString).digest('hex');
  
  // החזר ETag עם quotes (פורמט סטנדרטי)
  return `"${hash}"`;
}

/**
 * בודק אם הבקשה מכילה If-None-Match header התואם ל-ETag
 * @param {Object} req - Express request object
 * @param {string} etag - ה-ETag הנוכחי של המשאב
 * @returns {boolean} true אם הנתונים לא השתנו (304 Not Modified)
 */
export function checkIfNoneMatch(req, etag) {
  const ifNoneMatch = req.headers['if-none-match'];
  return ifNoneMatch === etag;
}

/**
 * מגדיר ETag header בתגובה ומטפל ב-If-None-Match
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {any} data - הנתונים לשליחה
 * @returns {boolean} true אם החזר 304 (לא צריך לשלוח body), false אם צריך לשלוח את הנתונים
 */
export function handleETag(req, res, data) {
  const etag = generateETag(data);
  
  if (!etag) {
    // אם אין ETag, פשוט החזר false (שלח את הנתונים כרגיל)
    return false;
  }
  
  // הגדר את ה-ETag header
  res.setHeader('ETag', etag);
  
  // בדוק אם הלקוח שלח If-None-Match התואם
  if (checkIfNoneMatch(req, etag)) {
    // הנתונים לא השתנו - החזר 304 Not Modified
    res.status(304).end();
    return true;
  }
  
  // הנתונים השתנו או שזו בקשה ראשונה - החזר false (שלח את הנתונים)
  return false;
}

