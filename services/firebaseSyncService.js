// Firebase background tasks: status checks and user upsert

import axios from "axios";
import { FIREBASE_CONFIG, FIREBASE_ENDPOINTS, getFirestoreAuthParams } from "../config/firebaseConfig.js";
import { logDebug, logError, logInfo, logWarn } from "../utils/logger.js";

let statusIntervalId = null;
let upsertIntervalId = null;
let lastKnownPhone = (FIREBASE_CONFIG.defaultPhone || "").trim() || null;

function buildUserFields({ phone, displayName, status, offerUntil, createdAt, updatedAt }) {
  const fields = {
    phone: phone ? { stringValue: phone } : undefined,
    displayName: displayName !== undefined ? { stringValue: displayName } : undefined,
    status: status !== undefined ? { stringValue: status } : undefined,
    updatedAt: updatedAt ? { timestampValue: updatedAt } : undefined,
  };

  if (offerUntil === null) {
    fields.offerUntil = { nullValue: null };
  } else if (offerUntil !== undefined) {
    fields.offerUntil = { stringValue: offerUntil };
  }

  if (createdAt) {
    fields.createdAt = { timestampValue: createdAt };
  }

  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

function parseFirestoreDocument(doc) {
  const fields = doc?.fields || {};

  const readString = (key) => fields[key]?.stringValue || null;
  const readTimestamp = (key) => fields[key]?.timestampValue || null;
  const readNullable = (key) =>
    Object.prototype.hasOwnProperty.call(fields[key] || {}, "nullValue")
      ? null
      : readString(key);

  return {
    phone: readString("phone"),
    displayName: readString("displayName"),
    status: readString("status"),
    offerUntil: readNullable("offerUntil"),
    createdAt: readTimestamp("createdAt"),
    updatedAt: readTimestamp("updatedAt"),
  };
}

function resolvePhone(phone) {
  const normalized = (phone || lastKnownPhone || "").trim();
  return normalized || null;
}

function setLastKnownPhone(phone) {
  const normalized = (phone || "").trim();
  if (normalized) {
    lastKnownPhone = normalized;
  }
}

function computeTrialExpiry() {
  const days = Number(FIREBASE_CONFIG.trialDays || 14);
  const ms = isNaN(days) ? 14 * 24 * 60 * 60 * 1000 : days * 24 * 60 * 60 * 1000;
  return new Date(Date.now() + ms).toISOString();
}

function normalizeStatus({ status, offerUntil }) {
  const now = Date.now();
  const expiryTs = offerUntil ? Date.parse(offerUntil) : null;
  const isTrialActive = !!expiryTs && expiryTs > now && status !== "paid";

  if (status === "paid") {
    return { status: "paid", isTrialActive, offerUntil };
  }

  if (isTrialActive) {
    return { status: "trial", isTrialActive: true, offerUntil };
  }

  return { status: "free", isTrialActive: false, offerUntil };
}

async function fetchUserDocument(phone) {
  const url = FIREBASE_ENDPOINTS.documentUrl(phone);
  const params = getFirestoreAuthParams();

  const response = await axios.get(url, {
    params,
    validateStatus: (status) => status === 200 || status === 404,
  });

  if (response.status === 404) {
    return null;
  }

  return response.data;
}

async function upsertUser({ phone, displayName } = {}) {
  const resolvedPhone = resolvePhone(phone);

  if (!resolvedPhone) {
    logWarn("Firebase | לא סופק מספר טלפון, לא ניתן לעדכן משתמש");
    return null;
  }

  setLastKnownPhone(resolvedPhone);

  const nowIso = new Date().toISOString();
  const trialUntil = computeTrialExpiry();

  try {
    const existingDoc = await fetchUserDocument(resolvedPhone);

    if (!existingDoc) {
      const createFields = buildUserFields({
        phone: resolvedPhone,
        displayName: displayName || resolvedPhone,
        status: "trial",
        offerUntil: trialUntil,
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      await axios.post(
        FIREBASE_ENDPOINTS.collectionUrl,
        { fields: createFields },
        { params: { ...getFirestoreAuthParams(), documentId: resolvedPhone } }
      );

      logInfo(`Firebase | נוצר משתמש חדש ${resolvedPhone} עם תקופת ניסיון עד ${trialUntil}`);
      return {
        phone: resolvedPhone,
        displayName: displayName || resolvedPhone,
        status: "trial",
        offerUntil: trialUntil,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    }

    const parsed = parseFirestoreDocument(existingDoc);
    const { status: normalizedStatus, offerUntil: parsedOfferUntil } = normalizeStatus(parsed);

    const statusToPersist = parsed.status === "paid" ? "paid" : normalizedStatus || "free";
    const offerUntil = parsedOfferUntil || (statusToPersist === "trial" ? trialUntil : null);

    const updateFields = buildUserFields({
      phone: resolvedPhone,
      displayName: displayName || parsed.displayName || resolvedPhone,
      status: statusToPersist,
      offerUntil,
      updatedAt: nowIso,
    });

    const updateMask = Object.keys(updateFields);

    if (updateMask.length > 0) {
      await axios.patch(
        FIREBASE_ENDPOINTS.documentUrl(resolvedPhone),
        { fields: updateFields },
        {
          params: {
            ...getFirestoreAuthParams(),
            "updateMask.fieldPaths": updateMask,
          },
        }
      );
    }

    logInfo(`Firebase | עודכן משתמש ${resolvedPhone} (סטטוס: ${statusToPersist})`);
    return {
      ...parsed,
      phone: resolvedPhone,
      status: statusToPersist,
      offerUntil,
      updatedAt: nowIso,
    };
  } catch (error) {
    logError("Firebase | שגיאה בעדכון/הוספת משתמש", error);
    return null;
  }
}

/**
 * Checks a user's status in Firestore.
 * @param {string} phone
 * @returns {Promise<Object|null>} Parsed + normalized user or null if missing
 */
export async function checkUserStatus(phone) {
  const resolvedPhone = resolvePhone(phone);

  if (!resolvedPhone) {
    logWarn("Firebase | אין מספר טלפון לבדיקה");
    return null;
  }

  try {
    const doc = await fetchUserDocument(resolvedPhone);

    if (!doc) {
      logWarn(`Firebase | המשתמש ${resolvedPhone} לא נמצא ב-Firestore`);
      return null;
    }

    const parsed = parseFirestoreDocument(doc);
    const { status: normalizedStatus, isTrialActive, offerUntil } = normalizeStatus(parsed);

    // Ensure Firestore reflects the normalized status/offerUntil if needed (non-paid only)
    if ((parsed.status || "free") !== normalizedStatus || (!parsed.offerUntil && normalizedStatus === "trial")) {
      const nowIso = new Date().toISOString();
      const updateFields = buildUserFields({
        status: normalizedStatus,
        offerUntil: offerUntil || computeTrialExpiry(),
        updatedAt: nowIso,
      });

      const updateMask = Object.keys(updateFields);

      if (updateMask.length > 0 && parsed.status !== "paid") {
        await axios.patch(
          FIREBASE_ENDPOINTS.documentUrl(resolvedPhone),
          { fields: updateFields },
          {
            params: {
              ...getFirestoreAuthParams(),
              "updateMask.fieldPaths": updateMask,
            },
          }
        );
      }
    }

    logInfo(`Firebase | סטטוס נוכחי עבור ${resolvedPhone}: ${normalizedStatus}`);
    logDebug(`Firebase | פרטי משתמש: ${JSON.stringify(parsed)}`);

    return {
      ...parsed,
      phone: resolvedPhone,
      status: normalizedStatus,
      isTrialActive,
      offerUntil,
    };
  } catch (error) {
    logError("Firebase | שגיאה בבדיקת סטטוס משתמש", error);
    return null;
  }
}

/**
 * Refreshes a user in Firestore (upsert) and returns the latest status.
 * @param {Object} payload
 * @param {string} payload.phone
 * @param {string} payload.displayName
 */
export async function refreshFirebaseUser({ phone, displayName } = {}) {
  const resolvedPhone = resolvePhone(phone);

  if (!resolvedPhone) {
    logWarn("Firebase | לא סופק מספר טלפון לרענון");
    return null;
  }

  setLastKnownPhone(resolvedPhone);
  await upsertUser({ phone: resolvedPhone, displayName });
  return await checkUserStatus(resolvedPhone);
}

/**
 * Starts background tasks for Firebase (status check + user upsert).
 */
export function startFirebaseTasks() {
  if (statusIntervalId || upsertIntervalId) {
    logWarn("Firebase | המשימות כבר פועלות");
    return;
  }

  const statusMinutes = FIREBASE_CONFIG.statusCheckIntervalMs / (60 * 1000);
  const upsertMinutes = FIREBASE_CONFIG.upsertIntervalMs / (60 * 1000);
  const initialPhone = resolvePhone(null);

  if (!initialPhone) {
    logWarn("Firebase | לא מוגדר מספר טלפון התחלתי, המשימות יחלו לאחר שהטלפון ייקלט מהלקוח");
  } else {
    logInfo(`Firebase | מספר הטלפון לזיהוי התחלתי: ${initialPhone}`);
  }

  logInfo(
    `Firebase | מפעיל משימות רקע (בדיקת סטטוס כל ${statusMinutes} דקות, סנכרון משתמש כל ${upsertMinutes} דקות)`
  );

  if (initialPhone) {
    checkUserStatus(initialPhone).catch((error) => logError("Firebase | כשל בבדיקת סטטוס ראשונית", error));
    upsertUser({ phone: initialPhone }).catch((error) => logError("Firebase | כשל בסנכרון ראשוני של משתמש", error));
  }

  statusIntervalId = setInterval(() => {
    const phone = resolvePhone(null);
    if (!phone) {
      logWarn("Firebase | דילוג על בדיקת סטטוס - אין מספר טלפון ידוע");
      return;
    }
    checkUserStatus(phone).catch((error) => logError("Firebase | כשל בבדיקת סטטוס מתוזמנת", error));
  }, FIREBASE_CONFIG.statusCheckIntervalMs);

  upsertIntervalId = setInterval(() => {
    const phone = resolvePhone(null);
    if (!phone) {
      logWarn("Firebase | דילוג על סנכרון משתמש - אין מספר טלפון ידוע");
      return;
    }
    upsertUser({ phone }).catch((error) => logError("Firebase | כשל בסנכרון משתמש מתוזמן", error));
  }, FIREBASE_CONFIG.upsertIntervalMs);
}

/**
 * Stops background Firebase tasks.
 */
export function stopFirebaseTasks() {
  if (statusIntervalId) {
    clearInterval(statusIntervalId);
    statusIntervalId = null;
  }

  if (upsertIntervalId) {
    clearInterval(upsertIntervalId);
    upsertIntervalId = null;
  }

  logInfo("Firebase | המשימות הופסקו");
}

