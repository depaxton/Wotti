/**
 * Gemini AI Controller
 *
 * Handles HTTP requests related to Gemini AI functionality
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as geminiService from '../services/geminiService.js';
import * as geminiConversationService from '../services/geminiConversationService.js';
import { isConfigured, getApiKey, setApiKeyAndSave, deleteApiKey } from '../config/geminiConfig.js';
import { logError } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUTO_MESSAGES_FILE = path.join(__dirname, '../utils/ai_auto_messages.json');

function loadAutoMessagesData() {
  try {
    if (fs.existsSync(AUTO_MESSAGES_FILE)) {
      const data = fs.readFileSync(AUTO_MESSAGES_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    logError('❌ Error loading auto messages:', err);
  }
  return { messages: [], updatedAt: null };
}

function saveAutoMessagesData(data) {
  try {
    data.updatedAt = new Date().toISOString();
    fs.writeFileSync(AUTO_MESSAGES_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    logError('❌ Error saving auto messages:', err);
    return false;
  }
}

/**
 * Generate text from a prompt
 * POST /api/gemini/generate
 */
export async function generateText(req, res) {
  try {
    const { prompt, temperature, maxTokens, userId } = req.body;

    if (!prompt) {
      return res.status(400).json({ 
        success: false, 
        error: 'Prompt is required' 
      });
    }

    const context = userId ? { userId } : {};
    const result = await geminiService.generateText(prompt, { temperature, maxTokens, context });

    if (result.success) {
      return res.json({
        success: true,
        text: result.text,
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    logError('❌ Error in generateText controller:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

/**
 * Generate text with conversation history
 * POST /api/gemini/chat
 */
export async function chat(req, res) {
  try {
    const { history, prompt, temperature, maxTokens, userId } = req.body;

    if (!prompt) {
      return res.status(400).json({ 
        success: false, 
        error: 'Prompt is required' 
      });
    }

    const context = userId ? { userId } : {};
    const result = await geminiService.generateWithHistory(
      history || [], 
      prompt, 
      { temperature, maxTokens, context }
    );

    if (result.success) {
      return res.json({
        success: true,
        text: result.text,
        history: result.history,
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    logError('❌ Error in chat controller:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

/**
 * Get saved API key (for display in AI settings - exposed).
 * GET /api/gemini/api-key
 */
export async function getApiKeyEndpoint(req, res) {
  try {
    const key = getApiKey();
    return res.json({
      success: true,
      apiKey: key || '',
      configured: !!key,
    });
  } catch (error) {
    logError('❌ Error in getApiKey controller:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

/**
 * Save API key from AI settings (writes to config file and reinitializes service).
 * POST /api/gemini/api-key
 * Body: { apiKey: string }
 */
export async function saveApiKey(req, res) {
  try {
    const { apiKey } = req.body || {};
    const result = setApiKeyAndSave(apiKey);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }
    geminiService.reinitialize();
    return res.json({ success: true });
  } catch (error) {
    logError('❌ Error in saveApiKey controller:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

/**
 * Delete API key from config file.
 * DELETE /api/gemini/api-key
 */
export async function removeApiKey(req, res) {
  try {
    const result = deleteApiKey();
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }
    geminiService.reinitialize();
    return res.json({ success: true });
  } catch (error) {
    logError('❌ Error in removeApiKey controller:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

/**
 * Get status and configuration info
 * GET /api/gemini/status
 */
export async function getStatus(req, res) {
  try {
    const configured = isConfigured();
    const initialized = geminiService.isInitialized();

    return res.json({
      success: true,
      configured,
      initialized,
      message: configured 
        ? (initialized ? 'Gemini AI is ready' : 'Gemini AI not initialized')
        : 'Please configure GEMINI_API_KEY',
    });
  } catch (error) {
    logError('❌ Error in getStatus controller:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

/**
 * Get available models
 * GET /api/gemini/models
 */
export async function getModels(req, res) {
  try {
    const result = await geminiService.getAvailableModels();

    if (result.success) {
      return res.json({
        success: true,
        models: result.models,
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    logError('❌ Error in getModels controller:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

/**
 * Start a new GEMINI conversation with a user
 * POST /api/gemini/start-conversation
 */
export async function startConversation(req, res) {
  try {
    const { userId, userName, userNumber } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
      });
    }

    const result = await geminiConversationService.startConversation(
      userId,
      userName,
      userNumber
    );

    if (result.success) {
      return res.json({
        success: true,
        message: result.message,
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    logError('❌ Error in startConversation controller:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

/**
 * Stop a GEMINI conversation with a user
 * POST /api/gemini/stop-conversation
 */
export async function stopConversation(req, res) {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
      });
    }

    const stopped = geminiConversationService.stopConversation(userId, true);

    return res.json({
      success: stopped,
      message: stopped ? 'Conversation stopped and user marked as finished' : 'Conversation not found',
    });
  } catch (error) {
    logError('❌ Error in stopConversation controller:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

/**
 * Get active GEMINI conversations
 * GET /api/gemini/active-conversations
 */
export async function getActiveConversations(req, res) {
  try {
    const activeUsers = geminiConversationService.getActiveUsers();

    return res.json({
      success: true,
      activeUsers,
    });
  } catch (error) {
    logError('❌ Error in getActiveConversations controller:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

/**
 * Save Gemini instructions
 * POST /api/gemini/instructions
 */
export async function saveInstructions(req, res) {
  try {
    const { instructions } = req.body;

    if (instructions === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Instructions are required',
      });
    }

    const result = await geminiService.saveInstructions(instructions);

    if (result.success) {
      return res.json({
        success: true,
        message: 'Instructions saved successfully',
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    logError('❌ Error in saveInstructions controller:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

/**
 * Get Gemini instructions
 * GET /api/gemini/instructions
 */
export async function getInstructions(req, res) {
  try {
    const result = await geminiService.getInstructions();

    if (result.success) {
      return res.json({
        success: true,
        instructions: result.instructions || '',
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    logError('❌ Error in getInstructions controller:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

/**
 * Get mode (manual/auto)
 * GET /api/gemini/mode
 */
export async function getMode(req, res) {
  try {
    const settings = geminiConversationService.getGeminiSettings();
    return res.json({
      success: true,
      mode: settings.mode || 'manual',
      settings,
    });
  } catch (error) {
    logError('❌ Error in getMode controller:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

/**
 * Set manual mode
 * POST /api/gemini/mode/manual
 */
export async function setManualMode(req, res) {
  try {
    const result = geminiConversationService.setManualMode();
    return res.json(result);
  } catch (error) {
    logError('❌ Error in setManualMode controller:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

/**
 * Set auto mode
 * POST /api/gemini/mode/auto
 */
export async function setAutoMode(req, res) {
  try {
    const result = await geminiConversationService.setAutoMode();
    return res.json(result);
  } catch (error) {
    logError('❌ Error in setAutoMode controller:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

/**
 * Refresh auto mode
 * POST /api/gemini/mode/refresh
 */
export async function refreshAutoMode(req, res) {
  try {
    const result = await geminiConversationService.refreshAutoMode();
    return res.json(result);
  } catch (error) {
    logError('❌ Error in refreshAutoMode controller:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

/**
 * Get finished users
 * GET /api/gemini/finished-users
 */
export async function getFinishedUsers(req, res) {
  try {
    const finishedUsers = geminiConversationService.getFinishedUsers();
    return res.json({
      success: true,
      finishedUsers,
    });
  } catch (error) {
    logError('❌ Error in getFinishedUsers controller:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

/**
 * Delete finished user
 * DELETE /api/gemini/finished-users/:userId
 */
export async function deleteFinishedUser(req, res) {
  try {
    const { userId } = req.params;
    const deleted = geminiConversationService.deleteFinishedUser(userId);
    return res.json({
      success: deleted,
      message: deleted ? 'User removed from finished list' : 'User not found',
    });
  } catch (error) {
    logError('❌ Error in deleteFinishedUser controller:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

// ===== Auto Messages Management (הודעות מוכנות ל-function call) =====

export async function getAutoMessages(req, res) {
  try {
    const data = loadAutoMessagesData();
    return res.json({ success: true, messages: data.messages || [] });
  } catch (error) {
    logError('❌ Error in getAutoMessages:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function saveAutoMessage(req, res) {
  try {
    const { index, type, text, imagePath } = req.body || {};
    if (index === undefined || index === null) {
      return res.status(400).json({ success: false, error: 'Index is required' });
    }
    if (!type || !['text', 'image', 'text_image'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Valid type required (text, image, text_image)' });
    }
    if (type === 'text' && !text) {
      return res.status(400).json({ success: false, error: 'Text is required for text type' });
    }
    if (type === 'image' && !imagePath) {
      return res.status(400).json({ success: false, error: 'Image path required for image type' });
    }
    if (type === 'text_image' && (!text || !imagePath)) {
      return res.status(400).json({ success: false, error: 'Text and image path required for text_image' });
    }
    const data = loadAutoMessagesData();
    if (data.messages.some(m => m.index === index)) {
      return res.status(400).json({ success: false, error: `Index ${index} already exists` });
    }
    const newMsg = {
      id: `msg_${Date.now()}`,
      index: parseInt(index),
      type,
      text: text || null,
      imagePath: imagePath || null,
      createdAt: new Date().toISOString(),
    };
    data.messages.push(newMsg);
    data.messages.sort((a, b) => a.index - b.index);
    if (saveAutoMessagesData(data)) {
      return res.json({ success: true, message: newMsg });
    }
    return res.status(500).json({ success: false, error: 'Failed to save' });
  } catch (error) {
    logError('❌ Error in saveAutoMessage:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function updateAutoMessage(req, res) {
  try {
    const { id } = req.params;
    const { index, type, text, imagePath } = req.body || {};
    const data = loadAutoMessagesData();
    const idx = data.messages.findIndex(m => m.id === id);
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }
    const msg = data.messages[idx];
    if (index !== undefined) {
      if (data.messages.some(m => m.index === index && m.id !== id)) {
        return res.status(400).json({ success: false, error: `Index ${index} already exists` });
      }
      msg.index = parseInt(index);
    }
    if (type) msg.type = type;
    if (text !== undefined) msg.text = text || null;
    if (imagePath !== undefined) msg.imagePath = imagePath || null;
    if (msg.type === 'text' && !msg.text) {
      return res.status(400).json({ success: false, error: 'Text required' });
    }
    if (msg.type === 'image' && !msg.imagePath) {
      return res.status(400).json({ success: false, error: 'Image path required' });
    }
    msg.updatedAt = new Date().toISOString();
    data.messages.sort((a, b) => a.index - b.index);
    if (saveAutoMessagesData(data)) {
      return res.json({ success: true, message: msg });
    }
    return res.status(500).json({ success: false, error: 'Failed to update' });
  } catch (error) {
    logError('❌ Error in updateAutoMessage:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function deleteAutoMessage(req, res) {
  try {
    const { id } = req.params;
    const data = loadAutoMessagesData();
    const idx = data.messages.findIndex(m => m.id === id);
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }
    data.messages.splice(idx, 1);
    if (saveAutoMessagesData(data)) {
      return res.json({ success: true, message: 'Deleted' });
    }
    return res.status(500).json({ success: false, error: 'Failed to delete' });
  } catch (error) {
    logError('❌ Error in deleteAutoMessage:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

