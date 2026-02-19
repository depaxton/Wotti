# התחברות יומן גוגל (Google Calendar)

## הגדרה

1. **העתק את קובץ הדוגמה**
   - העתק `config/google-calendar-credentials.example.json` ל-`config/google-calendar-credentials.json`.

2. **Google Cloud Console**
   - היכנס ל-[Google Cloud Console](https://console.cloud.google.com/), צור פרויקט (או בחר קיים).
   - הפעל את **Google Calendar API**: APIs & Services → Library → חפש "Google Calendar API" → Enable.
   - צור **OAuth 2.0 Client**: APIs & Services → Credentials → Create Credentials → OAuth client ID.
   - סוג: **Web application**. הוסף ב-**Authorized redirect URIs**:
     - פיתוח: `http://localhost:5000/api/google-calendar/callback`
     - פרודקשן: `https://YOUR_DOMAIN/api/google-calendar/callback`

3. **מפתחות**
   - אחרי יצירת ה-OAuth client הורד את ה-JSON או העתק **Client ID** ו-**Client secret**.
   - פתח את `config/google-calendar-credentials.json` והדבק:
     - `client_id`: ה-Client ID (מסתיים ב-`.apps.googleusercontent.com`).
     - `client_secret`: ה-Client secret.
   - `redirect_uri` כבר מוגדר לדוגמה; בפרודקשן עדכן לפי הדומיין שלך.

4. **התקנת חבילה**
   - הרץ: `npm install` (הפרויקט כבר כולל את `googleapis`).

5. **שימוש**
   - ביומן הפגישות לחץ על "ממשקות ליומן גוגל", אשר את הגישה בחשבון גוגל.
   - אחרי החיבור, כל יצירה/עדכון/מחיקה של פגישה או תזכורת תסתנכרן אוטומטית ליומן גוגל.
   - "התנתק" מנקה את החיבור (ניתן להתחבר אחר כך עם חשבון אחר).

## אחסון מקומי

- **Credentials**: `config/google-calendar-credentials.json` (לא נשמר ב-git אם מופיע ב-.gitignore).
- **Tokens**: `data/google-calendar-tokens.json` – נוצר אחרי ההתחברות הראשונה (גם הוא מקומי).
