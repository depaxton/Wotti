// Grow Controller – API להתחברות ל-GROW
// סטטוס, שמירת קוקיז, רענון והתנתקות

import {
  getConnectionStatus,
  getSession,
  saveCookies,
  clearCookies,
  refreshSession,
} from "../services/growSessionService.js";

/**
 * GET /api/grow/status – סטטוס התחברות GROW
 */
export async function getStatusController(req, res) {
  try {
    const status = await getConnectionStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err?.message ?? "Internal server error" });
  }
}

/**
 * GET /api/grow/session – פרטי הסשן (ללא ערכי קוקיז רגישים אם צריך)
 */
export async function getSessionController(req, res) {
  try {
    const session = await getSession();
    res.json({
      hasCookies: session.cookies?.length > 0 || !!session.cookieHeader,
      isConnected: session.isConnected,
      lastRefreshAt: session.lastRefreshAt,
      lastRefreshStatus: session.lastRefreshStatus,
      source: session.source,
      bizToken: session.bizToken || "",
      timestamp: session.timestamp,
    });
  } catch (err) {
    res.status(500).json({ error: err?.message ?? "Internal server error" });
  }
}

/**
 * POST /api/grow/cookies – שמירת קוקיז (מבנה JSON כמו בתמונה)
 * Body: { cookieHeader?, cookies?, source?, bizToken? }
 */
export async function postCookiesController(req, res) {
  try {
    await saveCookies(req.body);
    const status = await getConnectionStatus();
    res.json({ success: true, ...status });
  } catch (err) {
    res.status(500).json({ error: err?.message ?? "Internal server error" });
  }
}

/**
 * POST /api/grow/disconnect – ניקוי קוקיז מקומיים בלבד (לא התנתקות אמיתית מ-grow.website)
 * מוחק את הקוקיז השמורים ומאפס את הסטטוס – האפליקציה "נקייה" ומוכנה להתחברות חדשה.
 */
export async function postDisconnectController(req, res) {
  try {
    await clearCookies();
    res.json({ success: true, isConnected: false });
  } catch (err) {
    res.status(500).json({ error: err?.message ?? "Internal server error" });
  }
}

/**
 * POST /api/grow/refresh – רענון מיידי (לא מחכה ל-5 דקות)
 */
export async function postRefreshController(req, res) {
  try {
    const result = await refreshSession();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err?.message ?? "Internal server error" });
  }
}
