import { GOOGLE_OAUTH_CONFIG, isOAuthClientConfigured } from './googleAuthConfig.js';

/**
 * Build a thin wrapper around Google Identity Services OAuth token client.
 *
 * Design goals:
 * - Keep auth concerns isolated from sync controller orchestration logic.
 * - Expose Promise-based APIs so controller code can stay linear and readable.
 * - Surface setup issues (missing client id / missing GIS script) with explicit errors.
 */
export function createGoogleAuthClient(config = GOOGLE_OAUTH_CONFIG) {
  /** @type {string | null} */
  let accessToken = null;

  /**
   * Session cache key for OAuth response metadata.
   * Session storage avoids persisting sensitive token data beyond browser session.
   */
  const SESSION_STORAGE_KEY = 'pantrymanager.google-auth';

  /**
   * @returns {boolean}
   */
  function hasGoogleIdentityServices() {
    return Boolean(globalThis.google?.accounts?.oauth2?.initTokenClient);
  }

  /**
   * Validate runtime prerequisites before opening OAuth flow.
   */
  function assertReady() {
    if (!isOAuthClientConfigured(config)) {
      throw new Error('Google OAuth client ID is not configured. Replace marker in assets/js/platform/googleAuthConfig.js.');
    }

    if (!hasGoogleIdentityServices()) {
      throw new Error('Google Identity Services library is unavailable. Confirm https://accounts.google.com/gsi/client is loaded.');
    }
  }

  /**
   * Persist token metadata for the current browser session.
   * @param {{accessToken: string, expiresIn?: number}} metadata
   */
  function persistSessionToken(metadata) {
    if (!globalThis.sessionStorage || !metadata?.accessToken) {
      return;
    }

    const expiresInMs = Number(metadata.expiresIn || 0) * 1000;
    const expiresAt = Number.isFinite(expiresInMs) && expiresInMs > 0
      ? Date.now() + expiresInMs
      : Date.now() + (45 * 60 * 1000);

    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
      accessToken: metadata.accessToken,
      expiresAt,
    }));
  }

  /**
   * Remove any cached token metadata from the browser session.
   */
  function clearPersistedSessionToken() {
    globalThis.sessionStorage?.removeItem?.(SESSION_STORAGE_KEY);
  }

  /**
   * Restore in-memory token from sessionStorage when still valid.
   * @returns {boolean}
   */
  function restoreSessionToken() {
    if (!globalThis.sessionStorage) {
      return false;
    }

    try {
      const rawPayload = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!rawPayload) {
        return false;
      }

      const parsedPayload = JSON.parse(rawPayload);
      const isExpired = !parsedPayload?.expiresAt || Date.now() >= Number(parsedPayload.expiresAt);
      if (isExpired || !parsedPayload?.accessToken) {
        clearPersistedSessionToken();
        return false;
      }

      accessToken = parsedPayload.accessToken;
      return true;
    } catch {
      clearPersistedSessionToken();
      return false;
    }
  }

  /**
   * Request a Google OAuth access token via popup.
   *
   * @param {{prompt?: '' | 'consent' | 'select_account'}} [options]
   * @returns {Promise<string>}
   */
  async function requestAccessToken(options = {}) {
    assertReady();

    return new Promise((resolve, reject) => {
      const tokenClient = globalThis.google.accounts.oauth2.initTokenClient({
        client_id: config.clientId,
        scope: config.scope,
        callback: (response) => {
          if (response?.error) {
            reject(new Error(`Google authorization failed (${response.error}).`));
            return;
          }

          if (!response?.access_token) {
            reject(new Error('Google authorization response did not include an access token.'));
            return;
          }

          accessToken = response.access_token;
          persistSessionToken({
            accessToken,
            expiresIn: Number(response.expires_in || 0),
          });
          resolve(accessToken);
        },
      });

      tokenClient.requestAccessToken({ prompt: options.prompt ?? '' });
    });
  }

  /**
   * Revoke current access token if available.
   *
   * @returns {Promise<void>}
   */
  async function signOut() {
    if (accessToken && globalThis.google?.accounts?.oauth2?.revoke) {
      await new Promise((resolve) => {
        globalThis.google.accounts.oauth2.revoke(accessToken, () => resolve());
      });
    }

    accessToken = null;
    clearPersistedSessionToken();
  }

  // Hydrate token cache on startup so users remain connected across reloads.
  restoreSessionToken();

  return {
    hasGoogleIdentityServices,
    isConfigured: () => isOAuthClientConfigured(config),
    hasAccessToken: () => Boolean(accessToken),
    getAccessToken: () => accessToken,
    requestAccessToken,
    signOut,
  };
}
