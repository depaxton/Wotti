import fs from 'fs/promises';
import path from 'path';
import { logError, logInfo } from '../utils/logger.js';

const DATA_DIR = 'data';
const FILE_NAME = 'settings.json';
const FILE_PATH = path.join(process.cwd(), DATA_DIR, FILE_NAME);

async function ensureDataDir() {
  try {
    await fs.mkdir(path.join(process.cwd(), DATA_DIR), { recursive: true });
  } catch (error) {
    logError(`Failed to create data directory: ${error.message}`);
    throw error;
  }
}

export async function loadSettings() {
  await ensureDataDir();
  try {
    const data = await fs.readFile(FILE_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      const defaultSettings = { defaultMeetingDuration: 45, chatEnabled: true };
      await saveSettings(defaultSettings);
      return defaultSettings;
    }
    logError(`Failed to load settings: ${error.message}`);
    return { defaultMeetingDuration: 45, chatEnabled: true };
  }
}

export async function saveSettings(settings) {
  await ensureDataDir();
  try {
    await fs.writeFile(FILE_PATH, JSON.stringify(settings, null, 2), 'utf8');
    logInfo('Saved global settings');
    return settings;
  } catch (error) {
    logError(`Failed to save settings: ${error.message}`);
    throw error;
  }
}

