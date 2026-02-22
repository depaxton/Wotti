// Marketing Unsubscribe Handler
// When a user sends a message containing "הסרה", add them to the "never send" list with their name.

import { registerIncomingMessageHandler } from "./whatsappClient.js";
import { addToNeverSend } from "./marketingDistributionService.js";
import { logInfo } from "../utils/logger.js";

const REMOVAL_WORD = "הסרה";

/**
 * Extract phone digits from WhatsApp message.from (e.g. "972501234567@c.us" -> "972501234567")
 */
function phoneFromMessageFrom(from) {
  if (!from || typeof from !== "string") return null;
  const base = from.split("@")[0] || "";
  return base.replace(/\D/g, "").trim() || null;
}

/**
 * Get display name from message: contact pushname (כינוי) or name, or empty.
 */
async function getSenderName(message) {
  try {
    if (typeof message.getContact === "function") {
      const contact = await message.getContact();
      if (contact) {
        const name = (contact.pushname || contact.name || contact.shortName || "").trim();
        if (name) return name;
      }
    }
  } catch (e) {
    // ignore
  }
  return "";
}

export function initMarketingUnsubscribeHandler() {
  registerIncomingMessageHandler(async (message) => {
    if (message.fromMe) return;
    const body = (message.body || "").trim();
    if (!body.includes(REMOVAL_WORD)) return;

    const phone = phoneFromMessageFrom(message.from);
    if (!phone) return;

    const name = await getSenderName(message);
    await addToNeverSend(phone, name);
    logInfo(`Marketing: user requested removal (הסרה), added ${phone} (${name || "—"}) to never-send list`);
  });
}
