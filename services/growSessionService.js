// Grow Session Service – רענון סשן GROW כל 5 דקות
// שומר על הקוקיז בחיים ומעדכן סטטוס התחברות

import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import { logInfo, logError, logWarn } from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const GROW_SESSION_PATH = path.resolve(__dirname, "../utils/grow_session.json");
const GROW_DASHBOARD_URL = "https://grow.website/dashboard";
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 דקות

let intervalId = null;

/**
 * קורא את קובץ הסשן הנוכחי
 * @returns {Promise<Object>}
 */
export async function getSession() {
  try {
    const data = await fs.readJson(GROW_SESSION_PATH);
    return data;
  } catch (e) {
    if (e.code === "ENOENT") {
      const defaultSession = {
        cookieHeader: "",
        cookies: [],
        bizToken: "",
        source: "https://grow.website",
        timestamp: null,
        isConnected: false,
        lastRefreshAt: null,
        lastRefreshStatus: null,
      };
      await fs.writeJson(GROW_SESSION_PATH, defaultSession, { spaces: 2 });
      return defaultSession;
    }
    throw e;
  }
}

/**
 * בודק אם מבנה הקוקיז תקף (יש cookieHeader או cookies עם ערכים)
 * @param {Object} session
 * @returns {boolean}
 */
function isValidCookieStructure(session) {
  if (!session) return false;
  const hasHeader = typeof session.cookieHeader === "string" && session.cookieHeader.trim().length > 0;
  const hasCookies = Array.isArray(session.cookies) && session.cookies.length > 0;
  return hasHeader || hasCookies;
}

/**
 * בונה cookieHeader ממערך cookies
 * @param {Array} cookies
 * @returns {string}
 */
function buildCookieHeader(cookies) {
  if (!Array.isArray(cookies) || cookies.length === 0) return "";
  return cookies
    .map((c) => (c.name && c.value ? `${c.name}=${c.value}` : null))
    .filter(Boolean)
    .join("; ");
}

/**
 * מפרסר Set-Cookie headers מהתגובה
 * @param {Object} response - axios response
 * @returns {Array} מערך אובייקטי cookie
 */
function parseSetCookieHeaders(response) {
  const setCookies = response.headers["set-cookie"];
  if (!setCookies) return [];

  const parsed = [];
  const cookies = Array.isArray(setCookies) ? setCookies : [setCookies];

  for (const raw of cookies) {
    const parts = raw.split(";").map((p) => p.trim());
    const [nameValue] = parts;
    if (!nameValue || !nameValue.includes("=")) continue;

    const eqIdx = nameValue.indexOf("=");
    const name = nameValue.slice(0, eqIdx);
    const value = nameValue.slice(eqIdx + 1);

    const cookie = {
      name,
      value,
      domain: ".grow.website",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "unspecified",
    };

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      const [key, val] = part.split("=").map((s) => s.trim());
      const keyLower = (key || "").toLowerCase();
      if (keyLower === "domain") cookie.domain = val || cookie.domain;
      if (keyLower === "path") cookie.path = val || "/";
      if (keyLower === "httponly") cookie.httpOnly = true;
      if (keyLower === "secure") cookie.secure = true;
      if (keyLower === "samesite") cookie.sameSite = val || "unspecified";
      if (keyLower === "expires" && val) {
        try {
          cookie.expirationDate = new Date(val).getTime() / 1000;
        } catch (_) {}
      }
      if (keyLower === "max-age" && val) {
        const maxAge = parseInt(val, 10);
        if (!isNaN(maxAge)) {
          cookie.expirationDate = Date.now() / 1000 + maxAge;
        }
      }
    }

    parsed.push(cookie);
  }

  return parsed;
}

/**
 * מחלץ bizToken מתגובת השרת (JSON או HTML עם JSON מוטמע)
 * @param {*} responseData - גוף התגובה (אובייקט או מחרוזת)
 * @returns {string|null}
 */
function extractBizTokenFromResponse(responseData) {
  if (!responseData) return null;
  try {
    if (typeof responseData === "object") {
      const token =
        responseData.bizToken ??
        responseData.data?.bizToken ??
        responseData.props?.bizToken ??
        responseData.props?.pageProps?.bizToken;
      if (typeof token === "string" && token.trim()) return token.trim();
      return null;
    }
    if (typeof responseData === "string") {
      const jsonMatch = responseData.match(/"bizToken"\s*:\s*"([^"]+)"/);
      if (jsonMatch) return jsonMatch[1];
      const singleMatch = responseData.match(/"bizToken"\s*:\s*'([^']+)'/);
      if (singleMatch) return singleMatch[1];
      const nextDataMatch = responseData.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (nextDataMatch) {
        const parsed = JSON.parse(nextDataMatch[1]);
        return extractBizTokenFromResponse(parsed);
      }
    }
  } catch (_) {}
  return null;
}

/**
 * מעדכן את קובץ הסשן
 * @param {Object} updates
 */
async function updateSession(updates) {
  const current = await getSession();
  const merged = { ...current, ...updates, timestamp: new Date().toISOString() };
  await fs.writeJson(GROW_SESSION_PATH, merged, { spaces: 2 });
}

/**
 * מבצע בקשת רענון ל-GROW dashboard
 * @returns {Promise<{ success: boolean, newCookies?: Array, isConnected: boolean }>}
 */
export async function refreshSession() {
  const session = await getSession();

  if (!isValidCookieStructure(session)) {
    await updateSession({
      isConnected: false,
      lastRefreshAt: new Date().toISOString(),
      lastRefreshStatus: "no_cookies",
    });
    return { success: false, isConnected: false };
  }

  const cookieHeader = session.cookieHeader || buildCookieHeader(session.cookies);
  if (!cookieHeader) {
    await updateSession({
      isConnected: false,
      lastRefreshAt: new Date().toISOString(),
      lastRefreshStatus: "empty_cookies",
    });
    return { success: false, isConnected: false };
  }

  try {
    const response = await axios.get(GROW_DASHBOARD_URL, {
      headers: {
        Cookie: cookieHeader,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "he-IL,he;q=0.9,en;q=0.8",
      },
      maxRedirects: 5,
      validateStatus: () => true,
      timeout: 15000,
    });

    const finalUrl =
      response.request?.res?.responseUrl ||
      response.request?.responseURL ||
      response.config?.url ||
      "";
    const isLoginRedirect =
      finalUrl.includes("/login") ||
      finalUrl.includes("auth") ||
      response.status === 401 ||
      response.status === 403;

    if (isLoginRedirect) {
      await updateSession({
        isConnected: false,
        lastRefreshAt: new Date().toISOString(),
        lastRefreshStatus: "session_expired",
      });
      logWarn("Grow session: session expired or redirected to login");
      return { success: false, isConnected: false };
    }

    const newCookies = parseSetCookieHeaders(response);
    let updatedCookies = session.cookies || [];
    let updatedHeader = cookieHeader;

    if (newCookies.length > 0) {
      const byName = new Map(updatedCookies.map((c) => [c.name, c]));
      for (const nc of newCookies) {
        byName.set(nc.name, { ...nc, domain: nc.domain || ".grow.website", path: nc.path || "/" });
      }
      updatedCookies = Array.from(byName.values());
      updatedHeader = buildCookieHeader(updatedCookies) || updatedHeader;
      logInfo(`Grow session: updated ${newCookies.length} cookie(s)`);
    }

    let updatedBizToken = session.bizToken || "";
    const bizTokenFromResponse = extractBizTokenFromResponse(response.data);
    if (bizTokenFromResponse) {
      updatedBizToken = bizTokenFromResponse;
      logInfo("Grow session: bizToken updated from server response");
    }

    const refreshTime = new Date().toISOString();
    await updateSession({
      cookieHeader: updatedHeader,
      cookies: updatedCookies,
      bizToken: updatedBizToken,
      isConnected: true,
      lastRefreshAt: refreshTime,
      lastRefreshStatus: "ok",
    });

    return {
      success: true,
      isConnected: true,
      lastRefreshAt: refreshTime,
      bizToken: updatedBizToken || undefined,
      newCookies: newCookies.length > 0 ? newCookies : undefined,
    };
  } catch (err) {
    logError("Grow session refresh failed", err);
    const refreshTime = new Date().toISOString();
    await updateSession({
      isConnected: false,
      lastRefreshAt: refreshTime,
      lastRefreshStatus: "error",
    });
    return { success: false, isConnected: false, lastRefreshAt: refreshTime };
  }
}

/**
 * שומר קוקיז חדשים (מבנה JSON כמו בתמונה)
 * @param {Object} payload - { cookieHeader?, cookies?, source? }
 */
export async function saveCookies(payload) {
  if (!payload) throw new Error("Payload required");

  const cookieHeader =
    payload.cookieHeader ||
    (Array.isArray(payload.cookies) ? buildCookieHeader(payload.cookies) : "");
  const cookies = Array.isArray(payload.cookies) ? payload.cookies : [];

  if (!cookieHeader && cookies.length === 0) {
    await updateSession({
      cookieHeader: "",
      cookies: [],
      bizToken: "",
      isConnected: false,
      lastRefreshAt: new Date().toISOString(),
      lastRefreshStatus: "cleared",
    });
    return;
  }

  const headerToUse = cookieHeader || buildCookieHeader(cookies);
  const bizToken = payload.hasOwnProperty("bizToken")
    ? (typeof payload.bizToken === "string" ? payload.bizToken.trim() : "")
    : undefined;
  const sessionUpdates = {
    cookieHeader: headerToUse,
    cookies,
    source: payload.source || "https://grow.website",
    isConnected: true,
    lastRefreshAt: null,
    lastRefreshStatus: null,
  };
  if (bizToken !== undefined) sessionUpdates.bizToken = bizToken;
  await updateSession(sessionUpdates);

  // ברגע שקיבלנו קוקיז תקניים = מחובר. אין צורך לבדוק – ה-scheduler ירוץ רענון כל 5 דקות.
}

/**
 * מנקה את הקוקיז השמורים מקומית בלבד – לא מבצע התנתקות אמיתית מ-grow.website.
 * מאפס את הסשן ל"נקי" ומאפשר התחברות חדשה.
 */
export async function clearCookies() {
  await updateSession({
    cookieHeader: "",
    cookies: [],
    bizToken: "",
    isConnected: false,
    lastRefreshAt: new Date().toISOString(),
    lastRefreshStatus: "disconnected",
  });
  logInfo("Grow session: cookies cleared");
}

/**
 * מחזיר סטטוס התחברות נוכחי
 */
export async function getConnectionStatus() {
  const session = await getSession();
  const hasValidCookies = isValidCookieStructure(session);
  return {
    isConnected: hasValidCookies && session.isConnected === true,
    lastRefreshAt: session.lastRefreshAt,
    lastRefreshStatus: session.lastRefreshStatus,
    hasCookies: hasValidCookies,
    bizToken: session.bizToken || "",
  };
}

/**
 * מפעיל את ה-scheduler לרענון כל 5 דקות
 */
export function startGrowSessionScheduler() {
  if (intervalId) return;
  intervalId = setInterval(() => {
    refreshSession().catch((e) => logError("Grow session scheduler tick", e));
  }, REFRESH_INTERVAL_MS);
  logInfo("Grow session scheduler started (every 5 minutes)");
}

/**
 * עוצר את ה-scheduler
 */
export function stopGrowSessionScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logInfo("Grow session scheduler stopped");
  }
}
