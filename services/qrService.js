// QR Code Service
// Handles QR code fetching and display state management

import { updateQRCode, updateQRCodeFromImage, showQRCodeLoading, showQRCodeAuthenticated, showQRCodeError } from "../components/qr/QRCodeDisplay.js";
import { fetchWithETagSmart } from "../utils/etagCache.js";

let pollingInterval = null;
let isPolling = false;
let currentApiUrl = null;

/**
 * Starts polling for QR code updates from the backend
 * @param {string} apiUrl - Base API URL (default: http://localhost:5000)
 */
export function startQRCodePolling(apiUrl = "http://localhost:5000") {
  // Store API URL for potential restart
  currentApiUrl = apiUrl;

  if (isPolling) {
    return;
  }

  isPolling = true;
  showQRCodeLoading();

  // Poll immediately
  fetchQRCode(apiUrl);

  // Then poll every 2 seconds
  pollingInterval = setInterval(() => {
    fetchQRCode(apiUrl);
  }, 2000);

  console.log("Started QR code polling");
}

/**
 * Stops polling for QR code updates
 */
export function stopQRCodePolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  isPolling = false;
  console.log("Stopped QR code polling");
}

/**
 * Fetches QR code from the backend API
 * @param {string} apiUrl - Base API URL
 */
async function fetchQRCode(apiUrl) {
  try {
    // השתמש ב-ETag כדי לחסוך עיבוד אם ה-QR code לא השתנה
    const result = await fetchWithETagSmart(`${apiUrl}/api/qr`);

    // אם הנתונים לא השתנו (304), אין צורך לעדכן את ה-UI
    if (!result.changed) {
      return;
    }

    if (!result.data) {
      throw new Error(`HTTP error! status: ${result.status}`);
    }

    const data = result.data;

    if (data.qr) {
      // New QR code received
      console.log("QR code received from API, updating display...");
      console.log("QR code data preview:", data.qr.substring(0, 100) + "...");
      // Use QR image if available, otherwise use QR data
      if (data.qrImage) {
        await updateQRCodeFromImage(data.qrImage);
      } else {
        await updateQRCode(data.qr);
      }
    } else if (data.status === "authenticated" || data.status === "ready") {
      // Client is authenticated/ready
      stopQRCodePolling();
      showQRCodeAuthenticated();
    } else if (data.status === "error") {
      // Error occurred
      stopQRCodePolling();
      showQRCodeError(data.message || "An error occurred");
    } else if (data.status === "loading") {
      // Still loading - restart polling if it was stopped
      showQRCodeLoading();
      if (!isPolling && currentApiUrl) {
        console.log("Status is loading but polling stopped. Restarting polling...");
        startQRCodePolling(currentApiUrl);
      }
    } else {
      // No QR code yet, keep loading state
      console.log("Waiting for QR code... Status:", data.status);
      // Restart polling if it was stopped and we're waiting for QR
      if (!isPolling && currentApiUrl) {
        console.log("Waiting for QR code but polling stopped. Restarting polling...");
        startQRCodePolling(currentApiUrl);
      }
    }
  } catch (error) {
    // Show error in console for debugging
    if (isPolling) {
      console.error("Error fetching QR code:", error.message);
      // Show user-friendly error message after a few failed attempts
      const status = document.getElementById("qrCodeStatus");
      if (status && !status.textContent) {
        status.textContent = "Connecting to server... Make sure the backend is running on port 5000";
        status.className = "qr-code-status";
      }
    }
  }
}

/**
 * Checks if currently polling for QR code
 * @returns {boolean} True if polling is active
 */
export function isPollingActive() {
  return isPolling;
}
