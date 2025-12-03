/**
 * Google Analytics 4 (GA4) Tracking Utility
 * מספק פונקציות למעקב אירועים ותנועות במערכת
 */

import { GA4_CONFIG } from "../config/constants.js";
import { logInfo, logError } from "./logger.js";

// Store current user information globally
let currentUserId = null;
let currentUserPhone = null;
let currentUserName = null;

/**
 * Initializes Google Analytics 4
 * מאתחל את Google Analytics 4
 */
export function initAnalytics() {
  if (typeof gtag === "undefined") {
    logError("Google Analytics gtag is not loaded");
    return false;
  }

  logInfo(`Google Analytics initialized with Measurement ID: ${GA4_CONFIG.MEASUREMENT_ID}`);
  return true;
}

/**
 * Sets user information for Analytics tracking
 * מגדיר פרטי משתמש למעקב Analytics
 * 
 * @param {string} userId - ID המשתמש (WhatsApp ID)
 * @param {string} phoneNumber - מספר הטלפון של המשתמש
 * @param {string} userName - שם המשתמש (אופציונלי)
 */
export function setUserInfo(userId, phoneNumber, userName = null) {
  currentUserId = userId;
  currentUserPhone = phoneNumber;
  currentUserName = userName;

  if (typeof gtag === "undefined") {
    console.warn("Google Analytics gtag is not available");
    return;
  }

  try {
    // Set user ID globally for all future events
    gtag("config", GA4_CONFIG.MEASUREMENT_ID, {
      user_id: userId
    });

    // Also send user_properties to set custom properties (phone and name)
    gtag("set", "user_properties", {
      user_phone: phoneNumber,
      user_name: userName || phoneNumber
    });

    logInfo(`GA4 User info set - ID: ${userId}, Phone: ${phoneNumber}`);
  } catch (error) {
    logError("Error setting GA4 user info:", error);
  }
}

/**
 * Gets current user information
 * מקבל את פרטי המשתמש הנוכחי
 * 
 * @returns {Object} Object with userId, phoneNumber, userName
 */
export function getCurrentUserInfo() {
  return {
    userId: currentUserId,
    phoneNumber: currentUserPhone,
    userName: currentUserName
  };
}

/**
 * Clears user information (for logout/disconnect)
 * מנקה את פרטי המשתמש (להתנתקות/נתק)
 */
export function clearUserInfo() {
  currentUserId = null;
  currentUserPhone = null;
  currentUserName = null;

  if (typeof gtag === "undefined") {
    return;
  }

  try {
    // Reset user ID to null
    gtag("config", GA4_CONFIG.MEASUREMENT_ID, {
      user_id: null
    });

    logInfo("GA4 User info cleared");
  } catch (error) {
    logError("Error clearing GA4 user info:", error);
  }
}

/**
 * Tracks a custom event in Google Analytics
 * עוקב אחר אירוע מותאם אישית ב-Google Analytics
 * 
 * @param {string} eventName - שם האירוע
 * @param {Object} eventParams - פרמטרים נוספים לאירוע (אופציונלי)
 */
export function trackEvent(eventName, eventParams = {}) {
  if (typeof gtag === "undefined") {
    console.warn("Google Analytics gtag is not available");
    return;
  }

  try {
    // Always include user_id if available - this is a required constant for user identification
    // תמיד לכלול user_id אם זמין - זה משתנה קבוע נדרש לזיהוי משתמש
    const enrichedParams = {
      ...eventParams
    };

    // Add user_id as a constant parameter if user is logged in
    // הוסף user_id כפרמטר קבוע אם המשתמש מחובר
    if (currentUserId) {
      enrichedParams.user_id = currentUserId;
    }

    // Add additional user info if available (optional)
    // הוסף פרטי משתמש נוספים אם זמינים (אופציונלי)
    if (currentUserPhone) {
      enrichedParams.user_phone = currentUserPhone;
    }
    if (currentUserName) {
      enrichedParams.user_name = currentUserName;
    }

    gtag("event", eventName, enrichedParams);
    const paramsStr = enrichedParams && Object.keys(enrichedParams).length > 0 ? ` - ${JSON.stringify(enrichedParams)}` : "";
    logInfo(`GA4 Event tracked: ${eventName}${paramsStr}`);
  } catch (error) {
    logError("Error tracking GA4 event:", error);
  }
}

/**
 * Tracks page view
 * עוקב אחר צפייה בדף
 * 
 * @param {string} pagePath - נתיב הדף
 * @param {string} pageTitle - כותרת הדף (אופציונלי)
 */
export function trackPageView(pagePath, pageTitle = null) {
  if (typeof gtag === "undefined") {
    console.warn("Google Analytics gtag is not available");
    return;
  }

  try {
    const params = {
      page_path: pagePath,
    };

    if (pageTitle) {
      params.page_title = pageTitle;
    }

    // Always include user_id if user is logged in
    // תמיד לכלול user_id אם המשתמש מחובר
    if (currentUserId) {
      params.user_id = currentUserId;
    }

    gtag("config", GA4_CONFIG.MEASUREMENT_ID, params);
    logInfo(`GA4 Page view tracked: ${pagePath}`);
  } catch (error) {
    logError("Error tracking GA4 page view:", error);
  }
}

/**
 * Tracks user engagement events
 * עוקב אחר אירועי מעורבות משתמש
 */

// Contact selection
export function trackContactSelected(contactId, contactName) {
  trackEvent("contact_selected", {
    contact_id: contactId,
    contact_name: contactName,
  });
}

// Contact refresh
export function trackContactsRefreshed(contactsCount) {
  trackEvent("contacts_refreshed", {
    contacts_count: contactsCount,
  });
}

// Message sent
export function trackMessageSent(contactId, messageType = "text") {
  trackEvent("message_sent", {
    contact_id: contactId,
    message_type: messageType,
  });
}

// Reminder created
export function trackReminderCreated(reminderType) {
  trackEvent("reminder_created", {
    reminder_type: reminderType,
  });
}

// QR code scanned (WhatsApp authentication)
export function trackQRCodeScanned() {
  trackEvent("qr_code_scanned", {
    event_category: "authentication",
  });
}

// Settings changed
export function trackSettingsChanged(settingName, settingValue) {
  trackEvent("settings_changed", {
    setting_name: settingName,
    setting_value: settingValue,
  });
}

// App started
export function trackAppStarted() {
  trackEvent("app_started", {
    app_name: "Wotti",
    app_version: window.appVersion || "unknown",
  });
}

// Error occurred
export function trackError(errorMessage, errorType = "unknown") {
  trackEvent("error_occurred", {
    error_message: errorMessage,
    error_type: errorType,
  });
}

