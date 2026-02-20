// User service
// Handles loading and saving users to/from JSON file
// Implements append-only behavior - never deletes users

import fs from 'fs/promises';
import path from 'path';
import { logError, logInfo } from '../utils/logger.js';

const DATA_DIR = 'data';
const FILE_NAME = 'users.json';
const FILE_PATH = path.join(process.cwd(), DATA_DIR, FILE_NAME);

/**
 * Ensures the data directory exists
 */
async function ensureDataDir() {
  try {
    await fs.mkdir(path.join(process.cwd(), DATA_DIR), { recursive: true });
  } catch (error) {
    logError(`Failed to create data directory: ${error.message}`);
    throw error;
  }
}

/**
 * Loads users from the JSON file
 * @returns {Promise<Object>} Object with phone numbers as keys and user objects as values
 */
export async function loadUsers() {
  await ensureDataDir();
  try {
    const data = await fs.readFile(FILE_PATH, 'utf8');
    const users = JSON.parse(data);
    return users || {};
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist yet, return empty object
      logInfo('Users JSON file does not exist yet. Will be created on first user addition.');
      return {};
    }
    logError(`Failed to load users from ${FILE_PATH}: ${error.message}`);
    return {};
  }
}

/**
 * Saves users to the JSON file
 * @param {Object} users - Object with phone numbers as keys and user objects as values
 */
export async function saveUsers(users) {
  await ensureDataDir();
  try {
    // Write with pretty formatting (2 spaces indentation)
    await fs.writeFile(FILE_PATH, JSON.stringify(users, null, 2), 'utf8');
    logInfo(`Saved ${Object.keys(users).length} users to JSON file`);
  } catch (error) {
    logError(`Failed to save users to ${FILE_PATH}: ${error.message}`);
    throw error;
  }
}

/**
 * Ensures a user exists in the JSON file
 * If the user doesn't exist, appends them (append-only behavior)
 * @param {string} phoneNumber - The user's phone number (used as key)
 * @param {string} name - The user's name
 * @returns {Promise<Object>} The user object from the JSON file
 */
export async function ensureUserExists(phoneNumber, name) {
  const users = await loadUsers();
  
  if (!users[phoneNumber]) {
    // User doesn't exist, append them
    users[phoneNumber] = {
      name: name || phoneNumber,
      phone: phoneNumber
    };
    await saveUsers(users);
    logInfo(`Added new user to JSON: ${phoneNumber} (${name || phoneNumber})`);
  }
  
  return users[phoneNumber];
}

/**
 * Gets a user from the JSON file by phone number
 * @param {string} phoneNumber - The user's phone number
 * @returns {Promise<Object|null>} The user object or null if not found
 */
export async function getUser(phoneNumber) {
  const users = await loadUsers();
  return users[phoneNumber] || null;
}

export async function updateUser(phoneNumber, updates) {
  const users = await loadUsers();
  if (!users[phoneNumber]) {
    throw new Error('User not found');
  }
  
  users[phoneNumber] = { ...users[phoneNumber], ...updates };
  await saveUsers(users);
  return users[phoneNumber];
}

/**
 * Gets all users from the JSON file
 * @returns {Promise<Object>} Object with all users
 */
export async function getAllUsers() {
  return await loadUsers();
}

/**
 * Clears all users from the JSON file (used on logout so the next user's contacts are the only ones saved)
 * @returns {Promise<void>}
 */
export async function clearAllUsers() {
  await saveUsers({});
  logInfo('Cleared all users from JSON file (logout)');
}

