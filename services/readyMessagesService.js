/**
 * Ready Messages (הודעות מוכנות) - file-based storage
 * Each message has: id, index (auto-increment), type (text|image|video|text_image), text?, mediaPath?, mimeType?, createdAt
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { logError, logInfo } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(process.cwd(), 'data');
const FILE_PATH = path.join(DATA_DIR, 'ready_messages.json');
const MEDIA_DIR = path.join(DATA_DIR, 'ready_messages_media');

const TYPES = ['text', 'image', 'video', 'text_image', 'text_video'];

function generateId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

async function ensureDirs() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(MEDIA_DIR, { recursive: true });
}

async function readData() {
  await ensureDirs();
  try {
    const raw = await fs.readFile(FILE_PATH, 'utf8');
    const data = JSON.parse(raw);
    const messages = Array.isArray(data?.messages) ? data.messages : [];
    const nextIndex = typeof data?.nextIndex === 'number' ? data.nextIndex : 1;
    return { messages, nextIndex };
  } catch (e) {
    if (e.code === 'ENOENT') {
      return { messages: [], nextIndex: 1 };
    }
    logError('readyMessagesService readData', e);
    return { messages: [], nextIndex: 1 };
  }
}

async function writeData(messages, nextIndex) {
  await ensureDirs();
  await fs.writeFile(
    FILE_PATH,
    JSON.stringify({ messages, nextIndex }, null, 2),
    'utf8'
  );
}

function normalizeMessage(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const type = TYPES.includes(raw.type) ? raw.type : 'text';
  const needText = type === 'text' || type === 'text_image' || type === 'text_video';
  const needMedia = type === 'image' || type === 'video' || type === 'text_image' || type === 'text_video';
  return {
    id: String(raw.id || generateId()),
    index: typeof raw.index === 'number' ? raw.index : 0,
    type,
    text: needText ? String(raw.text || '').trim() : (raw.text ? String(raw.text).trim() : ''),
    mediaPath: needMedia ? (raw.mediaPath || null) : null,
    mimeType: raw.mimeType || null,
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || null,
  };
}

/**
 * Get all messages and next index
 */
export async function getAll() {
  const { messages, nextIndex } = await readData();
  return { messages: messages.map(normalizeMessage).filter(Boolean), nextIndex };
}

/**
 * Get next INDEX value (for display when adding new)
 */
export async function getNextIndex() {
  const { nextIndex } = await readData();
  return nextIndex;
}

/**
 * Add a new message. Assigns next index and increments it.
 * mediaBuffer: { data: Buffer, mimeType: string } optional; if provided, saved to MEDIA_DIR and mediaPath set.
 */
export async function addMessage(payload, mediaBuffer = null) {
  const { messages, nextIndex } = await readData();
  const id = generateId();
  let mediaPath = null;
  let mimeType = null;

  if (mediaBuffer && mediaBuffer.data && mediaBuffer.mimeType) {
    const ext = mediaBuffer.mimeType.split('/')[1] || 'bin';
    const safeExt = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov'].includes(ext) ? ext : 'bin';
    const filename = `${id}.${safeExt}`;
    const filePath = path.join(MEDIA_DIR, filename);
    await fs.writeFile(filePath, mediaBuffer.data);
    mediaPath = filename;
    mimeType = mediaBuffer.mimeType;
  }

  const requestedIndex = typeof payload.index === 'number' && payload.index >= 1 ? payload.index : nextIndex;
  const newMsg = normalizeMessage({
    id,
    index: requestedIndex,
    type: payload.type || 'text',
    text: payload.text,
    mediaPath: payload.mediaPath || mediaPath,
    mimeType: payload.mimeType || mimeType,
    createdAt: new Date().toISOString(),
  });
  messages.push(newMsg);
  const nextSuggested = Math.max(nextIndex, requestedIndex + 1);
  await writeData(messages, nextSuggested);
  logInfo(`Ready message added: id=${id}, index=${requestedIndex}`);
  return newMsg;
}

/**
 * Update message by id
 */
export async function updateMessage(id, updates, mediaBuffer = null) {
  const { messages, nextIndex } = await readData();
  const idx = messages.findIndex((m) => m.id === id);
  if (idx === -1) return null;

  let mediaPath = messages[idx].mediaPath;
  let mimeType = messages[idx].mimeType;
  if (mediaBuffer && mediaBuffer.data && mediaBuffer.mimeType) {
    const ext = mediaBuffer.mimeType.split('/')[1] || 'bin';
    const safeExt = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov'].includes(ext) ? ext : 'bin';
    const filename = `${id}.${safeExt}`;
    const filePath = path.join(MEDIA_DIR, filename);
    await fs.writeFile(filePath, mediaBuffer.data);
    mediaPath = filename;
    mimeType = mediaBuffer.mimeType;
  }

  const merged = {
    ...messages[idx],
    ...updates,
    id: messages[idx].id,
    index: messages[idx].index,
    updatedAt: new Date().toISOString(),
  };
  if (mediaPath !== undefined) merged.mediaPath = mediaPath;
  if (mimeType !== undefined) merged.mimeType = mimeType;
  messages[idx] = normalizeMessage(merged);
  await writeData(messages, nextIndex);
  return messages[idx];
}

/**
 * Delete message by id; remove media file if exists
 */
export async function deleteMessage(id) {
  const { messages, nextIndex } = await readData();
  const msg = messages.find((m) => m.id === id);
  if (!msg) return false;
  if (msg.mediaPath) {
    try {
      await fs.unlink(path.join(MEDIA_DIR, path.basename(msg.mediaPath)));
    } catch (e) {
      if (e.code !== 'ENOENT') logError('readyMessagesService delete media', e);
    }
  }
  const filtered = messages.filter((m) => m.id !== id);
  await writeData(filtered, nextIndex);
  logInfo(`Ready message deleted: id=${id}`);
  return true;
}

/**
 * Get message by id
 */
export async function getMessageById(id) {
  const { messages } = await readData();
  return messages.find((m) => m.id === id) || null;
}

/**
 * Resolve full path for a media filename (for serving)
 */
export function getMediaPath(filename) {
  return path.join(MEDIA_DIR, path.basename(filename));
}
