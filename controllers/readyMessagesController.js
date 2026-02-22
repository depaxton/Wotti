/**
 * Ready Messages (הודעות מוכנות) - API controller
 */

import path from 'path';
import {
  getAll,
  getNextIndex,
  addMessage,
  updateMessage,
  deleteMessage,
  getMessageById,
  getMediaPath,
} from '../services/readyMessagesService.js';
import { logError } from '../utils/logger.js';
import fs from 'fs/promises';

/**
 * GET /api/ready-messages
 */
export async function getMessagesController(req, res) {
  try {
    const { messages, nextIndex } = await getAll();
    res.json({ messages, nextIndex });
  } catch (e) {
    logError('getMessagesController', e);
    res.status(500).json({ error: 'Failed to load ready messages' });
  }
}

/**
 * GET /api/ready-messages/next-index
 */
export async function getNextIndexController(req, res) {
  try {
    const nextIndex = await getNextIndex();
    res.json({ nextIndex });
  } catch (e) {
    logError('getNextIndexController', e);
    res.status(500).json({ error: 'Failed to get next index' });
  }
}

/**
 * POST /api/ready-messages
 * Body: { type, text?, mediaBase64?, mimeType?, index? } — index optional, chosen by user
 */
export async function postMessageController(req, res) {
  try {
    const body = req.body || {};
    const { type, text, mediaBase64, mimeType, index } = body;
    let mediaBuffer = null;
    if (mediaBase64 && mimeType) {
      const data = Buffer.from(mediaBase64, 'base64');
      if (data.length) mediaBuffer = { data, mimeType };
    }
    const payload = { type, text };
    if (typeof index === 'number' && index >= 1) payload.index = index;
    const msg = await addMessage(payload, mediaBuffer);
    res.status(201).json(msg);
  } catch (e) {
    logError('postMessageController', e);
    res.status(500).json({ error: e?.message || 'Failed to add ready message' });
  }
}

/**
 * PUT /api/ready-messages/:id
 * Body: { type?, text?, mediaBase64?, mimeType? }
 */
export async function putMessageController(req, res) {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const { type, text, mediaBase64, mimeType } = body;
    let mediaBuffer = null;
    if (mediaBase64 && mimeType) {
      const data = Buffer.from(mediaBase64, 'base64');
      if (data.length) mediaBuffer = { data, mimeType };
    }
    const msg = await updateMessage(id, { type, text }, mediaBuffer);
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    res.json(msg);
  } catch (e) {
    logError('putMessageController', e);
    res.status(500).json({ error: e?.message || 'Failed to update ready message' });
  }
}

/**
 * DELETE /api/ready-messages/:id
 */
export async function deleteMessageController(req, res) {
  try {
    const { id } = req.params;
    const deleted = await deleteMessage(id);
    if (!deleted) return res.status(404).json({ error: 'Message not found' });
    res.json({ success: true });
  } catch (e) {
    logError('deleteMessageController', e);
    res.status(500).json({ error: 'Failed to delete ready message' });
  }
}

/**
 * GET /api/ready-messages/:id/media
 * Serves the media file for a message (image/video)
 */
export async function getMessageMediaController(req, res) {
  try {
    const { id } = req.params;
    const msg = await getMessageById(id);
    if (!msg || !msg.mediaPath) return res.status(404).send('Media not found');
    const filePath = getMediaPath(msg.mediaPath);
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).send('File not found');
    }
    const mime = msg.mimeType || 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    const absolutePath = path.resolve(filePath);
    res.sendFile(absolutePath, { maxAge: '1d' }, (err) => {
      if (err && !res.headersSent) {
        logError('getMessageMediaController sendFile', err);
        res.status(500).send('Error sending file');
      }
    });
  } catch (e) {
    logError('getMessageMediaController', e);
    res.status(500).send('Error');
  }
}
