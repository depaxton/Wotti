// State service
// Manages client state and handles state updates from WhatsApp client events

import { onQRCodeUpdate, getClient } from "./whatsappClient.js";
import { loadRecentChats, extractContacts } from "./chatsService.js";
import { logInfo, logError } from "../utils/logger.js";

let clientState = {
  status: "loading", // loading, qr, authenticated, ready, error
  qr: null,
  message: null,
};

/**
 * Updates the client state based on events
 * @param {string|null} qr - QR code string or null
 * @param {string|null} event - Event name (authenticated, ready, auth_failure, error, disconnected)
 * @param {string|null} data - Additional data for the event
 */
const updateState = (qr, event, data) => {
  if (qr) {
    clientState.status = "qr";
    clientState.qr = qr;
    clientState.message = null;
  } else if (event === "authenticated") {
    clientState.status = "authenticated";
    clientState.qr = null;
    clientState.message = "Authenticated successfully";
  } else if (event === "ready") {
    clientState.status = "ready";
    clientState.qr = null;
    clientState.message = "Client is ready";

    // Fetch and log contacts when ready
    const client = getClient();
    if (client) {
      loadRecentChats(client, 200)
        .then((chats) => {
          const contacts = extractContacts(chats);
          logInfo(`Loaded ${contacts.length} contacts`);
        })
        .catch((err) => {
          logError("Error loading contacts", err);
        });
    }
  } else if (event === "auth_failure") {
    // Change status to qr (not error) to trigger QR code generation
    // Session was cleared, so we need a new QR code
    clientState.status = "qr";
    clientState.qr = null;
    clientState.message = `Authentication failed: ${data}. Please scan QR code again.`;
  } else if (event === "error") {
    clientState.status = "error";
    clientState.qr = null;
    clientState.message = data || "An error occurred";
  } else if (event === "disconnected") {
    // Set status to qr (not loading) to trigger QR code generation
    // The client will automatically reinitialize and generate a new QR
    clientState.status = "qr";
    clientState.qr = null;
    clientState.message = `Disconnected: ${data}. Please scan QR code to reconnect.`;
  }
};

/**
 * Initializes the state listener
 * Registers the callback for QR code updates
 */
export function initStateListener() {
  onQRCodeUpdate(updateState);
}

/**
 * Gets the current client state
 * @returns {Object} Current client state (status, qr, message)
 */
export function getClientState() {
  return { ...clientState };
}
