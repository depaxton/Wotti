/**
 * Google Calendar OAuth2 and token management.
 * Credentials: config/google-calendar-credentials.json (copy from .example and fill).
 * Tokens: data/google-calendar-tokens.json (created after first connect).
 */

import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import { logError, logInfo } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const CREDENTIALS_PATH = path.join(PROJECT_ROOT, 'config', 'google-calendar-credentials.json');
const TOKENS_PATH = path.join(PROJECT_ROOT, 'data', 'google-calendar-tokens.json');
const SCOPES = ['https://www.googleapis.com/auth/calendar'];

let cachedOAuth2Client = null;
let cachedTokens = null;

/**
 * Load credentials from config file (user must create from example).
 * @returns {Promise<{client_id: string, client_secret: string, redirect_uri: string}|null>}
 */
export async function loadCredentials() {
  try {
    const data = await fs.readFile(CREDENTIALS_PATH, 'utf8');
    const cred = JSON.parse(data);
    if (cred.client_id && cred.client_secret) {
      return {
        client_id: cred.client_id.trim(),
        client_secret: cred.client_secret.trim(),
        redirect_uri: (cred.redirect_uri || '').trim() || undefined
      };
    }
  } catch (e) {
    if (e.code !== 'ENOENT') logError(`Google Calendar credentials load: ${e.message}`);
  }
  return null;
}

/**
 * Ensure data dir exists and load tokens from data/google-calendar-tokens.json.
 * @returns {Promise<Object|null>} { access_token, refresh_token, expiry_date } or null
 */
async function loadTokens() {
  if (cachedTokens) return cachedTokens;
  try {
    const data = await fs.readFile(TOKENS_PATH, 'utf8');
    cachedTokens = JSON.parse(data);
    return cachedTokens;
  } catch (e) {
    if (e.code !== 'ENOENT') logError(`Google Calendar tokens load: ${e.message}`);
  }
  return null;
}

/**
 * Save tokens to data/google-calendar-tokens.json.
 * @param {Object} tokens - OAuth2 tokens from Google
 */
export async function saveTokens(tokens) {
  const dataDir = path.dirname(TOKENS_PATH);
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(TOKENS_PATH, JSON.stringify(tokens, null, 2), 'utf8');
  cachedTokens = tokens;
  cachedOAuth2Client = null;
  logInfo('Google Calendar tokens saved');
}

/**
 * Clear saved tokens (disconnect).
 */
export async function clearTokens() {
  try {
    await fs.unlink(TOKENS_PATH);
  } catch (e) {
    if (e.code !== 'ENOENT') logError(`Google Calendar clear tokens: ${e.message}`);
  }
  cachedTokens = null;
  cachedOAuth2Client = null;
  logInfo('Google Calendar disconnected');
}

/**
 * Get OAuth2 client (no tokens yet).
 * @returns {Promise<import('google-auth-library').OAuth2Client|null>}
 */
export async function getOAuth2Client() {
  const cred = await loadCredentials();
  if (!cred) return null;
  const redirect = cred.redirect_uri || 'http://localhost:5000/api/google-calendar/callback';
  return new google.auth.OAuth2(cred.client_id, cred.client_secret, redirect);
}

/**
 * Get auth URL for user to open in browser.
 * @param {string} [redirectUri] - Override redirect_uri (e.g. for production URL)
 * @returns {Promise<{url: string}|{error: string}>}
 */
export async function getAuthUrl(redirectUri) {
  const client = await getOAuth2Client();
  if (!client) return { error: 'credentials_missing' };
  const options = {
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES
  };
  if (redirectUri) client.redirectUri = redirectUri;
  const url = client.generateAuthUrl(options);
  return { url };
}

/**
 * Exchange authorization code for tokens and save them.
 * @param {string} code - Code from callback query
 * @param {string} [redirectUri] - Same redirect_uri used in getAuthUrl
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function exchangeCodeForTokens(code, redirectUri) {
  const client = await getOAuth2Client();
  if (!client) return { ok: false, error: 'credentials_missing' };
  if (redirectUri) client.redirectUri = redirectUri;
  try {
    const { tokens } = await client.getToken(code);
    await saveTokens(tokens);
    return { ok: true };
  } catch (e) {
    logError(`Google Calendar token exchange: ${e.message}`);
    return { ok: false, error: e.message || 'token_exchange_failed' };
  }
}

/**
 * Whether we have valid credentials and (optionally) tokens.
 * @param {boolean} requireTokens - If true, consider connected only when tokens exist
 * @returns {Promise<boolean>}
 */
export async function isConnected(requireTokens = true) {
  const cred = await loadCredentials();
  if (!cred) return false;
  if (!requireTokens) return true;
  const tokens = await loadTokens();
  return !!(tokens && (tokens.refresh_token || tokens.access_token));
}

/**
 * Get an authenticated Calendar API client (refreshes token if needed).
 * @returns {Promise<{calendar: import('googleapis').calendar_v3.Calendar, auth: import('google-auth-library').OAuth2Client}|null>}
 */
export async function getCalendarClient() {
  const tokens = await loadTokens();
  if (!tokens) return null;
  const client = await getOAuth2Client();
  if (!client) return null;
  client.setCredentials(tokens);
  if (cachedOAuth2Client) cachedOAuth2Client = null;

  const refreshIfNeeded = () => {
    return new Promise((resolve) => {
      if (!client.credentials.expiry_date || client.credentials.expiry_date > Date.now() + 60_000) {
        resolve();
        return;
      }
      client.refreshAccessToken((err, newTokens) => {
        if (!err && newTokens) saveTokens({ ...tokens, ...newTokens }).catch(() => {});
        resolve();
      });
    });
  };
  await refreshIfNeeded();

  const calendar = google.calendar({ version: 'v3', auth: client });
  return { calendar, auth: client };
}
