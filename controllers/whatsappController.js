// WhatsApp controller
// Handles API request logic for WhatsApp endpoints

import QRCode from "qrcode";
import { getClientState } from "../services/stateService.js";
import { getClient, isClientReady, getCurrentQRCode, getUserInfo, logout, initializeClient, checkAndResetNewMessage } from "../services/whatsappClient.js";
import { logError, logInfo } from "../utils/logger.js";
import { loadUsers, saveUsers, getAllUsers } from "../services/userService.js";

/**
 * GET /api/qr
 * Returns QR code and status information
 */
export const getQr = async (req, res) => {
  const qr = getCurrentQRCode();
  const state = getClientState();

  if (qr) {
    try {
      // Generate QR code as data URL image
      const qrImageDataUrl = await QRCode.toDataURL(qr, {
        width: 280,
        margin: 2,
        color: {
          dark: "#1a1a1a",
          light: "#ffffff",
        },
      });

      res.json({
        status: "qr",
        qr: qr,
        qrImage: qrImageDataUrl,
      });
    } catch (error) {
      logError("Error generating QR code image", error);
      res.json({
        status: "qr",
        qr: qr,
        qrImage: null,
      });
    }
  } else {
    res.json({
      status: state.status,
      qr: null,
      qrImage: null,
      message: state.message,
    });
  }
};

/**
 * GET /api/status
 * Returns client status and readiness
 */
export const getStatus = async (req, res) => {
  try {
    const ready = await isClientReady();
    const state = getClientState();
    res.json({
      status: ready ? "ready" : state.status,
      ready: ready,
    });
  } catch (error) {
    res.json({
      status: "error",
      ready: false,
      message: error.message,
    });
  }
};

/**
 * GET /api/contacts
 * Returns list of contacts with detailed information
 */
export const getContacts = async (req, res) => {
  try {
    const client = getClient();

    if (!client) {
      return res.status(503).json({ error: "Client not initialized" });
    }

    const ready = await isClientReady();
    if (!ready) {
      return res.status(503).json({ error: "Client not ready" });
    }

    // Load existing users from JSON file
    const storedUsers = await loadUsers();

    // Get all chats
    const chats = await client.getChats();

    // Sync chats with JSON file - append new users (append-only behavior)
    // Collect all new users first, then save once for efficiency
    const newUsers = {};
    for (const chat of chats) {
      const phoneNumber = chat.id?.user;
      
      // Only process chats with valid phone numbers
      if (phoneNumber && !storedUsers[phoneNumber]) {
        // User doesn't exist in JSON, prepare to append them
        const name = chat.name || phoneNumber || "Unknown";
        newUsers[phoneNumber] = {
          name: name,
          phone: phoneNumber
        };
      }
    }

    // Save all new users at once if any were found
    if (Object.keys(newUsers).length > 0) {
      const updatedUsers = { ...storedUsers, ...newUsers };
      await saveUsers(updatedUsers);
      logInfo(`Appended ${Object.keys(newUsers).length} new user(s) to JSON file`);
    }

    // Use updated users (with new ones added) or original stored users
    const updatedUsers = Object.keys(newUsers).length > 0 
      ? { ...storedUsers, ...newUsers }
      : storedUsers;

    // Process chats to include full contact information
    // IMPORTANT: Order follows the exact order returned by getChats()
    const contacts = await Promise.all(
      chats.slice(0, 200).map(async (chat) => {
        const lastMessage = chat.lastMessage;
        const lastMessageTime = lastMessage ? new Date(lastMessage.timestamp * 1000) : null;

        // Get preview text from last message
        let preview = "";
        if (lastMessage) {
          if (lastMessage.body) {
            preview = lastMessage.body.length > 50 ? lastMessage.body.substring(0, 50) + "..." : lastMessage.body;
          } else if (lastMessage.hasMedia) {
            preview = "📎 Media";
          } else {
            preview = "Message";
          }
        }

        // Format time
        let timeStr = "";
        let dateStr = "";
        if (lastMessageTime) {
          const now = new Date();
          const diffMs = now - lastMessageTime;
          const diffMins = Math.floor(diffMs / 60000);
          const diffHours = Math.floor(diffMs / 3600000);
          const diffDays = Math.floor(diffMs / 86400000);

          // Format time (short format)
          if (diffMins < 1) {
            timeStr = "Just now";
          } else if (diffMins < 60) {
            timeStr = `${diffMins}m ago`;
          } else if (diffHours < 24) {
            timeStr = `${diffHours}h ago`;
          } else if (diffDays === 1) {
            timeStr = "Yesterday";
          } else if (diffDays < 7) {
            timeStr = `${diffDays}d ago`;
          } else {
            timeStr = lastMessageTime.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          }

          // Format date (full date format)
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const messageDate = new Date(lastMessageTime);
          messageDate.setHours(0, 0, 0, 0);

          if (messageDate.getTime() === today.getTime()) {
            // Today - show time
            dateStr = lastMessageTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
          } else if (diffDays === 1) {
            // Yesterday
            dateStr = "Yesterday";
          } else if (diffDays < 7) {
            // Within this week
            dateStr = lastMessageTime.toLocaleDateString("en-US", { weekday: "short" });
          } else if (messageDate.getFullYear() === today.getFullYear()) {
            // This year - show month and day
            dateStr = lastMessageTime.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          } else {
            // Older - show full date
            dateStr = lastMessageTime.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
          }
        }

        // Retrieve user data from JSON file using phone number as identifier
        const phoneNumber = chat.id?.user;
        const userData = phoneNumber ? updatedUsers[phoneNumber] : null;
        
        // Use name from JSON file if available, otherwise fall back to chat.name or phone number
        const name = userData ? userData.name : (chat.name || phoneNumber || "Unknown");
        const phone = userData ? userData.phone : (phoneNumber || "");

        return {
          id: chat.id._serialized,
          name: name,
          phone: phone,
          preview: preview || "No messages",
          time: timeStr || "",
          date: dateStr || "",
          timestamp: lastMessageTime ? lastMessageTime.getTime() : 0, // Keep timestamp for potential future use
          unread: chat.unreadCount || 0,
          avatar: "👤", // Default icon character
        };
      })
    );

    // Filter out contacts without messages
    const contactsWithMessages = contacts.filter((c) => c.preview && c.preview !== "No messages");

    // IMPORTANT: Do NOT sort - maintain the exact order from getChats()
    // The order displayed on the website must follow getChats() order, not JSON file order

    res.json({ contacts: contactsWithMessages });
  } catch (error) {
    logError("Error fetching contacts", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/contacts/json
 * Returns list of contacts from users.json file (no authentication required)
 */
export const getContactsFromJSON = async (req, res) => {
  try {
    const users = await getAllUsers();

    // Convert users object to contacts array format
    const contacts = Object.values(users).map((user) => ({
      id: `json_${user.phone}`,
      name: user.name || user.phone || "Unknown",
      phone: user.phone || "",
      preview: "", // No preview from JSON
      time: "",
      date: "",
      timestamp: 0,
      unread: 0,
      avatar: "👤",
    }));

    res.json({ contacts: contacts });
  } catch (error) {
    logError("Error fetching contacts from JSON", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/user/info
 * Returns logged-in user's information
 */
export const getUserInfoController = async (req, res) => {
  try {
    const userInfo = await getUserInfo();
    
    if (!userInfo) {
      return res.status(503).json({ 
        error: "Client not ready or user info not available" 
      });
    }

    res.json(userInfo);
  } catch (error) {
    logError("Error fetching user info", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/messages/new
 * Checks if there's a new incoming message
 * Returns true if a new message was received since last check
 */
export const checkNewMessage = async (req, res) => {
  try {
    const hasNew = checkAndResetNewMessage();
    res.json({ hasNewMessage: hasNew });
  } catch (error) {
    logError("Error checking for new messages", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST /api/logout
 * Logs out the WhatsApp client by destroying it and clearing authentication session
 * Then reinitializes the client to generate a new QR code
 */
export const logoutController = async (req, res) => {
  try {
    logInfo("Logout request received");
    await logout();
    
    // Reinitialize the client after logout to generate new QR code
    logInfo("Reinitializing client after logout...");
    setTimeout(async () => {
      try {
        await initializeClient(true);
        logInfo("Client reinitialized successfully after logout");
      } catch (error) {
        logError("Error reinitializing client after logout", error);
      }
    }, 2000); // Wait 2 seconds before reinitializing to ensure cleanup is complete
    
    res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    logError("Error during logout", error);
    res.status(500).json({ error: error.message });
  }
};

