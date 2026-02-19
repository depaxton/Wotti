/**
 * API for Google Calendar connection: auth URL, callback, status, disconnect.
 */

import {
  getAuthUrl,
  exchangeCodeForTokens,
  isConnected,
  clearTokens,
  loadCredentials
} from '../services/googleCalendarAuthService.js';
import { logError } from '../utils/logger.js';

/**
 * GET /api/google-calendar/auth-url
 * Returns URL to open in browser for OAuth. Frontend opens it (e.g. new window).
 */
export async function getAuthUrlController(req, res) {
  try {
    const baseUrl = req.query.base_url || `${req.protocol}://${req.get('host')}`;
    const redirectUri = `${baseUrl.replace(/\/$/, '')}/api/google-calendar/callback`;
    const result = await getAuthUrl(redirectUri);
    if (result.error) {
      return res.status(400).json({ ok: false, error: result.error });
    }
    res.json({ ok: true, url: result.url });
  } catch (e) {
    logError('Google Calendar getAuthUrl', e);
    res.status(500).json({ ok: false, error: e?.message || 'server_error' });
  }
}

/**
 * GET /api/google-calendar/callback?code=...&state=...
 * OAuth callback: exchange code for tokens, then redirect to app.
 */
export async function oauthCallbackController(req, res) {
  const code = req.query.code;
  if (!code) {
    return res.redirect('/?google_calendar=error&message=missing_code');
  }
  const baseUrl = req.query.base_url || `${req.protocol}://${req.get('host')}`;
  const redirectUri = `${baseUrl.replace(/\/$/, '')}/api/google-calendar/callback`;
  const result = await exchangeCodeForTokens(code, redirectUri);
  if (!result.ok) {
    return res.redirect(`/?google_calendar=error&message=${encodeURIComponent(result.error || 'exchange_failed')}`);
  }
  res.redirect('/?google_calendar=connected');
}

/**
 * GET /api/google-calendar/status
 * Returns whether credentials are configured and whether we have tokens (connected).
 */
export async function getStatusController(req, res) {
  try {
    const hasCredentials = await loadCredentials().then((c) => !!c);
    const connected = await isConnected(true);
    res.json({
      configured: hasCredentials,
      connected
    });
  } catch (e) {
    logError('Google Calendar getStatus', e);
    res.status(500).json({ configured: false, connected: false, error: e?.message });
  }
}

/**
 * POST /api/google-calendar/disconnect
 * Clears saved tokens so user can connect with another account.
 */
export async function disconnectController(req, res) {
  try {
    await clearTokens();
    res.json({ ok: true });
  } catch (e) {
    logError('Google Calendar disconnect', e);
    res.status(500).json({ ok: false, error: e?.message });
  }
}
