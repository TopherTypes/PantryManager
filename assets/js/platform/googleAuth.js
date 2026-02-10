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
  }

  return {
    hasGoogleIdentityServices,
    isConfigured: () => isOAuthClientConfigured(config),
    hasAccessToken: () => Boolean(accessToken),
    getAccessToken: () => accessToken,
    requestAccessToken,
    signOut,
  };
}
