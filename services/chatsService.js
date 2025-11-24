// Chats service
// Handles loading and processing of WhatsApp chats

import { logInfo, logError } from '../utils/logger.js';

/**
 * Loads recent chats from the WhatsApp client
 * @param {Client} client - WhatsApp client instance
 * @param {number} limit - Maximum number of chats to load (default: 200)
 * @returns {Promise<Array>} Array of chat objects with id, name, lastMessageTime
 */
export async function loadRecentChats(client, limit = 200) {
  if (!client) {
    throw new Error('Client instance is required');
  }

  try {
    logInfo(`Loading recent chats (limit: ${limit})...`);

    // Get all chats
    const chats = await client.getChats();

    // Process and filter chats
    const processedChats = chats
      .slice(0, limit)
      .map((chat) => {
        // Get last message timestamp
        const lastMessageTime = chat.lastMessage
          ? new Date(chat.lastMessage.timestamp * 1000).toISOString()
          : null;

        // Return minimal chat object
        return {
          id: chat.id._serialized,
          name: chat.name || chat.id.user || 'Unknown',
          lastMessageTime,
        };
      })
      .filter((chat) => chat.lastMessageTime !== null); // Only include chats with messages

    // Sort by last message timestamp (most recent first)
    processedChats.sort((a, b) => {
      if (!a.lastMessageTime) return 1;
      if (!b.lastMessageTime) return -1;
      return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
    });

    logInfo(`Loaded ${processedChats.length} recent chats`);
    return processedChats;
  } catch (error) {
    logError('Failed to load recent chats', error);
    throw error;
  }
}

/**
 * Extracts contacts from the chat list
 * Returns only name and id for each contact
 * @param {Array} chats - Array of chat objects
 * @returns {Array} Array of contact objects with id and name only
 */
export function extractContacts(chats) {
  if (!Array.isArray(chats)) {
    throw new Error('Chats must be an array');
  }

  try {
    logInfo(`Extracting contacts from ${chats.length} chats...`);

    const contacts = chats.map((chat) => ({
      id: chat.id,
      name: chat.name,
    }));

    logInfo(`Extracted ${contacts.length} contacts`);
    return contacts;
  } catch (error) {
    logError('Failed to extract contacts', error);
    throw error;
  }
}

