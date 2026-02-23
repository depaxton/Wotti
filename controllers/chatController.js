// Chat controller
// Handles API request logic for chat endpoints (messages, sending, media, etc.)

import { getClient, isClientReady } from "../services/whatsappClient.js";
import * as geminiConversationService from "../services/geminiConversationService.js";
import { logError, logInfo, logWarn } from "../utils/logger.js";
import { handleETag } from "../utils/etagHelper.js";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

/**
 * GET /api/chat/:chatId/messages
 * Returns messages from a chat with pagination support
 */
export const getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { limit = 250, before } = req.query; // before = message ID for loading older messages

    // Disable caching for pagination - always return fresh data
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    const client = getClient();
    if (!client) {
      return res.status(503).json({ error: "Client not initialized" });
    }

    const ready = await isClientReady();
    if (!ready) {
      return res.status(503).json({ error: "Client not ready" });
    }

    // Get the chat
    const chat = await client.getChatById(chatId);
    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    // Load messages
    let messages;
    if (before) {
      // Load older messages (before a specific message ID)
      // whatsapp-web.js requires a Message object for the 'before' parameter
      try {
        logInfo(`Attempting to load messages before: ${before}`);
        const beforeMessage = await client.getMessageById(before);

        if (beforeMessage) {
          logInfo(`Found before message with timestamp: ${beforeMessage.timestamp}`);
          // Fetch messages before this message
          messages = await chat.fetchMessages({ limit: parseInt(limit), before: beforeMessage });
          logInfo(`Fetched ${messages.length} messages using before parameter`);

          // Verify that messages are actually older (have smaller timestamp)
          if (messages.length > 0) {
            const oldestFetched = messages[messages.length - 1];
            const newestFetched = messages[0];
            logInfo(`Fetched messages range: ${oldestFetched.timestamp} to ${newestFetched.timestamp}, before message: ${beforeMessage.timestamp}`);

            // If fetched messages are not older than beforeMessage, something is wrong
            if (newestFetched.timestamp >= beforeMessage.timestamp) {
              logWarn(`Fetched messages are not older than before message! This might be a whatsapp-web.js issue.`);
              // Filter to only include messages that are actually older
              messages = messages.filter((msg) => msg.timestamp < beforeMessage.timestamp);
              logInfo(`Filtered to ${messages.length} messages that are actually older`);
            }
          }
        } else {
          // If message not found, return empty array instead of latest messages
          logWarn(`Message ${before} not found by getMessageById, returning empty array`);
          messages = [];
        }
      } catch (error) {
        logError("Error loading message for 'before' parameter", error);
        // Return empty array instead of latest messages
        messages = [];
      }
    } else {
      // Load latest messages
      messages = await chat.fetchMessages({ limit: parseInt(limit) });
    }

    // Process messages to JSON format
    const processedMessages = await Promise.all(
      messages.map(async (msg) => {
        const messageData = {
          id: msg.id._serialized,
          body: msg.body || "",
          from: msg.from,
          fromMe: msg.fromMe,
          timestamp: msg.timestamp,
          hasMedia: msg.hasMedia,
          type: msg.type,
          ack: msg.ack, // 0 = sent, 1 = delivered, 2 = read, 3 = played
          isForwarded: msg.isForwarded,
        };

        // If has media, add media info (but don't download full media here - use separate endpoint)
        if (msg.hasMedia) {
          try {
            const media = await msg.downloadMedia();
            messageData.media = {
              mimetype: media.mimetype,
              data: media.data, // base64
              filename: media.filename,
            };
          } catch (error) {
            logError("Error downloading media for message", error);
            messageData.media = null;
          }
        }

        return messageData;
      })
    );

    const responseData = {
      messages: processedMessages,
      hasMore: messages.length === parseInt(limit), // If there are more messages
    };

    // בדוק ETag רק עבור polling (ללא before parameter) - לא עבור טעינת הודעות ישנות
    // זה חוסך עיבוד כאשר אין הודעות חדשות
    if (!before) {
      if (handleETag(req, res, responseData)) {
        return; // 304 כבר נשלח
      }
    }

    res.json(responseData);
  } catch (error) {
    logError("Error fetching messages", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST /api/chat/send
 * Sends a message to a chat
 */
export const sendMessage = async (req, res) => {
  try {
    const { chatId, message, media } = req.body;

    if (!chatId || (!message && !media)) {
      return res.status(400).json({ error: "chatId and message or media are required" });
    }

    const client = getClient();
    if (!client) {
      return res.status(503).json({ error: "Client not initialized" });
    }

    const ready = await isClientReady();
    if (!ready) {
      return res.status(503).json({ error: "Client not ready" });
    }

    let sentMessage;
    if (media) {
      // Send media
      const { MessageMedia } = await import("whatsapp-web.js");
      const messageMedia = new MessageMedia(media.mimetype, media.data, media.filename);
      sentMessage = await client.sendMessage(chatId, messageMedia, { caption: message || "" });
    } else {
      // Send text
      sentMessage = await client.sendMessage(chatId, message);
    }

    const textSent = (message || "").trim();
    if (
      textSent &&
      geminiConversationService.getCurrentMode?.() === "auto" &&
      geminiConversationService.shouldExitByOperatorWords?.(textSent) &&
      geminiConversationService.isUserActive?.(chatId)
    ) {
      geminiConversationService.stopConversation(chatId, false);
      logInfo(`🚪 [Chat] Operator sent exit word – AI removed from active conversation ${chatId}`);
    }

    res.json({
      success: true,
      messageId: sentMessage.id._serialized,
      timestamp: sentMessage.timestamp,
    });
  } catch (error) {
    logError("Error sending message", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/chat/:messageId/media
 * Returns media for a specific message
 */
export const getMessageMedia = async (req, res) => {
  try {
    const { messageId } = req.params;

    const client = getClient();
    if (!client) {
      return res.status(503).json({ error: "Client not initialized" });
    }

    const ready = await isClientReady();
    if (!ready) {
      return res.status(503).json({ error: "Client not ready" });
    }

    const message = await client.getMessageById(messageId);
    if (!message || !message.hasMedia) {
      return res.status(404).json({ error: "Message or media not found" });
    }

    const media = await message.downloadMedia();

    res.json({
      mimetype: media.mimetype,
      data: media.data,
      filename: media.filename,
    });
  } catch (error) {
    logError("Error fetching message media", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * DELETE /api/chat/:messageId
 * Deletes a message (for everyone if possible)
 */
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { forEveryone = false } = req.query; // Delete for everyone or just for me

    const client = getClient();
    if (!client) {
      return res.status(503).json({ error: "Client not initialized" });
    }

    const ready = await isClientReady();
    if (!ready) {
      return res.status(503).json({ error: "Client not ready" });
    }

    const message = await client.getMessageById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Delete message
    await message.delete(forEveryone === "true");

    res.json({
      success: true,
      message: "Message deleted successfully",
    });
  } catch (error) {
    logError("Error deleting message", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/chat/:chatId/status
 * Returns chat status (online/offline, last seen, etc.)
 */
export const getChatStatus = async (req, res) => {
  try {
    const { chatId } = req.params;

    const client = getClient();
    if (!client) {
      return res.status(503).json({ error: "Client not initialized" });
    }

    const ready = await isClientReady();
    if (!ready) {
      return res.status(503).json({ error: "Client not ready" });
    }

    const chat = await client.getChatById(chatId);
    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    // Get contact info
    const contact = await chat.getContact();

    // Try to get presence (online status)
    let isOnline = false;
    let lastSeen = null;

    try {
      // For individual chats, try to get presence
      if (contact) {
        // Note: WhatsApp Web.js may not always provide presence info
        // This is a limitation of the library
        isOnline = contact.isOnline || false;
        lastSeen = contact.lastSeen ? new Date(contact.lastSeen * 1000).toISOString() : null;
      }
    } catch (error) {
      // Presence info might not be available
      logWarn("Could not get presence info: " + (error?.message || error));
    }

    res.json({
      isOnline: isOnline,
      lastSeen: lastSeen,
      isGroup: chat.isGroup,
      name: chat.name,
    });
  } catch (error) {
    logError("Error fetching chat status", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/chat/:chatId/search
 * Searches for messages in a chat
 */
export const searchMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { query, limit = 50 } = req.query;

    if (!query) {
      return res.status(400).json({ error: "Search query is required" });
    }

    const client = getClient();
    if (!client) {
      return res.status(503).json({ error: "Client not initialized" });
    }

    const ready = await isClientReady();
    if (!ready) {
      return res.status(503).json({ error: "Client not ready" });
    }

    const chat = await client.getChatById(chatId);
    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    // Search messages - WhatsApp Web.js doesn't have built-in search
    // So we'll fetch messages and filter them
    const messages = await chat.fetchMessages({ limit: parseInt(limit) * 2 }); // Fetch more to search through

    // Filter messages by query
    const searchQuery = query.toLowerCase();
    const matchingMessages = messages
      .filter((msg) => {
        if (msg.body && msg.body.toLowerCase().includes(searchQuery)) {
          return true;
        }
        return false;
      })
      .slice(0, parseInt(limit));

    // Process matching messages
    const processedMessages = await Promise.all(
      matchingMessages.map(async (msg) => {
        const messageData = {
          id: msg.id._serialized,
          body: msg.body || "",
          from: msg.from,
          fromMe: msg.fromMe,
          timestamp: msg.timestamp,
          hasMedia: msg.hasMedia,
          type: msg.type,
          ack: msg.ack,
          isForwarded: msg.isForwarded,
        };

        return messageData;
      })
    );

    res.json({
      messages: processedMessages,
      query: query,
      count: processedMessages.length,
    });
  } catch (error) {
    logError("Error searching messages", error);
    res.status(500).json({ error: error.message });
  }
};
